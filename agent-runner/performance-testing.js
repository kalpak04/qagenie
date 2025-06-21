const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class PerformanceTestingIntegration {
  constructor(options = {}) {
    this.thresholds = options.thresholds || {
      pageLoad: 3000,
      firstContentfulPaint: 1500,
      largestContentfulPaint: 2500,
      timeToInteractive: 3500,
      totalBlockingTime: 300
    };
    this.aiServiceUrl = options.aiServiceUrl || 'http://localhost:8000';
    this.resultsDir = options.resultsDir || './performance-results';
  }

  async runPerformanceTest(url, options = {}) {
    const browser = await chromium.launch({
      headless: options.headless !== false
    });
    
    const context = await browser.newContext({
      viewport: options.viewport || { width: 1920, height: 1080 },
      userAgent: options.userAgent,
      ...options.contextOptions
    });

    // Enable performance tracking
    await context.addInitScript(() => {
      window.__performanceMarks = new Map();
      window.__resourceTimings = [];
      
      // Track custom performance marks
      const originalMark = performance.mark.bind(performance);
      performance.mark = function(name) {
        window.__performanceMarks.set(name, performance.now());
        return originalMark(name);
      };
    });

    const page = await context.newPage();
    const metrics = await this.capturePerformanceMetrics(page, url, options);
    
    await browser.close();
    
    return metrics;
  }

  async capturePerformanceMetrics(page, url, options) {
    const results = {
      url,
      timestamp: new Date().toISOString(),
      metrics: {},
      resources: [],
      errors: [],
      suggestions: []
    };

    // Set up error tracking
    page.on('pageerror', error => {
      results.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });

    // Track console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.errors.push({
          type: 'console',
          message: msg.text(),
          timestamp: Date.now()
        });
      }
    });

    // Track network requests
    const networkRequests = [];
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        startTime: Date.now()
      });
    });

    page.on('response', response => {
      const request = networkRequests.find(r => r.url === response.url());
      if (request) {
        request.endTime = Date.now();
        request.status = response.status();
        request.size = response.headers()['content-length'] || 0;
        request.duration = request.endTime - request.startTime;
      }
    });

    // Start performance measurement
    const startTime = Date.now();
    
    // Navigate with performance tracking
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: options.timeout || 30000 
    });

    // Capture Core Web Vitals
    const coreWebVitals = await this.captureCoreWebVitals(page);
    results.metrics.coreWebVitals = coreWebVitals;

    // Capture navigation timing
    const navigationTiming = await page.evaluate(() => {
      const timing = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
        loadComplete: timing.loadEventEnd - timing.loadEventStart,
        domInteractive: timing.domInteractive - timing.fetchStart,
        timeToFirstByte: timing.responseStart - timing.requestStart,
        totalPageLoad: timing.loadEventEnd - timing.fetchStart
      };
    });
    results.metrics.navigation = navigationTiming;

    // Capture resource timings
    const resourceTimings = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(resource => ({
        name: resource.name,
        type: resource.initiatorType,
        duration: resource.duration,
        size: resource.transferSize || 0,
        startTime: resource.startTime
      }));
    });
    results.resources = this.analyzeResources(resourceTimings);

    // Memory usage
    const memoryUsage = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    results.metrics.memory = memoryUsage;

    // CPU metrics
    const cpuMetrics = await this.captureCPUMetrics(page);
    results.metrics.cpu = cpuMetrics;

    // Run Lighthouse audit
    if (options.runLighthouse) {
      const lighthouseResults = await this.runLighthouseAudit(url, options);
      results.lighthouse = lighthouseResults;
    }

    // Generate performance score
    results.performanceScore = this.calculatePerformanceScore(results);

    // Generate suggestions
    results.suggestions = await this.generatePerformanceSuggestions(results);

    // Check against thresholds
    results.violations = this.checkThresholdViolations(results);

    return results;
  }

  async captureCoreWebVitals(page) {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {
          lcp: null,
          fid: null,
          cls: null,
          fcp: null,
          ttfb: null
        };

        // Observe LCP
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // Observe FID
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            vitals.fid = entries[0].processingStart - entries[0].startTime;
          }
        }).observe({ entryTypes: ['first-input'] });

        // Observe CLS
        let clsValue = 0;
        let clsEntries = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              clsEntries.push(entry);
            }
          }
          vitals.cls = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });

        // Get FCP
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
        if (fcpEntry) {
          vitals.fcp = fcpEntry.startTime;
        }

        // Get TTFB
        const navigationEntry = performance.getEntriesByType('navigation')[0];
        if (navigationEntry) {
          vitals.ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
        }

        // Wait for metrics to be collected
        setTimeout(() => resolve(vitals), 5000);
      });
    });
  }

  async captureCPUMetrics(page) {
    // Start CPU profiling
    await page.coverage.startJSCoverage();
    
    // Wait for page activity
    await page.waitForTimeout(3000);
    
    // Stop profiling
    const jsCoverage = await page.coverage.stopJSCoverage();
    
    // Calculate metrics
    const totalBytes = jsCoverage.reduce((sum, entry) => sum + entry.text.length, 0);
    const usedBytes = jsCoverage.reduce((sum, entry) => {
      return sum + entry.functions.reduce((s, func) => {
        return s + func.ranges.reduce((rs, range) => rs + (range.end - range.start), 0);
      }, 0);
    }, 0);

    return {
      totalJavaScriptBytes: totalBytes,
      usedJavaScriptBytes: usedBytes,
      unusedPercentage: ((totalBytes - usedBytes) / totalBytes * 100).toFixed(2)
    };
  }

  analyzeResources(resources) {
    const analysis = {
      total: resources.length,
      byType: {},
      slowest: [],
      largest: [],
      totalSize: 0,
      totalDuration: 0
    };

    // Group by type
    resources.forEach(resource => {
      if (!analysis.byType[resource.type]) {
        analysis.byType[resource.type] = {
          count: 0,
          totalSize: 0,
          totalDuration: 0
        };
      }
      
      analysis.byType[resource.type].count++;
      analysis.byType[resource.type].totalSize += resource.size;
      analysis.byType[resource.type].totalDuration += resource.duration;
      
      analysis.totalSize += resource.size;
      analysis.totalDuration += resource.duration;
    });

    // Find slowest resources
    analysis.slowest = resources
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(r => ({
        url: r.name,
        duration: r.duration,
        type: r.type
      }));

    // Find largest resources
    analysis.largest = resources
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .map(r => ({
        url: r.name,
        size: r.size,
        type: r.type
      }));

    return analysis;
  }

  calculatePerformanceScore(results) {
    let score = 100;
    
    // Deduct points for slow metrics
    const { coreWebVitals, navigation } = results.metrics;
    
    if (coreWebVitals.lcp > this.thresholds.largestContentfulPaint) {
      score -= 20;
    }
    
    if (coreWebVitals.fcp > this.thresholds.firstContentfulPaint) {
      score -= 15;
    }
    
    if (coreWebVitals.cls > 0.1) {
      score -= 10;
    }
    
    if (navigation.totalPageLoad > this.thresholds.pageLoad) {
      score -= 15;
    }
    
    // Deduct for errors
    score -= results.errors.length * 5;
    
    // Deduct for resource issues
    if (results.resources.totalSize > 5000000) { // 5MB
      score -= 10;
    }
    
    return Math.max(0, score);
  }

  checkThresholdViolations(results) {
    const violations = [];
    const { coreWebVitals, navigation } = results.metrics;
    
    if (coreWebVitals.lcp > this.thresholds.largestContentfulPaint) {
      violations.push({
        metric: 'LCP',
        actual: coreWebVitals.lcp,
        threshold: this.thresholds.largestContentfulPaint,
        severity: 'high'
      });
    }
    
    if (coreWebVitals.fcp > this.thresholds.firstContentfulPaint) {
      violations.push({
        metric: 'FCP',
        actual: coreWebVitals.fcp,
        threshold: this.thresholds.firstContentfulPaint,
        severity: 'medium'
      });
    }
    
    if (navigation.totalPageLoad > this.thresholds.pageLoad) {
      violations.push({
        metric: 'Page Load',
        actual: navigation.totalPageLoad,
        threshold: this.thresholds.pageLoad,
        severity: 'high'
      });
    }
    
    return violations;
  }

  async generatePerformanceSuggestions(results) {
    const suggestions = [];
    
    // Analyze slow resources
    if (results.resources.slowest.length > 0) {
      const slowImages = results.resources.slowest.filter(r => r.type === 'image');
      if (slowImages.length > 0) {
        suggestions.push({
          type: 'optimization',
          category: 'images',
          priority: 'high',
          message: 'Optimize images - found slow loading images',
          details: `${slowImages.length} images are loading slowly. Consider using WebP format and lazy loading.`
        });
      }
    }
    
    // Check JavaScript usage
    if (results.metrics.cpu && results.metrics.cpu.unusedPercentage > 50) {
      suggestions.push({
        type: 'optimization',
        category: 'javascript',
        priority: 'medium',
        message: 'Remove unused JavaScript',
        details: `${results.metrics.cpu.unusedPercentage}% of JavaScript is unused. Consider code splitting.`
      });
    }
    
    // Check total resource size
    if (results.resources.totalSize > 3000000) { // 3MB
      suggestions.push({
        type: 'optimization',
        category: 'bundle',
        priority: 'high',
        message: 'Reduce bundle size',
        details: `Total resource size is ${(results.resources.totalSize / 1000000).toFixed(2)}MB. Consider lazy loading and code splitting.`
      });
    }
    
    // AI-powered suggestions
    try {
      const aiSuggestions = await this.getAISuggestions(results);
      suggestions.push(...aiSuggestions);
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
    }
    
    return suggestions;
  }

  async getAISuggestions(results) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/analyze/performance`, {
        metrics: results.metrics,
        resources: results.resources,
        errors: results.errors
      });
      
      return response.data.suggestions || [];
    } catch (error) {
      return [];
    }
  }

  async runLighthouseAudit(url, options) {
    // This would integrate with Lighthouse
    // For now, returning mock data
    return {
      performance: 85,
      accessibility: 92,
      bestPractices: 88,
      seo: 95,
      pwa: 70
    };
  }

  async comparePerformance(baseline, current) {
    const comparison = {
      improved: [],
      degraded: [],
      unchanged: []
    };
    
    // Compare core web vitals
    const vitalsComparison = this.compareMetrics(
      baseline.metrics.coreWebVitals,
      current.metrics.coreWebVitals
    );
    
    Object.entries(vitalsComparison).forEach(([metric, change]) => {
      if (change.percentChange > 5) {
        comparison.degraded.push({
          metric,
          baseline: change.baseline,
          current: change.current,
          change: change.percentChange
        });
      } else if (change.percentChange < -5) {
        comparison.improved.push({
          metric,
          baseline: change.baseline,
          current: change.current,
          change: Math.abs(change.percentChange)
        });
      }
    });
    
    // Compare resource metrics
    if (current.resources.totalSize > baseline.resources.totalSize * 1.1) {
      comparison.degraded.push({
        metric: 'Bundle Size',
        baseline: baseline.resources.totalSize,
        current: current.resources.totalSize,
        change: ((current.resources.totalSize - baseline.resources.totalSize) / baseline.resources.totalSize * 100).toFixed(2)
      });
    }
    
    return comparison;
  }

  compareMetrics(baseline, current) {
    const comparison = {};
    
    Object.keys(baseline).forEach(key => {
      if (baseline[key] && current[key]) {
        const percentChange = ((current[key] - baseline[key]) / baseline[key]) * 100;
        comparison[key] = {
          baseline: baseline[key],
          current: current[key],
          percentChange: percentChange.toFixed(2)
        };
      }
    });
    
    return comparison;
  }

  async generatePerformanceReport(results) {
    const report = {
      summary: {
        url: results.url,
        timestamp: results.timestamp,
        score: results.performanceScore,
        grade: this.getPerformanceGrade(results.performanceScore)
      },
      metrics: results.metrics,
      violations: results.violations,
      suggestions: results.suggestions,
      resources: {
        summary: {
          totalRequests: results.resources.total,
          totalSize: `${(results.resources.totalSize / 1000000).toFixed(2)}MB`,
          totalDuration: `${(results.resources.totalDuration / 1000).toFixed(2)}s`
        },
        byType: results.resources.byType,
        issues: {
          slowest: results.resources.slowest,
          largest: results.resources.largest
        }
      }
    };
    
    // Save report
    await this.saveReport(report);
    
    return report;
  }

  getPerformanceGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  async saveReport(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-report-${timestamp}.json`;
    const filepath = path.join(this.resultsDir, filename);
    
    await fs.mkdir(this.resultsDir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    return filepath;
  }

  async runLoadTest(url, options = {}) {
    const concurrentUsers = options.concurrentUsers || 10;
    const duration = options.duration || 60000; // 1 minute
    const rampUpTime = options.rampUpTime || 10000; // 10 seconds
    
    const results = {
      url,
      configuration: {
        concurrentUsers,
        duration,
        rampUpTime
      },
      metrics: {
        requests: [],
        errors: [],
        responseTime: []
      },
      summary: {}
    };
    
    const startTime = Date.now();
    const users = [];
    
    // Ramp up users
    for (let i = 0; i < concurrentUsers; i++) {
      setTimeout(() => {
        users.push(this.simulateUser(url, duration - (i * (rampUpTime / concurrentUsers)), results));
      }, i * (rampUpTime / concurrentUsers));
    }
    
    // Wait for all users to complete
    await Promise.all(users);
    
    // Calculate summary statistics
    results.summary = this.calculateLoadTestSummary(results);
    
    return results;
  }

  async simulateUser(url, duration, results) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      const requestStart = Date.now();
      
      try {
        await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        
        const responseTime = Date.now() - requestStart;
        results.metrics.requests.push({
          timestamp: requestStart,
          responseTime,
          success: true
        });
        
        results.metrics.responseTime.push(responseTime);
        
        // Simulate user think time
        await page.waitForTimeout(Math.random() * 5000 + 2000);
        
      } catch (error) {
        results.metrics.errors.push({
          timestamp: requestStart,
          error: error.message
        });
        
        results.metrics.requests.push({
          timestamp: requestStart,
          responseTime: Date.now() - requestStart,
          success: false
        });
      }
    }
    
    await browser.close();
  }

  calculateLoadTestSummary(results) {
    const { requests, responseTime, errors } = results.metrics;
    
    const summary = {
      totalRequests: requests.length,
      successfulRequests: requests.filter(r => r.success).length,
      failedRequests: errors.length,
      errorRate: (errors.length / requests.length * 100).toFixed(2) + '%',
      avgResponseTime: responseTime.length > 0 
        ? (responseTime.reduce((a, b) => a + b, 0) / responseTime.length).toFixed(0) + 'ms'
        : '0ms',
      minResponseTime: responseTime.length > 0 ? Math.min(...responseTime) + 'ms' : '0ms',
      maxResponseTime: responseTime.length > 0 ? Math.max(...responseTime) + 'ms' : '0ms',
      percentiles: this.calculatePercentiles(responseTime)
    };
    
    return summary;
  }

  calculatePercentiles(values) {
    if (values.length === 0) return {};
    
    const sorted = values.sort((a, b) => a - b);
    
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)] + 'ms',
      p90: sorted[Math.floor(sorted.length * 0.9)] + 'ms',
      p95: sorted[Math.floor(sorted.length * 0.95)] + 'ms',
      p99: sorted[Math.floor(sorted.length * 0.99)] + 'ms'
    };
  }
}

module.exports = PerformanceTestingIntegration; 