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
const sharp = require('sharp');
const FtpManager = require('../utils/ftpManager');

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
const NodeCache = require('node-cache');
const compression = require('compression');

// Configurar cache com TTL de 60 minutos e verificação menos frequente
const fileCache = new NodeCache({ stdTTL: 3600, checkperiod: 600, useClones: false });

// Diretório para armazenamento local de arquivos
const LOCAL_STORAGE_DIR = path.join(__dirname, '../storage');
// Garantir que o diretório existe
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

// Função removida pois a compressão agora é feita diretamente no buffer

// Função para upload para o FTP com fallback para armazenamento local - Otimizada para performance e escalabilidade
async function uploadToFTP(fileBuffer, remoteFileName, mimeType, forceCompress = false) {
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
          // Usar Sharp para compressão de imagem
          sharp(fileBuffer)
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
        bufferToUpload = compressedBuffer;
        wasCompressed = true;
      }
    } catch (compressErr) {
      console.error('Erro ou timeout na compressão:', compressErr);
      // Continuar com o buffer original se a compressão falhar
    }
  }
  
  // Verificar primeiro se o arquivo já existe no armazenamento local como cache
  const localStoragePath = path.join(LOCAL_STORAGE_DIR, remoteFileName);
  if (fs.existsSync(localStoragePath)) {
    // Se já existe localmente, usar diretamente
    return { 
      path: remoteFileName, 
      storage: 'local',
      compressed: wasCompressed 
    };
  }
  
  // Usar o FtpManager para upload com retentativas automáticas
  try {
    // Criar um stream a partir do buffer
    const bufferStream = new stream.PassThrough();
    bufferStream.end(bufferToUpload);
    
    // Usar o FtpManager para upload com retentativas automáticas
    const remotePath = await FtpManager.uploadFile(bufferStream, remoteFileName, 'upload-tirvu-sprint');
    
    return { 
      path: remotePath, 
      storage: 'ftp',
      compressed: wasCompressed 
    };
  } catch (err) {
    console.error('Erro no upload FTP:', err);
    
    // Fallback: salvar localmente
    try {
      // Salvar o buffer diretamente no sistema de arquivos
      await fs.promises.writeFile(localStoragePath, bufferToUpload);
      
      return { 
        path: remoteFileName, 
        storage: 'local',
        compressed: wasCompressed 
      };
    } catch (localErr) {
      console.error('Erro no armazenamento local:', localErr);
      throw err; // Retornar o erro original do FTP
    }
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
    
    // Remover do cache se existir
    const cacheKey = `file_${id}`;
    fileCache.del(cacheKey);
    
    // Excluir arquivo baseado no tipo de armazenamento
    if (attachment.storageType === 'local') {
      // Excluir do armazenamento local
      try {
        const localFilePath = path.join(LOCAL_STORAGE_DIR, attachment.filename);
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
        
        // Verificar se existe versão em cache
        const localCachePath = path.join(LOCAL_STORAGE_DIR, `cache_${attachment.filename}`);
        if (fs.existsSync(localCachePath)) {
          fs.unlinkSync(localCachePath);
        }
      } catch (localError) {
        console.error('Erro ao excluir arquivo local:', localError);
        // Continuar mesmo se falhar a exclusão local
      }
    } else {
      // Excluir do FTP usando o FtpManager
      try {
        // Usar o FtpManager para excluir o arquivo com retentativas automáticas
        await FtpManager.deleteFile(attachment.filePath);
        
        // Verificar se existe versão em cache
        const localCachePath = path.join(LOCAL_STORAGE_DIR, `cache_${attachment.filename}`);
        if (fs.existsSync(localCachePath)) {
          fs.unlinkSync(localCachePath);
        }
      } catch (ftpError) {
        console.error('Erro ao excluir arquivo do FTP:', ftpError);
        // Continuar mesmo se falhar a exclusão do FTP
      }
    }
    
    // Excluir do banco de dados
    await attachment.destroy();
    
    res.json({ message: 'Anexo excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir anexo:', error);
    res.status(500).json({ message: 'Erro ao excluir anexo' });
  }
});

