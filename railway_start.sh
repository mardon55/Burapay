#!/bin/bash
set -e

# Use Railway's PORT env var, fallback to 8000
PORT="${PORT:-8000}"

echo "Starting BuraPay backend on port $PORT..."

# Start Backend (serves API + React static files)
cd /app/backend
exec uvicorn server:app --host 0.0.0.0 --port "$PORT"
