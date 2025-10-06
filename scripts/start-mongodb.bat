@echo off
REM Flow Space MongoDB Replica Set Startup Script (Windows Batch)
REM Alternative to PowerShell for environments with restricted execution policies

echo 🚀 Starting MongoDB with replica set configuration...

REM Stop any existing MongoDB service
net stop MongoDB >nul 2>&1
if %errorlevel% == 0 (
    echo ⏹️  Stopped existing MongoDB service
) else (
    echo ℹ️  MongoDB service not running or doesn't exist
)

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Create data directory
if not exist "mongo-data\rs0" (
    mkdir "mongo-data\rs0"
    echo 📁 Created data directory: mongo-data\rs0
)

REM Check if MongoDB is in PATH, otherwise use default installation path
where mongod >nul 2>&1
if %errorlevel% == 0 (
    set MONGO_BIN=
) else (
    set MONGO_BIN=C:\Program Files\MongoDB\Server\7.0\bin\
    echo 💡 Using MongoDB from: %MONGO_BIN%
)

echo 🔧 Starting MongoDB with replica set...
start "MongoDB" "%MONGO_BIN%mongod.exe" --dbpath mongo-data\rs0 --replSet rs0 --port 27017 --bind_ip 127.0.0.1

REM Wait for MongoDB to start
echo ⏳ Waiting for MongoDB to start...
timeout /t 5 /nobreak >nul

REM Initialize replica set
echo 📦 Initializing replica set...
"%MONGO_BIN%mongosh.exe" --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] })"

if %errorlevel% == 0 (
    echo ✅ Replica set initialized successfully
) else (
    echo ❌ Error initializing replica set
    echo 💡 Make sure MongoDB is installed and mongosh is available
    pause
    exit /b 1
)

echo 🎯 MongoDB replica set is ready for Flow Space!
echo 📍 Connection: mongodb://localhost:27017/flowspace?replicaSet=rs0
echo.
echo 💡 Tips:
echo    - MongoDB is running in background
echo    - Use Task Manager to stop mongod.exe when done
echo    - Run 'npm run db:push' to sync your Prisma schema
echo.
pause