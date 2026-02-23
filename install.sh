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
# Set installation directory based on user
if [ "$CURRENT_USER" = "root" ]; then
    INSTALL_DIR="/root/clawx-web"
else
    INSTALL_DIR="$HOME/clawx-web"
fi

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
if [ "$CURRENT_USER" = "root" ]; then
    # Use root-specific service file
    SERVICE_FILE="/etc/systemd/system/clawx-web-root.service"
    SERVICE_NAME="clawx-web-root.service"
    sudo cp systemd/clawx-web-root.service "$SERVICE_FILE"
else
    # Use user-specific service file with %i substitution
    SERVICE_FILE="/etc/systemd/system/clawx-web@.service"
    SERVICE_NAME="clawx-web@$CURRENT_USER.service"
    if [ -w "/etc/systemd/system" ]; then
        sudo cp systemd/clawx-web.service "$SERVICE_FILE"
    else
        echo "Copying service file (requires sudo)..."
        sudo cp systemd/clawx-web.service "$SERVICE_FILE"
    fi
    # Update service file with correct paths
    sudo sed -i "s|/home/%i/clawx-web|$INSTALL_DIR|g" "$SERVICE_FILE"
fi


echo "✓ Systemd service installed"
echo ""

# Enable and start service
echo "Enabling and starting service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

echo "✓ Service enabled and started"
echo ""

# Wait a moment for service to start
sleep 2

# Check service status
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✓ ClawX Web is running!"
    echo ""
    echo "Access the web interface at: http://127.0.0.1:2003"
    echo ""
    echo "Useful commands:"
    echo "  - Check status: sudo systemctl status $SERVICE_NAME"
    echo "  - View logs: sudo journalctl -u $SERVICE_NAME -f"
    echo "  - Restart: sudo systemctl restart $SERVICE_NAME"
    echo "  - Stop: sudo systemctl stop $SERVICE_NAME"
    echo ""
else
    echo "⚠ Service failed to start. Check logs with:"
    echo "  sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi
