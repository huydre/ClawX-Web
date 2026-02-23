# Implementation Guide: IPC to REST/WebSocket Migration

## Quick Reference: Channel Mapping

### Gateway Channels (High Priority)
```
IPC Channel                    → REST Endpoint              → WebSocket Event
gateway:status                 → GET /api/gateway/status    → gateway.status_changed
gateway:isConnected            → GET /api/gateway/connected → N/A
gateway:start                  → POST /api/gateway/start    → gateway.status_changed
gateway:stop                   → POST /api/gateway/stop     → gateway.status_changed
gateway:restart                → POST /api/gateway/restart  → gateway.status_changed
gateway:rpc                    → POST /api/gateway/rpc      → (depends on method)
gateway:health                 → GET /api/gateway/health    → N/A
gateway:getControlUiUrl        → GET /api/gateway/control-ui → N/A
```

### Provider Channels (Medium Priority)
```
provider:list                  → GET /api/providers
provider:get                   → GET /api/providers/{id}
provider:save                  → POST /api/providers
provider:delete                → DELETE /api/providers/{id}
provider:setApiKey             → POST /api/providers/{id}/api-key
provider:setDefault            → POST /api/providers/{id}/default
provider:validateKey           → POST /api/providers/{id}/validate
```

### File Channels (High Priority - Complex)
```
file:stage                     → POST /api/files/stage (multipart)
file:stageBuffer               → POST /api/files/stage-buffer (JSON)
media:getThumbnails            → POST /api/media/thumbnails
media:saveImage                → POST /api/media/save-image
chat:sendWithMedia             → POST /api/chat/send-with-media
```

---

## Express Server Architecture

### Directory Structure
```
electron/
├── server/
│   ├── index.ts              # Server entry point
│   ├── middleware/
│   │   ├── auth.ts           # Token authentication
│   │   ├── cors.ts           # CORS configuration
│   │   └── error.ts          # Error handling
│   ├── routes/
│   │   ├── gateway.ts        # Gateway endpoints
│   │   ├── providers.ts      # Provider endpoints
│   │   ├── files.ts          # File upload endpoints
│   │   ├── settings.ts       # Settings endpoints
│   │   └── index.ts          # Route aggregation
│   ├── websocket/
│   │   ├── server.ts         # WebSocket server
│   │   ├── handlers.ts       # Message handlers
│   │   └── broadcast.ts      # Event broadcasting
│   └── utils/
│       ├── auth.ts           # Token generation/validation
│       └── errors.ts         # Error definitions
```

### Core Server Implementation

**electron/server/index.ts**
```typescript
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { GatewayManager } from '../gateway/manager';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { setupWebSocket } from './websocket/server';
import { setupRoutes } from './routes';
import { logger } from '../utils/logger';

export class ApiServer {
  private app: Express;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private port: number;

  constructor(private gatewayManager: GatewayManager, port = 3000) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ noServer: true });
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body parsing
    this.app.use(express.json({ limit: '500mb' }));
    this.app.use(express.urlencoded({ limit: '500mb', extended: true }));

    // Authentication
    this.app.use(authMiddleware);

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      });
      next();
    });
  }

  private setupRoutes(): void {
    setupRoutes(this.app, this.gatewayManager, this.wss);
  }

  private setupWebSocket(): void {
    this.server.on('upgrade', (req, socket, head) => {
      setupWebSocket(req, socket, head, this.wss, this.gatewayManager);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, '127.0.0.1', () => {
        logger.info(`API server listening on http://127.0.0.1:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.clients.forEach(client => client.close());
      this.server.close(() => {
        logger.info('API server stopped');
        resolve();
      });
    });
  }

  getWebSocketServer(): WebSocketServer {
    return this.wss;
  }
}
```

### Authentication Middleware

**electron/server/middleware/auth.ts**
```typescript
import { Request, Response, NextFunction } from 'express';
import { getSetting } from '../../utils/store';
import { logger } from '../../utils/logger';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn(`Unauthorized request: ${req.method} ${req.path}`);
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const storedToken = await getSetting('apiToken');

  if (token !== storedToken) {
    logger.warn(`Invalid token for: ${req.method} ${req.path}`);
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  next();
}
```

### Error Handler Middleware

**electron/server/middleware/error.ts**
```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
  }
}

