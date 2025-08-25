# Healthcare Portal - ngrok Demo Setup Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Healthcare Portal - ngrok Demo Setup" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host

# Step 1: Environment setup
Write-Host "Step 1: Copying demo environment configuration..." -ForegroundColor Yellow
Copy-Item ".env.ngrok" ".env" -Force
Write-Host "✓ Environment configured for demo" -ForegroundColor Green
Write-Host

# Step 2: Docker services
Write-Host "Step 2: Starting Docker services..." -ForegroundColor Yellow
docker-compose down 2>$null
docker-compose up -d
Write-Host "✓ Docker services started" -ForegroundColor Green
Write-Host

# Step 3: Wait for services
Write-Host "Step 3: Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
Write-Host "✓ Services should be ready" -ForegroundColor Green
Write-Host

# Step 4: Health check
Write-Host "Step 4: Testing local access..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health/basic" -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Local access working" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Local access check failed - please verify manually" -ForegroundColor Yellow
    Write-Host "Try visiting: http://localhost:3001/api/health/basic" -ForegroundColor Gray
}
Write-Host

# Demo instructions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host

Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Download ngrok from " -NoNewline
Write-Host "https://ngrok.com/download" -ForegroundColor Blue
Write-Host "2. Sign up and get your auth token"
Write-Host "3. Run: " -NoNewline
Write-Host "ngrok config add-authtoken YOUR_TOKEN" -ForegroundColor Gray
Write-Host "4. Run: " -NoNewline  
Write-Host "ngrok http 3001" -ForegroundColor Gray
Write-Host "5. Share the " -NoNewline
Write-Host "https://xxx.ngrok-free.app" -ForegroundColor Blue -NoNewline
Write-Host " URL for your demo"
Write-Host

Write-Host "Local app running at: " -NoNewline
Write-Host "http://localhost:3001" -ForegroundColor Blue
Write-Host

Write-Host "Demo credentials:" -ForegroundColor Yellow
Write-Host "Admin: admin@healthcare.com / admin123" -ForegroundColor Gray
Write-Host "User: user@healthcare.com / user123" -ForegroundColor Gray
Write-Host

Write-Host "Press any key to exit..." -ForegroundColor White
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")