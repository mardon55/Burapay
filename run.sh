#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start backend on port 8000 in background
cd "$SCRIPT_DIR/backend"
uvicorn server:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start frontend dev server on port 5000 (proxies /api to backend)
cd "$SCRIPT_DIR/frontend"
BROWSER=none npm start &
FRONTEND_PID=$!

# Wait for either process to exit
wait -n $BACKEND_PID $FRONTEND_PID
