#!/bin/bash
# ============================================================================
# ClawX-Web Installer
# One-line install: curl -fsSL https://raw.githubusercontent.com/huydre/ClawX-Web/main/install.sh | sudo bash
# ============================================================================
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

CLAWX_DIR="/opt/clawx-web"
CLAWX_REPO="https://github.com/huydre/ClawX-Web.git"
CLAWX_USER="clawx"
NODE_MAJOR=20

# ── Helpers ─────────────────────────────────────────────────────────────────
log()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $*"; }
step()  { echo -e "\n${CYAN}${BOLD}── $* ──${NC}"; }

banner() {
  echo -e "${CYAN}"
  echo "  ┌─────────────────────────────────────────┐"
  echo "  │  🦀  ClawX-Web Installer v0.1.15        │"
  echo "  │  Deploy OpenClaw Dashboard on Linux      │"
  echo "  └─────────────────────────────────────────┘"
  echo -e "${NC}"
}

# ── Pre-flight ──────────────────────────────────────────────────────────────
banner

# Must be root
if [[ $EUID -ne 0 ]]; then
  error "Please run as root: ${BOLD}curl -fsSL ... | sudo bash${NC}"
fi

# Detect OS
if [[ ! -f /etc/os-release ]]; then
  error "Cannot detect OS. Only Ubuntu/Debian are supported."
fi
. /etc/os-release

if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
  error "Unsupported OS: $ID. Only Ubuntu and Debian are supported."
fi

ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
info "Detected: ${BOLD}${PRETTY_NAME}${NC} (${ARCH})"

# ── Step 1: System packages ────────────────────────────────────────────────
step "Installing system dependencies"

apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg >/dev/null 2>&1
log "System packages ready"

# ── Step 2: Node.js ────────────────────────────────────────────────────────
step "Checking Node.js"

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VER" -ge "$NODE_MAJOR" ]]; then
    log "Node.js $(node -v) already installed"
  else
    warn "Node.js v${NODE_VER} is too old, installing v${NODE_MAJOR}..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs >/dev/null 2>&1
    log "Node.js $(node -v) installed"
  fi
else
  info "Installing Node.js ${NODE_MAJOR}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
  log "Node.js $(node -v) installed"
fi

# ── Step 3: pnpm ───────────────────────────────────────────────────────────
step "Checking pnpm"

if command -v pnpm &>/dev/null; then
  log "pnpm $(pnpm -v) already installed"
else
  info "Installing pnpm..."
  npm install -g pnpm >/dev/null 2>&1
  log "pnpm $(pnpm -v) installed"
fi

# ── Step 4: OpenClaw ───────────────────────────────────────────────────────
step "Checking OpenClaw"

if command -v openclaw &>/dev/null; then
  log "OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'unknown')"
else
  info "Installing OpenClaw..."
  if curl -fsSL https://get.openclaw.ai | bash 2>/dev/null; then
    log "OpenClaw installed"
  else
    warn "OpenClaw auto-install failed. You can install manually later:"
    warn "  curl -fsSL https://get.openclaw.ai | bash"
  fi
fi

# ── Step 5: Clone repository ──────────────────────────────────────────────
step "Setting up ClawX-Web"

if [[ -d "$CLAWX_DIR/.git" ]]; then
  info "Existing installation found, updating..."
  cd "$CLAWX_DIR"
  git fetch origin
  git reset --hard origin/main
  log "Repository updated"
else
  if [[ -d "$CLAWX_DIR" ]]; then
    warn "Directory $CLAWX_DIR exists but is not a git repo. Backing up..."
    mv "$CLAWX_DIR" "${CLAWX_DIR}.bak.$(date +%Y%m%d%H%M%S)"
  fi
  info "Cloning repository..."
  git clone --depth 1 "$CLAWX_REPO" "$CLAWX_DIR"
  log "Repository cloned to $CLAWX_DIR"
fi

# ── Step 6: Create service user ────────────────────────────────────────────
step "Creating service user"

if id "$CLAWX_USER" &>/dev/null; then
  log "User '$CLAWX_USER' already exists"
else
  useradd -r -s /bin/false -d "$CLAWX_DIR" -m "$CLAWX_USER" 2>/dev/null || true
  log "User '$CLAWX_USER' created"
fi

chown -R "$CLAWX_USER":"$CLAWX_USER" "$CLAWX_DIR"

# Allow clawx user to restart its own service (for auto-update)
SUDOERS_FILE="/etc/sudoers.d/clawx-restart"
echo "$CLAWX_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart clawx" > "$SUDOERS_FILE"
chmod 440 "$SUDOERS_FILE"
log "Sudoers rule added: $CLAWX_USER can restart clawx service"

# ── Step 7: Run setup ─────────────────────────────────────────────────────
step "Running setup"

cd "$CLAWX_DIR"
chmod +x setup.sh
bash setup.sh --install

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  🎉 ClawX-Web installation complete!       ${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Manage:${NC}"
echo -e "    Status:      ${CYAN}sudo systemctl status clawx${NC}"
echo -e "    Logs:        ${CYAN}sudo journalctl -u clawx -f${NC}"
echo -e "    Reconfigure: ${CYAN}cd $CLAWX_DIR && sudo ./setup.sh${NC}"
echo -e "    Update:      ${CYAN}cd $CLAWX_DIR && sudo ./setup.sh --update${NC}"
echo -e "    Uninstall:   ${CYAN}cd $CLAWX_DIR && sudo ./uninstall.sh${NC}"
echo ""
