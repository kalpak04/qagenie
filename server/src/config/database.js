/**
 * MongoDB configuration options
 */
const dbConfig = {
  development: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/qa-genie',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  test: {
    uri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/qa-genie-test',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  production: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      keepAlive: true,
      keepAliveInitialDelay: 300000, // 5 minutes
      connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
      maxPoolSize: 50, // Maintain up to 50 socket connections
      minPoolSize: 10, // Maintain at least 10 socket connections
    }
  }
};

// Get the current environment or default to development
const env = process.env.NODE_ENV || 'development';

module.exports = dbConfig[env]; 