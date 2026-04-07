# Phase 1: System Setup & Dependencies

**Priority:** CRITICAL | **Status:** Pending | **Target:** LIVA Q3 Plus (Ubuntu 22.04)

## Overview

Install apt packages, configure supervisord for browser stack, set up 4GB swap, grant sudoers rules. One-time setup script.

## Files to Create

- `setup-browser-stack.sh` (in project root) — idempotent install script

## Steps

### 1. Write `setup-browser-stack.sh`

```bash
#!/bin/bash
# Setup browser automation stack for LIVA Q3 Plus
set -euo pipefail

LOG() { echo "[setup-browser] $*"; }

# --- 1. Install apt packages ---
LOG "Installing apt packages..."
sudo apt update
sudo apt install -y \
  xvfb x11vnc novnc websockify \
  chromium-browser supervisor \
  net-tools curl

# --- 2. Configure 4GB swap (if not exists) ---
if ! swapon --show | grep -q /swapfile; then
  LOG "Creating 4GB swapfile..."
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# --- 3. Create dirs ---
sudo mkdir -p /var/log/browser-agent /etc/browser-agent
sudo chown -R "$USER:$USER" /var/log/browser-agent

# --- 4. Generate VNC password ---
if [ ! -f /etc/browser-agent/vncpasswd ]; then
  VNC_PW=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-8)
  echo "$VNC_PW" | sudo x11vnc -storepasswd - /etc/browser-agent/vncpasswd
  echo "$VNC_PW" | sudo tee /etc/browser-agent/vncpasswd.plain
  sudo chmod 600 /etc/browser-agent/vncpasswd*
  LOG "VNC password generated → /etc/browser-agent/vncpasswd.plain"
fi

# --- 5. Write supervisord config ---
sudo tee /etc/supervisor/conf.d/browser-agent.conf > /dev/null <<EOF
[program:xvfb]
command=Xvfb :99 -screen 0 1280x720x16 -ac -nolisten tcp
autostart=false
autorestart=true
stdout_logfile=/var/log/browser-agent/xvfb.log
stderr_logfile=/var/log/browser-agent/xvfb.err

[program:chromium]
command=/bin/bash -c "systemd-run --user --scope -p MemoryMax=1800M -p CPUQuota=150%% chromium-browser --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer --disable-extensions --disable-background-networking --memory-pressure-off --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --window-size=1280,720 --no-first-run --user-data-dir=\$HOME/.chromium-agent --display=:99"
environment=DISPLAY=":99",HOME="/home/$USER"
user=$USER
autostart=false
autorestart=true
startsecs=3
stdout_logfile=/var/log/browser-agent/chromium.log
stderr_logfile=/var/log/browser-agent/chromium.err

[program:x11vnc]
command=x11vnc -display :99 -rfbport 5900 -localhost -shared -forever -bpp 16 -defer 100 -wait 100 -noxdamage -noxfixes -noxrandr -rfbauth /etc/browser-agent/vncpasswd
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

[group:browser-stack]
programs=xvfb,chromium,x11vnc,novnc
priority=999
EOF

# --- 6. Sudoers for supervisorctl (no password) ---
sudo tee /etc/sudoers.d/clawx-browser > /dev/null <<EOF
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl start browser-stack\\:*
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl stop browser-stack\\:*
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl status browser-stack\\:*
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl restart browser-stack\\:*
EOF
sudo chmod 440 /etc/sudoers.d/clawx-browser

# --- 7. Reload supervisord ---
sudo supervisorctl reread
sudo supervisorctl update

LOG "Done. Test: sudo supervisorctl start browser-stack:*"
LOG "Then: curl http://localhost:9222/json/version"
LOG "noVNC: http://<liva-ip>:6080/vnc.html"
```

### 2. Make executable

```bash
chmod +x setup-browser-stack.sh
```

## Validation

Run on LIVA:
```bash
./setup-browser-stack.sh
sudo supervisorctl start browser-stack:*
sleep 5
curl -s http://localhost:9222/json/version | head  # should return Chromium CDP info
free -h  # check RAM usage
```

Expected: Chromium CDP responds, RAM usage <2.2GB active.

## Todo

- [ ] Write `setup-browser-stack.sh`
- [ ] Test idempotency (run script 2x, no errors)
- [ ] Verify `supervisorctl start browser-stack:*` works without sudo password
- [ ] Confirm CDP reachable at localhost:9222
- [ ] Confirm noVNC reachable at :6080
- [ ] Measure idle + active RAM

## Success Criteria

- Script runs clean on fresh Ubuntu 22.04.
- 4GB swap active.
- supervisorctl commands work without password prompt.
- Browser stack starts in <8s.
- RAM usage <2.2GB with Chromium on blank page.

## Risks

- **chromium-browser apt package is snap on Ubuntu 22.04** → may need `sudo snap install chromium` OR install from Debian repo. Test first.
- **systemd-run --user --scope** requires user session bus → may need `XDG_RUNTIME_DIR` env var set.

## Next

Phase 2: BrowserManager service to wrap supervisorctl + CDP.
