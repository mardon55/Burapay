#!/bin/bash
set -e

# Start MongoDB
mkdir -p /tmp/mongodb-data
if ! pgrep -x mongod > /dev/null; then
  mongod --dbpath /tmp/mongodb-data --fork --logpath /tmp/mongod.log --bind_ip 127.0.0.1
  echo "MongoDB started"
else
  echo "MongoDB already running"
fi

# Build frontend if build dir doesn't exist
if [ ! -d "/home/runner/workspace/frontend/build" ]; then
  echo "Building frontend..."
  cd /home/runner/workspace/frontend
  GENERATE_SOURCEMAP=false npx craco build
  echo "Frontend built"
fi

# Start Backend (serves API + React static files)
cd /home/runner/workspace/backend
uvicorn server:app --host 0.0.0.0 --port 5000 --reload