// Rota para acessar um arquivo (imagem, documento, PDF) - Otimizada para performance
router.get('/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cache } = req.query; // Parâmetro opcional para forçar revalidação de cache
    
    // Verificar se o arquivo está em cache e se não foi solicitada revalidação
    const cacheKey = `file_${id}`;
    const cachedFile = !cache ? fileCache.get(cacheKey) : null;
    
    if (cachedFile) {
      // Definir o tipo de conteúdo correto
      res.setHeader('Content-Type', cachedFile.fileType);
      res.setHeader('Content-Disposition', `inline; filename="${cachedFile.originalFilename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 60 minutos
      res.setHeader('X-Cache', 'HIT');
      
      // Enviar o arquivo do cache
      if (cachedFile.buffer) {
        return res.send(cachedFile.buffer);
      } else if (cachedFile.filePath && fs.existsSync(cachedFile.filePath)) {
        return fs.createReadStream(cachedFile.filePath).pipe(res);
      }
      // Se chegou aqui, o cache está inválido
      fileCache.del(cacheKey);
    }
    
    // Buscar o anexo
    const attachment = await TaskHourAttachment.findByPk(id);
    if (!attachment) {
      return res.status(404).json({ message: 'Anexo não encontrado' });
    }
    
    // Definir headers comuns
    res.setHeader('Content-Type', attachment.fileType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.originalFilename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 60 minutos
    res.setHeader('X-Cache', 'MISS');
    
    // Verificar se é armazenamento local
    if (attachment.storageType === 'local') {
      const localFilePath = path.join(LOCAL_STORAGE_DIR, attachment.filename);
      
      if (fs.existsSync(localFilePath)) {
        // Armazenar em cache para futuras requisições
        try {
          const fileStats = fs.statSync(localFilePath);
          if (fileStats.size < 10 * 1024 * 1024) { // Aumentado para 10MB
            // Leitura assíncrona para não bloquear
            fs.promises.readFile(localFilePath)
              .then(fileBuffer => {
                fileCache.set(cacheKey, {
                  buffer: fileBuffer,
                  fileType: attachment.fileType,
                  originalFilename: attachment.originalFilename
                });
              })
              .catch(err => console.error('Erro ao ler arquivo para cache:', err));
          } else {
            fileCache.set(cacheKey, {
              filePath: localFilePath,
              fileType: attachment.fileType,
              originalFilename: attachment.originalFilename
            });
          }
        } catch (cacheErr) {
          console.error('Erro ao configurar cache:', cacheErr);
          // Continuar mesmo com erro de cache
        }
        
        // Enviar o arquivo
        return fs.createReadStream(localFilePath).pipe(res);
      }
    }
    
    // Se não for local ou o arquivo não existir, tentar FTP
    const localCachePath = path.join(LOCAL_STORAGE_DIR, `cache_${attachment.filename}`);
    
    // Verificar se já existe uma versão em cache local do arquivo FTP
    if (fs.existsSync(localCachePath)) {
      // Usar a versão em cache local
      try {
        const fileStats = fs.statSync(localCachePath);
        if (fileStats.size < 10 * 1024 * 1024) { // Aumentado para 10MB
          // Leitura assíncrona para não bloquear
          fs.promises.readFile(localCachePath)
            .then(fileBuffer => {
              fileCache.set(cacheKey, {
                buffer: fileBuffer,
                fileType: attachment.fileType,
                originalFilename: attachment.originalFilename
              });
            })
            .catch(err => console.error('Erro ao ler arquivo para cache:', err));
        } else {
          fileCache.set(cacheKey, {
            filePath: localCachePath,
            fileType: attachment.fileType,
            originalFilename: attachment.originalFilename
          });
        }
        
        // Enviar o arquivo
        return fs.createReadStream(localCachePath).pipe(res);
      } catch (cacheErr) {
        console.error('Erro ao usar cache local do FTP:', cacheErr);
        // Continuar para buscar do FTP se houver erro
      }
    }
    
    // Buscar do FTP diretamente usando stream com o FtpManager
    try {
      // Criar um stream de passagem para receber os dados do FTP
      const passThrough = new stream.PassThrough();
      
      // Flag para controlar se o usuário fechou a conexão
      let connectionClosed = false;
      
      // Iniciar o download como stream usando o FtpManager
      const downloadPromise = FtpManager.downloadFile(passThrough, attachment.filePath);
      
      // Criar um buffer para armazenar os dados para cache
      const chunks = [];
      
      // Enviar o stream diretamente para o cliente
      passThrough.pipe(res);
      
      // Coletar os dados para cache se o arquivo não for muito grande
      passThrough.on('data', (chunk) => {
        // Limitar o tamanho total para evitar consumo excessivo de memória
        if (chunks.length * chunk.length < 10 * 1024 * 1024) { // 10MB
          chunks.push(chunk);
        }
      });
      
      // Quando o stream terminar, salvar no cache local
      passThrough.on('end', () => {
        try {
          // Se coletamos chunks suficientes e a conexão não foi fechada prematuramente, salvar no cache
          if (chunks.length > 0 && !connectionClosed) {
            const fileBuffer = Buffer.concat(chunks);
            
            // Salvar no cache de memória
            fileCache.set(cacheKey, {
              buffer: fileBuffer,
              fileType: attachment.fileType,
              originalFilename: attachment.originalFilename
            });
            
            // Salvar no cache de disco de forma assíncrona
            fs.promises.writeFile(localCachePath, fileBuffer)
              .catch(err => console.error('Erro ao salvar arquivo em cache local:', err));
          }
        } catch (err) {
          console.error('Erro ao processar fim do stream:', err);
        }
      });
      
      // Garantir que o cliente FTP seja fechado em caso de erro
      passThrough.on('error', (err) => {
        try {
          // Verificar se é um erro ignorável
          const ignorableErrors = [
            'aborted',
            'canceled',
            'closed',
            'destroyed',
            'premature close'
          ];
          
          const isIgnorableError = ignorableErrors.some(msg => 
            err.message && err.message.toLowerCase().includes(msg.toLowerCase())
          );
          
          if (!isIgnorableError) {
            console.error('Erro no stream do FTP:', err.message);
          }
          
          // Marcar que houve um erro na conexão
          connectionClosed = true;
        } finally {
          // Garantir que o stream seja destruído
          if (!passThrough.destroyed) {
            passThrough.destroy();
          }
        }
      });
      
      res.on('close', () => {
        // Marcar que a conexão foi fechada pelo usuário
        connectionClosed = true;
        
        // Destruir o stream de passagem para interromper a transferência
        if (!passThrough.destroyed) {
          passThrough.destroy();
        }
        
        // O FtpManager vai lidar com o fechamento do cliente FTP
      });
      
      // Aguardar o download ser concluído
      await downloadPromise;
    } catch (ftpError) {
      // Lista de mensagens de erro a serem ignoradas ou tratadas silenciosamente
      const ignorableErrors = [
        'User closed client during task',
        'Client already closed',
        'Connection closed',
        'Socket closed'
      ];
      
      // Verificar se o erro é de conexão fechada pelo usuário ou outro erro ignorável
      const isIgnorableError = ignorableErrors.some(msg => 
        ftpError.message && ftpError.message.includes(msg)
      );
      
      // Apenas logar o erro se não for um erro ignorável
      if (!isIgnorableError) {
        console.error('Erro ao acessar arquivo via FTP:', ftpError.message);
      }
      
      // Sempre tentar fechar o cliente FTP de forma segura
      if (typeof safeCloseClient === 'function') {
        safeCloseClient();
      } else if (client && typeof client.close === 'function') {
        try {
          client.close();
        } catch (closeError) {
          // Verificar se o erro de fechamento deve ser ignorado
          const shouldIgnoreCloseError = ignorableErrors.some(msg => 
            closeError.message && closeError.message.includes(msg)
          );
          
          if (!shouldIgnoreCloseError) {
            console.error('Erro ao fechar cliente FTP:', closeError.message);
          }
        }
      }
      
      // Se for um erro ignorável e a conexão foi fechada pelo usuário, não retornar erro
      if (isIgnorableError && connectionClosed) {
        return res.status(499).end(); // 499 é o código para "Client Closed Request"
      }
      
      // Para outros erros, retornar mensagem de erro normal
      return res.status(500).json({ message: 'Erro ao acessar o arquivo' });
    }
  } catch (error) {
    console.error('Erro ao buscar anexo:', error);
    res.status(500).json({ message: 'Erro ao buscar anexo' });
  }
});

module.exports = router;