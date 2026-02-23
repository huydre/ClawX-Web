# ClawX Electron → Web Migration Plan

**Created**: 2026-02-23
**Status**: Ready for Implementation
**Priority**: High
**Timeline**: 11 days (7 phases)

## Executive Summary

Migrate ClawX from Electron desktop app to Node.js web application for Armbian (RK3399, 4GB RAM, ARM64). Single-user LAN-only access on port 2003. Gateway already installed on port 18789.

## Target Environment

- **Device**: Armbian (RK3399, 4GB RAM, ARM64)
- **User**: Single user, LAN-only
- **Ports**: 2003 (web), 18789 (gateway)
- **Install**: ~/.openclaw
- **Data**: Fresh start (no migration)
- **Gateway**: Already working

## Current State

- Electron desktop app with 130+ IPC channels
- 3,062 lines Electron code (25 files)
- 7 Zustand stores using window.electron.ipcRenderer
- 2 electron-store instances
- File staging via ~/.openclaw/media/outbound/

## Target Architecture

```
Browser → Express REST API (port 2003) → Gateway (port 18789)
         ↓
         WebSocket Server (real-time events)
```

## Phases

### Phase 1: Project Setup & Dependencies
**Status**: Not Started | **Effort**: 1 day
**File**: [phase-01-project-setup.md](./phase-01-project-setup.md)

Create backend structure, install dependencies, remove Electron packages.

---

### Phase 2: Backend Server Implementation
**Status**: Not Started | **Effort**: 3 days
**File**: [phase-02-backend-server.md](./phase-02-backend-server.md)

Implement Express REST API, WebSocket server, gateway routes.

---

### Phase 3: Frontend API Client Migration
**Status**: Not Started | **Effort**: 2 days
**File**: [phase-03-frontend-migration.md](./phase-03-frontend-migration.md)

Replace window.electron.ipcRenderer with fetch() + WebSocket.

---

### Phase 4: Storage Layer Migration
**Status**: Not Started | **Effort**: 1 day
**File**: [phase-04-storage-migration.md](./phase-04-storage-migration.md)

Replace electron-store with lowdb (JSON file storage).

---

### Phase 5: File Upload/Download
**Status**: Not Started | **Effort**: 1 day
**File**: [phase-05-file-handling.md](./phase-05-file-handling.md)

Implement multer file upload, replace dialog.showOpenDialog.

---

### Phase 6: Systemd Auto-start
**Status**: Not Started | **Effort**: 1 day
**File**: [phase-06-systemd-autostart.md](./phase-06-systemd-autostart.md)

Create systemd service for auto-start on boot.

---

### Phase 7: Testing & Deployment
**Status**: Not Started | **Effort**: 2 days
**File**: [phase-07-testing-deployment.md](./phase-07-testing-deployment.md)

Test all features, deploy to Armbian, verify auto-start.

---

## Key Changes

### Remove
- electron/ directory (25 files)
- electron-store, electron-builder dependencies
- vite-plugin-electron
- IPC handlers (1,652 lines)

### Add
- server/ directory (Express backend)
- lowdb (JSON storage)
- multer (file upload)
- WebSocket server

### Modify
- 7 Zustand stores (use fetch/WebSocket)
- vite.config.ts (remove Electron plugins)
- package.json (update scripts)

## Success Metrics

- [ ] Web app accessible on http://localhost:2003
- [ ] All 130+ IPC channels working via REST/WebSocket
- [ ] Gateway communication functional
- [ ] File upload/download working
- [ ] Auto-start on boot
- [ ] Memory usage < 300MB
- [ ] Response time < 100ms (LAN)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gateway connection loss | High | Auto-reconnect with backoff |
| File upload size limits | Medium | Configure multer limits (50MB) |
| ARM compatibility | Low | Node.js has official ARM64 builds |
| Memory constraints | Low | RK3399 4GB is sufficient |

## Next Steps

1. Review plan with team
2. Start Phase 1 (Project Setup)
3. Implement phases sequentially
4. Test on Armbian device
5. Deploy and verify

## Related Documents

- [Research: Node.js Web Migration](../../RESEARCH_IPC_TO_REST_WEBSOCKET.md)
- [Research: API Migration Patterns](../../IMPLEMENTATION_GUIDE_REST_WEBSOCKET.md)
- [Scout Report: Build Config](./reports/scout-build-config.md)
- [Scout Report: IPC Handlers](./reports/scout-ipc-handlers.md)
- [Scout Report: Frontend Stores](./reports/scout-frontend-stores.md)
