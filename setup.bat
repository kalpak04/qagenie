@echo off
echo ===========================================
echo QA-Genie Setup - Installation Script
echo ===========================================
echo.

echo Checking prerequisites...

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed! Please install Node.js v16 or higher.
    exit /b 1
)
for /f "tokens=1,2,3 delims=." %%a in ('node -v') do (
    set node_version=%%a.%%b.%%c
)
echo [√] Node.js %node_version:~1%

:: Check Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Python is not installed! Please install Python 3.11 or higher.
    exit /b 1
)
for /f "tokens=1,2 delims= " %%a in ('python --version') do (
    set python_version=%%b
)
echo [√] Python %python_version%

:: Check Docker
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Warning: Docker is not installed. Please install Docker to use the containerized version.
) else (
    for /f "tokens=1,2,3 delims= " %%a in ('docker --version') do (
        set docker_version=%%c
    )
    echo [√] Docker %docker_version:~0,-1%
)

echo Setting up the application...

:: Create environment files if they don't exist
echo Creating environment files...

if not exist server\env (
    copy server\env.example server\env
    echo [√] Created server\env
)

if not exist ai_service\env (
    copy ai_service\env.example ai_service\env
    echo [√] Created ai_service\env
)

:: Install dependencies
echo Installing dependencies...

:: Root project
echo Installing root project dependencies...
call npm install

:: Server
echo Installing server dependencies...
cd server
call npm install
cd ..

:: Python AI service
echo Installing Python AI service dependencies...
cd ai_service
pip install -r requirements.txt
cd ..

echo ===========================================
echo Setup complete!
echo ===========================================
echo.

echo Next steps:
echo 1. Update the environment files with your credentials:
echo    - server\env
echo    - ai_service\env
echo.
echo 2. Start the application:
echo    - Development: npm run dev
echo    - Docker: docker-compose up
echo.
echo Documentation:
echo For more information, please refer to the README.md file.
echo.

pause 