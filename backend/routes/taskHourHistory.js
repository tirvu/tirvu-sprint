const express = require('express');
const router = express.Router();
const { TaskHourHistory, Task, User } = require('../models/associations');
const { authMiddleware } = require('../controllers/middlewares');
const taskHourHistoryController = require('../controllers/taskHourHistoryController');

// Obter histórico de horas de uma tarefa
router.get('/tasks/:taskId/hours', authMiddleware, async (req, res) => {
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
router.post('/tasks/:taskId/hours', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { description, hours } = req.body;
    const userId = req.user.id;
    
    // Validar dados
    if (!description || !hours || hours <= 0) {
      return res.status(400).json({ message: 'Descrição e horas são obrigatórios. Horas deve ser maior que zero.' });
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

// Excluir registro de horas
router.delete('/hour-history/:id', authMiddleware, async (req, res) => {
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
    
    // Excluir o registro
    await hourRecord.destroy();
    
    // Atualizar horas totais da tarefa
    const task = await Task.findByPk(taskId);
    if (task) {
      const totalHours = await TaskHourHistory.sum('hours', { where: { taskId } }) || 0;
      await task.update({ hoursSpent: totalHours });
    }
    
    res.json({ message: 'Registro excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir registro de horas:', error);
    res.status(500).json({ message: 'Erro ao excluir registro de horas' });
  }
});

// Rota para o dashboard administrativo
router.get('/dashboard/collaborators', authMiddleware, (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  next();
}, taskHourHistoryController.getCollaboratorsDashboard);

module.exports = router;