"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const storage_1 = require("../services/storage");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// GET /api/settings
router.get('/', async (_req, res) => {
    try {
        const settings = await (0, storage_1.getSettings)();
        // Don't expose tokens
        const { serverToken, gatewayToken, ...safeSettings } = settings;
        res.json(safeSettings);
    }
    catch (error) {
        logger_1.logger.error('Get settings error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// GET /api/settings/:key
router.get('/:key', async (req, res) => {
    try {
        const value = await (0, storage_1.getSetting)(req.params.key);
        res.json({ value });
    }
    catch (error) {
        logger_1.logger.error('Get setting error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/settings/:key
router.post('/:key', async (req, res) => {
    try {
        const { value } = zod_1.z.object({ value: zod_1.z.any() }).parse(req.body);
        await (0, storage_1.setSetting)(req.params.key, value);
        logger_1.logger.info('Setting updated', { key: req.params.key });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Set setting error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
exports.default = router;
