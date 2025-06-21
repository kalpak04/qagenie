const User = require('../models/user.model');
const { asyncHandler } = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Configure CI credentials
 * @route   POST /api/ci/configure
 * @access  Private
 */
exports.configureCI = asyncHandler(async (req, res, next) => {
  const { ciToken, ciInstance, ciProvider = 'jenkins' } = req.body;

  if (!ciToken || !ciInstance) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  // Update user with CI credentials
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { ciToken, ciInstance, ciProvider },
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Trigger a CI build
 * @route   POST /api/ci/build
 * @access  Private
 */
exports.triggerBuild = asyncHandler(async (req, res, next) => {
  const { repository, branch, testCaseId } = req.body;

  if (!repository || !branch) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  // Get user's CI credentials
  const user = await User.findById(req.user.id).select('ciToken ciInstance ciProvider');
  
  if (!user.ciToken || !user.ciInstance) {
    return next(new ErrorResponse('Please configure your CI credentials first', 400));
  }
  
  // TODO: Implement actual CI API integration based on ciProvider
  
  // For now, simulate triggering a build
  const buildNumber = Math.floor(Math.random() * 1000);
  const buildUrl = `${user.ciInstance}/job/${repository}/build/${buildNumber}`;
  
  res.status(201).json({
    success: true,
    data: {
      buildNumber,
      buildUrl,
      status: 'started',
      repository,
      branch,
    },
  });
});

/**
 * @desc    Get all CI builds
 * @route   GET /api/ci/build
 * @access  Private
 */
exports.getBuilds = asyncHandler(async (req, res, next) => {
  const { repository } = req.query;

  if (!repository) {
    return next(new ErrorResponse('Please provide a repository name', 400));
  }
  
  // Get user's CI credentials
  const user = await User.findById(req.user.id).select('ciToken ciInstance ciProvider');
  
  if (!user.ciToken || !user.ciInstance) {
    return next(new ErrorResponse('Please configure your CI credentials first', 400));
  }
  
  // TODO: Implement actual CI API integration to fetch builds
  
  // For now, return mock data
  const builds = [
    {
      buildNumber: 123,
      buildUrl: `${user.ciInstance}/job/${repository}/build/123`,
      status: 'success',
      repository,
      branch: 'main',
      createdAt: new Date().toISOString(),
      duration: '2m 30s',
    },
    {
      buildNumber: 122,
      buildUrl: `${user.ciInstance}/job/${repository}/build/122`,
      status: 'failed',
      repository,
      branch: 'feature/test-cases',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      duration: '1m 45s',
    }
  ];
  
  res.status(200).json({
    success: true,
    count: builds.length,
    data: builds,
  });
});

/**
 * @desc    Get a single CI build
 * @route   GET /api/ci/build/:id
 * @access  Private
 */
exports.getBuild = asyncHandler(async (req, res, next) => {
  const buildNumber = req.params.id;
  const { repository } = req.query;
  
  if (!repository) {
    return next(new ErrorResponse('Please provide a repository name', 400));
  }
  
  // Get user's CI credentials
  const user = await User.findById(req.user.id).select('ciToken ciInstance ciProvider');
  
  if (!user.ciToken || !user.ciInstance) {
    return next(new ErrorResponse('Please configure your CI credentials first', 400));
  }
  
  // TODO: Implement actual CI API integration to fetch build details
  
  // For now, return mock data
  const build = {
    buildNumber: parseInt(buildNumber),
    buildUrl: `${user.ciInstance}/job/${repository}/build/${buildNumber}`,
    status: 'success',
    repository,
    branch: 'main',
    createdAt: new Date().toISOString(),
    duration: '2m 30s',
    logs: [
      '[INFO] Building project',
      '[INFO] Running tests',
      '[INFO] All tests passed',
      '[INFO] Build successful'
    ]
  };
  
  res.status(200).json({
    success: true,
    data: build,
  });
}); 