# Healthcare Portal - Start Demo Script
# This script prepares everything for your ngrok demo

param(
    [string]$NgrokPath = "ngrok",
    [switch]$Help
)

if ($Help) {
    Write-Host "Healthcare Portal Demo Starter" -ForegroundColor Cyan
    Write-Host "Usage: .\start-demo.ps1 [-NgrokPath <path>]" -ForegroundColor White
    Write-Host ""
    Write-Host "Parameters:" -ForegroundColor Yellow
    Write-Host "  -NgrokPath    Path to ngrok executable (default: 'ngrok')" -ForegroundColor Gray
    Write-Host "  -Help         Show this help message" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host "  .\start-demo.ps1 -NgrokPath 'C:\ngrok\ngrok.exe'" -ForegroundColor Gray
    exit 0
}

Write-Host "🎬 Healthcare Portal - Demo Preparation" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host

# Check if services are running
Write-Host "📋 Checking application status..." -ForegroundColor Yellow

try {
    $frontendCheck = Invoke-WebRequest -Uri "http://localhost:3005" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ Frontend running on port 3005" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend not running on port 3005" -ForegroundColor Red
    Write-Host "   Please start the frontend: cd frontend && npm run dev" -ForegroundColor Gray
}

try {
    $backendCheck = Invoke-WebRequest -Uri "http://localhost:5003/health" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ Backend running on port 5003" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend not running on port 5003" -ForegroundColor Red
    Write-Host "   Please start the backend: cd backend && npm run dev" -ForegroundColor Gray
}

Write-Host

# Check for ngrok
Write-Host "🔍 Checking ngrok installation..." -ForegroundColor Yellow
try {
    $ngrokVersion = & $NgrokPath version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ ngrok found: $($ngrokVersion -split "`n" | Select-Object -First 1)" -ForegroundColor Green
    } else {
        throw "ngrok not found"
    }
} catch {
    Write-Host "❌ ngrok not found at '$NgrokPath'" -ForegroundColor Red
    Write-Host "   Please download from: https://ngrok.com/download" -ForegroundColor Blue
    Write-Host "   Or specify path with: .\start-demo.ps1 -NgrokPath 'C:\path\to\ngrok.exe'" -ForegroundColor Gray
    Write-Host
    Write-Host "⚠️  Cannot start tunnel without ngrok" -ForegroundColor Yellow
    Write-Host "Press any key to continue with manual instructions..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

Write-Host

# Demo credentials
Write-Host "🔐 Demo Credentials Ready:" -ForegroundColor Yellow
Write-Host "Admin User:" -ForegroundColor White
Write-Host "  Email: admin@healthcare.local" -ForegroundColor Gray
Write-Host "  Password: admin123" -ForegroundColor Gray
Write-Host

# Instructions
Write-Host "🚀 Ready to Start Demo!" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host

Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Start ngrok tunnel:" -ForegroundColor Cyan
Write-Host "   $NgrokPath http 3005" -ForegroundColor Gray
Write-Host

Write-Host "2. Copy the https://xxx.ngrok-free.app URL" -ForegroundColor Cyan
Write-Host

Write-Host "3. Share URL with demo attendee" -ForegroundColor Cyan
Write-Host

Write-Host "4. Click 'Visit Site' on ngrok warning page" -ForegroundColor Cyan
Write-Host

Write-Host "5. Login with admin credentials above" -ForegroundColor Cyan
Write-Host

Write-Host "📖 Full demo script available in: DEMO_INSTRUCTIONS.md" -ForegroundColor Blue
Write-Host

Write-Host "🔥 Pro tip: Start the tunnel now!" -ForegroundColor Yellow
Write-Host

# Offer to start ngrok automatically
$startNgrok = Read-Host "Start ngrok tunnel now? (Y/n)"
if ($startNgrok -eq "" -or $startNgrok -eq "Y" -or $startNgrok -eq "y") {
    Write-Host
    Write-Host "Starting ngrok tunnel..." -ForegroundColor Green
    try {
        & $NgrokPath http 3005
    } catch {
        Write-Host "Failed to start ngrok. Please run manually:" -ForegroundColor Red
        Write-Host "$NgrokPath http 3005" -ForegroundColor Gray
    }
} else {
    Write-Host
    Write-Host "Manual start command:" -ForegroundColor Yellow
    Write-Host "$NgrokPath http 3005" -ForegroundColor Gray
    Write-Host
    Write-Host "Good luck with your demo! 🎯" -ForegroundColor Green
}