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

interface AuthProfileEntry {
  type: 'api_key';
  provider: string;
  key: string;
}

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
    envVar: 'MOONSHOT_API_KEY',
    defaultModel: 'moonshot/kimi-k2.5',
    providerConfig: {
      baseUrl: 'https://api.moonshot.cn/v1',
      api: 'openai-completions',
      apiKeyEnv: 'MOONSHOT_API_KEY',
      models: [
        { id: 'kimi-k2.5', name: 'Kimi K2.5' },
      ],
    },
  },
  siliconflow: {
    envVar: 'SILICONFLOW_API_KEY',
    defaultModel: 'siliconflow/deepseek-ai/DeepSeek-V3',
    providerConfig: {
      baseUrl: 'https://api.siliconflow.cn/v1',
      api: 'openai-completions',
      apiKeyEnv: 'SILICONFLOW_API_KEY',
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

    // Exact match: "openrouter:default"
    const exact = store.profiles[`${provider}:default`]?.key;
    if (exact) return exact;

    // Prefix match: any profile starting with "openrouter:"
    const prefixMatch = Object.entries(store.profiles).find(
      ([id]) => id.startsWith(`${provider}:`)
    );
    if (prefixMatch) return prefixMatch[1].key ?? null;

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
    siliconflow: 'SILICONFLOW_API_KEY',
    '9router': 'NINEROUTER_API_KEY',
  };
  const envVar = envMap[providerType];
  if (!envVar) return null;
  return process.env[envVar] ?? null;
}

/**
 * Save a provider API key to OpenClaw's auth-profiles.json
 */
export function saveProviderKeyToOpenClaw(provider: string, apiKey: string): void {
  try {
    const store = readAuthProfiles();
    const profileId = `${provider}:default`;

    store.profiles[profileId] = { type: 'api_key', provider, key: apiKey };

    if (!store.order) store.order = {};
    if (!store.order[provider]) store.order[provider] = [];
    if (!store.order[provider].includes(profileId)) {
      store.order[provider].push(profileId);
    }

    if (!store.lastGood) store.lastGood = {};
    store.lastGood[provider] = profileId;

    writeAuthProfiles(store);
    logger.info('Synced API key to OpenClaw', { provider });
  } catch (err) {
    logger.warn('Failed to sync API key to OpenClaw', { provider, err });
  }
}

/**
 * Remove a provider API key from OpenClaw's auth-profiles.json
 */
export function removeProviderKeyFromOpenClaw(provider: string): void {
  try {
    const store = readAuthProfiles();
    const profileId = `${provider}:default`;

    delete store.profiles[profileId];
    if (store.order?.[provider]) {
      store.order[provider] = store.order[provider].filter((id) => id !== profileId);
      if (store.order[provider].length === 0) delete store.order[provider];
    }
    if (store.lastGood?.[provider] === profileId) {
      delete store.lastGood[provider];
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
  const model = modelOverride || meta?.defaultModel;
  if (!model) {
    logger.warn('No default model for provider', { provider });
    return;
  }

  const modelId = model.startsWith(`${provider}/`) ? model.slice(provider.length + 1) : model;

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
    const existingProvider = (providers[provider] && typeof providers[provider] === 'object')
      ? (providers[provider] as Record<string, unknown>)
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

    providers[provider] = {
      ...existingProvider,
      baseUrl: providerCfg.baseUrl,
      api: providerCfg.api,
      apiKey: `\${${providerCfg.apiKeyEnv}}`,
      models: mergedModels,
    };
    models.providers = providers;
    config.models = models;
  } else {
    // Built-in provider: remove stale override if any
    const models = (config.models || {}) as Record<string, unknown>;
    const providers = (models.providers || {}) as Record<string, unknown>;
    if (providers[provider]) {
      delete providers[provider];
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
