# Phase 4: Storage Layer Migration

**Status**: Not Started
**Priority**: HIGH
**Effort**: 1 day
**Dependencies**: Phase 2 (Backend Server)

## Context

Replace electron-store with lowdb (JSON file storage) on backend. Implement storage service for settings, providers, and API keys.

**Related Files**:
- `/Users/hnam/Desktop/ClawX-Web/electron/utils/secure-storage.ts` - Provider storage
- `/Users/hnam/Desktop/ClawX-Web/electron/utils/store.ts` - Settings storage
- `/Users/hnam/Desktop/ClawX-Web/electron/utils/channel-config.ts` - Channel file I/O
- `/Users/hnam/Desktop/ClawX-Web/electron/utils/skill-config.ts` - Skill file I/O

## Overview

Implement lowdb-based storage service to replace electron-store. Store data in ~/.clawx/db.json.

## Key Insights

- 2 electron-store instances: clawx-providers, settings
- API keys stored in plain text (security improvement in Phase 2 of codebase review)
- Settings: theme, language, gateway port/token, update channel
- Providers: config + API keys
- File-based: ~/.openclaw/openclaw.json (channels, skills)

## Requirements

1. Implement lowdb storage service
2. Create database schema
3. Implement CRUD operations for settings
4. Implement CRUD operations for providers
5. Implement API key storage (plain text for now)
6. Initialize default data on first run
7. Add file locking for concurrent access

## Architecture

### Database Schema

```typescript
interface Database {
  settings: {
    serverToken: string;
    gatewayPort: number;
    gatewayToken: string;
    theme: 'light' | 'dark' | 'system';
    language: string;
  };
  providers: Record<string, ProviderConfig>;
  apiKeys: Record<string, string>;
  defaultProvider: string | null;
}
```

### Storage Location

```
~/.clawx/
├── db.json           # Main database
└── logs/             # Log files
```

## Implementation Steps

### Step 1: Create Storage Service (4 hours)

**server/services/storage.ts**:

```typescript
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

export async function updateSettings(updates: Partial<AppSettings>): Promise<void> {
  await db.read();
  db.data!.settings = { ...db.data!.settings, ...updates };
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

export async function hasApiKey(providerId: string): Promise<boolean> {
  await db.read();
  return !!db.data!.apiKeys[providerId];
}

// Utility
export async function getAllData(): Promise<Database> {
  await db.read();
  return { ...db.data! };
}

export async function resetDatabase(): Promise<void> {
  db.data = defaultData;
  await db.write();
}
```

### Step 2: Create Provider Routes (2 hours)

**server/routes/providers.ts** (complete implementation):

```typescript
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
  setApiKey,
  deleteApiKey,
  hasApiKey,
} from '../services/storage';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/providers
router.get('/', async (req, res) => {
  try {
    const providers = await getAllProviders();
    res.json(providers);
  } catch (error) {
    logger.error('Get providers error:', error);
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

// GET /api/providers/default
router.get('/default', async (req, res) => {
  try {
    const defaultId = await getDefaultProvider();
    res.json({ id: defaultId });
  } catch (error) {
    logger.error('Get default provider error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/providers/:id/api-key
router.post('/:id/api-key', async (req, res) => {
  try {
    const { apiKey } = z.object({ apiKey: z.string() }).parse(req.body);
    await setApiKey(req.params.id, apiKey);
    logger.info('API key set', { providerId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Set API key error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/providers/:id/api-key
router.get('/:id/api-key', async (req, res) => {
  try {
    const apiKey = await getApiKey(req.params.id);
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    // Return masked key for security
    const masked = apiKey.slice(0, 4) + '...' + apiKey.slice(-4);
    res.json({ apiKey: masked, hasFull: true });
  } catch (error) {
    logger.error('Get API key error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /api/providers/:id/api-key
router.delete('/:id/api-key', async (req, res) => {
  try {
    await deleteApiKey(req.params.id);
    logger.info('API key deleted', { providerId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete API key error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/providers/validate-key
const validateKeySchema = z.object({
  id: z.string(),
  apiKey: z.string(),
  options: z.any().optional(),
});

router.post('/validate-key', async (req, res) => {
  try {
    const { id, apiKey, options } = validateKeySchema.parse(req.body);

    // Get provider config
    const provider = await getProvider(id);
    if (!provider) {
      return res.status(404).json({ valid: false, error: 'Provider not found' });
    }

    // Validate by making test request (implementation depends on provider type)
    // For now, just check if key is not empty
    const valid = apiKey.length > 0;

    res.json({ valid });
  } catch (error) {
    logger.error('Validate API key error:', error);
    res.status(500).json({ valid: false, error: String(error) });
  }
});

export default router;
```

