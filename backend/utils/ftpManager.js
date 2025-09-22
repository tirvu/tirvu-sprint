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
   * @param {string} remoteFileName Nome do arquivo no servidor FTP
   * @param {string} remoteDir Diretório remoto (opcional)
   * @returns {Promise<string>} Caminho completo do arquivo no FTP
   */
  static async uploadFile(buffer, remoteFileName, remoteDir = 'upload-tirvu-sprint') {
    let client = null;
    
    try {
      // Obter uma conexão do pool
      client = await ftpPool.getConnection();
      
      // Usar promise-retry para implementar retentativas automáticas
      return await promiseRetry(async (retry, number) => {
        try {
          // Navegar para o diretório de destino
          await client.ensureDir(remoteDir);
          
          // Criar um stream a partir do buffer
          const bufferStream = new PassThrough();
          bufferStream.end(buffer);
          
          // Upload do arquivo usando stream
          await client.uploadFrom(bufferStream, remoteFileName);
          
          // Retornar o caminho completo
          return `${remoteDir}/${remoteFileName}`;
        } catch (error) {
          // Verificar se é um erro que pode ser retentado
          if (error.message && (
              error.message.includes('ETIMEDOUT') ||
              error.message.includes('ECONNRESET') ||
              error.message.includes('EPIPE') ||
              error.message.includes('timeout')
          )) {
            console.warn(`Tentativa ${number} falhou: ${error.message}. Tentando novamente...`);
            retry(error);
          }
          
          // Se for um erro de conexão fechada pelo usuário, não retentar
          if (error.message && error.message.includes('User closed client during task')) {
            throw new Error('Upload cancelado pelo usuário');
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
          
          // Download do arquivo para o stream
          await client.downloadTo(passThrough, remotePath);
          
          // Finalizar o stream
          passThrough.end();
          
          return true;
        } catch (error) {
          // Verificar se é um erro que pode ser retentado
          if (error.message && (
              error.message.includes('ETIMEDOUT') ||
              error.message.includes('ECONNRESET') ||
              error.message.includes('EPIPE') ||
              error.message.includes('timeout')
          ) && !connectionClosed) {
            console.warn(`Tentativa ${number} falhou: ${error.message}. Tentando novamente...`);
            retry(error);
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
   * Fecha todas as conexões no pool
   */
  static async closeAllConnections() {
    await ftpPool.closeAll();
  }
}

module.exports = FtpManager;