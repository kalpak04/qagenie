#!/bin/bash
set -e

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting QA-Genie deployment process...${NC}"

# Check if Docker and Docker Compose are installed
if ! [ -x "$(command -v docker)" ]; then
  echo -e "${RED}Error: Docker is not installed.${NC}" >&2
  exit 1
fi

if ! [ -x "$(command -v docker-compose)" ]; then
  echo -e "${RED}Error: Docker Compose is not installed.${NC}" >&2
  exit 1
fi

# Pull latest code if in a git repository
if [ -d ".git" ]; then
  echo -e "${GREEN}Pulling latest code from repository...${NC}"
  git pull
fi

# Check for required .env files
if [ ! -f "./server/env" ]; then
  echo -e "${RED}Error: server/env file not found.${NC}" >&2
  exit 1
fi

if [ ! -f "./ai_service/env" ]; then
  echo -e "${RED}Error: ai_service/env file not found.${NC}" >&2
  exit 1
fi

# Create a root .env file if it doesn't exist
if [ ! -f ".env" ]; then
  echo -e "${GREEN}Creating root .env file...${NC}"
  echo "MONGO_INITDB_ROOT_USERNAME=root" > .env
  echo "MONGO_INITDB_ROOT_PASSWORD=password" >> .env
  echo -e "${RED}Warning: Using default MongoDB credentials. Update in .env file for production.${NC}"
fi

# Build and start the containers in detached mode
echo -e "${GREEN}Building and starting containers...${NC}"
docker-compose build
docker-compose up -d

# Wait for services to be ready
echo -e "${GREEN}Waiting for services to be ready...${NC}"
sleep 10

# Check if services are up
echo -e "${GREEN}Checking service health...${NC}"
if ! docker-compose ps | grep -q "server.*Up"; then
  echo -e "${RED}Error: Server service failed to start.${NC}" >&2
  docker-compose logs server
  exit 1
fi

if ! docker-compose ps | grep -q "ai-service.*Up"; then
  echo -e "${RED}Error: AI service failed to start.${NC}" >&2
  docker-compose logs ai-service
  exit 1
fi

if ! docker-compose ps | grep -q "client.*Up"; then
  echo -e "${RED}Error: Client service failed to start.${NC}" >&2
  docker-compose logs client
  exit 1
fi

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "QA-Genie is now accessible at: http://localhost"
echo -e "API server is running at: http://localhost/api"

# Print logs (optional)
echo -e "${GREEN}To see logs, run:${NC}"
echo -e "docker-compose logs -f" 