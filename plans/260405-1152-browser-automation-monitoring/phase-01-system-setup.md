# Phase 1: System Setup & Dependencies (v2)

**Priority:** CRITICAL | **Status:** Pending | **Target:** LIVA Q3 Plus (Ubuntu 22.04)

## Overview

Install apt packages (Xvfb, x11vnc, noVNC), install agent-browser CLI globally,
configure supervisord for browser stack, set up 4GB swap, grant sudoers rules.

## Changes from v1

- Added `agent-browser` global install (npm)
- Added `agent-browser install` (downloads Chrome for Testing)
- Added optional dashboard process in supervisord
- Chrome launched with `--headed` + `DISPLAY=:99` (visible on Xvfb)

## Files to Create

- `setup-browser-stack.sh` (in project root) — idempotent install script

## Steps

### Write `setup-browser-stack.sh`

```bash
#!/bin/bash
# Setup browser automation stack for LIVA Q3 Plus
# Components: Xvfb + Chrome + x11vnc + noVNC + agent-browser
set -euo pipefail

LOG() { echo "[setup-browser] $*"; }

# --- 1. Install apt packages ---
LOG "Installing apt packages..."
sudo apt update
sudo apt install -y \
  xvfb x11vnc novnc websockify \
  supervisor net-tools curl

# --- 2. Install agent-browser CLI globally ---
LOG "Installing agent-browser..."
npm i -g agent-browser
agent-browser install --with-deps  # Downloads Chrome for Testing + Linux deps

# --- 3. Configure 4GB swap (if not exists) ---
if ! swapon --show | grep -q /swapfile; then
  LOG "Creating 4GB swapfile..."
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# --- 4. Create dirs ---
sudo mkdir -p /var/log/browser-agent /etc/browser-agent
sudo chown -R "$USER:$USER" /var/log/browser-agent

# --- 5. Generate VNC password ---
if [ ! -f /etc/browser-agent/vncpasswd ]; then
  VNC_PW=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-8)
  echo "$VNC_PW" | sudo x11vnc -storepasswd - /etc/browser-agent/vncpasswd
  echo "$VNC_PW" | sudo tee /etc/browser-agent/vncpasswd.plain
  sudo chmod 600 /etc/browser-agent/vncpasswd*
  LOG "VNC password generated → /etc/browser-agent/vncpasswd.plain"
fi

# --- 6. Write supervisord config ---
sudo tee /etc/supervisor/conf.d/browser-agent.conf > /dev/null <<'CONF'
[program:xvfb]
command=Xvfb :99 -screen 0 1280x720x16 -ac -nolisten tcp
autostart=false
autorestart=true
stdout_logfile=/var/log/browser-agent/xvfb.log
stderr_logfile=/var/log/browser-agent/xvfb.err

[program:chrome]
command=%(ENV_HOME)s/.cache/agent-browser/chrome/chrome
    --no-sandbox
    --disable-gpu
    --disable-dev-shm-usage
    --disable-software-rasterizer
    --disable-extensions
    --disable-background-networking
    --remote-debugging-port=9222
    --remote-debugging-address=127.0.0.1
    --window-size=1280,720
    --no-first-run
    --user-data-dir=%(ENV_HOME)s/.chromium-agent
    --display=:99
environment=DISPLAY=":99",HOME="/home/LIVA_USER"
autostart=false
autorestart=true
startsecs=3
stdout_logfile=/var/log/browser-agent/chrome.log
stderr_logfile=/var/log/browser-agent/chrome.err

[program:x11vnc]
command=x11vnc -display :99 -rfbport 5900 -localhost -shared -forever
    -bpp 16 -defer 100 -wait 100
    -noxdamage -noxfixes -noxrandr
    -rfbauth /etc/browser-agent/vncpasswd
autostart=false
autorestart=true
stdout_logfile=/var/log/browser-agent/x11vnc.log
stderr_logfile=/var/log/browser-agent/x11vnc.err

[program:novnc]
command=websockify --web=/usr/share/novnc/ 6080 localhost:5900
autostart=false
autorestart=true
stdout_logfile=/var/log/browser-agent/novnc.log
stderr_logfile=/var/log/browser-agent/novnc.err

[program:agent-dashboard]
command=agent-browser dashboard start --port 4848
autostart=false
autorestart=true
stdout_logfile=/var/log/browser-agent/dashboard.log
stderr_logfile=/var/log/browser-agent/dashboard.err

[group:browser-stack]
programs=xvfb,chrome,x11vnc,novnc,agent-dashboard
CONF

# Replace LIVA_USER placeholder with actual user
sudo sed -i "s/LIVA_USER/$USER/g" /etc/supervisor/conf.d/browser-agent.conf

# --- 7. Sudoers for supervisorctl (no password) ---
sudo tee /etc/sudoers.d/clawx-browser > /dev/null <<SUDOERS
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl start browser-stack\\:*
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl stop browser-stack\\:*
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl status browser-stack\\:*
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl restart browser-stack\\:*
SUDOERS
sudo chmod 440 /etc/sudoers.d/clawx-browser

# --- 8. Reload supervisord ---
sudo supervisorctl reread
sudo supervisorctl update

LOG "Done!"
LOG "Test: sudo supervisorctl start browser-stack:*"
LOG "Then: agent-browser --cdp 9222 open https://google.com"
LOG "noVNC: http://<liva-ip>:6080/vnc.html"
LOG "Dashboard: http://<liva-ip>:4848"
```

## Validation

```bash
./setup-browser-stack.sh
sudo supervisorctl start browser-stack:*
sleep 8

# Test agent-browser connects to Chrome
agent-browser --cdp 9222 open https://google.com
agent-browser snapshot | head -20

# Test noVNC
curl -s http://localhost:6080/vnc.html | head -5

# Test dashboard
curl -s http://localhost:4848 | head -5

# Check RAM
free -h
```

## Todo

- [ ] Write `setup-browser-stack.sh`
- [ ] Test on LIVA: verify Chrome for Testing works
- [ ] Verify agent-browser connects via `--cdp 9222`
- [ ] Confirm noVNC reachable at :6080
- [ ] Confirm dashboard reachable at :4848
- [ ] Measure idle + active RAM

## Risks

- **Chrome for Testing path**: `agent-browser install` puts Chrome in `~/.cache/agent-browser/chrome/`. Verify exact path with `agent-browser get cdp-url` or `which` equivalent.
- **agent-browser install --with-deps** may require sudo for apt deps on Linux.

## Next

Phase 2: BrowserManager service wrapping agent-browser CLI.
