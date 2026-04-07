/**
 * Browser Routes — /api/browser
 * Control browser stack, execute agent-browser commands, manage turn-based lock.
 */
import { Router } from 'express';
import { browserManager } from '../services/browser-manager.js';
const router = Router();
/** GET /api/browser/status */
router.get('/status', (_req, res) => {
    res.json({ state: browserManager.getState() });
});
/** POST /api/browser/start */
router.post('/start', async (_req, res) => {
    await browserManager.start();
    res.json({ state: browserManager.getState() });
});
/** POST /api/browser/stop */
router.post('/stop', async (_req, res) => {
    await browserManager.stop();
    res.json({ state: browserManager.getState() });
});
/** POST /api/browser/navigate — { url } */
router.post('/navigate', async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'url required' });
    }
    try {
        await browserManager.navigate(url);
        res.json({ state: browserManager.getState() });
    }
    catch (err) {
        res.status(409).json({ error: err.message });
    }
});
/** POST /api/browser/click — { selector } (@ref or CSS) */
router.post('/click', async (req, res) => {
    const { selector } = req.body;
    if (!selector)
        return res.status(400).json({ error: 'selector required' });
    try {
        const result = await browserManager.click(selector);
        res.json({ result });
    }
    catch (err) {
        res.status(409).json({ error: err.message });
    }
});
/** POST /api/browser/fill — { selector, value } */
router.post('/fill', async (req, res) => {
    const { selector, value } = req.body;
    if (!selector || value === undefined) {
        return res.status(400).json({ error: 'selector, value required' });
    }
    try {
        const result = await browserManager.fill(selector, String(value));
        res.json({ result });
    }
    catch (err) {
        res.status(409).json({ error: err.message });
    }
});
/** POST /api/browser/type — { selector, text } */
router.post('/type', async (req, res) => {
    const { selector, text } = req.body;
    if (!selector || !text) {
        return res.status(400).json({ error: 'selector, text required' });
    }
    try {
        const result = await browserManager.type(selector, text);
        res.json({ result });
    }
    catch (err) {
        res.status(409).json({ error: err.message });
    }
});
/** POST /api/browser/press — { key } (Enter, Tab, etc.) */
router.post('/press', async (req, res) => {
    const { key } = req.body;
    if (!key)
        return res.status(400).json({ error: 'key required' });
    try {
        const result = await browserManager.press(key);
        res.json({ result });
    }
    catch (err) {
        res.status(409).json({ error: err.message });
    }
});
/** GET /api/browser/snapshot — accessibility tree with @refs */
router.get('/snapshot', async (_req, res) => {
    try {
        const snapshot = await browserManager.snapshot();
        res.json({ snapshot });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/** GET /api/browser/screenshot */
router.get('/screenshot', async (_req, res) => {
    try {
        const result = await browserManager.screenshot();
        res.json({ image: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/** POST /api/browser/eval — { js } */
router.post('/eval', async (req, res) => {
    const { js } = req.body;
    if (!js)
        return res.status(400).json({ error: 'js required' });
    try {
        const result = await browserManager.evalJs(js);
        res.json({ result });
    }
    catch (err) {
        res.status(409).json({ error: err.message });
    }
});
/** POST /api/browser/control — { owner: 'agent'|'human'|null } */
router.post('/control', (req, res) => {
    const { owner } = req.body;
    if (!['agent', 'human', null].includes(owner)) {
        return res.status(400).json({ error: 'owner must be agent, human, or null' });
    }
    browserManager.takeControl(owner);
    res.json({ state: browserManager.getState() });
});
/** POST /api/browser/human-input — mark human interaction */
router.post('/human-input', (_req, res) => {
    browserManager.markHumanInput();
    res.json({ ok: true });
});
export default router;
