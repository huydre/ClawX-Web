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

interface AuthProfileApiKey {
  type: 'api_key';
  provider: string;
  key: string;
}

interface AuthProfileOAuth {
  type: 'oauth';
  provider: string;
  access: string;
  refresh: string;
  expires: number; // Unix timestamp in ms
  savedAt?: number; // Unix timestamp when token was saved
  accountId?: string;
}

type AuthProfileEntry = AuthProfileApiKey | AuthProfileOAuth;

interface AuthProfilesStore {
  version: number;
  profiles: Record<string, AuthProfileEntry>;
  order?: Record<string, string[]>;
  lastGood?: Record<string, string>;
}

interface ProviderModelEntry {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface ProviderBackendMeta {
  envVar?: string;
  defaultModel?: string;
  /** OpenClaw provider ID if different from ClawX type (e.g. 'codex' → 'openai-codex') */
  openclawId?: string;
  providerConfig?: {
    baseUrl: string;
    api: string;
    apiKeyEnv: string;
    models?: ProviderModelEntry[];
  };
}

const REGISTRY: Record<string, ProviderBackendMeta> = {
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
    openclawId: 'kimi-coding',
    envVar: 'MOONSHOT_API_KEY',
    defaultModel: 'kimi-coding/kimi-for-coding',
    providerConfig: {
      baseUrl: 'https://api.kimi.com/coding/v1',
      api: 'anthropic',
      apiKeyEnv: 'MOONSHOT_API_KEY',
      models: [
        { id: 'kimi-for-coding', name: 'Kimi For Coding' },
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
    defaultModel: 'openai-codex/gpt-5.4',
    providerConfig: {
      baseUrl: 'https://api.openai.com/v1',
      api: 'openai-responses',
      apiKeyEnv: 'OPENAI_API_KEY',
    },
  },
  // Alias: UI uses 'codex' but OpenClaw uses 'openai-codex'
  codex: {
    openclawId: 'openai-codex',
    defaultModel: 'openai-codex/gpt-5.4',
    providerConfig: {
      baseUrl: 'https://api.openai.com/v1',
      api: 'openai-responses',
      apiKeyEnv: 'OPENAI_API_KEY',
    },
  },
};

function getAuthProfilesPath(agentId = 'main'): string {
  return join(homedir(), '.openclaw', 'agents', agentId, 'agent', 'auth-profiles.json');
}

function readAuthProfiles(agentId = 'main'): AuthProfilesStore {
  const filePath = getAuthProfilesPath(agentId);
  try {
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as AuthProfilesStore;
      if (data.version && data.profiles && typeof data.profiles === 'object') {
        return data;
      }
    }
  } catch (err) {
    logger.warn('Failed to read auth-profiles.json, creating fresh store', { err });
  }
  return { version: AUTH_STORE_VERSION, profiles: {} };
}

function writeAuthProfiles(store: AuthProfilesStore, agentId = 'main'): void {
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
export function getProviderKeyFromOpenClaw(provider: string): string | null {
  try {
    const filePath = getAuthProfilesPath();
    if (!existsSync(filePath)) return null;
    const store = JSON.parse(readFileSync(filePath, 'utf-8')) as AuthProfilesStore;
    if (!store.profiles) return null;

    // Resolve openclawId if available (e.g., moonshot → kimi-coding)
    const meta = REGISTRY[provider];
    const openclawProvider = meta?.openclawId || provider;

    // Exact match: "kimi-coding:default" or "openrouter:default"
    const profile = store.profiles[`${openclawProvider}:default`];
    if (profile) {
      if (profile.type === 'api_key') return profile.key;
      if (profile.type === 'oauth') return profile.access;
    }

    // Prefix match: any profile starting with "kimi-coding:"
    const prefixMatch = Object.entries(store.profiles).find(
      ([id]) => id.startsWith(`${openclawProvider}:`)
    );
    if (prefixMatch) {
      const p = prefixMatch[1];
      if (p.type === 'api_key') return p.key;
      if (p.type === 'oauth') return p.access;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a provider has a key configured via environment variables.
 * OpenClaw reads env vars like OPENROUTER_API_KEY, ANTHROPIC_API_KEY, etc.
 */
export function getProviderKeyFromEnv(providerType: string): string | null {
  const envMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GEMINI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    moonshot: 'MOONSHOT_API_KEY',
    '9router': 'NINEROUTER_API_KEY',
  };
  const envVar = envMap[providerType];
  if (!envVar) return null;
  return process.env[envVar] ?? null;
}

/**
 * Read provider config (baseUrl, models) from OpenClaw's openclaw.json
 * Path: models.providers.<providerType>
 */
export function getProviderConfigFromOpenClaw(providerType: string): {
  baseUrl?: string;
  models?: { id: string; name: string }[];
  apiKey?: string;
} | null {
  try {
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    if (!existsSync(configPath)) return null;
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const modelsSection = config.models as Record<string, unknown> | undefined;
    const providers = modelsSection?.providers as Record<string, unknown> | undefined;
    const providerData = providers?.[providerType] as Record<string, unknown> | undefined;
    if (!providerData) return null;

    return {
      baseUrl: typeof providerData.baseUrl === 'string' ? providerData.baseUrl : undefined,
      models: Array.isArray(providerData.models)
        ? (providerData.models as { id: string; name: string }[]).map((m) => ({ id: m.id, name: m.name || m.id }))
        : undefined,
      apiKey: typeof providerData.apiKey === 'string' && !providerData.apiKey.startsWith('${')
        ? providerData.apiKey
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Save a provider API key to OpenClaw's auth-profiles.json
 */
export function saveProviderKeyToOpenClaw(provider: string, apiKey: string): void {
  try {
    const meta = REGISTRY[provider];
    const openclawProvider = meta?.openclawId || provider;
    const store = readAuthProfiles();
    const profileId = `${openclawProvider}:default`;

    store.profiles[profileId] = { type: 'api_key', provider: openclawProvider, key: apiKey };

    if (!store.order) store.order = {};
    if (!store.order[openclawProvider]) store.order[openclawProvider] = [];
    if (!store.order[openclawProvider].includes(profileId)) {
      store.order[openclawProvider].push(profileId);
    }

    if (!store.lastGood) store.lastGood = {};
    store.lastGood[openclawProvider] = profileId;

    writeAuthProfiles(store);
    logger.info('Synced API key to OpenClaw', { provider, openclawProvider });
  } catch (err) {
    logger.warn('Failed to sync API key to OpenClaw', { provider, err });
  }
}

/**
 * Remove a provider API key from OpenClaw's auth-profiles.json
 */
export function removeProviderKeyFromOpenClaw(provider: string): void {
  try {
    const meta = REGISTRY[provider];
    const openclawProvider = meta?.openclawId || provider;
    const store = readAuthProfiles();
    const profileId = `${openclawProvider}:default`;

    delete store.profiles[profileId];
    if (store.order?.[openclawProvider]) {
      store.order[openclawProvider] = store.order[openclawProvider].filter((id) => id !== profileId);
      if (store.order[openclawProvider].length === 0) delete store.order[openclawProvider];
    }
    if (store.lastGood?.[openclawProvider] === profileId) {
      delete store.lastGood[openclawProvider];
    }

    writeAuthProfiles(store);
    logger.info('Removed API key from OpenClaw', { provider });
  } catch (err) {
    logger.warn('Failed to remove API key from OpenClaw', { provider, err });
  }
}

/**
 * Set the default model in OpenClaw config (~/.openclaw/openclaw.json)
 */
export function setOpenClawDefaultModel(
  provider: string,
  modelOverride?: string,
  runtimeOverride?: { baseUrl?: string; api?: string }
): void {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json');

  let config: Record<string, unknown> = {};
  try {
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
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
  const agents = (config.agents || {}) as Record<string, unknown>;
  const defaults = (agents.defaults || {}) as Record<string, unknown>;
  defaults.model = { primary: model };
  agents.defaults = defaults;
  config.agents = agents;

  const providerCfg = runtimeOverride?.baseUrl
    ? { baseUrl: runtimeOverride.baseUrl, api: runtimeOverride.api || 'openai-completions', apiKeyEnv: meta?.envVar || `${provider.toUpperCase()}_API_KEY` }
    : meta?.providerConfig;

  if (providerCfg) {
    const models = (config.models || {}) as Record<string, unknown>;
    const providers = (models.providers || {}) as Record<string, unknown>;
    const existingProvider = (providers[openclawProvider] && typeof providers[openclawProvider] === 'object')
      ? (providers[openclawProvider] as Record<string, unknown>)
      : {};

    const existingModels = Array.isArray(existingProvider.models)
      ? (existingProvider.models as Array<Record<string, unknown>>)
      : [];
    const registryModels = (meta?.providerConfig?.models ?? []).map((m) => ({ ...m }));
    const mergedModels = [...registryModels];
    for (const item of existingModels) {
      if (item.id && !mergedModels.some((m) => m.id === item.id)) {
        mergedModels.push(item as ProviderModelEntry);
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
  } else {
    // Built-in provider: remove stale override if any
    const models = (config.models || {}) as Record<string, unknown>;
    const providers = (models.providers || {}) as Record<string, unknown>;
    if (providers[openclawProvider]) {
      delete providers[openclawProvider];
      models.providers = providers;
      config.models = models;
    }
  }

  const gateway = (config.gateway || {}) as Record<string, unknown>;
  if (!gateway.mode) gateway.mode = 'local';
  config.gateway = gateway;

  const dir = join(configPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  logger.info('Synced default model to OpenClaw', { provider, model });
}

/**
 * Save OAuth tokens (access, refresh, expires) to OpenClaw auth-profiles.json
 * Supports multi-account: uses email as profile key if provided.
 */
export function saveOAuthTokenToOpenClaw(
  provider: string,
  tokens: { access: string; refresh: string; expires: number; accountId?: string; email?: string }
): void {
  try {
    const store = readAuthProfiles();
    const profileId = `${provider}:${tokens.email || 'default'}`;

    store.profiles[profileId] = {
      type: 'oauth',
      provider,
      access: tokens.access,
      refresh: tokens.refresh,
      expires: tokens.expires,
      savedAt: Date.now(),
      accountId: tokens.accountId,
    };

    if (!store.order) store.order = {};
    if (!store.order[provider]) store.order[provider] = [];
    if (!store.order[provider].includes(profileId)) {
      store.order[provider].push(profileId);
    }

    if (!store.lastGood) store.lastGood = {};
    store.lastGood[provider] = profileId;

    writeAuthProfiles(store);
    logger.info('Saved OAuth token to OpenClaw', { provider, profileId });
  } catch (err) {
    logger.warn('Failed to save OAuth token to OpenClaw', { provider, err });
  }
}

/**
 * Read OAuth tokens from OpenClaw auth-profiles.json
 * Tries exact default first, then any profile matching the provider.
 */
export function getOAuthTokenFromOpenClaw(provider: string): {
  access: string;
  refresh: string;
  expires: number;
  savedAt?: number;
  accountId?: string;
} | null {
  try {
    const store = readAuthProfiles();
    // Try default first
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
    // Fallback: any profile matching provider
    const match = Object.entries(store.profiles).find(
      ([id, p]) => id.startsWith(`${provider}:`) && p.type === 'oauth'
    );
    if (match) {
      const p = match[1] as AuthProfileOAuth;
      return { access: p.access, refresh: p.refresh, expires: p.expires, savedAt: p.savedAt, accountId: p.accountId };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * List all OAuth profiles for a provider.
 */
export function listOAuthProfiles(provider: string): Array<{
  profileId: string;
  email: string;
  expires: number;
  savedAt?: number;
  accountId?: string;
  isExpired: boolean;
}> {
  try {
    const store = readAuthProfiles();
    const results: Array<{
      profileId: string;
      email: string;
      expires: number;
      savedAt?: number;
      accountId?: string;
      isExpired: boolean;
    }> = [];

    for (const [id, profile] of Object.entries(store.profiles)) {
      if (id.startsWith(`${provider}:`) && profile.type === 'oauth') {
        const email = id.replace(`${provider}:`, '');
        results.push({
          profileId: id,
          email,
          expires: profile.expires,
          savedAt: profile.savedAt,
          accountId: profile.accountId,
          isExpired: profile.expires < Date.now(),
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Remove a specific OAuth profile.
 */
export function removeOAuthProfile(provider: string, profileId: string): boolean {
  try {
    const store = readAuthProfiles();
    if (!store.profiles[profileId]) return false;

    delete store.profiles[profileId];

    // Clean up order
    if (store.order?.[provider]) {
      store.order[provider] = store.order[provider].filter(id => id !== profileId);
    }

    // Clean up lastGood
    if (store.lastGood?.[provider] === profileId) {
      const remaining = store.order?.[provider]?.[0];
      if (remaining) {
        store.lastGood[provider] = remaining;
      } else {
        delete store.lastGood[provider];
      }
    }

    writeAuthProfiles(store);
    logger.info('Removed OAuth profile', { provider, profileId });
    return true;
  } catch (err) {
    logger.warn('Failed to remove OAuth profile', { provider, profileId, err });
    return false;
  }
}
