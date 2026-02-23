#!/bin/bash

# ClawX Web Deployment Script for Armbian

set -e

echo "🚀 Starting ClawX deployment..."

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin features/web-ui

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build frontend and server
echo "🔨 Building frontend..."
npm run build

echo "🔨 Building server..."
npm run build:server

# Restart PM2 process
echo "♻️  Restarting application..."
pm2 restart clawx-web

# Show status
echo "✅ Deployment complete!"
pm2 status

echo ""
echo "📊 View logs with: pm2 logs clawx-web"
echo "🌐 Access at: http://192.168.1.18:2003"
