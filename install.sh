#!/bin/bash
set -e

echo "ClawX Web Installation Script for Armbian"
echo "=========================================="
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "Error: This script is designed for Linux systems only"
    exit 1
fi

# Get current user
CURRENT_USER=$(whoami)
INSTALL_DIR="$HOME/clawx-web"

echo "Installing ClawX Web for user: $CURRENT_USER"
echo "Installation directory: $INSTALL_DIR"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js 18+ first"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js version 18 or higher is required"
    echo "Current version: $(node -v)"
    exit 1
fi

echo "✓ Node.js $(node -v) detected"
echo ""

# Create installation directory if it doesn't exist
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Creating installation directory..."
    mkdir -p "$INSTALL_DIR"
fi

# Copy files to installation directory
echo "Copying files..."
cp -r dist "$INSTALL_DIR/"
cp -r dist-server "$INSTALL_DIR/"
cp -r node_modules "$INSTALL_DIR/"
cp package.json "$INSTALL_DIR/"

echo "✓ Files copied"
echo ""

# Create data directory
echo "Creating data directory..."
mkdir -p "$HOME/.clawx"
mkdir -p "$HOME/.clawx/logs"
mkdir -p "$HOME/.clawx/uploads"

echo "✓ Data directory created"
echo ""

# Install systemd service
echo "Installing systemd service..."
SERVICE_FILE="/etc/systemd/system/clawx-web@.service"

if [ -w "/etc/systemd/system" ]; then
    sudo cp systemd/clawx-web.service "$SERVICE_FILE"
else
    echo "Copying service file (requires sudo)..."
    sudo cp systemd/clawx-web.service "$SERVICE_FILE"
fi

# Update service file with correct paths
sudo sed -i "s|/home/%i/clawx-web|$INSTALL_DIR|g" "$SERVICE_FILE"

echo "✓ Systemd service installed"
echo ""

# Enable and start service
echo "Enabling and starting service..."
sudo systemctl daemon-reload
sudo systemctl enable "clawx-web@$CURRENT_USER.service"
sudo systemctl start "clawx-web@$CURRENT_USER.service"

echo "✓ Service enabled and started"
echo ""

# Wait a moment for service to start
sleep 2

# Check service status
if sudo systemctl is-active --quiet "clawx-web@$CURRENT_USER.service"; then
    echo "✓ ClawX Web is running!"
    echo ""
    echo "Access the web interface at: http://127.0.0.1:2003"
    echo ""
    echo "Useful commands:"
    echo "  - Check status: sudo systemctl status clawx-web@$CURRENT_USER.service"
    echo "  - View logs: sudo journalctl -u clawx-web@$CURRENT_USER.service -f"
    echo "  - Restart: sudo systemctl restart clawx-web@$CURRENT_USER.service"
    echo "  - Stop: sudo systemctl stop clawx-web@$CURRENT_USER.service"
    echo ""
else
    echo "⚠ Service failed to start. Check logs with:"
    echo "  sudo journalctl -u clawx-web@$CURRENT_USER.service -n 50"
    exit 1
fi
