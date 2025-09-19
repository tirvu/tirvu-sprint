#!/bin/bash

# Instalar dependências
npm install

# Executar migrações do banco de dados
npm run migrate

# Iniciar a aplicação
npm start