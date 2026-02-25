# ClawX Docker Deployment Guide

## Prerequisites

1. Docker installed on Armbian server
2. `.env` file with configuration

## Quick Start

### 1. Build and run locally (for testing)

```bash
# Build image
docker build -t clawx-web .

# Run container
docker run -d \
  --name clawx \
  -p 2003:2003 \
  --env-file .env \
  -v clawx-data:/app/data \
  clawx-web
```

### 2. Deploy to Armbian with Docker Compose

```bash
# Copy files to server
scp -r . root@192.168.1.18:/opt/clawx/

# SSH to server
ssh root@192.168.1.18

# Navigate to directory
cd /opt/clawx

# Run deployment script
./deploy-docker.sh
```

### 3. Manual Docker Compose commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Check status
docker-compose ps
```

## Environment Variables

Create `.env` file:

```env
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_TUNNEL_DOMAIN=veoforge.ggff.net
CLOUDFLARE_TUNNEL_SUBDOMAIN=clawbox02
GATEWAY_TOKEN=your_gateway_token_here
```

## Useful Commands

```bash
# View container logs
docker logs -f clawx-web

# Execute command in container
docker exec -it clawx-web sh

# Restart container
docker restart clawx-web

# Remove container and volume
docker-compose down -v

# Check container health
docker inspect clawx-web | grep -A 10 Health
```

## Troubleshooting

### Container won't start
```bash
docker logs clawx-web
```

### Check if port is available
```bash
netstat -tulpn | grep 2003
```

### Rebuild from scratch
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

For production, consider:

1. Use Docker secrets for sensitive data
2. Set up log rotation
3. Configure resource limits
4. Use Docker Swarm or Kubernetes for orchestration
5. Set up monitoring with Prometheus/Grafana
