/**
 * Claw3D Routes — /api/claw3d
 * Manage the Claw3D 3D visualization app lifecycle.
 */
import { Router } from 'express';
import { claw3dManager } from '../services/claw3d-manager.js';
import { getSettings } from '../services/storage.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/claw3d/status
router.get('/status', (_req, res) => {
  res.json(claw3dManager.getStatus());
});

// POST /api/claw3d/setup
router.post('/setup', async (_req, res) => {
  try {
    const settings = await getSettings();
    await claw3dManager.setup(settings.gatewayPort);
    res.json({ success: true });
  } catch (error) {
    logger.error('Claw3D setup error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/claw3d/start
router.post('/start', async (_req, res) => {
  try {
    const settings = await getSettings();
    await claw3dManager.start(settings.gatewayPort);
    res.json({ success: true, url: `http://localhost:${claw3dManager.getStatus().port}` });
  } catch (error) {
    logger.error('Claw3D start error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/claw3d/stop
router.post('/stop', async (_req, res) => {
  try {
    await claw3dManager.stop();
    res.json({ success: true });
  } catch (error) {
    logger.error('Claw3D stop error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/claw3d/restart
router.post('/restart', async (_req, res) => {
  try {
    const settings = await getSettings();
    await claw3dManager.restart(settings.gatewayPort);
    res.json({ success: true });
  } catch (error) {
    logger.error('Claw3D restart error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
