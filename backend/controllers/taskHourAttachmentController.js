const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ftp = require('basic-ftp');
const { TaskHourAttachment, TaskHourHistory, User } = require('../models/associations');
const { authMiddleware } = require('./middlewares');
const os = require('os');
const stream = require('stream');
const crypto = require('crypto');
const Jimp = require('jimp');

// Sistema de cache para arquivos com duração otimizada
const CACHE_DURATION = 60 * 60 * 1000; // 60 minutos em milissegundos

// Função para gerar hash de arquivo para cache
function generateFileHash(filePath, userId) {
  return crypto.createHash('md5').update(`${filePath}-${userId}`).digest('hex');
}

// Configuração do multer para upload temporário
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(__dirname, '../temp-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage: storage,
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

// Função para comprimir imagem usando Jimp em vez de Sharp
async function compressImage(inputPath, outputPath, quality = 80) {
  try {
    const image = await Jimp.read(inputPath);
    await image
      .quality(quality) // Definir qualidade da imagem
      .writeAsync(outputPath);
    return true;
  } catch (err) {
    console.error('Erro ao comprimir imagem:', err);
    return false;
  }
}

// Função para upload para o FTP com fallback para armazenamento local - Otimizada para performance
async function uploadToFTP(localFilePath, remoteFileName, forceCompress = false) {
  // Verificar se é uma imagem para compressão
  const fileExt = path.extname(localFilePath).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png'].includes(fileExt);
  
  // Comprimir imagem se aplicável - com timeout para evitar bloqueios
  let fileToUpload = localFilePath;
  let wasCompressed = false;
  
  if (isImage && (forceCompress || process.env.ALWAYS_COMPRESS_IMAGES === 'true')) {
    try {
      const compressedFilePath = `${localFilePath}.compressed${fileExt}`;
      // Adicionar timeout para compressão
      const compressionPromise = compressImage(localFilePath, compressedFilePath);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na compressão')), 15000)
      );
      
      // Usar Promise.race para limitar o tempo de compressão
      const compressed = await Promise.race([compressionPromise, timeoutPromise]);
      
      if (compressed) {
        fileToUpload = compressedFilePath;
        wasCompressed = true;
      }
    } catch (compressErr) {
      console.error('Erro ou timeout na compressão:', compressErr);
      // Continuar com o arquivo original se a compressão falhar
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
  
  // Tentar upload para FTP com timeout
  const client = new ftp.Client();
  client.ftp.verbose = false;
  
  // Definir um timeout global para a operação FTP
  const ftpTimeout = setTimeout(() => {
    try {
      client.close();
    } catch (e) {}
  }, 20000); // 20 segundos de timeout
  
  try {
    await client.access({
      host: "216.158.231.74",
      user: "vcarclub",
      password: "7U@gSNCc",
      secure: false,
      connTimeout: 10000, // Reduzido para 10s
      pasvTimeout: 10000, // Reduzido para 10s
      keepalive: 30000
    });
    
    // Navegar para a pasta de destino
    await client.ensureDir('upload-tirvu-sprint');
    
    // Upload do arquivo
    await client.uploadFrom(fileToUpload, remoteFileName);
    
    // Limpar arquivo comprimido temporário de forma assíncrona
    if (fileToUpload !== localFilePath && fs.existsSync(fileToUpload)) {
      fs.promises.unlink(fileToUpload)
        .catch(err => console.error('Erro ao remover arquivo temporário:', err));
    }
    
    // Limpar o timeout
    clearTimeout(ftpTimeout);
    
    return { 
      path: `upload-tirvu-sprint/${remoteFileName}`, 
      storage: 'ftp',
      compressed: wasCompressed 
    };
  } catch (err) {
    console.error('Erro no upload FTP:', err);
    
    // Fallback: salvar localmente
    try {
      // Implementação de cópia de arquivo usando fs nativo
      await fs.promises.copyFile(fileToUpload, localStoragePath);
      
      // Limpar arquivo comprimido temporário de forma assíncrona
      if (fileToUpload !== localFilePath && fs.existsSync(fileToUpload)) {
        fs.promises.unlink(fileToUpload)
          .catch(err => console.error('Erro ao remover arquivo temporário:', err));
      }
      
      return { 
        path: remoteFileName, 
        storage: 'local',
        compressed: wasCompressed 
      };
    } catch (localErr) {
      console.error('Erro no armazenamento local:', localErr);
      throw err; // Retornar o erro original do FTP
    }
  } finally {
    clearTimeout(ftpTimeout);
    client.close();
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
        const remoteFileName = `${path.parse(file.filename).name}${path.extname(file.originalname)}`;
        
        // Upload para o FTP com fallback para armazenamento local
        const uploadResult = await uploadToFTP(file.path, remoteFileName, forceCompress);
        
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
        
        // Remover arquivo temporário de forma assíncrona
        fs.promises.unlink(file.path)
          .catch(err => console.error(`Erro ao remover arquivo temporário ${file.path}:`, err));
        
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
      // Excluir do FTP
      try {
        const client = new ftp.Client();
        await client.access({
          host: "216.158.231.74",
          user: "vcarclub",
          password: "7U@gSNCc",
          secure: false,
          connTimeout: 15000,
          pasvTimeout: 15000,
          keepalive: 30000
        });
        
        await client.remove(`${attachment.filePath}`);
        client.close();
        
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
    // Criar diretório temporário para o arquivo na raiz do projeto
    let tempDir = path.join(__dirname, '../../temp-uploads');
    if (!fs.existsSync(tempDir)) {
      try {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log(`Diretório temporário criado: ${tempDir}`);
      } catch (err) {
        console.error(`Erro ao criar diretório temporário: ${err.message}`);
        // Usar diretório alternativo se falhar
        tempDir = path.join(__dirname, '../temp-uploads');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
      }
    }
    
    const tempFilePath = path.join(tempDir, attachment.filename);
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
    
    // Buscar do FTP
    const client = new ftp.Client();
    client.ftp.verbose = false; // Desativar logs verbosos
    
    try {
      await client.access({
        host: "216.158.231.74",
        user: "vcarclub",
        password: "7U@gSNCc",
        secure: false,
        connTimeout: 10000, // Reduzido para 10s
        pasvTimeout: 10000, // Reduzido para 10s
        keepalive: 30000
      });
      
      // Baixar o arquivo
      await client.downloadTo(tempFilePath, attachment.filePath);
      
      // Copiar para cache local de forma assíncrona
      fs.promises.copyFile(tempFilePath, localCachePath)
        .then(() => {
          // Configurar cache após cópia bem-sucedida
          try {
            const fileStats = fs.statSync(tempFilePath);
            if (fileStats.size < 10 * 1024 * 1024) { // Aumentado para 10MB
              fs.promises.readFile(tempFilePath)
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
          } catch (err) {
            console.error('Erro ao configurar cache após download FTP:', err);
          }
        })
        .catch(err => console.error('Erro ao copiar arquivo para cache local:', err));
      
      // Enviar o arquivo
      const fileStream = fs.createReadStream(tempFilePath);
      fileStream.pipe(res);
      
      // Limpar o arquivo após envio
      fileStream.on('end', () => {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (err) {
          console.error('Erro ao remover arquivo temporário:', err);
        }
        client.close();
      });
      
      // Garantir que o cliente FTP seja fechado mesmo em caso de erro no stream
      fileStream.on('error', () => {
        client.close();
      });
      
      res.on('close', () => {
        client.close();
      });
    } catch (ftpError) {
      client.close();
      console.error('Erro ao acessar arquivo do FTP:', ftpError);
      return res.status(500).json({ message: 'Erro ao acessar o arquivo' });
    }
  } catch (error) {
    console.error('Erro ao buscar anexo:', error);
    res.status(500).json({ message: 'Erro ao buscar anexo' });
  }
});

module.exports = router;