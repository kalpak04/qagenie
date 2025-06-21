# QA-Genie

QA-Genie is an AI-driven QA automation agent that streamlines the entire quality assurance pipeline by automating test case generation, ticket creation, and CI integration.

## Quick Start with the Application Launcher

We now provide a convenient Python script to launch all components of QA-Genie in the correct order:

```bash
# Make the script executable (Linux/Mac)
chmod +x start_app.py

# Run the application
python start_app.py
```

The launcher script will:
1. Check for required prerequisites (Python, Node.js, npm)
2. Verify environment files and copy from examples if needed
3. Install dependencies for all components
4. Check port availability (8000, 5000, 3000)
5. Start services in order: AI service → Server → Client
6. Provide health checks and status monitoring

Press Ctrl+C to gracefully stop all services when you're done.

## Manual Setup and Installation

If you prefer to set up and run the components manually, follow these steps:

### Prerequisites

- Node.js (v16+)
- npm or yarn
- MongoDB
- Python 3.8+
- pip

### Local Development Setup

1. Clone the repository
2. Set up MongoDB locally
3. Configure environment variables for each component

### Server Setup

```bash
cd server
cp env.example .env
# Edit .env file with your configuration
npm install
npm run dev
```

### AI Service Setup

```bash
cd ai_service
cp config.toml.example config.toml
# Edit config.toml with your IBM Watson X AI credentials
pip install -r requirements.txt
uvicorn app:app --reload
```

### Client Setup

```bash
cd client
npm install
npm start
```

## Deployment

The application is configured for deployment on various platforms:

- Server: Render
- Client: Vercel
- AI Service: Custom deployment

## Features

- 🧠 **PRD Analysis**: Ingest PRDs from PDF, Markdown, or plaintext
- 🤖 **AI-Powered Test Generation**: Generate structured test cases using LLM
- 🎫 **Ticket Integration**: Create or update tickets in Jira and other issue trackers
- 🥒 **Cucumber Integration**: Generate Cucumber feature files from test cases
- 📊 **CI Integration**: Trigger CI jobs and parse test reports
- 📱 **Multiple Interfaces**: CLI and Web UI for complete control

## Tech Stack

- **Frontend**: React with Tailwind CSS
- **Backend**: Node.js with Express
- **Database**: MongoDB
- **Authentication**: JWT
- **AI**: Python service with IBM Watson X AI integration

## Prerequisites

- Node.js (v16+)
- Python (v3.11+)
- MongoDB (v5+)
- IBM Cloud account with Watson X AI access
- IBM Cloud API key
- Jira API token (for Jira integration)
- Git access token (for repository integration)

## Installation

1. Clone the repository
   ```
   git clone https://github.com/your-username/qa-genie.git
   cd qa-genie
   ```

2. Install dependencies
   ```
   # Install backend dependencies
   cd server
   npm install

   # Install frontend dependencies
   cd ../client
   npm install
   ```

3. Configure environment variables
   ```
   # In the server directory, create a .env file
   cp .env.example .env
   # Edit the .env file with your configuration
   ```

4. Start the application
   ```
   # Start the backend server
   cd server
   npm run dev

   # In a separate terminal, start the frontend
   cd client
   npm run dev
   ```

5. Access the web application at `http://localhost:3000`

## CLI Usage

QA-Genie also provides a CLI for quick automation:

```
# Install the CLI globally
npm install -g qa-genie-cli

# Ingest a PRD
qa-genie ingest --file path/to/prd.pdf

# Generate test cases
qa-genie generate --project project-name

# Run the full pipeline
qa-genie run-pipeline --project project-name
```

## Configuration

Configuration options can be set in the `.env` file or through the web UI:

- `IBM_CLOUD_API_KEY`: Your IBM Cloud API key
- `WATSONX_URL`: Watson X AI endpoint URL
- `WATSONX_PROJECT_ID`: Watson X AI project or space ID
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT authentication
- `JIRA_API_TOKEN`: Jira API token
- `JIRA_INSTANCE`: Jira instance URL
- `GIT_TOKEN`: Git access token

## License

MIT 