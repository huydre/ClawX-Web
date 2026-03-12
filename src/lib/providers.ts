/**
 * Provider Types & UI Metadata — single source of truth for the frontend.
 *
 * NOTE: When adding a new provider type, also update
 * electron/utils/provider-registry.ts (env vars, models, configs).
 */

export const PROVIDER_TYPES = [
  'anthropic',
  'openai',
  'codex',
  'google',
  'openrouter',
  'moonshot',
  'ollama',
  '9router',
  'custom',
] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderWithKeyInfo extends ProviderConfig {
  hasKey: boolean;
  keyMasked: string | null;
}

export interface ProviderTypeInfo {
  id: ProviderType;
  name: string;
  icon: string;
  placeholder: string;
  /** Model brand name for display (e.g. "Claude", "GPT") */
  model?: string;
  requiresApiKey: boolean;
  /** Pre-filled base URL (for proxy/compatible providers like SiliconFlow) */
  defaultBaseUrl?: string;
  /** Whether the user can edit the base URL in setup */
  showBaseUrl?: boolean;
  /** Whether to show a Model ID input field (for providers where user picks the model) */
  showModelId?: boolean;
  /** Default / example model ID placeholder */
  modelIdPlaceholder?: string;
  /** Default model ID to pre-fill */
  defaultModelId?: string;
  /** Popular models for dropdown selection */
  models?: { id: string; name: string }[];
  /** Whether models can be auto-fetched from API */
  canFetchModels?: boolean;
  /** Whether this provider uses OAuth instead of API key */
  useOAuth?: boolean;
}

import { providerIcons } from '@/assets/providers';

/** All supported provider types with UI metadata */
export const PROVIDER_TYPE_INFO: ProviderTypeInfo[] = [
  {
    id: 'anthropic', name: 'Anthropic', icon: '🤖', placeholder: 'sk-ant-api03-...', model: 'Claude', requiresApiKey: true,
    defaultModelId: 'claude-sonnet-4-20250514',
    canFetchModels: true,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    ],
  },
  {
    id: 'openai', name: 'OpenAI', icon: '💚', placeholder: 'sk-proj-...', model: 'GPT', requiresApiKey: true,
    defaultModelId: 'gpt-4.1',
    canFetchModels: true,
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'o3', name: 'o3' },
      { id: 'o4-mini', name: 'o4 Mini' },
    ],
  },
  {
    id: 'codex', name: 'Codex (OpenAI)', icon: '🧠', placeholder: 'Connect via OAuth', model: 'Codex',
    requiresApiKey: false, useOAuth: true,
    defaultModelId: 'codex-mini-latest',
    models: [
      { id: 'codex-mini-latest', name: 'Codex Mini (Latest)' },
      { id: 'gpt-5.4', name: 'GPT 5.4' },
      { id: 'gpt-5.3-codex', name: 'GPT 5.3 Codex' },
      { id: 'gpt-5.3-codex-spark', name: 'GPT 5.3 Codex Spark' },
      { id: 'o4-mini', name: 'o4 Mini' },
    ],
  },
  {
    id: 'google', name: 'Google', icon: '🔷', placeholder: 'AIza...', model: 'Gemini', requiresApiKey: true,
    defaultModelId: 'gemini-2.5-flash',
    canFetchModels: true,
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
  },
  {
    id: 'openrouter', name: 'OpenRouter', icon: '🌐', placeholder: 'sk-or-v1-...', model: 'Multi-Model', requiresApiKey: true,
    showModelId: true, modelIdPlaceholder: 'anthropic/claude-sonnet-4',
    canFetchModels: true,
  },
  {
    id: 'moonshot', name: 'Moonshot', icon: '🌙', placeholder: 'sk-...', model: 'Kimi', requiresApiKey: true,
    defaultBaseUrl: 'https://api.moonshot.ai/v1', defaultModelId: 'kimi-k2.5',
    canFetchModels: true,
    models: [
      { id: 'kimi-k2.5', name: 'Kimi K2.5' },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K' },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K' },
    ],
  },
  {
    id: 'ollama', name: 'Ollama', icon: '🦙', placeholder: 'Not required', requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:11434', showBaseUrl: true, showModelId: true, modelIdPlaceholder: 'qwen3:latest',
    canFetchModels: true,
  },
  {
    id: '9router', name: '9Router', icon: '🔀', placeholder: 'Paste API key from 9Router dashboard', model: 'Multi-Model', requiresApiKey: true,
    defaultBaseUrl: 'http://localhost:20128/v1', showBaseUrl: true,
    defaultModelId: 'cc/claude-opus-4-6',
    canFetchModels: true,
  },
  {
    id: 'custom', name: 'Custom', icon: '⚙️', placeholder: 'API key...', requiresApiKey: true,
    showBaseUrl: true, showModelId: true, modelIdPlaceholder: 'your-provider/model-id',
  },
];

/** Get the SVG logo URL for a provider type, falls back to undefined */
export function getProviderIconUrl(type: ProviderType | string): string | undefined {
  return providerIcons[type];
}

/** Whether a provider's logo needs CSS invert in dark mode (monochrome SVGs only) */
export function shouldInvertInDark(_type: ProviderType | string): boolean {
  if (_type === 'codex') return false; // Color PNG
  return true;
}

/** Provider list shown in the Setup wizard */
export const SETUP_PROVIDERS = PROVIDER_TYPE_INFO;

/** Get type info by provider type id */
export function getProviderTypeInfo(type: ProviderType): ProviderTypeInfo | undefined {
  return PROVIDER_TYPE_INFO.find((t) => t.id === type);
}
