@echo off
echo ===========================================
echo QA-Genie Setup - Installation Script
echo ===========================================
echo.

echo Installing root project dependencies...
call npm install

echo.
echo Installing server dependencies...
cd server
call npm install
cd ..

echo.
echo Installing Python AI service dependencies...
cd ai_service
pip install -r requirements.txt
cd ..

echo.
echo ===========================================
echo Setup complete!
echo ===========================================
echo.

echo Next steps:
echo 1. Update the environment files with your credentials
echo 2. Start the application:
echo    - Development: npm run dev
echo    - Docker: docker-compose up
echo.
echo For more information, please refer to the README.md file.

pause 