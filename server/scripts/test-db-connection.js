require('dotenv').config();
const { sequelize } = require('../src/utils/db');
const { logger } = require('../src/utils/logger');

/**
 * Test the PostgreSQL connection
 */
const testConnection = async () => {
  try {
    // Test the database connection
    await sequelize.authenticate();
    logger.info('PostgreSQL connection has been established successfully.');
    
    // Get database information
    const [results] = await sequelize.query('SELECT version();');
    logger.info(`PostgreSQL Version: ${results[0].version}`);
    
    // Get current database name
    const [dbResults] = await sequelize.query('SELECT current_database();');
    logger.info(`Current Database: ${dbResults[0].current_database}`);
    
    process.exit(0);
  } catch (error) {
    logger.error(`Unable to connect to PostgreSQL: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

// Run the connection test
testConnection(); 