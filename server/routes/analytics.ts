import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  getDailyStats,
  getHourlyActivity,
  getTotalStats,
  getRecentEvents,
} from '../services/analytics.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

const router = Router();

// GET /api/analytics/daily?days=7
router.get('/daily', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(String(req.query.days)) || 7, 1), 365);
    const stats = await getDailyStats(days);
    res.json(stats);
  } catch (error) {
    logger.error('Analytics daily stats error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/analytics/hourly
router.get('/hourly', async (_req, res) => {
  try {
    const activity = await getHourlyActivity();
    res.json(activity);
  } catch (error) {
    logger.error('Analytics hourly activity error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/analytics/totals
router.get('/totals', async (_req, res) => {
  try {
    const totals = await getTotalStats();
    res.json(totals);
  } catch (error) {
    logger.error('Analytics totals error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/analytics/token-stats?days=7
router.get('/token-stats', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(String(req.query.days)) || 7, 1), 365);

    const { stdout } = await execAsync(`openclaw gateway usage-cost --days ${days} --json`, { timeout: 15000 });
    const raw = JSON.parse(stdout.trim());

    // Transform to frontend format
    const daily = (raw.daily || []).map((d: any) => ({
      date: d.date,
      inputTokens: d.input || 0,
      outputTokens: d.output || 0,
      cacheReadTokens: d.cacheRead || 0,
      estimatedCost: d.totalCost || 0,
      requests: 0,
    }));

    const totals = {
      inputTokens: raw.totals?.input || 0,
      outputTokens: raw.totals?.output || 0,
      cacheReadTokens: raw.totals?.cacheRead || 0,
      estimatedCost: raw.totals?.totalCost || 0,
      requests: 0,
    };

    res.json({ daily, byProvider: {}, totals });
  } catch (error) {
    logger.error('Analytics token stats error:', error);
    res.json({ daily: [], byProvider: {}, totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, estimatedCost: 0, requests: 0 } });
  }
});

// GET /api/analytics/recent?limit=20
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 500);
    const events = await getRecentEvents(limit);
    res.json(events);
  } catch (error) {
    logger.error('Analytics recent events error:', error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
