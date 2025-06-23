const User = require('./user.model');
const TestCase = require('./testCase.model');
const PRD = require('./prd.model');
const { sequelize } = require('../utils/db');

// Define model associations
User.hasMany(PRD, { foreignKey: 'userId', as: 'prds' });
PRD.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(TestCase, { foreignKey: 'userId', as: 'testCases' });
TestCase.belongsTo(User, { foreignKey: 'userId', as: 'user' });

PRD.hasMany(TestCase, { foreignKey: 'prdId', as: 'testCases' });
TestCase.belongsTo(PRD, { foreignKey: 'prdId', as: 'prd' });

/**
 * Sync database models
 * @param {Boolean} force - If true, drops and recreates tables
 */
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    console.log('Database synced successfully');
  } catch (error) {
    console.error('Error syncing database:', error.message);
    throw error;
  }
};

module.exports = {
  User,
  TestCase,
  PRD,
  sequelize,
  syncDatabase
}; 