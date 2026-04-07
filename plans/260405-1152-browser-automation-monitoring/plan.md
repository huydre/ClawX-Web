---
name: Browser Automation Monitoring System
slug: browser-automation-monitoring
created: 2026-04-05
status: pending
branch: feature/browser
blockedBy: []
blocks: []
---

# Browser Automation Monitoring System

> Virtual browser tab in ClawX-Web: agent controls Chromium via CDP, user watches + intervenes via noVNC iframe. Target: LIVA Q3 Plus (3.3GB RAM).

**SRS Reference:** `/Users/hnam/Downloads/SRS_Browser_Automation_Monitoring_System.md` (v1.1)

## Overview

| Phase | Name | Priority | Status | Est. LOC |
|-------|------|----------|--------|----------|
| 1 | [System Setup & Dependencies](phase-01-system-setup.md) | CRITICAL | Pending | ~150 (shell) |
| 2 | [Backend Browser Manager Service](phase-02-browser-manager.md) | CRITICAL | Pending | ~180 |
| 3 | [Backend Routes & CDP Proxy](phase-03-api-routes.md) | HIGH | Pending | ~120 |
| 4 | [Frontend Browser Tab UI](phase-04-frontend-ui.md) | HIGH | Pending | ~200 |
| 5 | [Turn-Based Control & Activity Indicator](phase-05-control-lock.md) | MEDIUM | Pending | ~100 |
| 6 | [Testing & LIVA Deployment Validation](phase-06-testing.md) | HIGH | Pending | ~80 |

**Total estimate:** ~830 LOC TypeScript/TSX + ~150 LOC shell/supervisord config.

## Architecture

```
Browser UI tab (React) 
  ├── iframe → http://<server>:6080/vnc.html (noVNC stream)
  └── Control panel → /api/browser/* (start/stop/status/snapshot)
          │
          ▼
Express /api/browser routes
          │
          ▼
BrowserManager service (server/services/browser-manager.ts)
  ├── supervisorctl start/stop browser-stack:*
  ├── CDP client (port 9222, localhost) → forward commands
  ├── Turn-lock state (3s idle threshold)
  └── Health polling
          │
          ▼
supervisord (on LIVA Q3 Plus)
  ├── Xvfb :99 (1280x720 @ 16-bit)
  ├── Chromium --remote-debugging-port=9222 (cgroup 1.8GB limit)
  ├── x11vnc :5900 (10 FPS cap)
  └── websockify → noVNC :6080
```

## Key Decisions

| Decision | Reason |
|---|---|
| **No Docker** | LIVA RAM too tight, bare-metal supervisord simpler |
| **On-demand start/stop** | Free RAM when tab not open (saves ~1.5GB idle) |
| **CDP client in Node (chrome-remote-interface)** | Mature library, no dependency on experimental agent-browser CLI |
| **noVNC via iframe (not custom WebSocket)** | Zero reinvention, noVNC handles reconnect/auth |
| **Single session only** | Hardware limit, enforced via 409 response |

## Files Affected

**New files:**
- `server/services/browser-manager.ts` — supervisorctl wrapper + CDP client + lock state
- `server/routes/browser.ts` — REST endpoints
- `src/stores/browser.ts` — Zustand store
- `src/pages/Browser/index.tsx` — Main page with iframe + control panel
- `src/pages/Browser/BrowserControls.tsx` — Take/Release control button + status
- `src/i18n/locales/{en,ja,vi}/browser.json` — Translations
- `setup-browser-stack.sh` — LIVA install script (apt install + supervisord config + swap + sudoers)
- `/etc/supervisor/conf.d/browser-agent.conf` — on LIVA

**Modified files:**
- `server/app.ts` — Mount /api/browser routes
- `src/App.tsx` — Add /browser route
- `src/components/layout/Sidebar.tsx` — Add Browser nav item
- `src/components/layout/BottomNav.tsx` — Add Browser icon
- `src/i18n/index.ts` — Register browser namespace
- `package.json` — Add `chrome-remote-interface` dependency

## Key Dependencies

- `chrome-remote-interface` (npm) — CDP client in Node.js
- `xvfb`, `x11vnc`, `novnc`, `websockify`, `chromium-browser`, `supervisor` (apt on LIVA)

## Risks

- **RAM pressure**: Active browser stack ~2GB; ClawX-Web services ~500MB; LIVA has 3.3GB → tight. Mitigation: enforce on-demand + 4GB swap.
- **CDP connection drops on Chromium restart**: BrowserManager must reconnect with retry.
- **noVNC iframe CORS**: Need proper `frame-src` CSP or serve noVNC via same-origin proxy.

## Success Criteria

- User opens Browser tab → stack starts → sees Chromium within 5s.
- Agent can send CDP commands (navigate, click, fill) via REST API.
- User can click/type in noVNC iframe.
- Close tab → stack stops → RAM freed.
- No OOM under normal browsing (Google, KiotViet).
