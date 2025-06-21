const express = require('express');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Note: Implement these controller functions in ../controllers/git.controller.js
const {
  configureGit,
  createPullRequest,
  getPullRequests,
  getPullRequest
} = require('../controllers/git.controller');

// Protect all routes
router.use(protect);

// Routes
router.route('/configure')
  .post(configureGit);

router.route('/pr')
  .post(createPullRequest)
  .get(getPullRequests);

router.route('/pr/:id')
  .get(getPullRequest);

module.exports = router; 