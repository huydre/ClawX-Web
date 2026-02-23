import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { gatewayManager } from '../services/gateway-manager';

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
    const result = await gatewayManager.rpc(method, params, timeoutMs);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('RPC error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
