require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, closeDB } = require('../src/utils/db');
const User = require('../src/models/user.model');
const PRD = require('../src/models/prd.model');
const TestCase = require('../src/models/testCase.model');

// Sample data
const users = [
  {
    name: 'Admin User',
    email: 'admin@qagenie.com',
    password: 'password123',
    role: 'admin',
  },
  {
    name: 'QA Engineer',
    email: 'qa@qagenie.com',
    password: 'password123',
    role: 'user',
  }
];

// Sample PRD data
const prds = [
  {
    title: 'Sample PRD',
    description: 'This is a sample PRD for testing',
    content: `
# Sample Product Requirements Document

## Overview
This is a sample PRD for testing QA-Genie.

## Features
- User authentication
- Dashboard
- Reporting

## Requirements
The system shall provide user authentication.
The system shall display a dashboard.
The system shall generate reports.
`,
    format: 'markdown',
    status: 'draft',
  },
];

// Function to seed the database
const seedDatabase = async () => {
  try {
    // Connect to the database
    await connectDB();
    
    console.log('Cleaning up existing data...');
    await User.deleteMany({});
    await PRD.deleteMany({});
    await TestCase.deleteMany({});
    
    console.log('Creating users...');
    // Create users with hashed passwords
    const createdUsers = [];
    
    for (const user of users) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);
      
      const createdUser = await User.create({
        name: user.name,
        email: user.email,
        password: hashedPassword,
        role: user.role,
      });
      
      createdUsers.push(createdUser);
      console.log(`User created: ${user.name} (${user.email})`);
    }
    
    console.log('Creating PRDs...');
    // Create PRDs and assign to the first user
    for (const prd of prds) {
      const createdPRD = await PRD.create({
        ...prd,
        user: createdUsers[0]._id,
      });
      
      console.log(`PRD created: ${prd.title}`);
    }
    
    console.log('Database seeded successfully!');
    console.log('You can log in with:');
    console.log('Email: admin@qagenie.com');
    console.log('Password: password123');
    
    // Close the database connection
    await closeDB();
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase(); 