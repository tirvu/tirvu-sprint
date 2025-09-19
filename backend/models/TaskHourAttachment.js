const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaskHourAttachment = sequelize.define('TaskHourAttachment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalFilename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  storageType: {
    type: DataTypes.ENUM('ftp', 'local'),
    defaultValue: 'ftp',
    allowNull: false
  },
  isCompressed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  taskHourHistoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'TaskHourHistories',
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

module.exports = TaskHourAttachment;