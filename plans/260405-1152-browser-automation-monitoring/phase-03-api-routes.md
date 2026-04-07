# Phase 3: Backend Routes & CDP Proxy

**Priority:** HIGH | **Status:** Pending

## Overview

Expose `BrowserManager` via `/api/browser/*` REST endpoints. Mount route in `server/app.ts`.

## Files to Create

- `server/routes/browser.ts` (~120 LOC)

## Files to Modify

- `server/app.ts` — add `app.use('/api/browser', browserRouter)`

## Endpoints

| Method | Path | Body/Query | Response |
|--------|------|-----------|----------|
| GET | `/api/browser/status` | — | `{ state }` |
| POST | `/api/browser/start` | — | `{ state }` |
| POST | `/api/browser/stop` | — | `{ state }` |
| POST | `/api/browser/navigate` | `{ url }` | `{ state }` |
| POST | `/api/browser/click` | `{ selector }` | `{ ok: true }` |
| POST | `/api/browser/fill` | `{ selector, value }` | `{ ok: true }` |
| GET | `/api/browser/screenshot` | — | `{ image: base64 }` |
| GET | `/api/browser/snapshot` | — | `{ nodes }` |
| POST | `/api/browser/control` | `{ owner: 'agent'\|'human'\|null }` | `{ state }` |
| POST | `/api/browser/human-input` | — | `{ ok: true }` (called by frontend on VNC interaction) |

## Implementation Sketch

```typescript
// server/routes/browser.ts
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
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });
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
  try { await browserManager.click(selector); res.json({ ok: true }); }
  catch (err: any) { res.status(409).json({ error: err.message }); }
});

router.post('/fill', async (req, res) => {
  const { selector, value } = req.body;
  if (!selector || value === undefined) return res.status(400).json({ error: 'selector, value required' });
  try { await browserManager.fill(selector, String(value)); res.json({ ok: true }); }
  catch (err: any) { res.status(409).json({ error: err.message }); }
});

router.get('/screenshot', async (_req, res) => {
  try { const img = await browserManager.screenshot(); res.json({ image: img }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/snapshot', async (_req, res) => {
  try { const nodes = await browserManager.snapshot(); res.json({ nodes }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/control', (req, res) => {
  const { owner } = req.body;
  if (!['agent', 'human', null].includes(owner)) return res.status(400).json({ error: 'invalid owner' });
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

Add to existing WebSocket hub: on `browserManager.emit('state-change', state)`, broadcast to clients as `{ type: 'browser.state', state }`.

Location: wherever existing WS hub is wired (check `server/websocket/`).

## Todo

- [ ] Create `server/routes/browser.ts` with 10 endpoints
- [ ] Mount in `server/app.ts`
- [ ] Hook `browserManager` events into WS broadcaster
- [ ] Add CSP `frame-src http://<liva-ip>:6080` in Express if needed
- [ ] Test each endpoint with curl

## Success Criteria

- `curl -X POST /api/browser/start` starts stack.
- `curl -X POST /api/browser/navigate -d '{"url":"https://google.com"}'` navigates.
- `curl /api/browser/status` returns live state.
- WebSocket clients receive `browser.state` events on changes.

## Risks

- Express 5 + body parser already mounted → verify `express.json()` active.
- CORS: if frontend runs on different origin during dev, set `Access-Control-Allow-Origin`.

## Next

Phase 4: Frontend UI (Browser tab + iframe + controls).
