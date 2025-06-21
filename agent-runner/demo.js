const PlaywrightAgent = require('./agent');

async function runDemo() {
  console.log('Starting Playwright Agent Demo...');
  
  try {
    // Initialize agent
    const agent = new PlaywrightAgent({
      baseUrl: 'http://localhost:3000',
      headless: false, // Show the browser for demo purposes
      slowMo: 200 // Slow down to see actions
    });
    
    await agent.initialize();
    console.log('Agent initialized');
    
    // Start recording a session
    const recordingId = await agent.recordSession('Demo Login Flow');
    console.log(`Recording started with ID: ${recordingId}`);
    
    // Navigate to the login page
    await agent.addStep(recordingId, 'navigate', null, 'http://localhost:3000/login');
    console.log('Navigated to login page');
    
    // Fill in email
    await agent.addStep(recordingId, 'fill', 'input#email-address', 'demo@example.com');
    console.log('Email entered');
    
    // Fill in password
    await agent.addStep(recordingId, 'fill', 'input#password', 'password123');
    console.log('Password entered');
    
    // Take a screenshot
    await agent.addStep(recordingId, 'screenshot', null);
    console.log('Screenshot captured');
    
    // Click login button
    await agent.addStep(recordingId, 'click', 'button[type="submit"]');
    console.log('Login button clicked');
    
    // Wait for navigation
    await agent.addStep(recordingId, 'wait', null, '2000');
    console.log('Waiting for navigation');
    
    // Assert we're on dashboard
    await agent.addStep(recordingId, 'assert', 'h1');
    console.log('Dashboard verified');
    
    // Stop recording
    const recording = await agent.stopRecording(recordingId);
    console.log('Recording stopped');
    
    // Generate test cases
    console.log('Generating test cases...');
    const testCases = await agent.generateTestCases(recordingId);
    console.log(`Generated ${testCases.length} test cases`);
    
    // Export as Cucumber feature
    const featurePath = await agent.exportTestCases('cucumber');
    console.log(`Exported Cucumber feature file to: ${featurePath}`);
    
    // Run a test case
    if (testCases.length > 0) {
      console.log(`Running test case: ${testCases[0].id}`);
      const result = await agent.runTestCase(testCases[0].id);
      console.log(`Test execution result: ${result.passed ? 'PASSED' : 'FAILED'}`);
      
      if (!result.passed) {
        console.log('Failed steps:');
        result.results.filter(r => r.status === 'error').forEach(r => {
          console.log(`- Step ${r.step}: ${r.error}`);
        });
      }
    }
    
    // Close browser
    await agent.close();
    console.log('Demo completed successfully!');
    
  } catch (error) {
    console.error('Error running demo:', error);
  }
}

// Run the demo
runDemo(); 