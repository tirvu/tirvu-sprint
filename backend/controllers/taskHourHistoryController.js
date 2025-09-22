const express = require('express');
const router = express.Router();
const { Task, User, TaskHourHistory, Backlog, Sprint } = require('../models/associations');
const { authMiddleware, adminMiddleware } = require('./middlewares');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const fs = require('fs');
const path = require('path');

// Obter histórico de horas de uma tarefa
router.get('/task/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const hourHistory = await TaskHourHistory.findAll({
      where: { taskId },
      include: [{ model: User, attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(hourHistory);
  } catch (error) {
    console.error('Erro ao buscar histórico de horas:', error);
    res.status(500).json({ message: 'Erro ao buscar histórico de horas' });
  }
});

// Registrar horas em uma tarefa
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { taskId, description, hours } = req.body;
    const userId = req.user.id;
    
    // Validar dados
    if (!taskId || !description || !hours || hours <= 0) {
      return res.status(400).json({ message: 'TaskId, descrição e horas são obrigatórios. Horas deve ser maior que zero.' });
    }
    
    // Verificar se a tarefa existe
    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Tarefa não encontrada' });
    }
    
    // Criar registro de horas
    const hourRecord = await TaskHourHistory.create({
      taskId,
      userId,
      description,
      hours
    });
    
    // Atualizar horas totais da tarefa
    const totalHours = await TaskHourHistory.sum('hours', { where: { taskId } });
    await task.update({ hoursSpent: totalHours });
    
    // Buscar o registro com dados do usuário
    const hourRecordWithUser = await TaskHourHistory.findByPk(hourRecord.id, {
      include: [{ model: User, attributes: ['id', 'name'] }]
    });
    
    res.status(201).json(hourRecordWithUser);
  } catch (error) {
    console.error('Erro ao registrar horas:', error);
    res.status(500).json({ message: 'Erro ao registrar horas' });
  }
});

// Obter dados de horas trabalhadas por colaborador para o dashboard administrativo
router.get('/dashboard/collaborators', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    let whereCondition = {};
    
    // Filtrar por data (hoje, semana, mês)
    if (date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (date === 'today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        whereCondition.createdAt = {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        };
      } else if (date === 'week') {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7); // Próximo domingo
        
        whereCondition.createdAt = {
          [Op.gte]: startOfWeek,
          [Op.lt]: endOfWeek
        };
      } else if (date === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        
        whereCondition.createdAt = {
          [Op.gte]: startOfMonth,
          [Op.lte]: endOfMonth
        };
      }
    }
    
    // Buscar todos os colaboradores ativos
    const users = await User.findAll({
      where: { active: true },
      attributes: ['id', 'name', 'capacity']
    });
    
    // Buscar sprint atual
    const currentSprint = await Sprint.findOne({
      where: { status: 'in_progress' },
      attributes: ['id', 'name', 'startDate', 'endDate']
    });
    
    // Para cada colaborador, buscar suas horas trabalhadas
    const collaboratorsData = await Promise.all(users.map(async (user) => {
      // Horas trabalhadas no período filtrado
      const hoursWorked = await TaskHourHistory.sum('hours', {
        where: { 
          userId: user.id,
          ...whereCondition
        }
      }) || 0;
      
      // Calcular horas restantes para o dia (baseado na capacidade do usuário)
      const dailyCapacity = user.capacity || 8; // Padrão de 8 horas se não definido
      const hoursRemainingToday = Math.max(0, dailyCapacity - hoursWorked);
      
      // Calcular horas restantes para o mês
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const workingDays = 22; // Média de dias úteis no mês
      const monthlyCapacity = dailyCapacity * workingDays;
      
      // Horas trabalhadas no mês atual
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      
      const monthHoursWorked = await TaskHourHistory.sum('hours', {
        where: { 
          userId: user.id,
          createdAt: {
            [Op.gte]: startOfMonth,
            [Op.lte]: endOfMonth
          }
        }
      }) || 0;
      
      const hoursRemainingMonth = Math.max(0, monthlyCapacity - monthHoursWorked);
      
      // Buscar tarefas atuais do colaborador
      const currentTasks = await Task.findAll({
        where: { 
          userId: user.id,
          status: ['pending', 'in_progress']
        },
        include: [{
          model: Backlog,
          attributes: ['id', 'title', 'sprintId'],
          include: [{
            model: Sprint,
            attributes: ['id', 'name']
          }]
        }],
        limit: 5,
        order: [['updatedAt', 'DESC']]
      });
      
      // Contar tarefas por status para este colaborador
      const completedTasks = await Task.count({
        where: { 
          userId: user.id,
          status: 'completed'
        }
      });
      
      const inProgressTasks = await Task.count({
        where: { 
          userId: user.id,
          status: 'in_progress'
        }
      });
      
      const pendingTasks = await Task.count({
        where: { 
          userId: user.id,
          status: 'pending'
        }
      });
      
      // Calcular taxa de conclusão se houver tarefas
      const totalTasks = completedTasks + inProgressTasks + pendingTasks;
      const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      return {
        id: user.id,
        name: user.name,
        capacity: dailyCapacity,
        hoursWorked,
        hoursRemainingToday,
        hoursRemainingMonth,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        taskCompletionRate,
        currentTasks: currentTasks.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status,
          backlog: task.Backlog ? {
            id: task.Backlog.id,
            title: task.Backlog.title,
            sprint: task.Backlog.Sprint ? {
              id: task.Backlog.Sprint.id,
              name: task.Backlog.Sprint.name
            } : null
          } : null
        }))
      };
    }));
    
    res.json({
      currentSprint,
      collaborators: collaboratorsData
    });
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
  }
});

