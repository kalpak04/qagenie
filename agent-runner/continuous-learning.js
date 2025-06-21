const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class ContinuousLearningSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.aiServiceUrl = options.aiServiceUrl || 'http://localhost:8000';
    this.dataDir = options.dataDir || './learning-data';
    this.models = new Map();
    this.trainingData = new Map();
    this.feedback = [];
    this.metrics = {
      predictions: 0,
      correct: 0,
      accuracy: 0
    };
    this.learningRate = options.learningRate || 0.01;
    this.batchSize = options.batchSize || 32;
  }

  async initialize() {
    // Create data directory
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Load existing models
    await this.loadModels();
    
    // Initialize learning components
    this.initializeComponents();
    
    console.log('Continuous learning system initialized');
  }

  async loadModels() {
    try {
      const modelFiles = await fs.readdir(path.join(this.dataDir, 'models')).catch(() => []);
      
      for (const file of modelFiles) {
        if (file.endsWith('.model.json')) {
          const modelPath = path.join(this.dataDir, 'models', file);
          const content = await fs.readFile(modelPath, 'utf-8');
          const model = JSON.parse(content);
          
          this.models.set(model.name, model);
          console.log(`Loaded model: ${model.name}`);
        }
      }
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  initializeComponents() {
    // Test failure prediction model
    this.registerModel('test_failure_predictor', {
      type: 'classification',
      features: ['code_complexity', 'change_frequency', 'test_age', 'dependencies'],
      target: 'will_fail',
      accuracy: 0
    });
    
    // Test execution time predictor
    this.registerModel('execution_time_predictor', {
      type: 'regression',
      features: ['test_steps', 'element_count', 'network_calls', 'data_size'],
      target: 'execution_time',
      accuracy: 0
    });
    
    // Bug pattern detector
    this.registerModel('bug_pattern_detector', {
      type: 'pattern_recognition',
      patterns: [],
      confidence_threshold: 0.7
    });
    
    // Test optimization suggester
    this.registerModel('optimization_suggester', {
      type: 'recommendation',
      strategies: [],
      success_rate: 0
    });
  }

  registerModel(name, config) {
    const model = {
      name,
      ...config,
      version: 1,
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      trainingHistory: []
    };
    
    this.models.set(name, model);
    this.emit('model:registered', { name, config });
  }

  async collectTrainingData(type, data) {
    if (!this.trainingData.has(type)) {
      this.trainingData.set(type, []);
    }
    
    const trainingSet = this.trainingData.get(type);
    trainingSet.push({
      ...data,
      timestamp: new Date().toISOString()
    });
    
    // Keep only recent data (last 10000 samples)
    if (trainingSet.length > 10000) {
      this.trainingData.set(type, trainingSet.slice(-10000));
    }
    
    // Check if we have enough data for training
    if (trainingSet.length >= this.batchSize && trainingSet.length % this.batchSize === 0) {
      await this.triggerTraining(type);
    }
  }

  async triggerTraining(modelName) {
    const model = this.models.get(modelName);
    if (!model) {
      console.error(`Model ${modelName} not found`);
      return;
    }
    
    const trainingData = this.trainingData.get(modelName) || [];
    if (trainingData.length < this.batchSize) {
      return;
    }
    
    console.log(`Training ${modelName} with ${trainingData.length} samples`);
    
    try {
      const result = await this.trainModel(model, trainingData);
      
      // Update model
      model.lastUpdated = new Date().toISOString();
      model.version++;
      model.trainingHistory.push({
        timestamp: new Date().toISOString(),
        samples: trainingData.length,
        metrics: result.metrics
      });
      
      // Save updated model
      await this.saveModel(model);
      
      // Clear processed training data
      this.trainingData.set(modelName, []);
      
      this.emit('model:trained', {
        name: modelName,
        version: model.version,
        metrics: result.metrics
      });
      
    } catch (error) {
      console.error(`Training failed for ${modelName}:`, error);
      this.emit('model:training-failed', {
        name: modelName,
        error: error.message
      });
    }
  }

  async trainModel(model, data) {
    // Send to AI service for training
    try {
      const response = await axios.post(`${this.aiServiceUrl}/train/model`, {
        modelType: model.type,
        modelName: model.name,
        trainingData: data,
        hyperparameters: {
          learningRate: this.learningRate,
          batchSize: this.batchSize,
          epochs: 10
        }
      });
      
      return response.data;
    } catch (error) {
      // Fallback to local training for simple models
      return this.localTraining(model, data);
    }
  }

  localTraining(model, data) {
    switch (model.type) {
      case 'classification':
        return this.trainClassifier(model, data);
      case 'regression':
        return this.trainRegressor(model, data);
      case 'pattern_recognition':
        return this.trainPatternRecognizer(model, data);
      default:
        throw new Error(`Unsupported model type: ${model.type}`);
    }
  }

  trainClassifier(model, data) {
    // Simple decision tree training
    const features = data.map(d => 
      model.features.map(f => d[f])
    );
    const labels = data.map(d => d[model.target]);
    
    // Calculate feature importance
    const importance = {};
    model.features.forEach((feature, index) => {
      const values = features.map(f => f[index]);
      const correlation = this.calculateCorrelation(values, labels);
      importance[feature] = Math.abs(correlation);
    });
    
    // Build simple rules
    const rules = [];
    for (const feature of model.features) {
      const threshold = this.findOptimalThreshold(
        data.map(d => d[feature]),
        labels
      );
      
      rules.push({
        feature,
        threshold,
        importance: importance[feature]
      });
    }
    
    model.rules = rules;
    
    // Calculate accuracy
    let correct = 0;
    data.forEach(sample => {
      const prediction = this.predictWithRules(sample, rules);
      if (prediction === sample[model.target]) {
        correct++;
      }
    });
    
    const accuracy = correct / data.length;
    model.accuracy = accuracy;
    
    return {
      metrics: {
        accuracy,
        featureImportance: importance
      }
    };
  }

  trainRegressor(model, data) {
    // Simple linear regression
    const features = data.map(d => 
      model.features.map(f => d[f])
    );
    const targets = data.map(d => d[model.target]);
    
    // Calculate coefficients
    const coefficients = this.calculateLinearRegression(features, targets);
    model.coefficients = coefficients;
    
    // Calculate R-squared
    const predictions = features.map(f => 
      this.predictLinear(f, coefficients)
    );
    
    const rSquared = this.calculateRSquared(targets, predictions);
    model.rSquared = rSquared;
    
    return {
      metrics: {
        rSquared,
        coefficients
      }
    };
  }

  trainPatternRecognizer(model, data) {
    // Extract patterns
    const patterns = new Map();
    
    data.forEach(sample => {
      const pattern = this.extractPattern(sample);
      const key = JSON.stringify(pattern);
      
      if (!patterns.has(key)) {
        patterns.set(key, {
          pattern,
          count: 0,
          outcomes: []
        });
      }
      
      const patternData = patterns.get(key);
      patternData.count++;
      patternData.outcomes.push(sample.outcome);
    });
    
    // Filter significant patterns
    const significantPatterns = [];
    patterns.forEach((data, key) => {
      if (data.count >= 5) {
        const confidence = this.calculatePatternConfidence(data.outcomes);
        if (confidence >= model.confidence_threshold) {
          significantPatterns.push({
            ...data.pattern,
            confidence,
            support: data.count / data.length
          });
        }
      }
    });
    
    model.patterns = significantPatterns;
    
    return {
      metrics: {
        patternsFound: significantPatterns.length,
        averageConfidence: significantPatterns.reduce((sum, p) => sum + p.confidence, 0) / significantPatterns.length
      }
    };
  }

  async predict(modelName, features) {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }
    
    let prediction;
    
    // Try AI service first
    try {
      const response = await axios.post(`${this.aiServiceUrl}/predict`, {
        modelName,
        features
      });
      
      prediction = response.data.prediction;
    } catch (error) {
      // Fallback to local prediction
      prediction = this.localPredict(model, features);
    }
    
    // Track prediction for learning
    this.trackPrediction(modelName, features, prediction);
    
    return prediction;
  }

  localPredict(model, features) {
    switch (model.type) {
      case 'classification':
        return this.predictWithRules(features, model.rules);
      case 'regression':
        return this.predictLinear(
          model.features.map(f => features[f]),
          model.coefficients
        );
      case 'pattern_recognition':
        return this.matchPattern(features, model.patterns);
      default:
        throw new Error(`Unsupported model type: ${model.type}`);
    }
  }

  predictWithRules(sample, rules) {
    let score = 0;
    
    rules.forEach(rule => {
      const value = sample[rule.feature];
      if (value > rule.threshold) {
        score += rule.importance;
      }
    });
    
    return score > 0.5;
  }

  predictLinear(features, coefficients) {
    let prediction = coefficients.intercept || 0;
    
    features.forEach((value, index) => {
      prediction += value * (coefficients.weights[index] || 0);
    });
    
    return prediction;
  }

  matchPattern(features, patterns) {
    for (const pattern of patterns) {
      if (this.isPatternMatch(features, pattern)) {
        return {
          matched: true,
          pattern,
          confidence: pattern.confidence
        };
      }
    }
    
    return {
      matched: false,
      confidence: 0
    };
  }

  isPatternMatch(features, pattern) {
    for (const [key, value] of Object.entries(pattern)) {
      if (key !== 'confidence' && key !== 'support') {
        if (features[key] !== value) {
          return false;
        }
      }
    }
    return true;
  }

  trackPrediction(modelName, features, prediction) {
    this.metrics.predictions++;
    
    // Store prediction for later feedback
    const predictionId = `${modelName}_${Date.now()}_${Math.random()}`;
    
    this.emit('prediction:made', {
      id: predictionId,
      modelName,
      features,
      prediction,
      timestamp: new Date().toISOString()
    });
    
    return predictionId;
  }

  async provideFeedback(predictionId, actual) {
    this.feedback.push({
      predictionId,
      actual,
      timestamp: new Date().toISOString()
    });
    
    // Update metrics
    // In real implementation, would match with stored prediction
    this.metrics.correct++;
    this.metrics.accuracy = this.metrics.correct / this.metrics.predictions;
    
    // Trigger retraining if accuracy drops
    if (this.metrics.accuracy < 0.8 && this.feedback.length > 100) {
      this.emit('performance:degraded', {
        accuracy: this.metrics.accuracy,
        samples: this.feedback.length
      });
    }
  }

  async adaptToNewPatterns(observations) {
    // Detect concept drift
    const drift = await this.detectConceptDrift(observations);
    
    if (drift.detected) {
      this.emit('concept:drift', {
        severity: drift.severity,
        affectedModels: drift.affectedModels
      });
      
      // Adapt models
      for (const modelName of drift.affectedModels) {
        await this.adaptModel(modelName, observations);
      }
    }
    
    // Discover new patterns
    const newPatterns = await this.discoverPatterns(observations);
    
    if (newPatterns.length > 0) {
      this.emit('patterns:discovered', {
        count: newPatterns.length,
        patterns: newPatterns
      });
      
      // Update pattern recognition models
      await this.updatePatternModels(newPatterns);
    }
  }

  async detectConceptDrift(observations) {
    const recentPredictions = observations.slice(-100);
    const historicalAccuracy = this.metrics.accuracy;
    
    // Calculate recent accuracy
    let recentCorrect = 0;
    recentPredictions.forEach(obs => {
      if (obs.prediction === obs.actual) {
        recentCorrect++;
      }
    });
    
    const recentAccuracy = recentCorrect / recentPredictions.length;
    const accuracyDrop = historicalAccuracy - recentAccuracy;
    
    return {
      detected: accuracyDrop > 0.1,
      severity: accuracyDrop > 0.2 ? 'high' : 'medium',
      affectedModels: accuracyDrop > 0.1 ? Array.from(this.models.keys()) : []
    };
  }

  async discoverPatterns(observations) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/discover/patterns`, {
        observations: observations.slice(-500)
      });
      
      return response.data.patterns || [];
    } catch (error) {
      // Fallback to local pattern discovery
      return this.localPatternDiscovery(observations);
    }
  }

  localPatternDiscovery(observations) {
    const patterns = [];
    const sequenceLength = 3;
    
    // Look for sequential patterns
    for (let i = 0; i < observations.length - sequenceLength; i++) {
      const sequence = observations.slice(i, i + sequenceLength);
      const pattern = this.extractSequencePattern(sequence);
      
      if (pattern && !patterns.some(p => JSON.stringify(p) === JSON.stringify(pattern))) {
        patterns.push(pattern);
      }
    }
    
    return patterns;
  }

  extractSequencePattern(sequence) {
    // Simple pattern extraction
    const pattern = {
      type: 'sequence',
      length: sequence.length,
      commonAttributes: {}
    };
    
    // Find common attributes
    const firstItem = sequence[0];
    for (const key of Object.keys(firstItem)) {
      const values = sequence.map(item => item[key]);
      const uniqueValues = new Set(values);
      
      if (uniqueValues.size === 1) {
        pattern.commonAttributes[key] = values[0];
      }
    }
    
    if (Object.keys(pattern.commonAttributes).length > 0) {
      return pattern;
    }
    
    return null;
  }

  async updatePatternModels(newPatterns) {
    for (const [name, model] of this.models.entries()) {
      if (model.type === 'pattern_recognition') {
        model.patterns.push(...newPatterns);
        
        // Remove duplicates
        model.patterns = this.deduplicatePatterns(model.patterns);
        
        // Re-evaluate pattern confidence
        model.patterns = model.patterns.map(pattern => ({
          ...pattern,
          confidence: this.recalculatePatternConfidence(pattern)
        }));
        
        await this.saveModel(model);
      }
    }
  }

  deduplicatePatterns(patterns) {
    const unique = [];
    const seen = new Set();
    
    patterns.forEach(pattern => {
      const key = JSON.stringify(pattern);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(pattern);
      }
    });
    
    return unique;
  }

  recalculatePatternConfidence(pattern) {
    // In real implementation, would use historical data
    return pattern.confidence * 0.95; // Decay over time
  }

  async generateInsights() {
    const insights = {
      modelPerformance: {},
      learningProgress: {},
      recommendations: []
    };
    
    // Analyze model performance
    for (const [name, model] of this.models.entries()) {
      insights.modelPerformance[name] = {
        accuracy: model.accuracy || model.rSquared || 0,
        lastUpdated: model.lastUpdated,
        trainingCount: model.trainingHistory.length,
        trend: this.calculatePerformanceTrend(model.trainingHistory)
      };
    }
    
    // Learning progress
    insights.learningProgress = {
      totalPredictions: this.metrics.predictions,
      overallAccuracy: this.metrics.accuracy,
      feedbackReceived: this.feedback.length,
      modelsImproved: this.countImprovedModels()
    };
    
    // Generate recommendations
    insights.recommendations = await this.generateRecommendations();
    
    return insights;
  }

  calculatePerformanceTrend(history) {
    if (history.length < 2) return 'stable';
    
    const recent = history.slice(-5);
    const metrics = recent.map(h => h.metrics.accuracy || h.metrics.rSquared || 0);
    
    let increasing = 0;
    for (let i = 1; i < metrics.length; i++) {
      if (metrics[i] > metrics[i - 1]) {
        increasing++;
      }
    }
    
    if (increasing > metrics.length * 0.6) return 'improving';
    if (increasing < metrics.length * 0.4) return 'degrading';
    return 'stable';
  }

  countImprovedModels() {
    let improved = 0;
    
    for (const model of this.models.values()) {
      if (model.trainingHistory.length >= 2) {
        const recent = model.trainingHistory[model.trainingHistory.length - 1];
        const previous = model.trainingHistory[model.trainingHistory.length - 2];
        
        const recentMetric = recent.metrics.accuracy || recent.metrics.rSquared || 0;
        const previousMetric = previous.metrics.accuracy || previous.metrics.rSquared || 0;
        
        if (recentMetric > previousMetric) {
          improved++;
        }
      }
    }
    
    return improved;
  }

  async generateRecommendations() {
    const recommendations = [];
    
    // Check for models needing retraining
    for (const [name, model] of this.models.entries()) {
      const daysSinceUpdate = (Date.now() - new Date(model.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate > 7) {
        recommendations.push({
          type: 'retraining',
          priority: 'medium',
          message: `Model ${name} hasn't been updated in ${Math.floor(daysSinceUpdate)} days`,
          action: `Collect more training data for ${name}`
        });
      }
      
      if (model.accuracy < 0.7) {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          message: `Model ${name} has low accuracy (${(model.accuracy * 100).toFixed(1)}%)`,
          action: 'Review feature engineering and training data quality'
        });
      }
    }
    
    // Check for data collection opportunities
    for (const [type, data] of this.trainingData.entries()) {
      if (data.length < this.batchSize) {
        recommendations.push({
          type: 'data_collection',
          priority: 'low',
          message: `Need ${this.batchSize - data.length} more samples for ${type}`,
          action: 'Continue collecting training data'
        });
      }
    }
    
    return recommendations;
  }

  async saveModel(model) {
    const modelPath = path.join(this.dataDir, 'models', `${model.name}.model.json`);
    await fs.mkdir(path.dirname(modelPath), { recursive: true });
    await fs.writeFile(modelPath, JSON.stringify(model, null, 2));
  }

  calculateCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const correlation = (n * sumXY - sumX * sumY) / 
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return correlation;
  }

  findOptimalThreshold(values, labels) {
    const sortedValues = [...new Set(values)].sort((a, b) => a - b);
    let bestThreshold = sortedValues[0];
    let bestScore = 0;
    
    for (const threshold of sortedValues) {
      let correct = 0;
      values.forEach((value, index) => {
        const prediction = value > threshold;
        if (prediction === labels[index]) {
          correct++;
        }
      });
      
      const score = correct / values.length;
      if (score > bestScore) {
        bestScore = score;
        bestThreshold = threshold;
      }
    }
    
    return bestThreshold;
  }

  calculateLinearRegression(features, targets) {
    // Simple least squares regression
    const n = features.length;
    const k = features[0].length;
    
    // Initialize coefficients
    const weights = new Array(k).fill(0);
    let intercept = 0;
    
    // Gradient descent
    const learningRate = 0.01;
    const iterations = 1000;
    
    for (let iter = 0; iter < iterations; iter++) {
      let interceptGradient = 0;
      const weightGradients = new Array(k).fill(0);
      
      for (let i = 0; i < n; i++) {
        const prediction = intercept + features[i].reduce((sum, f, j) => sum + f * weights[j], 0);
        const error = prediction - targets[i];
        
        interceptGradient += error;
        features[i].forEach((f, j) => {
          weightGradients[j] += error * f;
        });
      }
      
      // Update weights
      intercept -= learningRate * interceptGradient / n;
      weights.forEach((w, j) => {
        weights[j] -= learningRate * weightGradients[j] / n;
      });
    }
    
    return { intercept, weights };
  }

  calculateRSquared(actual, predicted) {
    const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
    
    const ssTotal = actual.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0);
    const ssResidual = actual.reduce((sum, y, i) => sum + Math.pow(y - predicted[i], 2), 0);
    
    return 1 - (ssResidual / ssTotal);
  }

  calculatePatternConfidence(outcomes) {
    if (outcomes.length === 0) return 0;
    
    const frequency = {};
    outcomes.forEach(outcome => {
      frequency[outcome] = (frequency[outcome] || 0) + 1;
    });
    
    const maxFrequency = Math.max(...Object.values(frequency));
    return maxFrequency / outcomes.length;
  }

  extractPattern(sample) {
    // Extract key features that form a pattern
    const pattern = {};
    
    // Select most relevant features
    const relevantKeys = Object.keys(sample).filter(key => 
      key !== 'timestamp' && 
      key !== 'id' && 
      key !== 'outcome'
    );
    
    relevantKeys.slice(0, 5).forEach(key => {
      pattern[key] = sample[key];
    });
    
    return pattern;
  }

  async exportLearnings() {
    const exportData = {
      models: {},
      insights: await this.generateInsights(),
      exportDate: new Date().toISOString()
    };
    
    // Export model summaries
    for (const [name, model] of this.models.entries()) {
      exportData.models[name] = {
        type: model.type,
        version: model.version,
        accuracy: model.accuracy || model.rSquared || 0,
        lastUpdated: model.lastUpdated,
        features: model.features
      };
    }
    
    const exportPath = path.join(
      this.dataDir, 
      `learning_export_${Date.now()}.json`
    );
    
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
    
    return exportPath;
  }
}

module.exports = ContinuousLearningSystem; 