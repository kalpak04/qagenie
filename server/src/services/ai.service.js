const axios = require('axios');
const { logger } = require('../utils/logger');

class AIService {
  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 seconds timeout for AI operations
    });
    this.useAiService = true;

    // Test connection to AI service
    this.checkHealth().catch(err => {
      logger.warn(`Unable to connect to AI service: ${this.getSafeErrorMessage(err)}`);
      // Automatically fallback to mock data if AI service is unavailable
      this.useAiService = false;
      logger.info("Falling back to mock data for AI operations");
    });
  }

  /**
   * Get a safe error message that can be serialized without circular references
   * @param {Error} error - The error object
   * @returns {string} - Safe error message
   */
  getSafeErrorMessage(error) {
    if (!error) return 'Unknown error';
    
    try {
      // Extract relevant error information without circular references
      const safeError = {
        message: error.message || 'Unknown error',
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      };
      
      return JSON.stringify(safeError);
    } catch (e) {
      return `Error parsing error: ${e.message}. Original error message: ${error.message || 'Unknown'}`;
    }
  }

  /**
   * Check if the AI service is healthy
   */
  async checkHealth() {
    // If USE_MOCK_DATA is explicitly set to true, don't bother checking AI service
    if (process.env.USE_MOCK_DATA === 'true') {
      this.useAiService = false;
      return { status: 'mock mode enabled' };
    }

    try {
      const response = await this.client.get('/health');
      logger.info(`AI service health check: ${response.data.status}`);
      this.useAiService = true;
      return response.data;
    } catch (error) {
      // Extract useful error details for network errors (common when service is down)
      const errorDetails = error.code 
        ? `${error.code}: ${error.message}`
        : error.message || 'Unknown error';
      
      logger.error(`AI service health check failed: ${this.getSafeErrorMessage(error)}`);
      this.useAiService = false;
      throw new Error(`AI service health check failed: ${errorDetails}`);
    }
  }

  /**
   * Analyze a PRD and generate test cases
   * @param {string} content - The PRD content
   * @param {string} format - The format of the PRD (markdown, pdf_base64, text)
   * @param {string} projectId - Optional project ID
   * @returns {Promise<object>} - Test cases and metadata
   */
  async generateTestCases(content, format = 'markdown', projectId = null) {
    // Use mock data if AI service is unavailable or mock mode is enabled
    if (!this.useAiService || process.env.USE_MOCK_DATA === 'true') {
      logger.info("Using mock data for test case generation");
      return this.getMockTestCases();
    }
    
    try {
      const response = await this.client.post('/analyze/prd', {
        content,
        format,
        project_id: projectId,
      });
      
      logger.info(`Generated ${response.data.test_cases.length} test cases`);
      return response.data;
    } catch (error) {
      const errorDetails = error.code 
        ? `${error.code}: ${error.message}`
        : error.message || 'Unknown error';
        
      logger.error(`Error generating test cases: ${this.getSafeErrorMessage(error)}`);
      
      // If AI service request fails, fall back to mock data
      logger.info("Falling back to mock data due to AI service error");
      return this.getMockTestCases();
    }
  }

  /**
   * Get mock test case data for development
   */
  getMockTestCases() {
    return {
      test_cases: [
        {
          title: "Mock Test Case 1",
          description: "This is a mock test case for development",
          preconditions: "System is running",
          steps: [
            { step: "1", action: "Navigate to homepage" },
            { step: "2", action: "Click login button" }
          ],
          expected_results: ["User is logged in"],
          priority: "must-have",
          tags: ["mock", "development"]
        },
        {
          title: "Mock Test Case 2",
          description: "Another mock test case",
          preconditions: "User is logged in",
          steps: [
            { step: "1", action: "Navigate to settings" },
            { step: "2", action: "Update profile info" }
          ],
          expected_results: ["Profile is updated"],
          priority: "should-have",
          tags: ["mock", "profile"]
        }
      ],
      coverage_percentage: 75,
      summary: "Mock test cases generated for development"
    };
  }

  /**
   * Generate Cucumber feature files from test cases
   * @param {object} testCases - The test cases object
   * @returns {Promise<object>} - Feature files as key-value pairs
   */
  async generateCucumberFeatures(testCases) {
    // Use mock data if AI service is unavailable or mock mode is enabled
    if (!this.useAiService || process.env.USE_MOCK_DATA === 'true') {
      logger.info("Using mock data for cucumber feature generation");
      return {
        "feature1.feature": "Feature: Mock Feature 1\n  Scenario: Mock Scenario\n    Given I am logged in\n    When I perform an action\n    Then I should see the result",
        "feature2.feature": "Feature: Mock Feature 2\n  Scenario: Another Scenario\n    Given I am on the homepage\n    When I click a button\n    Then Something happens"
      };
    }
    
    try {
      const response = await this.client.post('/generate/cucumber', testCases);
      
      const featureCount = Object.keys(response.data).length;
      logger.info(`Generated ${featureCount} cucumber feature files`);
      
      return response.data;
    } catch (error) {
      const errorDetails = error.code 
        ? `${error.code}: ${error.message}`
        : error.message || 'Unknown error';
        
      logger.error(`Error generating cucumber features: ${this.getSafeErrorMessage(error)}`);
      
      // Return mock cucumber features if AI service fails
      return {
        "feature1.feature": "Feature: Mock Feature 1\n  Scenario: Mock Scenario\n    Given I am logged in\n    When I perform an action\n    Then I should see the result",
        "feature2.feature": "Feature: Mock Feature 2\n  Scenario: Another Scenario\n    Given I am on the homepage\n    When I click a button\n    Then Something happens"
      };
    }
  }

  /**
   * Upload a PRD file and extract its content
   * @param {Buffer} fileBuffer - The file buffer
   * @param {string} fileName - The name of the file
   * @returns {Promise<object>} - Extracted content and metadata
   */
  async uploadPRD(fileBuffer, fileName) {
    // Use mock data if AI service is unavailable or mock mode is enabled
    if (!this.useAiService || process.env.USE_MOCK_DATA === 'true') {
      logger.info("Using mock data for PRD upload");
      return {
        content: "# Mock PRD\n\nThis is a mock PRD generated when the AI service is unavailable.\n\n## Features\n\n- Feature 1\n- Feature 2\n\n## Requirements\n\n1. Requirement 1\n2. Requirement 2",
        format: "markdown",
        metadata: {
          title: fileName,
          version: "1.0",
          author: "Mock System"
        }
      };
    }
    
    try {
      // Create form data
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: 'application/octet-stream',
      });

      // Make API call
      const response = await this.client.post('/upload/prd', formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      logger.info(`Successfully processed PRD file: ${fileName}`);
      return response.data;
    } catch (error) {
      const errorDetails = error.code 
        ? `${error.code}: ${error.message}`
        : error.message || 'Unknown error';
        
      logger.error(`Error uploading PRD file: ${this.getSafeErrorMessage(error)}`);
      
      // Return mock PRD content if AI service fails
      return {
        content: "# Mock PRD\n\nThis is a mock PRD generated when the AI service is unavailable.\n\n## Features\n\n- Feature 1\n- Feature 2\n\n## Requirements\n\n1. Requirement 1\n2. Requirement 2",
        format: "markdown",
        metadata: {
          title: fileName,
          version: "1.0",
          author: "Mock System"
        }
      };
    }
  }
}

// Create a singleton instance
const aiService = new AIService();

module.exports = aiService; 