### Step 3: Create Settings Routes (1 hour)

**server/routes/settings.ts**:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { getSettings, getSetting, setSetting, updateSettings } from '../services/storage';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const settings = await getSettings();
    // Don't expose tokens
    const { serverToken, gatewayToken, ...safeSettings } = settings;
    res.json(safeSettings);
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/settings/:key
router.get('/:key', async (req, res) => {
  try {
    const value = await getSetting(req.params.key as any);
    res.json({ value });
  } catch (error) {
    logger.error('Get setting error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/settings/:key
router.post('/:key', async (req, res) => {
  try {
    const { value } = z.object({ value: z.any() }).parse(req.body);
    await setSetting(req.params.key as any, value);
    logger.info('Setting updated', { key: req.params.key });
    res.json({ success: true });
  } catch (error) {
    logger.error('Set setting error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const updates = req.body;
    await updateSettings(updates);
    logger.info('Settings updated', { keys: Object.keys(updates) });
    res.json({ success: true });
  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
```

### Step 4: Update app.ts with Routes (30 min)

**server/app.ts** (add routes):

```typescript
import providerRoutes from './routes/providers';
import settingsRoutes from './routes/settings';

// ... existing code ...

app.use('/api/providers', authMiddleware, providerRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
```

### Step 5: Test Storage (1.5 hours)

Create test script:

```bash
#!/bin/bash

TOKEN="<your-token>"
BASE="http://localhost:2003/api"

# Test settings
echo "Testing settings..."
curl -H "Authorization: Bearer $TOKEN" $BASE/settings

# Test save provider
echo "Testing save provider..."
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "id": "test-provider",
      "name": "Test Provider",
      "type": "openai",
      "model": "gpt-4",
      "enabled": true
    },
    "apiKey": "sk-test-key"
  }' \
  $BASE/providers

# Test get providers
echo "Testing get providers..."
curl -H "Authorization: Bearer $TOKEN" $BASE/providers

# Test set default
echo "Testing set default..."
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "test-provider"}' \
  $BASE/providers/default

# Test get default
echo "Testing get default..."
curl -H "Authorization: Bearer $TOKEN" $BASE/providers/default

# Verify db.json
echo "Checking db.json..."
cat ~/.clawx/db.json | jq
```

## Todo List

- [ ] Create server/services/storage.ts
- [ ] Implement lowdb setup
- [ ] Implement settings CRUD
- [ ] Implement provider CRUD
- [ ] Implement API key storage
- [ ] Create server/routes/providers.ts
- [ ] Create server/routes/settings.ts
- [ ] Update app.ts with routes
- [ ] Test settings endpoints
- [ ] Test provider endpoints
- [ ] Test API key endpoints
- [ ] Verify db.json structure
- [ ] Test concurrent access

## Success Criteria

- [ ] Storage service initializing correctly
- [ ] db.json created in ~/.clawx/
- [ ] Settings CRUD working
- [ ] Provider CRUD working
- [ ] API keys stored/retrieved correctly
- [ ] Default provider setting working
- [ ] No data corruption on concurrent access
- [ ] Tokens generated on first run

## Risk Assessment

**Low Risk**: lowdb is stable and well-tested
- Mitigation: Use latest version

**Medium Risk**: Concurrent access
- Mitigation: lowdb handles file locking

**Low Risk**: Data migration
- Mitigation: Fresh start (no migration needed)

## Security Considerations

- API keys stored in plain text (acceptable for Phase 1)
- Server token generated randomly (32 bytes)
- Gateway token generated randomly (32 bytes)
- Tokens not exposed in GET /api/settings
- File permissions: 600 (owner read/write only)

## Next Steps

After completion, proceed to Phase 5 (File Upload/Download) to implement multer file handling.
