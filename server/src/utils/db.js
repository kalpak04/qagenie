const mongoose = require('mongoose');
const { logger } = require('./logger');
const dbConfig = require('../config/database');

/**
 * Connect to MongoDB
 * @returns {Promise} Mongoose connection promise
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(dbConfig.uri, dbConfig.options);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Close MongoDB connection
 */
const closeDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error(`Error closing MongoDB connection: ${error.message}`);
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

module.exports = {
  connectDB,
  closeDB,
  setupDB,
}; 