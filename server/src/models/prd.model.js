const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/db');

const PRD = sequelize.define('PRD', {
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please add a title' },
      len: {
        args: [1, 100],
        msg: 'Title cannot be more than 100 characters'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please add a description' }
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'PRD content is required' }
    }
  },
  format: {
    type: DataTypes.STRING,
    defaultValue: 'markdown',
    validate: {
      isIn: {
        args: [['markdown', 'pdf', 'text']],
        msg: 'Format must be markdown, pdf, or text'
      }
    }
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  originalFilename: {
    type: DataTypes.STRING,
    allowNull: true
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
  status: {
    type: DataTypes.STRING,
    defaultValue: 'draft',
    validate: {
      isIn: {
        args: [['draft', 'analyzed', 'test_cases_generated', 'tickets_created', 'features_generated', 'complete']],
        msg: 'Status must be draft, analyzed, test_cases_generated, tickets_created, features_generated, or complete'
      }
    }
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true
});

module.exports = PRD; 