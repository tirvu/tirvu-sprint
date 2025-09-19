'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('TaskHourAttachments', 'isCompressed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('TaskHourAttachments', 'isCompressed');
  }
};