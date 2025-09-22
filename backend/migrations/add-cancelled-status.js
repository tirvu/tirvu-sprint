'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Para MySQL, precisamos recriar a coluna com o novo ENUM
    await queryInterface.changeColumn('Sprints', 'status', {
      type: Sequelize.ENUM('planned', 'in_progress', 'completed', 'cancelled'),
      defaultValue: 'planned'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Reverter para o ENUM original
    await queryInterface.changeColumn('Sprints', 'status', {
      type: Sequelize.ENUM('planned', 'in_progress', 'completed'),
      defaultValue: 'planned'
    });
  }
};