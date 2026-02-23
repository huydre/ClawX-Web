import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { gatewayManager } from '../services/gateway-manager.js';

const router = Router();

// GET /api/gateway/status
router.get('/status', (_req, res) => {
  try {
    const state = gatewayManager.getState();
    const connected = gatewayManager.isConnected();
    res.json({ state, connected });
  } catch (error) {
    logger.error('Get status error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/gateway/start
router.post('/start', async (_req, res) => {
  try {
    await gatewayManager.start();
    res.json({ success: true });
  } catch (error) {
    logger.error('Start gateway error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/gateway/stop
router.post('/stop', async (_req, res) => {
  try {
    await gatewayManager.stop();
    res.json({ success: true });
  } catch (error) {
    logger.error('Stop gateway error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/gateway/rpc
const rpcSchema = z.object({
  method: z.string(),
  params: z.any().optional(),
  timeoutMs: z.number().optional(),
});

router.post('/rpc', async (req, res) => {
  try {
    const { method, params, timeoutMs } = rpcSchema.parse(req.body);

    // Retry logic for RPC calls (max 3 attempts)
    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Wait for gateway to be connected before attempting RPC
        const maxWaitTime = 10000; // 10 seconds
        const startWait = Date.now();

        while (!gatewayManager.isConnected() && (Date.now() - startWait) < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!gatewayManager.isConnected()) {
          throw new Error('Gateway not connected after waiting');
        }

        // Use shorter timeout (10s) to fail fast and retry
        const result = await gatewayManager.rpc(method, params, timeoutMs || 10000);
        res.json({ success: true, result });
        return;
      } catch (error) {
        lastError = error as Error;
        const errorMsg = String(error);

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }

        // If it's a timeout or connection error, wait and retry
        if (errorMsg.includes('timeout') || errorMsg.includes('not connected')) {
          logger.warn(`RPC attempt ${attempt + 1} failed: ${errorMsg}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // For other errors, don't retry
        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  } catch (error) {
    logger.error('RPC error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
