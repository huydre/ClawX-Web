# Phase 6: Systemd Auto-start

**Status**: Not Started
**Priority**: HIGH
**Effort**: 1 day
**Dependencies**: Phase 1-5 (All backend/frontend complete)

## Context

Configure systemd service for auto-start on Armbian boot. Ensure ClawX web server starts automatically when system boots.

**Target**: Armbian (RK3399, 4GB RAM, ARM64)

## Overview

Create systemd service file, configure auto-start, test boot behavior, add monitoring.

## Key Insights

- Port 2003 for web server
- Gateway port 18789 (already configured)
- Install location: ~/.openclaw
- User: Current user (not root)
- Node.js 20 LTS required

## Requirements

1. Create systemd service file
2. Configure service to start on boot
3. Configure auto-restart on failure
4. Add logging to journald
5. Test service start/stop/restart
6. Test boot behavior
7. Add health monitoring

## Architecture

### Service Flow

```
System Boot → systemd → clawx-web.service → Node.js Server → Port 2003
```

### Logging

```
Node.js → Winston → journald → journalctl
```

## Implementation Steps

### Step 1: Create Systemd Service File (1 hour)

**Create service file**:

```bash
sudo nano /etc/systemd/system/clawx-web.service
```

**clawx-web.service**:

```ini
[Unit]
Description=ClawX Web Application
Documentation=https://github.com/your-org/clawx-web
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=%i
WorkingDirectory=/home/%i/.openclaw
ExecStart=/usr/bin/node /home/%i/.openclaw/clawx-web/dist-server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=clawx-web

# Environment
Environment=NODE_ENV=production
Environment=PORT=2003

# Resource limits
LimitNOFILE=65536
MemoryMax=500M

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

**Note**: `%i` is replaced with username when using `systemctl --user`

### Step 2: Alternative - User Service (Recommended) (1 hour)

For non-root user service:

```bash
mkdir -p ~/.config/systemd/user
nano ~/.config/systemd/user/clawx-web.service
```

**~/.config/systemd/user/clawx-web.service**:

```ini
[Unit]
Description=ClawX Web Application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=%h/.openclaw/clawx-web
ExecStart=/usr/bin/node %h/.openclaw/clawx-web/dist-server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment
Environment=NODE_ENV=production
Environment=PORT=2003

# Resource limits
LimitNOFILE=65536

[Install]
WantedBy=default.target
```

**Enable user service**:

```bash
# Enable lingering (service runs even when user not logged in)
sudo loginctl enable-linger $USER

# Reload systemd
systemctl --user daemon-reload

# Enable service
systemctl --user enable clawx-web

# Start service
systemctl --user start clawx-web

# Check status
systemctl --user status clawx-web
```

### Step 3: Create Installation Script (2 hours)

**scripts/install-service.sh**:

```bash
#!/bin/bash

set -e

echo "ClawX Web Service Installer"
echo "============================"
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
  echo "Error: This script only works on Linux"
  exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed"
  echo "Please install Node.js 20 LTS first"
  exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js version must be 20 or higher"
  echo "Current version: $(node -v)"
  exit 1
fi

# Get current user
CURRENT_USER=$(whoami)
HOME_DIR=$HOME

echo "Installing ClawX Web service for user: $CURRENT_USER"
echo "Home directory: $HOME_DIR"
echo ""

# Create directories
echo "Creating directories..."
mkdir -p "$HOME_DIR/.openclaw/clawx-web"
mkdir -p "$HOME_DIR/.clawx/logs"
mkdir -p "$HOME_DIR/.config/systemd/user"

# Copy files
echo "Copying application files..."
cp -r dist-server "$HOME_DIR/.openclaw/clawx-web/"
cp -r dist "$HOME_DIR/.openclaw/clawx-web/"
cp -r node_modules "$HOME_DIR/.openclaw/clawx-web/"
cp package.json "$HOME_DIR/.openclaw/clawx-web/"

# Create service file
echo "Creating systemd service..."
cat > "$HOME_DIR/.config/systemd/user/clawx-web.service" << EOF
[Unit]
Description=ClawX Web Application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$HOME_DIR/.openclaw/clawx-web
ExecStart=/usr/bin/node $HOME_DIR/.openclaw/clawx-web/dist-server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

Environment=NODE_ENV=production
Environment=PORT=2003

LimitNOFILE=65536

[Install]
WantedBy=default.target
EOF

# Enable lingering
echo "Enabling user lingering..."
sudo loginctl enable-linger $CURRENT_USER

# Reload systemd
echo "Reloading systemd..."
systemctl --user daemon-reload

# Enable service
echo "Enabling service..."
systemctl --user enable clawx-web

# Start service
echo "Starting service..."
systemctl --user start clawx-web

# Wait for service to start
sleep 3

# Check status
echo ""
echo "Service status:"
systemctl --user status clawx-web --no-pager

# Test health endpoint
echo ""
echo "Testing health endpoint..."
if curl -s http://localhost:2003/health > /dev/null; then
  echo "✓ Service is running and healthy"
else
  echo "✗ Service health check failed"
  exit 1
fi

echo ""
echo "Installation complete!"
echo ""
echo "Useful commands:"
echo "  systemctl --user status clawx-web    # Check status"
echo "  systemctl --user stop clawx-web      # Stop service"
echo "  systemctl --user start clawx-web     # Start service"
echo "  systemctl --user restart clawx-web   # Restart service"
echo "  journalctl --user -u clawx-web -f    # View logs"
echo ""
echo "Access the application at: http://localhost:2003"
```

Make executable:

```bash
chmod +x scripts/install-service.sh
```

### Step 4: Create Uninstall Script (1 hour)

**scripts/uninstall-service.sh**:

```bash
#!/bin/bash

