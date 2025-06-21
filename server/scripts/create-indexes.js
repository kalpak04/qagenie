require('dotenv').config();
const { connectDB, closeDB } = require('../src/utils/db');
const User = require('../src/models/user.model');
const PRD = require('../src/models/prd.model');
const TestCase = require('../src/models/testCase.model');

const createIndexes = async () => {
  try {
    // Connect to database
    await connectDB();
    
    console.log('Creating indexes...');
    
    // User indexes
    console.log('Creating User indexes...');
    await User.createIndexes();
    
    // PRD indexes
    console.log('Creating PRD indexes...');
    await PRD.createIndexes();
    
    // TestCase indexes
    console.log('Creating TestCase indexes...');
    await TestCase.createIndexes();
    
    console.log('Creating additional indexes...');
    
    // Additional custom indexes
    await PRD.collection.createIndex({ 'user': 1, 'createdAt': -1 });
    await TestCase.collection.createIndex({ 'prd': 1, 'status': 1 });
    
    console.log('All indexes created successfully!');
    
    // Close database connection
    await closeDB();
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  }
};

createIndexes(); 