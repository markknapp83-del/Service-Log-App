@echo off
echo ========================================
echo Healthcare Portal - ngrok Demo Setup
echo ========================================
echo.

echo Step 1: Copying demo environment configuration...
copy .env.ngrok .env
echo ✓ Environment configured for demo
echo.

echo Step 2: Starting Docker services...
docker-compose down
docker-compose up -d
echo ✓ Docker services started
echo.

echo Step 3: Waiting for services to be ready...
timeout /t 10 /nobreak > nul
echo ✓ Services should be ready
echo.

echo Step 4: Testing local access...
curl -s http://localhost:3001/api/health/basic > nul
if %errorlevel%==0 (
    echo ✓ Local access working
) else (
    echo ⚠ Local access check failed - please verify manually
)
echo.

echo ========================================
echo Setup Complete! 
echo ========================================
echo.
echo Next steps:
echo 1. Download ngrok from https://ngrok.com/download
echo 2. Sign up and get your auth token
echo 3. Run: ngrok config add-authtoken YOUR_TOKEN
echo 4. Run: ngrok http 3001
echo 5. Share the https://xxx.ngrok-free.app URL for your demo
echo.
echo Local app running at: http://localhost:3001
echo.
echo Press any key to exit...
pause > nul