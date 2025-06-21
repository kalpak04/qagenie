# Display header
Write-Host "===========================================" -ForegroundColor Green
Write-Host "QA-Genie Setup - Installation Script" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Blue

# Check Node.js
try {
    $nodeVersion = & node -v
    Write-Host "✓ Node.js $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "Node.js is not installed! Please install Node.js v16 or higher." -ForegroundColor Red
    exit
}

# Check Python
try {
    $pythonVersion = & python --version
    Write-Host "✓ $pythonVersion" -ForegroundColor Green
}
catch {
    Write-Host "Python is not installed! Please install Python 3.11 or higher." -ForegroundColor Red
    exit
}

# Check Docker
try {
    $dockerVersion = & docker --version
    Write-Host "✓ $dockerVersion" -ForegroundColor Green
}
catch {
    Write-Host "Warning: Docker is not installed. Please install Docker to use the containerized version." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setting up the application..." -ForegroundColor Blue

# Create environment files if they don't exist
Write-Host "Creating environment files..." -ForegroundColor Blue

if (-not (Test-Path -Path "server\env")) {
    Copy-Item -Path "server\env.example" -Destination "server\env"
    Write-Host "✓ Created server\env" -ForegroundColor Green
}

if (-not (Test-Path -Path "ai_service\env")) {
    Copy-Item -Path "ai_service\env.example" -Destination "ai_service\env"
    Write-Host "✓ Created ai_service\env" -ForegroundColor Green
}

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Blue

# Root project
Write-Host "Installing root project dependencies..."
& npm install

# Server
Write-Host ""
Write-Host "Installing server dependencies..."
Push-Location -Path "server"
& npm install
Pop-Location

# Python AI service
Write-Host ""
Write-Host "Installing Python AI service dependencies..."
Push-Location -Path "ai_service"
& pip install -r requirements.txt
Pop-Location

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Blue
Write-Host "1. Update the environment files with your credentials:"
Write-Host "   - server\env"
Write-Host "   - ai_service\env"
Write-Host ""
Write-Host "2. Start the application:"
Write-Host "   - Development: npm run dev"
Write-Host "   - Docker: docker-compose up"
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Blue
Write-Host "For more information, please refer to the README.md file." 