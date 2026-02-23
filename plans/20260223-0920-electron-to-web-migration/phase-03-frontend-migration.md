# Phase 3: Frontend API Client Migration

**Status**: Not Started
**Priority**: HIGH
**Effort**: 2 days
**Dependencies**: Phase 2 (Backend Server)

## Context

Replace window.electron.ipcRenderer with fetch() and WebSocket in all React components and Zustand stores.

**Related Files**:
- `/Users/hnam/Desktop/ClawX-Web/src/stores/gateway.ts` - Gateway store
- `/Users/hnam/Desktop/ClawX-Web/src/stores/providers.ts` - Provider store
- `/Users/hnam/Desktop/ClawX-Web/src/stores/channels.ts` - Channel store
- `/Users/hnam/Desktop/ClawX-Web/src/stores/skills.ts` - Skill store
- `/Users/hnam/Desktop/ClawX-Web/src/stores/cron.ts` - Cron store
- `/Users/hnam/Desktop/ClawX-Web/src/stores/chat.ts` - Chat store
- `/Users/hnam/Desktop/ClawX-Web/src/stores/settings.ts` - Settings store

## Overview

Day 1: Create API client wrapper, WebSocket client, migrate gateway/provider stores
Day 2: Migrate remaining stores (channels, skills, cron, chat, settings)

## Key Insights

- 40+ IPC invoke patterns across 7 stores
- 5 IPC event listeners (status-changed, error, notification, chat-message)
- File upload via dialog:open + file:stage (needs HTML input)
- WebSocket for real-time events
- Token stored in localStorage

## Requirements

1. Create REST API client wrapper (fetch-based)
2. Create WebSocket client wrapper
3. Replace all window.electron.ipcRenderer.invoke() calls
4. Replace all window.electron.ipcRenderer.on() listeners
5. Update file upload to use HTML input + FormData
6. Remove electron preload types

## Architecture

### API Client Pattern

```typescript
// Before (Electron IPC)
const result = await window.electron.ipcRenderer.invoke('gateway:start');

// After (REST API)
const result = await api.gateway.start();
```

### WebSocket Pattern

```typescript
// Before (Electron IPC)
window.electron.ipcRenderer.on('gateway:status-changed', (status) => {
  set({ status });
});

// After (WebSocket)
wsClient.on('gateway:status-changed', (status) => {
  set({ status });
});
```

## Implementation Steps

### Day 1: Core API Client + Gateway/Provider Stores (8 hours)

#### Step 1.1: Create API Client (2 hours)

**src/lib/api-client.ts**:

