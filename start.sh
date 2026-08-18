#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting AI SEO Setup..."

# Backend
echo "→ Starting backend on :8002"
cd "$ROOT/backend"
.venv/bin/uvicorn main:app --reload --port 8002 &
BACKEND_PID=$!

# Frontend
echo "→ Starting frontend on :5174"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Running:"
echo "   Frontend → http://localhost:5174"
echo "   Backend  → http://localhost:8002"
echo "   API docs → http://localhost:8002/docs"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
