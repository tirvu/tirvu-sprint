#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('Verificando dependências do projeto...');

// Lista de dependências que devem estar presentes
const requiredDependencies = [
  'node-cache',
  'compression',
  'express',
  'basic-ftp',
  'jimp',
  'multer',
  'mysql2',
  'sequelize',
  'uuid',
  'jsonwebtoken',
  'bcryptjs',
  'dotenv',
  'cors',
  'body-parser',
  'axios'
];

// Ler o package.json
const packageJsonPath = path.join(__dirname, 'package.json');
let packageJson;

try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (error) {
  console.error('Erro ao ler package.json:', error.message);
  process.exit(1);
}

// Verificar quais dependências estão faltando
const installedDependencies = Object.keys(packageJson.dependencies || {});
const missingDependencies = requiredDependencies.filter(dep => !installedDependencies.includes(dep));

// Instalar dependências faltantes
if (missingDependencies.length > 0) {
  console.log(`Instalando dependências faltantes: ${missingDependencies.join(', ')}`);
  try {
    execSync(`npm install --save ${missingDependencies.join(' ')}`, { stdio: 'inherit' });
    console.log('Dependências instaladas com sucesso!');
  } catch (error) {
    console.error('Erro ao instalar dependências:', error.message);
    process.exit(1);
  }
} else {
  console.log('Todas as dependências necessárias já estão instaladas.');
}

console.log('Verificação concluída!');