export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error(`API error: ${err.message}`, err);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      details: err.details,
      timestamp: new Date().toISOString()
    } as ApiErrorResponse);
  } else {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      timestamp: new Date().toISOString()
    } as ApiErrorResponse);
  }
}
```

---

## Route Implementation Examples

### Gateway Routes

**electron/server/routes/gateway.ts**
```typescript
import { Router, Request, Response } from 'express';
import { GatewayManager } from '../../gateway/manager';
import { ApiError, errorHandler } from '../middleware/error';
import { WebSocketServer } from 'ws';

export function createGatewayRouter(
  gatewayManager: GatewayManager,
  wss: WebSocketServer
): Router {
  const router = Router();

  // GET /api/gateway/status
  router.get('/status', (req: Request, res: Response) => {
    try {
      const status = gatewayManager.getStatus();
      res.json(status);
    } catch (error) {
      throw new ApiError('GATEWAY_ERROR', String(error), 500);
    }
  });

  // GET /api/gateway/connected
  router.get('/connected', (req: Request, res: Response) => {
    res.json({ connected: gatewayManager.isConnected() });
  });

  // POST /api/gateway/start
  router.post('/start', async (req: Request, res: Response) => {
    try {
      await gatewayManager.start();
      res.json({ success: true });
    } catch (error) {
      throw new ApiError('GATEWAY_START_FAILED', String(error), 500);
    }
  });

  // POST /api/gateway/stop
  router.post('/stop', async (req: Request, res: Response) => {
    try {
      await gatewayManager.stop();
      res.json({ success: true });
    } catch (error) {
      throw new ApiError('GATEWAY_STOP_FAILED', String(error), 500);
    }
  });

  // POST /api/gateway/rpc
  router.post('/rpc', async (req: Request, res: Response) => {
    try {
      const { method, params, timeoutMs } = req.body;
      if (!method) {
        throw new ApiError('INVALID_REQUEST', 'method is required', 400);
      }
      const result = await gatewayManager.rpc(method, params, timeoutMs);
      res.json({ success: true, result });
    } catch (error) {
      throw new ApiError('RPC_FAILED', String(error), 500);
    }
  });

  // GET /api/gateway/health
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await gatewayManager.checkHealth();
      res.json(health);
    } catch (error) {
      throw new ApiError('HEALTH_CHECK_FAILED', String(error), 500);
    }
  });

  return router;
}
```

### File Upload Routes

**electron/server/routes/files.ts**
```typescript
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { homedir } from 'os';
import crypto from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { ApiError } from '../middleware/error';
import { getMimeType, mimeToExt, generateImagePreview } from '../../main/ipc-handlers';

