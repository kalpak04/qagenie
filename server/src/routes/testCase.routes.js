const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// Note: These controller functions need to be implemented
// in the ../controllers/testCase.controller.js file
const {
  createTestCase,
  getTestCases,
  getTestCase,
  updateTestCase,
  deleteTestCase,
  getTestCasesByPRD,
} = require('../controllers/testCase.controller');

// Protect all routes
router.use(protect);

// Routes
router.route('/')
  .post(createTestCase)
  .get(getTestCases);

router.route('/:id')
  .get(getTestCase)
  .put(updateTestCase)
  .delete(deleteTestCase);

router.route('/prd/:prdId')
  .get(getTestCasesByPRD);

module.exports = router; 