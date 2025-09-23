/**
 * FTP Connection Manager
 * Sistema escalável para gerenciar conexões FTP com pool e retentativas
 */
const ftp = require('basic-ftp');
const promiseRetry = require('promise-retry');
const { PassThrough } = require('stream');

// Configurações do FTP
const FTP_CONFIG = {
  host: "216.158.231.74",
  user: "vcarclub",
  password: "7U@gSNCc",
  secure: false,
  connTimeout: 10000,
  pasvTimeout: 10000,
  keepalive: 30000
};

// Configurações de retry
const RETRY_OPTIONS = {
  retries: 3,           // Número máximo de tentativas
  factor: 2,            // Fator de backoff exponencial
  minTimeout: 1000,     // Tempo mínimo entre tentativas (ms)
  maxTimeout: 10000,    // Tempo máximo entre tentativas (ms)
  randomize: true       // Adiciona um fator aleatório para evitar tempestades de conexão
};

// Pool de conexões FTP
class FtpConnectionPool {
  constructor(maxConnections = 5) {
    this.maxConnections = maxConnections;
    this.pool = [];
    this.waitingQueue = [];
    this.activeConnections = 0;
  }

  /**
   * Obtém uma conexão do pool ou cria uma nova se necessário
   * @returns {Promise<ftp.Client>} Cliente FTP conectado
   */
  async getConnection() {
    // Se há conexões disponíveis no pool, use-as
    if (this.pool.length > 0) {
      const client = this.pool.pop();
      this.activeConnections++;
      return client;
    }

    // Se não atingimos o limite máximo, crie uma nova conexão
    if (this.activeConnections < this.maxConnections) {
      const client = new ftp.Client();
      client.ftp.verbose = false;
      
      try {
        await client.access(FTP_CONFIG);
        this.activeConnections++;
        return client;
      } catch (error) {
        throw new Error(`Erro ao criar conexão FTP: ${error.message}`);
      }
    }

    // Se chegamos aqui, precisamos esperar por uma conexão
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  /**
   * Libera uma conexão de volta para o pool
   * @param {ftp.Client} client Cliente FTP a ser liberado
   */
  releaseConnection(client) {
    // Verifica se há alguém esperando por uma conexão
    if (this.waitingQueue.length > 0) {
      const resolve = this.waitingQueue.shift();
      resolve(client);
      return;
    }

    // Caso contrário, devolve ao pool
    this.pool.push(client);
    this.activeConnections--;
  }

  /**
   * Fecha uma conexão com problema em vez de devolvê-la ao pool
   * @param {ftp.Client} client Cliente FTP com problema
   */
  closeConnection(client) {
    try {
      if (client && !client.closed) {
        client.close();
      }
    } catch (error) {
      // Ignora erros ao fechar conexão com problema
    } finally {
      this.activeConnections--;
    }
  }

  /**
   * Fecha todas as conexões no pool
   */
  async closeAll() {
    // Fecha todas as conexões no pool
    for (const client of this.pool) {
      try {
        if (!client.closed) {
          await client.close();
        }
      } catch (error) {
        // Ignora erros ao fechar conexões
      }
    }

    // Limpa o pool
    this.pool = [];
    this.activeConnections = 0;

    // Rejeita todas as promessas na fila de espera
    for (const resolve of this.waitingQueue) {
      resolve(null);
    }
    this.waitingQueue = [];
  }
}

// Cria uma instância global do pool
const ftpPool = new FtpConnectionPool(5);

/**
 * Gerenciador de FTP com retentativas e pool de conexões
 */
class FtpManager {
  /**
   * Faz upload de um arquivo para o FTP com retentativas automáticas
   * @param {Buffer} buffer Buffer do arquivo a ser enviado
   * @param {string} remotePath Caminho completo do arquivo no servidor FTP (incluindo nome do arquivo)
   * @returns {Promise<string>} Caminho completo do arquivo no FTP
   */
  static async uploadFile(buffer, remotePath) {
    let client = null;
    
    try {
      // Obter uma conexão do pool
      client = await ftpPool.getConnection();
      
      // Extrair o diretório do caminho completo
      const lastSlashIndex = remotePath.lastIndexOf('/');
      const remoteDir = lastSlashIndex > 0 ? remotePath.substring(0, lastSlashIndex) : 'upload-tirvu-sprint';
      const remoteFileName = lastSlashIndex > 0 ? remotePath.substring(lastSlashIndex + 1) : remotePath;
      
      console.log(`Iniciando upload para ${remotePath} (dir: ${remoteDir}, arquivo: ${remoteFileName})`);
      
      // Usar promise-retry para implementar retentativas automáticas
      return await promiseRetry(async (retry, number) => {
        try {
          // Navegar para o diretório de destino
          console.log(`Verificando/criando diretório: ${remoteDir}`);
          await client.ensureDir(remoteDir);
          
          // Criar um stream a partir do buffer
          const bufferStream = new PassThrough();
          bufferStream.end(buffer);
          
          // Upload do arquivo usando stream
          console.log(`Enviando arquivo: ${remoteFileName}`);
          await client.uploadFrom(bufferStream, remoteFileName);
          
          // Construir o caminho completo para verificação
          const fullPath = lastSlashIndex > 0 ? remotePath : `${remoteDir}/${remoteFileName}`;
          console.log(`Verificando existência do arquivo em: ${fullPath}`);
          
          // Verificação simples se o arquivo existe
          const fileExists = await FtpManager.fileExists(fullPath);
          if (!fileExists) {
            console.warn(`Arquivo não encontrado após upload: ${fullPath}. Tentando verificar no diretório raiz.`);
            
            // Tentar verificar no diretório raiz como fallback
            const rootExists = await FtpManager.fileExists(remoteFileName);
            if (rootExists) {
              console.log(`Arquivo encontrado no diretório raiz: ${remoteFileName}`);
              return remoteFileName; // Retornar o caminho no diretório raiz
            }
            
            throw new Error(`Falha na verificação do upload: Arquivo não encontrado no FTP: ${fullPath}`);
          }
          
          console.log(`Upload concluído com sucesso: ${remotePath}`);
          return remotePath;
        } catch (error) {
          // Verificar se é um erro que pode ser retentado
          const retryableErrors = [
            'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'timeout', 'ECONNREFUSED',
            'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'socket hang up',
            'connect ETIMEDOUT', 'connect ECONNREFUSED', 'network error',
            'read ECONNRESET', 'write ECONNRESET', 'FTP response timeout'
          ];
          
          const isRetryable = retryableErrors.some(errType => 
            error.message && error.message.includes(errType)
          );
          
          if (isRetryable) {
            console.warn(`Tentativa ${number} falhou: ${error.message}. Tentando novamente...`);
            retry(error);
            return; // Importante para evitar que o código continue após o retry
          }
          
          // Se for um erro de conexão fechada pelo usuário, não retentar
          if (error.message && error.message.includes('User closed client during task')) {
            throw new Error('Upload cancelado pelo usuário');
          }
          
          // Registrar erro detalhado para diagnóstico
          console.error(`Erro não retentável no upload FTP: ${error.message}`, error);
          
          // Outros erros são lançados normalmente
          throw error;
        }
      }, RETRY_OPTIONS);
    } catch (error) {
      // Se a conexão foi obtida mas ocorreu um erro, fechá-la em vez de devolvê-la ao pool
      if (client) {
        ftpPool.closeConnection(client);
        client = null;
      }
      throw error;
    } finally {
      // Devolver a conexão ao pool se ainda estiver válida
      if (client) {
        ftpPool.releaseConnection(client);
      }
    }
  }

