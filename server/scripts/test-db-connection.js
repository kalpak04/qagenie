require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/utils/db');

async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await connectDB();
    console.log('Connection successful!');
    console.log('Database name:', mongoose.connection.db.databaseName);
    console.log('Collections:', await mongoose.connection.db.listCollections().toArray());
    await closeDB();
  } catch (error) {
    console.error('Error connecting to the database:', error.message);
  }
}

testConnection(); 