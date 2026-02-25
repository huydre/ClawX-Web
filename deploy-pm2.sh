#!/bin/bash

set -e

echo "🚀 ClawX PM2 Deployment Script"
echo "================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file with:"
    echo "  CLOUDFLARE_API_TOKEN=your_token"
    echo "  CLOUDFLARE_TUNNEL_DOMAIN=your_domain"
    echo "  CLOUDFLARE_TUNNEL_SUBDOMAIN=your_subdomain"
    echo "  GATEWAY_TOKEN=your_gateway_token"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --prod

# Build server
echo "🔨 Building server..."
pnpm build:server

# Build frontend (if not exists)
if [ ! -d "dist" ]; then
    echo "🔨 Building frontend..."
    pnpm install
    pnpm build
fi

# Create logs directory
mkdir -p logs

# Stop existing PM2 process
echo "🛑 Stopping existing process..."
pm2 delete clawx 2>/dev/null || true

# Start with PM2
echo "▶️  Starting ClawX with PM2..."
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Status:"
pm2 status

echo ""
echo "📝 Useful commands:"
echo "  pm2 logs clawx       - View logs"
echo "  pm2 restart clawx    - Restart app"
echo "  pm2 stop clawx       - Stop app"
echo "  pm2 delete clawx     - Remove app"
echo "  pm2 monit            - Monitor resources"
echo ""
echo "🌐 App running at: http://localhost:2003"
