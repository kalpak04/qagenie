# Display colorful header
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green 
Write-Host "🧚 QA-Genie Setup - Installation Script 🧚" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green 

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Blue

# Check Node.js
try {
    $nodeVersion = node -v
    Write-Host "✓ Node.js $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "Node.js is not installed or not in PATH! Please install Node.js v16 or higher." -ForegroundColor Red
    exit 1
}

# Check Python
try {
    $pythonVersion = python --version
    if ($pythonVersion -match "Python 3") {
        Write-Host "✓ $pythonVersion" -ForegroundColor Green
    } else {
        Write-Host "Python version 3.11 or higher is required." -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "Python is not installed or not in PATH! Please install Python 3.11 or higher." -ForegroundColor Red
    exit 1
}

# Check PostgreSQL
try {
    $pgVersion = psql --version
    Write-Host "✓ PostgreSQL client installed" -ForegroundColor Green
}
catch {
    Write-Host "Warning: PostgreSQL client is not installed locally. We'll use Docker for PostgreSQL." -ForegroundColor Yellow
}

# Check Docker
try {
    $dockerVersion = docker --version
    Write-Host "✓ $dockerVersion" -ForegroundColor Green
}
catch {
    Write-Host "Warning: Docker is not installed. Please install Docker to use the containerized version." -ForegroundColor Yellow
}

Write-Host "Setting up the application..." -ForegroundColor Blue

# Create environment files if they don't exist
Write-Host "Creating environment files..." -ForegroundColor Blue

if (-Not (Test-Path "server/env")) {
    Copy-Item "server/env.example" -Destination "server/env"
    Write-Host "✓ Created server/env" -ForegroundColor Green
}

if (-Not (Test-Path "ai_service/env")) {
    Copy-Item "ai_service/env.example" -Destination "ai_service/env"
    Write-Host "✓ Created ai_service/env" -ForegroundColor Green
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Blue

# Root project
Write-Host "Installing root project dependencies..."
npm install

# Server
Write-Host "Installing server dependencies..."
Set-Location server
npm install
Set-Location ..

# Python AI service
Write-Host "Installing Python AI service dependencies..."
Set-Location ai_service
python -m pip install -r requirements.txt
Set-Location ..

Write-Host "==========================================" -ForegroundColor Green 
Write-Host "🎉 Setup complete! 🎉" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green 

Write-Host "Next steps:" -ForegroundColor Blue
Write-Host "1. Update the environment files with your credentials:"
Write-Host "   - server/env"
Write-Host "   - ai_service/env"
Write-Host ""
Write-Host "2. Start the application:"
Write-Host "   - Development: npm run dev"
Write-Host "   - Docker: docker-compose up"
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Blue
Write-Host "For more information, please refer to the README.md file."
Write-Host "" 