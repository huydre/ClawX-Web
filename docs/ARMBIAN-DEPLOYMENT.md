# ClawX Web - Armbian Deployment Guide

## Quick Fix for npm Install Issues

If you encounter ESLint dependency conflicts, use:

```bash
npm install --legacy-peer-deps
```

## Prerequisites

- Node.js 18+ installed on Armbian
- Git installed
- OpenClaw Gateway running on port 18789

## Deployment Steps

### 1. Clone Repository on Armbian

```bash
cd ~
git clone https://github.com/your-repo/ClawX-Web.git
cd ClawX-Web
git checkout features/web-ui
```

### 2. Install Dependencies

```bash
npm install --legacy-peer-deps
```

**Note:** Use `--legacy-peer-deps` flag to bypass peer dependency conflicts.

### 3. Build the Application

```bash
# Build frontend
npm run build

# Build backend
npm run build:server
```

### 4. Install Systemd Service

```bash
chmod +x install.sh
./install.sh
```

### 5. Verify Installation

```bash
# Check service status
sudo systemctl status clawx-web@$USER.service

# View logs
sudo journalctl -u clawx-web@$USER.service -f
```

### 6. Access the Application

Open browser: `http://armbian-ip:2003`

## Troubleshooting

### npm Install Fails

**Error:** `ERESOLVE unable to resolve dependency tree`

**Solution:**
```bash
npm install --legacy-peer-deps
```

### Build Fails - vite not found

**Cause:** Dependencies not installed

**Solution:**
```bash
npm install --legacy-peer-deps
npm run build
```

### Service Won't Start

**Check logs:**
```bash
sudo journalctl -u clawx-web@$USER.service -n 50
```

**Common issues:**
- Port 2003 already in use: `lsof -i :2003`
- Missing node_modules: Run `npm install --legacy-peer-deps`
- Permission issues: Check `~/.clawx` directory permissions

### Gateway Connection Issues

**Verify gateway is running:**
```bash
lsof -i :18789
```

**Check gateway port in settings:**
```bash
cat ~/.clawx/db.json | grep gatewayPort
```

## Alternative: Build on Development Machine

If Armbian has limited resources, build on your dev machine:

```bash
# On dev machine
npm install --legacy-peer-deps
npm run build
npm run build:server

# Create deployment package
tar -czf clawx-web-built.tar.gz dist dist-server node_modules package.json systemd install.sh uninstall.sh

# Transfer to Armbian
scp clawx-web-built.tar.gz user@armbian-ip:~/

# On Armbian
tar -xzf clawx-web-built.tar.gz
chmod +x install.sh
./install.sh
```

## Service Management

```bash
# Start
sudo systemctl start clawx-web@$USER.service

# Stop
sudo systemctl stop clawx-web@$USER.service

# Restart
sudo systemctl restart clawx-web@$USER.service

# View logs
sudo journalctl -u clawx-web@$USER.service -f

# Disable auto-start
sudo systemctl disable clawx-web@$USER.service
```

## Uninstall

```bash
chmod +x uninstall.sh
./uninstall.sh
```

## Performance Tips for 4GB RAM

1. **Limit Node.js memory:**
   ```bash
   sudo nano /etc/systemd/system/clawx-web@.service
   # Change ExecStart line:
   ExecStart=/usr/bin/node --max-old-space-size=512 /home/%i/clawx-web/dist-server/index.js
   ```

2. **Enable swap:**
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

## Security Notes

- Server binds to `127.0.0.1` (localhost only)
- For LAN access, modify `server/index.ts` to bind to `0.0.0.0`
- Consider using nginx reverse proxy for HTTPS

## Support

Check logs first:
```bash
sudo journalctl -u clawx-web@$USER.service -f
```
