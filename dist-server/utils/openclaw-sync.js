/**
 * OpenClaw Sync Utility (Server-side)
 * Syncs provider API keys and model config to ~/.openclaw/
 * so the OpenClaw Gateway can use them for AI provider calls.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from './logger.js';
const AUTH_STORE_VERSION = 1;
const REGISTRY = {
    anthropic: {
        envVar: 'ANTHROPIC_API_KEY',
        defaultModel: 'anthropic/claude-opus-4-6',
    },
    openai: {
        envVar: 'OPENAI_API_KEY',
        defaultModel: 'openai/gpt-5.2',
        providerConfig: {
            baseUrl: 'https://api.openai.com/v1',
            api: 'openai-responses',
            apiKeyEnv: 'OPENAI_API_KEY',
        },
    },
    google: {
        envVar: 'GEMINI_API_KEY',
        defaultModel: 'google/gemini-3-pro-preview',
    },
    openrouter: {
        envVar: 'OPENROUTER_API_KEY',
        defaultModel: 'openrouter/anthropic/claude-opus-4.6',
        providerConfig: {
            baseUrl: 'https://openrouter.ai/api/v1',
            api: 'openai-completions',
            apiKeyEnv: 'OPENROUTER_API_KEY',
        },
    },
    moonshot: {
        envVar: 'MOONSHOT_API_KEY',
        defaultModel: 'moonshot/kimi-k2.5',
        providerConfig: {
            baseUrl: 'https://api.moonshot.ai/v1',
            api: 'openai-completions',
            apiKeyEnv: 'MOONSHOT_API_KEY',
            models: [
                { id: 'kimi-k2.5', name: 'Kimi K2.5' },
            ],
        },
    },
    '9router': {
        envVar: 'NINEROUTER_API_KEY',
        defaultModel: '9router/cc/claude-opus-4-6',
        providerConfig: {
            baseUrl: 'http://localhost:20128/v1',
            api: 'openai-completions',
            apiKeyEnv: 'NINEROUTER_API_KEY',
        },
    },
    'openai-codex': {
        defaultModel: 'openai-codex/codex-mini-latest',
        providerConfig: {
            baseUrl: 'https://api.openai.com/v1',
            api: 'openai-responses',
            apiKeyEnv: 'OPENAI_API_KEY',
        },
    },
    // Alias: UI uses 'codex' but OpenClaw uses 'openai-codex'
    codex: {
        openclawId: 'openai-codex',
        defaultModel: 'openai-codex/codex-mini-latest',
        providerConfig: {
            baseUrl: 'https://api.openai.com/v1',
            api: 'openai-responses',
            apiKeyEnv: 'OPENAI_API_KEY',
        },
    },
};
function getAuthProfilesPath(agentId = 'main') {
    return join(homedir(), '.openclaw', 'agents', agentId, 'agent', 'auth-profiles.json');
}
function readAuthProfiles(agentId = 'main') {
    const filePath = getAuthProfilesPath(agentId);
    try {
        if (existsSync(filePath)) {
            const data = JSON.parse(readFileSync(filePath, 'utf-8'));
            if (data.version && data.profiles && typeof data.profiles === 'object') {
                return data;
            }
        }
    }
    catch (err) {
        logger.warn('Failed to read auth-profiles.json, creating fresh store', { err });
    }
    return { version: AUTH_STORE_VERSION, profiles: {} };
}
function writeAuthProfiles(store, agentId = 'main') {
    const filePath = getAuthProfilesPath(agentId);
    const dir = join(filePath, '..');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
}
/**
 * Read a provider API key from OpenClaw's auth-profiles.json.
 * Tries exact match first, then any profile with matching provider prefix.
 */
