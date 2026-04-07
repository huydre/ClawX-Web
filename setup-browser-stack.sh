#!/bin/bash
# Setup browser automation stack for LIVA Q3 Plus
# Components: Xvfb + x11vnc + noVNC + agent-browser (Chrome)
set -euo pipefail

LOG() { echo "[setup-browser] $*"; }

# --- 1. Install apt packages ---
LOG "Installing apt packages..."
sudo apt update
sudo apt install -y xvfb x11vnc novnc websockify supervisor net-tools curl

# --- 2. Install agent-browser CLI + Chrome ---
LOG "Installing agent-browser..."
npm i -g agent-browser
agent-browser install --with-deps

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

# --- 5. Find Chrome binary ---
CHROME_PATH=$(find "$HOME/.agent-browser/browsers" -name "chrome" -type f 2>/dev/null | sort -r | head -1)
if [ -z "$CHROME_PATH" ]; then
  LOG "ERROR: Chrome binary not found. Run 'agent-browser install' first."
  exit 1
fi
LOG "Chrome path: $CHROME_PATH"

# --- 6. Write supervisord config (display stack only, Chrome managed by BrowserManager) ---
sudo tee /etc/supervisor/conf.d/browser-agent.conf > /dev/null <<CONF
[program:xvfb]
command=Xvfb :99 -screen 0 1280x720x16 -ac -nolisten tcp
autostart=false
autorestart=true
stdout_logfile=/var/log/browser-agent/xvfb.log
stderr_logfile=/var/log/browser-agent/xvfb.err

[program:x11vnc]
command=x11vnc -display :99 -rfbport 5900 -localhost -shared -forever -defer 100 -wait 100 -nopw
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
programs=xvfb,x11vnc,novnc
CONF

# --- 7. Sudoers for supervisorctl (no password) ---
echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl" | sudo tee /etc/sudoers.d/clawx-browser > /dev/null
sudo chmod 440 /etc/sudoers.d/clawx-browser

# --- 8. Reload supervisord ---
sudo supervisorctl reread
sudo supervisorctl update

LOG "Done!"
LOG "Chrome: $CHROME_PATH"
LOG "Browser stack managed by ClawX-Web (Start button in Browser tab)"
LOG "OpenClaw can connect via: agent-browser --cdp 9222"
