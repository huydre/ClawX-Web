#!/bin/bash

# Fix OpenClaw Gateway origin configuration
# This script adds allowedOrigins to the gateway.controlUi section in openclaw.json

set -e

echo "🔧 Fixing OpenClaw Gateway origin configuration..."
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  Warning: Not running as root. Some operations may fail."
    echo "   Consider running with: sudo bash $0"
    echo ""
fi

# Find OpenClaw directory
OPENCLAW_DIR="$HOME/.openclaw"

if [ ! -d "$OPENCLAW_DIR" ]; then
    echo "❌ OpenClaw directory not found at $OPENCLAW_DIR"
    echo "   Please install OpenClaw first."
    exit 1
fi

CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ OpenClaw config file not found at $CONFIG_FILE"
    exit 1
fi

echo "📁 Found OpenClaw config at: $CONFIG_FILE"
echo ""

# Install jq if not available
if ! command -v jq &> /dev/null; then
    echo "📦 Installing jq..."
    apt update -qq
    apt install -y jq
    echo "✅ jq installed"
    echo ""
fi

# Backup original config
BACKUP_FILE="$CONFIG_FILE.backup-$(date +%Y%m%d-%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "💾 Backup created at: $BACKUP_FILE"
echo ""

# Get server IP (try to detect)
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="192.168.1.18"
fi

echo "🌐 Detected server IP: $SERVER_IP"
echo ""

# Add controlUi to gateway section
echo "📝 Updating gateway.controlUi.allowedOrigins..."
jq --arg ip "$SERVER_IP" '.gateway.controlUi.allowedOrigins = [
  "http://localhost:2003",
  "http://127.0.0.1:2003",
  ("http://" + $ip + ":2003"),
  ("http://" + $ip)
]' "$CONFIG_FILE" > /tmp/openclaw-new.json

# Verify the update
if [ $? -eq 0 ]; then
    mv /tmp/openclaw-new.json "$CONFIG_FILE"
    echo "✅ Config updated successfully"
    echo ""

    # Show the new config
    echo "📋 New gateway.controlUi configuration:"
    jq '.gateway.controlUi' "$CONFIG_FILE"
    echo ""

    # Ask to restart Gateway
    echo "🔄 Restarting OpenClaw Gateway..."

    # Find and kill Gateway process
    GATEWAY_PID=$(pgrep -f "openclaw.*gateway" || true)
    if [ -n "$GATEWAY_PID" ]; then
        echo "   Stopping Gateway (PID: $GATEWAY_PID)..."
        kill -9 $GATEWAY_PID 2>/dev/null || true
        sleep 2
    fi

    # Start Gateway
    echo "   Starting Gateway..."
    nohup openclaw gateway start > /tmp/openclaw-gateway.log 2>&1 &
    sleep 3

    # Check if Gateway started
    NEW_PID=$(pgrep -f "openclaw.*gateway" || true)
    if [ -n "$NEW_PID" ]; then
        echo "✅ Gateway restarted successfully (PID: $NEW_PID)"
    else
        echo "⚠️  Gateway may not have started. Check logs:"
        echo "   tail -f /tmp/openclaw-gateway.log"
    fi

    echo ""
    echo "🎉 Configuration complete!"
    echo ""
    echo "Next steps:"
    echo "1. Restart ClawX Web: pm2 restart clawx-web"
    echo "2. Check logs: pm2 logs clawx-web --lines 10"
    echo "3. You should see: 'Gateway handshake completed successfully'"
    echo ""
    echo "Access ClawX at: http://$SERVER_IP:2003"

else
    echo "❌ Failed to update config"
    echo "   Restoring backup..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi
