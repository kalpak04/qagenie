module.exports = {
  manifest: require('./plugin.json'),

  async initialize(api) {
    api.utils.logger.log('Accessibility Testing Plugin initialized');
    
    // Register custom test actions
    api.test.registerAction('checkA11y', this.checkAccessibility);
    api.test.registerAssertion('meetsWCAG', this.assertWCAGCompliance);
    
    // Register UI component for results
    api.ui.registerComponent('A11yReport', {
      type: 'report',
      title: 'Accessibility Report'
    });
  },

  async beforeTestRun(context, api) {
    api.utils.logger.log('Setting up accessibility checks');
    
    // Inject axe-core for accessibility testing
    context.axeScript = `
      <script src="https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.0/axe.min.js"></script>
    `;
    
    return context;
  },

  async afterTestStep(stepResult, api) {
    if (stepResult.type === 'navigate' || stepResult.type === 'click') {
      // Run accessibility check after navigation or interaction
      const a11yResults = await this.runAccessibilityCheck(stepResult.page);
      
      if (a11yResults.violations.length > 0) {
        api.ui.showNotification(
          `Found ${a11yResults.violations.length} accessibility violations`,
          'warning'
        );
        
        // Store results
        await api.storage.set(`a11y_${stepResult.step}`, a11yResults);
      }
    }
    
    return stepResult;
  },

  async checkAccessibility(page, options = {}) {
    const results = await page.evaluate((options) => {
      return new Promise((resolve) => {
        if (window.axe) {
          window.axe.run(options).then(results => resolve(results));
        } else {
          resolve({ violations: [], passes: [] });
        }
      });
    }, options);
    
    return this.processA11yResults(results);
  },

  async assertWCAGCompliance(page, level = 'AA') {
    const results = await this.checkAccessibility(page, {
      runOnly: {
        type: 'tag',
        values: [`wcag2${level.toLowerCase()}`]
      }
    });
    
    if (results.violations.length > 0) {
      const violationSummary = results.violations
        .map(v => `${v.id}: ${v.description}`)
        .join('\n');
      
      throw new Error(
        `Page does not meet WCAG ${level} standards:\n${violationSummary}`
      );
    }
    
    return true;
  },

  async runAccessibilityCheck(page) {
    try {
      // Inject axe-core if not already present
      await page.evaluate(() => {
        if (!window.axe) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.0/axe.min.js';
          document.head.appendChild(script);
          
          return new Promise(resolve => {
            script.onload = resolve;
          });
        }
      });
      
      // Wait a bit for script to load
      await page.waitForTimeout(1000);
      
      // Run accessibility check
      const results = await page.evaluate(() => {
        return window.axe.run();
      });
      
      return this.processA11yResults(results);
    } catch (error) {
      console.error('Accessibility check failed:', error);
      return { violations: [], passes: [] };
    }
  },

  processA11yResults(results) {
    const processed = {
      violations: [],
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length
    };
    
    // Process violations
    results.violations.forEach(violation => {
      processed.violations.push({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map(node => ({
          html: node.html,
          target: node.target,
          failureSummary: node.failureSummary
        }))
      });
    });
    
    // Calculate severity score
    processed.severityScore = this.calculateSeverityScore(processed.violations);
    
    return processed;
  },

  calculateSeverityScore(violations) {
    const impactScores = {
      critical: 10,
      serious: 7,
      moderate: 4,
      minor: 1
    };
    
    let totalScore = 0;
    
    violations.forEach(violation => {
      const score = impactScores[violation.impact] || 0;
      totalScore += score * violation.nodes.length;
    });
    
    return totalScore;
  },

  async cleanup(api) {
    api.utils.logger.log('Accessibility Testing Plugin cleanup');
    
    // Generate final report
    const allResults = [];
    const keys = await api.storage.keys();
    
    for (const key of keys) {
      if (key.startsWith('a11y_')) {
        const results = await api.storage.get(key);
        allResults.push(results);
      }
    }
    
    if (allResults.length > 0) {
      const report = this.generateA11yReport(allResults);
      api.events.emit('report:generated', report);
    }
  },

  generateA11yReport(allResults) {
    const report = {
      type: 'accessibility',
      timestamp: new Date().toISOString(),
      summary: {
        totalChecks: allResults.length,
        totalViolations: 0,
        criticalViolations: 0,
        seriousViolations: 0,
        moderateViolations: 0,
        minorViolations: 0
      },
      violations: [],
      recommendations: []
    };
    
    // Aggregate violations
    const violationMap = new Map();
    
    allResults.forEach(result => {
      result.violations.forEach(violation => {
        if (!violationMap.has(violation.id)) {
          violationMap.set(violation.id, {
            ...violation,
            occurrences: 0,
            pages: []
          });
        }
        
        const v = violationMap.get(violation.id);
        v.occurrences++;
        v.pages.push(result.page || 'unknown');
        
        // Update summary counts
        report.summary.totalViolations++;
        report.summary[`${violation.impact}Violations`]++;
      });
    });
    
    report.violations = Array.from(violationMap.values());
    
    // Generate recommendations
    report.recommendations = this.generateRecommendations(report.violations);
    
    return report;
  },

  generateRecommendations(violations) {
    const recommendations = [];
    
    // Sort by severity and frequency
    const prioritized = violations.sort((a, b) => {
      const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
      const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
      
      if (impactDiff !== 0) return impactDiff;
      return b.occurrences - a.occurrences;
    });
    
    // Top recommendations
    prioritized.slice(0, 5).forEach(violation => {
      recommendations.push({
        priority: violation.impact === 'critical' ? 'urgent' : 'high',
        issue: violation.id,
        description: violation.description,
        help: violation.help,
        occurrences: violation.occurrences,
        fixGuide: violation.helpUrl
      });
    });
    
    // General recommendations
    if (violations.some(v => v.id.includes('color-contrast'))) {
      recommendations.push({
        priority: 'medium',
        issue: 'color-contrast',
        description: 'Review color contrast across the application',
        help: 'Ensure text has sufficient contrast against backgrounds'
      });
    }
    
    if (violations.some(v => v.id.includes('label'))) {
      recommendations.push({
        priority: 'medium',
        issue: 'form-labels',
        description: 'Ensure all form inputs have proper labels',
        help: 'Use label elements or aria-label attributes'
      });
    }
    
    return recommendations;
  }
}; 