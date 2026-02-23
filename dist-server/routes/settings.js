import { Router } from 'express';
import { z } from 'zod';
import { getSettings, getSetting, setSetting } from '../services/storage.js';
import { logger } from '../utils/logger.js';
const router = Router();
// GET /api/settings
router.get('/', async (_req, res) => {
    try {
        const settings = await getSettings();
        // Don't expose tokens
        const { serverToken, gatewayToken, ...safeSettings } = settings;
        res.json(safeSettings);
    }
    catch (error) {
        logger.error('Get settings error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// GET /api/settings/:key
router.get('/:key', async (req, res) => {
    try {
        const value = await getSetting(req.params.key);
        res.json({ value });
    }
    catch (error) {
        logger.error('Get setting error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/settings/:key
router.post('/:key', async (req, res) => {
    try {
        const { value } = z.object({ value: z.any() }).parse(req.body);
        await setSetting(req.params.key, value);
        logger.info('Setting updated', { key: req.params.key });
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Set setting error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
export default router;