export function getProviderKeyFromOpenClaw(provider) {
    try {
        const filePath = getAuthProfilesPath();
        if (!existsSync(filePath))
            return null;
        const store = JSON.parse(readFileSync(filePath, 'utf-8'));
        if (!store.profiles)
            return null;
        // Exact match: "openrouter:default"
        const profile = store.profiles[`${provider}:default`];
        if (profile) {
            if (profile.type === 'api_key')
                return profile.key;
            if (profile.type === 'oauth')
                return profile.access;
        }
        // Prefix match: any profile starting with "openrouter:"
        const prefixMatch = Object.entries(store.profiles).find(([id]) => id.startsWith(`${provider}:`));
        if (prefixMatch) {
            const p = prefixMatch[1];
            if (p.type === 'api_key')
                return p.key;
            if (p.type === 'oauth')
                return p.access;
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Check if a provider has a key configured via environment variables.
 * OpenClaw reads env vars like OPENROUTER_API_KEY, ANTHROPIC_API_KEY, etc.
 */
export function getProviderKeyFromEnv(providerType) {
    const envMap = {
        anthropic: 'ANTHROPIC_API_KEY',
        openai: 'OPENAI_API_KEY',
        google: 'GEMINI_API_KEY',
        openrouter: 'OPENROUTER_API_KEY',
        moonshot: 'MOONSHOT_API_KEY',
        '9router': 'NINEROUTER_API_KEY',
    };
    const envVar = envMap[providerType];
    if (!envVar)
        return null;
    return process.env[envVar] ?? null;
}
/**
 * Read provider config (baseUrl, models) from OpenClaw's openclaw.json
 * Path: models.providers.<providerType>
 */
export function getProviderConfigFromOpenClaw(providerType) {
    try {
        const configPath = join(homedir(), '.openclaw', 'openclaw.json');
        if (!existsSync(configPath))
            return null;
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        const modelsSection = config.models;
        const providers = modelsSection?.providers;
        const providerData = providers?.[providerType];
        if (!providerData)
            return null;
        return {
            baseUrl: typeof providerData.baseUrl === 'string' ? providerData.baseUrl : undefined,
            models: Array.isArray(providerData.models)
                ? providerData.models.map((m) => ({ id: m.id, name: m.name || m.id }))
                : undefined,
            apiKey: typeof providerData.apiKey === 'string' && !providerData.apiKey.startsWith('${')
                ? providerData.apiKey
                : undefined,
        };
    }
    catch {
        return null;
    }
}
/**
 * Save a provider API key to OpenClaw's auth-profiles.json
 */
export function saveProviderKeyToOpenClaw(provider, apiKey) {
    try {
        const store = readAuthProfiles();
        const profileId = `${provider}:default`;
        store.profiles[profileId] = { type: 'api_key', provider, key: apiKey };
        if (!store.order)
            store.order = {};
        if (!store.order[provider])
            store.order[provider] = [];
        if (!store.order[provider].includes(profileId)) {
            store.order[provider].push(profileId);
        }
        if (!store.lastGood)
            store.lastGood = {};
        store.lastGood[provider] = profileId;
        writeAuthProfiles(store);
        logger.info('Synced API key to OpenClaw', { provider });
    }
    catch (err) {
        logger.warn('Failed to sync API key to OpenClaw', { provider, err });
    }
}
/**
 * Remove a provider API key from OpenClaw's auth-profiles.json
 */
export function removeProviderKeyFromOpenClaw(provider) {
    try {
        const store = readAuthProfiles();
        const profileId = `${provider}:default`;
        delete store.profiles[profileId];
        if (store.order?.[provider]) {
            store.order[provider] = store.order[provider].filter((id) => id !== profileId);
            if (store.order[provider].length === 0)
                delete store.order[provider];
        }
        if (store.lastGood?.[provider] === profileId) {
            delete store.lastGood[provider];
        }
        writeAuthProfiles(store);
        logger.info('Removed API key from OpenClaw', { provider });
    }
    catch (err) {
        logger.warn('Failed to remove API key from OpenClaw', { provider, err });
    }
}
/**
 * Set the default model in OpenClaw config (~/.openclaw/openclaw.json)
 */
export function setOpenClawDefaultModel(provider, modelOverride, runtimeOverride) {
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    let config = {};
    try {
        if (existsSync(configPath)) {
            config = JSON.parse(readFileSync(configPath, 'utf-8'));
        }
    }
    catch (err) {
        logger.warn('Failed to read openclaw.json, creating fresh config', { err });
    }
    const meta = REGISTRY[provider];
    const rawModel = modelOverride || meta?.defaultModel;
    if (!rawModel) {
        logger.warn('No default model for provider', { provider });
        return;
    }
    // Use openclawId if provider name differs between ClawX and OpenClaw
    const openclawProvider = meta?.openclawId || provider;
    // Ensure model string is in "provider/modelId" format for openclaw config
    const model = rawModel.startsWith(`${openclawProvider}/`) ? rawModel : `${openclawProvider}/${rawModel}`;
    const modelId = model.slice(openclawProvider.length + 1);
    // Set agents.defaults.model
    const agents = (config.agents || {});
    const defaults = (agents.defaults || {});
    defaults.model = { primary: model };
    agents.defaults = defaults;
    config.agents = agents;
    const providerCfg = runtimeOverride?.baseUrl
        ? { baseUrl: runtimeOverride.baseUrl, api: runtimeOverride.api || 'openai-completions', apiKeyEnv: meta?.envVar || `${provider.toUpperCase()}_API_KEY` }
        : meta?.providerConfig;
    if (providerCfg) {
        const models = (config.models || {});
        const providers = (models.providers || {});
        const existingProvider = (providers[openclawProvider] && typeof providers[openclawProvider] === 'object')
            ? providers[openclawProvider]
            : {};
        const existingModels = Array.isArray(existingProvider.models)
            ? existingProvider.models
            : [];
        const registryModels = (meta?.providerConfig?.models ?? []).map((m) => ({ ...m }));
        const mergedModels = [...registryModels];
        for (const item of existingModels) {
            if (item.id && !mergedModels.some((m) => m.id === item.id)) {
                mergedModels.push(item);
            }
        }
        if (modelId && !mergedModels.some((m) => m.id === modelId)) {
            mergedModels.push({ id: modelId, name: modelId });
        }
        providers[openclawProvider] = {
            ...existingProvider,
            baseUrl: providerCfg.baseUrl,
            api: providerCfg.api,
            // Don't write apiKey here — keys are managed via auth-profiles.json
            // (see saveProviderKeyToOpenClaw). Remove stale env var references.
            ...(existingProvider.apiKey && typeof existingProvider.apiKey === 'string' && !String(existingProvider.apiKey).startsWith('${')
                ? { apiKey: existingProvider.apiKey }
                : {}),
            models: mergedModels,
        };
        models.providers = providers;
        config.models = models;
    }
    else {
        // Built-in provider: remove stale override if any
        const models = (config.models || {});
        const providers = (models.providers || {});
        if (providers[openclawProvider]) {
            delete providers[openclawProvider];
            models.providers = providers;
            config.models = models;
        }
    }
    const gateway = (config.gateway || {});
    if (!gateway.mode)
        gateway.mode = 'local';
    config.gateway = gateway;
    const dir = join(configPath, '..');
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    logger.info('Synced default model to OpenClaw', { provider, model });
}
/**
 * Save OAuth tokens (access, refresh, expires) to OpenClaw auth-profiles.json
 */
export function saveOAuthTokenToOpenClaw(provider, tokens) {
    try {
        const store = readAuthProfiles();
        const profileId = `${provider}:default`;
        store.profiles[profileId] = {
            type: 'oauth',
            provider,
            access: tokens.access,
            refresh: tokens.refresh,
            expires: tokens.expires,
            savedAt: Date.now(),
            accountId: tokens.accountId,
        };
        if (!store.order)
            store.order = {};
        if (!store.order[provider])
            store.order[provider] = [];
        if (!store.order[provider].includes(profileId)) {
            store.order[provider].push(profileId);
        }
        if (!store.lastGood)
            store.lastGood = {};
        store.lastGood[provider] = profileId;
        writeAuthProfiles(store);
        logger.info('Saved OAuth token to OpenClaw', { provider });
    }
    catch (err) {
        logger.warn('Failed to save OAuth token to OpenClaw', { provider, err });
    }
}
/**
 * Read OAuth tokens from OpenClaw auth-profiles.json
 */
export function getOAuthTokenFromOpenClaw(provider) {
    try {
        const store = readAuthProfiles();
        const profile = store.profiles[`${provider}:default`];
        if (profile?.type === 'oauth') {
            return {
                access: profile.access,
                refresh: profile.refresh,
                expires: profile.expires,
                savedAt: profile.savedAt,
                accountId: profile.accountId,
            };
        }
        return null;
    }
    catch {
        return null;
    }
}
