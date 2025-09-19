const User = require('./User');
const Sprint = require('./Sprint');
const Backlog = require('./Backlog');
const Task = require('./Task');
const TaskHourHistory = require('./TaskHourHistory');

// Definindo as associações

// Sprint e Backlog (1:N)
Sprint.hasMany(Backlog, { foreignKey: 'sprintId' });
Backlog.belongsTo(Sprint, { foreignKey: 'sprintId' });

// Backlog e Task (1:N)
Backlog.hasMany(Task, { foreignKey: 'backlogId' });
Task.belongsTo(Backlog, { foreignKey: 'backlogId' });

// User e Task (1:N)
User.hasMany(Task, { foreignKey: 'userId' });
Task.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  User,
  Sprint,
  Backlog,
  Task,
  TaskHourHistory
};