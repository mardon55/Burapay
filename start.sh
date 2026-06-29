#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$SCRIPT_DIR/frontend/build" ]; then
  echo "Building frontend..."
  cd "$SCRIPT_DIR/frontend"
  GENERATE_SOURCEMAP=false CI=false npm run build 2>&1
  echo "Frontend built successfully"
  cd "$SCRIPT_DIR"
fi

cd "$SCRIPT_DIR/backend"
exec uvicorn server:app --host 0.0.0.0 --port 5000