```typescript
const API_BASE = import.meta.env.DEV
  ? 'http://localhost:2003/api'
  : '/api';

let authToken: string | null = null;

export function setAuthToken(token: string) {
  authToken = token;
  localStorage.setItem('clawx_token', token);
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('clawx_token');
  }
  return authToken;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Gateway
  gateway: {
    status: () => request('/gateway/status'),
    start: () => request('/gateway/start', { method: 'POST' }),
    stop: () => request('/gateway/stop', { method: 'POST' }),
    restart: () => request('/gateway/restart', { method: 'POST' }),
    health: () => request('/gateway/health'),
    rpc: <T = any>(method: string, params?: any, timeoutMs?: number) =>
      request<{ success: boolean; result: T }>('/gateway/rpc', {
        method: 'POST',
        body: JSON.stringify({ method, params, timeoutMs }),
      }),
  },

  // Providers
  providers: {
    list: () => request('/providers'),
    get: (id: string) => request(`/providers/${id}`),
    save: (config: any, apiKey?: string) =>
      request('/providers', {
        method: 'POST',
        body: JSON.stringify({ config, apiKey }),
      }),
    delete: (id: string) =>
      request(`/providers/${id}`, { method: 'DELETE' }),
    setDefault: (id: string) =>
      request('/providers/default', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    getDefault: () => request<{ id: string | null }>('/providers/default'),
    validateKey: (id: string, apiKey: string, options?: any) =>
      request('/providers/validate-key', {
        method: 'POST',
        body: JSON.stringify({ id, apiKey, options }),
      }),
  },

  // Channels
  channels: {
    list: () => request('/channels'),
    save: (config: any) =>
      request('/channels', {
        method: 'POST',
        body: JSON.stringify(config),
      }),
    delete: (type: string) =>
      request(`/channels/${type}`, { method: 'DELETE' }),
  },

  // Cron
  cron: {
    list: () => request('/cron'),
    create: (input: any) =>
      request('/cron', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: any) =>
      request(`/cron/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request(`/cron/${id}`, { method: 'DELETE' }),
    toggle: (id: string, enabled: boolean) =>
      request(`/cron/${id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }),
    trigger: (id: string) =>
      request(`/cron/${id}/trigger`, { method: 'POST' }),
  },

  // Skills
  skills: {
    list: () => request('/skills'),
    search: (query: string) =>
      request('/skills/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      }),
    install: (slug: string, version?: string) =>
      request('/skills/install', {
        method: 'POST',
        body: JSON.stringify({ slug, version }),
      }),
    uninstall: (slug: string) =>
      request(`/skills/${slug}`, { method: 'DELETE' }),
    getConfig: (key: string) => request(`/skills/${key}/config`),
    updateConfig: (key: string, config: any) =>
      request(`/skills/${key}/config`, {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
  },

  // Files
  files: {
    stage: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/files/stage`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) throw new Error('File upload failed');
      return response.json();
    },

    stageBuffer: (data: { base64: string; fileName: string; mimeType: string }) =>
      request('/files/stage-buffer', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Settings
  settings: {
    get: (key: string) => request(`/settings/${key}`),
    set: (key: string, value: any) =>
      request(`/settings/${key}`, {
        method: 'POST',
        body: JSON.stringify({ value }),
      }),
    getAll: () => request('/settings'),
  },
};
```

#### Step 1.2: Create WebSocket Client (2 hours)

**src/lib/websocket-client.ts**:

```typescript
type EventHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private token: string | null = null;

  connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.token = token;
    const wsUrl = import.meta.env.DEV
      ? `ws://localhost:2003/ws?token=${encodeURIComponent(token)}`
      : `ws://${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const handlers = this.handlers.get(message.type);
        if (handlers) {
          handlers.forEach((handler) => handler(message.data));
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (!this.token) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = window.setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect(this.token!);
    }, delay);
  }
}

export const wsClient = new WebSocketClient();
```

#### Step 1.3: Migrate Gateway Store (2 hours)

**src/stores/gateway.ts** (updated):

```typescript
import { create } from 'zustand';
import { api } from '@/lib/api-client';
import { wsClient } from '@/lib/websocket-client';

interface GatewayStatus {
  state: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'reconnecting';
  port?: number;
  pid?: number;
  error?: string;
}

interface GatewayStore {
  status: GatewayStatus;
  lastError: string | null;
  isInitialized: boolean;

  init: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  checkHealth: () => Promise<{ ok: boolean; latency?: number }>;
  rpc: <T = any>(method: string, params?: any, timeoutMs?: number) => Promise<T>;
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  status: { state: 'stopped' },
  lastError: null,
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return;

    try {
      // Get initial status
      const status = await api.gateway.status() as GatewayStatus;
      set({ status, isInitialized: true });

      // Connect WebSocket
      const token = localStorage.getItem('clawx_token');
      if (token) {
        wsClient.connect(token);

        // Listen for events
        wsClient.on('gateway:status-changed', (newStatus: GatewayStatus) => {
          set({ status: newStatus });
        });

        wsClient.on('gateway:error', (error: string) => {
          set({ lastError: error });
        });

        wsClient.on('gateway:notification', (notification: any) => {
          // Forward to chat store
          import('./chat').then(({ useChatStore }) => {
            useChatStore.getState().handleNotification(notification);
          });
        });

        wsClient.on('gateway:chat-message', (data: any) => {
          import('./chat').then(({ useChatStore }) => {
            useChatStore.getState().handleChatMessage(data);
          });
        });
      }
    } catch (error) {
      console.error('Failed to initialize Gateway:', error);
      set({ lastError: String(error) });
    }
  },

  start: async () => {
    try {
      set({ lastError: null });
      const result = await api.gateway.start() as { success: boolean; error?: string };

      if (!result.success) {
        set({ lastError: result.error || 'Failed to start Gateway' });
      }
    } catch (error) {
      set({ lastError: String(error) });
    }
  },

  stop: async () => {
    try {
      set({ lastError: null });
      const result = await api.gateway.stop() as { success: boolean; error?: string };

      if (!result.success) {
        set({ lastError: result.error || 'Failed to stop Gateway' });
      }
    } catch (error) {
      set({ lastError: String(error) });
    }
  },

  restart: async () => {
    try {
      set({ lastError: null });
      const result = await api.gateway.restart() as { success: boolean; error?: string };

      if (!result.success) {
        set({ lastError: result.error || 'Failed to restart Gateway' });
      }
    } catch (error) {
      set({ lastError: String(error) });
    }
  },

  checkHealth: async () => {
    try {
      const result = await api.gateway.health() as { success: boolean; ok: boolean; latency?: number };
      return { ok: result.ok, latency: result.latency };
    } catch (error) {
      return { ok: false };
    }
  },

  rpc: async <T = any>(method: string, params?: any, timeoutMs?: number): Promise<T> => {
    try {
      const result = await api.gateway.rpc<T>(method, params, timeoutMs);
      return result.result;
    } catch (error) {
      throw error;
    }
  },
}));
```

