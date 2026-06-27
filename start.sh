#!/bin/bash
set -e

# Build frontend if not already built
if [ ! -d "/home/runner/workspace/frontend/build" ]; then
  echo "Building frontend..."
  cd /home/runner/workspace/frontend
  GENERATE_SOURCEMAP=false CI=false npx craco build 2>&1
  echo "Frontend built successfully"
  cd /home/runner/workspace
fi

# Copy custom assets into the static folder so FastAPI serves them
cp -f /home/runner/workspace/frontend/public/plane.png /home/runner/workspace/frontend/build/static/plane.png 2>/dev/null || true

cd /home/runner/workspace/backend
exec uvicorn server:app --host 0.0.0.0 --port 5000
