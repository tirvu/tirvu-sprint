'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('TaskHourAttachments', 'storageType', {
      type: Sequelize.ENUM('ftp', 'local'),
      defaultValue: 'local',
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('TaskHourAttachments', 'storageType');
  }
};