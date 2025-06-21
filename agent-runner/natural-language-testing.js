const axios = require('axios');
const { chromium } = require('playwright');
const natural = require('natural');

class NaturalLanguageTestManager {
  constructor(options = {}) {
    this.aiServiceUrl = options.aiServiceUrl || 'http://localhost:8000';
    this.tokenizer = new natural.WordTokenizer();
    this.classifier = new natural.BayesClassifier();
    this.actionPatterns = this.initializeActionPatterns();
    this.contextStack = [];
    this.variables = new Map();
  }

  initializeActionPatterns() {
    return {
      navigate: [
        /go to (.*)/i,
        /navigate to (.*)/i,
        /open (.*)/i,
        /visit (.*)/i,
        /load (.*)/i
      ],
      click: [
        /click (?:on )?(?:the )?(.*)/i,
        /tap (?:on )?(?:the )?(.*)/i,
        /press (?:the )?(.*)/i,
        /select (?:the )?(.*)/i
      ],
      type: [
        /type ["'](.*)["'] (?:in|into) (?:the )?(.*)/i,
        /enter ["'](.*)["'] (?:in|into) (?:the )?(.*)/i,
        /fill (?:the )?(.*) with ["'](.*?)["']/i,
        /input ["'](.*)["'] (?:in|into) (?:the )?(.*)/i
      ],
      assert: [
        /(?:verify|check|assert) (?:that )?(?:the )?(.*) (?:is|equals|contains) ["'](.*?)["']/i,
        /(?:the )?(.*) should (?:be|equal|contain) ["'](.*?)["']/i,
        /expect (?:the )?(.*) to (?:be|equal|contain) ["'](.*?)["']/i
      ],
      wait: [
        /wait (?:for )?(\d+) (?:seconds?|ms|milliseconds?)/i,
        /pause (?:for )?(\d+) (?:seconds?|ms|milliseconds?)/i,
        /sleep (?:for )?(\d+) (?:seconds?|ms|milliseconds?)/i
      ],
      screenshot: [
        /take (?:a )?screenshot(?: (?:of|named) ["'](.*?)["'])?/i,
        /capture (?:the )?screen(?: as ["'](.*?)["'])?/i,
        /screenshot(?: ["'](.*?)["'])?/i
      ],
      scroll: [
        /scroll (?:to )?(.*)/i,
        /scroll (up|down|left|right)(?: by (\d+))?/i
      ],
      hover: [
        /hover (?:over|on) (?:the )?(.*)/i,
        /mouse over (?:the )?(.*)/i
      ],
      variable: [
        /save (?:the )?(.*) as ["'](.*?)["']/i,
        /store (?:the )?(.*) (?:in|as) ["'](.*?)["']/i,
        /remember (?:the )?(.*) as ["'](.*?)["']/i
      ]
    };
  }

  async parseNaturalLanguageTest(nlTest) {
    const lines = nlTest.split('\n').filter(line => line.trim());
    const testSteps = [];
    let currentScenario = null;
    let currentContext = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments
      if (trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
        continue;
      }

      // Handle scenario definitions
      if (trimmedLine.toLowerCase().startsWith('scenario:') || 
          trimmedLine.toLowerCase().startsWith('test:')) {
        currentScenario = {
          name: trimmedLine.substring(trimmedLine.indexOf(':') + 1).trim(),
          steps: []
        };
        testSteps.push(currentScenario);
        continue;
      }

      // Handle context/background
      if (trimmedLine.toLowerCase().startsWith('given') ||
          trimmedLine.toLowerCase().startsWith('background:')) {
        currentContext = await this.parseContextLine(trimmedLine);
        continue;
      }

      // Parse action lines
      const action = await this.parseActionLine(trimmedLine, currentContext);
      if (action) {
        if (currentScenario) {
          currentScenario.steps.push(action);
        } else {
          testSteps.push(action);
        }
      }
    }

    return testSteps;
  }

  async parseActionLine(line, context = {}) {
    // Try to match against known patterns
    for (const [actionType, patterns] of Object.entries(this.actionPatterns)) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          return this.createAction(actionType, match, line, context);
        }
      }
    }

    // If no pattern matches, use AI to interpret
    return await this.interpretWithAI(line, context);
  }

  createAction(type, match, originalText, context) {
    switch (type) {
      case 'navigate':
        return {
          type: 'navigate',
          url: this.resolveVariable(match[1]),
          originalText
        };
      
      case 'click':
        return {
          type: 'click',
          target: this.resolveSelector(match[1]),
          originalText
        };
      
      case 'type':
        const text = match[1] || match[2];
        const target = match[2] || match[1];
        return {
          type: 'type',
          text: this.resolveVariable(text),
          target: this.resolveSelector(target),
          originalText
        };
      
      case 'assert':
        return {
          type: 'assert',
          target: this.resolveSelector(match[1]),
          assertion: 'contains',
          expected: this.resolveVariable(match[2]),
          originalText
        };
      
      case 'wait':
        const duration = parseInt(match[1]);
        const unit = match[2] || 'ms';
        return {
          type: 'wait',
          duration: unit.includes('second') ? duration * 1000 : duration,
          originalText
        };
      
      case 'screenshot':
        return {
          type: 'screenshot',
          name: match[1] || `screenshot_${Date.now()}`,
          originalText
        };
      
      case 'scroll':
        return {
          type: 'scroll',
          direction: match[1],
          amount: match[2] ? parseInt(match[2]) : undefined,
          originalText
        };
      
      case 'hover':
        return {
          type: 'hover',
          target: this.resolveSelector(match[1]),
          originalText
        };
      
      case 'variable':
        return {
          type: 'saveVariable',
          source: this.resolveSelector(match[1]),
          variableName: match[2],
          originalText
        };
      
      default:
        return null;
    }
  }

  resolveSelector(text) {
    // Check if it's a variable reference
    if (text.startsWith('$')) {
      return this.variables.get(text.substring(1)) || text;
    }

    // Smart selector resolution
    const cleanText = text.trim().toLowerCase();
    
    // Check for common UI element patterns
    if (cleanText.includes('button')) {
      return `button:has-text("${text.replace(/button/i, '').trim()}")`;
    }
    
    if (cleanText.includes('link')) {
      return `a:has-text("${text.replace(/link/i, '').trim()}")`;
    }
    
    if (cleanText.includes('input') || cleanText.includes('field')) {
      const fieldName = text.replace(/input|field/i, '').trim();
      return `input[placeholder*="${fieldName}"], input[name*="${fieldName}"], label:has-text("${fieldName}") + input`;
    }
    
    // Default to text selector
    return `text="${text}"`;
  }

  resolveVariable(text) {
    if (text.startsWith('$')) {
      return this.variables.get(text.substring(1)) || text;
    }
    return text;
  }

  async interpretWithAI(line, context) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/interpret/test-step`, {
        instruction: line,
        context,
        knownVariables: Array.from(this.variables.keys())
      });

      return response.data.action;
    } catch (error) {
      console.error('AI interpretation failed:', error);
      
      // Fallback to basic interpretation
      return {
        type: 'unknown',
        instruction: line,
        requiresManualReview: true
      };
    }
  }

  async parseContextLine(line) {
    const context = {};
    
    // Parse user context
    if (line.includes('logged in as') || line.includes('authenticated as')) {
      const userMatch = line.match(/as ["'](.*)["']/);
      if (userMatch) {
        context.user = userMatch[1];
      }
    }
    
    // Parse environment context
    if (line.includes('on') || line.includes('using')) {
      const envMatch = line.match(/(?:on|using) (mobile|desktop|tablet)/i);
      if (envMatch) {
        context.device = envMatch[1].toLowerCase();
      }
    }
    
    return context;
  }

  async executeNaturalLanguageTest(nlTest, options = {}) {
    const browser = await chromium.launch({
      headless: options.headless !== false
    });

    const context = await browser.newContext({
      viewport: this.getViewportForDevice(options.device || 'desktop'),
      ...options.contextOptions
    });

    const page = await context.newPage();
    const results = {
      success: true,
      steps: [],
      screenshots: [],
      errors: [],
      duration: 0
    };

    const startTime = Date.now();
    const parsedSteps = await this.parseNaturalLanguageTest(nlTest);

    try {
      for (const step of parsedSteps) {
        if (step.name && step.steps) {
          // It's a scenario
          results.steps.push({
            type: 'scenario',
            name: step.name,
            steps: []
          });
          
          for (const scenarioStep of step.steps) {
            const stepResult = await this.executeStep(page, scenarioStep);
            results.steps[results.steps.length - 1].steps.push(stepResult);
            
            if (!stepResult.success) {
              results.success = false;
              break;
            }
          }
        } else {
          // It's a direct step
          const stepResult = await this.executeStep(page, step);
          results.steps.push(stepResult);
          
          if (!stepResult.success) {
            results.success = false;
            break;
          }
        }
      }
    } catch (error) {
      results.success = false;
      results.errors.push({
        message: error.message,
        stack: error.stack
      });
    } finally {
      results.duration = Date.now() - startTime;
      await browser.close();
    }

    return results;
  }

  async executeStep(page, step) {
    const result = {
      step: step.originalText || step.type,
      type: step.type,
      success: true,
      duration: 0,
      error: null
    };

    const startTime = Date.now();

    try {
      switch (step.type) {
        case 'navigate':
          await page.goto(step.url);
          break;
        
        case 'click':
          await page.click(step.target);
          break;
        
        case 'type':
          await page.fill(step.target, step.text);
          break;
        
        case 'assert':
          const element = await page.locator(step.target);
          const text = await element.textContent();
          
          if (step.assertion === 'contains') {
            if (!text.includes(step.expected)) {
              throw new Error(`Expected "${step.expected}" but got "${text}"`);
            }
          }
          break;
        
        case 'wait':
          await page.waitForTimeout(step.duration);
          break;
        
        case 'screenshot':
          const screenshotPath = await page.screenshot({
            path: `screenshots/${step.name}.png`
          });
          result.screenshot = screenshotPath;
          break;
        
        case 'scroll':
          if (step.direction === 'down') {
            await page.evaluate((amount) => {
              window.scrollBy(0, amount || 100);
            }, step.amount);
          } else if (step.direction === 'up') {
            await page.evaluate((amount) => {
              window.scrollBy(0, -(amount || 100));
            }, step.amount);
          }
          break;
        
        case 'hover':
          await page.hover(step.target);
          break;
        
        case 'saveVariable':
          const value = await page.locator(step.source).textContent();
          this.variables.set(step.variableName, value);
          result.savedValue = value;
          break;
        
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    } catch (error) {
      result.success = false;
      result.error = {
        message: error.message,
        stack: error.stack
      };
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  getViewportForDevice(device) {
    const viewports = {
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1920, height: 1080 }
    };
    
    return viewports[device] || viewports.desktop;
  }

  async convertToCode(nlTest, language = 'javascript') {
    const parsedSteps = await this.parseNaturalLanguageTest(nlTest);
    
    switch (language) {
      case 'javascript':
      case 'playwright':
        return this.convertToPlaywright(parsedSteps);
      
      case 'cypress':
        return this.convertToCypress(parsedSteps);
      
      case 'selenium':
        return this.convertToSelenium(parsedSteps);
      
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  convertToPlaywright(steps) {
    const code = [];
    code.push("const { test, expect } = require('@playwright/test');");
    code.push("");
    
    let currentScenario = null;
    
    for (const step of steps) {
      if (step.name && step.steps) {
        // Start a new test
        code.push(`test('${step.name}', async ({ page }) => {`);
        
        for (const scenarioStep of step.steps) {
          code.push(`  ${this.stepToPlaywrightCode(scenarioStep)}`);
        }
        
        code.push("});");
        code.push("");
      } else {
        // Top-level step
        if (!currentScenario) {
          code.push("test('Test', async ({ page }) => {");
          currentScenario = true;
        }
        
        code.push(`  ${this.stepToPlaywrightCode(step)}`);
      }
    }
    
    if (currentScenario) {
      code.push("});");
    }
    
    return code.join('\n');
  }

  stepToPlaywrightCode(step) {
    switch (step.type) {
      case 'navigate':
        return `await page.goto('${step.url}');`;
      
      case 'click':
        return `await page.click('${step.target}');`;
      
      case 'type':
        return `await page.fill('${step.target}', '${step.text}');`;
      
      case 'assert':
        return `await expect(page.locator('${step.target}')).toContainText('${step.expected}');`;
      
      case 'wait':
        return `await page.waitForTimeout(${step.duration});`;
      
      case 'screenshot':
        return `await page.screenshot({ path: '${step.name}.png' });`;
      
      case 'scroll':
        return `await page.evaluate(() => window.scrollBy(0, ${step.amount || 100}));`;
      
      case 'hover':
        return `await page.hover('${step.target}');`;
      
      case 'saveVariable':
        return `const ${step.variableName} = await page.locator('${step.source}').textContent();`;
      
      default:
        return `// TODO: ${step.originalText || step.type}`;
    }
  }

  convertToCypress(steps) {
    const code = [];
    code.push("describe('Test Suite', () => {");
    
    let currentScenario = null;
    
    for (const step of steps) {
      if (step.name && step.steps) {
        code.push(`  it('${step.name}', () => {`);
        
        for (const scenarioStep of step.steps) {
          code.push(`    ${this.stepToCypressCode(scenarioStep)}`);
        }
        
        code.push("  });");
        code.push("");
      } else {
        if (!currentScenario) {
          code.push("  it('Test', () => {");
          currentScenario = true;
        }
        
        code.push(`    ${this.stepToCypressCode(step)}`);
      }
    }
    
    if (currentScenario) {
      code.push("  });");
    }
    
    code.push("});");
    
    return code.join('\n');
  }

  stepToCypressCode(step) {
    switch (step.type) {
      case 'navigate':
        return `cy.visit('${step.url}');`;
      
      case 'click':
        return `cy.contains('${step.target}').click();`;
      
      case 'type':
        return `cy.get('${step.target}').type('${step.text}');`;
      
      case 'assert':
        return `cy.contains('${step.target}').should('contain', '${step.expected}');`;
      
      case 'wait':
        return `cy.wait(${step.duration});`;
      
      case 'screenshot':
        return `cy.screenshot('${step.name}');`;
      
      default:
        return `// TODO: ${step.originalText || step.type}`;
    }
  }

  async suggestImprovements(nlTest) {
    const suggestions = [];
    const lines = nlTest.split('\n');
    
    // Check for ambiguous selectors
    for (const line of lines) {
      if (line.includes('click') || line.includes('type')) {
        const hasSpecificSelector = /["'].*["']/.test(line) || 
                                   /button|link|input|field/.test(line);
        
        if (!hasSpecificSelector) {
          suggestions.push({
            line,
            type: 'ambiguous_selector',
            suggestion: 'Consider being more specific about which element to interact with',
            example: `click on the "Submit" button`
          });
        }
      }
    }
    
    // Check for missing assertions
    const hasAssertions = lines.some(line => 
      /verify|check|assert|should|expect/.test(line.toLowerCase())
    );
    
    if (!hasAssertions) {
      suggestions.push({
        type: 'missing_assertions',
        suggestion: 'Add assertions to verify the expected behavior',
        example: 'Then verify that the success message contains "Order placed successfully"'
      });
    }
    
    // Check for proper scenario structure
    const hasScenarios = lines.some(line => 
      line.toLowerCase().startsWith('scenario:') || 
      line.toLowerCase().startsWith('test:')
    );
    
    if (!hasScenarios && lines.length > 5) {
      suggestions.push({
        type: 'missing_structure',
        suggestion: 'Consider organizing steps into scenarios for better readability',
        example: 'Scenario: User can successfully place an order'
      });
    }
    
    // Get AI suggestions
    try {
      const aiSuggestions = await this.getAITestImprovements(nlTest);
      suggestions.push(...aiSuggestions);
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
    }
    
    return suggestions;
  }

  async getAITestImprovements(nlTest) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/analyze/nl-test`, {
        test: nlTest
      });
      
      return response.data.suggestions || [];
    } catch (error) {
      return [];
    }
  }

  async generateTestFromDescription(description) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/generate/nl-test`, {
        description,
        style: 'natural'
      });
      
      return response.data.test;
    } catch (error) {
      // Fallback to template-based generation
      return this.generateTemplateTest(description);
    }
  }

  generateTemplateTest(description) {
    const template = [];
    
    template.push(`Scenario: ${description}`);
    template.push('');
    template.push('# TODO: Add test steps');
    template.push('Given I am on the home page');
    template.push('When I [perform action]');
    template.push('Then I should see [expected result]');
    
    return template.join('\n');
  }

  convertToSelenium(steps) {
    const code = [];
    code.push("const { Builder, By, until } = require('selenium-webdriver');");
    code.push("");
    code.push("async function runTest() {");
    code.push("  const driver = await new Builder().forBrowser('chrome').build();");
    code.push("");
    code.push("  try {");
    
    for (const step of steps) {
      if (step.name && step.steps) {
        code.push(`    // ${step.name}`);
        for (const scenarioStep of step.steps) {
          code.push(`    ${this.stepToSeleniumCode(scenarioStep)}`);
        }
        code.push("");
      } else {
        code.push(`    ${this.stepToSeleniumCode(step)}`);
      }
    }
    
    code.push("  } finally {");
    code.push("    await driver.quit();");
    code.push("  }");
    code.push("}");
    code.push("");
    code.push("runTest();");
    
    return code.join('\n');
  }

  stepToSeleniumCode(step) {
    switch (step.type) {
      case 'navigate':
        return `await driver.get('${step.url}');`;
      
      case 'click':
        return `await driver.findElement(By.css('${step.target}')).click();`;
      
      case 'type':
        return `await driver.findElement(By.css('${step.target}')).sendKeys('${step.text}');`;
      
      case 'assert':
        return `const text = await driver.findElement(By.css('${step.target}')).getText();\n    assert(text.includes('${step.expected}'));`;
      
      case 'wait':
        return `await driver.sleep(${step.duration});`;
      
      case 'screenshot':
        return `await driver.takeScreenshot().then(data => fs.writeFileSync('${step.name}.png', data, 'base64'));`;
      
      default:
        return `// TODO: ${step.originalText || step.type}`;
    }
  }
}

module.exports = NaturalLanguageTestManager; 