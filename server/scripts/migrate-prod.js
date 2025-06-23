require('dotenv').config({ path: './env.production' });
const { sequelize, syncDatabase, User } = require('../src/models');
const bcrypt = require('bcryptjs');
const { logger } = require('../src/utils/logger');

const migrateProduction = async () => {
  try {
    logger.info('Starting production database setup...');
    await sequelize.authenticate();
    logger.info('Connected to production database');
    
    // Create tables without dropping existing ones
    await syncDatabase(false);
    
    // Create admin user if needed
    const adminExists = await User.findOne({ 
      where: { email: 'admin@qagenie.com' } 
    });
    
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('change-this-password!', salt);
      
      await User.create({
        name: 'Production Admin',
        email: 'admin@qagenie.com',
        password: hashedPassword,
        role: 'admin'
      });
      
      logger.info('Admin user created');
    }
    
    logger.info('Production setup complete!');
    process.exit(0);
  } catch (error) {
    logger.error(`Setup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

migrateProduction();