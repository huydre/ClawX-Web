# Phase 4: Frontend Browser Tab UI (v2)

**Priority:** HIGH | **Status:** Pending | **Depends on:** Phase 3

## Overview

Add Browser tab in Sidebar + BottomNav. Create page with:
- Top bar: URL input + Go + status badge + Start/Stop
- Main area: noVNC iframe (user can see + interact with Chrome)
- Right panel: BrowserControls (lock status, Take/Release control)
- Optional: agent-browser dashboard tab (activity feed, console)

## Changes from v1

- Added optional dashboard iframe tab (port 4848) alongside noVNC
- Snapshot endpoint available for future AI integration panel

## Files to Create

- `src/stores/browser.ts` — Zustand store
- `src/pages/Browser/index.tsx` — Main page with tabs (noVNC + Dashboard)
- `src/pages/Browser/BrowserControls.tsx` — Control panel
- `src/i18n/locales/{en,ja,vi}/browser.json`

## Files to Modify

- `src/App.tsx` — add `/browser` route
- `src/components/layout/Sidebar.tsx` — add Browser nav (Globe icon)
- `src/components/layout/BottomNav.tsx` — add Browser entry
- `src/i18n/index.ts` — register `browser` namespace
- `src/lib/api.ts` — add browser API methods

## Store Design (src/stores/browser.ts)

Same as v1 plan — Zustand store with:
- `state: BrowserState` (status, currentUrl, title, lockOwner, error)
- `start()`, `stop()`, `navigate(url)`, `takeControl(owner)`, `markHumanInput()`
- `handleWsEvent(event)` for `browser.state` WS events

## Page Layout

```
┌── Top Bar ──────────────────────────────────────────┐
│ [Status] [Start/Stop]  [URL input............] [Go] │
├── Tab Bar ──────────────────────────────────────────┤
│ [Browser View]  [Activity Feed]                      │
├── Main Content ─────────────────────┬── Controls ───┤
│                                     │ Lock: Agent   │
│  noVNC iframe (1280x720)            │               │
│  http://<server>:6080/vnc.html      │ [Take Control]│
│  User can click/type here           │ [Release]     │
│                                     │               │
│  --- OR (Activity Feed tab) ---     │ URL: google.. │
│  Dashboard iframe                   │ Title: Google │
│  http://<server>:4848               │               │
│                                     │ Error: none   │
└─────────────────────────────────────┴───────────────┘
```

Two tabs in content area:
1. **Browser View** — noVNC iframe (default, interactive)
2. **Activity Feed** — agent-browser dashboard iframe (monitoring, read-only)

## noVNC iframe URL

```typescript
const vncHost = window.location.hostname;
const vncUrl = `http://${vncHost}:6080/vnc.html?autoconnect=1&resize=scale`;
```

## Dashboard iframe URL

```typescript
const dashUrl = `http://${vncHost}:4848`;
```

## i18n keys (browser.json)

```json
{
  "title": "Virtual Browser",
  "start": "Start",
  "stop": "Stop",
  "go": "Go",
  "url_placeholder": "Enter URL...",
  "not_running": "Browser not running. Click Start.",
  "tab": {
    "browser": "Browser View",
    "activity": "Activity Feed"
  },
  "lock": {
    "agent": "Agent controlling",
    "human": "You are controlling",
    "none": "Idle"
  },
  "take_control": "Take Control",
  "release": "Release to Agent"
}
```

## Auto-stop Behavior

When user navigates away from Browser tab:
- **Don't auto-stop immediately** (user might switch tabs briefly)
- Show a small indicator in sidebar when browser stack is running
- Add "Stop Browser" button in controls panel for explicit shutdown

## Todo

- [ ] Create `src/stores/browser.ts`
- [ ] Add browser API methods in `src/lib/api.ts`
- [ ] Create `src/pages/Browser/index.tsx` with noVNC + dashboard tabs
- [ ] Create `src/pages/Browser/BrowserControls.tsx`
- [ ] Add i18n files (en/ja/vi)
- [ ] Register namespace in `src/i18n/index.ts`
- [ ] Add route in `src/App.tsx`
- [ ] Add Sidebar + BottomNav entries
- [ ] Hook WS handler for `browser.state` events

## Success Criteria

- Browser tab visible in sidebar
- Start → status "starting" → "running" in <15s
- noVNC iframe loads, user can see Chrome + click/type
- Activity Feed tab shows agent-browser dashboard
- URL input navigates browser
- Controls show lock status correctly

## Risks

- **noVNC iframe cross-origin**: port 6080 vs 2003 = different origin. iframe loads fine, but parent can't capture click events inside. Use mouseenter proxy (Phase 5).
- **Dashboard iframe may not load** if `agent-browser dashboard` not started. Show fallback message.

## Next

Phase 5: Turn-based control refinement.
