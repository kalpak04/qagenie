const User = require('../models/user.model');
const TestCase = require('../models/testCase.model');
const { asyncHandler } = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Configure Jira credentials
 * @route   POST /api/jira/configure
 * @access  Private
 */
exports.configureJira = asyncHandler(async (req, res, next) => {
  const { jiraToken, jiraInstance } = req.body;

  if (!jiraToken || !jiraInstance) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  // Update user with Jira credentials
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { jiraToken, jiraInstance },
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Create a Jira ticket from test case
 * @route   POST /api/jira/tickets
 * @access  Private
 */
exports.createJiraTicket = asyncHandler(async (req, res, next) => {
  const { testCaseId, projectKey } = req.body;

  if (!testCaseId || !projectKey) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  // Get user's Jira credentials
  const user = await User.findById(req.user.id).select('jiraToken jiraInstance');
  
  if (!user.jiraToken || !user.jiraInstance) {
    return next(new ErrorResponse('Please configure your Jira credentials first', 400));
  }

  // Get test case details
  const testCase = await TestCase.findById(testCaseId);
  
  if (!testCase) {
    return next(new ErrorResponse(`Test case not found with id of ${testCaseId}`, 404));
  }
  
  // TODO: Implement actual Jira API integration here
  
  // For now, simulate creating a Jira ticket
  const ticketId = `${projectKey}-${Math.floor(Math.random() * 1000)}`;
  const ticketUrl = `${user.jiraInstance}/browse/${ticketId}`;
  
  // Update test case with ticket information
  testCase.ticketId = ticketId;
  testCase.ticketUrl = ticketUrl;
  await testCase.save();
  
  res.status(201).json({
    success: true,
    data: {
      ticketId,
      ticketUrl,
      testCase,
    },
  });
});

/**
 * @desc    Get all Jira tickets
 * @route   GET /api/jira/tickets
 * @access  Private
 */
exports.getJiraTickets = asyncHandler(async (req, res, next) => {
  // Get user's Jira credentials
  const user = await User.findById(req.user.id).select('jiraToken jiraInstance');
  
  if (!user.jiraToken || !user.jiraInstance) {
    return next(new ErrorResponse('Please configure your Jira credentials first', 400));
  }
  
  // TODO: Implement actual Jira API integration to fetch tickets
  
  // For now, find test cases with ticket IDs
  const testCases = await TestCase.find({ 
    ticketId: { $exists: true, $ne: null },
    user: req.user.id
  });
  
  res.status(200).json({
    success: true,
    count: testCases.length,
    data: testCases,
  });
});

/**
 * @desc    Get a single Jira ticket
 * @route   GET /api/jira/tickets/:id
 * @access  Private
 */
exports.getJiraTicket = asyncHandler(async (req, res, next) => {
  const ticketId = req.params.id;
  
  // Get user's Jira credentials
  const user = await User.findById(req.user.id).select('jiraToken jiraInstance');
  
  if (!user.jiraToken || !user.jiraInstance) {
    return next(new ErrorResponse('Please configure your Jira credentials first', 400));
  }
  
  // TODO: Implement actual Jira API integration to fetch ticket details
  
  // For now, find test case with this ticket ID
  const testCase = await TestCase.findOne({ ticketId });
  
  if (!testCase) {
    return next(new ErrorResponse(`No ticket found with id of ${ticketId}`, 404));
  }
  
  res.status(200).json({
    success: true,
    data: testCase,
  });
});

/**
 * @desc    Update a Jira ticket
 * @route   PUT /api/jira/tickets/:id
 * @access  Private
 */
exports.updateJiraTicket = asyncHandler(async (req, res, next) => {
  const ticketId = req.params.id;
  const { status } = req.body;
  
  // Get user's Jira credentials
  const user = await User.findById(req.user.id).select('jiraToken jiraInstance');
  
  if (!user.jiraToken || !user.jiraInstance) {
    return next(new ErrorResponse('Please configure your Jira credentials first', 400));
  }
  
  // TODO: Implement actual Jira API integration to update ticket
  
  // For now, find and update test case with this ticket ID
  const testCase = await TestCase.findOne({ ticketId });
  
  if (!testCase) {
    return next(new ErrorResponse(`No ticket found with id of ${ticketId}`, 404));
  }
  
  if (status) {
    testCase.status = status;
    await testCase.save();
  }
  
  res.status(200).json({
    success: true,
    data: testCase,
  });
}); 