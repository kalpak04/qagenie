# QA-Genie Architecture

QA-Genie is a comprehensive QA automation tool that automates the end-to-end quality assurance pipeline. This document outlines the system architecture and components.

## System Overview

QA-Genie follows a microservices architecture with the following main components:

1. **Frontend**: A React-based UI with Tailwind CSS for styling
2. **Backend API**: Node.js/Express server handling user management, PRD storage, and orchestration
3. **AI Service**: Python-based microservice that integrates with IBM Watson X AI
4. **Database**: MongoDB for data persistence

## Architecture Diagram

```
+-------------+     +---------------+     +---------------+     +------------------+
|  React UI   | <-> | Node.js API   | <-> | Python AI     | <-> | IBM Watson X AI  |
|  (Client)   |     | (Server)      |     | (AI Service)  |     | (LLM Service)    |
+-------------+     +---------------+     +---------------+     +------------------+
                          |                     |
                          v                     |
                    +------------+              |
                    | MongoDB    | <------------+
                    | (Database) |
                    +------------+
```

## Component Details

### 1. Frontend (Client)

- **Tech Stack**: React, Tailwind CSS
- **Key Features**:
  - PRD upload and viewing
  - Test case management
  - User authentication
  - Integration settings
  - Dashboard and reporting

### 2. Backend API (Server)

- **Tech Stack**: Node.js, Express
- **Key Features**:
  - User authentication & authorization
  - PRD management
  - Test case tracking
  - Jira integration
  - Git repository integration
  - CI/CD integration

### 3. AI Service

- **Tech Stack**: Python, FastAPI
- **Key Features**:
  - PRD content extraction and processing
  - LLM integration via IBM Watson X AI
  - Test case generation
  - Cucumber feature file generation

### 4. Database

- **Tech Stack**: MongoDB
- **Key Collections**:
  - Users
  - PRDs
  - Test Cases
  - Projects
  - CI Jobs

## Key Workflows

### 1. PRD Processing Workflow

1. User uploads PRD via UI
2. Node.js backend receives file and forwards to AI Service
3. AI Service extracts content based on file type
4. Content is stored in MongoDB
5. UI displays the processed PRD

### 2. Test Case Generation Workflow

1. User initiates test case generation for a PRD
2. Node.js backend calls AI Service 
3. AI Service uses IBM Watson X AI to analyze PRD and generate test cases
4. Generated test cases are stored in MongoDB
5. UI displays the new test cases

### 3. Ticket Creation Workflow

1. User selects test cases to create tickets
2. Node.js backend connects to Jira API
3. Tickets are created in Jira with test case details
4. Ticket IDs and URLs are stored in MongoDB
5. UI displays ticket status and links

### 4. Cucumber Feature Generation Workflow

1. User initiates feature file generation
2. Node.js backend calls AI Service
3. AI Service uses IBM Watson X AI to convert test cases to Cucumber features
4. Backend commits feature files to specified Git repository
5. UI displays commit status and links

## Security

- JWT authentication for API access
- Encrypted storage of API tokens and credentials
- Role-based access control
- Environment variable isolation

## Deployment

The application can be deployed in two ways:

1. **Docker Compose**: All components run in containers
2. **Hybrid**: Node.js backend and MongoDB on a server, Python AI Service separately

## Extensibility

The architecture is designed to be extensible:

- Additional issue trackers beyond Jira can be added
- Support for more Git providers beyond GitHub/GitLab/Bitbucket
- Additional CI/CD systems beyond Jenkins/GitHub Actions 