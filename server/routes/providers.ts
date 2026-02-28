import { Router } from 'express';
import { z } from 'zod';
import {
  getAllProviders,
  getProvider,
  saveProvider,
  deleteProvider,
  setDefaultProvider,
  getDefaultProvider,
  getApiKey,
} from '../services/storage.js';
import { logger } from '../utils/logger.js';
import {
  saveProviderKeyToOpenClaw,
  removeProviderKeyFromOpenClaw,
  setOpenClawDefaultModel,
  getProviderKeyFromOpenClaw,
  getProviderKeyFromEnv,
} from '../utils/openclaw-sync.js';

const router = Router();

// GET /api/providers
router.get('/', async (_req, res) => {
  try {
    const providers = await getAllProviders();

    // Include hasKey and keyMasked for each provider
    // Fallback to OpenClaw auth-profiles if ClawX db doesn't have the key
    const providersWithKeyInfo = await Promise.all(
      providers.map(async (p) => {
        const key = await getApiKey(p.id)
          ?? getProviderKeyFromOpenClaw(p.type)
          ?? getProviderKeyFromEnv(p.type);
        return {
          ...p,
          hasKey: !!key,
          keyMasked: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : null,
        };
      })
    );

    res.json(providersWithKeyInfo);
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
    const key = await getApiKey(req.params.id)
      ?? getProviderKeyFromOpenClaw(provider.type)
      ?? getProviderKeyFromEnv(provider.type);
    res.json({
      ...provider,
      hasKey: !!key,
      keyMasked: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : null,
    });
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

    // Sync API key to OpenClaw if provided
    if (apiKey) {
      saveProviderKeyToOpenClaw(config.type, apiKey);
    }

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
    const provider = await getProvider(req.params.id);
    await deleteProvider(req.params.id);

    // Remove key from OpenClaw
    if (provider) {
      removeProviderKeyFromOpenClaw(provider.type);
    }

    logger.info('Provider deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete provider error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/providers/import-from-openclaw
// Reads ~/.openclaw config and imports detected provider into ClawX db
router.post('/import-from-openclaw', async (_req, res) => {
  try {
    const { existsSync, readFileSync } = await import('fs');
    const { join } = await import('path');
    const { homedir } = await import('os');

    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    if (!existsSync(configPath)) {
      return res.status(404).json({ success: false, error: 'OpenClaw config not found' });
    }

    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const agents = config.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    const modelConfig = defaults?.model as { primary?: string } | string | undefined;
    const modelStr = typeof modelConfig === 'string' ? modelConfig : modelConfig?.primary ?? null;

    if (!modelStr) {
      return res.status(404).json({ success: false, error: 'No model configured in OpenClaw' });
    }

    const slashIdx = modelStr.indexOf('/');
    const provider = slashIdx !== -1 ? modelStr.slice(0, slashIdx) : modelStr;
    const modelId = slashIdx !== -1 ? modelStr.slice(slashIdx + 1) : modelStr;

    // Read API key from auth-profiles if available
    const authPath = join(homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json');
    let apiKey: string | undefined;
    if (existsSync(authPath)) {
      try {
        const authData = JSON.parse(readFileSync(authPath, 'utf-8')) as {
          profiles?: Record<string, { key?: string }>;
        };
        const profile = authData.profiles?.[`${provider}:default`];
        if (profile?.key) apiKey = profile.key;
      } catch { /* ignore */ }
    }

    // Save provider to ClawX db
    const providerId = provider;
    const existing = await getProvider(providerId);
    if (!existing) {
      await saveProvider({
        id: providerId,
        name: provider.charAt(0).toUpperCase() + provider.slice(1),
        type: provider,
        model: modelId,
        enabled: true,
      }, apiKey);

      await setDefaultProvider(providerId);
    }

    logger.info('Imported provider from OpenClaw', { provider, modelId });
    res.json({ success: true, provider, modelId, hasKey: !!apiKey });
  } catch (error) {
    logger.error('Import from OpenClaw error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/providers/default
router.post('/default', async (req, res) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.body);
    await setDefaultProvider(id);

    // Sync default model to OpenClaw
    const provider = await getProvider(id);
    if (provider) {
      setOpenClawDefaultModel(
        provider.type,
        provider.model,
        provider.baseUrl ? { baseUrl: provider.baseUrl } : undefined
      );
    }

    logger.info('Default provider set', { id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Set default provider error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
