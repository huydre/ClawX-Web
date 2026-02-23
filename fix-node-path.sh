#!/bin/bash
set -e

echo "Fixing Node.js path in systemd service"
echo "======================================="
echo ""

# Find Node.js path
NODE_PATH=$(which node)
echo "Node.js found at: $NODE_PATH"
node -v

# Update service file
SERVICE_FILE="/etc/systemd/system/clawx-web-root.service"

if [ ! -f "$SERVICE_FILE" ]; then
    echo "Error: Service file not found at $SERVICE_FILE"
    exit 1
fi

echo "Updating service file..."
sudo sed -i "s|ExecStart=/usr/bin/node|ExecStart=$NODE_PATH|g" "$SERVICE_FILE"

echo "✓ Service file updated"
echo ""

# Reload and restart
echo "Reloading systemd..."
sudo systemctl daemon-reload

echo "Restarting service..."
sudo systemctl restart clawx-web-root.service

sleep 3

# Check status
if sudo systemctl is-active --quiet clawx-web-root.service; then
    echo ""
    echo "✓ Service is running!"
    echo ""
    sudo systemctl status clawx-web-root.service --no-pager -l | head -20
else
    echo ""
    echo "⚠ Service failed. Check logs:"
    sudo journalctl -u clawx-web-root.service -n 30 --no-pager
    exit 1
fi
