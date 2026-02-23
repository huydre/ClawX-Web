# ClawX Web - Deployment Guide for Armbian

This guide covers deploying ClawX Web on Armbian (ARM64) systems like RK3399.

## Prerequisites

- Armbian OS (tested on RK3399, 4GB RAM)
- Node.js 18+ installed
- OpenClaw Gateway already installed and running on port 18789
- Sudo access for systemd service installation

## Quick Start

### 1. Build the Project

On your development machine:

```bash
# Install dependencies
npm install

# Build frontend and backend
npm run build
npm run build:server
```

### 2. Transfer Files to Armbian

Transfer the following files/directories to your Armbian device:

```bash
# Required files
- dist/                  # Frontend build
- dist-server/          # Backend build
- node_modules/         # Dependencies
- package.json          # Package info
- systemd/              # Systemd service file
- install.sh            # Installation script
- uninstall.sh          # Uninstall script
```

Example using scp:

```bash
# Create archive
tar -czf clawx-web.tar.gz dist dist-server node_modules package.json systemd install.sh uninstall.sh

# Transfer to Armbian
scp clawx-web.tar.gz user@armbian-ip:~/

# On Armbian, extract
ssh user@armbian-ip
cd ~
tar -xzf clawx-web.tar.gz
```

### 3. Install on Armbian

```bash
# Make install script executable
chmod +x install.sh

# Run installation
./install.sh
```

The installation script will:
- Copy files to `~/clawx-web`
- Create data directory at `~/.clawx`
- Install systemd service
- Enable auto-start on boot
- Start the service

### 4. Access the Web Interface

Open your browser and navigate to:

```
http://armbian-ip:2003
```

Or from the Armbian device itself:

```
http://127.0.0.1:2003
```

## Manual Installation

If you prefer manual installation:

### 1. Create Installation Directory

```bash
mkdir -p ~/clawx-web
cd ~/clawx-web
```

### 2. Copy Files

Copy `dist`, `dist-server`, `node_modules`, and `package.json` to `~/clawx-web`

### 3. Create Data Directory

```bash
mkdir -p ~/.clawx/logs
mkdir -p ~/.clawx/uploads
```

### 4. Test the Server

```bash
cd ~/clawx-web
NODE_ENV=production PORT=2003 node dist-server/index.js
```

### 5. Install Systemd Service

```bash
# Copy service file
sudo cp systemd/clawx-web.service /etc/systemd/system/clawx-web@.service

# Update paths in service file
sudo sed -i "s|/home/%i/clawx-web|$HOME/clawx-web|g" /etc/systemd/system/clawx-web@.service

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable clawx-web@$USER.service
sudo systemctl start clawx-web@$USER.service
```

## Service Management

### Check Status

```bash
sudo systemctl status clawx-web@$USER.service
```

### View Logs

```bash
# Follow logs in real-time
sudo journalctl -u clawx-web@$USER.service -f

# View last 50 lines
sudo journalctl -u clawx-web@$USER.service -n 50
```

### Restart Service

```bash
sudo systemctl restart clawx-web@$USER.service
```

### Stop Service

```bash
sudo systemctl stop clawx-web@$USER.service
```

### Disable Auto-start

```bash
sudo systemctl disable clawx-web@$USER.service
```

## Uninstallation

```bash
# Make uninstall script executable
chmod +x uninstall.sh

# Run uninstallation
./uninstall.sh
```

The uninstall script will:
- Stop and disable the service
- Remove systemd service file
- Optionally remove installation directory
- Optionally remove data directory

## Configuration

### Port Configuration

The default port is 2003. To change it:

1. Edit the systemd service file:
   ```bash
   sudo nano /etc/systemd/system/clawx-web@.service
   ```

2. Change the `PORT` environment variable:
   ```
   Environment="PORT=YOUR_PORT"
   ```

3. Reload and restart:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart clawx-web@$USER.service
   ```

### Gateway Port

The default gateway port is 18789. This is configured in `~/.clawx/db.json`:

```json
{
  "settings": {
    "gatewayPort": 18789
  }
}
```

## Troubleshooting

### Service Won't Start

Check logs:
```bash
sudo journalctl -u clawx-web@$USER.service -n 100
```

Common issues:
- Port 2003 already in use
- Node.js not found
- Missing dependencies
- Permission issues with `~/.clawx` directory

### Gateway Connection Issues

1. Verify OpenClaw Gateway is running:
   ```bash
   lsof -i :18789
   ```

2. Check gateway logs

3. Verify gateway port in settings matches actual gateway port

### Permission Denied

Ensure the service user has read/write access to:
- `~/clawx-web` (read-only)
- `~/.clawx` (read-write)

## Performance Optimization

For low-memory devices (4GB RAM):

1. Limit Node.js memory:
   ```bash
   # Edit service file
   sudo nano /etc/systemd/system/clawx-web@.service

   # Add to ExecStart line
   ExecStart=/usr/bin/node --max-old-space-size=512 /home/%i/clawx-web/dist-server/index.js
   ```

2. Enable swap if not already enabled

## Security Notes

- The web server binds to `127.0.0.1` by default (localhost only)
- To allow LAN access, you'll need to modify `server/index.ts` to bind to `0.0.0.0`
- Consider using a reverse proxy (nginx) for HTTPS
- The systemd service includes security hardening options

## Updates

To update ClawX Web:

1. Build new version on development machine
2. Stop the service:
   ```bash
   sudo systemctl stop clawx-web@$USER.service
   ```
3. Replace files in `~/clawx-web`
4. Start the service:
   ```bash
   sudo systemctl start clawx-web@$USER.service
   ```

## Support

For issues or questions, check the logs first:
```bash
sudo journalctl -u clawx-web@$USER.service -f
```
