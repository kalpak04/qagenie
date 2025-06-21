const PRD = require('../models/prd.model');
const TestCase = require('../models/testCase.model');
const aiService = require('../services/ai.service');
const { logger } = require('../utils/logger');

/**
 * @desc    Create a new PRD
 * @route   POST /api/prd
 * @access  Private
 */
const createPRD = async (req, res, next) => {
  try {
    const { title, description, content, format } = req.body;
    
    const prd = await PRD.create({
      title,
      description,
      content,
      format: format || 'markdown',
      user: req.user.id,
    });
    
    res.status(201).json({
      success: true,
      data: prd,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload a PRD file
 * @route   POST /api/prd/upload
 * @access  Private
 */
const uploadPRD = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file',
      });
    }
    
    // Get file from multer
    const file = req.file;
    
    // Process file with AI service
    const result = await aiService.uploadPRD(file.buffer, file.originalname);
    
    // Create PRD in database
    const prd = await PRD.create({
      title: req.body.title || file.originalname.split('.')[0],
      description: req.body.description || 'Uploaded PRD',
      content: result.content,
      format: result.format,
      originalFilename: file.originalname,
      user: req.user.id,
      project: req.body.projectId || null,
    });
    
    res.status(201).json({
      success: true,
      data: prd,
    });
  } catch (error) {
    logger.error('Error uploading PRD:', error);
    next(error);
  }
};

/**
 * @desc    Get all PRDs
 * @route   GET /api/prd
 * @access  Private
 */
const getPRDs = async (req, res, next) => {
  try {
    const prds = await PRD.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .populate('project', 'name');
    
    res.status(200).json({
      success: true,
      count: prds.length,
      data: prds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get PRD by ID
 * @route   GET /api/prd/:id
 * @access  Private
 */
const getPRD = async (req, res, next) => {
  try {
    const prd = await PRD.findById(req.params.id)
      .populate('user', 'name email')
      .populate('project', 'name')
      .populate('testCases');
    
    if (!prd) {
      return res.status(404).json({
        success: false,
        message: 'PRD not found',
      });
    }
    
    // Check if user owns the PRD
    if (prd.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this PRD',
      });
    }
    
    res.status(200).json({
      success: true,
      data: prd,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate test cases from PRD
 * @route   POST /api/prd/:id/generate-test-cases
 * @access  Private
 */
const generateTestCases = async (req, res, next) => {
  try {
    const prd = await PRD.findById(req.params.id);
    
    if (!prd) {
      return res.status(404).json({
        success: false,
        message: 'PRD not found',
      });
    }
    
    // Check if user owns the PRD
    if (prd.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this PRD',
      });
    }
    
    try {
      // Generate test cases from AI service
      const result = await aiService.generateTestCases(prd.content, prd.format);
      
      // Create test cases in database
      const testCaseIds = [];
      
      for (const tc of result.test_cases) {
        const testCase = await TestCase.create({
          title: tc.title,
          description: tc.description,
          preconditions: tc.preconditions,
          steps: tc.steps,
          expectedResults: tc.expected_results,
          priority: tc.priority,
          tags: tc.tags,
          prd: prd._id,
          user: req.user.id,
          project: prd.project,
        });
        
        testCaseIds.push(testCase._id);
      }
      
      // Update PRD with test cases and status
      prd.testCases = testCaseIds;
      prd.status = 'test_cases_generated';
      if (prd.metadata) {
        prd.metadata.coverage_percentage = result.coverage_percentage;
        prd.metadata.summary = result.summary;
      } else {
        prd.metadata = { 
          coverage_percentage: result.coverage_percentage,
          summary: result.summary
        };
      }
      
      await prd.save();
      
      res.status(200).json({
        success: true,
        count: testCaseIds.length,
        data: {
          testCaseIds,
          summary: result.summary,
          coveragePercentage: result.coverage_percentage,
        },
      });
    } catch (aiError) {
      logger.error(`Failed to generate test cases for PRD ${prd._id}: ${aiError.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate test cases. AI service might be unavailable.',
        error: aiError.message
      });
    }
  } catch (error) {
    logger.error(`Error in generateTestCases handler: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Update PRD
 * @route   PUT /api/prd/:id
 * @access  Private
 */
const updatePRD = async (req, res, next) => {
  try {
    let prd = await PRD.findById(req.params.id);
    
    if (!prd) {
      return res.status(404).json({
        success: false,
        message: 'PRD not found',
      });
    }
    
    // Check if user owns the PRD
    if (prd.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this PRD',
      });
    }
    
    prd = await PRD.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );
    
    res.status(200).json({
      success: true,
      data: prd,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete PRD
 * @route   DELETE /api/prd/:id
 * @access  Private
 */
const deletePRD = async (req, res, next) => {
  try {
    const prd = await PRD.findById(req.params.id);
    
    if (!prd) {
      return res.status(404).json({
        success: false,
        message: 'PRD not found',
      });
    }
    
    // Check if user owns the PRD
    if (prd.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this PRD',
      });
    }
    
    // Remove all associated test cases
    await TestCase.deleteMany({ prd: prd._id });
    
    // Remove the PRD
    await prd.remove();
    
    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPRD,
  uploadPRD,
  getPRDs,
  getPRD,
  generateTestCases,
  updatePRD,
  deletePRD,
}; 