set -e

echo "ClawX Web Service Uninstaller"
echo "=============================="
echo ""

CURRENT_USER=$(whoami)
HOME_DIR=$HOME

echo "Uninstalling ClawX Web service for user: $CURRENT_USER"
echo ""

# Stop service
echo "Stopping service..."
systemctl --user stop clawx-web || true

# Disable service
echo "Disabling service..."
systemctl --user disable clawx-web || true

# Remove service file
echo "Removing service file..."
rm -f "$HOME_DIR/.config/systemd/user/clawx-web.service"

# Reload systemd
echo "Reloading systemd..."
systemctl --user daemon-reload

# Ask about data removal
echo ""
read -p "Remove application data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Removing application files..."
  rm -rf "$HOME_DIR/.openclaw/clawx-web"
  rm -rf "$HOME_DIR/.clawx"
  echo "✓ Application data removed"
else
  echo "Application data preserved"
fi

echo ""
echo "Uninstallation complete!"
```

Make executable:

```bash
chmod +x scripts/uninstall-service.sh
```

### Step 5: Test Service (2 hours)

**Test commands**:

```bash
# Check service status
systemctl --user status clawx-web

# View logs
journalctl --user -u clawx-web -f

# Test restart
systemctl --user restart clawx-web

# Test stop/start
systemctl --user stop clawx-web
systemctl --user start clawx-web

# Test health endpoint
curl http://localhost:2003/health

# Test reboot
sudo reboot
# After reboot, check if service started
systemctl --user status clawx-web
```

### Step 6: Add Health Monitoring (1 hour)

**scripts/health-check.sh**:

```bash
#!/bin/bash

# Health check script for monitoring

URL="http://localhost:2003/health"
MAX_RETRIES=3
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf "$URL" > /dev/null; then
    echo "✓ Service is healthy"
    exit 0
  fi

  echo "Health check failed (attempt $i/$MAX_RETRIES)"

  if [ $i -lt $MAX_RETRIES ]; then
    sleep $RETRY_DELAY
  fi
done

echo "✗ Service is unhealthy after $MAX_RETRIES attempts"
echo "Restarting service..."
systemctl --user restart clawx-web

exit 1
```

**Add to crontab** (optional):

```bash
# Check health every 5 minutes
*/5 * * * * /home/$USER/.openclaw/clawx-web/scripts/health-check.sh >> /home/$USER/.clawx/logs/health-check.log 2>&1
```

### Step 7: Create README (1 hour)

**docs/deployment.md**:

```markdown
# ClawX Web Deployment Guide

## Prerequisites

- Armbian (or any Linux distribution)
- Node.js 20 LTS or higher
- systemd

## Installation

1. Build the application:
   ```bash
   pnpm build
   pnpm build:server
   ```

2. Run installation script:
   ```bash
   ./scripts/install-service.sh
   ```

3. Verify service is running:
   ```bash
   systemctl --user status clawx-web
   ```

4. Access the application:
   ```
   http://localhost:2003
   ```

## Service Management

### Check Status
```bash
systemctl --user status clawx-web
```

### View Logs
```bash
journalctl --user -u clawx-web -f
```

### Restart Service
```bash
systemctl --user restart clawx-web
```

### Stop Service
```bash
systemctl --user stop clawx-web
```

### Start Service
```bash
systemctl --user start clawx-web
```

## Troubleshooting

### Service won't start
1. Check logs: `journalctl --user -u clawx-web -n 50`
2. Verify Node.js version: `node -v`
3. Check port availability: `lsof -i :2003`

### Service stops after reboot
1. Verify lingering is enabled: `loginctl show-user $USER | grep Linger`
2. If not, enable: `sudo loginctl enable-linger $USER`

### High memory usage
1. Check memory: `systemctl --user status clawx-web`
2. Adjust MemoryMax in service file if needed

## Uninstallation

```bash
./scripts/uninstall-service.sh
```
```

## Todo List

- [ ] Create systemd service file
- [ ] Create installation script
- [ ] Create uninstall script
- [ ] Test service start/stop
- [ ] Test service restart
- [ ] Test auto-start on boot
- [ ] Enable user lingering
- [ ] Test health endpoint
- [ ] Create health monitoring script
- [ ] Add cron job for health checks (optional)
- [ ] Create deployment documentation
- [ ] Test on Armbian device

## Success Criteria

- [ ] Service starts automatically on boot
- [ ] Service restarts on failure
- [ ] Logs visible in journalctl
- [ ] Health endpoint responding
- [ ] Service survives reboot
- [ ] Installation script works
- [ ] Uninstall script works
- [ ] Documentation complete

## Risk Assessment

**Low Risk**: systemd is standard on Linux
- Mitigation: Test on target device

**Medium Risk**: User lingering
- Mitigation: Document clearly, test thoroughly

**Low Risk**: Port conflicts
- Mitigation: Check port availability in install script

## Security Considerations

- Service runs as non-root user
- NoNewPrivileges=true
- PrivateTmp=true
- Memory limit enforced
- File descriptor limit set

## Next Steps

After completion, proceed to Phase 7 (Testing & Deployment) for final testing and deployment to Armbian device.