  /**
   * Faz download de um arquivo do FTP com retentativas automáticas
   * @param {string} remotePath Caminho completo do arquivo no FTP
   * @returns {Promise<{stream: PassThrough, cleanup: Function}>} Stream do arquivo e função de limpeza
   */
  static async downloadFile(remotePath) {
    let client = null;
    const passThrough = new PassThrough();
    let connectionClosed = false;
    
    try {
      // Obter uma conexão do pool
      client = await ftpPool.getConnection();
      
      // Normalizar o caminho (remover barra inicial se existir)
      const normalizedPath = remotePath.startsWith('/') ? remotePath.substring(1) : remotePath;
      
      // Função para limpar recursos
      const cleanup = () => {
        connectionClosed = true;
        if (client) {
          ftpPool.releaseConnection(client);
          client = null;
        }
        if (!passThrough.destroyed) {
          passThrough.destroy();
        }
      };
      
      // Usar promise-retry para implementar retentativas automáticas
      await promiseRetry(async (retry, number) => {
        try {
          // Verificar se a conexão foi fechada durante as retentativas
          if (connectionClosed) {
            throw new Error('Download cancelado pelo usuário');
          }
          
          // Extrair o nome do arquivo do caminho
          const fileName = normalizedPath.includes('/') ? 
            normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1) : 
            normalizedPath;
          
          // Lista de caminhos possíveis para tentar
          const pathsToTry = [
            remotePath,
            normalizedPath,
            `upload-tirvu-sprint/${fileName}`,
            fileName
          ];
          
          let downloadSuccess = false;
          let lastError = null;
          
          // Tentar cada caminho possível
          for (const pathToTry of pathsToTry) {
            try {
              console.log(`Tentando baixar arquivo de: ${pathToTry}`);
              await client.downloadTo(passThrough, pathToTry);
              console.log(`Download bem-sucedido de: ${pathToTry}`);
              downloadSuccess = true;
              
              // Finalizar o stream após download bem-sucedido
              if (!passThrough.writableEnded) {
                passThrough.end();
              }
              
              break;
            } catch (downloadError) {
              console.warn(`Falha ao baixar de ${pathToTry}: ${downloadError.message}`);
              lastError = downloadError;
              
              // Se o erro for "write after end", significa que o stream já foi finalizado
              if (downloadError.message.includes('write after end')) {
                console.log('Stream já finalizado, considerando download como bem-sucedido');
                downloadSuccess = true;
                break;
              }
            }
          }
          
          if (!downloadSuccess) {
            throw lastError || new Error(`Não foi possível baixar o arquivo de nenhum caminho tentado`);
          }
          
          return true;
        } catch (error) {
          // Verificar se é um erro que pode ser retentado
          const retryableErrors = [
            'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'timeout', 'ECONNREFUSED',
            'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'socket hang up',
            'connect ETIMEDOUT', 'connect ECONNREFUSED', 'network error',
            'read ECONNRESET', 'write ECONNRESET', 'FTP response timeout'
          ];
          
          const isRetryable = retryableErrors.some(errType => 
            error.message && error.message.includes(errType)
          ) && !connectionClosed;
          
          if (isRetryable) {
            console.warn(`Tentativa ${number} falhou: ${error.message}. Tentando novamente...`);
            retry(error);
            return; // Importante para evitar que o código continue após o retry
          }
          
          // Verificar se é um erro de arquivo não encontrado (550)
          if (error.message && error.message.includes('550')) {
            console.error(`Arquivo não encontrado no FTP: ${remotePath}`);
            throw new Error(`Arquivo não encontrado no FTP: ${remotePath}`);
          }
          
          // Se for um erro de conexão fechada pelo usuário, não retentar
          if (error.message && error.message.includes('User closed client during task')) {
            connectionClosed = true;
            throw new Error('Download cancelado pelo usuário');
          }
          
          // Outros erros são lançados normalmente
          throw error;
        }
      }, RETRY_OPTIONS);
      
      return { stream: passThrough, cleanup };
    } catch (error) {
      // Se a conexão foi obtida mas ocorreu um erro, fechá-la em vez de devolvê-la ao pool
      if (client) {
        ftpPool.closeConnection(client);
        client = null;
      }
      
      // Destruir o stream em caso de erro
      if (!passThrough.destroyed) {
        passThrough.destroy();
      }
      
      throw error;
    }
  }

  /**
   * Exclui um arquivo do FTP com retentativas automáticas
   * @param {string} remotePath Caminho completo do arquivo no FTP
   * @returns {Promise<boolean>} True se o arquivo foi excluído com sucesso
   */
  static async deleteFile(remotePath) {
    let client = null;
    
    try {
      // Obter uma conexão do pool
      client = await ftpPool.getConnection();
      
      // Usar promise-retry para implementar retentativas automáticas
      return await promiseRetry(async (retry, number) => {
        try {
          // Excluir o arquivo
          await client.remove(remotePath);
          return true;
        } catch (error) {
          // Verificar se é um erro que pode ser retentado
          const retryableErrors = [
            'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'timeout', 'ECONNREFUSED',
            'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'socket hang up',
            'connect ETIMEDOUT', 'connect ECONNREFUSED', 'network error',
            'read ECONNRESET', 'write ECONNRESET', 'FTP response timeout'
          ];
          
          const isRetryable = retryableErrors.some(errType => 
            error.message && error.message.includes(errType)
          );
          
          if (isRetryable) {
            console.warn(`Tentativa ${number} falhou: ${error.message}. Tentando novamente...`);
            retry(error);
            return; // Importante para evitar que o código continue após o retry
          }
          
          // Se for um erro de arquivo não encontrado, considerar como sucesso
          if (error.message && error.message.includes('550')) {
            console.warn(`Arquivo não encontrado no FTP: ${remotePath}`);
            return true;
          }
          
          // Outros erros são lançados normalmente
          throw error;
        }
      }, RETRY_OPTIONS);
    } catch (error) {
      // Se a conexão foi obtida mas ocorreu um erro, fechá-la em vez de devolvê-la ao pool
      if (client) {
        ftpPool.closeConnection(client);
        client = null;
      }
      throw error;
    } finally {
      // Devolver a conexão ao pool se ainda estiver válida
      if (client) {
        ftpPool.releaseConnection(client);
      }
    }
  }

  /**
   * Verifica se um arquivo existe no FTP
   * @param {string} remotePath Caminho completo do arquivo no FTP
   * @returns {Promise<boolean>} True se o arquivo existe
   */
  static async fileExists(remotePath) {
    let client = null;
    
    try {
      // Obter uma conexão do pool
      client = await ftpPool.getConnection();
      
      // Normalizar o caminho (remover barra inicial se existir)
      const normalizedPath = remotePath.startsWith('/') ? remotePath.substring(1) : remotePath;
      
      // Extrair o diretório e o nome do arquivo do caminho
      const lastSlashIndex = normalizedPath.lastIndexOf('/');
      const directory = lastSlashIndex > 0 ? normalizedPath.substring(0, lastSlashIndex) : '/';
      const fileName = lastSlashIndex > 0 ? normalizedPath.substring(lastSlashIndex + 1) : normalizedPath;
      
      console.log(`Verificando existência do arquivo: ${normalizedPath} (dir: ${directory}, file: ${fileName})`);
      
      // Método simplificado para verificar a existência do arquivo
      try {
        // Tentar acessar o diretório
        await client.cd(directory);
        
        // Listar arquivos no diretório
        const files = await client.list();
        
        // Verificar se o arquivo está na lista
        const fileExists = files.some(file => file.name === fileName);
        console.log(`Arquivo ${fileName} ${fileExists ? 'encontrado' : 'não encontrado'} no diretório ${directory}`);
        return fileExists;
      } catch (error) {
        // Verificar se é um erro que pode ser retentado
        const retryableErrors = [
          'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'timeout', 'ECONNREFUSED',
          'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'socket hang up',
          'connect ETIMEDOUT', 'connect ECONNREFUSED', 'network error',
          'read ECONNRESET', 'write ECONNRESET', 'FTP response timeout'
        ];
        
        const isRetryable = retryableErrors.some(errType => 
          error.message && error.message.includes(errType)
        );
        
        if (isRetryable) {
          console.warn(`Erro retentável ao verificar arquivo ${normalizedPath}: ${error.message}`);
          // Aqui não podemos usar retry diretamente pois não estamos dentro do promiseRetry
          // Mas podemos registrar o erro e continuar com a verificação alternativa
        }
        
        // Se não conseguir acessar o diretório ou listar arquivos, o arquivo não existe
        console.warn(`Erro ao verificar arquivo ${normalizedPath}: ${error.message}`);
        
        // Se o diretório não for encontrado, tentar verificar em diretórios alternativos
        // Primeiro na raiz
        try {
          await client.cd('/');
          const rootFiles = await client.list();
          const fileExistsInRoot = rootFiles.some(file => file.name === fileName);
          console.log(`Arquivo ${fileName} ${fileExistsInRoot ? 'encontrado' : 'não encontrado'} no diretório raiz`);
          if (fileExistsInRoot) return true;
        } catch (rootError) {
          console.warn(`Erro ao verificar arquivo na raiz: ${rootError.message}`);
        }
        
        // Depois no diretório upload-tirvu-sprint
        try {
          await client.cd('/upload-tirvu-sprint');
          const uploadDirFiles = await client.list();
          const fileExistsInUploadDir = uploadDirFiles.some(file => file.name === fileName);
          console.log(`Arquivo ${fileName} ${fileExistsInUploadDir ? 'encontrado' : 'não encontrado'} no diretório upload-tirvu-sprint`);
          return fileExistsInUploadDir;
        } catch (uploadDirError) {
          console.warn(`Erro ao verificar arquivo em upload-tirvu-sprint: ${uploadDirError.message}`);
          return false;
        }
        
        return false;
      }
    } catch (error) {
      // Se a conexão foi obtida mas ocorreu um erro, fechá-la em vez de devolvê-la ao pool
      if (client) {
        ftpPool.closeConnection(client);
        client = null;
      }
      throw error;
    } finally {
      // Devolver a conexão ao pool se ainda estiver válida
      if (client) {
        ftpPool.releaseConnection(client);
      }
    }
  }

