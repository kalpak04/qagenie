const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');

class VisualTestingAgent {
  constructor(options = {}) {
    this.baselineDir = options.baselineDir || path.join(__dirname, 'baselines');
    this.diffDir = options.diffDir || path.join(__dirname, 'diffs');
    this.threshold = options.threshold || 0.1;
    this.aiServiceUrl = options.aiServiceUrl || 'http://localhost:8000';
    
    // Create directories if they don't exist
    [this.baselineDir, this.diffDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async captureScreenshot(page, name) {
    const screenshotPath = path.join(this.baselineDir, `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  async compareScreenshots(baselinePath, currentPath, diffName) {
    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
    const current = PNG.sync.read(fs.readFileSync(currentPath));
    
    const { width, height } = baseline;
    const diff = new PNG({ width, height });
    
    const numDiffPixels = pixelmatch(
      baseline.data,
      current.data,
      diff.data,
      width,
      height,
      { threshold: this.threshold }
    );
    
    const diffPath = path.join(this.diffDir, `${diffName}.png`);
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    
    const diffPercentage = (numDiffPixels / (width * height)) * 100;
    
    return {
      diffPixels: numDiffPixels,
      diffPercentage,
      diffPath,
      passed: diffPercentage < 5 // Less than 5% difference
    };
  }

  async analyzeVisualAnomaly(screenshotPath, diffData) {
    // Send to AI service for analysis
    const formData = new FormData();
    formData.append('screenshot', fs.createReadStream(screenshotPath));
    formData.append('diffData', JSON.stringify(diffData));
    
    try {
      const response = await fetch(`${this.aiServiceUrl}/analyze/visual`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('AI service error');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error analyzing visual anomaly:', error);
      
      // Fallback analysis
      return {
        anomalyType: diffData.diffPercentage > 20 ? 'major_change' : 'minor_change',
        severity: diffData.diffPercentage > 20 ? 'high' : 'low',
        suggestions: [
          'Review the visual changes',
          'Update baseline if changes are intentional'
        ]
      };
    }
  }

  async detectUIAnomalies(page) {
    // Capture current state
    const screenshot = await page.screenshot({ fullPage: true });
    
    // Check for common UI issues
    const anomalies = [];
    
    // Check for overlapping elements
    const overlaps = await this.detectOverlappingElements(page);
    if (overlaps.length > 0) {
      anomalies.push({
        type: 'overlapping_elements',
        elements: overlaps,
        severity: 'medium'
      });
    }
    
    // Check for broken images
    const brokenImages = await this.detectBrokenImages(page);
    if (brokenImages.length > 0) {
      anomalies.push({
        type: 'broken_images',
        images: brokenImages,
        severity: 'high'
      });
    }
    
    // Check for text overflow
    const textOverflows = await this.detectTextOverflow(page);
    if (textOverflows.length > 0) {
      anomalies.push({
        type: 'text_overflow',
        elements: textOverflows,
        severity: 'low'
      });
    }
    
    return {
      screenshot,
      anomalies,
      timestamp: new Date().toISOString()
    };
  }

  async detectOverlappingElements(page) {
    return await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const overlaps = [];
      
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const rect1 = elements[i].getBoundingClientRect();
          const rect2 = elements[j].getBoundingClientRect();
          
          if (!(rect1.right < rect2.left || 
                rect2.right < rect1.left || 
                rect1.bottom < rect2.top || 
                rect2.bottom < rect1.top)) {
            // Elements overlap
            overlaps.push({
              element1: elements[i].tagName,
              element2: elements[j].tagName,
              overlap: true
            });
          }
        }
      }
      
      return overlaps;
    });
  }

  async detectBrokenImages(page) {
    return await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images
        .filter(img => !img.complete || img.naturalHeight === 0)
        .map(img => ({
          src: img.src,
          alt: img.alt
        }));
    });
  }

  async detectTextOverflow(page) {
    return await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter(el => {
          return el.scrollHeight > el.clientHeight || 
                 el.scrollWidth > el.clientWidth;
        })
        .map(el => ({
          tagName: el.tagName,
          text: el.textContent.substring(0, 50)
        }));
    });
  }

  async performCrossBrowserValidation(url, testName) {
    const browsers = ['chromium', 'firefox', 'webkit'];
    const results = {};
    
    for (const browserType of browsers) {
      const browser = await playwright[browserType].launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      const screenshotPath = path.join(
        this.baselineDir, 
        `${testName}_${browserType}.png`
      );
      
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });
      
      results[browserType] = {
        screenshot: screenshotPath,
        viewport: await page.viewportSize(),
        anomalies: await this.detectUIAnomalies(page)
      };
      
      await browser.close();
    }
    
    // Compare screenshots across browsers
    const comparisons = {};
    
    if (results.chromium && results.firefox) {
      comparisons['chromium_vs_firefox'] = await this.compareScreenshots(
        results.chromium.screenshot,
        results.firefox.screenshot,
        `${testName}_chromium_vs_firefox`
      );
    }
    
    if (results.chromium && results.webkit) {
      comparisons['chromium_vs_webkit'] = await this.compareScreenshots(
        results.chromium.screenshot,
        results.webkit.screenshot,
        `${testName}_chromium_vs_webkit`
      );
    }
    
    return {
      browsers: results,
      comparisons,
      crossBrowserCompatible: Object.values(comparisons).every(c => c.passed)
    };
  }
}

module.exports = VisualTestingAgent; 