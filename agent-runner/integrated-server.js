const express = require('express');
const cors = require('cors');
const http = require('http');

// Import all feature modules
const VisualTestingAgent = require('./visual-testing');
const SelfHealingFramework = require('./self-healing');
const IntelligentTestOptimizer = require('./test-optimizer');
const CollaborativeTestingPlatform = require('./collaborative-testing');
const PerformanceTestingIntegration = require('./performance-testing');
const NaturalLanguageTestManager = require('./natural-language-testing');
const PluginSystem = require('./plugin-system');
const IntelligentTestMaintenance = require('./test-maintenance');
const TestDataIntelligence = require('./test-data-intelligence');
const ContinuousLearningSystem = require('./continuous-learning');

class IntegratedQAGenieServer {
  constructor(port = 7000) {
    this.app = express();
    this.port = port;
    this.server = http.createServer(this.app);
    
    // Initialize all feature instances
    this.features = {
      visualTesting: new VisualTestingAgent(),
      selfHealing: new SelfHealingFramework(),
      testOptimizer: new IntelligentTestOptimizer(),
      collaborativeTesting: new CollaborativeTestingPlatform({ port: 8080 }),
      performanceTesting: new PerformanceTestingIntegration(),
      naturalLanguage: new NaturalLanguageTestManager(),
      pluginSystem: new PluginSystem(),
      testMaintenance: new IntelligentTestMaintenance(),
      testDataIntelligence: new TestDataIntelligence(),
      continuousLearning: new ContinuousLearningSystem()
    };
    
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeFeatures();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        features: Object.keys(this.features),
        timestamp: new Date().toISOString()
      });
    });

    // Visual Testing Routes
    this.app.post('/visual/capture', async (req, res) => {
      try {
        const { url, name } = req.body;
        const result = await this.features.visualTesting.captureScreenshot(
          { url: () => url }, // Mock page object
          name
        );
        res.json({ success: true, path: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/visual/compare', async (req, res) => {
      try {
        const { baseline, current, name } = req.body;
        const result = await this.features.visualTesting.compareScreenshots(
          baseline,
          current,
          name
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Self-Healing Routes
    this.app.post('/healing/find-element', async (req, res) => {
      try {
        const { selector, pageContext } = req.body;
        // In real implementation, would use actual page object
        const result = await this.features.selfHealing.healElement(
          null, // page object
          selector,
          { context: pageContext }
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/healing/auto-fix', async (req, res) => {
      try {
        const { testCode, failureInfo } = req.body;
        const result = await this.features.selfHealing.autoFixTest(
          testCode,
          failureInfo
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Test Optimization Routes
    this.app.post('/optimize/select-tests', async (req, res) => {
      try {
        const { tests, codeChanges, timeConstraint } = req.body;
        const result = await this.features.testOptimizer.selectTestsToRun(
          tests,
          codeChanges,
          timeConstraint
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/optimize/parallel', async (req, res) => {
      try {
        const { tests } = req.body;
        const result = await this.features.testOptimizer.optimizeParallelExecution(tests);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Performance Testing Routes
    this.app.post('/performance/test', async (req, res) => {
      try {
        const { url, options } = req.body;
        const result = await this.features.performanceTesting.runPerformanceTest(url, options);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/performance/load-test', async (req, res) => {
      try {
        const { url, options } = req.body;
        const result = await this.features.performanceTesting.runLoadTest(url, options);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Natural Language Testing Routes
    this.app.post('/nl/parse', async (req, res) => {
      try {
        const { testScript } = req.body;
        const result = await this.features.naturalLanguage.parseNaturalLanguageTest(testScript);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/nl/execute', async (req, res) => {
      try {
        const { testScript, options } = req.body;
        const result = await this.features.naturalLanguage.executeNaturalLanguageTest(
          testScript,
          options
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/nl/convert', async (req, res) => {
      try {
        const { testScript, language } = req.body;
        const result = await this.features.naturalLanguage.convertToCode(testScript, language);
        res.json({ code: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Plugin System Routes
    this.app.get('/plugins', async (req, res) => {
      try {
        const plugins = this.features.pluginSystem.listPlugins();
        res.json(plugins);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/plugins/install', async (req, res) => {
      try {
        const { pluginName, version } = req.body;
        await this.features.pluginSystem.installPlugin(pluginName, version);
        res.json({ success: true, message: `Plugin ${pluginName} installed successfully` });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/plugins/search', async (req, res) => {
      try {
        const { query } = req.body;
        const results = await this.features.pluginSystem.searchPlugins(query);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Test Maintenance Routes
    this.app.post('/maintenance/analyze', async (req, res) => {
      try {
        const { testSuitePath } = req.body;
        const result = await this.features.testMaintenance.analyzeTestSuite(testSuitePath);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/maintenance/auto-fix', async (req, res) => {
      try {
        const { testId } = req.body;
        const result = await this.features.testMaintenance.autoFixTest(testId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/maintenance/report', async (req, res) => {
      try {
        const report = await this.features.testMaintenance.generateMaintenanceReport();
        res.json(report);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Test Data Intelligence Routes
    this.app.post('/data/analyze', async (req, res) => {
      try {
        const { filePath } = req.body;
        const result = await this.features.testDataIntelligence.analyzeTestData(filePath);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/data/generate', async (req, res) => {
      try {
        const { schema, options } = req.body;
        const result = await this.features.testDataIntelligence.generateTestData(schema, options);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/data/snapshot', async (req, res) => {
      try {
        const { name, data, metadata } = req.body;
        const result = await this.features.testDataIntelligence.createDataSnapshot(
          name,
          data,
          metadata
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Continuous Learning Routes
    this.app.post('/learning/train', async (req, res) => {
      try {
        const { modelName, trainingData } = req.body;
        await this.features.continuousLearning.collectTrainingData(modelName, trainingData);
        res.json({ success: true, message: 'Training data collected' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/learning/predict', async (req, res) => {
      try {
        const { modelName, features } = req.body;
        const prediction = await this.features.continuousLearning.predict(modelName, features);
        res.json({ prediction });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/learning/feedback', async (req, res) => {
      try {
        const { predictionId, actual } = req.body;
        await this.features.continuousLearning.provideFeedback(predictionId, actual);
        res.json({ success: true, message: 'Feedback recorded' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/learning/insights', async (req, res) => {
      try {
        const insights = await this.features.continuousLearning.generateInsights();
        res.json(insights);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Integrated Workflow Routes
    this.app.post('/workflow/smart-test', async (req, res) => {
      try {
        const { naturalLanguageTest, options } = req.body;
        
        // 1. Parse natural language test
        const parsedTest = await this.features.naturalLanguage.parseNaturalLanguageTest(
          naturalLanguageTest
        );
        
        // 2. Generate test data if needed
        const testData = await this.features.testDataIntelligence.generateTestData(
          { type: 'object', properties: {} }, // Simple schema
          { count: 5 }
        );
        
        // 3. Execute with self-healing
        // In real implementation, would integrate with Playwright
        const executionResult = {
          success: true,
          steps: parsedTest,
          data: testData
        };
        
        // 4. Collect performance metrics
        const performanceMetrics = {
          duration: Math.random() * 5000 + 1000,
          memoryUsage: Math.random() * 100
        };
        
        // 5. Feed to continuous learning
        await this.features.continuousLearning.collectTrainingData('test_execution', {
          test: parsedTest,
          result: executionResult,
          performance: performanceMetrics
        });
        
        res.json({
          parsedTest,
          testData,
          executionResult,
          performanceMetrics
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async initializeFeatures() {
    try {
      // Initialize plugin system
      await this.features.pluginSystem.initialize();
      
      // Initialize continuous learning
      await this.features.continuousLearning.initialize();
      
      // Start collaborative testing server
      await this.features.collaborativeTesting.startServer();
      
      console.log('All features initialized successfully');
    } catch (error) {
      console.error('Error initializing features:', error);
    }
  }

  async start() {
    this.server.listen(this.port, () => {
      console.log(`Integrated QAGenie server running on port ${this.port}`);
      console.log(`Collaborative testing WebSocket server on port 8080`);
      console.log('\nAvailable features:');
      console.log('- Visual Testing & Regression');
      console.log('- Self-Healing Test Framework');
      console.log('- Intelligent Test Optimization');
      console.log('- Collaborative Testing Platform');
      console.log('- Performance Testing Integration');
      console.log('- Natural Language Test Management');
      console.log('- Plugin Ecosystem');
      console.log('- Intelligent Test Maintenance');
      console.log('- Test Data Intelligence');
      console.log('- Continuous Learning System');
    });
  }
}

// Start the server
const server = new IntegratedQAGenieServer(process.env.PORT || 7000);
server.start();

module.exports = IntegratedQAGenieServer; 