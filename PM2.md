# ClawX PM2 Deployment Guide

## Quick Start

### 1. Tạo file .env

```bash
cat > .env << EOF
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_TUNNEL_DOMAIN=veoforge.ggff.net
CLOUDFLARE_TUNNEL_SUBDOMAIN=clawbox02
GATEWAY_TOKEN=your_gateway_token_here
EOF
```

### 2. Deploy với script tự động

```bash
./deploy-pm2.sh
```

### 3. Hoặc deploy thủ công

```bash
# Install dependencies
pnpm install --prod

# Build server
pnpm build:server

# Build frontend (nếu chưa có)
pnpm build

# Start with PM2
pm2 start ecosystem.config.cjs

# Save process list
pm2 save

# Auto-start on server reboot
pm2 startup
```

## PM2 Commands

```bash
# View logs
pm2 logs clawx

# View logs realtime
pm2 logs clawx --lines 100

# Monitor resources
pm2 monit

# Restart app
pm2 restart clawx

# Stop app
pm2 stop clawx

# Delete app
pm2 delete clawx

# View status
pm2 status

# View detailed info
pm2 show clawx
```

## Update Code

```bash
# Pull latest code
git pull

# Rebuild
pnpm build:server
pnpm build

# Restart
pm2 restart clawx
```

## Auto-start on Server Reboot

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

## Troubleshooting

### View error logs
```bash
pm2 logs clawx --err
```

### Clear logs
```bash
pm2 flush clawx
```

### Restart with fresh state
```bash
pm2 delete clawx
pm2 start ecosystem.config.cjs
```

### Check if port 2003 is in use
```bash
lsof -i :2003
# or
netstat -tulpn | grep 2003
```

## Resource Limits

App sẽ tự động restart nếu dùng quá 500MB RAM (cấu hình trong `ecosystem.config.cjs`).

## Logs Location

- Error logs: `./logs/pm2-error.log`
- Output logs: `./logs/pm2-out.log`
