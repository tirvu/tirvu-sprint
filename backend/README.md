# T-Flow Backend

## Executando com Docker

Este projeto pode ser facilmente executado usando Docker e Docker Compose.

### Pré-requisitos

- Docker
- Docker Compose

### Passos para execução

1. Clone o repositório

```bash
git clone https://github.com/tirvu/tirvu-sprint.git
cd tirvu-sprint/backend
```

2. Construa e inicie os contêineres

```bash
docker-compose up -d
```

3. Execute as migrações do banco de dados (primeira vez apenas)

```bash
docker-compose exec app npm run migrate
```

4. Acesse a aplicação em http://localhost:3001

### Parando a aplicação

```bash
docker-compose down
```

## Executando sem Docker

### Pré-requisitos

- Node.js (versão 18 ou superior)
- MySQL

### Passos para execução

1. Clone o repositório

```bash
git clone https://github.com/tirvu/tirvu-sprint.git
cd tirvu-sprint/backend
```

2. Instale as dependências

```bash
npm install
```

3. Configure o banco de dados no arquivo .env

4. Execute as migrações

```bash
npm run migrate
```

5. Inicie a aplicação

```bash
npm start
```

6. Acesse a aplicação em http://localhost:3001