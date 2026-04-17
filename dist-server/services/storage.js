import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import crypto from 'crypto';
// Default data
const defaultData = {
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
    applications: {},
};
// Database setup
const dataDir = join(homedir(), '.clawx');
const dbPath = join(dataDir, 'db.json');
// Ensure directory exists
mkdirSync(dataDir, { recursive: true });
mkdirSync(join(dataDir, 'logs'), { recursive: true });
const adapter = new JSONFile(dbPath);
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
export async function getSettings() {
    await db.read();
    return { ...db.data.settings };
}
export async function getSetting(key) {
    await db.read();
    return db.data.settings[key];
}
export async function setSetting(key, value) {
    await db.read();
    db.data.settings[key] = value;
    await db.write();
}
// Providers
export async function getAllProviders() {
    await db.read();
    return Object.values(db.data.providers);
}
export async function getProvider(id) {
    await db.read();
    return db.data.providers[id] || null;
}
export async function saveProvider(config, apiKey) {
    await db.read();
    const existing = db.data.providers[config.id];
    const now = new Date().toISOString();
    db.data.providers[config.id] = {
        ...config,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };
    if (apiKey) {
        db.data.apiKeys[config.id] = apiKey;
    }
    await db.write();
}
export async function deleteProvider(id) {
    await db.read();
    delete db.data.providers[id];
    delete db.data.apiKeys[id];
    if (db.data.defaultProvider === id) {
        db.data.defaultProvider = null;
    }
    await db.write();
}
export async function setDefaultProvider(id) {
    await db.read();
    if (!db.data.providers[id]) {
        throw new Error('Provider not found');
    }
    db.data.defaultProvider = id;
    await db.write();
}
export async function getDefaultProvider() {
    await db.read();
    return db.data.defaultProvider;
}
// API Keys
export async function getApiKey(providerId) {
    await db.read();
    return db.data.apiKeys[providerId] || null;
}
export async function setApiKey(providerId, apiKey) {
    await db.read();
    db.data.apiKeys[providerId] = apiKey;
    await db.write();
}
export async function deleteApiKey(providerId) {
    await db.read();
    delete db.data.apiKeys[providerId];
    await db.write();
}
// Cloudflare Settings
export async function getCloudflareSettings() {
    await db.read();
    return { ...db.data.cloudflare };
}
export async function saveCloudflareSettings(settings) {
    await db.read();
    const now = new Date().toISOString();
    db.data.cloudflare = {
        ...db.data.cloudflare,
        ...settings,
        updatedAt: now,
    };
    if (!db.data.cloudflare.createdAt) {
        db.data.cloudflare.createdAt = now;
    }
    await db.write();
}
export async function clearCloudflareSettings() {
    await db.read();
    db.data.cloudflare = {
        enabled: false,
    };
    await db.write();
}
// Applications (Composio connections)
export async function getAllApplicationConnections() {
    await db.read();
    return Object.values(db.data.applications || {});
}
export async function getApplicationConnection(slug) {
    await db.read();
    return db.data.applications?.[slug] || null;
}
export async function saveApplicationConnection(conn) {
    await db.read();
    if (!db.data.applications)
        db.data.applications = {};
    db.data.applications[conn.slug] = conn;
    await db.write();
}
export async function deleteApplicationConnection(slug) {
    await db.read();
    if (db.data.applications) {
        delete db.data.applications[slug];
        await db.write();
    }
}
