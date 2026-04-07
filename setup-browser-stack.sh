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

# --- 5. Generate VNC password ---
if [ ! -f /etc/browser-agent/vncpasswd ]; then
  VNC_PW=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-8)
  echo "$VNC_PW" | sudo x11vnc -storepasswd - /etc/browser-agent/vncpasswd
  echo "$VNC_PW" | sudo tee /etc/browser-agent/vncpasswd.plain
  sudo chmod 600 /etc/browser-agent/vncpasswd*
  LOG "VNC password generated → /etc/browser-agent/vncpasswd.plain"
fi

# --- 6. Detect Chrome path from agent-browser ---
CHROME_PATH=$(agent-browser get cdp-url 2>/dev/null | grep -oP 'chrome://[^ ]+' || echo "")
if [ -z "$CHROME_PATH" ]; then
  # Fallback: find Chrome for Testing binary
  CHROME_PATH=$(find "$HOME/.cache/agent-browser" -name "chrome" -type f 2>/dev/null | head -1)
fi
if [ -z "$CHROME_PATH" ]; then
  CHROME_PATH="chromium-browser"
  LOG "WARNING: Could not find agent-browser Chrome, falling back to chromium-browser"
fi
LOG "Chrome path: $CHROME_PATH"

# --- 7. Write supervisord config ---
sudo tee /etc/supervisor/conf.d/browser-agent.conf > /dev/null <<CONF
[program:xvfb]
command=Xvfb :99 -screen 0 1280x720x16 -ac -nolisten tcp
autostart=false
autorestart=true
stdout_logfile=/var/log/browser-agent/xvfb.log
stderr_logfile=/var/log/browser-agent/xvfb.err

[program:chrome]
command=$CHROME_PATH --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer --disable-extensions --disable-background-networking --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --window-size=1280,720 --no-first-run --user-data-dir=/home/$USER/.chromium-agent --display=:99
environment=DISPLAY=":99",HOME="/home/$USER"
user=$USER
autostart=false
autorestart=true
startsecs=3
stdout_logfile=/var/log/browser-agent/chrome.log
stderr_logfile=/var/log/browser-agent/chrome.err

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
programs=xvfb,chrome,x11vnc,novnc
CONF

# --- 8. Sudoers for supervisorctl (no password) ---
sudo tee /etc/sudoers.d/clawx-browser > /dev/null <<SUDOERS
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl start browser-stack\:*
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl stop browser-stack\:*
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl status browser-stack\:*
$USER ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl restart browser-stack\:*
SUDOERS
sudo chmod 440 /etc/sudoers.d/clawx-browser

# --- 9. Reload supervisord ---
sudo supervisorctl reread
sudo supervisorctl update

LOG "Done!"
LOG "Test: sudo supervisorctl start browser-stack:*"
LOG "Then: agent-browser --cdp 9222 open https://google.com"
LOG "noVNC: http://$(hostname -I | awk '{print $1}'):6080/vnc.html"
