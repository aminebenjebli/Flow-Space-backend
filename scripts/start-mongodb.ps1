param(
    [string]$MongoBin = "C:\Program Files\MongoDB\Server\7.0\bin"
)

# Flow Space MongoDB Replica Set Startup Script (Windows)
# This script starts MongoDB with replica set configuration required for Prisma transactions

Write-Host "🚀 Starting MongoDB with replica set configuration..." -ForegroundColor Green

# Stop any existing MongoDB service
try {
    Stop-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    Write-Host "⏹️  Stopped existing MongoDB service" -ForegroundColor Yellow
} catch {
    # Service might not exist or already stopped
}

# Wait a moment for the service to stop
Start-Sleep -Seconds 2

# Create data directory
New-Item -ItemType Directory -Force -Path ".\mongo-data\rs0" | Out-Null
Write-Host "📁 Created data directory: .\mongo-data\rs0" -ForegroundColor Cyan

# Start MongoDB with replica set
Write-Host "🔧 Starting MongoDB with replica set..." -ForegroundColor Cyan
$mongoProcess = Start-Process -FilePath "$MongoBin\mongod.exe" -ArgumentList @(
    "--dbpath", ".\mongo-data\rs0",
    "--replSet", "rs0",
    "--port", "27017",
    "--bind_ip", "127.0.0.1"
) -PassThru -WindowStyle Hidden

# Wait for MongoDB to start
Write-Host "⏳ Waiting for MongoDB to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if replica set is already initialized
try {
    $rsStatus = & "$MongoBin\mongosh.exe" --quiet --eval "try { rs.status().ok } catch(e) { 0 }"
    
    if ($rsStatus -ne "1") {
        Write-Host "📦 Initializing replica set..." -ForegroundColor Cyan
        & "$MongoBin\mongosh.exe" --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] })"
        Write-Host "✅ Replica set initialized" -ForegroundColor Green
    } else {
        Write-Host "✅ Replica set already initialized" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Error checking/initializing replica set: $_" -ForegroundColor Red
    Write-Host "💡 Make sure MongoDB is installed and mongosh is available in PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host "🎯 MongoDB replica set is ready for Flow Space!" -ForegroundColor Green
Write-Host "📍 Connection: mongodb://localhost:27017/flowspace?replicaSet=rs0" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Yellow
Write-Host "   - Keep this PowerShell window open while developing" -ForegroundColor Gray
Write-Host "   - Use Ctrl+C to stop MongoDB when done" -ForegroundColor Gray
Write-Host "   - Run 'npm run db:push' to sync your Prisma schema" -ForegroundColor Gray

# Keep the process running
try {
    Write-Host "⚡ MongoDB is running. Press Ctrl+C to stop..." -ForegroundColor Green
    $mongoProcess.WaitForExit()
} catch {
    Write-Host "🛑 MongoDB stopped" -ForegroundColor Red
}