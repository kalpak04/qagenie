const TestCase = require('../models/testCase.model');
const { asyncHandler } = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Create a new test case
 * @route   POST /api/testcases
 * @access  Private
 */
exports.createTestCase = asyncHandler(async (req, res, next) => {
  // Add user to request body
  req.body.user = req.user.id;
  
  const testCase = await TestCase.create(req.body);
  
  res.status(201).json({
    success: true,
    data: testCase,
  });
});

/**
 * @desc    Get all test cases
 * @route   GET /api/testcases
 * @access  Private
 */
exports.getTestCases = asyncHandler(async (req, res, next) => {
  const testCases = await TestCase.find().populate('prd', 'title');
  
  res.status(200).json({
    success: true,
    count: testCases.length,
    data: testCases,
  });
});

/**
 * @desc    Get single test case
 * @route   GET /api/testcases/:id
 * @access  Private
 */
exports.getTestCase = asyncHandler(async (req, res, next) => {
  const testCase = await TestCase.findById(req.params.id).populate('prd', 'title');
  
  if (!testCase) {
    return next(
      new ErrorResponse(`Test case not found with id of ${req.params.id}`, 404)
    );
  }
  
  res.status(200).json({
    success: true,
    data: testCase,
  });
});

/**
 * @desc    Update test case
 * @route   PUT /api/testcases/:id
 * @access  Private
 */
exports.updateTestCase = asyncHandler(async (req, res, next) => {
  let testCase = await TestCase.findById(req.params.id);
  
  if (!testCase) {
    return next(
      new ErrorResponse(`Test case not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Make sure user is test case owner or admin
  if (testCase.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this test case`,
        401
      )
    );
  }
  
  testCase = await TestCase.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  
  res.status(200).json({
    success: true,
    data: testCase,
  });
});

/**
 * @desc    Delete test case
 * @route   DELETE /api/testcases/:id
 * @access  Private
 */
exports.deleteTestCase = asyncHandler(async (req, res, next) => {
  const testCase = await TestCase.findById(req.params.id);
  
  if (!testCase) {
    return next(
      new ErrorResponse(`Test case not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Make sure user is test case owner or admin
  if (testCase.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this test case`,
        401
      )
    );
  }
  
  await testCase.deleteOne();
  
  res.status(200).json({
    success: true,
    data: {},
  });
});

/**
 * @desc    Get test cases for a specific PRD
 * @route   GET /api/testcases/prd/:prdId
 * @access  Private
 */
exports.getTestCasesByPRD = asyncHandler(async (req, res, next) => {
  const testCases = await TestCase.find({ prd: req.params.prdId });
  
  res.status(200).json({
    success: true,
    count: testCases.length,
    data: testCases,
  });
}); 