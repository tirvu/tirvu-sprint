# Resolução do Problema do Sharp em Ambientes Linux

Este documento explica como resolver o erro do módulo Sharp em ambientes Linux, especificamente o erro:

```
Error: Could not load the "sharp" module using the linux-x64 runtime
```

## Solução Implementada

1. **Arquivo de Configuração do Sharp**
   - Criamos um arquivo `sharp.config.js` que configura o Sharp para funcionar em diferentes plataformas
   - Este arquivo é importado em vez do módulo Sharp diretamente

2. **Script de Instalação Automática**
   - Adicionamos o script `install-sharp.js` que instala o Sharp com as dependências corretas para cada plataforma
   - Este script é executado automaticamente após a instalação do projeto

3. **Atualização do Package.json**
   - Adicionamos scripts para facilitar a instalação do Sharp:
     - `npm run install-sharp`: Instala o Sharp manualmente
     - `postinstall`: Executa automaticamente após `npm install`

## Como Usar

### Instalação Automática

Ao executar `npm install` no projeto, o script `postinstall` será executado automaticamente e instalará o Sharp com as dependências corretas para a plataforma atual.

### Instalação Manual

Se você precisar reinstalar o Sharp manualmente, execute:

```bash
npm run install-sharp
```

### Em Ambientes Linux

Se você estiver em um ambiente Linux e ainda encontrar problemas, execute manualmente:

```bash
npm install --include=optional sharp
npm install --os=linux --cpu=x64 sharp
```

## Verificação

Para verificar se o Sharp está funcionando corretamente, inicie o servidor com:

```bash
npm start
```

Se o servidor iniciar sem erros relacionados ao Sharp, a instalação foi bem-sucedida.