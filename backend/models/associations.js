// Arquivo para configurar as associações entre os modelos
const User = require('./User');
const Task = require('./Task');
const Backlog = require('./Backlog');
const Sprint = require('./Sprint');
const TaskHourHistory = require('./TaskHourHistory');
const TaskHourAttachment = require('./TaskHourAttachment');

// Associações de Task
Task.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Task, { foreignKey: 'userId' });

Task.belongsTo(Backlog, { foreignKey: 'backlogId' });
Backlog.hasMany(Task, { foreignKey: 'backlogId' });

// Associações de Backlog
Backlog.belongsTo(Sprint, { foreignKey: 'sprintId' });
Sprint.hasMany(Backlog, { foreignKey: 'sprintId' });

// Associações de TaskHourHistory
TaskHourHistory.belongsTo(Task, { foreignKey: 'taskId' });
Task.hasMany(TaskHourHistory, { foreignKey: 'taskId' });

TaskHourHistory.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(TaskHourHistory, { foreignKey: 'userId' });

// Associações de TaskHourAttachment
TaskHourAttachment.belongsTo(TaskHourHistory, { foreignKey: 'taskHourHistoryId' });
TaskHourHistory.hasMany(TaskHourAttachment, { foreignKey: 'taskHourHistoryId' });

TaskHourAttachment.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(TaskHourAttachment, { foreignKey: 'userId' });

module.exports = {
  User,
  Task,
  Backlog,
  Sprint,
  TaskHourHistory,
  TaskHourAttachment
};