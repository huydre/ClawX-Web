import { Router } from 'express';
import {
  getDailyStats,
  getHourlyActivity,
  getTotalStats,
  getRecentEvents,
} from '../services/analytics.js';
import { logger } from '../utils/logger.js';

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
