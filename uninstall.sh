#!/bin/bash
set -e

echo "ClawX Web Uninstallation Script"
echo "================================"
echo ""

# Get current user
CURRENT_USER=$(whoami)
INSTALL_DIR="$HOME/clawx-web"

echo "Uninstalling ClawX Web for user: $CURRENT_USER"
echo ""

# Stop and disable service
echo "Stopping service..."
if sudo systemctl is-active --quiet "clawx-web@$CURRENT_USER.service"; then
    sudo systemctl stop "clawx-web@$CURRENT_USER.service"
    echo "✓ Service stopped"
fi

echo "Disabling service..."
if sudo systemctl is-enabled --quiet "clawx-web@$CURRENT_USER.service" 2>/dev/null; then
    sudo systemctl disable "clawx-web@$CURRENT_USER.service"
    echo "✓ Service disabled"
fi

# Remove systemd service file
SERVICE_FILE="/etc/systemd/system/clawx-web@.service"
if [ -f "$SERVICE_FILE" ]; then
    echo "Removing systemd service file..."
    sudo rm "$SERVICE_FILE"
    sudo systemctl daemon-reload
    echo "✓ Service file removed"
fi

# Ask before removing installation directory
echo ""
read -p "Remove installation directory ($INSTALL_DIR)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        echo "✓ Installation directory removed"
    fi
fi

# Ask before removing data directory
echo ""
read -p "Remove data directory ($HOME/.clawx)? This will delete all settings and data. [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "$HOME/.clawx" ]; then
        rm -rf "$HOME/.clawx"
        echo "✓ Data directory removed"
    fi
fi

echo ""
echo "✓ ClawX Web uninstalled successfully"
