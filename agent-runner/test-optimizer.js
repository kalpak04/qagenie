const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class IntelligentTestOptimizer {
  constructor(options = {}) {
    this.aiServiceUrl = options.aiServiceUrl || 'http://localhost:8000';
    this.executionHistory = [];
    this.codeChangeHistory = [];
    this.riskModel = null;
    this.parallelizationStrategy = 'adaptive';
  }

  async analyzeCodeChanges(gitDiff) {
    // Parse git diff to understand what changed
    const changes = this.parseGitDiff(gitDiff);
    
    // Identify affected components
    const affectedComponents = await this.identifyAffectedComponents(changes);
    
    // Calculate risk score for each change
    const riskScores = await this.calculateRiskScores(changes, affectedComponents);
    
    // Store for learning
    this.codeChangeHistory.push({
      timestamp: new Date().toISOString(),
      changes,
      affectedComponents,
      riskScores
    });
    
    return {
      changes,
      affectedComponents,
      riskScores,
      highRiskAreas: riskScores.filter(r => r.score > 0.7)
    };
  }

  parseGitDiff(diff) {
    const changes = [];
    const lines = diff.split('\n');
    let currentFile = null;
    let additions = 0;
    let deletions = 0;
    
    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          changes.push({
            file: currentFile,
            additions,
            deletions,
            churn: additions + deletions
          });
        }
        
        currentFile = line.split(' b/')[1];
        additions = 0;
        deletions = 0;
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
    
    if (currentFile) {
      changes.push({
        file: currentFile,
        additions,
        deletions,
        churn: additions + deletions
      });
    }
    
    return changes;
  }

  async identifyAffectedComponents(changes) {
    const components = new Set();
    
    for (const change of changes) {
      // Extract component from file path
      const parts = change.file.split('/');
      
      // Look for common patterns
      if (parts.includes('components')) {
        const componentIndex = parts.indexOf('components');
        if (componentIndex < parts.length - 1) {
          components.add(parts[componentIndex + 1]);
        }
      }
      
      // Look for service/API changes
      if (parts.includes('services') || parts.includes('api')) {
        components.add('api');
      }
      
      // Look for model changes
      if (parts.includes('models') || parts.includes('schema')) {
        components.add('data-model');
      }
    }
    
    return Array.from(components);
  }

  async calculateRiskScores(changes, affectedComponents) {
    const riskScores = [];
    
    for (const change of changes) {
      let score = 0;
      
      // High churn = higher risk
      if (change.churn > 50) score += 0.3;
      else if (change.churn > 20) score += 0.2;
      else if (change.churn > 10) score += 0.1;
      
      // Critical files = higher risk
      if (change.file.includes('auth')) score += 0.3;
      if (change.file.includes('payment')) score += 0.4;
      if (change.file.includes('database')) score += 0.3;
      if (change.file.includes('config')) score += 0.2;
      
      // File type risk
      if (change.file.endsWith('.sql')) score += 0.3;
      if (change.file.endsWith('.migration')) score += 0.3;
      if (change.file.includes('security')) score += 0.4;
      
      // Historical failure rate
      const historicalFailureRate = await this.getHistoricalFailureRate(change.file);
      score += historicalFailureRate * 0.3;
      
      riskScores.push({
        file: change.file,
        score: Math.min(score, 1.0),
        factors: this.getRiskFactors(change, score)
      });
    }
    
    return riskScores;
  }

  async getHistoricalFailureRate(file) {
    // Check execution history for this file
    const relatedExecutions = this.executionHistory.filter(
      exec => exec.relatedFiles && exec.relatedFiles.includes(file)
    );
    
    if (relatedExecutions.length === 0) return 0;
    
    const failures = relatedExecutions.filter(exec => !exec.passed).length;
    return failures / relatedExecutions.length;
  }

  getRiskFactors(change, score) {
    const factors = [];
    
    if (change.churn > 50) factors.push('high_code_churn');
    if (change.file.includes('auth')) factors.push('authentication_component');
    if (change.file.includes('payment')) factors.push('payment_component');
    if (change.file.includes('database')) factors.push('database_changes');
    
    return factors;
  }

  async selectTestsToRun(allTests, codeChanges, timeConstraint = null) {
    // Analyze code changes
    const changeAnalysis = await this.analyzeCodeChanges(codeChanges);
    
    // Predict which tests are most likely to fail
    const testPredictions = await this.predictTestFailures(
      allTests,
      changeAnalysis
    );
    
    // Prioritize tests
    const prioritizedTests = this.prioritizeTests(
      testPredictions,
      changeAnalysis,
      timeConstraint
    );
    
    return {
      selectedTests: prioritizedTests.tests,
      estimatedDuration: prioritizedTests.estimatedDuration,
      coverage: prioritizedTests.coverage,
      riskCoverage: prioritizedTests.riskCoverage,
      reasoning: prioritizedTests.reasoning
    };
  }

  async predictTestFailures(tests, changeAnalysis) {
    const predictions = [];
    
    for (const test of tests) {
      let failureProbability = 0;
      
      // Check if test is related to changed components
      for (const component of changeAnalysis.affectedComponents) {
        if (test.name.toLowerCase().includes(component.toLowerCase()) ||
            test.file.toLowerCase().includes(component.toLowerCase())) {
          failureProbability += 0.3;
        }
      }
      
      // Check historical failure rate
      const historicalFailureRate = this.getTestHistoricalFailureRate(test.id);
      failureProbability += historicalFailureRate * 0.3;
      
      // Check if test covers high-risk areas
      for (const riskArea of changeAnalysis.highRiskAreas) {
        if (this.testCoversFile(test, riskArea.file)) {
          failureProbability += riskArea.score * 0.4;
        }
      }
      
      predictions.push({
        test,
        failureProbability: Math.min(failureProbability, 1.0),
        priority: this.calculateTestPriority(test, failureProbability, changeAnalysis)
      });
    }
    
    return predictions;
  }

  getTestHistoricalFailureRate(testId) {
    const executions = this.executionHistory.filter(exec => exec.testId === testId);
    if (executions.length === 0) return 0.1; // Default small probability
    
    const failures = executions.filter(exec => !exec.passed).length;
    return failures / executions.length;
  }

  testCoversFile(test, file) {
    // Simple heuristic - in real implementation, use code coverage data
    const testPath = test.file.toLowerCase();
    const filePath = file.toLowerCase();
    
    // Check if test name references the file
    if (test.name.toLowerCase().includes(path.basename(filePath, path.extname(filePath)))) {
      return true;
    }
    
    // Check if test is in similar directory structure
    const testDir = path.dirname(testPath);
    const fileDir = path.dirname(filePath);
    
    return testDir.includes(fileDir) || fileDir.includes(testDir);
  }

  calculateTestPriority(test, failureProbability, changeAnalysis) {
    let priority = failureProbability * 100;
    
    // Boost priority for critical tests
    if (test.tags && test.tags.includes('critical')) {
      priority += 20;
    }
    
    // Boost priority for tests covering high-risk areas
    if (changeAnalysis.highRiskAreas.length > 0) {
      priority += 10;
    }
    
    // Consider test execution time (prefer faster tests)
    if (test.averageDuration < 1000) { // Less than 1 second
      priority += 5;
    }
    
    return Math.min(priority, 100);
  }

  prioritizeTests(predictions, changeAnalysis, timeConstraint) {
    // Sort by priority
    const sortedTests = predictions.sort((a, b) => b.priority - a.priority);
    
    const selectedTests = [];
    let totalDuration = 0;
    const maxDuration = timeConstraint || Infinity;
    
    for (const prediction of sortedTests) {
      const testDuration = prediction.test.averageDuration || 5000; // Default 5s
      
      if (totalDuration + testDuration <= maxDuration) {
        selectedTests.push(prediction.test);
        totalDuration += testDuration;
      }
    }
    
    // Calculate coverage metrics
    const coverage = this.calculateCoverage(selectedTests, predictions);
    const riskCoverage = this.calculateRiskCoverage(
      selectedTests,
      changeAnalysis.highRiskAreas
    );
    
    return {
      tests: selectedTests,
      estimatedDuration: totalDuration,
      coverage,
      riskCoverage,
      reasoning: this.generateSelectionReasoning(
        selectedTests,
        predictions,
        changeAnalysis
      )
    };
  }

  calculateCoverage(selectedTests, allPredictions) {
    return (selectedTests.length / allPredictions.length) * 100;
  }

  calculateRiskCoverage(selectedTests, highRiskAreas) {
    if (highRiskAreas.length === 0) return 100;
    
    let coveredRiskAreas = 0;
    
    for (const riskArea of highRiskAreas) {
      if (selectedTests.some(test => this.testCoversFile(test, riskArea.file))) {
        coveredRiskAreas++;
      }
    }
    
    return (coveredRiskAreas / highRiskAreas.length) * 100;
  }

  generateSelectionReasoning(selectedTests, predictions, changeAnalysis) {
    const reasoning = [];
    
    reasoning.push(`Selected ${selectedTests.length} tests based on code changes`);
    
    if (changeAnalysis.highRiskAreas.length > 0) {
      reasoning.push(
        `Identified ${changeAnalysis.highRiskAreas.length} high-risk areas`
      );
    }
    
    const highPriorityTests = predictions.filter(p => p.priority > 80);
    if (highPriorityTests.length > 0) {
      reasoning.push(
        `${highPriorityTests.length} tests have high failure probability`
      );
    }
    
    return reasoning;
  }

  async optimizeParallelExecution(tests) {
    // Group tests by their characteristics
    const testGroups = this.groupTestsForParallelization(tests);
    
    // Determine optimal parallel strategy
    const strategy = await this.determineParallelStrategy(testGroups);
    
    return {
      strategy,
      groups: testGroups,
      estimatedSpeedup: this.calculateExpectedSpeedup(testGroups, strategy),
      recommendations: this.generateParallelizationRecommendations(testGroups)
    };
  }

  groupTestsForParallelization(tests) {
    const groups = {
      fast: [],
      medium: [],
      slow: [],
      database: [],
      api: [],
      ui: []
    };
    
    for (const test of tests) {
      // Group by execution time
      if (test.averageDuration < 1000) {
        groups.fast.push(test);
      } else if (test.averageDuration < 5000) {
        groups.medium.push(test);
      } else {
        groups.slow.push(test);
      }
      
      // Group by test type
      if (test.tags) {
        if (test.tags.includes('database')) groups.database.push(test);
        if (test.tags.includes('api')) groups.api.push(test);
        if (test.tags.includes('ui')) groups.ui.push(test);
      }
    }
    
    return groups;
  }

  async determineParallelStrategy(testGroups) {
    // Analyze system resources
    const cpuCount = require('os').cpus().length;
    
    // Calculate optimal worker count
    let workerCount = Math.min(cpuCount - 1, 4); // Leave one CPU free
    
    // Adjust based on test characteristics
    if (testGroups.database.length > 10) {
      // Database tests might conflict, reduce parallelism
      workerCount = Math.min(workerCount, 2);
    }
    
    return {
      workerCount,
      distribution: 'balanced',
      isolateDatabase: testGroups.database.length > 0,
      prioritizeFast: testGroups.fast.length > testGroups.slow.length
    };
  }

  calculateExpectedSpeedup(testGroups, strategy) {
    const totalTests = Object.values(testGroups).flat().length;
    const avgDuration = Object.values(testGroups)
      .flat()
      .reduce((sum, test) => sum + (test.averageDuration || 5000), 0) / totalTests;
    
    const sequentialTime = totalTests * avgDuration;
    const parallelTime = sequentialTime / strategy.workerCount;
    
    return {
      sequentialTime,
      parallelTime,
      speedup: sequentialTime / parallelTime,
      timeSaved: sequentialTime - parallelTime
    };
  }

  generateParallelizationRecommendations(testGroups) {
    const recommendations = [];
    
    if (testGroups.database.length > 20) {
      recommendations.push({
        type: 'database',
        message: 'Consider using database transactions or test containers for isolation'
      });
    }
    
    if (testGroups.slow.length > testGroups.fast.length) {
      recommendations.push({
        type: 'performance',
        message: 'Many slow tests detected. Consider optimizing test setup/teardown'
      });
    }
    
    if (testGroups.ui.length > 50) {
      recommendations.push({
        type: 'ui',
        message: 'Large number of UI tests. Consider visual regression testing for faster feedback'
      });
    }
    
    return recommendations;
  }

  async recordExecution(test, result, duration, relatedFiles = []) {
    this.executionHistory.push({
      testId: test.id,
      testName: test.name,
      passed: result.passed,
      duration,
      timestamp: new Date().toISOString(),
      relatedFiles,
      failureReason: result.passed ? null : result.error
    });
    
    // Keep only last 1000 executions
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-1000);
    }
    
    // Send to AI for learning
    axios.post(`${this.aiServiceUrl}/learn/test-execution`, {
      test,
      result,
      duration,
      relatedFiles
    }).catch(err => console.error('Failed to record execution:', err));
  }

  async generateOptimizationReport() {
    const report = {
      totalExecutions: this.executionHistory.length,
      averageFailureRate: this.calculateAverageFailureRate(),
      slowestTests: this.getSlowestTests(),
      flakyTests: this.identifyFlakyTests(),
      optimizationOpportunities: await this.identifyOptimizationOpportunities()
    };
    
    return report;
  }

  calculateAverageFailureRate() {
    if (this.executionHistory.length === 0) return 0;
    
    const failures = this.executionHistory.filter(exec => !exec.passed).length;
    return (failures / this.executionHistory.length) * 100;
  }

  getSlowestTests() {
    const testDurations = {};
    
    for (const exec of this.executionHistory) {
      if (!testDurations[exec.testId]) {
        testDurations[exec.testId] = {
          name: exec.testName,
          durations: []
        };
      }
      testDurations[exec.testId].durations.push(exec.duration);
    }
    
    return Object.entries(testDurations)
      .map(([id, data]) => ({
        id,
        name: data.name,
        averageDuration: data.durations.reduce((a, b) => a + b, 0) / data.durations.length
      }))
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 10);
  }

  identifyFlakyTests() {
    const testResults = {};
    
    for (const exec of this.executionHistory) {
      if (!testResults[exec.testId]) {
        testResults[exec.testId] = {
          name: exec.testName,
          results: []
        };
      }
      testResults[exec.testId].results.push(exec.passed);
    }
    
    const flakyTests = [];
    
    for (const [id, data] of Object.entries(testResults)) {
      if (data.results.length < 3) continue;
      
      // Check for alternating pass/fail pattern
      let changes = 0;
      for (let i = 1; i < data.results.length; i++) {
        if (data.results[i] !== data.results[i - 1]) {
          changes++;
        }
      }
      
      const flakiness = changes / (data.results.length - 1);
      if (flakiness > 0.3) {
        flakyTests.push({
          id,
          name: data.name,
          flakiness: flakiness * 100,
          executionCount: data.results.length
        });
      }
    }
    
    return flakyTests.sort((a, b) => b.flakiness - a.flakiness);
  }

  async identifyOptimizationOpportunities() {
    const opportunities = [];
    
    // Check for slow test suites
    const slowTests = this.getSlowestTests();
    if (slowTests[0] && slowTests[0].averageDuration > 10000) {
      opportunities.push({
        type: 'performance',
        priority: 'high',
        message: `Top ${Math.min(3, slowTests.length)} tests take over 10 seconds`,
        tests: slowTests.slice(0, 3)
      });
    }
    
    // Check for flaky tests
    const flakyTests = this.identifyFlakyTests();
    if (flakyTests.length > 0) {
      opportunities.push({
        type: 'stability',
        priority: 'high',
        message: `${flakyTests.length} flaky tests detected`,
        tests: flakyTests.slice(0, 5)
      });
    }
    
    // Check for poor parallelization
    const avgDuration = this.executionHistory.reduce((sum, exec) => sum + exec.duration, 0) / this.executionHistory.length;
    if (avgDuration > 5000) {
      opportunities.push({
        type: 'parallelization',
        priority: 'medium',
        message: 'Tests could benefit from better parallelization',
        recommendation: 'Group fast tests together and run in parallel'
      });
    }
    
    return opportunities;
  }
}

module.exports = IntelligentTestOptimizer; 