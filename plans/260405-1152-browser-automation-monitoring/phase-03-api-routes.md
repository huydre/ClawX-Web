# Phase 3: Backend Routes (v2)

**Priority:** HIGH | **Status:** Pending | **Depends on:** Phase 2

## Overview

Expose `BrowserManager` via `/api/browser/*` REST endpoints. All agent actions go through
`agent-browser` CLI (not direct CDP). Mount in `server/app.ts`.

## Changes from v1

- Added `snapshot` endpoint (returns @ref accessibility tree)
- Added `type`, `press`, `eval` endpoints
- Click/fill use `@ref` selectors (from snapshot) or CSS selectors
- Screenshot returns base64 or file path

## Files to Create

- `server/routes/browser.ts` (~120 LOC)

## Files to Modify

- `server/app.ts` — add `app.use('/api/browser', browserRouter)`

## Endpoints

| Method | Path | Body/Query | Response | Description |
|--------|------|-----------|----------|-------------|
| GET | `/status` | — | `{ state }` | Current browser state |
| POST | `/start` | — | `{ state }` | Start browser stack |
| POST | `/stop` | — | `{ state }` | Stop browser stack |
| POST | `/navigate` | `{ url }` | `{ state }` | Navigate to URL |
| POST | `/click` | `{ selector }` | `{ result }` | Click element (`@e1` or CSS) |
| POST | `/fill` | `{ selector, value }` | `{ result }` | Clear + fill field |
| POST | `/type` | `{ selector, text }` | `{ result }` | Type text (no clear) |
| POST | `/press` | `{ key }` | `{ result }` | Press key (Enter, Tab, etc.) |
| GET | `/snapshot` | — | `{ snapshot }` | Accessibility tree with @refs (JSON) |
| GET | `/screenshot` | — | `{ image }` | Screenshot (base64 PNG) |
| POST | `/eval` | `{ js }` | `{ result }` | Execute JavaScript |
| POST | `/control` | `{ owner }` | `{ state }` | Set lock owner (agent/human/null) |
| POST | `/human-input` | — | `{ ok }` | Mark human interaction |

## Implementation

```typescript
import { Router } from 'express';
import { browserManager } from '../services/browser-manager.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({ state: browserManager.getState() });
});

router.post('/start', async (_req, res) => {
  await browserManager.start();
  res.json({ state: browserManager.getState() });
});

router.post('/stop', async (_req, res) => {
  await browserManager.stop();
  res.json({ state: browserManager.getState() });
});

router.post('/navigate', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    await browserManager.navigate(url);
    res.json({ state: browserManager.getState() });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

router.post('/click', async (req, res) => {
  const { selector } = req.body;
  if (!selector) return res.status(400).json({ error: 'selector required' });
  try {
    const result = await browserManager.click(selector);
    res.json({ result });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

router.post('/fill', async (req, res) => {
  const { selector, value } = req.body;
  if (!selector || value === undefined) return res.status(400).json({ error: 'selector, value required' });
  try {
    const result = await browserManager.fill(selector, String(value));
    res.json({ result });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

router.post('/type', async (req, res) => {
  const { selector, text } = req.body;
  if (!selector || !text) return res.status(400).json({ error: 'selector, text required' });
  try {
    const result = await browserManager.type(selector, text);
    res.json({ result });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

router.post('/press', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  try {
    const result = await browserManager.press(key);
    res.json({ result });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

router.get('/snapshot', async (_req, res) => {
  try {
    const snapshot = await browserManager.snapshot();
    res.json({ snapshot: JSON.parse(snapshot) });
  } catch (err: any) {
    // If JSON parse fails, return raw string
    try {
      const raw = await browserManager.snapshot();
      res.json({ snapshot: raw });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
});

router.get('/screenshot', async (_req, res) => {
  try {
    const result = await browserManager.screenshot();
    res.json({ image: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/eval', async (req, res) => {
  const { js } = req.body;
  if (!js) return res.status(400).json({ error: 'js required' });
  try {
    const result = await browserManager.eval(js);
    res.json({ result });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

router.post('/control', (req, res) => {
  const { owner } = req.body;
  browserManager.takeControl(owner);
  res.json({ state: browserManager.getState() });
});

router.post('/human-input', (_req, res) => {
  browserManager.markHumanInput();
  res.json({ ok: true });
});

export default router;
```

## WebSocket Broadcast

Hook `browserManager.emit('state-change')` into existing WS hub.
Broadcast `{ type: 'browser.state', state }` to connected clients.

## Todo

- [ ] Create `server/routes/browser.ts`
- [ ] Mount in `server/app.ts`
- [ ] Hook state-change events into WS broadcaster
- [ ] Test each endpoint with curl
- [ ] Test 409 response when human lock active

## Success Criteria

- `POST /api/browser/start` → stack starts, state = running
- `POST /api/browser/navigate {"url":"https://google.com"}` → navigates
- `GET /api/browser/snapshot` → JSON with @ref elements
- `POST /api/browser/click {"selector":"@e2"}` → clicks element by ref
- `POST /api/browser/fill {"selector":"@e3","value":"test"}` → fills field
- Agent commands return 409 when human lock active

## Next

Phase 4: Frontend UI.
