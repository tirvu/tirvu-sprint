const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { TaskAttachment, Task, User } = require('../models/associations');
const { authMiddleware } = require('./middlewares');
const FtpManager = require('../utils/ftpManager');
const compression = require('compression');
const sharp = require('../sharp.config');

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

// Função para upload para o FTP
async function uploadToFTP(fileBuffer, remoteFileName, mimeType, forceCompress = false) {
  try {
    // Garantir que o nome do arquivo seja seguro para FTP
    remoteFileName = remoteFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Verificar se é uma imagem para compressão
    const fileExt = path.extname(remoteFileName).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png'].includes(fileExt);
    
    // Comprimir imagem se aplicável
    let bufferToUpload = fileBuffer;
    let wasCompressed = false;
    
    if (isImage && (forceCompress || process.env.ALWAYS_COMPRESS_IMAGES === 'true')) {
      try {
        // Usar Sharp para compressão de imagem
        const compressedBuffer = await sharp(fileBuffer)
          .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 }) // Para JPEGs
          .png({ quality: 80 })  // Para PNGs
          .toBuffer();
        
        if (compressedBuffer && compressedBuffer.length < fileBuffer.length) {
          bufferToUpload = compressedBuffer;
          wasCompressed = true;
          console.log(`Imagem comprimida: ${fileBuffer.length} -> ${compressedBuffer.length} bytes`);
        }
      } catch (compressError) {
        console.error('Erro ao comprimir imagem:', compressError);
        // Continuar com o buffer original em caso de erro
      }
    }
    
    // Diretório remoto para upload
    const remoteDir = 'upload-tirvu-sprint';
    
    // Verificar se o diretório remoto existe, se não, tentar criá-lo
    try {
      await FtpManager.ensureDir(remoteDir);
      console.log(`Diretório ${remoteDir} verificado/criado com sucesso`);
    } catch (dirError) {
      console.error(`Erro ao verificar/criar diretório remoto: ${dirError.message}`);
      // Continuar mesmo com erro, o FtpManager tentará criar o diretório novamente durante o upload
    }
    
    // Construir o caminho remoto
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

// Rota para upload de anexos
router.post('/:taskId', authMiddleware, upload.array('attachments', 5), async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const shouldCompress = req.body.compress === 'true';
    
    // Verificar se a tarefa existe
    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Tarefa não encontrada' });
    }
    
    // Verificar permissão (apenas o próprio usuário responsável pela tarefa ou admin pode adicionar anexos)
    if (task.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão para adicionar anexos a esta tarefa' });
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
        
        // Upload para o FTP
        const uploadResult = await uploadToFTP(file.buffer, remoteFileName, file.mimetype, forceCompress);
        
        // Verificar se foi comprimido
        const isCompressed = uploadResult.compressed || false;
        
        // Salvar informações no banco de dados
        const attachment = await TaskAttachment.create({
          filename: remoteFileName,
          originalFilename: file.originalname,
          filePath: uploadResult.path,
          fileType: file.mimetype,
          fileSize: file.size,
          storageType: uploadResult.storage,
          isCompressed: isCompressed,
          taskId,
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

// Rota para obter anexos de uma tarefa
router.get('/task/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const attachments = await TaskAttachment.findAll({
      where: { taskId },
      include: [{ model: User, attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(attachments);
  } catch (error) {
    console.error('Erro ao buscar anexos:', error);
    res.status(500).json({ message: 'Erro ao buscar anexos' });
  }
});

// Rota para acessar um arquivo (imagem, documento, PDF)
router.get('/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[ARQUIVO] Solicitação de arquivo com ID: ${id}`);
    
    // Buscar o anexo
    const attachment = await TaskAttachment.findByPk(id);
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
    const attachment = await TaskAttachment.findByPk(id);
    if (!attachment) {
      return res.status(404).json({ message: 'Anexo não encontrado' });
    }
    
    // Verificar permissão (apenas o próprio usuário ou admin pode excluir)
    if (attachment.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão para excluir este anexo' });
    }
    
    // Excluir o arquivo do FTP
    const filePath = attachment.filePath;
    
    // Verificar se o arquivo existe no FTP
    try {
      const fileExists = await FtpManager.fileExists(filePath);
      
      if (fileExists) {
        // Tentar excluir o arquivo com múltiplas tentativas
        let deleteSuccess = false;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await FtpManager.deleteFile(filePath);
            console.log(`Arquivo excluído do FTP: ${filePath}`);
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
      } else {
        console.log(`Arquivo não encontrado no FTP: ${filePath}`);
      }
    } catch (deleteErr) {
      console.error(`Erro ao excluir arquivo do FTP ${filePath}:`, deleteErr);
      // Continuar mesmo com erro na exclusão do FTP
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