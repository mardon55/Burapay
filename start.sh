#!/bin/bash
set -e

# Add venv packages to PYTHONPATH (sqlalchemy, asyncpg, etc.)
export PYTHONPATH="/home/runner/workspace/.venv/lib/python3.12/site-packages:$PYTHONPATH"

# Build frontend if build dir doesn't exist
if [ ! -d "/home/runner/workspace/frontend/build" ]; then
  echo "Building frontend..."
  cd /home/runner/workspace/frontend && GENERATE_SOURCEMAP=false CI=false node_modules/.bin/craco build
  echo "Frontend built"
fi

# Start Backend (serves API + React static files)
cd /home/runner/workspace/backend
uvicorn server:app --host 0.0.0.0 --port 5000 --reload
