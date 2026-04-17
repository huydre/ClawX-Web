#!/bin/bash
# Post-update script — runs after git pull during web update
# This file is pulled from git BEFORE being executed, so it always has latest logic

export HOME="${HOME:-/home/$(whoami)}"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "[post-update] Starting..."

# Find npm
if ! command -v npm &>/dev/null; then
  if [ -d "$NVM_DIR/versions/node" ]; then
    LATEST_NODE=$(ls "$NVM_DIR/versions/node/" 2>/dev/null | sort -V | tail -1)
    if [ -n "$LATEST_NODE" ]; then
      export PATH="$NVM_DIR/versions/node/$LATEST_NODE/bin:$PATH"
    fi
  fi
fi

if ! command -v npm &>/dev/null; then
  echo "[post-update] ERROR: npm not found"
  exit 0  # non-fatal
fi

echo "[post-update] npm: $(which npm)"

# Install PM2 if needed
if ! command -v pm2 &>/dev/null; then
  echo "[post-update] Installing PM2..."
  npm i -g pm2
fi

# Install 9router if needed
if ! command -v 9router &>/dev/null; then
  echo "[post-update] Installing 9router..."
  npm i -g 9router
else
  echo "[post-update] 9router already installed: $(which 9router)"
fi

# Start/restart 9router in PM2 on port 20128
if pm2 describe 9router &>/dev/null 2>&1; then
  echo "[post-update] Restarting 9router in PM2..."
  pm2 restart 9router
else
  echo "[post-update] Starting 9router in PM2 on port 20128..."
  PORT=20128 pm2 start 9router --name 9router
  pm2 save 2>/dev/null || true
fi

echo "[post-update] Done"
