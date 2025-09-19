const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Sprint = sequelize.define('Sprint', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('planned', 'in_progress', 'completed'),
    defaultValue: 'planned'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Sprint;