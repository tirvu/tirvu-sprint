const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { TaskHourAttachment, TaskHourHistory, User } = require('../models/associations');
const { authMiddleware } = require('./middlewares');
const os = require('os');
const stream = require('stream');
const crypto = require('crypto');
const FtpManager = require('../utils/ftpManager');
const { promisify } = require('util');

// Sistema de cache para arquivos com duração otimizada
const CACHE_DURATION = 60 * 60 * 1000; // 60 minutos em milissegundos

// Função para gerar hash de arquivo para cache
function generateFileHash(filePath, userId) {
  return crypto.createHash('md5').update(`${filePath}-${userId}`).digest('hex');
}

// Configuração do multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: function (req, file, cb) {
    // Permitir apenas certos tipos de arquivos
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Apenas imagens, PDFs e documentos Office são aceitos.'));
    }
  }
});

// fs-extra foi substituído por fs nativo
// Importar o Sharp configurado para multi-plataforma
const sharp = require('../sharp.config');
const NodeCache = require('node-cache');
const compression = require('compression');

// Removido sistema de cache local, pois todos os arquivos são acessados diretamente via FTP

// Removido código de armazenamento local, pois todos os arquivos são gerenciados via FTP

// Função removida pois a compressão agora é feita diretamente no buffer

// Função para upload para o FTP - Prioriza armazenamento FTP conforme requisito
async function uploadToFTP(fileBuffer, remoteFileName, mimeType, forceCompress = false) {
  // Garantir que o nome do arquivo seja seguro para FTP
  remoteFileName = remoteFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Verificar se é uma imagem para compressão
  const fileExt = path.extname(remoteFileName).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png'].includes(fileExt);
  
  // Comprimir imagem se aplicável - com timeout para evitar bloqueios
  let bufferToUpload = fileBuffer;
  let wasCompressed = false;
  
  if (isImage && (forceCompress || process.env.ALWAYS_COMPRESS_IMAGES === 'true')) {
    try {
      // Adicionar timeout para compressão
      const compressionPromise = new Promise((resolve) => {
        try {
          // Usar Sharp configurado para compressão de imagem
          sharp(fileBuffer)
            .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 }) // Para JPEGs
            .png({ quality: 80 })  // Para PNGs
            .toBuffer()
            .then(compressedBuffer => {
              resolve(compressedBuffer);
            })
            .catch(err => {
              console.error('Erro ao comprimir imagem com Sharp:', err);
              resolve(null);
            });
        } catch (err) {
          console.error('Erro ao comprimir imagem:', err);
          resolve(null);
        }
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na compressão')), 15000)
      );
      
      // Usar Promise.race para limitar o tempo de compressão
      const compressedBuffer = await Promise.race([compressionPromise, timeoutPromise]);
      
      if (compressedBuffer) {
        const originalSize = Math.round(fileBuffer.length / 1024);
        const compressedSize = Math.round(compressedBuffer.length / 1024);
        const reduction = Math.round(((fileBuffer.length - compressedBuffer.length) / fileBuffer.length) * 100);
        
        console.log(`Compressão bem-sucedida: ${originalSize}KB -> ${compressedSize}KB (redução de ${reduction}%)`);
        
        // Só usar o buffer comprimido se realmente houver redução significativa
        if (compressedBuffer.length < fileBuffer.length * 0.9) { // Pelo menos 10% de redução
          bufferToUpload = compressedBuffer;
          wasCompressed = true;
        } else {
          console.log('Redução de tamanho insuficiente, usando arquivo original');
        }
      }
    } catch (compressErr) {
      console.error('Erro ou timeout na compressão:', compressErr);
      // Continuar com o buffer original se a compressão falhar
    }
  }
  
  // Definir o diretório remoto (simplificado para evitar subpastas)
  const remoteDir = 'uploads';
  
  try {
    console.log(`Iniciando upload do arquivo ${remoteFileName}`);
    
    // Verificar se o diretório remoto existe, se não, tentar criá-lo
    try {
      await FtpManager.ensureDir(remoteDir);
      console.log(`Diretório ${remoteDir} verificado/criado com sucesso`);
    } catch (dirError) {
      console.error(`Erro ao verificar/criar diretório remoto: ${dirError.message}`);
      // Continuar mesmo com erro, o FtpManager tentará criar o diretório novamente durante o upload
    }
    
    // Construir o caminho remoto simples (sem subdiretórios)
    const remotePath = `${remoteDir}/${remoteFileName}`;
    
    try {
       // Fazer upload do arquivo para o diretório upload-tirvu-sprint
       console.log(`Enviando arquivo para ${remotePath}`);
       await FtpManager.uploadFile(bufferToUpload, remotePath);
       
       // Verificar se o arquivo existe após o upload
       const fileExists = await FtpManager.fileExists(remotePath);
       
       if (fileExists) {
         console.log(`Arquivo enviado com sucesso para: ${remotePath}`);
         return { 
           path: remotePath, 
           storage: 'ftp',
           compressed: wasCompressed 
         };
       } else {
         // Se não encontrou o arquivo, tentar upload para o diretório raiz
         throw new Error('Arquivo não encontrado após upload para diretório upload-tirvu-sprint');
       }
    } catch (uploadErr) {
      // Tentar upload alternativo para o diretório raiz como fallback
      console.log(`Tentando upload alternativo para o diretório raiz: ${uploadErr.message}`);
      const rootPath = remoteFileName;
      await FtpManager.uploadFile(bufferToUpload, rootPath);
      
      console.log(`Arquivo enviado com sucesso para o diretório raiz: ${rootPath}`);
      
      return { 
        path: rootPath, 
        storage: 'ftp',
        compressed: wasCompressed 
      };
    }
  } catch (err) {
    console.error(`Erro no upload FTP:`, err);
    throw new Error(`Falha no upload para FTP: ${err.message}`);
  }
}

