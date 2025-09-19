require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');

// Importar modelos
require('./models');

// Inicializar o app
const app = express();

// Configurar middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.PERMITED_ORIGIN 
    : process.env.PERMITED_ORIGIN_DEVELOPMENT,
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rotas
app.get('/', (req, res) => {
  res.json({ message: 'Bem-vindo à API do Tirvu Sprint' });
});

// Importar e usar rotas
app.use('/api/users', require('./controllers/userController'));
app.use('/api/sprints', require('./controllers/sprintController'));
app.use('/api/backlogs', require('./controllers/backlogController'));
app.use('/api/tasks', require('./controllers/taskController'));
app.use('/api/hour-history', require('./controllers/taskHourHistoryController'));
app.use('/api/attachments', require('./controllers/taskHourAttachmentController'));

// Iniciar o servidor sem sincronização automática
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Comentado temporariamente para evitar problemas de sincronização
// sequelize.sync({ alter: true })
//   .then(() => {
//     console.log('Banco de dados sincronizado');
//   })
//   .catch(err => {
//     console.error('Erro ao sincronizar o banco de dados:', err);
//   });