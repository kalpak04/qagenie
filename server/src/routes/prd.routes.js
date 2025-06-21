const express = require('express');
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  createPRD,
  uploadPRD,
  getPRDs,
  getPRD,
  generateTestCases,
  updatePRD,
  deletePRD,
} = require('../controllers/prd.controller');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Protect all routes
router.use(protect);

// Routes
router.route('/')
  .post(createPRD)
  .get(getPRDs);

router.route('/upload')
  .post(upload.single('file'), uploadPRD);

router.route('/:id')
  .get(getPRD)
  .put(updatePRD)
  .delete(deletePRD);

router.route('/:id/generate-test-cases')
  .post(generateTestCases);

module.exports = router; 