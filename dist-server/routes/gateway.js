"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const gateway_manager_1 = require("../services/gateway-manager");
const router = (0, express_1.Router)();
// GET /api/gateway/status
router.get('/status', (_req, res) => {
    try {
        const state = gateway_manager_1.gatewayManager.getState();
        const connected = gateway_manager_1.gatewayManager.isConnected();
        res.json({ state, connected });
    }
    catch (error) {
        logger_1.logger.error('Get status error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/gateway/start
router.post('/start', async (_req, res) => {
    try {
        await gateway_manager_1.gatewayManager.start();
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Start gateway error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/gateway/stop
router.post('/stop', async (_req, res) => {
    try {
        await gateway_manager_1.gatewayManager.stop();
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Stop gateway error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/gateway/rpc
const rpcSchema = zod_1.z.object({
    method: zod_1.z.string(),
    params: zod_1.z.any().optional(),
    timeoutMs: zod_1.z.number().optional(),
});
router.post('/rpc', async (req, res) => {
    try {
        const { method, params, timeoutMs } = rpcSchema.parse(req.body);
        const result = await gateway_manager_1.gatewayManager.rpc(method, params, timeoutMs);
        res.json({ success: true, result });
    }
    catch (error) {
        logger_1.logger.error('RPC error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
exports.default = router;