const OUTBOUND_DIR = path.join(homedir(), '.openclaw', 'media', 'outbound');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    mkdirSync(OUTBOUND_DIR, { recursive: true });
    cb(null, OUTBOUND_DIR);
  },
  filename: (req, file, cb) => {
    const id = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

export function createFilesRouter(): Router {
  const router = Router();

  // POST /api/files/stage (multipart)
  router.post('/stage', upload.array('files', 10), (req: Request, res: Response) => {
    try {
      if (!req.files || !Array.isArray(req.files)) {
        throw new ApiError('NO_FILES', 'No files uploaded', 400);
      }

      const results = (req.files as Express.Multer.File[]).map(file => {
        const mimeType = getMimeType(path.extname(file.originalname));
        let preview: string | null = null;
        if (mimeType.startsWith('image/')) {
          preview = generateImagePreview(file.path, mimeType);
        }

        return {
          id: path.parse(file.filename).name,
          fileName: file.originalname,
          mimeType,
          fileSize: file.size,
          stagedPath: file.path,
          preview
        };
      });

      res.json(results);
    } catch (error) {
      throw new ApiError('FILE_STAGE_FAILED', String(error), 500);
    }
  });

  // POST /api/files/stage-buffer (base64)
  router.post('/stage-buffer', (req: Request, res: Response) => {
    try {
      const { base64, fileName, mimeType } = req.body;
      if (!base64 || !fileName) {
        throw new ApiError('INVALID_REQUEST', 'base64 and fileName required', 400);
      }

      const id = crypto.randomUUID();
      const ext = path.extname(fileName) || mimeToExt(mimeType);
      const stagedPath = path.join(OUTBOUND_DIR, `${id}${ext}`);
      const buffer = Buffer.from(base64, 'base64');

      mkdirSync(OUTBOUND_DIR, { recursive: true });
      writeFileSync(stagedPath, buffer);

      let preview: string | null = null;
      if (mimeType?.startsWith('image/')) {
        preview = generateImagePreview(stagedPath, mimeType);
      }

      res.json({
        id,
        fileName,
        mimeType: mimeType || getMimeType(ext),
        fileSize: buffer.length,
        stagedPath,
        preview
      });
    } catch (error) {
      throw new ApiError('FILE_STAGE_FAILED', String(error), 500);
    }
  });

  return router;
}
```

---

## WebSocket Implementation

### WebSocket Server Setup

**electron/server/websocket/server.ts**
```typescript
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { getSetting } from '../../utils/store';
import { GatewayManager } from '../../gateway/manager';
import { logger } from '../../utils/logger';

export async function setupWebSocket(
  req: IncomingMessage,
  socket: Socket,
  head: Buffer,
  wss: WebSocketServer,
  gatewayManager: GatewayManager
): Promise<void> {
  try {
    // Extract and validate token
    const url = new URL(req.url || '', 'ws://localhost');
    const token = url.searchParams.get('token');
    const storedToken = await getSetting('apiToken');

    if (!token || token !== storedToken) {
      logger.warn('WebSocket connection rejected: invalid token');
      socket.destroy();
      return;
    }

    // Upgrade connection
    wss.handleUpgrade(req, socket, head, (ws) => {
      setupWebSocketHandlers(ws, gatewayManager, wss);
    });
  } catch (error) {
    logger.error('WebSocket upgrade failed:', error);
    socket.destroy();
  }
}

function setupWebSocketHandlers(
  ws: WebSocket,
  gatewayManager: GatewayManager,
  wss: WebSocketServer
): void {
  logger.debug('WebSocket client connected');

  // Subscribe to gateway events
  const statusHandler = (status: unknown) => {
    broadcast(wss, {
      type: 'gateway.status_changed',
      timestamp: new Date().toISOString(),
      data: status
    });
  };

  const messageHandler = (message: unknown) => {
    broadcast(wss, {
      type: 'gateway.message',
      timestamp: new Date().toISOString(),
      data: message
    });
  };

  const notificationHandler = (notification: unknown) => {
    broadcast(wss, {
      type: 'gateway.notification',
      timestamp: new Date().toISOString(),
      data: notification
    });
  };

  gatewayManager.on('status', statusHandler);
  gatewayManager.on('message', messageHandler);
  gatewayManager.on('notification', notificationHandler);

  ws.on('close', () => {
    logger.debug('WebSocket client disconnected');
    gatewayManager.off('status', statusHandler);
    gatewayManager.off('message', messageHandler);
    gatewayManager.off('notification', notificationHandler);
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
}

function broadcast(
  wss: WebSocketServer,
  message: { type: string; timestamp: string; data: unknown }
): void {
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
```

---

## Frontend API Client

### Unified API Client

**src/lib/api-client.ts**
```typescript
import { logger } from '../utils/logger';

export interface ApiClientConfig {
  baseUrl: string;
  token: string;
}

export class ApiClient {
  private baseUrl: string;
  private token: string;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
  }

  async invoke<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options?.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.invoke<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.invoke<T>(endpoint, { method: 'GET' });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.invoke<T>(endpoint, { method: 'DELETE' });
  }

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (!this.ws) {
      this.connectWebSocket();
    }

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private connectWebSocket(): void {
    const wsUrl = `ws://127.0.0.1:3000/ws?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const callbacks = this.listeners.get(message.type);
        if (callbacks) {
          callbacks.forEach(cb => cb(message.data));
        }
      } catch (error) {
        logger.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      logger.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      logger.debug('WebSocket closed');
      this.ws = null;
    };
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

### Store Integration

**src/stores/gateway-rest.ts**
```typescript
import { create } from 'zustand';
import { ApiClient } from '../lib/api-client';
import type { GatewayStatus } from '../types/gateway';

interface GatewayRestState {
  status: GatewayStatus;
  client: ApiClient | null;
  init: (client: ApiClient) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  rpc: <T>(method: string, params?: unknown) => Promise<T>;
}

export const useGatewayRestStore = create<GatewayRestState>((set, get) => ({
  status: { state: 'stopped', port: 18789 },
  client: null,

  init: (client: ApiClient) => {
    set({ client });

    // Fetch initial status
    client.get<GatewayStatus>('/api/gateway/status')
      .then(status => set({ status }))
      .catch(err => console.error('Failed to fetch gateway status:', err));

    // Subscribe to status changes
    client.on('gateway.status_changed', (status) => {
      set({ status: status as GatewayStatus });
    });
  },

  start: async () => {
    const client = get().client;
    if (!client) throw new Error('Client not initialized');
    await client.post('/api/gateway/start');
  },

  stop: async () => {
    const client = get().client;
    if (!client) throw new Error('Client not initialized');
    await client.post('/api/gateway/stop');
  },

  restart: async () => {
    const client = get().client;
    if (!client) throw new Error('Client not initialized');
    await client.post('/api/gateway/restart');
  },

  rpc: async <T>(method: string, params?: unknown): Promise<T> => {
    const client = get().client;
    if (!client) throw new Error('Client not initialized');
    const result = await client.post<{ result: T }>('/api/gateway/rpc', {
      method,
      params
    });
    return result.result;
  }
}));
```

---

## Integration with Main Process

### Startup Sequence

**electron/main/index.ts (updated)**
```typescript
import { app, BrowserWindow } from 'electron';
import { GatewayManager } from './gateway/manager';
import { ApiServer } from './server';
import { getSetting, setSetting } from './utils/store';
import crypto from 'crypto';

let mainWindow: BrowserWindow | null = null;
let gatewayManager: GatewayManager | null = null;
let apiServer: ApiServer | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Initialize Gateway Manager
  gatewayManager = new GatewayManager();

  // Initialize API Server
  apiServer = new ApiServer(gatewayManager, 3000);
  await apiServer.start();

  // Generate or retrieve API token
  let token = await getSetting('apiToken');
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    await setSetting('apiToken', token);
  }

  // Pass token to renderer
  mainWindow.webContents.send('api:token', token);

  mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'file://' + path.join(__dirname, '../renderer/index.html'));
}

app.on('ready', createWindow);

app.on('before-quit', async () => {
  if (apiServer) await apiServer.stop();
  if (gatewayManager) await gatewayManager.stop();
});
```

---

## Testing Strategy

### Unit Tests
```typescript
// tests/api/gateway.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { ApiServer } from '../../electron/server';
import { GatewayManager } from '../../electron/gateway/manager';

describe('Gateway API', () => {
  let server: ApiServer;
  let app: Express;

  beforeEach(async () => {
    const gatewayManager = new GatewayManager();
    server = new ApiServer(gatewayManager, 3001);
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('GET /api/gateway/status returns current status', async () => {
    const response = await request(app)
      .get('/api/gateway/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('state');
    expect(response.body).toHaveProperty('port');
  });

  it('POST /api/gateway/start starts the gateway', async () => {
    const response = await request(app)
      .post('/api/gateway/start')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

---

## Migration Checklist

- [ ] Create Express server infrastructure
- [ ] Implement authentication middleware
- [ ] Create gateway routes
- [ ] Create provider routes
- [ ] Create file upload routes
- [ ] Implement WebSocket server
- [ ] Create API client wrapper
- [ ] Update frontend stores (gateway first)
- [ ] Update frontend components
- [ ] Add comprehensive tests
- [ ] Performance benchmarking
- [ ] Security audit
- [ ] Documentation update
- [ ] Gradual rollout (feature flag)
- [ ] Monitor and iterate

---

**Last Updated:** 2026-02-23
**Status:** Ready for implementation
