import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import crypto from 'crypto';

// Types
interface AppSettings {
  serverToken: string;
  gatewayPort: number;
  gatewayToken: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

interface CloudflareSettings {
  enabled: boolean;
  tunnelEnabled?: boolean;
  tunnelMode?: 'quick' | 'named';
  tunnelId?: string;
  tunnelName?: string;
  tunnelToken?: string;
  accountId?: string;
  domain?: string;
  publicUrl?: string;
  dashboardUrl?: string; // URL for OpenClaw dashboard subdomain tunnel
  useIngressConfig?: boolean; // When true, cloudflared uses API ingress rules instead of --url
  createdAt?: string;
  updatedAt?: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  type: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Database {
  settings: AppSettings;
  providers: Record<string, ProviderConfig>;
  apiKeys: Record<string, string>;
  defaultProvider: string | null;
  cloudflare: CloudflareSettings;
}

// Default data
const defaultData: Database = {
  settings: {
    serverToken: `clawx-${crypto.randomBytes(16).toString('hex')}`,
    gatewayPort: 18789,
    gatewayToken: `clawx-${crypto.randomBytes(16).toString('hex')}`,
    theme: 'system',
    language: 'en',
  },
  providers: {},
  apiKeys: {},
  defaultProvider: null,
  cloudflare: {
    enabled: false,
  },
};

// Database setup
const dataDir = join(homedir(), '.clawx');
const dbPath = join(dataDir, 'db.json');

// Ensure directory exists
mkdirSync(dataDir, { recursive: true });
mkdirSync(join(dataDir, 'logs'), { recursive: true });

const adapter = new JSONFile<Database>(dbPath);
const db = new Low(adapter, defaultData);

// Initialize
export async function initStorage() {
  await db.read();
  db.data ||= defaultData;

  // Generate tokens if missing
  if (!db.data.settings.serverToken) {
    db.data.settings.serverToken = `clawx-${crypto.randomBytes(16).toString('hex')}`;
  }
  if (!db.data.settings.gatewayToken) {
    db.data.settings.gatewayToken = `clawx-${crypto.randomBytes(16).toString('hex')}`;
  }

  await db.write();
}

// Settings
export async function getSettings(): Promise<AppSettings> {
  await db.read();
  return { ...db.data!.settings };
}

export async function getSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K]> {
  await db.read();
  return db.data!.settings[key];
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  await db.read();
  db.data!.settings[key] = value;
  await db.write();
}

// Providers
export async function getAllProviders(): Promise<ProviderConfig[]> {
  await db.read();
  return Object.values(db.data!.providers);
}

export async function getProvider(id: string): Promise<ProviderConfig | null> {
  await db.read();
  return db.data!.providers[id] || null;
}

export async function saveProvider(
  config: Omit<ProviderConfig, 'createdAt' | 'updatedAt'>,
  apiKey?: string
): Promise<void> {
  await db.read();

  const existing = db.data!.providers[config.id];
  const now = new Date().toISOString();

  db.data!.providers[config.id] = {
    ...config,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (apiKey) {
    db.data!.apiKeys[config.id] = apiKey;
  }

  await db.write();
}

export async function deleteProvider(id: string): Promise<void> {
  await db.read();
  delete db.data!.providers[id];
  delete db.data!.apiKeys[id];

  if (db.data!.defaultProvider === id) {
    db.data!.defaultProvider = null;
  }

  await db.write();
}

export async function setDefaultProvider(id: string): Promise<void> {
  await db.read();

  if (!db.data!.providers[id]) {
    throw new Error('Provider not found');
  }

  db.data!.defaultProvider = id;
  await db.write();
}

export async function getDefaultProvider(): Promise<string | null> {
  await db.read();
  return db.data!.defaultProvider;
}

// API Keys
export async function getApiKey(providerId: string): Promise<string | null> {
  await db.read();
  return db.data!.apiKeys[providerId] || null;
}

export async function setApiKey(providerId: string, apiKey: string): Promise<void> {
  await db.read();
  db.data!.apiKeys[providerId] = apiKey;
  await db.write();
}

export async function deleteApiKey(providerId: string): Promise<void> {
  await db.read();
  delete db.data!.apiKeys[providerId];
  await db.write();
}

// Cloudflare Settings
export async function getCloudflareSettings(): Promise<CloudflareSettings> {
  await db.read();
  return { ...db.data!.cloudflare };
}

export async function saveCloudflareSettings(settings: Partial<CloudflareSettings>): Promise<void> {
  await db.read();
  const now = new Date().toISOString();

  db.data!.cloudflare = {
    ...db.data!.cloudflare,
    ...settings,
    updatedAt: now,
  };

  if (!db.data!.cloudflare.createdAt) {
    db.data!.cloudflare.createdAt = now;
  }

  await db.write();
}

export async function clearCloudflareSettings(): Promise<void> {
  await db.read();
  db.data!.cloudflare = {
    enabled: false,
  };
  await db.write();
}
