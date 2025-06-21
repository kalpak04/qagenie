const { Server } = require('socket.io');
const { chromium } = require('playwright');
const axios = require('axios');
const crypto = require('crypto');

class CollaborativeTestingPlatform {
  constructor(options = {}) {
    this.port = options.port || 8080;
    this.sessions = new Map();
    this.activeUsers = new Map();
    this.annotations = new Map();
    this.io = null;
    this.aiServiceUrl = options.aiServiceUrl || 'http://localhost:8000';
  }

  async startServer() {
    this.io = new Server(this.port, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      console.log('New user connected:', socket.id);

      socket.on('join-session', async (data) => {
        await this.handleJoinSession(socket, data);
      });

      socket.on('create-session', async (data) => {
        await this.handleCreateSession(socket, data);
      });

      socket.on('action', async (data) => {
        await this.handleAction(socket, data);
      });

      socket.on('annotation', async (data) => {
        await this.handleAnnotation(socket, data);
      });

      socket.on('comment', async (data) => {
        await this.handleComment(socket, data);
      });

      socket.on('request-control', async (data) => {
        await this.handleControlRequest(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });

    console.log(`Collaborative testing server started on port ${this.port}`);
  }

  async handleCreateSession(socket, data) {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const session = {
      id: sessionId,
      name: data.name,
      creator: data.userId,
      participants: new Set([data.userId]),
      browser: null,
      context: null,
      page: null,
      recording: {
        actions: [],
        screenshots: [],
        annotations: []
      },
      currentController: data.userId,
      createdAt: new Date().toISOString()
    };

    // Create browser instance
    session.browser = await chromium.launch({ headless: false });
    session.context = await session.browser.newContext({
      recordVideo: {
        dir: `./recordings/sessions/${sessionId}`,
        size: { width: 1280, height: 720 }
      }
    });
    session.page = await session.context.newPage();

    // Set up page event listeners
    this.setupPageListeners(session);

    this.sessions.set(sessionId, session);
    this.activeUsers.set(data.userId, {
      socketId: socket.id,
      sessionId,
      name: data.userName
    });

    socket.join(sessionId);
    socket.emit('session-created', {
      sessionId,
      url: session.page.url()
    });

    // Notify others
    this.io.to(sessionId).emit('user-joined', {
      userId: data.userId,
      userName: data.userName
    });
  }

  async handleJoinSession(socket, data) {
    const session = this.sessions.get(data.sessionId);
    
    if (!session) {
      socket.emit('error', { message: 'Session not found' });
      return;
    }

    session.participants.add(data.userId);
    this.activeUsers.set(data.userId, {
      socketId: socket.id,
      sessionId: data.sessionId,
      name: data.userName
    });

    socket.join(data.sessionId);

    // Send current state
    socket.emit('session-joined', {
      sessionId: data.sessionId,
      url: session.page.url(),
      screenshot: await session.page.screenshot({ encoding: 'base64' }),
      participants: Array.from(session.participants).map(id => ({
        id,
        name: this.activeUsers.get(id)?.name
      })),
      currentController: session.currentController,
      recording: session.recording
    });

    // Notify others
    socket.to(data.sessionId).emit('user-joined', {
      userId: data.userId,
      userName: data.userName
    });
  }

  async handleAction(socket, data) {
    const user = this.getUserBySocket(socket.id);
    if (!user) return;

    const session = this.sessions.get(user.sessionId);
    if (!session) return;

    // Check if user has control
    if (session.currentController !== user.userId && !data.forceControl) {
      socket.emit('error', { message: 'You do not have control' });
      return;
    }

    try {
      // Execute action on the page
      await this.executeAction(session.page, data.action);

      // Record action
      session.recording.actions.push({
        ...data.action,
        userId: user.userId,
        userName: user.name,
        timestamp: new Date().toISOString()
      });

      // Take screenshot after action
      const screenshot = await session.page.screenshot({ encoding: 'base64' });
      session.recording.screenshots.push({
        data: screenshot,
        timestamp: new Date().toISOString(),
        actionIndex: session.recording.actions.length - 1
      });

      // Broadcast to all participants
      this.io.to(user.sessionId).emit('action-performed', {
        action: data.action,
        screenshot,
        performer: {
          id: user.userId,
          name: user.name
        }
      });
    } catch (error) {
      socket.emit('error', { 
        message: 'Failed to perform action', 
        error: error.message 
      });
    }
  }

  async executeAction(page, action) {
    switch (action.type) {
      case 'navigate':
        await page.goto(action.url);
        break;
      
      case 'click':
        await page.click(action.selector);
        break;
      
      case 'type':
        await page.type(action.selector, action.text);
        break;
      
      case 'select':
        await page.selectOption(action.selector, action.value);
        break;
      
      case 'screenshot':
        await page.screenshot({ path: action.path });
        break;
      
      case 'scroll':
        await page.evaluate(({ x, y }) => window.scrollTo(x, y), action);
        break;
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async handleAnnotation(socket, data) {
    const user = this.getUserBySocket(socket.id);
    if (!user) return;

    const session = this.sessions.get(user.sessionId);
    if (!session) return;

    const annotation = {
      id: crypto.randomBytes(8).toString('hex'),
      ...data.annotation,
      userId: user.userId,
      userName: user.name,
      timestamp: new Date().toISOString()
    };

    session.recording.annotations.push(annotation);

    // Store annotation for persistence
    if (!this.annotations.has(user.sessionId)) {
      this.annotations.set(user.sessionId, []);
    }
    this.annotations.get(user.sessionId).push(annotation);

    // Broadcast to all participants
    this.io.to(user.sessionId).emit('annotation-added', { annotation });
  }

  async handleComment(socket, data) {
    const user = this.getUserBySocket(socket.id);
    if (!user) return;

    const comment = {
      id: crypto.randomBytes(8).toString('hex'),
      text: data.text,
      userId: user.userId,
      userName: user.name,
      timestamp: new Date().toISOString(),
      attachedTo: data.attachedTo // Can be an action ID or annotation ID
    };

    // Broadcast to all participants
    this.io.to(user.sessionId).emit('comment-added', { comment });

    // If comment is about a potential issue, analyze it
    if (data.isIssue) {
      await this.analyzeIssue(user.sessionId, comment, data.screenshot);
    }
  }

  async handleControlRequest(socket, data) {
    const user = this.getUserBySocket(socket.id);
    if (!user) return;

    const session = this.sessions.get(user.sessionId);
    if (!session) return;

    // Notify current controller
    const currentController = this.activeUsers.get(session.currentController);
    if (currentController) {
      this.io.to(currentController.socketId).emit('control-requested', {
        requesterId: user.userId,
        requesterName: user.name
      });
    }

    // Auto-approve if no response in 10 seconds
    setTimeout(() => {
      if (session.currentController === user.userId) return;
      
      session.currentController = user.userId;
      this.io.to(user.sessionId).emit('control-changed', {
        newController: user.userId,
        newControllerName: user.name
      });
    }, 10000);
  }

  handleDisconnect(socket) {
    const user = this.getUserBySocket(socket.id);
    if (!user) return;

    const session = this.sessions.get(user.sessionId);
    if (session) {
      session.participants.delete(user.userId);
      
      // Notify others
      socket.to(user.sessionId).emit('user-left', {
        userId: user.userId,
        userName: user.name
      });

      // If session creator left, transfer control
      if (session.creator === user.userId && session.participants.size > 0) {
        const newController = session.participants.values().next().value;
        session.currentController = newController;
        
        this.io.to(user.sessionId).emit('control-changed', {
          newController,
          newControllerName: this.activeUsers.get(newController)?.name
        });
      }

      // Close session if empty
      if (session.participants.size === 0) {
        this.closeSession(user.sessionId);
      }
    }

    this.activeUsers.delete(user.userId);
  }

  getUserBySocket(socketId) {
    for (const [userId, userData] of this.activeUsers) {
      if (userData.socketId === socketId) {
        return { userId, ...userData };
      }
    }
    return null;
  }

  setupPageListeners(session) {
    // Listen for console messages
    session.page.on('console', msg => {
      this.io.to(session.id).emit('console-message', {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });

    // Listen for page errors
    session.page.on('pageerror', error => {
      this.io.to(session.id).emit('page-error', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for network requests
    session.page.on('request', request => {
      this.io.to(session.id).emit('network-request', {
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
    });

    // Listen for responses
    session.page.on('response', response => {
      this.io.to(session.id).emit('network-response', {
        url: response.url(),
        status: response.status(),
        timestamp: new Date().toISOString()
      });
    });
  }

  async analyzeIssue(sessionId, comment, screenshot) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/analyze/issue`, {
        comment: comment.text,
        screenshot,
        sessionId
      });

      if (response.data.isBug) {
        this.io.to(sessionId).emit('bug-detected', {
          comment,
          analysis: response.data.analysis,
          suggestedTestCase: response.data.testCase
        });
      }
    } catch (error) {
      console.error('Failed to analyze issue:', error);
    }
  }

  async exportSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const annotations = this.annotations.get(sessionId) || [];

    return {
      id: sessionId,
      name: session.name,
      createdAt: session.createdAt,
      duration: Date.now() - new Date(session.createdAt).getTime(),
      participants: Array.from(session.participants).map(id => ({
        id,
        name: this.activeUsers.get(id)?.name
      })),
      recording: session.recording,
      annotations,
      testCases: await this.generateTestCasesFromSession(session)
    };
  }

  async generateTestCasesFromSession(session) {
    // Group actions into logical test cases
    const testCases = [];
    let currentTestCase = {
      name: 'Test Case 1',
      steps: []
    };

    for (const action of session.recording.actions) {
      // Check if this action starts a new test case
      if (action.type === 'navigate' && currentTestCase.steps.length > 0) {
        testCases.push(currentTestCase);
        currentTestCase = {
          name: `Test Case ${testCases.length + 1}`,
          steps: []
        };
      }

      currentTestCase.steps.push({
        action: action.type,
        target: action.selector || action.url,
        value: action.text || action.value,
        description: this.generateStepDescription(action)
      });
    }

    if (currentTestCase.steps.length > 0) {
      testCases.push(currentTestCase);
    }

    // Add assertions based on annotations
    for (const annotation of session.recording.annotations) {
      if (annotation.type === 'assertion') {
        const testCaseIndex = Math.floor(annotation.actionIndex / 5); // Rough grouping
        if (testCases[testCaseIndex]) {
          testCases[testCaseIndex].assertions = testCases[testCaseIndex].assertions || [];
          testCases[testCaseIndex].assertions.push({
            type: annotation.assertionType,
            target: annotation.selector,
            expected: annotation.expectedValue
          });
        }
      }
    }

    return testCases;
  }

  generateStepDescription(action) {
    switch (action.type) {
      case 'navigate':
        return `Navigate to ${action.url}`;
      case 'click':
        return `Click on ${action.selector}`;
      case 'type':
        return `Type "${action.text}" into ${action.selector}`;
      case 'select':
        return `Select "${action.value}" from ${action.selector}`;
      default:
        return `Perform ${action.type} action`;
    }
  }

  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Export session data before closing
    const exportData = await this.exportSession(sessionId);
    
    // Save to file
    const fs = require('fs').promises;
    await fs.writeFile(
      `./exports/session_${sessionId}.json`,
      JSON.stringify(exportData, null, 2)
    );

    // Close browser
    if (session.browser) {
      await session.browser.close();
    }

    // Clean up
    this.sessions.delete(sessionId);
    this.annotations.delete(sessionId);

    console.log(`Session ${sessionId} closed and exported`);
  }

  async getSessionInsights(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const insights = {
      totalActions: session.recording.actions.length,
      uniqueParticipants: session.participants.size,
      duration: Date.now() - new Date(session.createdAt).getTime(),
      actionsPerUser: {},
      mostActiveUser: null,
      commonPatterns: [],
      potentialIssues: []
    };

    // Analyze actions per user
    for (const action of session.recording.actions) {
      insights.actionsPerUser[action.userId] = 
        (insights.actionsPerUser[action.userId] || 0) + 1;
    }

    // Find most active user
    let maxActions = 0;
    for (const [userId, count] of Object.entries(insights.actionsPerUser)) {
      if (count > maxActions) {
        maxActions = count;
        insights.mostActiveUser = {
          id: userId,
          name: this.activeUsers.get(userId)?.name,
          actionCount: count
        };
      }
    }

    // Identify common patterns
    insights.commonPatterns = this.identifyPatterns(session.recording.actions);

    // Identify potential issues
    insights.potentialIssues = this.identifyPotentialIssues(session);

    return insights;
  }

  identifyPatterns(actions) {
    const patterns = [];
    const sequences = {};

    // Look for repeated sequences
    for (let i = 0; i < actions.length - 2; i++) {
      const sequence = `${actions[i].type}-${actions[i + 1].type}-${actions[i + 2].type}`;
      sequences[sequence] = (sequences[sequence] || 0) + 1;
    }

    // Find patterns that occur more than once
    for (const [sequence, count] of Object.entries(sequences)) {
      if (count > 1) {
        patterns.push({
          sequence: sequence.split('-'),
          occurrences: count
        });
      }
    }

    return patterns;
  }

  identifyPotentialIssues(session) {
    const issues = [];

    // Check for rapid repeated actions (possible frustration)
    let lastAction = null;
    let repeatCount = 0;

    for (const action of session.recording.actions) {
      if (lastAction && 
          action.type === lastAction.type && 
          action.selector === lastAction.selector &&
          new Date(action.timestamp) - new Date(lastAction.timestamp) < 1000) {
        repeatCount++;
        
        if (repeatCount > 2) {
          issues.push({
            type: 'repeated_action',
            description: `User repeatedly performed ${action.type} on ${action.selector}`,
            severity: 'medium'
          });
        }
      } else {
        repeatCount = 0;
      }
      
      lastAction = action;
    }

    // Check for long pauses (possible confusion)
    for (let i = 1; i < session.recording.actions.length; i++) {
      const timeDiff = new Date(session.recording.actions[i].timestamp) - 
                       new Date(session.recording.actions[i - 1].timestamp);
      
      if (timeDiff > 30000) { // 30 seconds
        issues.push({
          type: 'long_pause',
          description: `Long pause detected after ${session.recording.actions[i - 1].type}`,
          severity: 'low'
        });
      }
    }

    return issues;
  }
}

module.exports = CollaborativeTestingPlatform; 