// Excluir registro de horas
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar o registro
    const hourRecord = await TaskHourHistory.findByPk(id);
    if (!hourRecord) {
      return res.status(404).json({ message: 'Registro não encontrado' });
    }
    
    // Verificar permissão (apenas o próprio usuário ou admin pode excluir)
    if (hourRecord.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Sem permissão para excluir este registro' });
    }
    
    const taskId = hourRecord.taskId;
    
    // Importar o modelo de anexos
    const { TaskHourAttachment } = require('../models/associations');
    const ftp = require('basic-ftp');
    
    // Buscar todos os anexos associados a este registro
    const attachments = await TaskHourAttachment.findAll({
      where: { taskHourHistoryId: id }
    });
    
    // Excluir cada anexo do FTP/local e do banco de dados
    if (attachments.length > 0) {
      // Importar módulos necessários
      const path = require('path');
      const FtpManager = require('../utils/ftpManager');
      
      // Não é mais necessário remover do cache, pois não usamos mais armazenamento local
      
      // Excluir cada anexo
      for (const attachment of attachments) {
        
        // Excluir do FTP
        try {
          // Verificar se o arquivo existe no FTP
          let fileExists = false;
          let filePath = attachment.filePath;
          
          const path = require('path');
          try {
            fileExists = await FtpManager.fileExists(filePath);
          } catch (existsError) {
            console.error(`Erro ao verificar existência do arquivo ${filePath}:`, existsError);
            
            // Tentar caminho alternativo no diretório uploads
            const fileName = path.basename(filePath);
            const uploadsPath = `uploads/${fileName}`;
            try {
              fileExists = await FtpManager.fileExists(uploadsPath);
              if (fileExists) {
                filePath = uploadsPath;
              }
            } catch (altErr) {
              console.error(`Erro ao verificar caminho alternativo ${uploadsPath}:`, altErr);
            }
          
          // Se ainda não encontrou, tentar apenas o nome do arquivo
          if (!fileExists) {
            const basePath = path.basename(filePath);
            try {
              fileExists = await FtpManager.fileExists(basePath);
              if (fileExists) {
                filePath = basePath;
              }
            } catch (baseErr) {
              console.error(`Erro ao verificar caminho base ${basePath}:`, baseErr);
            }
          }
          }
          
          // Se o arquivo existir no FTP, excluí-lo
          if (fileExists) {
            try {
              await FtpManager.deleteFile(filePath);
              console.log(`Arquivo excluído do FTP: ${filePath}`);
            } catch (deleteErr) {
              console.error(`Erro ao excluir arquivo do FTP ${filePath}:`, deleteErr);
              // Continuar mesmo com erro na exclusão do FTP
            }
          } else {
            console.log(`Arquivo não encontrado no FTP: ${filePath}`);
          }
        } catch (ftpError) {
          console.error('Erro ao processar exclusão via FTP:', ftpError);
          // Continuar mesmo se falhar a operação FTP
        }
        
        // Excluir do banco de dados
        await attachment.destroy();
      }
    }
    
    // Excluir o registro de horas
    await hourRecord.destroy();
    
    // Atualizar horas totais da tarefa
    const task = await Task.findByPk(taskId);
    if (task) {
      const totalHours = await TaskHourHistory.sum('hours', { where: { taskId } }) || 0;
      await task.update({ hoursSpent: totalHours });
    }
    
    res.json({ message: 'Registro e anexos excluídos com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir registro de horas:', error);
    res.status(500).json({ message: 'Erro ao excluir registro de horas' });
  }
});

module.exports = router;