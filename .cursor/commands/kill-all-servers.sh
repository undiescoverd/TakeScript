#!/bin/bash

# Kill All Servers - Cursor Slash Command
# Kills all development servers (Next.js, Convex, etc.)

echo "🔪 Killing all development servers..."

# Kill Next.js dev server (port 3000)
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "  → Killing Next.js server (port 3000)..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null
fi

# Kill Convex dev server (common ports: 3210, 3001, or process name)
if lsof -ti:3210 > /dev/null 2>&1; then
  echo "  → Killing Convex server (port 3210)..."
  lsof -ti:3210 | xargs kill -9 2>/dev/null
fi

# Kill processes by name
echo "  → Killing 'next dev' processes..."
pkill -f "next dev" 2>/dev/null

echo "  → Killing 'convex dev' processes..."
pkill -f "convex dev" 2>/dev/null

# Kill any node processes in the project directory
echo "  → Killing Node processes in project directory..."
pkill -f "node.*TakeScript" 2>/dev/null

# Also check for any remaining processes on common dev ports
for port in 3000 3001 3210 8080; do
  if lsof -ti:$port > /dev/null 2>&1; then
    echo "  → Killing process on port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null
  fi
done

echo "✅ All servers killed!"

