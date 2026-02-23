#!/bin/bash
set -e

echo "Updating ClawX Web Server"
echo "========================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Not in ClawX-Web directory"
    exit 1
fi

# Stash any local changes
echo "Stashing local changes..."
git stash

# Pull latest changes
echo "Pulling latest changes..."
git pull origin features/web-ui

# Rebuild server
echo "Rebuilding server..."
npm run build:server

# Fix Node.js path in service
echo "Updating Node.js path in service..."
NODE_PATH=$(which node)
echo "Using Node.js at: $NODE_PATH"

SERVICE_FILE="/etc/systemd/system/clawx-web-root.service"
if [ -f "$SERVICE_FILE" ]; then
    sudo sed -i "s|ExecStart=.*node |ExecStart=$NODE_PATH |g" "$SERVICE_FILE"
    echo "✓ Service file updated"
fi

# Reload and restart
echo "Restarting service..."
sudo systemctl daemon-reload
sudo systemctl restart clawx-web-root.service

sleep 3

# Check status
if sudo systemctl is-active --quiet clawx-web-root.service; then
    echo ""
    echo "✓ Server updated and running!"
    echo ""
    echo "Access at: http://$(hostname -I | awk '{print $1}'):2003"
    echo ""
    echo "View logs: sudo journalctl -u clawx-web-root.service -f"
else
    echo ""
    echo "⚠ Service failed to start. Check logs:"
    sudo journalctl -u clawx-web-root.service -n 30 --no-pager
    exit 1
fi
