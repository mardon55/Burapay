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

# Start Backend
cd /home/runner/workspace/backend
uvicorn server:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"
cd /home/runner/workspace

# Start Frontend using root node_modules
cd /home/runner/workspace/frontend
PORT=5000 HOST=0.0.0.0 BROWSER=none node /home/runner/workspace/node_modules/.bin/craco start &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

# Wait for either process to exit
wait
