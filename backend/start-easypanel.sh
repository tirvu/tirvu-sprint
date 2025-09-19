#!/bin/bash

# Script para iniciar a aplicação no EasyPanel

# Verificar e instalar dependências
echo "Verificando e instalando dependências..."
npm install

# Verificar dependências específicas
if ! npm list node-cache > /dev/null 2>&1; then
  echo "Instalando node-cache..."
  npm install node-cache
fi

if ! npm list compression > /dev/null 2>&1; then
  echo "Instalando compression..."
  npm install compression
fi

# Executar migrações se necessário
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Executando migrações..."
  npm run migrate
fi

# Iniciar a aplicação
echo "Iniciando a aplicação..."
node index.js