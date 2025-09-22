'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Tasks', 'priority', {
      type: Sequelize.ENUM('baixa', 'media', 'alta', 'critica'),
      defaultValue: 'media',
      allowNull: false
    });

    await queryInterface.addColumn('Tasks', 'type', {
      type: Sequelize.ENUM('feature', 'bug', 'chamado'),
      defaultValue: 'feature',
      allowNull: false
    });

    return Promise.resolve();
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Tasks', 'type');
    await queryInterface.removeColumn('Tasks', 'priority');
    
    // Remover os tipos ENUM
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Tasks_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Tasks_priority";');

    return Promise.resolve();
  }
};