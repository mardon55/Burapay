#!/bin/bash
set -e

PORT="${PORT:-8000}"

echo "🚀 BuraPay backend ishga tushmoqda (port: $PORT)..."

if [ -z "$DATABASE_URL" ]; then
  echo "❌ XATO: DATABASE_URL muhit o'zgaruvchisi topilmadi!"
  exit 1
fi

echo "✅ DATABASE_URL topildi."
echo "✅ BOT_TOKEN: ${BOT_TOKEN:+mavjud}${BOT_TOKEN:-YO'Q}"

cd /app/backend
exec uvicorn server:app --host 0.0.0.0 --port "$PORT" --workers 1