#### Step 1.4: Migrate Provider Store (2 hours)

**src/stores/providers.ts** (updated):

```typescript
import { create } from 'zustand';
import { api } from '@/lib/api-client';

interface Provider {
  id: string;
  name: string;
  type: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProviderStore {
  providers: Provider[];
  defaultProvider: string | null;
  loading: boolean;

  fetchProviders: () => Promise<void>;
  saveProvider: (config: Omit<Provider, 'createdAt' | 'updatedAt'>, apiKey?: string) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setDefaultProvider: (id: string) => Promise<void>;
  validateApiKey: (id: string, apiKey: string, options?: any) => Promise<boolean>;
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  defaultProvider: null,
  loading: false,

  fetchProviders: async () => {
    try {
      set({ loading: true });
      const [providers, defaultResult] = await Promise.all([
        api.providers.list() as Promise<Provider[]>,
        api.providers.getDefault(),
      ]);
      set({ providers, defaultProvider: defaultResult.id, loading: false });
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      set({ loading: false });
    }
  },

  saveProvider: async (config, apiKey) => {
    try {
      await api.providers.save(config, apiKey);
      await get().fetchProviders();
    } catch (error) {
      console.error('Failed to save provider:', error);
      throw error;
    }
  },

  deleteProvider: async (id) => {
    try {
      await api.providers.delete(id);
      await get().fetchProviders();
    } catch (error) {
      console.error('Failed to delete provider:', error);
      throw error;
    }
  },

  setDefaultProvider: async (id) => {
    try {
      await api.providers.setDefault(id);
      set({ defaultProvider: id });
    } catch (error) {
      console.error('Failed to set default provider:', error);
      throw error;
    }
  },

  validateApiKey: async (id, apiKey, options) => {
    try {
      const result = await api.providers.validateKey(id, apiKey, options) as { valid: boolean };
      return result.valid;
    } catch (error) {
      console.error('Failed to validate API key:', error);
      return false;
    }
  },
}));
```

### Day 2: Remaining Stores (8 hours)

#### Step 2.1: Migrate Channels Store (1.5 hours)

**src/stores/channels.ts** (updated):

