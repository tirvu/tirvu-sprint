const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaskHourHistory = sequelize.define('TaskHourHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  hours: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  taskId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Tasks',
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

module.exports = TaskHourHistory;