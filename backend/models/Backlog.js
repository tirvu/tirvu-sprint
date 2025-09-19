const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Backlog = sequelize.define('Backlog', {
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
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium'
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
    defaultValue: 'pending'
  },
  sprintId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Sprints',
      key: 'id'
    }
  }
}, {
  timestamps: true
});

module.exports = Backlog;