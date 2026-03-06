#!/bin/bash
# ============================================================================
# ClawX-Web Setup Script
# Interactive configuration, build, and systemd service management
# Usage: ./setup.sh [--install|--update|--status|--logs]
# ============================================================================
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

CLAWX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Auto-detect the user who installed OpenClaw
# Priority: 1) owner of openclaw-gateway process, 2) SUDO_USER, 3) current user
detect_clawx_user() {
  # Try to find user running openclaw-gateway
  local gw_user
  gw_user=$(ps -eo user,comm 2>/dev/null | grep -i 'openclaw' | head -1 | awk '{print $1}' || true)
  if [[ -n "$gw_user" && "$gw_user" != "root" ]]; then
    echo "$gw_user"
    return
  fi

  # Try SUDO_USER (the real user who ran sudo)
  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    echo "$SUDO_USER"
    return
  fi

  # Scan /home for .openclaw directory
  for home_dir in /home/*/; do
    if [[ -f "${home_dir}.openclaw/openclaw.json" ]]; then
      basename "$home_dir"
      return
    fi
  done

  # Fallback: current user
  whoami
}

CLAWX_USER="$(detect_clawx_user)"
SERVICE_NAME="clawx"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
ENV_FILE="${CLAWX_DIR}/.env"
DEFAULT_PORT=2003
DEFAULT_GATEWAY_PORT=18789

# ── Helpers ─────────────────────────────────────────────────────────────────
log()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
error()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
info()   { echo -e "${BLUE}[i]${NC} $*"; }
step()   { echo -e "\n${CYAN}${BOLD}── $* ──${NC}"; }

prompt() {
  local var_name="$1"
  local prompt_text="$2"
  local default_val="${3:-}"
  local result

  if [[ -n "$default_val" ]]; then
    echo -en "  ${prompt_text} ${DIM}[${default_val}]${NC}: "
  else
    echo -en "  ${prompt_text}: "
  fi

  read -r result < /dev/tty
  result="${result:-$default_val}"
  eval "$var_name='$result'"
}

prompt_secret() {
  local var_name="$1"
  local prompt_text="$2"
  local default_val="${3:-}"
  local result

  if [[ -n "$default_val" ]]; then
    local masked="${default_val:0:6}..."
    echo -en "  ${prompt_text} ${DIM}[${masked}]${NC}: "
  else
    echo -en "  ${prompt_text} ${DIM}[skip]${NC}: "
  fi

  read -r result < /dev/tty
  result="${result:-$default_val}"
  eval "$var_name='$result'"
}

prompt_yn() {
  local var_name="$1"
  local prompt_text="$2"
  local default_val="${3:-y}"
  local result

  echo -en "  ${prompt_text} ${DIM}[${default_val}]${NC}: "
  read -r result < /dev/tty
  result="${result:-$default_val}"
  result=$(echo "$result" | tr '[:upper:]' '[:lower:]')
  eval "$var_name='$result'"
}

banner() {
  echo -e "${CYAN}"
  echo "  ┌─────────────────────────────────────────┐"
  echo "  │  🦀  ClawX-Web Setup                    │"
  echo "  │  Interactive Configuration & Deploy      │"
  echo "  └─────────────────────────────────────────┘"
  echo -e "${NC}"
}

# ── Load existing .env ─────────────────────────────────────────────────────
load_existing_env() {
  EXISTING_GATEWAY_PORT=""
  EXISTING_CF_TOKEN=""
  EXISTING_CF_DOMAIN=""
  EXISTING_CF_SUBDOMAIN=""
  EXISTING_AUTH_PASSWORD=""

  if [[ -f "$ENV_FILE" ]]; then
    EXISTING_GATEWAY_PORT=$(grep -oP 'OPENCLAW_GATEWAY_PORT=\K.*' "$ENV_FILE" 2>/dev/null || echo "")
    EXISTING_CF_TOKEN=$(grep -oP 'CLOUDFLARE_API_TOKEN=\K.*' "$ENV_FILE" 2>/dev/null || echo "")
    EXISTING_CF_DOMAIN=$(grep -oP 'CLOUDFLARE_TUNNEL_DOMAIN=\K.*' "$ENV_FILE" 2>/dev/null || echo "")
    EXISTING_CF_SUBDOMAIN=$(grep -oP 'CLOUDFLARE_TUNNEL_SUBDOMAIN=\K.*' "$ENV_FILE" 2>/dev/null || echo "")
    EXISTING_AUTH_PASSWORD=$(grep -oP 'CLAWX_AUTH_PASSWORD=\K.*' "$ENV_FILE" 2>/dev/null || echo "")
  fi
}

# ── Commands ───────────────────────────────────────────────────────────────

cmd_status() {
  echo -e "\n${CYAN}${BOLD}ClawX-Web Status${NC}\n"

  # Service status
  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo -e "  Service:  ${GREEN}● running${NC}"
  else
    echo -e "  Service:  ${RED}● stopped${NC}"
  fi

  # Port check
  if ss -tlnp | grep -q ":${DEFAULT_PORT} " 2>/dev/null; then
    echo -e "  Port:     ${GREEN}● :${DEFAULT_PORT} listening${NC}"
  else
    echo -e "  Port:     ${DIM}○ :${DEFAULT_PORT} not listening${NC}"
  fi

  # .env check
  if [[ -f "$ENV_FILE" ]]; then
    echo -e "  Config:   ${GREEN}● .env exists${NC}"
  else
    echo -e "  Config:   ${RED}● .env missing${NC}"
  fi

  # URLs
  if [[ -f "$ENV_FILE" ]]; then
    local domain=$(grep -oP 'CLOUDFLARE_TUNNEL_DOMAIN=\K.*' "$ENV_FILE" 2>/dev/null || echo "")
    local subdomain=$(grep -oP 'CLOUDFLARE_TUNNEL_SUBDOMAIN=\K.*' "$ENV_FILE" 2>/dev/null || echo "")
    if [[ -n "$domain" && -n "$subdomain" ]]; then
      echo -e "\n  ${BOLD}URLs:${NC}"
      echo -e "    Local:     ${CYAN}http://localhost:${DEFAULT_PORT}${NC}"
      echo -e "    Dashboard: ${CYAN}https://${subdomain}.${domain}${NC}"
      echo -e "    Gateway:   ${CYAN}https://dashboard-${subdomain}.${domain}${NC}"
    else
      echo -e "\n  ${BOLD}URL:${NC}  ${CYAN}http://localhost:${DEFAULT_PORT}${NC}"
    fi
  fi

  echo ""
}

cmd_logs() {
  exec journalctl -u "$SERVICE_NAME" -f --no-hostname -o cat
}

cmd_update() {
  step "Updating ClawX-Web"

  cd "$CLAWX_DIR"

  # Pull latest
  info "Pulling latest changes..."
  git fetch origin
  git reset --hard origin/main
  log "Repository updated"

  # Rebuild
  do_build

  # Restart service
  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    info "Restarting service..."
    systemctl restart "$SERVICE_NAME"
    log "Service restarted"
  fi

  echo -e "\n${GREEN}${BOLD}✅ Update complete!${NC}"
  cmd_status
}

# ── Build ──────────────────────────────────────────────────────────────────
do_build() {
  cd "$CLAWX_DIR"

  # Ensure the clawx user owns everything (git reset as root may change ownership)
  if [[ $EUID -eq 0 ]] && id "$CLAWX_USER" &>/dev/null; then
    chown -R "$CLAWX_USER":"$CLAWX_USER" "$CLAWX_DIR"
  fi

  # Check if pre-built dist exists (committed to repo)
  if [[ -d "$CLAWX_DIR/dist" && -d "$CLAWX_DIR/dist-server" ]]; then
    step "Installing production dependencies (pre-built mode)"
    info "Pre-built dist/ and dist-server/ found, skipping build"

    # Only install production deps (much faster, less RAM)
    if [[ $EUID -eq 0 ]] && id "$CLAWX_USER" &>/dev/null; then
      su -s /bin/bash -c "cd '$CLAWX_DIR' && CI=true pnpm install --prod --frozen-lockfile 2>/dev/null || CI=true pnpm install --prod" "$CLAWX_USER"
    else
      CI=true pnpm install --prod --frozen-lockfile 2>/dev/null || CI=true pnpm install --prod
    fi
    log "Production dependencies installed"
  else
    # No pre-built dist, do full build
    step "Installing dependencies"

    if [[ $EUID -eq 0 ]] && id "$CLAWX_USER" &>/dev/null; then
      su -s /bin/bash -c "cd '$CLAWX_DIR' && CI=true pnpm install --frozen-lockfile 2>/dev/null || CI=true pnpm install" "$CLAWX_USER"
    else
      CI=true pnpm install --frozen-lockfile 2>/dev/null || CI=true pnpm install
    fi
    log "Dependencies installed"

    step "Building ClawX-Web"

    if [[ $EUID -eq 0 ]] && id "$CLAWX_USER" &>/dev/null; then
      su -s /bin/bash -c "cd '$CLAWX_DIR' && pnpm build && pnpm build:server" "$CLAWX_USER"
    else
      pnpm build
      pnpm build:server
    fi
    log "Build complete"
  fi
}

# ── Install OpenZalo channel ──────────────────────────────────────────────
install_openzalo() {
  step "Setting up OpenZalo channel"

  local user_home
  user_home=$(eval echo "~${CLAWX_USER}")
  local npm_bin=""

  # Find npm/npx binary
  if command -v npm &>/dev/null; then
    npm_bin=$(which npm)
  elif [[ -f "${user_home}/.nvm/versions/node/$(ls ${user_home}/.nvm/versions/node/ 2>/dev/null | tail -1)/bin/npm" ]]; then
    npm_bin="${user_home}/.nvm/versions/node/$(ls ${user_home}/.nvm/versions/node/ | tail -1)/bin/npm"
  fi

  if [[ -z "$npm_bin" ]]; then
    warn "npm not found, skipping OpenZalo installation"
    return
  fi

  local npm_dir
  npm_dir=$(dirname "$npm_bin")

  # 1. Install openzca CLI
  if command -v openzca &>/dev/null || [[ -f "${npm_dir}/openzca" ]]; then
    info "openzca CLI already installed"
  else
    info "Installing openzca CLI..."
    if [[ $EUID -eq 0 ]] && id "$CLAWX_USER" &>/dev/null; then
      su -s /bin/bash -c "export PATH='${npm_dir}:\$PATH' && npm install -g openzca" "$CLAWX_USER" 2>/dev/null || \
        warn "Failed to install openzca (non-critical)"
    else
      "$npm_bin" install -g openzca 2>/dev/null || warn "Failed to install openzca (non-critical)"
    fi
  fi

  # 2. Install @openclaw/openzalo plugin
  local openclaw_bin=""
  if command -v openclaw &>/dev/null; then
    openclaw_bin=$(which openclaw)
  elif [[ -f "${npm_dir}/openclaw" ]]; then
    openclaw_bin="${npm_dir}/openclaw"
  fi

  if [[ -z "$openclaw_bin" ]]; then
    warn "openclaw CLI not found, skipping OpenZalo plugin install"
    return
  fi

  # Check if plugin already installed
  local plugin_installed=false
  if [[ $EUID -eq 0 ]] && id "$CLAWX_USER" &>/dev/null; then
    if su -s /bin/bash -c "export PATH='${npm_dir}:\$PATH' && openclaw plugins list 2>/dev/null | grep -q openzalo" "$CLAWX_USER" 2>/dev/null; then
      plugin_installed=true
    fi
  else
    if "$openclaw_bin" plugins list 2>/dev/null | grep -q openzalo; then
      plugin_installed=true
    fi
  fi

  if [[ "$plugin_installed" == "true" ]]; then
    info "OpenZalo plugin already installed"
  else
    info "Installing OpenZalo plugin from GitHub..."
    local tmp_dir="/tmp/openzalo-$$"
    git clone --depth 1 https://github.com/darkamenosa/openzalo "$tmp_dir" 2>/dev/null

    if [[ -d "$tmp_dir" ]]; then
      if [[ $EUID -eq 0 ]] && id "$CLAWX_USER" &>/dev/null; then
        chown -R "$CLAWX_USER":"$CLAWX_USER" "$tmp_dir"
        su -s /bin/bash -c "export PATH='${npm_dir}:\$PATH' && openclaw plugins install '$tmp_dir'" "$CLAWX_USER" 2>/dev/null || \
          warn "Failed to install OpenZalo plugin (non-critical)"
      else
        "$openclaw_bin" plugins install "$tmp_dir" 2>/dev/null || warn "Failed to install OpenZalo plugin (non-critical)"
      fi
      rm -rf "$tmp_dir"
    else
      warn "Failed to clone OpenZalo repo (non-critical)"
    fi
  fi

  log "OpenZalo channel setup complete"
}

# ── Setup systemd ──────────────────────────────────────────────────────────
setup_systemd() {
  step "Setting up systemd service"

  local node_path
  node_path=$(which node)

  local user_home
  user_home=$(eval echo "~${CLAWX_USER}")

  # Build a comprehensive PATH for exec tool support
  local exec_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  # Add user-level paths if they exist
  [[ -d "${user_home}/.local/bin" ]] && exec_path="${user_home}/.local/bin:${exec_path}"
  [[ -d "${user_home}/.nvm/versions" ]] && {
    local nvm_node_dir
    nvm_node_dir=$(ls -d "${user_home}/.nvm/versions/node/"* 2>/dev/null | tail -1)
    [[ -n "$nvm_node_dir" ]] && exec_path="${nvm_node_dir}/bin:${exec_path}"
  }
  # Add node binary directory
  local node_dir
  node_dir=$(dirname "$node_path")
  exec_path="${node_dir}:${exec_path}"

  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=ClawX-Web Dashboard
Documentation=https://github.com/huydre/ClawX-Web
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${CLAWX_USER}
Group=${CLAWX_USER}
WorkingDirectory=${CLAWX_DIR}
ExecStart=${node_path} dist-server/index.js
Restart=on-failure
RestartSec=5
StartLimitInterval=60
StartLimitBurst=3

# Environment
Environment=NODE_ENV=production
Environment=HOME=${user_home}
Environment=PATH=${exec_path}
EnvironmentFile=${ENV_FILE}

# Security (relaxed for OpenClaw exec tool support)
NoNewPrivileges=false
ReadWritePaths=${CLAWX_DIR}
ReadWritePaths=${user_home}
ReadWritePaths=/tmp

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=clawx

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
  log "Systemd service configured and enabled"
}

# ── Configure OpenClaw settings ───────────────────────────────────────────
configure_openclaw() {
  step "Configuring OpenClaw"

  local user_home
  user_home=$(eval echo "~${CLAWX_USER}")
  local config_file="${user_home}/.openclaw/openclaw.json"

  if [[ ! -f "$config_file" ]]; then
    warn "OpenClaw config not found at $config_file, skipping"
    warn "After installing OpenClaw, configure from the web dashboard Settings"
    return
  fi

  # Read tunnel domain from .env if available
  local tunnel_origins=""
  if [[ -f "$ENV_FILE" ]]; then
    local t_domain t_sub
    t_domain=$(grep '^CLOUDFLARE_TUNNEL_DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2-)
    t_sub=$(grep '^CLOUDFLARE_TUNNEL_SUBDOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2-)
    if [[ -n "$t_domain" && -n "$t_sub" ]]; then
      tunnel_origins="https://${t_sub}.${t_domain},https://dashboard-${t_sub}.${t_domain}"
    fi
  fi

  python3 -c "
import json

config_path = '${config_file}'
tunnel_origins = '${tunnel_origins}'

try:
    with open(config_path, 'r') as f:
        config = json.load(f)
except:
    config = {}

# 1. Gateway mode
config.setdefault('gateway', {})
config['gateway']['mode'] = 'local'

# 2. Control UI allowed origins
if tunnel_origins:
    config['gateway'].setdefault('controlUi', {})
    origins = [o.strip() for o in tunnel_origins.split(',') if o.strip()]
    existing = config['gateway']['controlUi'].get('allowedOrigins', [])
    if isinstance(existing, list):
        for o in origins:
            if o not in existing:
                existing.append(o)
        config['gateway']['controlUi']['allowedOrigins'] = existing
    else:
        config['gateway']['controlUi']['allowedOrigins'] = origins

# 3. Tools profile + exec settings
config.setdefault('tools', {})
config['tools']['profile'] = 'full'
config['tools'].setdefault('exec', {})
config['tools']['exec']['host'] = 'gateway'
config['tools']['exec']['security'] = 'full'

# 4. Remove exec/process from tools.deny if present
if 'deny' in config['tools'] and isinstance(config['tools']['deny'], list):
    config['tools']['deny'] = [t for t in config['tools']['deny'] if t not in ('exec', 'process')]
    if not config['tools']['deny']:
        del config['tools']['deny']

with open(config_path, 'w') as f:
    json.dump(config, f, indent=2)
print('OK')
" 2>/dev/null

  if [[ $? -eq 0 ]]; then
    if [[ $EUID -eq 0 ]] && id "$CLAWX_USER" &>/dev/null; then
      chown "$CLAWX_USER":"$CLAWX_USER" "$config_file"
    fi
    log "OpenClaw configured: gateway.mode=local, exec=full"
    [[ -n "$tunnel_origins" ]] && log "Allowed origins: $tunnel_origins"
  else
    warn "Failed to configure OpenClaw automatically"
    warn "Configure from web dashboard: Settings"
  fi
}

# ── Generate .env ──────────────────────────────────────────────────────────
generate_env() {
  cat > "$ENV_FILE" <<EOF
# ClawX-Web Environment Configuration
# Generated by setup.sh on $(date -Iseconds)

# Dashboard Authentication
CLAWX_AUTH_PASSWORD=${CFG_AUTH_PASSWORD}

# OpenClaw Gateway Configuration
OPENCLAW_GATEWAY_PORT=${CFG_GATEWAY_PORT}

# Cloudflare Tunnel Configuration
CLOUDFLARE_API_TOKEN=${CFG_CF_TOKEN}
CLOUDFLARE_TUNNEL_DOMAIN=${CFG_CF_DOMAIN}
CLOUDFLARE_TUNNEL_SUBDOMAIN=${CFG_CF_SUBDOMAIN}
EOF

  # Set ownership
  if [[ $EUID -eq 0 ]] && id "$CLAWX_USER" &>/dev/null; then
    chown "$CLAWX_USER":"$CLAWX_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  fi

  log ".env file created"
}

# ── Interactive Setup ──────────────────────────────────────────────────────
cmd_install() {
  banner
  load_existing_env

  echo -e "  ${BOLD}Configure your ClawX-Web installation:${NC}\n"

  # Gateway port
  prompt CFG_GATEWAY_PORT \
    "OpenClaw Gateway port" \
    "${EXISTING_GATEWAY_PORT:-$DEFAULT_GATEWAY_PORT}"

  # Cloudflare Tunnel (optional)
  echo ""
  echo -e "  ${DIM}─── Cloudflare Tunnel (optional, for remote access) ───${NC}"

  prompt_secret CFG_CF_TOKEN \
    "Cloudflare API Token" \
    "${EXISTING_CF_TOKEN}"

  if [[ -n "$CFG_CF_TOKEN" ]]; then
    prompt CFG_CF_DOMAIN \
      "Tunnel domain (e.g. veoforge.ggff.net)" \
      "${EXISTING_CF_DOMAIN}"

    prompt CFG_CF_SUBDOMAIN \
      "Tunnel subdomain (e.g. clawbox02)" \
      "${EXISTING_CF_SUBDOMAIN}"
  else
    CFG_CF_DOMAIN=""
    CFG_CF_SUBDOMAIN=""
  fi

  # Dashboard password
  echo ""
  echo -e "  ${DIM}─── Dashboard Authentication ───${NC}"
  local default_password="${EXISTING_AUTH_PASSWORD}"
  if [[ -z "$default_password" ]]; then
    # Auto-generate a random 8-char password for new installs
    default_password=$(openssl rand -base64 6 | tr -d '/+=' | head -c 8)
  fi
  prompt CFG_AUTH_PASSWORD \
    "Dashboard password" \
    "${default_password}"

  # Summary
  echo ""
  echo -e "  ${BOLD}Configuration Summary:${NC}"
  echo -e "    Dashboard Password: ${CYAN}${CFG_AUTH_PASSWORD}${NC}"
  echo -e "    Gateway Port:   ${CYAN}${CFG_GATEWAY_PORT}${NC}"
  if [[ -n "$CFG_CF_TOKEN" ]]; then
    echo -e "    Tunnel Domain:  ${CYAN}${CFG_CF_SUBDOMAIN}.${CFG_CF_DOMAIN}${NC}"
    echo -e "    Dashboard URL:  ${CYAN}https://dashboard-${CFG_CF_SUBDOMAIN}.${CFG_CF_DOMAIN}${NC}"
  else
    echo -e "    Tunnel:         ${DIM}disabled${NC}"
  fi
  echo ""

  prompt_yn CONFIRM "Proceed with installation?" "y"
  if [[ "$CONFIRM" != "y" ]]; then
    warn "Installation cancelled."
    exit 0
  fi

  # Generate .env
  generate_env

  # Build
  do_build

  # Install OpenZalo channel
  install_openzalo

  # Configure OpenClaw (gateway mode, exec, allowed origins)
  configure_openclaw

  # Setup systemd (only if root)
  if [[ $EUID -eq 0 ]]; then
    setup_systemd

    # Start service
    step "Starting ClawX-Web"
    systemctl start "$SERVICE_NAME"

    # Wait for startup
    sleep 3

    if systemctl is-active --quiet "$SERVICE_NAME"; then
      log "ClawX-Web is running!"
    else
      warn "Service may have failed to start. Check logs:"
      warn "  journalctl -u clawx -n 20"
    fi
  else
    warn "Not running as root — skipping systemd setup."
    warn "Start manually: cd $CLAWX_DIR && node dist-server/index.js"
  fi

  # Show status
  echo ""
  cmd_status
}

# ── Main ───────────────────────────────────────────────────────────────────
main() {
  local cmd="${1:-}"

  case "$cmd" in
    --install|-i)
      cmd_install
      ;;
    --update|-u)
      cmd_update
      ;;
    --status|-s)
      cmd_status
      ;;
    --logs|-l)
      cmd_logs
      ;;
    --help|-h)
      echo ""
      echo -e "  ${BOLD}ClawX-Web Setup${NC}"
      echo ""
      echo -e "  ${BOLD}Usage:${NC} ./setup.sh [command]"
      echo ""
      echo -e "  ${BOLD}Commands:${NC}"
      echo -e "    ${CYAN}--install, -i${NC}   Interactive setup (first time or reconfigure)"
      echo -e "    ${CYAN}--update, -u${NC}    Pull latest code and rebuild"
      echo -e "    ${CYAN}--status, -s${NC}    Show service status and URLs"
      echo -e "    ${CYAN}--logs, -l${NC}      Follow service logs (journalctl)"
      echo -e "    ${CYAN}--help, -h${NC}      Show this help"
      echo ""
      echo -e "  ${DIM}No arguments = interactive setup${NC}"
      echo ""
      ;;
    "")
      cmd_install
      ;;
    *)
      error "Unknown command: $cmd. Use --help for usage."
      ;;
  esac
}

main "$@"