```typescript
import { create } from 'zustand';
import { api } from '@/lib/api-client';
import { useGatewayStore } from './gateway';

interface Channel {
  id: string;
  type: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  config?: any;
}

interface ChannelStore {
  channels: Channel[];
  loading: boolean;

  fetchChannels: () => Promise<void>;
  saveChannel: (config: any) => Promise<void>;
  deleteChannel: (type: string) => Promise<void>;
  connectChannel: (id: string) => Promise<void>;
  disconnectChannel: (id: string) => Promise<void>;
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
  channels: [],
  loading: false,

  fetchChannels: async () => {
    try {
      set({ loading: true });
      const rpc = useGatewayStore.getState().rpc;
      const result = await rpc<{ channels: Channel[] }>('channels.status', { probe: true });
      set({ channels: result.channels, loading: false });
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      set({ loading: false, channels: [] });
    }
  },

  saveChannel: async (config) => {
    try {
      await api.channels.save(config);
      await get().fetchChannels();
    } catch (error) {
      console.error('Failed to save channel:', error);
      throw error;
    }
  },

  deleteChannel: async (type) => {
    try {
      await api.channels.delete(type);
      await get().fetchChannels();
    } catch (error) {
      console.error('Failed to delete channel:', error);
      throw error;
    }
  },

  connectChannel: async (id) => {
    try {
      const rpc = useGatewayStore.getState().rpc;
      await rpc('channels.connect', { channelId: id });
      await get().fetchChannels();
    } catch (error) {
      console.error('Failed to connect channel:', error);
      throw error;
    }
  },

  disconnectChannel: async (id) => {
    try {
      const rpc = useGatewayStore.getState().rpc;
      await rpc('channels.disconnect', { channelId: id });
      await get().fetchChannels();
    } catch (error) {
      console.error('Failed to disconnect channel:', error);
      throw error;
    }
  },
}));
```

#### Step 2.2: Migrate Skills Store (1.5 hours)

**src/stores/skills.ts** (updated):

```typescript
import { create } from 'zustand';
import { api } from '@/lib/api-client';
import { useGatewayStore } from './gateway';

interface Skill {
  key: string;
  name: string;
  version: string;
  enabled: boolean;
  config?: any;
}

interface SkillStore {
  skills: Skill[];
  loading: boolean;

  fetchSkills: () => Promise<void>;
  searchSkills: (query: string) => Promise<any[]>;
  installSkill: (slug: string, version?: string) => Promise<void>;
  uninstallSkill: (slug: string) => Promise<void>;
  updateSkillConfig: (key: string, config: any) => Promise<void>;
  toggleSkill: (key: string, enabled: boolean) => Promise<void>;
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [],
  loading: false,

  fetchSkills: async () => {
    try {
      set({ loading: true });
      const skills = await api.skills.list() as Skill[];
      set({ skills, loading: false });
    } catch (error) {
      console.error('Failed to fetch skills:', error);
      set({ loading: false });
    }
  },

  searchSkills: async (query) => {
    try {
      const result = await api.skills.search(query) as { skills: any[] };
      return result.skills;
    } catch (error) {
      console.error('Failed to search skills:', error);
      return [];
    }
  },

  installSkill: async (slug, version) => {
    try {
      await api.skills.install(slug, version);
      await get().fetchSkills();
    } catch (error) {
      console.error('Failed to install skill:', error);
      throw error;
    }
  },

  uninstallSkill: async (slug) => {
    try {
      await api.skills.uninstall(slug);
      await get().fetchSkills();
    } catch (error) {
      console.error('Failed to uninstall skill:', error);
      throw error;
    }
  },

  updateSkillConfig: async (key, config) => {
    try {
      await api.skills.updateConfig(key, config);
      await get().fetchSkills();
    } catch (error) {
      console.error('Failed to update skill config:', error);
      throw error;
    }
  },

  toggleSkill: async (key, enabled) => {
    try {
      const rpc = useGatewayStore.getState().rpc;
      await rpc('skills.update', { skillKey: key, enabled });
      await get().fetchSkills();
    } catch (error) {
      console.error('Failed to toggle skill:', error);
      throw error;
    }
  },
}));
```

#### Step 2.3: Migrate Cron Store (1.5 hours)

**src/stores/cron.ts** (updated):

```typescript
import { create } from 'zustand';
import { api } from '@/lib/api-client';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

interface CronStore {
  jobs: CronJob[];
  loading: boolean;

  fetchJobs: () => Promise<void>;
  createJob: (input: Omit<CronJob, 'id'>) => Promise<void>;
  updateJob: (id: string, input: Partial<CronJob>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  toggleJob: (id: string, enabled: boolean) => Promise<void>;
  triggerJob: (id: string) => Promise<void>;
}

export const useCronStore = create<CronStore>((set, get) => ({
  jobs: [],
  loading: false,

  fetchJobs: async () => {
    try {
      set({ loading: true });
      const jobs = await api.cron.list() as CronJob[];
      set({ jobs, loading: false });
    } catch (error) {
      console.error('Failed to fetch cron jobs:', error);
      set({ loading: false });
    }
  },

  createJob: async (input) => {
    try {
      await api.cron.create(input);
      await get().fetchJobs();
    } catch (error) {
      console.error('Failed to create cron job:', error);
      throw error;
    }
  },

  updateJob: async (id, input) => {
    try {
      await api.cron.update(id, input);
      await get().fetchJobs();
    } catch (error) {
      console.error('Failed to update cron job:', error);
      throw error;
    }
  },

  deleteJob: async (id) => {
    try {
      await api.cron.delete(id);
      await get().fetchJobs();
    } catch (error) {
      console.error('Failed to delete cron job:', error);
      throw error;
    }
  },

  toggleJob: async (id, enabled) => {
    try {
      await api.cron.toggle(id, enabled);
      await get().fetchJobs();
    } catch (error) {
      console.error('Failed to toggle cron job:', error);
      throw error;
    }
  },

  triggerJob: async (id) => {
    try {
      await api.cron.trigger(id);
    } catch (error) {
      console.error('Failed to trigger cron job:', error);
      throw error;
    }
  },
}));
```

#### Step 2.4: Update Chat Store (2 hours)

**src/stores/chat.ts** (key changes):

```typescript
// Replace IPC calls with API calls
import { api } from '@/lib/api-client';
import { useGatewayStore } from './gateway';

// In sendMessage function:
const rpc = useGatewayStore.getState().rpc;
await rpc('chat.send', { sessionKey, message });

// In loadSessions function:
const result = await rpc<{ sessions: Session[] }>('sessions.list', { limit: 50 });

// In loadHistory function:
const result = await rpc<{ messages: Message[] }>('chat.history', { sessionKey, limit: 200 });

// Add WebSocket event handlers in init:
wsClient.on('gateway:chat-message', (data) => {
  // Handle incoming chat messages
});
```

#### Step 2.5: Remove Electron Types (1.5 hours)

**src/types/electron.d.ts** (delete this file)

**src/vite-env.d.ts** (remove electron references):

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## Todo List

### Day 1
- [ ] Create src/lib/api-client.ts
- [ ] Create src/lib/websocket-client.ts
- [ ] Migrate gateway store
- [ ] Migrate provider store
- [ ] Test gateway operations
- [ ] Test provider operations

### Day 2
- [ ] Migrate channels store
- [ ] Migrate skills store
- [ ] Migrate cron store
- [ ] Update chat store
- [ ] Update settings store
- [ ] Remove electron types
- [ ] Remove all window.electron references
- [ ] Test all store operations

## Success Criteria

- [ ] No window.electron references remaining
- [ ] All stores using api client
- [ ] WebSocket events working
- [ ] Gateway operations functional
- [ ] Provider CRUD working
- [ ] Channel management working
- [ ] Skill management working
- [ ] Cron jobs working
- [ ] Chat sending/receiving working
- [ ] TypeScript compiling without errors

## Risk Assessment

**Low Risk**: API client wrapper
- Mitigation: Standard fetch patterns

**Medium Risk**: WebSocket reconnection
- Mitigation: Exponential backoff implemented

**Low Risk**: Store migration
- Mitigation: Test each store individually

## Security Considerations

- Token stored in localStorage
- Token sent in Authorization header
- WebSocket authenticated via query param
- No sensitive data in localStorage (only token)

## Next Steps

After completion, proceed to Phase 4 (Storage Layer Migration) to implement lowdb storage on backend.
