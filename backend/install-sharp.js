/**
 * Script para instalação do Sharp com suporte multi-plataforma
 * Este script garante que o Sharp seja instalado corretamente em diferentes ambientes
 */

const { execSync } = require('child_process');
const os = require('os');

console.log('Iniciando instalação do Sharp com suporte multi-plataforma...');

try {
  // Verificar o sistema operacional
  const platform = os.platform();
  console.log(`Sistema operacional detectado: ${platform}`);

  // Comandos específicos para cada plataforma
  if (platform === 'linux') {
    console.log('Instalando Sharp para Linux...');
    execSync('npm install --include=optional sharp', { stdio: 'inherit' });
    execSync('npm install --os=linux --cpu=x64 sharp', { stdio: 'inherit' });
  } else if (platform === 'win32') {
    console.log('Instalando Sharp para Windows...');
    execSync('npm install sharp', { stdio: 'inherit' });
  } else if (platform === 'darwin') {
    console.log('Instalando Sharp para macOS...');
    execSync('npm install sharp', { stdio: 'inherit' });
  } else {
    console.log(`Instalando Sharp para ${platform}...`);
    execSync('npm install --include=optional sharp', { stdio: 'inherit' });
  }

  console.log('Sharp instalado com sucesso!');
} catch (error) {
  console.error('Erro ao instalar o Sharp:', error.message);
  process.exit(1);
}