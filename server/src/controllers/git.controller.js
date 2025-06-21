const User = require('../models/user.model');
const { asyncHandler } = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Configure Git credentials
 * @route   POST /api/git/configure
 * @access  Private
 */
exports.configureGit = asyncHandler(async (req, res, next) => {
  const { gitToken, gitUsername, gitProvider = 'github' } = req.body;

  if (!gitToken || !gitUsername) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  // Update user with Git credentials
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { gitToken, gitUsername, gitProvider },
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Create a pull request
 * @route   POST /api/git/pr
 * @access  Private
 */
exports.createPullRequest = asyncHandler(async (req, res, next) => {
  const { repository, sourceBranch, targetBranch, title, description } = req.body;

  if (!repository || !sourceBranch || !targetBranch || !title) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  // Get user's Git credentials
  const user = await User.findById(req.user.id).select('gitToken gitUsername gitProvider');
  
  if (!user.gitToken || !user.gitUsername) {
    return next(new ErrorResponse('Please configure your Git credentials first', 400));
  }
  
  // TODO: Implement actual Git API integration based on gitProvider
  
  // For now, simulate creating a PR
  const prNumber = Math.floor(Math.random() * 1000);
  const prUrl = `https://github.com/${repository}/pull/${prNumber}`;
  
  res.status(201).json({
    success: true,
    data: {
      prNumber,
      prUrl,
      title,
      status: 'open',
    },
  });
});

/**
 * @desc    Get all pull requests
 * @route   GET /api/git/pr
 * @access  Private
 */
exports.getPullRequests = asyncHandler(async (req, res, next) => {
  const { repository } = req.query;

  if (!repository) {
    return next(new ErrorResponse('Please provide a repository name', 400));
  }
  
  // Get user's Git credentials
  const user = await User.findById(req.user.id).select('gitToken gitUsername gitProvider');
  
  if (!user.gitToken || !user.gitUsername) {
    return next(new ErrorResponse('Please configure your Git credentials first', 400));
  }
  
  // TODO: Implement actual Git API integration to fetch PRs
  
  // For now, return mock data
  const prs = [
    {
      prNumber: 123,
      prUrl: `https://github.com/${repository}/pull/123`,
      title: 'Add test case automation',
      status: 'open',
      createdAt: new Date().toISOString(),
    },
    {
      prNumber: 122,
      prUrl: `https://github.com/${repository}/pull/122`,
      title: 'Fix bugs in test cases',
      status: 'merged',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    }
  ];
  
  res.status(200).json({
    success: true,
    count: prs.length,
    data: prs,
  });
});

/**
 * @desc    Get a single pull request
 * @route   GET /api/git/pr/:id
 * @access  Private
 */
exports.getPullRequest = asyncHandler(async (req, res, next) => {
  const prNumber = req.params.id;
  const { repository } = req.query;
  
  if (!repository) {
    return next(new ErrorResponse('Please provide a repository name', 400));
  }
  
  // Get user's Git credentials
  const user = await User.findById(req.user.id).select('gitToken gitUsername gitProvider');
  
  if (!user.gitToken || !user.gitUsername) {
    return next(new ErrorResponse('Please configure your Git credentials first', 400));
  }
  
  // TODO: Implement actual Git API integration to fetch PR details
  
  // For now, return mock data
  const pr = {
    prNumber: parseInt(prNumber),
    prUrl: `https://github.com/${repository}/pull/${prNumber}`,
    title: 'Add test case automation',
    description: 'This PR adds automated test cases for the new features',
    status: 'open',
    createdAt: new Date().toISOString(),
    comments: [
      {
        user: 'reviewer',
        comment: 'Looks good to me!',
        createdAt: new Date().toISOString(),
      }
    ]
  };
  
  res.status(200).json({
    success: true,
    data: pr,
  });
}); 