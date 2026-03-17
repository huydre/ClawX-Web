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
# Auto-detect: use the real user who ran sudo, fallback to creating 'clawx'
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]] && id "$SUDO_USER" &>/dev/null; then
    CLAWX_USER="$SUDO_USER"
else
    CLAWX_USER="clawx"
fi
NODE_MAJOR=22

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

apt-get update -qq 2>/dev/null || true
apt-get install -y -qq curl git ca-certificates gnupg xz-utils >/dev/null 2>&1
log "System packages ready"

# ── Step 2: Node.js (via NVM) ──────────────────────────────────────────────
step "Checking Node.js"

# Determine home directory for NVM
if [[ "$CLAWX_USER" != "root" ]] && id "$CLAWX_USER" &>/dev/null; then
  NVM_HOME=$(eval echo "~$CLAWX_USER")
else
  NVM_HOME="$HOME"
fi

export NVM_DIR="$NVM_HOME/.nvm"

install_nodejs_nvm() {
  info "Installing NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
  \. "$NVM_DIR/nvm.sh"
  info "Installing Node.js 22 via NVM..."
  nvm install 22
  log "Node.js $(node -v) installed via NVM"
}

# Source NVM if it exists
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  \. "$NVM_DIR/nvm.sh"
fi

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VER" -ge "$NODE_MAJOR" ]]; then
    log "Node.js $(node -v) already installed"
  else
    warn "Node.js v${NODE_VER} is too old, upgrading..."
    install_nodejs_nvm
  fi
else
  install_nodejs_nvm
fi

# ── Step 3: pnpm ───────────────────────────────────────────────────────
step "Checking pnpm"

if command -v pnpm &>/dev/null; then
  log "pnpm $(pnpm -v) already installed"
else
  info "Installing pnpm..."
  npm install -g pnpm >/dev/null 2>&1
  log "pnpm $(pnpm -v) installed"
fi

# ── Step 4: OpenClaw ───────────────────────────────────────────────────
step "Checking OpenClaw"

if command -v openclaw &>/dev/null; then
  log "OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'unknown')"
else
  info "Installing OpenClaw..."
  npm i -g openclaw@2026.3.2 >/dev/null 2>&1
  if command -v openclaw &>/dev/null; then
    log "OpenClaw installed: $(openclaw --version 2>/dev/null || echo '2026.3.2')"
  else
    warn "OpenClaw install failed. Install manually: npm i -g openclaw@2026.3.2"
  fi
fi

# ── Step 4b: OpenClaw Gateway ──────────────────────────────────────────
step "Setting up OpenClaw Gateway"

if command -v openclaw &>/dev/null; then
  info "Installing gateway service..."
  openclaw gateway install 2>/dev/null || warn "Gateway install command failed"

  # Enable and start the gateway systemd user service
  if command -v systemctl &>/dev/null; then
    # Try default profile first, then with profile suffix
    if systemctl --user enable --now openclaw-gateway.service 2>/dev/null; then
      log "Gateway service enabled and started"
    else
      warn "Could not enable gateway service via systemctl --user"
      warn "You may need to run: systemctl --user enable --now openclaw-gateway.service"
    fi
  fi

  openclaw gateway status 2>/dev/null && log "Gateway is running" || warn "Gateway status check returned non-zero"
else
  warn "OpenClaw not installed, skipping gateway setup"
fi

# ── Step 5: Clone repository ──────────────────────────────────────────────
step "Setting up ClawX-Web"

# Fix git "dubious ownership" when running as root
git config --global --add safe.directory "$CLAWX_DIR" 2>/dev/null || true

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

# ── Step 6: Setup service user ─────────────────────────────────────────────
step "Setting up service user: $CLAWX_USER"

if [[ "$CLAWX_USER" == "clawx" ]]; then
  # Dedicated service user — create if needed
  if id "$CLAWX_USER" &>/dev/null; then
    log "User '$CLAWX_USER' already exists"
  else
    useradd -r -s /bin/false -d "$CLAWX_DIR" -m "$CLAWX_USER" 2>/dev/null || true
    log "User '$CLAWX_USER' created"
  fi
else
  log "Using existing user '$CLAWX_USER' (detected from SUDO_USER)"
fi

chown -R "$CLAWX_USER":"$CLAWX_USER" "$CLAWX_DIR"

# Allow service user to restart its own service (for auto-update)
SUDOERS_FILE="/etc/sudoers.d/clawx-restart"
echo "$CLAWX_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart clawx" > "$SUDOERS_FILE"
chmod 440 "$SUDOERS_FILE"
log "Sudoers rule added: $CLAWX_USER can restart clawx service"

# Save the owner user for the server to use
echo "$CLAWX_USER" > "$CLAWX_DIR/.clawx-owner"
chown "$CLAWX_USER":"$CLAWX_USER" "$CLAWX_DIR/.clawx-owner"
log "Owner user saved: $CLAWX_USER"

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
