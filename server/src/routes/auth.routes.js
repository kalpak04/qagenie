const express = require('express');
const { protect } = require('../middleware/auth');
const {
  register,
  login,
  getMe,
  updateProfile,
  updatePassword,
} = require('../controllers/auth.controller');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.use(protect);
router.get('/me', getMe);
router.put('/updateprofile', updateProfile);
router.put('/updatepassword', updatePassword);

module.exports = router; 