#!/bin/bash
set -e

export PYTHONPATH="/home/runner/workspace/.venv/lib/python3.12/site-packages:$PYTHONPATH"

if [ ! -d "/home/runner/workspace/frontend/build" ]; then
  echo "Building frontend..."
  cd /home/runner/workspace/frontend
  GENERATE_SOURCEMAP=false CI=false node_modules/.bin/craco build 2>&1
  echo "Frontend built successfully"
  cd /home/runner/workspace
fi

cd /home/runner/workspace/backend
exec uvicorn server:app --host 0.0.0.0 --port 5000