  /**
   * Renomeia um arquivo no FTP com retentativas automáticas
   * @param {string} oldPath Caminho completo do arquivo original no FTP
   * @param {string} newPath Caminho completo do novo nome do arquivo no FTP
   * @returns {Promise<boolean>} True se o arquivo foi renomeado com sucesso
   */
  static async renameFile(oldPath, newPath) {
    let client = null;
    
    try {
      // Obter uma conexão do pool
      client = await ftpPool.getConnection();
      
      // Usar promise-retry para implementar retentativas automáticas
      return await promiseRetry(async (retry, number) => {
        try {
          // Renomear o arquivo
          await client.rename(oldPath, newPath);
          return true;
        } catch (error) {
          // Verificar se é um erro que pode ser retentado
          const retryableErrors = [
            'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'timeout', 'ECONNREFUSED',
            'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'socket hang up',
            'connect ETIMEDOUT', 'connect ECONNREFUSED', 'network error',
            'read ECONNRESET', 'write ECONNRESET', 'FTP response timeout'
          ];
          
          const isRetryable = retryableErrors.some(errType => 
            error.message && error.message.includes(errType)
          );
          
          if (isRetryable) {
            console.warn(`Tentativa ${number} falhou: ${error.message}. Tentando novamente...`);
            retry(error);
            return; // Importante para evitar que o código continue após o retry
          }
          
          // Se for um erro de arquivo não encontrado, registrar e lançar erro específico
          if (error.message && error.message.includes('550')) {
            console.error(`Arquivo não encontrado no FTP para renomear: ${oldPath}`);
            throw new Error(`Arquivo não encontrado no FTP para renomear: ${oldPath}`);
          }
          
          // Outros erros são lançados normalmente
          throw error;
        }
      }, RETRY_OPTIONS);
    } catch (error) {
      // Se a conexão foi obtida mas ocorreu um erro, fechá-la em vez de devolvê-la ao pool
      if (client) {
        ftpPool.closeConnection(client);
        client = null;
      }
      throw error;
    } finally {
      // Devolver a conexão ao pool se ainda estiver válida
      if (client) {
        ftpPool.releaseConnection(client);
      }
    }
  }

