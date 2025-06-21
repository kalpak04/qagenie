const express = require('express');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Note: Implement these controller functions in ../controllers/jira.controller.js
const {
  configureJira,
  createJiraTicket,
  getJiraTickets,
  getJiraTicket,
  updateJiraTicket
} = require('../controllers/jira.controller');

// Protect all routes
router.use(protect);

// Routes
router.route('/configure')
  .post(configureJira);

router.route('/tickets')
  .post(createJiraTicket)
  .get(getJiraTickets);

router.route('/tickets/:id')
  .get(getJiraTicket)
  .put(updateJiraTicket);

module.exports = router; 