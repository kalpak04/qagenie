const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../utils/db');

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please add a name' }
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: { msg: 'Please add a valid email' },
      notEmpty: { msg: 'Please add an email' }
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: {
        args: [6, 100],
        msg: 'Password must be at least 6 characters'
      },
      notEmpty: { msg: 'Please add a password' }
    }
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'user',
    validate: {
      isIn: {
        args: [['user', 'admin']],
        msg: 'Role must be either user or admin'
      }
    }
  },
  resetPasswordToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  resetPasswordExpire: {
    type: DataTypes.DATE,
    allowNull: true
  },
  jiraToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  jiraInstance: {
    type: DataTypes.STRING,
    allowNull: true
  },
  gitToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  gitUsername: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ciToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ciInstance: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  defaultScope: {
    attributes: { exclude: ['password', 'jiraToken', 'gitToken', 'ciToken'] }
  },
  scopes: {
    withPassword: {
      attributes: { include: ['password'] }
    }
  },
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Instance methods
User.prototype.getSignedJwtToken = function() {
  return jwt.sign({ id: this.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

User.prototype.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = User; 