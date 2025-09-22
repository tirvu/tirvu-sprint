const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
    defaultValue: 'pending'
  },
  priority: {
    type: DataTypes.ENUM('baixa', 'media', 'alta', 'critica'),
    defaultValue: 'media',
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('feature', 'bug', 'chamado'),
    defaultValue: 'feature',
    allowNull: false
  },
  hoursSpent: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  estimatedHours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  backlogId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Backlogs',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  timestamps: true
});

module.exports = Task;