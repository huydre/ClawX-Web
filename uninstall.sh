#!/bin/bash
# ============================================================================
# ClawX-Web Uninstaller
# Removes ClawX-Web service, files, and optionally the service user
# Usage: sudo ./uninstall.sh
# ============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

SERVICE_NAME="clawx"
CLAWX_DIR="/opt/clawx-web"

# Auto-detect user: read from .clawx-owner, fall back to SUDO_USER, then "clawx"
if [[ -f "$CLAWX_DIR/.clawx-owner" ]]; then
    CLAWX_USER=$(cat "$CLAWX_DIR/.clawx-owner" 2>/dev/null | tr -d '[:space:]')
fi
if [[ -z "${CLAWX_USER:-}" ]]; then
    if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
        CLAWX_USER="$SUDO_USER"
    else
        CLAWX_USER="clawx"
    fi
fi

log()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo -e "${CYAN}"
echo "  ┌─────────────────────────────────────────┐"
echo "  │  🦀  ClawX-Web Uninstaller              │"
echo "  └─────────────────────────────────────────┘"
echo -e "${NC}"

if [[ $EUID -ne 0 ]]; then
  error "Please run as root: ${BOLD}sudo ./uninstall.sh${NC}"
fi

echo -e "  ${RED}${BOLD}This will remove ClawX-Web from this system.${NC}"
echo ""
echo -en "  Are you sure? (type ${BOLD}yes${NC} to confirm): "
read -r CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
  warn "Uninstall cancelled."
  exit 0
fi

# ── Stop and remove service ────────────────────────────────────────────────
echo ""
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  systemctl stop "$SERVICE_NAME"
  log "Service stopped"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
  systemctl disable "$SERVICE_NAME" >/dev/null 2>&1
  log "Service disabled"
fi

if [[ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]]; then
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  log "Systemd unit removed"
fi

# ── Backup .env ────────────────────────────────────────────────────────────
if [[ -f "${CLAWX_DIR}/.env" ]]; then
  BACKUP_PATH="/tmp/clawx-env-backup-$(date +%Y%m%d%H%M%S).env"
  cp "${CLAWX_DIR}/.env" "$BACKUP_PATH"
  log ".env backed up to ${CYAN}${BACKUP_PATH}${NC}"
fi

# ── Remove files ───────────────────────────────────────────────────────────
if [[ -d "$CLAWX_DIR" ]]; then
  rm -rf "$CLAWX_DIR"
  log "Removed $CLAWX_DIR"
fi

# ── Remove user (only for dedicated 'clawx' user) ────────────────────────
if [[ "$CLAWX_USER" == "clawx" ]] && id "$CLAWX_USER" &>/dev/null; then
  echo ""
  echo -en "  Remove dedicated user '${CLAWX_USER}'? ${DIM}[y/N]${NC}: "
  read -r REMOVE_USER
  REMOVE_USER=$(echo "${REMOVE_USER:-n}" | tr '[:upper:]' '[:lower:]')

  if [[ "$REMOVE_USER" == "y" ]]; then
    userdel "$CLAWX_USER" 2>/dev/null || true
    log "User '$CLAWX_USER' removed"
  else
    warn "User '$CLAWX_USER' kept"
  fi
fi

echo ""
echo -e "${GREEN}${BOLD}✅ ClawX-Web has been uninstalled.${NC}"
if [[ -n "${BACKUP_PATH:-}" ]]; then
  echo -e "  Your .env was backed up to: ${CYAN}${BACKUP_PATH}${NC}"
fi
echo ""
