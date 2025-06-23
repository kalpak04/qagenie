/**
 * PostgreSQL configuration options with Sequelize
 */
const dbConfig = {
  development: {
    dialect: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_DATABASE || 'qa_genie',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    dialect: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_TEST_DATABASE || 'qa_genie_test',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    dialect: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_DATABASE || 'qa_genie_prod',
    logging: false,
    pool: {
      max: 50,
      min: 10,
      acquire: 30000,
      idle: 10000
    },
    // Only use SSL if explicitly enabled
    ...(process.env.PG_USE_SSL === 'true' && {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    })
  }
};

// Get the current environment or default to development
const env = process.env.NODE_ENV || 'development';

// Log which environment is being used
console.log(`Using database config for environment: ${env}`);

module.exports = dbConfig[env]; 