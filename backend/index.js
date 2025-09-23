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
  res.json({ message: 'Bem-vindo à API do T-Flow' });
});

// Importar e usar rotas
const userController = require('./controllers/userController');
app.use('/api/users', userController.router);
app.use('/api/sprints', require('./controllers/sprintController'));
app.use('/api/backlogs', require('./controllers/backlogController'));
app.use('/api/tasks', require('./controllers/taskController'));
app.use('/api/hour-history', require('./controllers/taskHourHistoryController'));
app.use('/api/attachments', require('./controllers/taskHourAttachmentController'));
app.use('/api/task-attachments', require('./controllers/taskAttachmentController'));

// Iniciar o servidor sem sincronização automática
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});