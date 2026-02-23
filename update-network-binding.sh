#!/bin/bash
set -e

echo "ClawX Web - Network Binding Update"
echo "===================================="
echo ""

# Detect service name
if systemctl list-units --full -all | grep -q "clawx-web-root.service"; then
    SERVICE_NAME="clawx-web-root.service"
elif systemctl list-units --full -all | grep -q "clawx-web@"; then
    CURRENT_USER=$(whoami)
    SERVICE_NAME="clawx-web@$CURRENT_USER.service"
else
    echo "Error: No ClawX Web service found"
    exit 1
fi

echo "Detected service: $SERVICE_NAME"
echo ""

# Stop service
echo "Stopping service..."
sudo systemctl stop "$SERVICE_NAME"

# Update service file to add HOST environment variable
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME"
if [ -f "$SERVICE_FILE" ]; then
    echo "Updating service file..."
    if ! grep -q "HOST=" "$SERVICE_FILE"; then
        sudo sed -i '/Environment="PORT=/a Environment="HOST=0.0.0.0"' "$SERVICE_FILE"
        echo "✓ Added HOST=0.0.0.0 to service file"
    else
        echo "✓ HOST variable already configured"
    fi
else
    echo "Error: Service file not found at $SERVICE_FILE"
    exit 1
fi

# Reload systemd
echo "Reloading systemd..."
sudo systemctl daemon-reload

# Restart service
echo "Starting service..."
sudo systemctl start "$SERVICE_NAME"

# Wait for service to start
sleep 3

# Check status
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo ""
    echo "✓ Service updated and running!"
    echo ""
    echo "Server is now accessible from network at:"
    echo "  http://<your-server-ip>:2003"
    echo ""
    echo "Check binding with:"
    echo "  sudo netstat -tlnp | grep 2003"
    echo ""
    echo "View logs:"
    echo "  sudo journalctl -u $SERVICE_NAME -f"
else
    echo ""
    echo "⚠ Service failed to start. Check logs:"
    echo "  sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi
