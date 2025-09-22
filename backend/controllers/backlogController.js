const express = require('express');
const router = express.Router();
const { Backlog, Sprint, Task } = require('../models');
const { authMiddleware, adminMiddleware } = require('./middlewares');

// Obter todos os backlogs
router.get('/', authMiddleware, async (req, res) => {
  try {
    const backlogs = await Backlog.findAll({
      include: [{
        model: Sprint,
        attributes: ['id', 'name', 'status']
      }],
      order: [['createdAt', 'DESC']]
    });
    return res.json(backlogs);
  } catch (error) {
    console.error('Erro ao buscar backlogs:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Obter backlogs sem sprint
router.get('/sem-sprint', authMiddleware, async (req, res) => {
  try {
    const backlogs = await Backlog.findAll({
      where: { sprintId: null },
      order: [['priority', 'DESC'], ['createdAt', 'DESC']]
    });
    return res.json(backlogs);
  } catch (error) {
    console.error('Erro ao buscar backlogs sem sprint:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Obter backlog por ID com tarefas
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const backlog = await Backlog.findByPk(id, {
      include: [{
        model: Task,
        as: 'Tasks',
        include: [{
          model: require('../models').User,
          attributes: ['id', 'name']
        }]
      }, {
        model: Sprint,
        attributes: ['id', 'name', 'status']
      }]
    });
    
    if (!backlog) {
      return res.status(404).json({ message: 'Backlog não encontrado' });
    }
    
    return res.json(backlog);
  } catch (error) {
    console.error('Erro ao buscar backlog:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Criar backlog
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, priority, sprintId } = req.body;
    
    // Validar entrada
    if (!title) {
      return res.status(400).json({ message: 'Título é obrigatório' });
    }
    
    // Verificar se a sprint existe, se fornecida
    if (sprintId) {
      const sprint = await Sprint.findByPk(sprintId);
      if (!sprint) {
        return res.status(400).json({ message: 'Sprint não encontrada' });
      }
    }
    
    // Criar backlog
    const backlog = await Backlog.create({
      title,
      description,
      priority: priority || 'medium',
      status: 'pending',
      sprintId: sprintId || null
    });
    
    return res.status(201).json(backlog);
  } catch (error) {
    console.error('Erro ao criar backlog:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Atualizar backlog
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, status, sprintId } = req.body;
    
    // Buscar backlog
    const backlog = await Backlog.findByPk(id);
    
    if (!backlog) {
      return res.status(404).json({ message: 'Backlog não encontrado' });
    }
    
    // Verificar se a sprint existe, se fornecida
    if (sprintId !== undefined) {
      if (sprintId === null) {
        backlog.sprintId = null;
      } else {
        const sprint = await Sprint.findByPk(sprintId);
        if (!sprint) {
          return res.status(400).json({ message: 'Sprint não encontrada' });
        }
        backlog.sprintId = sprintId;
      }
    }
    
    // Atualizar dados
    if (title) backlog.title = title;
    if (description !== undefined) backlog.description = description;
    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      backlog.priority = priority;
    }
    if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
      backlog.status = status;
    }
    
    await backlog.save();
    
    return res.json(backlog);
  } catch (error) {
    console.error('Erro ao atualizar backlog:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Excluir backlog
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar backlog
    const backlog = await Backlog.findByPk(id);
    
    if (!backlog) {
      return res.status(404).json({ message: 'Backlog não encontrado' });
    }
    
    // Verificar se há tarefas associadas
    const tasksCount = await Task.count({ where: { backlogId: id } });
    
    if (tasksCount > 0) {
      return res.status(400).json({ 
        message: 'Não é possível excluir este backlog pois existem tarefas associadas a ele',
        tasksCount
      });
    }
    
    // Excluir backlog
    await backlog.destroy();
    
    return res.json({ message: 'Backlog excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir backlog:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

module.exports = router;