// Aplicar compressão para todas as rotas
router.use(compression());

// Rota para upload de anexos - Otimizada para performance
router.post('/:taskHourHistoryId', authMiddleware, upload.array('attachments', 5), async (req, res) => {
  try {
    const { taskHourHistoryId } = req.params;
    const userId = req.user.id;
    const shouldCompress = req.body.compress === 'true';
    
    // Verificar se o registro de horas existe
    const hourRecord = await TaskHourHistory.findByPk(taskHourHistoryId);
    if (!hourRecord) {
      return res.status(404).json({ message: 'Registro de horas não encontrado' });
    }
    
    // Verificar permissão (apenas o próprio usuário ou admin pode adicionar anexos)
    if (hourRecord.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão para adicionar anexos a este registro' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }
    
    // Iniciar processamento de arquivos em paralelo
    const uploadPromises = req.files.map(async (file) => {
      try {
        // Verificar se é uma imagem para compressão
        const fileExt = path.extname(file.originalname).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png'].includes(fileExt);
        const forceCompress = isImage && shouldCompress;
        
        // Gerar nome de arquivo único
        const remoteFileName = `${uuidv4()}${path.extname(file.originalname)}`;
        
        // Upload para o FTP com fallback para armazenamento local
        const uploadResult = await uploadToFTP(file.buffer, remoteFileName, file.mimetype, forceCompress);
        
        // Verificar se foi comprimido
        const isCompressed = uploadResult.compressed || false;
        
        // Salvar informações no banco de dados
        const attachment = await TaskHourAttachment.create({
          filename: remoteFileName,
          originalFilename: file.originalname,
          filePath: uploadResult.path,
          fileType: file.mimetype,
          fileSize: file.size,
          storageType: uploadResult.storage,
          isCompressed: isCompressed,
          taskHourHistoryId,
          userId
        });
        
        return attachment;
      } catch (err) {
        console.error(`Erro ao processar arquivo ${file.originalname}:`, err);
        // Retornar null para arquivos que falharam
        return null;
      }
    });
    
    // Aguardar todas as operações de upload e filtrar os que falharam
    const results = await Promise.allSettled(uploadPromises);
    const attachments = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);
    
    // Verificar se algum upload foi bem-sucedido
    if (attachments.length === 0 && req.files.length > 0) {
      return res.status(500).json({ message: 'Falha ao processar todos os arquivos' });
    }
    
    res.status(201).json(attachments);
  } catch (error) {
    console.error('Erro ao fazer upload de anexos:', error);
    res.status(500).json({ message: 'Erro ao fazer upload de anexos' });
  }
});

