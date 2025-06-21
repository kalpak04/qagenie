const express = require('express');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Note: Implement these controller functions in ../controllers/ci.controller.js
const {
  configureCI,
  triggerBuild,
  getBuilds,
  getBuild
} = require('../controllers/ci.controller');

// Protect all routes
router.use(protect);

// Routes
router.route('/configure')
  .post(configureCI);

router.route('/build')
  .post(triggerBuild)
  .get(getBuilds);

router.route('/build/:id')
  .get(getBuild);

module.exports = router; 