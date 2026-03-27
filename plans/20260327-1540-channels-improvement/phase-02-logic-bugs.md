# Phase 2: Logic Bugs & Error Handling

**Priority:** HIGH | **Status:** Pending

## Issues Covered

| # | File | Issue |
|---|------|-------|
| 6 | `ChannelSettingsPanel.tsx:32-48` | No `res.ok` check before JSON parse |
| 7 | `ChannelSettingsPanel.tsx:50-70` | Same issue in save handler |
| 8 | `channels.ts (store):205` | Channel ID split bug — fails with multi-dash accountId |
| 9 | `channels.ts (server):409` | Command injection risk — string concat exec |
| 10 | `AddChannelDialog.tsx:247-279` | Memory leak — interval not cleared on error |
| 11 | `AddChannelDialog.tsx:113-115` | Unsafe type cast on IPC args |
| 12 | `AddChannelDialog.tsx:140-144` | Race condition — onChannelAdded before restart done |
| 13 | `channels.ts (store):152-155` | Catch all errors but no error message set |

## Implementation Steps

### 2.1 Fix HTTP response validation (ChannelSettingsPanel)
```typescript
// Before JSON parse, add:
if (!res.ok) {
  throw new Error(`HTTP ${res.status}`);
}
```
Apply to both load (line 35) and save (line 55) handlers.

### 2.2 Fix channel ID parsing (store)
```typescript
// Current (broken): channelId.split('-')[0]
// Fix: use indexOf to split on first dash only
const dashIdx = channelId.indexOf('-');
const channelType = dashIdx > 0 ? channelId.slice(0, dashIdx) : channelId;
```

### 2.3 Fix command execution security (server)
```typescript
// Current: exec(cmd) with string concat
// Fix: use execFile with array args
import { execFile } from 'child_process';
execFile(openzcaBin, ['--profile', sanitizedProfile, 'auth', 'login', '--qr-base64'], ...)
```

### 2.4 Fix Zalo QR polling memory leak
- Track interval ID in ref
- Clear existing interval before creating new one
- Clear interval on component unmount (cleanup return in useEffect)
- Clear interval on any fetch error after N retries

### 2.5 Add type guards for IPC messages
```typescript
function isQrData(data: unknown): data is { qr: string; raw: string } {
  return typeof data === 'object' && data !== null && 'qr' in data;
}
```

### 2.6 Fix race condition in channel add
```typescript
// Await gateway restart before calling onChannelAdded
await window.electron.ipcRenderer.invoke('gateway:restart');
onChannelAdded();
```

### 2.7 Set error message in store catch
```typescript
catch (err) {
  set({ channels: [], loading: false, error: String(err) });
}
```

## Success Criteria
- No silent HTTP failures
- Channel deletion works with any accountId format
- No command injection possible
- No memory leaks from polling intervals
- Proper error messages shown to user
