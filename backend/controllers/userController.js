const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authMiddleware, adminMiddleware } = require('./middlewares');

// Registro de usuário
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, capacity } = req.body;
    
    // Validar entrada
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nome, email e senha são obrigatórios' });
    }
    
    // Verificar se email já existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }

    console.log(name, email, password)
    
    // Criar usuário
    const user = await User.create({
      name,
      email,
      password,
      capacity: capacity || 8.0,
      role: 'collaborator' // Usuários registrados terão role 'collaborator' por padrão
    });
    
    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validar entrada
    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }
    
    // Buscar usuário
    const user = await User.findOne({ where: { email } });
    
    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }
    
    if (!user.active) {
      return res.status(401).json({ message: 'Usuário inativo. Contate o administrador.' });
    }
    
    // Gerar token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Retornar dados do usuário e token
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Obter todos os usuários (apenas admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'capacity', 'active', 'createdAt']
    });
    return res.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Obter usuário por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se é admin ou o próprio usuário
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    
    const user = await User.findByPk(id, {
      attributes: ['id', 'name', 'email', 'role', 'capacity', 'active', 'createdAt']
    });
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    
    return res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Criar usuário (apenas admin)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, password, role, capacity } = req.body;
    
    // Validar entrada
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nome, email e senha são obrigatórios' });
    }
    
    // Verificar se email já existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }
    
    // Criar usuário
    const user = await User.create({
      name,
      email,
      password,
      capacity: capacity || 8.0,
      role: role || 'collaborator'
    });
    
    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Atualizar usuário
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, active, capacity } = req.body;
    
    // Verificar se é admin ou o próprio usuário
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    
    // Buscar usuário
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    
    // Atualizar dados
    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = password;
    if (capacity !== undefined) user.capacity = capacity;
    
    // Apenas admin pode alterar role e status active
    if (req.user.role === 'admin') {
      if (role) user.role = role;
      if (active !== undefined) user.active = active;
    }
    
    await user.save();
    
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      capacity: user.capacity
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Excluir usuário (apenas admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar usuário
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    
    // Excluir usuário
    await user.destroy();
    
    return res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    return res.status(500).json({ message: 'Erro no servidor' });
  }
});

module.exports = router;