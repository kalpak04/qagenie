#!/bin/bash

# Display colorful header
echo -e "\033[1;32m"
echo "===========================================" 
echo "🧚 QA-Genie Setup - Installation Script 🧚"
echo "===========================================" 
echo -e "\033[0m"

# Check prerequisites
echo -e "\033[1;34mChecking prerequisites...\033[0m"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "\033[1;31mNode.js is not installed! Please install Node.js v16 or higher.\033[0m"
    exit 1
fi
node_version=$(node -v | cut -d "v" -f 2)
echo -e "\033[0;32m✓ Node.js $node_version\033[0m"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "\033[1;31mPython 3 is not installed! Please install Python 3.11 or higher.\033[0m"
    exit 1
fi
python_version=$(python3 --version | cut -d " " -f 2)
echo -e "\033[0;32m✓ Python $python_version\033[0m"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "\033[1;33mWarning: PostgreSQL client is not installed locally. We'll use Docker for PostgreSQL.\033[0m"
else
    pg_version=$(psql --version | cut -d " " -f 3)
    echo -e "\033[0;32m✓ PostgreSQL client $pg_version\033[0m"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "\033[1;33mWarning: Docker is not installed. Please install Docker to use the containerized version.\033[0m"
else
    docker_version=$(docker --version | cut -d " " -f 3 | sed 's/,//g')
    echo -e "\033[0;32m✓ Docker $docker_version\033[0m"
fi

echo -e "\033[1;34mSetting up the application...\033[0m"

# Create environment files if they don't exist
echo -e "\033[1;34mCreating environment files...\033[0m"

if [ ! -f server/env ]; then
    cp server/env.example server/env
    echo -e "\033[0;32m✓ Created server/env\033[0m"
fi

if [ ! -f ai_service/env ]; then
    cp ai_service/env.example ai_service/env
    echo -e "\033[0;32m✓ Created ai_service/env\033[0m"
fi

# Install dependencies
echo -e "\033[1;34mInstalling dependencies...\033[0m"

# Root project
echo "Installing root project dependencies..."
npm install

# Server
echo "Installing server dependencies..."
cd server
npm install
cd ..

# Python AI service
echo "Installing Python AI service dependencies..."
cd ai_service
python3 -m pip install --user -r requirements.txt
cd ..

echo -e "\033[1;32m===========================================" 
echo "🎉 Setup complete! 🎉"
echo "==========================================="
echo -e "\033[0m"

echo -e "\033[1;34mNext steps:\033[0m"
echo "1. Update the environment files with your credentials:"
echo "   - server/env"
echo "   - ai_service/env"
echo ""
echo "2. Start the application:"
echo "   - Development: npm run dev"
echo "   - Docker: docker-compose up"
echo ""
echo -e "\033[1;34mDocumentation:\033[0m"
echo "For more information, please refer to the README.md file."
echo "" 