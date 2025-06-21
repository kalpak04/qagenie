const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

class PlaywrightAgent {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.headless = options.headless !== false;
    this.slowMo = options.slowMo || 100;
    this.recordings = [];
    this.testCases = [];
    this.browser = null;
    this.context = null;
    this.page = null;
    this.aiServiceUrl = options.aiServiceUrl || 'http://localhost:8000';
  }

  async initialize() {
    this.browser = await chromium.launch({
      headless: this.headless,
      slowMo: this.slowMo
    });
    this.context = await this.browser.newContext({
      recordVideo: {
        dir: path.join(__dirname, 'recordings'),
        size: { width: 1280, height: 720 }
      }
    });
    this.page = await this.context.newPage();
    console.log("Playwright agent initialized");
    return this;
  }

  async recordSession(name) {
    // Start recording
    console.log(`Starting recording session: ${name}`);
    await this.context.tracing.start({ screenshots: true, snapshots: true });
    
    const recordingId = Date.now().toString();
    const recording = {
      id: recordingId,
      name,
      steps: [],
      timestamp: new Date().toISOString()
    };
    
    this.recordings.push(recording);
    return recordingId;
  }

  async addStep(recordingId, action, selector, value = null) {
    const recording = this.recordings.find(r => r.id === recordingId);
    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }
    
    const step = {
      action,
      selector,
      value,
      timestamp: new Date().toISOString()
    };
    
    recording.steps.push(step);
    
    // Execute the step
    try {
      switch(action) {
        case 'navigate':
          await this.page.goto(value);
          break;
        case 'click':
          await this.page.click(selector);
          break;
        case 'fill':
          await this.page.fill(selector, value);
          break;
        case 'select':
          await this.page.selectOption(selector, value);
          break;
        case 'check':
          await this.page.check(selector);
          break;
        case 'uncheck':
          await this.page.uncheck(selector);
          break;
        case 'screenshot':
          const screenshotPath = path.join(__dirname, 'screenshots', `${recordingId}_${recording.steps.length}.png`);
          await this.page.screenshot({ path: screenshotPath });
          step.screenshot = screenshotPath;
          break;
        case 'assert':
          const isVisible = await this.page.isVisible(selector);
          step.result = isVisible;
          break;
        case 'wait':
          await this.page.waitForTimeout(parseInt(value));
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      step.status = 'success';
    } catch (error) {
      step.status = 'error';
      step.error = error.message;
      console.error(`Error executing step: ${error.message}`);
    }
    
    return step;
  }

  async stopRecording(recordingId) {
    const recording = this.recordings.find(r => r.id === recordingId);
    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }
    
    // Stop tracing
    const tracePath = path.join(__dirname, 'traces', `${recordingId}.zip`);
    await this.context.tracing.stop({ path: tracePath });
    
    recording.tracePath = tracePath;
    recording.endTimestamp = new Date().toISOString();
    
    // Save recording to file
    const recordingsDir = path.join(__dirname, 'recordings');
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(recordingsDir, `${recordingId}.json`),
      JSON.stringify(recording, null, 2)
    );
    
    console.log(`Recording saved to recordings/${recordingId}.json`);
    return recording;
  }

  async generateTestCases(recordingId) {
    const recording = this.recordings.find(r => r.id === recordingId);
    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }
    
    try {
      console.log(`Generating test cases from recording: ${recording.name}`);
      const response = await axios.post(`${this.aiServiceUrl}/analyze/recording`, { recording });
      
      if (response.data && response.data.test_cases) {
        this.testCases.push(...response.data.test_cases);
        return response.data.test_cases;
      }
      
      throw new Error('Invalid response from AI service');
    } catch (error) {
      console.error(`Error generating test cases: ${error.message}`);
      
      // Fallback to local test case generation if AI service fails
      const testCases = this.generateBasicTestCases(recording);
      this.testCases.push(...testCases);
      return testCases;
    }
  }

  generateBasicTestCases(recording) {
    // Simple heuristic to generate basic test cases from a recording
    const testCases = [];
    
    // Group steps by page/feature
    const pages = {};
    let currentPage = 'Unknown';
    
    for (const step of recording.steps) {
      if (step.action === 'navigate') {
        const url = new URL(step.value);
        currentPage = url.pathname;
        if (!pages[currentPage]) {
          pages[currentPage] = [];
        }
      }
      
      if (!pages[currentPage]) {
        pages[currentPage] = [];
      }
      
      pages[currentPage].push(step);
    }
    
    // Generate test cases for each page
    Object.entries(pages).forEach(([page, steps], index) => {
      const testCase = {
        id: `TC${index + 1}`,
        title: `Test case for ${page}`,
        description: `Automated test case generated from recording ${recording.name}`,
        preconditions: "Application is running and accessible",
        steps: steps.map((step, i) => ({
          step: (i + 1).toString(),
          action: `${step.action} ${step.selector} ${step.value ? `with value ${step.value}` : ''}`
        })),
        expected_results: steps.map(() => "Operation completes successfully without errors"),
        priority: "must-have",
        tags: ["automated", "playwright", page]
      };
      
      testCases.push(testCase);
    });
    
    return testCases;
  }

  async exportTestCases(format = 'json') {
    const exportDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    let filePath;
    
    switch(format.toLowerCase()) {
      case 'json':
        filePath = path.join(exportDir, `testcases_${timestamp}.json`);
        fs.writeFileSync(filePath, JSON.stringify(this.testCases, null, 2));
        break;
      case 'cucumber':
        filePath = path.join(exportDir, `features_${timestamp}.feature`);
        const feature = this.convertToCucumber(this.testCases);
        fs.writeFileSync(filePath, feature);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    console.log(`Test cases exported to ${filePath}`);
    return filePath;
  }

  convertToCucumber(testCases) {
    let feature = 'Feature: Automated tests generated from Playwright recordings\n\n';
    
    testCases.forEach(tc => {
      feature += `  Scenario: ${tc.title}\n`;
      feature += `    Given ${tc.preconditions}\n`;
      
      tc.steps.forEach(step => {
        feature += `    When ${step.action}\n`;
      });
      
      tc.expected_results.forEach(result => {
        feature += `    Then ${result}\n`;
      });
      
      feature += '\n';
    });
    
    return feature;
  }

  async runTestCase(testCaseId) {
    const testCase = this.testCases.find(tc => tc.id === testCaseId);
    if (!testCase) {
      throw new Error(`Test case ${testCaseId} not found`);
    }
    
    console.log(`Running test case: ${testCase.title}`);
    
    const results = [];
    for (const step of testCase.steps) {
      try {
        // Parse step action to execute
        const actionText = step.action;
        const actionMatch = actionText.match(/^(\w+)\s+([^(]+)(?:\s+with value\s+(.+))?$/);
        
        if (!actionMatch) {
          throw new Error(`Cannot parse step action: ${actionText}`);
        }
        
        const [, action, selector, value] = actionMatch;
        
        // Execute the action
        const result = {
          step: step.step,
          action: actionText,
          status: 'pending'
        };
        
        switch(action) {
          case 'navigate':
            await this.page.goto(value || this.baseUrl);
            break;
          case 'click':
            await this.page.click(selector.trim());
            break;
          case 'fill':
            await this.page.fill(selector.trim(), value);
            break;
          case 'wait':
            await this.page.waitForTimeout(parseInt(value || '1000'));
            break;
          default:
            console.warn(`Unsupported action: ${action}`);
        }
        
        result.status = 'success';
        results.push(result);
      } catch (error) {
        results.push({
          step: step.step,
          action: step.action,
          status: 'error',
          error: error.message
        });
        console.error(`Error executing step ${step.step}: ${error.message}`);
      }
    }
    
    return {
      testCaseId,
      title: testCase.title,
      results,
      passed: results.every(r => r.status === 'success'),
      timestamp: new Date().toISOString()
    };
  }

  async close() {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    console.log("Playwright agent closed");
  }
}

module.exports = PlaywrightAgent; 