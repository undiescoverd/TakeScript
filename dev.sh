#!/bin/bash

# TakeScript Development Environment
# Starts Convex, Next.js, and Collaboration servers in tmux

SESSION_NAME="takescript-dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if session already exists
tmux has-session -t $SESSION_NAME 2>/dev/null

if [ $? != 0 ]; then
  # Create new session with first window
  tmux new-session -d -s $SESSION_NAME -n "servers" -c "$SCRIPT_DIR"

  # Start Convex dev server in first pane (top-left)
  tmux send-keys -t $SESSION_NAME:servers "npx convex dev" C-m

  # Split window vertically (now we have top and bottom)
  tmux split-window -v -t $SESSION_NAME:servers -c "$SCRIPT_DIR"
  
  # Start Next.js dev server in bottom pane
  tmux send-keys -t $SESSION_NAME:servers "npm run dev" C-m

  # Split bottom pane horizontally (now we have top, bottom-left, bottom-right)
  tmux split-window -h -t $SESSION_NAME:servers.1 -c "$SCRIPT_DIR"
  
  # Start Collaboration server in bottom-right pane
  tmux send-keys -t $SESSION_NAME:servers "npm run collab" C-m

  # Select the top pane (Convex)
  tmux select-pane -t $SESSION_NAME:servers.0

  # Set pane titles for easier identification
  tmux select-pane -t $SESSION_NAME:servers.0 -T "Convex"
  tmux select-pane -t $SESSION_NAME:servers.1 -T "Next.js"
  tmux select-pane -t $SESSION_NAME:servers.2 -T "Collaboration"

  echo "✓ Started all development servers in tmux session: $SESSION_NAME"
  echo ""
  echo "Layout:"
  echo "  ┌─────────────┬─────────────┐"
  echo "  │   Convex    │             │"
  echo "  ├─────────────┼─────────────┤"
  echo "  │  Next.js    │ Collaboration│"
  echo "  └─────────────┴─────────────┘"
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
  echo "Or kill existing session: tmux kill-session -t $SESSION_NAME"
fi
