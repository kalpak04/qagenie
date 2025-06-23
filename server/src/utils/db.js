const { Sequelize } = require('sequelize');
const { logger } = require('./logger');
const dbConfig = require('../config/database');

// Create a Sequelize instance
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    port: dbConfig.port,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions
  }
);

/**
 * Connect to PostgreSQL
 * @returns {Promise} Sequelize connection promise
 */
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('PostgreSQL Connected successfully');
    return sequelize;
  } catch (error) {
    logger.error(`Error connecting to PostgreSQL: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Close PostgreSQL connection
 */
const closeDB = async () => {
  try {
    await sequelize.close();
    logger.info('PostgreSQL connection closed');
  } catch (error) {
    logger.error(`Error closing PostgreSQL connection: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Set up database functions for testing
 */
const setupDB = () => {
  // Before all tests
  beforeAll(async () => {
    await connectDB();
  });

  // After all tests
  afterAll(async () => {
    await closeDB();
  });
};

// Export the sequelize instance as well
module.exports = {
  sequelize,
  connectDB,
  closeDB,
  setupDB,
}; 