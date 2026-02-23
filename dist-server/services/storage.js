"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initStorage = initStorage;
exports.getSettings = getSettings;
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.getAllProviders = getAllProviders;
exports.getProvider = getProvider;
exports.saveProvider = saveProvider;
exports.deleteProvider = deleteProvider;
exports.setDefaultProvider = setDefaultProvider;
exports.getDefaultProvider = getDefaultProvider;
exports.getApiKey = getApiKey;
exports.setApiKey = setApiKey;
exports.deleteApiKey = deleteApiKey;
const lowdb_1 = require("lowdb");
const node_1 = require("lowdb/node");
const path_1 = require("path");
const os_1 = require("os");
const fs_1 = require("fs");
const crypto_1 = __importDefault(require("crypto"));
// Default data
const defaultData = {
    settings: {
        serverToken: `clawx-${crypto_1.default.randomBytes(16).toString('hex')}`,
        gatewayPort: 18789,
        gatewayToken: `clawx-${crypto_1.default.randomBytes(16).toString('hex')}`,
        theme: 'system',
        language: 'en',
    },
    providers: {},
    apiKeys: {},
    defaultProvider: null,
};
// Database setup
const dataDir = (0, path_1.join)((0, os_1.homedir)(), '.clawx');
const dbPath = (0, path_1.join)(dataDir, 'db.json');
// Ensure directory exists
(0, fs_1.mkdirSync)(dataDir, { recursive: true });
(0, fs_1.mkdirSync)((0, path_1.join)(dataDir, 'logs'), { recursive: true });
const adapter = new node_1.JSONFile(dbPath);
const db = new lowdb_1.Low(adapter, defaultData);
// Initialize
async function initStorage() {
    await db.read();
    db.data ||= defaultData;
    // Generate tokens if missing
    if (!db.data.settings.serverToken) {
        db.data.settings.serverToken = `clawx-${crypto_1.default.randomBytes(16).toString('hex')}`;
    }
    if (!db.data.settings.gatewayToken) {
        db.data.settings.gatewayToken = `clawx-${crypto_1.default.randomBytes(16).toString('hex')}`;
    }
    await db.write();
}
// Settings
async function getSettings() {
    await db.read();
    return { ...db.data.settings };
}
async function getSetting(key) {
    await db.read();
    return db.data.settings[key];
}
async function setSetting(key, value) {
    await db.read();
    db.data.settings[key] = value;
    await db.write();
}
// Providers
async function getAllProviders() {
    await db.read();
    return Object.values(db.data.providers);
}
async function getProvider(id) {
    await db.read();
    return db.data.providers[id] || null;
}
async function saveProvider(config, apiKey) {
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
async function deleteProvider(id) {
    await db.read();
    delete db.data.providers[id];
    delete db.data.apiKeys[id];
    if (db.data.defaultProvider === id) {
        db.data.defaultProvider = null;
    }
    await db.write();
}
async function setDefaultProvider(id) {
    await db.read();
    if (!db.data.providers[id]) {
        throw new Error('Provider not found');
    }
    db.data.defaultProvider = id;
    await db.write();
}
async function getDefaultProvider() {
    await db.read();
    return db.data.defaultProvider;
}
// API Keys
async function getApiKey(providerId) {
    await db.read();
    return db.data.apiKeys[providerId] || null;
}
async function setApiKey(providerId, apiKey) {
    await db.read();
    db.data.apiKeys[providerId] = apiKey;
    await db.write();
}
async function deleteApiKey(providerId) {
    await db.read();
    delete db.data.apiKeys[providerId];
    await db.write();
}