// Rota para obter anexos de um registro de horas
router.get('/hour-record/:taskHourHistoryId', authMiddleware, async (req, res) => {
  try {
    const { taskHourHistoryId } = req.params;
    
    const attachments = await TaskHourAttachment.findAll({
      where: { taskHourHistoryId },
      include: [{ model: User, attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(attachments);
  } catch (error) {
    console.error('Erro ao buscar anexos:', error);
    res.status(500).json({ message: 'Erro ao buscar anexos' });
  }
});

// Função para encontrar um arquivo no FTP
async function findFileInFTP(filePath) {
  // Registrar o caminho original solicitado para depuração
  console.log(`Procurando arquivo no FTP. Caminho original: ${filePath}`);
  
  // Extrair apenas o nome do arquivo
  const fileName = path.basename(filePath);
  
  // Lista de possíveis caminhos para verificar
   const pathsToCheck = [
     // 1. Verificar o caminho exato fornecido
     {
       path: filePath,
       description: 'Caminho original'
     },
     // 2. Verificar no diretório 'upload-tirvu-sprint'
     {
       path: `upload-tirvu-sprint/${fileName}`,
       description: 'No diretório upload-tirvu-sprint'
     },
     // 3. Verificar no diretório raiz
     {
       path: fileName,
       description: 'No diretório raiz'
     },
     // 4. Verificar no diretório 'uploads' (para compatibilidade)
     {
       path: `uploads/${fileName}`,
       description: 'No diretório uploads'
     }
  ];
  
  // Verificar cada caminho com múltiplas tentativas
  for (const pathInfo of pathsToCheck) {
    let verificationAttempts = 0;
    const maxVerificationAttempts = 2;
    
    while (verificationAttempts < maxVerificationAttempts) {
      verificationAttempts++;
      try {
        console.log(`Verificando: ${pathInfo.description} (${pathInfo.path}) - Tentativa ${verificationAttempts}/${maxVerificationAttempts}`);
        const exists = await FtpManager.fileExists(pathInfo.path);
        
        if (exists) {
          console.log(`Arquivo encontrado em: ${pathInfo.path} (${pathInfo.description})`);
          return pathInfo.path;
        }
        
        // Pequena pausa entre tentativas para o mesmo caminho
        if (verificationAttempts < maxVerificationAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Erro ao verificar ${pathInfo.description}: ${error.message}`);
        // Continuar para a próxima tentativa ou próximo caminho
      }
    }
  }
  
  // Se chegou aqui, não encontrou o arquivo em nenhum dos caminhos
  console.error(`Arquivo não encontrado em nenhum dos caminhos verificados. Original: ${filePath}`);
  return null;
}

// Rota para excluir um anexo
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar o anexo
    const attachment = await TaskHourAttachment.findByPk(id);
    if (!attachment) {
      return res.status(404).json({ message: 'Anexo não encontrado' });
    }
    
    // Verificar permissão (apenas o próprio usuário ou admin pode excluir)
    if (attachment.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão para excluir este anexo' });
    }
    
    // Verificar se o arquivo existe no FTP e encontrar o caminho correto
    let filePath = attachment.filePath;
    const foundPath = await findFileInFTP(filePath);
    
    // Se encontrou o arquivo, excluí-lo
    if (foundPath) {
      try {
        // Se o caminho encontrado for diferente do armazenado, atualizar no banco
        if (foundPath !== filePath) {
          console.log(`Atualizando caminho no banco de dados: ${filePath} -> ${foundPath}`);
          await attachment.update({ filePath: foundPath });
          filePath = foundPath;
        }
        
        // Excluir o arquivo do FTP com múltiplas tentativas
        let deleteSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await FtpManager.deleteFile(filePath);
            console.log(`Arquivo excluído do FTP: ${filePath} (tentativa ${attempt})`);
            deleteSuccess = true;
            break;
          } catch (ftpErr) {
            console.error(`Erro ao excluir arquivo do FTP ${filePath} (tentativa ${attempt}):`, ftpErr);
            if (attempt < 3) {
              // Aguardar antes de tentar novamente
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        
        if (!deleteSuccess) {
          console.warn(`Não foi possível excluir o arquivo do FTP após 3 tentativas: ${filePath}`);
        }
      } catch (deleteErr) {
        console.error(`Erro ao excluir arquivo do FTP ${filePath}:`, deleteErr);
        // Continuar mesmo com erro na exclusão do FTP
      }
    } else {
      console.log(`Arquivo não encontrado no FTP: ${filePath}`);
    }
    
    // Excluir do banco de dados
    await attachment.destroy();
    
    res.json({ message: 'Anexo excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir anexo:', error);
    res.status(500).json({ message: 'Erro ao excluir anexo' });
  }
});

// Rota para acessar um arquivo (imagem, documento, PDF) - Versão simplificada
router.get('/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[ARQUIVO] Solicitação de arquivo com ID: ${id}`);
    
    // Buscar o anexo
    const attachment = await TaskHourAttachment.findByPk(id);
    if (!attachment) {
      console.log(`[ARQUIVO] Anexo não encontrado com ID: ${id}`);
      return res.status(404).json({ message: 'Anexo não encontrado' });
    }
    
    // Extrair informações do arquivo
    const fileName = attachment.originalFilename || path.basename(attachment.filePath);
    const fileExtension = fileName.split('.').pop().toLowerCase();
    
    console.log(`[ARQUIVO] Processando: ${fileName} (${fileExtension})`);
    
    // Definir o tipo de conteúdo baseado na extensão
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed'
    };
    
    const contentType = mimeTypes[fileExtension] || 'application/octet-stream';
    
    // Determinar se deve ser exibido inline ou como download
    const isImage = contentType.startsWith('image/');
    const isPdf = contentType === 'application/pdf';
    const disposition = (isImage || isPdf) ? 'inline' : 'attachment';
    
    console.log(`[ARQUIVO] Tipo: ${contentType}, Disposição: ${disposition}`);
    
    // Definir headers para a resposta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Cache-Control', 'max-age=86400'); // Cache por 24 horas
    res.setHeader('X-Content-Type-Options', 'nosniff'); // Evitar MIME-sniffing
    
    // Lista de possíveis caminhos para o arquivo no FTP
    const possiblePaths = [
      attachment.filePath,
      attachment.filePath.startsWith('/') ? attachment.filePath.substring(1) : attachment.filePath,
      `upload-tirvu-sprint/${path.basename(attachment.filePath)}`,
      path.basename(attachment.filePath)
    ];
    
    console.log(`[ARQUIVO] Tentando caminhos: ${JSON.stringify(possiblePaths)}`);
    
    // Configurar eventos para quando o cliente fechar a conexão
    let downloadCancelled = false;
    res.on('close', () => {
      console.log('[ARQUIVO] Conexão fechada pelo cliente');
      downloadCancelled = true;
    });
    
    // Tentar baixar o arquivo diretamente do FTP para o cliente
    let downloadSuccess = false;
    let lastError = null;
    
    for (const ftpPath of possiblePaths) {
      if (downloadCancelled) break;
      
      try {
        console.log(`[ARQUIVO] Tentando baixar de: ${ftpPath}`);
        
        const { stream, cleanup } = await FtpManager.downloadFile(ftpPath);
        console.log(`[ARQUIVO] Stream de download iniciado para: ${ftpPath}`);
        
        // Configurar eventos do stream
        stream.on('error', (err) => {
          console.error(`[ARQUIVO] Erro no stream: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Erro ao ler arquivo', details: err.message });
          } else if (!res.writableEnded) {
            res.end();
          }
          cleanup();
        });
        
        stream.on('end', () => {
          console.log(`[ARQUIVO] Stream finalizado com sucesso: ${ftpPath}`);
          cleanup();
        });
        
        // Atualizar o caminho no banco de dados se necessário
        if (ftpPath !== attachment.filePath) {
          console.log(`[ARQUIVO] Atualizando caminho: ${attachment.filePath} -> ${ftpPath}`);
          await attachment.update({ filePath: ftpPath });
        }
        
        // Pipe do stream diretamente para a resposta
        stream.pipe(res);
        downloadSuccess = true;
        break;
      } catch (err) {
        console.warn(`[ARQUIVO] Erro ao baixar de ${ftpPath}: ${err.message}`);
        lastError = err;
      }
    }
    
    // Se não conseguiu baixar o arquivo
    if (!downloadSuccess && !downloadCancelled && !res.headersSent) {
      console.error('[ARQUIVO] Não foi possível baixar o arquivo de nenhum caminho');
      return res.status(404).json({ 
        message: 'Arquivo não encontrado no servidor', 
        details: lastError ? lastError.message : 'Todos os caminhos falharam'
      });
    }
  } catch (error) {
    console.error('[ARQUIVO] Erro ao processar arquivo:', error);
    
    // Enviar resposta de erro
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Erro ao processar arquivo', 
        details: error.message 
      });
    }
  }
});

// Rota para excluir um anexo
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar o anexo
    const attachment = await TaskHourAttachment.findByPk(id);
    if (!attachment) {
      return res.status(404).json({ message: 'Anexo não encontrado' });
    }
    
    // Verificar permissão (apenas o próprio usuário ou admin pode excluir)
    if (attachment.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão para excluir este anexo' });
    }
    
    // Função para encontrar o arquivo no FTP, tentando caminhos alternativos se necessário
    async function findFileInFTP(filePath) {
      // Registrar o caminho original solicitado para depuração
      console.log(`Procurando arquivo no FTP. Caminho original: ${filePath}`);
      
      // Lista de possíveis caminhos para verificar
      const pathsToCheck = [];
      
      // 1. Primeiro, adicionar o caminho exato fornecido
      pathsToCheck.push({
        path: filePath,
        description: 'Caminho original'
      });
      
      // 2. Verificar se o caminho está sem o prefixo 'uploads'
      if (!filePath.startsWith('uploads/')) {
        pathsToCheck.push({
          path: `uploads/${filePath}`,
          description: 'Com prefixo uploads'
        });
      }
      
      // 3. Verificar se o caminho está com o prefixo mas deveria estar sem
      if (filePath.startsWith('uploads/')) {
        pathsToCheck.push({
          path: filePath.substring('uploads/'.length),
          description: 'Sem prefixo uploads'
        });
      }
      
      // 4. Verificar com o prefixo antigo (para compatibilidade)
      if (filePath.startsWith('upload-tirvu-sprint/')) {
        pathsToCheck.push({
          path: `uploads/${filePath.substring('upload-tirvu-sprint/'.length)}`,
          description: 'Convertido de prefixo antigo para novo'
        });
      }
      
      // 4. Verificar no diretório raiz apenas pelo nome do arquivo
      const fileName = path.basename(filePath);
      pathsToCheck.push({
        path: fileName,
        description: 'Apenas nome do arquivo no diretório raiz'
      });
      
      // 5. Verificar no diretório de upload apenas pelo nome do arquivo
      pathsToCheck.push({
        path: `uploads/${fileName}`,
        description: 'Apenas nome do arquivo no diretório de uploads'
      });
      
      // Verificar cada caminho com múltiplas tentativas
      for (const pathInfo of pathsToCheck) {
        let verificationAttempts = 0;
        const maxVerificationAttempts = 2;
        
        while (verificationAttempts < maxVerificationAttempts) {
          verificationAttempts++;
          try {
            console.log(`Verificando: ${pathInfo.description} (${pathInfo.path}) - Tentativa ${verificationAttempts}/${maxVerificationAttempts}`);
            const exists = await FtpManager.fileExists(pathInfo.path);
            
            if (exists) {
              console.log(`Arquivo encontrado em: ${pathInfo.path} (${pathInfo.description})`);
              return pathInfo.path;
            }
            
            // Pequena pausa entre tentativas para o mesmo caminho
            if (verificationAttempts < maxVerificationAttempts) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.error(`Erro ao verificar ${pathInfo.description}: ${error.message}`);
            // Continuar para a próxima tentativa ou próximo caminho
          }
        }
      }
      
      // Se chegou aqui, não encontrou o arquivo em nenhum dos caminhos
      console.error(`Arquivo não encontrado em nenhum dos caminhos verificados. Original: ${filePath}`);
      return null;
    }
    
    // Verificar se o arquivo existe no FTP e encontrar o caminho correto
    let filePath = attachment.filePath;
    const foundPath = await findFileInFTP(filePath);
    
    // Se encontrou o arquivo, excluí-lo
    if (foundPath) {
      try {
        // Se o caminho encontrado for diferente do armazenado, atualizar no banco
        if (foundPath !== filePath) {
          console.log(`Atualizando caminho no banco de dados: ${filePath} -> ${foundPath}`);
          await attachment.update({ filePath: foundPath });
          filePath = foundPath;
        }
        
        // Excluir o arquivo do FTP
        await FtpManager.deleteFile(filePath);
        console.log(`Arquivo excluído do FTP: ${filePath}`);
      } catch (deleteErr) {
        console.error(`Erro ao excluir arquivo do FTP ${filePath}:`, deleteErr);
        // Continuar mesmo com erro na exclusão do FTP
      }
    } else {
      console.log(`Arquivo não encontrado no FTP: ${filePath}`);
    }
    
    // Excluir do banco de dados
    await attachment.destroy();
    
    res.json({ message: 'Anexo excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir anexo:', error);
    res.status(500).json({ message: 'Erro ao excluir anexo' });
  }
});

module.exports = router;