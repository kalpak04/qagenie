const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const faker = require('faker');

class TestDataIntelligence {
  constructor(options = {}) {
    this.aiServiceUrl = options.aiServiceUrl || 'http://localhost:8000';
    this.dataDir = options.dataDir || './test-data';
    this.schemas = new Map();
    this.dataProfiles = new Map();
    this.relationships = new Map();
    this.sensitiveDataPatterns = this.initializeSensitiveDataPatterns();
  }

  initializeSensitiveDataPatterns() {
    return {
      creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      phone: /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/,
      apiKey: /\b[A-Za-z0-9]{32,}\b/,
      password: /password["']?\s*[:=]\s*["']?[^"'\s]+/i,
      jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
    };
  }

  async analyzeTestData(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      const analysis = {
        schema: this.extractSchema(data),
        statistics: this.calculateStatistics(data),
        patterns: await this.identifyPatterns(data),
        sensitiveData: this.detectSensitiveData(data),
        quality: this.assessDataQuality(data),
        relationships: this.findRelationships(data)
      };
      
      // Store analysis results
      this.dataProfiles.set(filePath, analysis);
      
      return analysis;
    } catch (error) {
      console.error('Failed to analyze test data:', error);
      throw error;
    }
  }

  extractSchema(data) {
    if (Array.isArray(data)) {
      return {
        type: 'array',
        itemSchema: data.length > 0 ? this.extractSchema(data[0]) : null,
        count: data.length
      };
    }
    
    if (typeof data === 'object' && data !== null) {
      const schema = {
        type: 'object',
        properties: {}
      };
      
      for (const [key, value] of Object.entries(data)) {
        schema.properties[key] = this.getFieldSchema(value);
      }
      
      return schema;
    }
    
    return this.getFieldSchema(data);
  }

  getFieldSchema(value) {
    const schema = {
      type: typeof value,
      nullable: value === null
    };
    
    if (Array.isArray(value)) {
      schema.type = 'array';
      schema.itemType = value.length > 0 ? typeof value[0] : 'unknown';
      schema.minLength = value.length;
      schema.maxLength = value.length;
    } else if (typeof value === 'string') {
      schema.minLength = value.length;
      schema.maxLength = value.length;
      schema.format = this.detectStringFormat(value);
    } else if (typeof value === 'number') {
      schema.min = value;
      schema.max = value;
      schema.isInteger = Number.isInteger(value);
    }
    
    return schema;
  }

  detectStringFormat(value) {
    // Detect common string formats
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return 'datetime';
    if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(value)) return 'email';
    if (/^https?:\/\//.test(value)) return 'url';
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) return 'uuid';
    if (/^\+?[1-9]\d{1,14}$/.test(value)) return 'phone';
    
    return 'string';
  }

  calculateStatistics(data) {
    const stats = {
      totalRecords: 0,
      fieldStatistics: {},
      nullPercentage: {},
      uniqueness: {}
    };
    
    if (Array.isArray(data)) {
      stats.totalRecords = data.length;
      
      if (data.length > 0 && typeof data[0] === 'object') {
        // Calculate field-level statistics
        for (const key of Object.keys(data[0])) {
          const values = data.map(record => record[key]);
          stats.fieldStatistics[key] = this.calculateFieldStatistics(values);
          stats.nullPercentage[key] = (values.filter(v => v === null || v === undefined).length / values.length) * 100;
          stats.uniqueness[key] = (new Set(values).size / values.length) * 100;
        }
      }
    }
    
    return stats;
  }

  calculateFieldStatistics(values) {
    const stats = {
      count: values.length,
      unique: new Set(values).size
    };
    
    // For numeric fields
    const numericValues = values.filter(v => typeof v === 'number');
    if (numericValues.length > 0) {
      stats.min = Math.min(...numericValues);
      stats.max = Math.max(...numericValues);
      stats.avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      stats.median = this.calculateMedian(numericValues);
    }
    
    // For string fields
    const stringValues = values.filter(v => typeof v === 'string');
    if (stringValues.length > 0) {
      stats.minLength = Math.min(...stringValues.map(s => s.length));
      stats.maxLength = Math.max(...stringValues.map(s => s.length));
      stats.avgLength = stringValues.reduce((sum, s) => sum + s.length, 0) / stringValues.length;
    }
    
    return stats;
  }

  calculateMedian(numbers) {
    const sorted = numbers.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }

  async identifyPatterns(data) {
    const patterns = {
      sequences: [],
      distributions: {},
      correlations: []
    };
    
    if (Array.isArray(data) && data.length > 0) {
      // Identify sequences
      patterns.sequences = this.findSequences(data);
      
      // Analyze distributions
      patterns.distributions = this.analyzeDistributions(data);
      
      // Find correlations
      patterns.correlations = this.findCorrelations(data);
    }
    
    // Use AI for advanced pattern detection
    try {
      const aiPatterns = await this.getAIPatternAnalysis(data);
      patterns.aiDetected = aiPatterns;
    } catch (error) {
      console.error('AI pattern analysis failed:', error);
    }
    
    return patterns;
  }

  findSequences(data) {
    const sequences = [];
    
    // Check for ID sequences
    if (data[0].id !== undefined) {
      const ids = data.map(record => record.id);
      if (this.isSequential(ids)) {
        sequences.push({
          field: 'id',
          type: 'sequential',
          start: ids[0],
          end: ids[ids.length - 1]
        });
      }
    }
    
    // Check for date sequences
    for (const key of Object.keys(data[0])) {
      const values = data.map(record => record[key]);
      if (values.every(v => this.isDate(v))) {
        const dates = values.map(v => new Date(v).getTime());
        if (this.isSequential(dates)) {
          sequences.push({
            field: key,
            type: 'temporal',
            interval: dates[1] - dates[0]
          });
        }
      }
    }
    
    return sequences;
  }

  isSequential(values) {
    if (values.length < 2) return false;
    
    const differences = [];
    for (let i = 1; i < values.length; i++) {
      differences.push(values[i] - values[i - 1]);
    }
    
    // Check if all differences are the same
    return differences.every(d => d === differences[0]);
  }

  isDate(value) {
    return !isNaN(Date.parse(value));
  }

  analyzeDistributions(data) {
    const distributions = {};
    
    for (const key of Object.keys(data[0])) {
      const values = data.map(record => record[key]);
      
      if (values.every(v => typeof v === 'number')) {
        distributions[key] = {
          type: 'numeric',
          distribution: this.getNumericDistribution(values)
        };
      } else if (values.every(v => typeof v === 'string')) {
        distributions[key] = {
          type: 'categorical',
          distribution: this.getCategoricalDistribution(values)
        };
      }
    }
    
    return distributions;
  }

  getNumericDistribution(values) {
    const histogram = {};
    const binCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / binCount;
    
    values.forEach(value => {
      const bin = Math.floor((value - min) / binSize);
      histogram[bin] = (histogram[bin] || 0) + 1;
    });
    
    return {
      histogram,
      skewness: this.calculateSkewness(values),
      kurtosis: this.calculateKurtosis(values)
    };
  }

  getCategoricalDistribution(values) {
    const frequency = {};
    
    values.forEach(value => {
      frequency[value] = (frequency[value] || 0) + 1;
    });
    
    return {
      frequency,
      mode: Object.entries(frequency).sort(([, a], [, b]) => b - a)[0][0],
      entropy: this.calculateEntropy(Object.values(frequency))
    };
  }

  calculateSkewness(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const skewness = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / values.length;
    
    return skewness;
  }

  calculateKurtosis(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const kurtosis = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) / values.length - 3;
    
    return kurtosis;
  }

  calculateEntropy(frequencies) {
    const total = frequencies.reduce((a, b) => a + b, 0);
    let entropy = 0;
    
    frequencies.forEach(freq => {
      if (freq > 0) {
        const probability = freq / total;
        entropy -= probability * Math.log2(probability);
      }
    });
    
    return entropy;
  }

  findCorrelations(data) {
    const correlations = [];
    const numericFields = [];
    
    // Identify numeric fields
    for (const key of Object.keys(data[0])) {
      const values = data.map(record => record[key]);
      if (values.every(v => typeof v === 'number')) {
        numericFields.push(key);
      }
    }
    
    // Calculate correlations between numeric fields
    for (let i = 0; i < numericFields.length; i++) {
      for (let j = i + 1; j < numericFields.length; j++) {
        const field1 = numericFields[i];
        const field2 = numericFields[j];
        const values1 = data.map(record => record[field1]);
        const values2 = data.map(record => record[field2]);
        
        const correlation = this.calculateCorrelation(values1, values2);
        
        if (Math.abs(correlation) > 0.5) {
          correlations.push({
            field1,
            field2,
            correlation,
            strength: Math.abs(correlation) > 0.8 ? 'strong' : 'moderate'
          });
        }
      }
    }
    
    return correlations;
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

  detectSensitiveData(data) {
    const sensitiveFields = [];
    
    const checkValue = (value, path) => {
      if (typeof value === 'string') {
        for (const [type, pattern] of Object.entries(this.sensitiveDataPatterns)) {
          if (pattern.test(value)) {
            sensitiveFields.push({
              path,
              type,
              sample: this.maskSensitiveData(value, type)
            });
            break;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          checkValue(val, `${path}.${key}`);
        }
      }
    };
    
    if (Array.isArray(data)) {
      data.forEach((record, index) => {
        if (index < 10) { // Check first 10 records
          checkValue(record, `[${index}]`);
        }
      });
    } else {
      checkValue(data, 'root');
    }
    
    return {
      hasSensitiveData: sensitiveFields.length > 0,
      fields: sensitiveFields,
      recommendation: sensitiveFields.length > 0 
        ? 'Consider using data masking or synthetic data for sensitive fields'
        : 'No sensitive data detected'
    };
  }

  maskSensitiveData(value, type) {
    switch (type) {
      case 'creditCard':
        return value.replace(/\d{12}/, '************');
      case 'ssn':
        return 'XXX-XX-' + value.slice(-4);
      case 'email':
        const [user, domain] = value.split('@');
        return user.charAt(0) + '***@' + domain;
      case 'phone':
        return value.slice(0, -4) + 'XXXX';
      default:
        return '***MASKED***';
    }
  }

  assessDataQuality(data) {
    const quality = {
      completeness: 100,
      consistency: 100,
      validity: 100,
      uniqueness: 100,
      issues: []
    };
    
    if (Array.isArray(data) && data.length > 0) {
      // Check completeness
      const nullCounts = {};
      data.forEach(record => {
        for (const [key, value] of Object.entries(record)) {
          if (value === null || value === undefined || value === '') {
            nullCounts[key] = (nullCounts[key] || 0) + 1;
          }
        }
      });
      
      const totalFields = Object.keys(data[0]).length * data.length;
      const totalNulls = Object.values(nullCounts).reduce((a, b) => a + b, 0);
      quality.completeness = ((totalFields - totalNulls) / totalFields) * 100;
      
      if (quality.completeness < 90) {
        quality.issues.push({
          type: 'completeness',
          severity: 'medium',
          message: `Data completeness is ${quality.completeness.toFixed(1)}%`,
          fields: Object.entries(nullCounts).map(([field, count]) => ({
            field,
            nullPercentage: (count / data.length) * 100
          }))
        });
      }
      
      // Check consistency
      const schemas = data.map(record => JSON.stringify(Object.keys(record).sort()));
      const uniqueSchemas = new Set(schemas);
      
      if (uniqueSchemas.size > 1) {
        quality.consistency = ((data.length - uniqueSchemas.size + 1) / data.length) * 100;
        quality.issues.push({
          type: 'consistency',
          severity: 'high',
          message: 'Inconsistent record schemas detected'
        });
      }
      
      // Check validity
      const validityIssues = this.checkDataValidity(data);
      if (validityIssues.length > 0) {
        quality.validity = ((data.length - validityIssues.length) / data.length) * 100;
        quality.issues.push({
          type: 'validity',
          severity: 'medium',
          message: 'Data validation issues found',
          details: validityIssues
        });
      }
    }
    
    quality.overall = (quality.completeness + quality.consistency + quality.validity + quality.uniqueness) / 4;
    
    return quality;
  }

  checkDataValidity(data) {
    const issues = [];
    
    data.forEach((record, index) => {
      for (const [key, value] of Object.entries(record)) {
        // Check email validity
        if (typeof value === 'string' && value.includes('@')) {
          if (!this.sensitiveDataPatterns.email.test(value)) {
            issues.push({
              record: index,
              field: key,
              value,
              issue: 'Invalid email format'
            });
          }
        }
        
        // Check date validity
        if (typeof value === 'string' && this.isDate(value)) {
          const date = new Date(value);
          if (date > new Date() || date < new Date('1900-01-01')) {
            issues.push({
              record: index,
              field: key,
              value,
              issue: 'Date out of reasonable range'
            });
          }
        }
      }
    });
    
    return issues;
  }

  findRelationships(data) {
    const relationships = [];
    
    if (!Array.isArray(data) || data.length === 0) {
      return relationships;
    }
    
    // Look for foreign key relationships
    for (const key of Object.keys(data[0])) {
      if (key.endsWith('Id') || key.endsWith('_id')) {
        const values = data.map(record => record[key]);
        const uniqueValues = new Set(values);
        
        relationships.push({
          field: key,
          type: 'potential_foreign_key',
          cardinality: uniqueValues.size < data.length ? 'many-to-one' : 'one-to-one',
          uniqueValues: uniqueValues.size
        });
      }
    }
    
    // Look for parent-child relationships
    if (data[0].parentId !== undefined || data[0].parent_id !== undefined) {
      relationships.push({
        type: 'hierarchical',
        parentField: data[0].parentId !== undefined ? 'parentId' : 'parent_id',
        description: 'Data appears to have hierarchical structure'
      });
    }
    
    return relationships;
  }

  async generateTestData(schema, options = {}) {
    const count = options.count || 10;
    const locale = options.locale || 'en';
    const seed = options.seed || null;
    
    if (seed) {
      faker.seed(seed);
    }
    
    faker.locale = locale;
    
    const data = [];
    
    for (let i = 0; i < count; i++) {
      const record = await this.generateRecord(schema);
      data.push(record);
    }
    
    // Apply relationships if specified
    if (options.relationships) {
      data.forEach((record, index) => {
        for (const relationship of options.relationships) {
          this.applyRelationship(record, index, data, relationship);
        }
      });
    }
    
    // Apply constraints if specified
    if (options.constraints) {
      this.applyConstraints(data, options.constraints);
    }
    
    return data;
  }

  async generateRecord(schema) {
    if (schema.type === 'object') {
      const record = {};
      
      for (const [key, fieldSchema] of Object.entries(schema.properties)) {
        record[key] = await this.generateFieldValue(key, fieldSchema);
      }
      
      return record;
    } else if (schema.type === 'array') {
      const length = Math.floor(Math.random() * 5) + 1;
      const array = [];
      
      for (let i = 0; i < length; i++) {
        array.push(await this.generateRecord(schema.itemSchema));
      }
      
      return array;
    }
    
    return this.generateFieldValue('value', schema);
  }

  async generateFieldValue(fieldName, schema) {
    // Use AI for intelligent data generation
    if (schema.aiGenerated) {
      try {
        const response = await axios.post(`${this.aiServiceUrl}/generate/test-data-field`, {
          fieldName,
          schema,
          context: schema.context
        });
        
        return response.data.value;
      } catch (error) {
        console.error('AI data generation failed:', error);
      }
    }
    
    // Fallback to faker-based generation
    switch (schema.type) {
      case 'string':
        return this.generateStringValue(fieldName, schema);
      
      case 'number':
        return this.generateNumberValue(schema);
      
      case 'boolean':
        return Math.random() > 0.5;
      
      case 'array':
        const length = Math.floor(Math.random() * 5) + 1;
        return Array(length).fill(null).map(() => this.generateFieldValue(fieldName, { type: schema.itemType }));
      
      default:
        return null;
    }
  }

  generateStringValue(fieldName, schema) {
    const lowerFieldName = fieldName.toLowerCase();
    
    // Try to infer from field name
    if (lowerFieldName.includes('email')) return faker.internet.email();
    if (lowerFieldName.includes('name')) {
      if (lowerFieldName.includes('first')) return faker.name.firstName();
      if (lowerFieldName.includes('last')) return faker.name.lastName();
      return faker.name.findName();
    }
    if (lowerFieldName.includes('phone')) return faker.phone.phoneNumber();
    if (lowerFieldName.includes('address')) return faker.address.streetAddress();
    if (lowerFieldName.includes('city')) return faker.address.city();
    if (lowerFieldName.includes('country')) return faker.address.country();
    if (lowerFieldName.includes('company')) return faker.company.companyName();
    if (lowerFieldName.includes('url')) return faker.internet.url();
    if (lowerFieldName.includes('date')) return faker.date.recent().toISOString();
    if (lowerFieldName.includes('description')) return faker.lorem.paragraph();
    if (lowerFieldName.includes('title')) return faker.lorem.sentence();
    if (lowerFieldName.includes('id')) return faker.datatype.uuid();
    
    // Use format if specified
    if (schema.format) {
      switch (schema.format) {
        case 'email': return faker.internet.email();
        case 'url': return faker.internet.url();
        case 'uuid': return faker.datatype.uuid();
        case 'date': return faker.date.recent().toISOString().split('T')[0];
        case 'datetime': return faker.date.recent().toISOString();
      }
    }
    
    // Default to random words
    const minLength = schema.minLength || 5;
    const maxLength = schema.maxLength || 50;
    const targetLength = Math.floor(Math.random() * (maxLength - minLength)) + minLength;
    
    return faker.lorem.words(Math.ceil(targetLength / 5)).substring(0, targetLength);
  }

  generateNumberValue(schema) {
    const min = schema.min !== undefined ? schema.min : 0;
    const max = schema.max !== undefined ? schema.max : 1000;
    
    if (schema.isInteger) {
      return faker.datatype.number({ min, max });
    }
    
    return faker.datatype.float({ min, max, precision: 0.01 });
  }

  applyRelationship(record, index, allRecords, relationship) {
    switch (relationship.type) {
      case 'foreign_key':
        // Reference another record
        if (index > 0 && Math.random() > 0.3) {
          const referencedIndex = Math.floor(Math.random() * index);
          record[relationship.field] = allRecords[referencedIndex][relationship.referencedField];
        }
        break;
      
      case 'hierarchical':
        // Create parent-child relationship
        if (index > 0 && Math.random() > 0.5) {
          const parentIndex = Math.floor(Math.random() * index);
          record[relationship.parentField] = allRecords[parentIndex].id;
        }
        break;
      
      case 'sequential':
        // Create sequential values
        record[relationship.field] = relationship.startValue + index * (relationship.increment || 1);
        break;
    }
  }

  applyConstraints(data, constraints) {
    for (const constraint of constraints) {
      switch (constraint.type) {
        case 'unique':
          this.ensureUnique(data, constraint.field);
          break;
        
        case 'range':
          this.ensureRange(data, constraint.field, constraint.min, constraint.max);
          break;
        
        case 'distribution':
          this.applyDistribution(data, constraint.field, constraint.distribution);
          break;
      }
    }
  }

  ensureUnique(data, field) {
    const seen = new Set();
    
    data.forEach(record => {
      while (seen.has(record[field])) {
        // Regenerate value
        record[field] = faker.datatype.uuid();
      }
      seen.add(record[field]);
    });
  }

  ensureRange(data, field, min, max) {
    data.forEach(record => {
      if (typeof record[field] === 'number') {
        record[field] = Math.max(min, Math.min(max, record[field]));
      }
    });
  }

  applyDistribution(data, field, distribution) {
    switch (distribution.type) {
      case 'normal':
        this.applyNormalDistribution(data, field, distribution);
        break;
      
      case 'categorical':
        this.applyCategoricalDistribution(data, field, distribution);
        break;
    }
  }

  applyNormalDistribution(data, field, distribution) {
    const mean = distribution.mean || 0;
    const stdDev = distribution.stdDev || 1;
    
    data.forEach(record => {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      
      record[field] = mean + z0 * stdDev;
    });
  }

  applyCategoricalDistribution(data, field, distribution) {
    const categories = distribution.categories;
    const probabilities = distribution.probabilities || 
      new Array(categories.length).fill(1 / categories.length);
    
    data.forEach(record => {
      const random = Math.random();
      let cumulative = 0;
      
      for (let i = 0; i < categories.length; i++) {
        cumulative += probabilities[i];
        if (random < cumulative) {
          record[field] = categories[i];
          break;
        }
      }
    });
  }

  async getAIPatternAnalysis(data) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/analyze/data-patterns`, {
        data: data.slice(0, 100) // Send sample
      });
      
      return response.data.patterns || [];
    } catch (error) {
      return [];
    }
  }

  async createDataSnapshot(name, data, metadata = {}) {
    const snapshot = {
      id: crypto.randomBytes(16).toString('hex'),
      name,
      timestamp: new Date().toISOString(),
      metadata,
      dataHash: this.hashData(data),
      analysis: await this.analyzeTestData(data)
    };
    
    // Save snapshot
    const snapshotPath = path.join(this.dataDir, 'snapshots', `${snapshot.id}.json`);
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
    
    // Save data
    const dataPath = path.join(this.dataDir, 'snapshots', `${snapshot.id}.data.json`);
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    
    return snapshot;
  }

  hashData(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  async compareSnapshots(snapshotId1, snapshotId2) {
    const snapshot1 = await this.loadSnapshot(snapshotId1);
    const snapshot2 = await this.loadSnapshot(snapshotId2);
    
    const comparison = {
      snapshot1: { id: snapshotId1, name: snapshot1.name },
      snapshot2: { id: snapshotId2, name: snapshot2.name },
      schemaChanges: this.compareSchemas(snapshot1.analysis.schema, snapshot2.analysis.schema),
      statisticalChanges: this.compareStatistics(snapshot1.analysis.statistics, snapshot2.analysis.statistics),
      qualityChanges: this.compareQuality(snapshot1.analysis.quality, snapshot2.analysis.quality)
    };
    
    return comparison;
  }

  compareSchemas(schema1, schema2) {
    const changes = {
      added: [],
      removed: [],
      modified: []
    };
    
    // Compare properties
    if (schema1.type === 'object' && schema2.type === 'object') {
      const keys1 = Object.keys(schema1.properties);
      const keys2 = Object.keys(schema2.properties);
      
      changes.added = keys2.filter(key => !keys1.includes(key));
      changes.removed = keys1.filter(key => !keys2.includes(key));
      
      // Check for modifications
      const commonKeys = keys1.filter(key => keys2.includes(key));
      for (const key of commonKeys) {
        if (JSON.stringify(schema1.properties[key]) !== JSON.stringify(schema2.properties[key])) {
          changes.modified.push({
            field: key,
            from: schema1.properties[key],
            to: schema2.properties[key]
          });
        }
      }
    }
    
    return changes;
  }

  compareStatistics(stats1, stats2) {
    const changes = {};
    
    // Compare total records
    if (stats1.totalRecords !== stats2.totalRecords) {
      changes.totalRecords = {
        from: stats1.totalRecords,
        to: stats2.totalRecords,
        change: stats2.totalRecords - stats1.totalRecords,
        percentChange: ((stats2.totalRecords - stats1.totalRecords) / stats1.totalRecords * 100).toFixed(2)
      };
    }
    
    // Compare field statistics
    changes.fieldChanges = {};
    
    for (const field of Object.keys(stats1.fieldStatistics)) {
      if (stats2.fieldStatistics[field]) {
        const fieldChanges = {};
        const stat1 = stats1.fieldStatistics[field];
        const stat2 = stats2.fieldStatistics[field];
        
        if (stat1.unique !== stat2.unique) {
          fieldChanges.uniqueValues = {
            from: stat1.unique,
            to: stat2.unique
          };
        }
        
        if (Object.keys(fieldChanges).length > 0) {
          changes.fieldChanges[field] = fieldChanges;
        }
      }
    }
    
    return changes;
  }

  compareQuality(quality1, quality2) {
    return {
      completeness: {
        from: quality1.completeness,
        to: quality2.completeness,
        improved: quality2.completeness > quality1.completeness
      },
      consistency: {
        from: quality1.consistency,
        to: quality2.consistency,
        improved: quality2.consistency > quality1.consistency
      },
      validity: {
        from: quality1.validity,
        to: quality2.validity,
        improved: quality2.validity > quality1.validity
      },
      overall: {
        from: quality1.overall,
        to: quality2.overall,
        improved: quality2.overall > quality1.overall
      }
    };
  }

  async loadSnapshot(snapshotId) {
    const snapshotPath = path.join(this.dataDir, 'snapshots', `${snapshotId}.json`);
    const content = await fs.readFile(snapshotPath, 'utf-8');
    return JSON.parse(content);
  }
}

module.exports = TestDataIntelligence; 