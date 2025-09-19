const express = require('express');
const router = express.Router();
const { Task, User, Backlog } = require('../models');
const { authMiddleware, adminMiddleware } = require('./middlewares');

// Obter todas as tarefas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'name']
        },
        {
          model: Backlog,
          attributes: ['id', 'title', 'priority']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    return res.json(tasks);
  } catch (error) {
    console.error('Erro ao buscar tarefas:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Obter tarefas do usuário logado
router.get('/minhas', authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Backlog,
          attributes: ['id', 'title', 'priority']
        }
      ],
      order: [['status', 'ASC'], ['createdAt', 'DESC']]
    });
    return res.json(tasks);
  } catch (error) {
    console.error('Erro ao buscar tarefas do usuário:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Obter tarefa por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await Task.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ['id', 'name']
        },
        {
          model: Backlog,
          attributes: ['id', 'title', 'priority', 'sprintId']
        }
      ]
    });
    
    if (!task) {
      return res.status(404).json({ message: 'Tarefa não encontrada' });
    }
    
    return res.json(task);
  } catch (error) {
    console.error('Erro ao buscar tarefa:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Criar tarefa
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, estimatedHours, backlogId, userId } = req.body;
    
    // Validar entrada
    if (!title || !backlogId) {
      return res.status(400).json({ message: 'Título, backlog e horas estimadas são obrigatórios' });
    }
    
    // Verificar se o backlog existe
    const backlog = await Backlog.findByPk(backlogId);
    if (!backlog) {
      return res.status(400).json({ message: 'Backlog não encontrado' });
    }
    
    // Verificar se o usuário existe, se fornecido
    let assignedUserId = userId;
    if (userId) {
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(400).json({ message: 'Usuário não encontrado' });
      }
    } else {
      // Se não for fornecido, atribuir ao usuário logado
      assignedUserId = req.user.id;
    }
    
    // Criar tarefa
    const task = await Task.create({
      title,
      description,
      estimatedHours,
      status: 'pending',
      hoursSpent: 0,
      backlogId,
      userId: assignedUserId
    });
    
    // Buscar a tarefa com as relações
    const createdTask = await Task.findByPk(task.id, {
      include: [
        {
          model: User,
          attributes: ['id', 'name']
        },
        {
          model: Backlog,
          attributes: ['id', 'title']
        }
      ]
    });
    
    return res.status(201).json(createdTask);
  } catch (error) {
    console.error('Erro ao criar tarefa:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Atualizar tarefa
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, hoursSpent, estimatedHours, backlogId, userId } = req.body;
    
    // Buscar tarefa
    const task = await Task.findByPk(id);
    
    if (!task) {
      return res.status(404).json({ message: 'Tarefa não encontrada' });
    }
    
    // Verificar permissão (admin ou dono da tarefa)
    if (req.user.role !== 'admin' && task.userId !== req.user.id) {
      return res.status(403).json({ message: 'Você não tem permissão para editar esta tarefa' });
    }
    
    // Verificar se o backlog existe, se fornecido
    if (backlogId) {
      const backlog = await Backlog.findByPk(backlogId);
      if (!backlog) {
        return res.status(400).json({ message: 'Backlog não encontrado' });
      }
      task.backlogId = backlogId;
    }
    
    // Verificar se o usuário existe, se fornecido
    if (userId) {
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(400).json({ message: 'Usuário não encontrado' });
      }
      task.userId = userId;
    }
    
    // Atualizar dados
    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
      task.status = status;
    }
    
    // Atualizar horas gastas
    if (hoursSpent !== undefined) {
      // Validar que é um número positivo
      const hours = parseFloat(hoursSpent);
      if (isNaN(hours) || hours < 0) {
        return res.status(400).json({ message: 'Horas gastas deve ser um número positivo' });
      }
      task.hoursSpent = hours;
    }
    // Atualizar horas estimadas
    if (estimatedHours !== undefined) {
      // Validar que é um número positivo
      const hours = parseFloat(estimatedHours);
      if (isNaN(hours) || hours < 0) {
        return res.status(400).json({ message: 'Horas estimadas devem ser um número positivo' });
      }
      task.estimatedHours = hours;
    }
    
    await task.save();
    
    // Buscar a tarefa atualizada com as relações
    const updatedTask = await Task.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ['id', 'name']
        },
        {
          model: Backlog,
          attributes: ['id', 'title']
        }
      ]
    });
    
    return res.json(updatedTask);
  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Excluir tarefa
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar tarefa
    const task = await Task.findByPk(id);
    
    if (!task) {
      return res.status(404).json({ message: 'Tarefa não encontrada' });
    }
    
    // Verificar permissão (admin ou dono da tarefa)
    if (req.user.role !== 'admin' && task.userId !== req.user.id) {
      return res.status(403).json({ message: 'Você não tem permissão para excluir esta tarefa' });
    }
    
    // Excluir tarefa
    await task.destroy();
    
    return res.json({ message: 'Tarefa excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

module.exports = router;