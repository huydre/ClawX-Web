import { Router } from 'express';
import { z } from 'zod';
import { getAllProviders, getProvider, saveProvider, deleteProvider, setDefaultProvider, getDefaultProvider, getApiKey, } from '../services/storage.js';
import { logger } from '../utils/logger.js';
import { saveProviderKeyToOpenClaw, removeProviderKeyFromOpenClaw, setOpenClawDefaultModel, getProviderKeyFromOpenClaw, getProviderKeyFromEnv, getProviderConfigFromOpenClaw, getOAuthTokenFromOpenClaw, } from '../utils/openclaw-sync.js';
const router = Router();
// GET /api/providers
router.get('/', async (_req, res) => {
    try {
        const providers = await getAllProviders();
        // Include hasKey and keyMasked for each provider
        // Fallback to OpenClaw auth-profiles if ClawX db doesn't have the key
        const providersWithKeyInfo = await Promise.all(providers.map(async (p) => {
            const key = await getApiKey(p.id)
                ?? getProviderKeyFromOpenClaw(p.type)
                ?? getProviderKeyFromEnv(p.type);
            const openClawConfig = getProviderConfigFromOpenClaw(p.type);
            return {
                ...p,
                // Merge baseUrl from OpenClaw if not set in ClawX
                baseUrl: p.baseUrl || openClawConfig?.baseUrl || undefined,
                hasKey: !!key,
                keyMasked: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : null,
            };
        }));
        res.json(providersWithKeyInfo);
    }
    catch (error) {
        logger.error('Get providers error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// GET /api/providers/models/:type - Fetch models from provider API
router.get('/models/:type', async (req, res) => {
    try {
        const providerType = req.params.type;
        const baseUrl = req.query.baseUrl;
        const queryApiKey = req.query.apiKey;
        const models = [];
        // Try to get API key: query param > saved > OpenClaw > env
        const providers = await getAllProviders();
        const provider = providers.find((p) => p.type === providerType);
        const apiKey = queryApiKey
            || (provider ? await getApiKey(provider.id) : null)
            || getProviderKeyFromOpenClaw(providerType)
            || getProviderKeyFromEnv(providerType);
        const openClawCfg = getProviderConfigFromOpenClaw(providerType);
        if (providerType === 'ollama') {
            // Ollama uses /api/tags
            const ollamaUrl = baseUrl || provider?.baseUrl || openClawCfg?.baseUrl || 'http://localhost:11434';
            try {
                const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.models) {
                        for (const m of data.models) {
                            models.push({ id: m.name || m.model, name: m.name || m.model });
                        }
                    }
                }
            }
            catch { /* Ollama not running */ }
        }
        else if (providerType === 'anthropic' && apiKey) {
            // Anthropic uses x-api-key header
            try {
                const resp = await fetch('https://api.anthropic.com/v1/models', {
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    signal: AbortSignal.timeout(8000),
                });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.data) {
                        for (const m of data.data) {
                            models.push({ id: m.id, name: m.display_name || m.id });
                        }
                        models.sort((a, b) => a.name.localeCompare(b.name));
                    }
                }
            }
            catch { /* API not reachable */ }
        }
        else if (providerType === 'google' && apiKey) {
            // Google Gemini uses generativelanguage API with key as query param
            try {
                const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
                    signal: AbortSignal.timeout(8000),
                });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.models) {
                        for (const m of data.models) {
                            // Only include models that support generateContent
                            if (m.supportedGenerationMethods?.includes('generateContent')) {
                                const id = m.name.replace('models/', '');
                                models.push({ id, name: m.displayName || id });
                            }
                        }
                        models.sort((a, b) => a.name.localeCompare(b.name));
                    }
                }
            }
            catch { /* API not reachable */ }
        }
        else if (providerType === 'codex') {
            // Codex: try OpenAI API first, then OpenClaw config, then hardcoded fallback
            let fetched = false;
            // 1. Try OpenAI /v1/models with OAuth token
            const oauthToken = getOAuthTokenFromOpenClaw('openai-codex');
            if (oauthToken?.access) {
                try {
                    const resp = await fetch('https://api.openai.com/v1/models', {
                        headers: { Authorization: `Bearer ${oauthToken.access}` },
                        signal: AbortSignal.timeout(8000),
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data.data && data.data.length > 0) {
                            for (const m of data.data) {
                                models.push({ id: m.id, name: m.id });
                            }
                            models.sort((a, b) => a.id.localeCompare(b.id));
                            fetched = true;
                        }
                    }
                }
                catch { /* API not reachable */ }
            }
            // 2. Fallback: read from OpenClaw config (strip cx/ prefix)
            if (!fetched) {
                const codexCfg = getProviderConfigFromOpenClaw('openai-codex');
                if (codexCfg?.models && codexCfg.models.length > 0) {
                    for (const m of codexCfg.models) {
                        const id = m.id.replace(/^cx\//, '');
                        models.push({ id, name: m.name?.replace(/^cx\//, '') || id });
                    }
                    fetched = true;
                }
            }
            // 3. Hardcoded fallback (no prefix)
            if (!fetched) {
                const fallback = [
                    'codex-mini-latest', 'codex-mini', 'gpt-5.4',
                    'gpt-5.3-codex', 'gpt-5.3-codex-xhigh', 'gpt-5.3-codex-high',
                    'gpt-5.3-codex-low', 'gpt-5.3-codex-none', 'gpt-5.3-codex-spark',
                    'gpt-5.2-codex', 'gpt-5.2', 'gpt-5.1-codex-mini', 'gpt-5.1-codex-mini-high',
                    'gpt-5.1-codex-max', 'gpt-5.1-codex', 'gpt-5.1',
                    'gpt-5-codex', 'gpt-5-codex-mini',
                ];
                for (const id of fallback) {
                    models.push({ id, name: id });
                }
            }
        }
        else if (apiKey) {
            // OpenAI-compatible /v1/models (OpenAI, OpenRouter, Moonshot, 9Router, etc.)
            const providerBaseUrl = baseUrl || provider?.baseUrl || openClawCfg?.baseUrl || getDefaultBaseUrl(providerType);
            if (providerBaseUrl) {
                try {
                    const resp = await fetch(`${providerBaseUrl}/models`, {
                        headers: { Authorization: `Bearer ${apiKey}` },
                        signal: AbortSignal.timeout(8000),
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data.data) {
                            for (const m of data.data) {
                                models.push({ id: m.id, name: m.id });
                            }
                            models.sort((a, b) => a.id.localeCompare(b.id));
                        }
                    }
                }
                catch { /* API not reachable */ }
            }
        }
        res.json({ models });
    }
    catch (error) {
        logger.error('Fetch models error:', error);
        res.json({ models: [] });
    }
});
function getDefaultBaseUrl(type) {
    const map = {
        openai: 'https://api.openai.com/v1',
        openrouter: 'https://openrouter.ai/api/v1',
        moonshot: 'https://api.moonshot.ai/v1',
        anthropic: 'https://api.anthropic.com/v1',
    };
    return map[type];
}
// GET /api/providers/default - Must come before /:id route
router.get('/default', async (_req, res) => {
    try {
        const defaultId = await getDefaultProvider();
        if (!defaultId) {
            return res.json({ id: null });
        }
        res.json({ id: defaultId });
    }
    catch (error) {
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
    }
    catch (error) {
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
        // Always sync model config to OpenClaw for this provider
        if (config.model) {
            setOpenClawDefaultModel(config.type, config.model, config.baseUrl ? { baseUrl: config.baseUrl } : undefined);
        }
        // If this is the default provider, also update agents.defaults.model
        const defaultId = await getDefaultProvider();
        if (defaultId === config.id && config.model) {
            setOpenClawDefaultModel(config.type, config.model, config.baseUrl ? { baseUrl: config.baseUrl } : undefined);
        }
        logger.info('Provider saved', { id: config.id });
        res.json({ success: true });
    }
    catch (error) {
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
    }
    catch (error) {
        logger.error('Delete provider error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/providers/import-from-openclaw
// Scans ALL providers in ~/.openclaw config and imports them into ClawX db
router.post('/import-from-openclaw', async (_req, res) => {
    try {
        const { existsSync, readFileSync } = await import('fs');
        const { join } = await import('path');
        const { homedir } = await import('os');
        const configPath = join(homedir(), '.openclaw', 'openclaw.json');
        if (!existsSync(configPath)) {
            return res.status(404).json({ success: false, error: 'OpenClaw config not found' });
        }
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        // 1. Read default model to know which provider is active
        const agents = config.agents;
        const defaults = agents?.defaults;
        const modelConfig = defaults?.model;
        const modelStr = typeof modelConfig === 'string' ? modelConfig : modelConfig?.primary ?? null;
        let defaultProvider = null;
        let defaultModelId = null;
        if (modelStr) {
            const slashIdx = modelStr.indexOf('/');
            defaultProvider = slashIdx !== -1 ? modelStr.slice(0, slashIdx) : modelStr;
            defaultModelId = slashIdx !== -1 ? modelStr.slice(slashIdx + 1) : modelStr;
        }
        // 2. Read auth-profiles for API keys
        const authPath = join(homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json');
        let authProfiles = {};
        if (existsSync(authPath)) {
            try {
                const authData = JSON.parse(readFileSync(authPath, 'utf-8'));
                authProfiles = authData.profiles || {};
            }
            catch { /* ignore */ }
        }
        // 3. Scan models.providers.* for all configured providers
        const modelsSection = config.models;
        const providersConfig = modelsSection?.providers;
        const imported = [];
        const providerTypes = new Set();
        // Add default provider first
        if (defaultProvider) {
            providerTypes.add(defaultProvider);
        }
        // Add all providers from models.providers
        if (providersConfig) {
            for (const type of Object.keys(providersConfig)) {
                providerTypes.add(type);
            }
        }
        // Also scan auth-profiles for providers that have keys but no config
        for (const profileId of Object.keys(authProfiles)) {
            const colonIdx = profileId.indexOf(':');
            if (colonIdx > 0) {
                providerTypes.add(profileId.slice(0, colonIdx));
            }
        }
        let firstWithKey = null;
        for (const providerType of providerTypes) {
            const existing = await getProvider(providerType);
            if (existing)
                continue; // Already in ClawX DB
            const provCfg = providersConfig?.[providerType];
            const baseUrl = provCfg?.baseUrl;
            let modelId;
            // Get model: from default if matching, or from provider config
            if (providerType === defaultProvider && defaultModelId) {
                modelId = defaultModelId;
            }
            else if (provCfg?.models && Array.isArray(provCfg.models) && provCfg.models.length > 0) {
                modelId = provCfg.models[0].id;
            }
            // Get API key from auth-profiles
            const profile = authProfiles[`${providerType}:default`];
            const apiKey = profile?.key || undefined;
            // Determine display name
            const displayName = providerType.charAt(0).toUpperCase() + providerType.slice(1);
            await saveProvider({
                id: providerType,
                name: displayName,
                type: providerType,
                baseUrl,
                model: modelId,
                enabled: true,
            }, apiKey);
            if (apiKey && !firstWithKey) {
                firstWithKey = providerType;
            }
            imported.push({ provider: providerType, model: modelId, hasKey: !!apiKey });
        }
        // Auto-set default: prefer the current OpenClaw default, then first with key
        const currentDefault = await getDefaultProvider();
        if (!currentDefault) {
            const bestDefault = defaultProvider || firstWithKey || (imported.length > 0 ? imported[0].provider : null);
            if (bestDefault) {
                await setDefaultProvider(bestDefault);
            }
        }
        logger.info('Imported providers from OpenClaw', { count: imported.length, providers: imported.map(i => i.provider) });
        res.json({ success: true, imported, count: imported.length });
    }
    catch (error) {
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
            setOpenClawDefaultModel(provider.type, provider.model, provider.baseUrl ? { baseUrl: provider.baseUrl } : undefined);
        }
        logger.info('Default provider set', { id });
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Set default provider error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
export default router;
