#!/bin/bash

set -e

echo "🚀 Updating ClawX on VPS"

# Build locally
echo "📦 Building server..."
pnpm build:server

# Upload to VPS
echo "📤 Uploading to VPS..."
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.git' \
  dist-server/ \
  root@192.168.1.10:/opt/clawx/dist-server/

# Restart on VPS
echo "🔄 Restarting on VPS..."
ssh root@192.168.1.10 "cd /opt/clawx && pm2 restart clawx"

echo "✅ Update complete!"
echo ""
echo "📊 View logs:"
echo "  ssh root@192.168.1.10 'pm2 logs clawx'"
