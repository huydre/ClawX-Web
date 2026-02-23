#!/bin/bash

# Fix OpenClaw Gateway origin issue

echo "🔧 Fixing Gateway origin configuration..."

# Find OpenClaw config directory
OPENCLAW_DIR="$HOME/.openclaw"

if [ ! -d "$OPENCLAW_DIR" ]; then
    echo "❌ OpenClaw directory not found at $OPENCLAW_DIR"
    echo "Please install OpenClaw first or specify the correct path."
    exit 1
fi

# Find gateway config file
GATEWAY_CONFIG="$OPENCLAW_DIR/gateway.json"

if [ ! -f "$GATEWAY_CONFIG" ]; then
    echo "📝 Creating gateway.json..."
    cat > "$GATEWAY_CONFIG" << 'EOF'
{
  "controlUi": {
    "allowedOrigins": [
      "http://localhost:2003",
      "http://127.0.0.1:2003",
      "http://192.168.1.18:2003",
      "http://192.168.1.18"
    ]
  }
}
EOF
else
    echo "📝 Gateway config found at $GATEWAY_CONFIG"
    echo "Please manually add these origins to controlUi.allowedOrigins:"
    echo "  - http://192.168.1.18:2003"
    echo "  - http://192.168.1.18"
fi

echo ""
echo "✅ Configuration updated!"
echo ""
echo "Next steps:"
echo "1. Restart OpenClaw Gateway"
echo "2. Restart ClawX Web: pm2 restart clawx-web"
echo ""
echo "If Gateway is running on a different machine:"
echo "- Copy this config to that machine's ~/.openclaw/gateway.json"
echo "- Or run OpenClaw Gateway on this Armbian machine"
