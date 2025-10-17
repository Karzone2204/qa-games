# Pipeline Setup Script for Windows
# This script helps set up all pipeline definitions quickly

param(
    [string]$AdminEmail = $env:ADMIN_EMAIL,
    [string]$AdminPassword = $env:ADMIN_PASSWORD,
    [string]$ApiBase = $env:API_BASE_URL
)

Write-Host "🔧 Pipeline Setup Script" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is available
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js not found"
    }
    Write-Host "✅ Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is required but not found in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Set default values if not provided
if (-not $ApiBase) {
    $ApiBase = "http://localhost:4000"
}

if (-not $AdminEmail) {
    $AdminEmail = Read-Host "Enter admin email"
}

if (-not $AdminPassword) {
    $AdminPassword = Read-Host "Enter admin password" -AsSecureString
    $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword))
}

# Set environment variables for the Node.js script
$env:API_BASE_URL = $ApiBase
$env:ADMIN_EMAIL = $AdminEmail
$env:ADMIN_PASSWORD = $AdminPassword

Write-Host "🚀 Running pipeline setup..." -ForegroundColor Yellow
Write-Host "API Base: $ApiBase" -ForegroundColor Gray
Write-Host "Admin Email: $AdminEmail" -ForegroundColor Gray
Write-Host ""

# Change to the correct directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot

# Check if the setup script exists
$setupScript = Join-Path $scriptDir "setupPipelines.js"
if (-not (Test-Path $setupScript)) {
    Write-Host "❌ Setup script not found: $setupScript" -ForegroundColor Red
    exit 1
}

# Run the Node.js setup script
try {
    node $setupScript
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 Pipeline setup completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Configure your Azure DevOps Personal Access Token in .env" -ForegroundColor Gray
        Write-Host "2. Restart your backend server" -ForegroundColor Gray
        Write-Host "3. Test the connection in Admin Panel → Pipelines" -ForegroundColor Gray
        Write-Host "4. View pipeline status in QA Tools → Pipeline Status" -ForegroundColor Gray
    } else {
        Write-Host "❌ Setup script failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "❌ Error running setup script: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Clean up environment variables
Remove-Item Env:API_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:ADMIN_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue