const { User } = require('../models');
const { logger } = require('../utils/logger');

/**
 * @desc    Register user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ where: { email } });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with that email already exists',
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    // Generate token
    const token = user.getSignedJwtToken();

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password',
      });
    }

    // Check for user
    const user = await User.scope('withPassword').findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate token
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        jiraInstance: user.jiraInstance,
        gitUsername: user.gitUsername,
        ciInstance: user.ciInstance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/updateprofile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
      jiraToken: req.body.jiraToken,
      jiraInstance: req.body.jiraInstance,
      gitToken: req.body.gitToken,
      gitUsername: req.body.gitUsername,
      ciToken: req.body.ciToken,
      ciInstance: req.body.ciInstance,
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(
      (key) => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    await User.update(fieldsToUpdate, {
      where: { id: req.user.id }
    });
    
    const user = await User.findByPk(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        jiraInstance: user.jiraInstance,
        gitUsername: user.gitUsername,
        ciInstance: user.ciInstance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/updatepassword
 * @access  Private
 */
const updatePassword = async (req, res, next) => {
  try {
    const user = await User.scope('withPassword').findByPk(req.user.id);

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    // Generate token
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      token,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  updatePassword,
}; 