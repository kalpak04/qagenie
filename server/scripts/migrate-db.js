require('dotenv').config();
const { sequelize, syncDatabase, User } = require('../src/models');
const bcrypt = require('bcryptjs');
const { logger } = require('../src/utils/logger');

/**
 * Initialize the database with default data
 */
const migrateDatabase = async () => {
  try {
    logger.info('Starting database migration...');

    // Connect to database and sync models (force: true will drop tables if they exist)
    await sequelize.authenticate();
    logger.info('Connected to PostgreSQL successfully');
    
    // Drop and recreate all tables
    await syncDatabase(true);
    logger.info('Database schema created successfully');

    // Create admin user if it doesn't exist
    const adminEmail = 'admin@qagenie.com';
    const adminExists = await User.findOne({ where: { email: adminEmail } });
    
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      await User.create({
        name: 'Admin User',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin'
      });
      
      logger.info('Admin user created successfully');
    } else {
      logger.info('Admin user already exists');
    }

    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Database migration failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

// Run the migration
migrateDatabase(); 