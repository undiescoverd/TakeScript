#!/bin/bash

# TakeScript Development Environment
# Starts both Convex and Next.js dev servers in tmux

SESSION_NAME="takescript-dev"

# Check if session already exists
tmux has-session -t $SESSION_NAME 2>/dev/null

if [ $? != 0 ]; then
  # Create new session with first window for Convex
  tmux new-session -d -s $SESSION_NAME -n "convex" -c "/Users/ianvincent/workspace/TakeScript"

  # Start Convex dev server in first pane
  tmux send-keys -t $SESSION_NAME:convex "npx convex dev" C-m

  # Split window horizontally and start Next.js dev server
  tmux split-window -h -t $SESSION_NAME:convex -c "/Users/ianvincent/workspace/TakeScript"
  tmux send-keys -t $SESSION_NAME:convex "npm run dev" C-m

  # Select the left pane (Convex)
  tmux select-pane -t $SESSION_NAME:convex.0

  echo "✓ Started development servers in tmux session: $SESSION_NAME"
  echo ""
  echo "Commands:"
  echo "  tmux attach -t $SESSION_NAME    # Attach to session"
  echo "  tmux kill-session -t $SESSION_NAME    # Stop all servers"
  echo ""
  echo "Inside tmux:"
  echo "  Ctrl+b then arrow keys    # Navigate between panes"
  echo "  Ctrl+b then d             # Detach (servers keep running)"
  echo "  Ctrl+c in each pane       # Stop individual server"
else
  echo "⚠ Session '$SESSION_NAME' already exists"
  echo "Run: tmux attach -t $SESSION_NAME"
fi
