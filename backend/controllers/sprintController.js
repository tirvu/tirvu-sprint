const express = require('express');
const router = express.Router();
const { Sprint, Backlog } = require('../models');
const { authMiddleware, adminMiddleware } = require('./middlewares');

// Obter todas as sprints
router.get('/', authMiddleware, async (req, res) => {
  try {
    const sprints = await Sprint.findAll({
      order: [['startDate', 'DESC']]
    });
    return res.json(sprints);
  } catch (error) {
    console.error('Erro ao buscar sprints:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Obter sprint por ID com backlogs e tarefas
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const sprint = await Sprint.findByPk(id, {
      include: [{
        model: Backlog,
        as: 'Backlogs',
        include: [{
          model: require('../models').Task,
          as: 'Tasks',
          include: [{
            model: require('../models').User,
            as: 'User',
            attributes: ['id', 'name']
          }]
        }]
      }]
    });
    
    if (!sprint) {
      return res.status(404).json({ message: 'Sprint não encontrada' });
    }
    
    return res.json(sprint);
  } catch (error) {
    console.error('Erro ao buscar sprint:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Criar sprint
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, startDate, endDate, description } = req.body;
    
    // Validar entrada
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ message: 'Nome, data de início e data de término são obrigatórios' });
    }
    
    // Validar datas
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Datas inválidas' });
    }
    
    if (start >= end) {
      return res.status(400).json({ message: 'A data de início deve ser anterior à data de término' });
    }
    
    // Criar sprint
    const sprint = await Sprint.create({
      name,
      startDate,
      endDate,
      description,
      status: 'planned'
    });
    
    return res.status(201).json(sprint);
  } catch (error) {
    console.error('Erro ao criar sprint:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Atualizar sprint
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, status, description } = req.body;
    
    // Buscar sprint
    const sprint = await Sprint.findByPk(id);
    
    if (!sprint) {
      return res.status(404).json({ message: 'Sprint não encontrada' });
    }
    
    // Atualizar dados
    if (name) sprint.name = name;
    if (description !== undefined) sprint.description = description;
    
    // Validar e atualizar datas
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Datas inválidas' });
      }
      
      if (start >= end) {
        return res.status(400).json({ message: 'A data de início deve ser anterior à data de término' });
      }
      
      sprint.startDate = startDate;
      sprint.endDate = endDate;
    } else if (startDate) {
      const start = new Date(startDate);
      const end = new Date(sprint.endDate);
      
      if (isNaN(start.getTime())) {
        return res.status(400).json({ message: 'Data de início inválida' });
      }
      
      if (start >= end) {
        return res.status(400).json({ message: 'A data de início deve ser anterior à data de término' });
      }
      
      sprint.startDate = startDate;
    } else if (endDate) {
      const start = new Date(sprint.startDate);
      const end = new Date(endDate);
      
      if (isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Data de término inválida' });
      }
      
      if (start >= end) {
        return res.status(400).json({ message: 'A data de início deve ser anterior à data de término' });
      }
      
      sprint.endDate = endDate;
    }
    
    // Atualizar status
    if (status && ['planned', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      sprint.status = status;
    }
    
    await sprint.save();
    
    return res.json(sprint);
  } catch (error) {
    console.error('Erro ao atualizar sprint:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Excluir sprint
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar sprint
    const sprint = await Sprint.findByPk(id);
    
    if (!sprint) {
      return res.status(404).json({ message: 'Sprint não encontrada' });
    }
    
    // Verificar se há backlogs associados
    const backlogsCount = await Backlog.count({ where: { sprintId: id } });
    
    if (backlogsCount > 0) {
      return res.status(400).json({ 
        message: 'Não é possível excluir esta sprint pois existem backlogs associados a ela',
        backlogsCount
      });
    }
    
    // Excluir sprint
    await sprint.destroy();
    
    return res.json({ message: 'Sprint excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir sprint:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

module.exports = router;