"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const storage_1 = require("../services/storage");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// GET /api/providers
router.get('/', async (_req, res) => {
    try {
        const providers = await (0, storage_1.getAllProviders)();
        res.json(providers);
    }
    catch (error) {
        logger_1.logger.error('Get providers error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// GET /api/providers/default - Must come before /:id route
router.get('/default', async (_req, res) => {
    try {
        const defaultId = await (0, storage_1.getDefaultProvider)();
        if (!defaultId) {
            // No default provider set yet - return 200 with null instead of 404
            return res.json({ id: null });
        }
        res.json({ id: defaultId });
    }
    catch (error) {
        logger_1.logger.error('Get default provider error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// GET /api/providers/:id
router.get('/:id', async (req, res) => {
    try {
        const provider = await (0, storage_1.getProvider)(req.params.id);
        if (!provider) {
            return res.status(404).json({ error: 'Provider not found' });
        }
        res.json(provider);
    }
    catch (error) {
        logger_1.logger.error('Get provider error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/providers
const saveProviderSchema = zod_1.z.object({
    config: zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        type: zod_1.z.string(),
        baseUrl: zod_1.z.string().optional(),
        model: zod_1.z.string().optional(),
        enabled: zod_1.z.boolean().default(true),
    }),
    apiKey: zod_1.z.string().optional(),
});
router.post('/', async (req, res) => {
    try {
        const { config, apiKey } = saveProviderSchema.parse(req.body);
        await (0, storage_1.saveProvider)(config, apiKey);
        logger_1.logger.info('Provider saved', { id: config.id });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Save provider error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// DELETE /api/providers/:id
router.delete('/:id', async (req, res) => {
    try {
        await (0, storage_1.deleteProvider)(req.params.id);
        logger_1.logger.info('Provider deleted', { id: req.params.id });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Delete provider error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/providers/default
router.post('/default', async (req, res) => {
    try {
        const { id } = zod_1.z.object({ id: zod_1.z.string() }).parse(req.body);
        await (0, storage_1.setDefaultProvider)(id);
        logger_1.logger.info('Default provider set', { id });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Set default provider error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
exports.default = router;
