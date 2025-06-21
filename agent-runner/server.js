const express = require('express');
const cors = require('cors');
const PlaywrightAgent = require('./agent');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());

// Store active agent instances
const agents = new Map();

// Create and initialize a new agent
app.post('/agent', async (req, res) => {
  try {
    const { name, baseUrl, headless = false, slowMo = 100 } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    
    if (agents.has(name)) {
      return res.status(409).json({ error: `Agent '${name}' already exists` });
    }
    
    console.log(`Creating new agent: ${name}`);
    const agent = new PlaywrightAgent({ 
      baseUrl, 
      headless, 
      slowMo,
      aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000'
    });
    
    await agent.initialize();
    agents.set(name, agent);
    
    res.status(201).json({ 
      message: 'Agent created successfully',
      name,
      status: 'initialized'
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start a recording session
app.post('/agent/:name/record', async (req, res) => {
  try {
    const { name } = req.params;
    const { sessionName } = req.body;
    
    if (!sessionName) {
      return res.status(400).json({ error: 'Session name is required' });
    }
    
    const agent = agents.get(name);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${name}' not found` });
    }
    
    const recordingId = await agent.recordSession(sessionName);
    
    res.json({ 
      message: 'Recording started',
      recordingId,
      agentName: name
    });
  } catch (error) {
    console.error('Error starting recording:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a step to a recording
app.post('/agent/:name/record/:recordingId/step', async (req, res) => {
  try {
    const { name, recordingId } = req.params;
    const { action, selector, value } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }
    
    const agent = agents.get(name);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${name}' not found` });
    }
    
    const step = await agent.addStep(recordingId, action, selector, value);
    
    res.json({ 
      message: 'Step added successfully',
      step
    });
  } catch (error) {
    console.error('Error adding step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop a recording and save it
app.post('/agent/:name/record/:recordingId/stop', async (req, res) => {
  try {
    const { name, recordingId } = req.params;
    
    const agent = agents.get(name);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${name}' not found` });
    }
    
    const recording = await agent.stopRecording(recordingId);
    
    res.json({ 
      message: 'Recording stopped and saved',
      recording
    });
  } catch (error) {
    console.error('Error stopping recording:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate test cases from recording
app.post('/agent/:name/recording/:recordingId/generate', async (req, res) => {
  try {
    const { name, recordingId } = req.params;
    
    const agent = agents.get(name);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${name}' not found` });
    }
    
    const testCases = await agent.generateTestCases(recordingId);
    
    res.json({ 
      message: 'Test cases generated successfully',
      testCases
    });
  } catch (error) {
    console.error('Error generating test cases:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export test cases as Cucumber feature files
app.post('/agent/:name/export', async (req, res) => {
  try {
    const { name } = req.params;
    const { format = 'cucumber' } = req.body;
    
    const agent = agents.get(name);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${name}' not found` });
    }
    
    const filePath = await agent.exportTestCases(format);
    
    res.json({ 
      message: 'Test cases exported successfully',
      filePath,
      format
    });
  } catch (error) {
    console.error('Error exporting test cases:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run a generated test case
app.post('/agent/:name/test/:testCaseId/run', async (req, res) => {
  try {
    const { name, testCaseId } = req.params;
    
    const agent = agents.get(name);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${name}' not found` });
    }
    
    const result = await agent.runTestCase(testCaseId);
    
    res.json({ 
      message: 'Test case executed',
      result
    });
  } catch (error) {
    console.error('Error running test case:', error);
    res.status(500).json({ error: error.message });
  }
});

// Close and remove an agent
app.delete('/agent/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    const agent = agents.get(name);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${name}' not found` });
    }
    
    await agent.close();
    agents.delete(name);
    
    res.json({ 
      message: 'Agent closed and removed',
      name
    });
  } catch (error) {
    console.error('Error closing agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all active agents
app.get('/agents', (req, res) => {
  const agentList = Array.from(agents.keys()).map(name => ({
    name,
    status: 'active'
  }));
  
  res.json({ agents: agentList });
});

// Start the server
app.listen(port, () => {
  console.log(`Agentic Playwright server running on port ${port}`);
}); 