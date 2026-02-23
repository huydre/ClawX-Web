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
        // Retry logic for RPC calls (max 3 attempts)
        let lastError = null;
        const maxRetries = 2;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Wait for gateway to be connected before attempting RPC
                const maxWaitTime = 10000; // 10 seconds
                const startWait = Date.now();
                while (!gateway_manager_1.gatewayManager.isConnected() && (Date.now() - startWait) < maxWaitTime) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                if (!gateway_manager_1.gatewayManager.isConnected()) {
                    throw new Error('Gateway not connected after waiting');
                }
                // Use shorter timeout (10s) to fail fast and retry
                const result = await gateway_manager_1.gatewayManager.rpc(method, params, timeoutMs || 10000);
                res.json({ success: true, result });
                return;
            }
            catch (error) {
                lastError = error;
                const errorMsg = String(error);
                // If this is the last attempt, throw the error
                if (attempt === maxRetries) {
                    throw error;
                }
                // If it's a timeout or connection error, wait and retry
                if (errorMsg.includes('timeout') || errorMsg.includes('not connected')) {
                    logger_1.logger.warn(`RPC attempt ${attempt + 1} failed: ${errorMsg}, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                // For other errors, don't retry
                throw error;
            }
        }
        throw lastError || new Error('Max retries exceeded');
    }
    catch (error) {
        logger_1.logger.error('RPC error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
exports.default = router;
