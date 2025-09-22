/**
 * Configuração do Sharp para suporte multi-plataforma
 * Este arquivo configura o Sharp para funcionar em diferentes ambientes
 */

const sharp = require('sharp');

// Configurar o Sharp para usar o número máximo de threads disponíveis
sharp.concurrency(0);

// Configurar o Sharp para usar cache de até 50 MB
sharp.cache(50);

// Exportar o Sharp configurado
module.exports = sharp;