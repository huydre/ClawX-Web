# Phase 4: Frontend Browser Tab UI

**Priority:** HIGH | **Status:** Pending

## Overview

Add Browser tab in Sidebar + BottomNav. Create `src/pages/Browser/` page with:
- Top bar: URL input + Go button + status badge + Start/Stop button
- Middle: noVNC iframe (1280x720)
- Right sidebar: control panel (Take Control / Release)

## Files to Create

- `src/stores/browser.ts` — Zustand store
- `src/pages/Browser/index.tsx` — Main page
- `src/pages/Browser/BrowserControls.tsx` — Control panel
- `src/i18n/locales/en/browser.json`
- `src/i18n/locales/ja/browser.json`
- `src/i18n/locales/vi/browser.json`

## Files to Modify

- `src/App.tsx` — add `/browser` route
- `src/components/layout/Sidebar.tsx` — add Browser nav item (Globe icon)
- `src/components/layout/BottomNav.tsx` — add Browser entry
- `src/i18n/index.ts` — register `browser` namespace
- `src/lib/api.ts` — add browser API methods

## Store Design (src/stores/browser.ts)

```typescript
import { create } from 'zustand';
import { api } from '@/lib/api';

export type BrowserStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
export type LockOwner = 'agent' | 'human' | null;

export interface BrowserState {
  status: BrowserStatus;
  cdpConnected: boolean;
  currentUrl: string;
  title: string;
  lockOwner: LockOwner;
  error: string | null;
}

interface BrowserStore {
  state: BrowserState;
  loading: boolean;
  fetchStatus: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  navigate: (url: string) => Promise<void>;
  takeControl: (owner: LockOwner) => Promise<void>;
  markHumanInput: () => Promise<void>;
  handleWsEvent: (event: any) => void;
}

const INITIAL: BrowserState = {
  status: 'stopped', cdpConnected: false, currentUrl: '',
  title: '', lockOwner: null, error: null,
};

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  state: INITIAL,
  loading: false,

  fetchStatus: async () => {
    const res = await api.getBrowserStatus();
    set({ state: res.state });
  },

  start: async () => {
    set({ loading: true });
    try { const res = await api.startBrowser(); set({ state: res.state }); }
    finally { set({ loading: false }); }
  },

  stop: async () => {
    set({ loading: true });
    try { const res = await api.stopBrowser(); set({ state: res.state }); }
    finally { set({ loading: false }); }
  },

  navigate: async (url) => {
    const res = await api.navigateBrowser(url);
    set({ state: res.state });
  },

  takeControl: async (owner) => {
    const res = await api.setBrowserControl(owner);
    set({ state: res.state });
  },

  markHumanInput: async () => {
    await api.markBrowserHumanInput();
  },

  handleWsEvent: (event) => {
    if (event.type === 'browser.state') set({ state: event.state });
  },
}));
```

## Page Design (src/pages/Browser/index.tsx)

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrowserStore } from '@/stores/browser';
import { BrowserControls } from './BrowserControls';
import { Play, Square, Globe } from 'lucide-react';

export default function BrowserPage() {
  const { t } = useTranslation('browser');
  const { state, loading, fetchStatus, start, stop, navigate, markHumanInput } = useBrowserStore();
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Auto-start on mount (optional; can require button click)
  // useEffect(() => { if (state.status === 'stopped') start(); }, []);

  // Stop stack on unmount (free RAM)
  useEffect(() => () => { stop(); }, []);

  const vncHost = window.location.hostname;
  const vncUrl = `http://${vncHost}:6080/vnc.html?autoconnect=1&resize=scale`;

  const handleGo = async () => {
    if (!urlInput) return;
    const url = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
    await navigate(url);
  };

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        <StatusBadge status={state.status} />
        {state.status === 'stopped' || state.status === 'error' ? (
          <button onClick={start} disabled={loading} className="btn btn-primary">
            <Play size={16} /> {t('start')}
          </button>
        ) : (
          <button onClick={stop} disabled={loading} className="btn">
            <Square size={16} /> {t('stop')}
          </button>
        )}

        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGo()}
          placeholder={t('url_placeholder')}
          className="input flex-1"
          disabled={state.status !== 'running'}
        />
        <button onClick={handleGo} disabled={state.status !== 'running'} className="btn">
          {t('go')}
        </button>
      </div>

      {/* Main content: iframe + controls */}
      <div className="flex gap-3 flex-1 min-h-0">
        <div className="flex-1 border rounded overflow-hidden bg-black relative">
          {state.status === 'running' ? (
            <iframe
              src={vncUrl}
              className="w-full h-full"
              onClick={markHumanInput}
              onKeyDown={markHumanInput}
              title="Virtual Browser"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted">
              <Globe size={48} /> {t('not_running')}
            </div>
          )}
        </div>

        <BrowserControls />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-500', starting: 'bg-yellow-500',
    stopping: 'bg-orange-500', stopped: 'bg-gray-500', error: 'bg-red-500',
  };
  return <span className={`px-2 py-1 rounded text-xs text-white ${colors[status]}`}>{status}</span>;
}
```

## BrowserControls

Shows lockOwner, Take Control / Release button, current URL/title.

## i18n keys (browser.json)

```json
{
  "title": "Virtual Browser",
  "start": "Start",
  "stop": "Stop",
  "go": "Go",
  "url_placeholder": "Enter URL...",
  "not_running": "Browser not running. Click Start.",
  "lock": {
    "agent": "Agent controlling",
    "human": "You are controlling",
    "none": "Idle"
  },
  "take_control": "Take Control",
  "release": "Release to Agent"
}
```

## Sidebar Entry

Add `Globe` icon nav item pointing to `/browser`. Place after USB.

## Todo

- [ ] Create `src/stores/browser.ts`
- [ ] Add browser API methods in `src/lib/api.ts`
- [ ] Create `src/pages/Browser/index.tsx`
- [ ] Create `src/pages/Browser/BrowserControls.tsx`
- [ ] Add i18n files (en/ja/vi)
- [ ] Register namespace in `src/i18n/index.ts`
- [ ] Add route in `src/App.tsx`
- [ ] Add Sidebar + BottomNav entries
- [ ] Hook into existing WS handler to dispatch `browser.state` events
- [ ] Test iframe embedding (check CSP)

## Success Criteria

- Browser tab visible in sidebar.
- Clicking Start → status turns 'starting' → 'running' in <15s.
- Iframe loads noVNC view of Chromium.
- URL input navigates browser.
- Clicking inside iframe calls `markHumanInput` → lockOwner → 'human'.
- Leaving page calls `stop()` → stack shuts down.

## Risks

- **iframe same-origin policy**: noVNC on `:6080` vs ClawX-Web on `:2003` = different origin. iframe itself works, but `onClick`/`onKeyDown` events INSIDE iframe don't bubble to parent. **Solution:** Use `mouseenter` on iframe container as proxy for "human engaged", OR poll VNC WebSocket activity server-side.
- **Auto-stop on unmount**: may conflict if user switches tabs briefly. Consider idle timeout instead (e.g., stop after 5min no activity).

## Next

Phase 5: Turn-based lock refinement + activity indicator.
