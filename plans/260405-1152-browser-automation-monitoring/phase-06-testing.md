# Phase 6: Testing & LIVA Deployment Validation (v2)

**Priority:** HIGH | **Status:** Pending | **Depends on:** Phase 5

## Overview

Deploy to LIVA Q3 Plus (192.168.1.194), validate against SRS acceptance criteria (AC-01 to AC-08), measure resource usage.

## Test Environment

- **Server:** LIVA Q3 Plus, Ubuntu 22.04, IP 192.168.1.194
- **Client:** Laptop via LAN
- **Tools:** `htop`, `free -h`, `curl`, browser DevTools

## Test Cases

### TC-01: Clean Install
```bash
# On LIVA, fresh branch checkout
./setup-browser-stack.sh
# Expect: exit 0, no errors, swap active, supervisord reloaded
free -h   # check 4GB swap
```

### TC-02: Manual Stack Start
```bash
sudo supervisorctl start browser-stack:*
sleep 8
curl -s http://localhost:9222/json/version | jq .
# Expect: Chromium CDP JSON response
```

### TC-03: REST API — start/stop
```bash
curl -X POST http://localhost:2003/api/browser/start
# Expect: state.status = 'starting' → 'running' within 15s
curl http://localhost:2003/api/browser/status
curl -X POST http://localhost:2003/api/browser/stop
# Expect: state.status = 'stopped'
```

### TC-04: Navigate + Snapshot + Screenshot
```bash
curl -X POST http://localhost:2003/api/browser/start
curl -X POST http://localhost:2003/api/browser/navigate \
  -H 'Content-Type: application/json' -d '{"url":"https://google.com"}'

# Test snapshot (agent-browser CLI)
curl -s http://localhost:2003/api/browser/snapshot | jq '.snapshot' | head -30
# Expect: JSON accessibility tree with @ref elements (@e1, @e2, ...)

# Test click by ref
curl -X POST http://localhost:2003/api/browser/click \
  -H 'Content-Type: application/json' -d '{"selector":"@e2"}'

# Test fill by ref
curl -X POST http://localhost:2003/api/browser/fill \
  -H 'Content-Type: application/json' -d '{"selector":"@e3","value":"test search"}'

# Test press key
curl -X POST http://localhost:2003/api/browser/press \
  -H 'Content-Type: application/json' -d '{"key":"Enter"}'

# Test screenshot
curl -s http://localhost:2003/api/browser/screenshot | jq -r .image > /tmp/shot.txt
# Expect: base64 PNG or file path
```

### TC-04b: agent-browser CLI direct
```bash
# Verify CLI works directly with Chrome CDP
agent-browser --cdp 9222 get url
agent-browser --cdp 9222 get title
agent-browser --cdp 9222 snapshot -i | head -20
# Expect: @ref annotations in snapshot output
```

### TC-05: noVNC Access (AC-02)
- Open `http://192.168.1.194:6080/vnc.html` in Chrome
- Expect: VNC password prompt → connect → see Chromium viewport
- Measure latency: click navigate API, observe iframe update timing (<1s LAN)

### TC-06: UI Flow (AC-04)
- Open ClawX-Web → Browser tab
- Click Start → observe status badge
- Enter URL → Go → observe navigation in iframe
- Click inside iframe → observe lockOwner → 'human'
- Try API navigate via curl during human lock → expect 409

### TC-07: Human Intervention (AC-03)
- With stack running, type/click in noVNC iframe
- Run `curl -X POST /api/browser/click -d '{"selector":"body"}'` → expect 409 for 3s
- Wait 4s, retry → expect 200

### TC-08: Resource Usage (NFR-04, NFR-05)
- Stack stopped: `free -h` → RSS of ClawX-Web process only
  - **Target: < 200MB total ClawX-Web + browser manager idle**
- Stack running, Chromium on Google: `free -h`
  - **Target: total system RAM usage < 2.2GB over baseline**
- `top -b -n 5 -d 1 | grep chromium` → CPU avg <60%

### TC-09: Auto-restart (AC-05)
```bash
# Find Chromium PID and kill
pkill -9 -f chromium
sleep 6
sudo supervisorctl status browser-stack:chromium
# Expect: RUNNING (restarted)
curl http://localhost:2003/api/browser/status
# Expect: cdpConnected may be false briefly, reconnects on next action
```

### TC-10: Profile Persistence (AC-08)
- Navigate to a site, accept cookies
- Stop + start stack
- Navigate to same site → cookies retained
- Verify `~/.chromium-agent` directory persists

### TC-11: Thermal Check (NFR-13)
- Let browser run for 10 min loading pages
- `cat /sys/class/thermal/thermal_zone0/temp`
- **Target: < 85000 (85°C)**

### TC-12: Bandwidth (NFR-14)
- Open noVNC iframe, load a static page
- Monitor `iftop -i eth0` or browser DevTools network
- **Target: avg <500 KB/s idle, peak <2 MB/s**

## Acceptance Matrix

| SRS AC | Test | Pass Criteria |
|--------|------|---------------|
| AC-01 | TC-04 | Screenshot valid PNG after navigate |
| AC-02 | TC-05 | noVNC latency <1s LAN |
| AC-03 | TC-07 | Human + agent both can interact |
| AC-04 | TC-06 | iframe renders in ClawX-Web panel |
| AC-05 | TC-09 | Chromium auto-restart <5s |
| AC-06 | TC-08 | Idle <200MB, active <2.2GB |
| AC-07 | manual | KiotViet login flow works |
| AC-08 | TC-10 | Cookies persist across restart |

## Todo

- [ ] Deploy branch to LIVA (`git pull` or `/api/system/update`)
- [ ] Run TC-01 through TC-12
- [ ] Record metrics in test report
- [ ] File bugs for failures
- [ ] Manual UC-01 walkthrough (KiotViet login)

## Deliverable

Test report at `/Users/hnam/Documents/ClawX-Web/plans/reports/tester-260405-XXXX-browser-mvp.md`

## Risks

- **Chromium snap vs apt**: Ubuntu 22.04 ships chromium as snap by default → systemd-run may conflict. May need to install Debian `chromium` package or use Google Chrome deb.
- **Polkit still blocks udisksctl-style auth**: If systemd-run needs user session and we're running as service, it may fail. Fallback: use plain `chromium-browser &` via supervisord with cgroup v2 slice assignment.

## Next

Phase 7 (future): Agent integration — expose browser actions as OpenClaw gateway tools so AI can call navigate/click/fill programmatically.
