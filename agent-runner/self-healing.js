const { Page } = require('playwright');
const axios = require('axios');

class SelfHealingFramework {
  constructor(options = {}) {
    this.confidenceThreshold = options.confidenceThreshold || 0.8;
    this.aiServiceUrl = options.aiServiceUrl || 'http://localhost:8000';
    this.healingStrategies = [
      'findByText',
      'findByRole',
      'findByNearbyElement',
      'findByAttributes',
      'findByVisualSimilarity'
    ];
    this.healingHistory = [];
  }

  async findElement(page, selector, options = {}) {
    try {
      // Try original selector first
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        return { element, selector, healed: false };
      }
    } catch (error) {
      console.log(`Original selector failed: ${selector}`);
    }

    // If original selector fails, try healing
    return await this.healElement(page, selector, options);
  }

  async healElement(page, originalSelector, options = {}) {
    const context = await this.capturePageContext(page);
    
    for (const strategy of this.healingStrategies) {
      const result = await this[strategy](page, originalSelector, context, options);
      
      if (result.found) {
        const confidence = await this.calculateConfidence(
          page,
          originalSelector,
          result.selector,
          context
        );
        
        if (confidence >= this.confidenceThreshold) {
          // Record healing for learning
          this.recordHealing({
            originalSelector,
            newSelector: result.selector,
            strategy,
            confidence,
            context: context.url,
            timestamp: new Date().toISOString()
          });
          
          return {
            element: result.element,
            selector: result.selector,
            healed: true,
            strategy,
            confidence
          };
        }
      }
    }
    
    throw new Error(`Unable to heal selector: ${originalSelector}`);
  }

  async capturePageContext(page) {
    return {
      url: page.url(),
      title: await page.title(),
      html: await page.content(),
      screenshot: await page.screenshot({ fullPage: true })
    };
  }

  async findByText(page, originalSelector, context, options) {
    // Extract text from original selector if possible
    const textMatch = originalSelector.match(/text=["'](.+?)["']/);
    
    if (textMatch) {
      const text = textMatch[1];
      const elements = await page.locator(`text="${text}"`).all();
      
      if (elements.length === 1) {
        return {
          found: true,
          element: elements[0],
          selector: `text="${text}"`
        };
      }
      
      // Try partial text match
      const partialElements = await page.locator(`text=/${text}/i`).all();
      if (partialElements.length === 1) {
        return {
          found: true,
          element: partialElements[0],
          selector: `text=/${text}/i`
        };
      }
    }
    
    return { found: false };
  }

  async findByRole(page, originalSelector, context, options) {
    // Try to identify element by ARIA role
    const roleTypes = ['button', 'link', 'textbox', 'checkbox', 'radio'];
    
    for (const role of roleTypes) {
      const elements = await page.locator(`role=${role}`).all();
      
      for (const element of elements) {
        const text = await element.textContent();
        if (originalSelector.includes(text) || text.includes(originalSelector)) {
          return {
            found: true,
            element,
            selector: `role=${role}:has-text("${text}")`
          };
        }
      }
    }
    
    return { found: false };
  }

  async findByNearbyElement(page, originalSelector, context, options) {
    // Find element by its relation to stable elements
    const stableElements = await page.locator('[id], [data-testid]').all();
    
    for (const stable of stableElements) {
      const stableId = await stable.getAttribute('id') || await stable.getAttribute('data-testid');
      
      // Check elements near the stable element
      const nearbySelectors = [
        `[id="${stableId}"] + *`,
        `[id="${stableId}"] ~ *`,
        `[id="${stableId}"] >> *`,
        `* >> [id="${stableId}"]`
      ];
      
      for (const nearbySelector of nearbySelectors) {
        try {
          const element = await page.locator(nearbySelector).first();
          if (await element.isVisible()) {
            const elementText = await element.textContent();
            if (this.isSimilarElement(originalSelector, elementText)) {
              return {
                found: true,
                element,
                selector: nearbySelector
              };
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return { found: false };
  }

  async findByAttributes(page, originalSelector, context, options) {
    // Extract attributes from original selector
    const attributeMatch = originalSelector.match(/\[([^=]+)=["']([^"']+)["']\]/g);
    
    if (attributeMatch) {
      // Try different attribute combinations
      const attributes = [];
      for (const match of attributeMatch) {
        const [, attr, value] = match.match(/\[([^=]+)=["']([^"']+)["']\]/);
        attributes.push({ attr, value });
      }
      
      // Try partial attribute matches
      for (const { attr, value } of attributes) {
        const elements = await page.locator(`[${attr}*="${value}"]`).all();
        if (elements.length === 1) {
          return {
            found: true,
            element: elements[0],
            selector: `[${attr}*="${value}"]`
          };
        }
      }
    }
    
    return { found: false };
  }

  async findByVisualSimilarity(page, originalSelector, context, options) {
    // Use AI to find visually similar elements
    try {
      const response = await axios.post(`${this.aiServiceUrl}/analyze/visual-similarity`, {
        selector: originalSelector,
        screenshot: context.screenshot,
        html: context.html
      });
      
      if (response.data.found) {
        const element = await page.locator(response.data.selector).first();
        return {
          found: true,
          element,
          selector: response.data.selector
        };
      }
    } catch (error) {
      console.error('Visual similarity check failed:', error);
    }
    
    return { found: false };
  }

  async calculateConfidence(page, originalSelector, newSelector, context) {
    // Calculate confidence score for the healed selector
    let score = 0;
    
    // Check if element is unique
    const elements = await page.locator(newSelector).all();
    if (elements.length === 1) {
      score += 0.3;
    }
    
    // Check if element has similar properties
    try {
      const element = await page.locator(newSelector).first();
      const tagName = await element.evaluate(el => el.tagName);
      
      if (originalSelector.toLowerCase().includes(tagName.toLowerCase())) {
        score += 0.2;
      }
      
      // Check text similarity
      const text = await element.textContent();
      if (text && originalSelector.includes(text)) {
        score += 0.3;
      }
      
      // Check visibility
      if (await element.isVisible()) {
        score += 0.2;
      }
    } catch (error) {
      // Element not found
    }
    
    return Math.min(score, 1.0);
  }

  isSimilarElement(selector, text) {
    // Simple similarity check
    const selectorLower = selector.toLowerCase();
    const textLower = (text || '').toLowerCase();
    
    return selectorLower.includes(textLower) || textLower.includes(selectorLower);
  }

  recordHealing(healingData) {
    this.healingHistory.push(healingData);
    
    // Send to AI service for learning
    axios.post(`${this.aiServiceUrl}/learn/healing`, healingData)
      .catch(error => console.error('Failed to record healing:', error));
  }

  async autoFixTest(testCode, failureInfo) {
    // Analyze test failure and suggest fixes
    try {
      const response = await axios.post(`${this.aiServiceUrl}/analyze/test-failure`, {
        testCode,
        failureInfo,
        healingHistory: this.healingHistory
      });
      
      return {
        fixedCode: response.data.fixedCode,
        confidence: response.data.confidence,
        changes: response.data.changes,
        suggestions: response.data.suggestions
      };
    } catch (error) {
      console.error('Auto-fix failed:', error);
      
      // Fallback to simple fixes
      return this.simpleAutoFix(testCode, failureInfo);
    }
  }

  simpleAutoFix(testCode, failureInfo) {
    const fixes = [];
    
    // Replace failed selectors with healed ones
    for (const healing of this.healingHistory) {
      if (testCode.includes(healing.originalSelector)) {
        testCode = testCode.replace(
          healing.originalSelector,
          healing.newSelector
        );
        
        fixes.push({
          type: 'selector_update',
          original: healing.originalSelector,
          new: healing.newSelector,
          confidence: healing.confidence
        });
      }
    }
    
    return {
      fixedCode: testCode,
      confidence: fixes.length > 0 ? 0.7 : 0,
      changes: fixes,
      suggestions: [
        'Review the auto-fixed selectors',
        'Consider adding data-testid attributes for stability'
      ]
    };
  }

  async generateReport() {
    return {
      totalHealings: this.healingHistory.length,
      healingsByStrategy: this.healingHistory.reduce((acc, h) => {
        acc[h.strategy] = (acc[h.strategy] || 0) + 1;
        return acc;
      }, {}),
      averageConfidence: this.healingHistory.reduce((sum, h) => sum + h.confidence, 0) / this.healingHistory.length,
      mostHealedSelectors: this.getMostHealedSelectors(),
      recommendations: this.generateRecommendations()
    };
  }

  getMostHealedSelectors() {
    const selectorCount = {};
    
    for (const healing of this.healingHistory) {
      selectorCount[healing.originalSelector] = (selectorCount[healing.originalSelector] || 0) + 1;
    }
    
    return Object.entries(selectorCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([selector, count]) => ({ selector, count }));
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check for frequently healed selectors
    const mostHealed = this.getMostHealedSelectors();
    if (mostHealed.length > 0) {
      recommendations.push({
        type: 'stability',
        message: `Consider adding stable identifiers to frequently healed elements`,
        selectors: mostHealed.slice(0, 5)
      });
    }
    
    // Check healing strategies
    const strategies = this.healingHistory.map(h => h.strategy);
    const mostUsedStrategy = this.mode(strategies);
    
    if (mostUsedStrategy === 'findByVisualSimilarity') {
      recommendations.push({
        type: 'performance',
        message: 'Visual similarity healing is slow. Add semantic selectors for better performance.'
      });
    }
    
    return recommendations;
  }

  mode(array) {
    const frequency = {};
    let maxFreq = 0;
    let mode;
    
    for (const item of array) {
      frequency[item] = (frequency[item] || 0) + 1;
      if (frequency[item] > maxFreq) {
        maxFreq = frequency[item];
        mode = item;
      }
    }
    
    return mode;
  }
}

module.exports = SelfHealingFramework; 