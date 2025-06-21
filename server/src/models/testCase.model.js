const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
    },
    preconditions: {
      type: String,
    },
    steps: [
      {
        step: {
          type: String,
          required: true,
        },
        action: {
          type: String,
          required: true,
        },
      },
    ],
    expectedResults: [
      {
        type: String,
        required: true,
      },
    ],
    priority: {
      type: String,
      enum: ['must-have', 'should-have', 'nice-to-have'],
      required: true,
    },
    tags: [String],
    prd: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PRD',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    ticketId: {
      type: String,
    },
    ticketUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ['draft', 'reviewed', 'approved', 'rejected', 'implemented'],
      default: 'draft',
    },
    featureFile: {
      type: String,
    },
    automationStatus: {
      type: String,
      enum: ['not_automated', 'in_progress', 'automated', 'failed'],
      default: 'not_automated',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TestCase', testCaseSchema); 