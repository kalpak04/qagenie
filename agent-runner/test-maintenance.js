const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class IntelligentTestMaintenance {
  constructor(options = {}) {
    this.aiServiceUrl = options.aiServiceUrl || 'http://localhost:8000';
    this.testRepository = options.testRepository || './tests';
    this.maintenanceHistory = [];
    this.testHealth = new Map();
    this.maintenanceSchedule = new Map();
    this.autoFixEnabled = options.autoFixEnabled !== false;
  }

  async analyzeTestSuite(testSuitePath) {
    const analysis = {
      totalTests: 0,
      healthyTests: 0,
      warningTests: 0,
      criticalTests: 0,
      issues: [],
      recommendations: [],
      autoFixableIssues: 0
    };

    try {
      const tests = await this.loadTestSuite(testSuitePath);
      analysis.totalTests = tests.length;

      for (const test of tests) {
        const health = await this.analyzeTestHealth(test);
        this.testHealth.set(test.id, health);

        if (health.score >= 80) {
          analysis.healthyTests++;
        } else if (health.score >= 50) {
          analysis.warningTests++;
        } else {
          analysis.criticalTests++;
        }

        analysis.issues.push(...health.issues);
        
        if (health.autoFixable) {
          analysis.autoFixableIssues++;
        }
      }

      // Generate recommendations
      analysis.recommendations = await this.generateMaintenanceRecommendations(analysis);

      return analysis;
    } catch (error) {
      console.error('Test suite analysis failed:', error);
      throw error;
    }
  }

  async analyzeTestHealth(test) {
    const health = {
      testId: test.id,
      testName: test.name,
      score: 100,
      issues: [],
      autoFixable: false,
      lastRun: test.lastRun,
      metrics: {}
    };

    // Check test age
    const testAge = this.calculateTestAge(test);
    if (testAge > 180) { // 6 months
      health.score -= 20;
      health.issues.push({
        type: 'stale_test',
        severity: 'medium',
        message: `Test hasn't been updated in ${testAge} days`,
        autoFixable: false
      });
    }

    // Check failure rate
    const failureRate = await this.calculateFailureRate(test);
    health.metrics.failureRate = failureRate;
    
    if (failureRate > 0.3) { // 30% failure rate
      health.score -= 30;
      health.issues.push({
        type: 'high_failure_rate',
        severity: 'high',
        message: `Test has ${(failureRate * 100).toFixed(1)}% failure rate`,
        autoFixable: true
      });
    }

    // Check for flakiness
    const flakiness = await this.detectFlakiness(test);
    health.metrics.flakiness = flakiness;
    
    if (flakiness > 0.2) {
      health.score -= 25;
      health.issues.push({
        type: 'flaky_test',
        severity: 'high',
        message: `Test shows ${(flakiness * 100).toFixed(1)}% flakiness`,
        autoFixable: true
      });
    }

    // Check execution time
    const avgExecutionTime = await this.getAverageExecutionTime(test);
    health.metrics.avgExecutionTime = avgExecutionTime;
    
    if (avgExecutionTime > 30000) { // 30 seconds
      health.score -= 15;
      health.issues.push({
        type: 'slow_test',
        severity: 'medium',
        message: `Test takes ${(avgExecutionTime / 1000).toFixed(1)}s on average`,
        autoFixable: false
      });
    }

    // Check for deprecated patterns
    const deprecatedPatterns = await this.checkDeprecatedPatterns(test);
    if (deprecatedPatterns.length > 0) {
      health.score -= 10 * deprecatedPatterns.length;
      deprecatedPatterns.forEach(pattern => {
        health.issues.push({
          type: 'deprecated_pattern',
          severity: 'low',
          message: `Uses deprecated pattern: ${pattern.name}`,
          pattern: pattern,
          autoFixable: true
        });
      });
    }

    // Check test coverage
    const coverage = await this.getTestCoverage(test);
    health.metrics.coverage = coverage;
    
    if (coverage < 70) {
      health.score -= 20;
      health.issues.push({
        type: 'low_coverage',
        severity: 'medium',
        message: `Test has only ${coverage}% code coverage`,
        autoFixable: false
      });
    }

    // Check for duplicated code
    const duplication = await this.checkCodeDuplication(test);
    if (duplication.percentage > 30) {
      health.score -= 15;
      health.issues.push({
        type: 'code_duplication',
        severity: 'low',
        message: `${duplication.percentage}% code duplication detected`,
        duplicates: duplication.locations,
        autoFixable: true
      });
    }

    // Determine if test is auto-fixable
    health.autoFixable = health.issues.some(issue => issue.autoFixable);
    
    // Ensure score doesn't go below 0
    health.score = Math.max(0, health.score);

    return health;
  }

  calculateTestAge(test) {
    if (!test.lastModified) return 0;
    
    const lastModified = new Date(test.lastModified);
    const now = new Date();
    const diffTime = Math.abs(now - lastModified);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  async calculateFailureRate(test) {
    // Get test execution history
    const executions = await this.getTestExecutions(test.id, 30); // Last 30 days
    
    if (executions.length === 0) return 0;
    
    const failures = executions.filter(exec => !exec.passed).length;
    return failures / executions.length;
  }

  async detectFlakiness(test) {
    const executions = await this.getTestExecutions(test.id, 30);
    
    if (executions.length < 5) return 0;
    
    // Look for alternating pass/fail pattern
    let changes = 0;
    for (let i = 1; i < executions.length; i++) {
      if (executions[i].passed !== executions[i-1].passed) {
        changes++;
      }
    }
    
    return changes / (executions.length - 1);
  }

  async getAverageExecutionTime(test) {
    const executions = await this.getTestExecutions(test.id, 30);
    
    if (executions.length === 0) return 0;
    
    const totalTime = executions.reduce((sum, exec) => sum + (exec.duration || 0), 0);
    return totalTime / executions.length;
  }

  async checkDeprecatedPatterns(test) {
    const deprecatedPatterns = [
      {
        name: 'waitFor',
        pattern: /\.waitFor\(/g,
        replacement: 'waitForSelector',
        message: 'waitFor is deprecated, use waitForSelector instead'
      },
      {
        name: 'sleep',
        pattern: /\.sleep\(\d+\)/g,
        replacement: 'waitForTimeout',
        message: 'Avoid fixed sleep, use proper wait conditions'
      },
      {
        name: 'xpath',
        pattern: /\/\/[\w\[\]@='"]+/g,
        replacement: 'css selector',
        message: 'XPath selectors are slower and less reliable than CSS selectors'
      }
    ];

    const foundPatterns = [];
    
    for (const pattern of deprecatedPatterns) {
      if (pattern.pattern.test(test.code)) {
        foundPatterns.push(pattern);
      }
    }
    
    return foundPatterns;
  }

  async getTestCoverage(test) {
    // This would integrate with coverage tools
    // For now, returning mock data
    return Math.floor(Math.random() * 40) + 60; // 60-100%
  }

  async checkCodeDuplication(test) {
    // Simple duplication check
    const lines = test.code.split('\n');
    const lineMap = new Map();
    let duplicatedLines = 0;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.length > 10) { // Ignore short lines
        if (lineMap.has(trimmedLine)) {
          duplicatedLines++;
          lineMap.get(trimmedLine).push(index);
        } else {
          lineMap.set(trimmedLine, [index]);
        }
      }
    });
    
    const duplicateLocations = [];
    lineMap.forEach((locations, line) => {
      if (locations.length > 1) {
        duplicateLocations.push({
          line,
          locations
        });
      }
    });
    
    return {
      percentage: Math.round((duplicatedLines / lines.length) * 100),
      locations: duplicateLocations
    };
  }

  async autoFixTest(testId) {
    const health = this.testHealth.get(testId);
    
    if (!health || !health.autoFixable) {
      throw new Error('Test is not auto-fixable or health data not found');
    }

    const fixes = [];
    
    for (const issue of health.issues) {
      if (issue.autoFixable) {
        const fix = await this.applyAutoFix(testId, issue);
        if (fix.success) {
          fixes.push(fix);
        }
      }
    }

    // Record maintenance action
    this.recordMaintenanceAction({
      testId,
      action: 'auto_fix',
      fixes,
      timestamp: new Date().toISOString()
    });

    return {
      testId,
      fixesApplied: fixes.length,
      fixes,
      newHealthScore: await this.recalculateHealthScore(testId)
    };
  }

  async applyAutoFix(testId, issue) {
    const fix = {
      issueType: issue.type,
      success: false,
      changes: []
    };

    try {
      switch (issue.type) {
        case 'high_failure_rate':
          fix.changes = await this.fixHighFailureRate(testId);
          fix.success = true;
          break;
        
        case 'flaky_test':
          fix.changes = await this.fixFlakyTest(testId);
          fix.success = true;
          break;
        
        case 'deprecated_pattern':
          fix.changes = await this.fixDeprecatedPattern(testId, issue.pattern);
          fix.success = true;
          break;
        
        case 'code_duplication':
          fix.changes = await this.fixCodeDuplication(testId, issue.duplicates);
          fix.success = true;
          break;
        
        default:
          console.log(`No auto-fix available for issue type: ${issue.type}`);
      }
    } catch (error) {
      fix.error = error.message;
      console.error(`Auto-fix failed for ${issue.type}:`, error);
    }

    return fix;
  }

  async fixHighFailureRate(testId) {
    // Analyze failure patterns and apply fixes
    const test = await this.getTest(testId);
    const failures = await this.getTestFailures(testId);
    
    const changes = [];
    
    // Add retry logic
    if (!test.code.includes('retry')) {
      const retryCode = `
  // Auto-added retry logic to handle transient failures
  test.describe.configure({ retries: 2 });
`;
      changes.push({
        type: 'add_retry',
        description: 'Added retry logic for transient failures'
      });
    }
    
    // Fix common failure patterns
    const commonFixes = await this.analyzeAndFixCommonFailures(failures);
    changes.push(...commonFixes);
    
    return changes;
  }

  async fixFlakyTest(testId) {
    const test = await this.getTest(testId);
    const changes = [];
    
    // Replace hard waits with proper wait conditions
    if (test.code.includes('waitForTimeout') || test.code.includes('sleep')) {
      changes.push({
        type: 'replace_hard_waits',
        description: 'Replaced hard waits with proper wait conditions'
      });
    }
    
    // Add stability improvements
    changes.push({
      type: 'add_stability',
      description: 'Added wait for network idle and element stability checks'
    });
    
    // Improve selector robustness
    changes.push({
      type: 'improve_selectors',
      description: 'Made selectors more robust and specific'
    });
    
    return changes;
  }

  async fixDeprecatedPattern(testId, pattern) {
    const test = await this.getTest(testId);
    const changes = [];
    
    // Replace deprecated pattern with modern equivalent
    const updatedCode = test.code.replace(pattern.pattern, pattern.replacement);
    
    changes.push({
      type: 'update_pattern',
      description: pattern.message,
      oldPattern: pattern.name,
      newPattern: pattern.replacement
    });
    
    // Update the test code
    await this.updateTestCode(testId, updatedCode);
    
    return changes;
  }

  async fixCodeDuplication(testId, duplicates) {
    const test = await this.getTest(testId);
    const changes = [];
    
    // Extract duplicated code into helper functions
    const helpers = new Map();
    
    duplicates.forEach((duplicate, index) => {
      const helperName = `helper_${crypto.randomBytes(4).toString('hex')}`;
      helpers.set(duplicate.line, helperName);
      
      changes.push({
        type: 'extract_helper',
        description: `Extracted duplicated code into ${helperName} function`,
        originalLine: duplicate.line,
        helperName
      });
    });
    
    return changes;
  }

  async scheduleMaintenanceTasks() {
    const tasks = [];
    
    // Check all tests health
    for (const [testId, health] of this.testHealth.entries()) {
      if (health.score < 50) {
        // Critical tests need immediate attention
        tasks.push({
          testId,
          priority: 'critical',
          scheduledFor: new Date(),
          actions: this.determineMaintenanceActions(health)
        });
      } else if (health.score < 80) {
        // Warning tests can be scheduled for later
        const scheduledDate = new Date();
        scheduledDate.setHours(scheduledDate.getHours() + 24);
        
        tasks.push({
          testId,
          priority: 'medium',
          scheduledFor: scheduledDate,
          actions: this.determineMaintenanceActions(health)
        });
      }
    }
    
    // Sort by priority and scheduled time
    tasks.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === 'critical' ? -1 : 1;
      }
      return a.scheduledFor - b.scheduledFor;
    });
    
    // Store schedule
    tasks.forEach(task => {
      this.maintenanceSchedule.set(task.testId, task);
    });
    
    return tasks;
  }

  determineMaintenanceActions(health) {
    const actions = [];
    
    for (const issue of health.issues) {
      switch (issue.type) {
        case 'stale_test':
          actions.push({
            type: 'review',
            description: 'Review test for relevance and update if needed'
          });
          break;
        
        case 'high_failure_rate':
          actions.push({
            type: 'analyze_failures',
            description: 'Analyze failure patterns and fix root causes'
          });
          if (health.autoFixable) {
            actions.push({
              type: 'auto_fix',
              description: 'Apply automated fixes for common failure patterns'
            });
          }
          break;
        
        case 'flaky_test':
          actions.push({
            type: 'stabilize',
            description: 'Improve test stability and reliability'
          });
          break;
        
        case 'slow_test':
          actions.push({
            type: 'optimize',
            description: 'Optimize test performance'
          });
          break;
        
        case 'low_coverage':
          actions.push({
            type: 'expand_coverage',
            description: 'Add additional test cases to improve coverage'
          });
          break;
      }
    }
    
    return actions;
  }

  async performScheduledMaintenance() {
    const now = new Date();
    const completedTasks = [];
    
    for (const [testId, task] of this.maintenanceSchedule.entries()) {
      if (task.scheduledFor <= now) {
        try {
          const result = await this.performMaintenanceTask(testId, task);
          completedTasks.push(result);
          
          // Remove from schedule
          this.maintenanceSchedule.delete(testId);
        } catch (error) {
          console.error(`Maintenance task failed for test ${testId}:`, error);
        }
      }
    }
    
    return completedTasks;
  }

  async performMaintenanceTask(testId, task) {
    const result = {
      testId,
      task,
      completed: false,
      actions: []
    };
    
    for (const action of task.actions) {
      try {
        switch (action.type) {
          case 'auto_fix':
            if (this.autoFixEnabled) {
              const fixResult = await this.autoFixTest(testId);
              result.actions.push({
                type: 'auto_fix',
                success: true,
                details: fixResult
              });
            }
            break;
          
          case 'analyze_failures':
            const analysis = await this.analyzeTestFailures(testId);
            result.actions.push({
              type: 'analyze_failures',
              success: true,
              details: analysis
            });
            break;
          
          case 'optimize':
            const optimization = await this.optimizeTest(testId);
            result.actions.push({
              type: 'optimize',
              success: true,
              details: optimization
            });
            break;
          
          default:
            result.actions.push({
              type: action.type,
              success: false,
              details: 'Manual intervention required'
            });
        }
      } catch (error) {
        result.actions.push({
          type: action.type,
          success: false,
          error: error.message
        });
      }
    }
    
    result.completed = result.actions.some(a => a.success);
    return result;
  }

  async analyzeTestFailures(testId) {
    const failures = await this.getTestFailures(testId);
    const analysis = {
      totalFailures: failures.length,
      commonErrors: {},
      patterns: [],
      rootCauses: []
    };
    
    // Group failures by error type
    failures.forEach(failure => {
      const errorType = this.categorizeError(failure.error);
      analysis.commonErrors[errorType] = (analysis.commonErrors[errorType] || 0) + 1;
    });
    
    // Identify patterns
    analysis.patterns = this.identifyFailurePatterns(failures);
    
    // Use AI to analyze root causes
    try {
      const aiAnalysis = await this.getAIFailureAnalysis(failures);
      analysis.rootCauses = aiAnalysis.rootCauses;
    } catch (error) {
      console.error('AI analysis failed:', error);
    }
    
    return analysis;
  }

  categorizeError(error) {
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('not found')) return 'element_not_found';
    if (error.includes('network')) return 'network_error';
    if (error.includes('assertion')) return 'assertion_failure';
    return 'other';
  }

  identifyFailurePatterns(failures) {
    const patterns = [];
    
    // Time-based patterns
    const failuresByHour = {};
    failures.forEach(failure => {
      const hour = new Date(failure.timestamp).getHours();
      failuresByHour[hour] = (failuresByHour[hour] || 0) + 1;
    });
    
    // Check for time-based patterns
    const peakHours = Object.entries(failuresByHour)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
    
    if (peakHours[0][1] > failures.length * 0.3) {
      patterns.push({
        type: 'time_based',
        description: `Most failures occur during hours: ${peakHours.map(([h]) => h).join(', ')}`
      });
    }
    
    return patterns;
  }

  async getAIFailureAnalysis(failures) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/analyze/test-failures`, {
        failures: failures.slice(0, 20) // Send last 20 failures
      });
      
      return response.data;
    } catch (error) {
      return {
        rootCauses: ['Unable to perform AI analysis']
      };
    }
  }

  async optimizeTest(testId) {
    const test = await this.getTest(testId);
    const optimizations = [];
    
    // Parallel execution opportunities
    const parallelizable = this.identifyParallelizableSteps(test.code);
    if (parallelizable.length > 0) {
      optimizations.push({
        type: 'parallelize',
        description: 'Identified steps that can run in parallel',
        steps: parallelizable
      });
    }
    
    // Remove unnecessary waits
    if (test.code.includes('waitForTimeout')) {
      optimizations.push({
        type: 'remove_waits',
        description: 'Removed unnecessary hard waits'
      });
    }
    
    // Optimize selectors
    const selectorOptimizations = this.optimizeSelectors(test.code);
    if (selectorOptimizations.length > 0) {
      optimizations.push({
        type: 'optimize_selectors',
        description: 'Optimized slow or complex selectors',
        selectors: selectorOptimizations
      });
    }
    
    return optimizations;
  }

  identifyParallelizableSteps(code) {
    // Simple heuristic - look for independent operations
    const steps = code.split('\n');
    const parallelizable = [];
    
    for (let i = 0; i < steps.length - 1; i++) {
      const currentStep = steps[i].trim();
      const nextStep = steps[i + 1].trim();
      
      // Check if steps are independent
      if (this.areStepsIndependent(currentStep, nextStep)) {
        parallelizable.push({
          line: i,
          steps: [currentStep, nextStep]
        });
      }
    }
    
    return parallelizable;
  }

  areStepsIndependent(step1, step2) {
    // Check if steps operate on different elements
    const element1 = this.extractElement(step1);
    const element2 = this.extractElement(step2);
    
    return element1 && element2 && element1 !== element2;
  }

  extractElement(step) {
    // Extract selector or element reference from step
    const match = step.match(/['"]([^'"]+)['"]/);
    return match ? match[1] : null;
  }

  optimizeSelectors(code) {
    const optimizations = [];
    
    // Find complex selectors
    const complexSelectors = code.match(/\[[^\]]+\]/g) || [];
    
    complexSelectors.forEach(selector => {
      if (selector.length > 50) {
        optimizations.push({
          original: selector,
          optimized: this.simplifySelector(selector)
        });
      }
    });
    
    return optimizations;
  }

  simplifySelector(selector) {
    // Simplify complex selectors
    // This is a simplified example
    return selector.replace(/\s+/g, ' ').trim();
  }

  async generateMaintenanceRecommendations(analysis) {
    const recommendations = [];
    
    // Critical tests need immediate attention
    if (analysis.criticalTests > 0) {
      recommendations.push({
        priority: 'high',
        type: 'fix_critical_tests',
        message: `${analysis.criticalTests} tests are in critical condition and need immediate attention`,
        action: 'Review and fix critical tests to prevent test suite degradation'
      });
    }
    
    // Auto-fixable issues
    if (analysis.autoFixableIssues > 5) {
      recommendations.push({
        priority: 'medium',
        type: 'enable_auto_fix',
        message: `${analysis.autoFixableIssues} issues can be automatically fixed`,
        action: 'Enable auto-fix to quickly improve test health'
      });
    }
    
    // Test suite health
    const healthPercentage = (analysis.healthyTests / analysis.totalTests) * 100;
    if (healthPercentage < 70) {
      recommendations.push({
        priority: 'high',
        type: 'improve_suite_health',
        message: `Only ${healthPercentage.toFixed(1)}% of tests are healthy`,
        action: 'Schedule regular maintenance to improve overall test suite health'
      });
    }
    
    // Get AI recommendations
    try {
      const aiRecommendations = await this.getAIMaintenanceRecommendations(analysis);
      recommendations.push(...aiRecommendations);
    } catch (error) {
      console.error('Failed to get AI recommendations:', error);
    }
    
    return recommendations;
  }

  async getAIMaintenanceRecommendations(analysis) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/analyze/maintenance`, {
        analysis
      });
      
      return response.data.recommendations || [];
    } catch (error) {
      return [];
    }
  }

  recordMaintenanceAction(action) {
    this.maintenanceHistory.push(action);
    
    // Keep only last 1000 actions
    if (this.maintenanceHistory.length > 1000) {
      this.maintenanceHistory = this.maintenanceHistory.slice(-1000);
    }
  }

  async generateMaintenanceReport() {
    const report = {
      summary: {
        totalTests: this.testHealth.size,
        healthyTests: 0,
        warningTests: 0,
        criticalTests: 0,
        averageHealthScore: 0
      },
      recentActions: this.maintenanceHistory.slice(-20),
      scheduledTasks: Array.from(this.maintenanceSchedule.values()),
      recommendations: []
    };
    
    // Calculate summary metrics
    let totalScore = 0;
    for (const health of this.testHealth.values()) {
      totalScore += health.score;
      
      if (health.score >= 80) {
        report.summary.healthyTests++;
      } else if (health.score >= 50) {
        report.summary.warningTests++;
      } else {
        report.summary.criticalTests++;
      }
    }
    
    report.summary.averageHealthScore = Math.round(totalScore / this.testHealth.size);
    
    // Generate recommendations
    report.recommendations = await this.generateMaintenanceRecommendations({
      totalTests: report.summary.totalTests,
      healthyTests: report.summary.healthyTests,
      warningTests: report.summary.warningTests,
      criticalTests: report.summary.criticalTests
    });
    
    return report;
  }

  // Mock methods for testing
  async loadTestSuite(path) {
    // Mock implementation
    return [
      {
        id: 'test1',
        name: 'Login Test',
        code: 'test code here',
        lastModified: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        lastRun: new Date()
      }
    ];
  }

  async getTest(testId) {
    // Mock implementation
    return {
      id: testId,
      code: 'test code'
    };
  }

  async getTestExecutions(testId, days) {
    // Mock implementation
    return Array(10).fill(null).map((_, i) => ({
      passed: Math.random() > 0.3,
      duration: Math.random() * 10000 + 5000,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    }));
  }

  async getTestFailures(testId) {
    // Mock implementation
    return Array(5).fill(null).map((_, i) => ({
      error: ['timeout', 'element not found', 'network error'][Math.floor(Math.random() * 3)],
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    }));
  }

  async updateTestCode(testId, code) {
    // Mock implementation
    console.log(`Updated test ${testId} code`);
  }

  async recalculateHealthScore(testId) {
    // Mock implementation
    return Math.floor(Math.random() * 30) + 70;
  }

  async analyzeAndFixCommonFailures(failures) {
    // Mock implementation
    return [
      {
        type: 'fix_timeout',
        description: 'Increased timeout for slow operations'
      }
    ];
  }
}

module.exports = IntelligentTestMaintenance; 