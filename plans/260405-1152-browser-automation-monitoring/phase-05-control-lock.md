# Phase 5: Turn-Based Control & Activity Indicator

**Priority:** MEDIUM | **Status:** Pending

## Overview

Refine turn-based lock beyond Phase 2 basic implementation. Add visual indicator showing who controls browser (agent vs human). Detect human input via iframe activity proxy + VNC server-side monitoring.

## Problem

iframe cross-origin blocks `onClick`/`onKeyDown` events from bubbling to parent page. Need alternative detection:

1. **Option A:** Poll VNC stream server-side for input activity (x11vnc logs client input).
2. **Option B:** Frontend detects iframe focus/blur + mouse enter/leave as proxy.
3. **Option C:** Inject small JS in noVNC static files to postMessage to parent on input.

**Chosen:** Option B (simplest, good enough) + Option C as enhancement.

## Files to Modify

- `src/pages/Browser/index.tsx` — iframe focus detection
- `src/pages/Browser/BrowserControls.tsx` — Take/Release button + indicator
- `server/services/browser-manager.ts` — add `releaseHumanControl()` method

## Implementation

### Frontend: iframe focus proxy

```tsx
// In BrowserPage
const iframeRef = useRef<HTMLIFrameElement>(null);

useEffect(() => {
  if (state.status !== 'running') return;
  const iframe = iframeRef.current;
  if (!iframe) return;

  // When iframe gains focus, human is interacting
  const onFocus = () => { markHumanInput(); };
  // Poll focus periodically (iframe doesn't bubble focus events reliably)
  const interval = setInterval(() => {
    if (document.activeElement === iframe) markHumanInput();
  }, 2000);

  iframe.addEventListener('mouseenter', onFocus);
  return () => {
    clearInterval(interval);
    iframe.removeEventListener('mouseenter', onFocus);
  };
}, [state.status, markHumanInput]);
```

### BrowserControls component

```tsx
// src/pages/Browser/BrowserControls.tsx
import { useTranslation } from 'react-i18next';
import { useBrowserStore } from '@/stores/browser';
import { Bot, User, Pause } from 'lucide-react';

export function BrowserControls() {
  const { t } = useTranslation('browser');
  const { state, takeControl } = useBrowserStore();

  const ownerLabel = state.lockOwner === 'agent' ? t('lock.agent')
                   : state.lockOwner === 'human' ? t('lock.human')
                   : t('lock.none');
  const ownerIcon = state.lockOwner === 'agent' ? <Bot size={16} />
                   : state.lockOwner === 'human' ? <User size={16} />
                   : <Pause size={16} />;
  const ownerColor = state.lockOwner === 'agent' ? 'text-blue-500'
                   : state.lockOwner === 'human' ? 'text-green-500' : 'text-gray-500';

  return (
    <div className="w-64 border rounded p-3 flex flex-col gap-3 bg-card">
      <div>
        <div className="text-xs text-muted mb-1">{t('control.current')}</div>
        <div className={`flex items-center gap-2 font-medium ${ownerColor}`}>
          {ownerIcon} {ownerLabel}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => takeControl('human')}
          disabled={state.status !== 'running' || state.lockOwner === 'human'}
          className="btn btn-primary text-sm"
        >
          <User size={14} /> {t('take_control')}
        </button>
        <button
          onClick={() => takeControl('agent')}
          disabled={state.status !== 'running' || state.lockOwner === 'agent'}
          className="btn text-sm"
        >
          <Bot size={14} /> {t('release')}
        </button>
      </div>

      <div className="border-t pt-2 text-xs space-y-1">
        <div><span className="text-muted">URL:</span> {state.currentUrl || '—'}</div>
        <div className="truncate"><span className="text-muted">Title:</span> {state.title || '—'}</div>
      </div>

      {state.error && (
        <div className="text-xs text-red-500 border-t pt-2">⚠ {state.error}</div>
      )}
    </div>
  );
}
```

### Visual overlay on iframe

When `lockOwner === 'agent'` and agent is actively acting (`Date.now() - lastAgentActionAt < 2000`), show a thin pulsing border around iframe:

```tsx
<div className={`flex-1 border rounded overflow-hidden bg-black relative ${
  state.lockOwner === 'agent' ? 'ring-2 ring-blue-500 ring-opacity-50 animate-pulse' : ''
}`}>
  {/* iframe */}
</div>
```

## Todo

- [ ] Add iframe focus detection with mouseenter + activeElement polling
- [ ] Implement BrowserControls component
- [ ] Add animated border when agent acting
- [ ] Test lock handoff: agent acts → user clicks iframe → agent blocked 3s → idle → auto-release
- [ ] Verify WS `browser.state` updates UI in real-time

## Success Criteria

- User sees clear "Agent" / "You" / "Idle" label.
- Clicking "Take Control" instantly blocks agent commands.
- Clicking "Release" returns control to agent.
- Moving mouse into iframe → human lock activates → `/api/browser/navigate` returns 409 for 3s.
- Visual pulsing border when agent acting.

## Risks

- **iframe polling (2s interval)**: slight delay detecting human engagement. Acceptable for MVP.
- **WS event flooding**: Every `markHumanInput()` call emits state-change. Throttle server-side (emit at most 1/sec).

## Next

Phase 6: Testing on LIVA + acceptance validation.
