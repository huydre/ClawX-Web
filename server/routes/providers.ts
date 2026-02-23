import { Router } from 'express';
import { z } from 'zod';
import {
  getAllProviders,
  getProvider,
  saveProvider,
  deleteProvider,
  setDefaultProvider,
  getDefaultProvider,
} from '../services/storage.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/providers
router.get('/', async (_req, res) => {
  try {
    const providers = await getAllProviders();
    res.json(providers);
  } catch (error) {
    logger.error('Get providers error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/providers/default - Must come before /:id route
router.get('/default', async (_req, res) => {
  try {
    const defaultId = await getDefaultProvider();
    if (!defaultId) {
      // No default provider set yet - return 200 with null instead of 404
      return res.json({ id: null });
    }
    res.json({ id: defaultId });
  } catch (error) {
    logger.error('Get default provider error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/providers/:id
router.get('/:id', async (req, res) => {
  try {
    const provider = await getProvider(req.params.id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    res.json(provider);
  } catch (error) {
    logger.error('Get provider error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/providers
const saveProviderSchema = z.object({
  config: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    baseUrl: z.string().optional(),
    model: z.string().optional(),
    enabled: z.boolean().default(true),
  }),
  apiKey: z.string().optional(),
});

router.post('/', async (req, res) => {
  try {
    const { config, apiKey } = saveProviderSchema.parse(req.body);
    await saveProvider(config, apiKey);
    logger.info('Provider saved', { id: config.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Save provider error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// DELETE /api/providers/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteProvider(req.params.id);
    logger.info('Provider deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete provider error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/providers/default
router.post('/default', async (req, res) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.body);
    await setDefaultProvider(id);
    logger.info('Default provider set', { id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Set default provider error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
