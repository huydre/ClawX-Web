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

# Deploy plugins to ~/.openclaw/extensions/
PLUGINS_SRC="$(dirname "$0")/../plugins"
PLUGINS_DEST="$HOME/.openclaw/extensions"
if [ -d "$PLUGINS_SRC" ]; then
  mkdir -p "$PLUGINS_DEST"
  for plugin_dir in "$PLUGINS_SRC"/*/; do
    plugin_name=$(basename "$plugin_dir")
    echo "[post-update] Deploying plugin: $plugin_name"
    cp -r "$plugin_dir" "$PLUGINS_DEST/$plugin_name/"
  done
  echo "[post-update] Plugins deployed to $PLUGINS_DEST"
fi

# Deploy shared skills to ~/.openclaw/skills/
SKILLS_SRC="$(dirname "$0")/../skills"
SKILLS_DEST="$HOME/.openclaw/skills"
if [ -d "$SKILLS_SRC" ]; then
  mkdir -p "$SKILLS_DEST"
  cp -r "$SKILLS_SRC"/* "$SKILLS_DEST/" 2>/dev/null || true
  echo "[post-update] Skills deployed to $SKILLS_DEST"
fi

# Enable inline buttons + register clarify plugin in openclaw.json
python3 -c "
import json, os
config_path = os.path.expanduser('~/.openclaw/openclaw.json')
try:
    with open(config_path, 'r') as f:
        config = json.load(f)
    changed = False

    # Enable inlineButtons capability
    tg = config.setdefault('channels', {}).setdefault('telegram', {})
    caps = tg.setdefault('capabilities', {})
    if caps.get('inlineButtons') != 'all':
        caps['inlineButtons'] = 'all'
        changed = True
        print('[post-update] Enabled telegram inlineButtons')

    # Register clarify-buttons plugin
    plugins = config.setdefault('plugins', {})
    entries = plugins.setdefault('entries', {})
    if 'telegram-clarify-buttons' not in entries:
        entries['telegram-clarify-buttons'] = {'enabled': True}
        changed = True
        print('[post-update] Registered telegram-clarify-buttons plugin')

    # Add to allow list
    allow = plugins.setdefault('allow', [])
    if 'telegram-clarify-buttons' not in allow:
        allow.append('telegram-clarify-buttons')
        changed = True

    if changed:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=4)
        print('[post-update] openclaw.json updated')
    else:
        print('[post-update] openclaw.json already configured')
except Exception as e:
    print(f'[post-update] Skip config: {e}')
" 2>/dev/null || true

echo "[post-update] Done"
