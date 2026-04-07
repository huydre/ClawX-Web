---
name: Browser Automation Monitoring System
slug: browser-automation-monitoring
created: 2026-04-05
updated: 2026-04-07
status: pending
branch: feature/browser
blockedBy: []
blocks: []
---

# Browser Automation Monitoring System (v2)

> Virtual browser tab in ClawX-Web: agent controls Chrome via **agent-browser CLI** (Vercel Labs),
> user watches + intervenes via **noVNC iframe**. Target: LIVA Q3 Plus (3.3GB RAM).

**SRS Reference:** `/Users/hnam/Downloads/SRS_Browser_Automation_Monitoring_System.md` (v1.1)

## v2 Changes (2026-04-07)

Replaced `chrome-remote-interface` (npm CDP client) with **`agent-browser`** CLI:
- Rust native CLI, faster than Node.js CDP client
- Built-in snapshot with `@ref` element IDs for AI agent use
- Session persistence (`--session-name`, `--profile`)
- Observability dashboard (port 4848) — live viewport + activity feed
- `--headed` mode to show browser window on Xvfb display
- `agent-browser connect <port>` to attach to existing Chrome

## Overview

| Phase | Name | Priority | Status | Est. LOC |
|-------|------|----------|--------|----------|
| 1 | [System Setup & Dependencies](phase-01-system-setup.md) | CRITICAL | Pending | ~150 (shell) |
| 2 | [Backend Browser Manager Service](phase-02-browser-manager.md) | CRITICAL | Pending | ~180 |
| 3 | [Backend Routes](phase-03-api-routes.md) | HIGH | Pending | ~120 |
| 4 | [Frontend Browser Tab UI](phase-04-frontend-ui.md) | HIGH | Pending | ~200 |
| 5 | [Turn-Based Control & Activity Indicator](phase-05-control-lock.md) | MEDIUM | Pending | ~100 |
| 6 | [Testing & LIVA Deployment Validation](phase-06-testing.md) | HIGH | Pending | ~80 |

**Total estimate:** ~830 LOC TypeScript/TSX + ~150 LOC shell/supervisord config.

## Architecture

```
Browser UI tab (React)
  ├── noVNC iframe → http://<server>:6080/vnc.html (view + interact)
  ├── Dashboard iframe → http://<server>:4848 (activity feed, optional)
  └── Control panel → /api/browser/* (start/stop/navigate/snapshot)
          │
          ▼
Express /api/browser routes
          │
          ▼
BrowserManager service (server/services/browser-manager.ts)
  ├── supervisorctl start/stop browser-stack:*
  ├── agent-browser CLI wrapper (navigate, click, fill, snapshot)
  ├── Turn-lock state (3s idle threshold)
  └── Health polling
          │
          ▼
supervisord (on LIVA Q3 Plus)
  ├── Xvfb :99 (1280x720 @ 16-bit)
  ├── Chrome --headed --remote-debugging-port=9222 (DISPLAY=:99)
  ├── x11vnc :5900 → noVNC :6080 (human view + interaction)
  └── agent-browser dashboard :4848 (optional monitoring)
```

### Two Layers (CDP + X11)

| Layer | Purpose | Tech | Human can interact? |
|---|---|---|---|
| **CDP (agent)** | AI agent controls browser | agent-browser CLI → CDP :9222 | No (programmatic) |
| **X11 (human)** | User views + clicks/types | Xvfb → x11vnc → noVNC iframe | Yes (full interaction) |

Both layers operate on same Chrome instance without conflict.
When agent sends `agent-browser click @e2`, visual result appears in noVNC.
When human clicks in noVNC, agent detects change via `agent-browser snapshot`.

## Key Decisions

| Decision | Reason |
|---|---|
| **agent-browser CLI** (not chrome-remote-interface) | Rust native, snapshot refs, session persistence, dashboard built-in |
| **noVNC for human interaction** | Only way to inject X11 input events (click/type) into headless Chrome |
| **agent-browser dashboard (optional)** | Activity feed + console log, bonus monitoring |
| **On-demand start/stop** | Free RAM when tab not open (saves ~1.5GB idle) |
| **No Docker** | LIVA RAM too tight, bare-metal supervisord simpler |
| **Single session only** | Hardware limit, enforced via 409 response |

## Dependencies

| Package | Where | Purpose |
|---|---|---|
| `agent-browser` | npm global on LIVA | CLI for AI agent browser control |
| `xvfb`, `x11vnc`, `novnc`, `websockify` | apt on LIVA | Display + VNC stack for human interaction |
| `chromium-browser` or `google-chrome` | apt/deb on LIVA | Browser engine |
| `supervisor` | apt on LIVA | Process manager |

**No new npm dependencies in ClawX-Web project** — agent-browser is called via `execFile`.

## Files

**New files:**
- `server/services/browser-manager.ts` — supervisorctl wrapper + agent-browser CLI executor + lock state
- `server/routes/browser.ts` — REST endpoints
- `src/stores/browser.ts` — Zustand store
- `src/pages/Browser/index.tsx` — Main page with noVNC iframe + controls
- `src/pages/Browser/BrowserControls.tsx` — Take/Release control + status
- `src/i18n/locales/{en,ja,vi}/browser.json` — Translations
- `setup-browser-stack.sh` — LIVA install script

**Modified files:**
- `server/app.ts` — Mount /api/browser routes
- `src/App.tsx` — Add /browser route
- `src/components/layout/Sidebar.tsx` — Add Browser nav item
- `src/components/layout/BottomNav.tsx` — Add Browser icon
- `src/i18n/index.ts` — Register browser namespace

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| RAM pressure on LIVA (3.3GB) | CRITICAL | On-demand start/stop, 4GB swap, Chrome memory limit |
| agent-browser experimental | HIGH | CLI wrapper abstraction, can swap to direct CDP later |
| noVNC iframe CORS | MEDIUM | Same host, different port — iframe works, input detection via mouseenter |
| Chromium snap issue (Ubuntu 22.04) | HIGH | Use google-chrome-stable deb instead |

## Success Criteria

- User opens Browser tab → stack starts → sees Chrome via noVNC within 10s
- Agent can send commands via REST API (navigate, click, fill, snapshot)
- User can click/type in noVNC iframe (login, CAPTCHA, 2FA)
- Close tab → stack stops → RAM freed
- No OOM under normal browsing
