require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const { logger } = require('./src/utils/logger');
const { connectDB } = require('./src/utils/db');
const { syncDatabase } = require('./src/models');
const authRoutes = require('./src/routes/auth.routes');
const prdRoutes = require('./src/routes/prd.routes');
const testCaseRoutes = require('./src/routes/testCase.routes');
const jiraRoutes = require('./src/routes/jira.routes');
const gitRoutes = require('./src/routes/git.routes');
const ciRoutes = require('./src/routes/ci.routes');
const { errorHandler } = require('./src/middleware/errorHandler');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet());

// Compress all HTTP responses
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to all requests
app.use(limiter);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-production-domain.com', 'https://www.your-production-domain.com'] 
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/prd', prdRoutes);
app.use('/api/testcases', testCaseRoutes);
app.use('/api/jira', jiraRoutes);
app.use('/api/git', gitRoutes);
app.use('/api/ci', ciRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use(errorHandler);

// Connect to PostgreSQL and start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Sync models with database (set to false in production)
    const force = process.env.NODE_ENV === 'development' && process.env.DB_SYNC_FORCE === 'true';
    await syncDatabase(force);
    
    // For production, you'd use a real SSL certificate
    // This is just to demonstrate the concept
    if (process.env.NODE_ENV === 'production') {
      logger.info('Starting server in production mode');
      // In production, you should use a proper SSL certificate 
      // and configure HTTPS or use a reverse proxy like Nginx
      app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT} in production mode`);
      });
    } else {
      // Development mode
      app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT} in development mode`);
      });
    }
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Start the server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
}); 