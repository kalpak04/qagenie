const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/db');
const User = require('./user.model');

const TestCase = sequelize.define('TestCase', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please add a title' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please add a description' }
    }
  },
  preconditions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  steps: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  expectedResults: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  priority: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: {
        args: [['must-have', 'should-have', 'nice-to-have']],
        msg: 'Priority must be either must-have, should-have, or nice-to-have'
      }
    }
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  prdId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'prd_id'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id'
  },
  projectId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'project_id'
  },
  ticketId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ticketUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'draft',
    validate: {
      isIn: {
        args: [['draft', 'reviewed', 'approved', 'rejected', 'implemented']],
        msg: 'Status must be draft, reviewed, approved, rejected, or implemented'
      }
    }
  },
  featureFile: {
    type: DataTypes.STRING,
    allowNull: true
  },
  automationStatus: {
    type: DataTypes.STRING,
    defaultValue: 'not_automated',
    validate: {
      isIn: {
        args: [['not_automated', 'in_progress', 'automated', 'failed']],
        msg: 'Automation status must be not_automated, in_progress, automated, or failed'
      }
    }
  }
}, {
  timestamps: true
});

module.exports = TestCase; 