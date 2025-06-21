const mongoose = require('mongoose');

const prdSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
    },
    content: {
      type: String,
      required: [true, 'PRD content is required'],
    },
    format: {
      type: String,
      enum: ['markdown', 'pdf', 'text'],
      default: 'markdown',
    },
    fileUrl: {
      type: String,
    },
    originalFilename: {
      type: String,
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
    testCases: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestCase',
    }],
    status: {
      type: String,
      enum: ['draft', 'analyzed', 'test_cases_generated', 'tickets_created', 'features_generated', 'complete'],
      default: 'draft',
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Add full text search index
prdSchema.index({ title: 'text', description: 'text', content: 'text' });

module.exports = mongoose.model('PRD', prdSchema); 