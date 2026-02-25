#!/bin/bash

# ClawX Docker Deployment Script for Armbian

set -e

echo "🚀 ClawX Docker Deployment"
echo "=========================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. Please log out and log back in for group changes to take effect."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y docker-compose
fi

# Stop and remove old containers
echo "🛑 Stopping old containers..."
docker-compose down 2>/dev/null || true

# Build new image
echo "🔨 Building Docker image..."
docker-compose build

# Start services
echo "▶️  Starting services..."
docker-compose up -d

# Show logs
echo "📋 Showing logs (Ctrl+C to exit)..."
docker-compose logs -f
