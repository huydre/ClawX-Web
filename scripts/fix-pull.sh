#!/bin/bash
# Fix divergent branches on server — run once, fixes forever
# Usage: curl -sL https://raw.githubusercontent.com/huydre/ClawX-Web/main/scripts/fix-pull.sh | bash
set -e
cd /opt/clawx-web
echo "[fix] Setting git config..."
git config pull.rebase false
echo "[fix] Fetching + resetting to origin/main..."
git fetch origin main
git reset --hard origin/main
echo "[fix] Restarting clawx service..."
sudo systemctl restart clawx 2>/dev/null || echo "[fix] Could not restart (no sudo?). Restart manually."
echo "[fix] Done! Server synced with latest main."
