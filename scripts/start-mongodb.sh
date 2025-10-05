#!/bin/bash

# Flow Space MongoDB Replica Set Startup Script
# This script starts MongoDB with replica set configuration required for Prisma transactions

echo "🚀 Starting MongoDB with replica set configuration..."

# Stop any existing MongoDB instance
brew services stop mongodb-community 2>/dev/null || true

# Wait a moment for the service to stop
sleep 2

# Start MongoDB with replica set
mongod --replSet rs0 --port 27017 --dbpath /opt/homebrew/var/mongodb --fork --logpath /opt/homebrew/var/log/mongodb/mongo.log

# Wait for MongoDB to start
sleep 3

# Check if replica set is already initialized
RS_STATUS=$(mongosh --quiet --eval "try { rs.status().ok } catch(e) { 0 }")

if [ "$RS_STATUS" != "1" ]; then
    echo "📦 Initializing replica set..."
    mongosh --eval "rs.initiate()"
    echo "✅ Replica set initialized"
else
    echo "✅ Replica set already initialized"
fi

echo "🎯 MongoDB replica set is ready for Flow Space!"
echo "📍 Connection: mongodb://localhost:27017/flowspace?replicaSet=rs0"