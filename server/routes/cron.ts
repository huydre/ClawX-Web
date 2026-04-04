import { Router } from 'express';
import { logger } from '../utils/logger.js';
import { gatewayManager } from '../services/gateway-manager.js';

const router = Router();

// GET /api/cron/jobs
router.get('/jobs', async (_req, res) => {
  try {
    if (!gatewayManager.isConnected()) {
      return res.status(502).json({ error: 'Gateway not connected' });
    }
    const result = await gatewayManager.rpc('cron.list', { includeDisabled: true });
    res.json({ jobs: result?.jobs ?? result ?? [] });
  } catch (error) {
    logger.error('cron.list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cron/jobs
router.post('/jobs', async (req, res) => {
  try {
    if (!gatewayManager.isConnected()) {
      return res.status(502).json({ error: 'Gateway not connected' });
    }

    const { name, message, schedule, agentId, sessionTarget = 'isolated', channel, to } = req.body as {
      name: string;
      message: string;
      schedule: string | Record<string, unknown>;
      agentId?: string;
      sessionTarget?: 'isolated' | 'main';
      channel?: string;
      to?: string;
    };

    if (!name || !message || !schedule) {
      return res.status(400).json({ error: 'name, message, and schedule are required' });
    }

    const normalizedSchedule = typeof schedule === 'string'
      ? { kind: 'cron', expr: schedule, tz: 'Asia/Ho_Chi_Minh' }
      : schedule;

    const payload = sessionTarget === 'main'
      ? { kind: 'systemEvent', text: message }
      : { kind: 'agentTurn', message };

    const delivery = { mode: 'announce', channel, to };

    const params: Record<string, unknown> = {
      name,
      schedule: normalizedSchedule,
      payload,
      delivery,
      sessionTarget,
    };

    if (agentId) params.agentId = agentId;

    const result = await gatewayManager.rpc('cron.add', params);
    res.json(result ?? { success: true });
  } catch (error) {
    logger.error('cron.add error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/cron/jobs/:id
router.patch('/jobs/:id', async (req, res) => {
  try {
    if (!gatewayManager.isConnected()) {
      return res.status(502).json({ error: 'Gateway not connected' });
    }

    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    // Whitelist allowed patch fields
    const allowed = ['name', 'message', 'schedule', 'enabled', 'payload', 'delivery', 'agentId', 'sessionTarget'];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    const result = await gatewayManager.rpc('cron.update', { id, patch });
    res.json(result ?? { success: true });
  } catch (error) {
    logger.error('cron.update error:', error);
    res.status(500).json({ error: 'Failed to update cron job' });
  }
});

// DELETE /api/cron/jobs/:id
router.delete('/jobs/:id', async (req, res) => {
  try {
    if (!gatewayManager.isConnected()) {
      return res.status(502).json({ error: 'Gateway not connected' });
    }

    const { id } = req.params;
    const result = await gatewayManager.rpc('cron.remove', { id });
    res.json(result ?? { success: true });
  } catch (error) {
    logger.error('cron.remove error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cron/jobs/:id/run
router.post('/jobs/:id/run', async (req, res) => {
  try {
    if (!gatewayManager.isConnected()) {
      return res.status(502).json({ error: 'Gateway not connected' });
    }

    const { id } = req.params;
    const result = await gatewayManager.rpc('cron.run', { id, mode: 'force' });
    res.json(result ?? { success: true });
  } catch (error) {
    logger.error('cron.run error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cron/jobs/:id/runs
router.get('/jobs/:id/runs', async (req, res) => {
  try {
    if (!gatewayManager.isConnected()) {
      return res.status(502).json({ error: 'Gateway not connected' });
    }

    const { id } = req.params;
    try {
      const result = await gatewayManager.rpc('cron.runs', { id });
      res.json({ runs: result?.runs ?? result ?? [] });
    } catch (rpcError) {
      logger.warn('cron.runs RPC failed, returning empty', { id, error: rpcError });
      res.json({ runs: [] });
    }
  } catch (error) {
    logger.error('cron.runs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