  /**
   * Verifica se um diretório existe e o cria se não existir
   * @param {string} dirPath Caminho do diretório a ser verificado/criado
   * @returns {Promise<boolean>} True se o diretório existe ou foi criado com sucesso
   */
  static async ensureDir(dirPath) {
    let client = null;
    
    try {
      // Obter uma conexão do pool
      client = await ftpPool.getConnection();
      
      // Normalizar o caminho (remover barra inicial se existir)
      const normalizedPath = dirPath.startsWith('/') ? dirPath.substring(1) : dirPath;
      
      // Usar promise-retry para implementar retentativas automáticas
      return await promiseRetry(async (retry, number) => {
        try {
          // Verificar se o diretório existe antes de tentar criá-lo
          try {
            await client.cd('/');
            
            // Se o caminho for vazio ou raiz, já estamos no diretório correto
            if (!normalizedPath || normalizedPath === '/' || normalizedPath === '') {
              return true;
            }
            
            // Dividir o caminho em partes para verificar cada nível
            const parts = normalizedPath.split('/').filter(part => part.length > 0);
            let currentPath = '';
            
            // Verificar e criar cada nível do diretório
            for (const part of parts) {
              currentPath += (currentPath ? '/' : '') + part;
              
              try {
                // Tentar acessar o diretório
                await client.cd(currentPath);
                console.log(`Diretório ${currentPath} existe`);
              } catch (cdError) {
                // Se o diretório não existe, tentar criá-lo
                if (cdError.message && cdError.message.includes('550')) {
                  console.log(`Criando diretório ${currentPath}`);
                  await client.cd('/');
                  
                  try {
                    await client.mkdir(currentPath);
                    await client.cd(currentPath);
                    console.log(`Diretório ${currentPath} criado com sucesso`);
                  } catch (mkdirError) {
                    console.error(`Erro ao criar diretório ${currentPath}: ${mkdirError.message}`);
                    throw mkdirError;
                  }
                } else {
                  // Outros erros ao acessar o diretório
                  throw cdError;
                }
              }
            }
            
            return true;
          } catch (error) {
            // Se a verificação manual falhar, tentar o método padrão
            console.warn(`Verificação manual de diretório falhou: ${error.message}. Tentando método padrão.`);
            await client.ensureDir(dirPath);
            return true;
          }
        } catch (error) {
          // Verificar se é um erro que pode ser retentado
          const retryableErrors = [
            'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'timeout', 'ECONNREFUSED',
            'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'socket hang up',
            'connect ETIMEDOUT', 'connect ECONNREFUSED', 'network error',
            'read ECONNRESET', 'write ECONNRESET', 'FTP response timeout'
          ];
          
          const isRetryable = retryableErrors.some(errType => 
            error.message && error.message.includes(errType)
          );
          
          if (isRetryable) {
            console.warn(`Tentativa ${number} falhou: ${error.message}. Tentando novamente...`);
            retry(error);
            return; // Importante para evitar que o código continue após o retry
          }
          
          // Registrar erro detalhado para diagnóstico
          console.error(`Erro não retentável ao verificar/criar diretório ${dirPath}: ${error.message}`);
          
          // Outros erros são lançados normalmente
          throw error;
        }
      }, RETRY_OPTIONS);
    } catch (error) {
      // Se a conexão foi obtida mas ocorreu um erro, fechá-la em vez de devolvê-la ao pool
      if (client) {
        ftpPool.closeConnection(client);
        client = null;
      }
      throw error;
    } finally {
      // Devolver a conexão ao pool se ainda estiver válida
      if (client) {
        ftpPool.releaseConnection(client);
      }
    }
  }

  /**
   * Fecha todas as conexões no pool
   */
  static async closeAllConnections() {
    await ftpPool.closeAll();
  }
}

module.exports = FtpManager;