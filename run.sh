#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Build frontend if not already built
if [ ! -d "$SCRIPT_DIR/frontend/build" ]; then
  echo "Building frontend..."
  cd "$SCRIPT_DIR/frontend"
  GENERATE_SOURCEMAP=false CI=false npm run build 2>&1
  echo "Frontend built successfully"
fi

# Start backend on port 5000 (serves the built frontend statically)
cd "$SCRIPT_DIR/backend"
exec uvicorn server:app --host 0.0.0.0 --port 5000
