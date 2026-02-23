# Phase 2: Backend Server Implementation

**Status**: Not Started
**Priority**: HIGH
**Effort**: 3 days
**Dependencies**: Phase 1 (Project Setup)

## Context

Implement Express REST API routes, WebSocket server, and migrate Gateway manager from Electron to Node.js backend.

**Related Files**:
- `/Users/hnam/Desktop/ClawX-Web/electron/main/ipc-handlers.ts` - 1,652 lines, 80+ IPC handlers
- `/Users/hnam/Desktop/ClawX-Web/electron/gateway/manager.ts` - 1,163 lines, Gateway WebSocket client
- `/Users/hnam/Desktop/ClawX-Web/electron/gateway/protocol.ts` - JSON-RPC types
- `/Users/hnam/Desktop/ClawX-Web/electron/utils/` - Storage, auth, config utilities

## Overview

Day 1: Core infrastructure (auth, error handling, logging)
Day 2: Gateway routes and RPC proxy
Day 3: Provider, channel, cron, skill routes + WebSocket server

## Key Insights

- Gateway already uses JSON-RPC 2.0 (easy REST mapping)
- 80+ IPC handlers across 15 categories
- WebSocket needed for real-time events (status, messages, notifications)
- Token-based auth (32-byte random, stored in settings)
- File staging uses ~/.openclaw/media/outbound/

## Requirements

1. Implement authentication middleware (token-based)
2. Create error handling middleware
3. Implement Gateway manager service (migrate from Electron)
4. Create REST API routes for all IPC handlers
5. Implement WebSocket server for event broadcasting
6. Add request logging and rate limiting

## Architecture

### Request Flow

```
Browser → Auth Middleware → Route Handler → Service Layer → Gateway/Storage
         ↓
         Error Handler → JSON Response
```

### WebSocket Flow

```
Gateway Manager → Event Emitter → WebSocket Server → Broadcast to Clients
```

## Implementation Steps

### Day 1: Core Infrastructure (8 hours)

#### Step 1.1: Authentication Middleware (1 hour)

**server/middleware/auth.ts**:

```typescript
import { Request, Response, NextFunction } from 'express';
import { getSettings } from '../services/storage';
import { logger } from '../utils/logger';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn('Auth failed: No token', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'No token provided' });
    }

    const settings = await getSettings();

    if (token !== settings.serverToken) {
      logger.warn('Auth failed: Invalid token', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'Invalid token' });
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
```

#### Step 1.2: Error Handler Middleware (1 hour)

**server/middleware/errorHandler.ts**:

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Request error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors,
    });
  }

  // Generic error
  res.status(500).json({
    error: error.message || 'Internal server error',
  });
}
```

#### Step 1.3: Request Logger Middleware (1 hour)

**server/middleware/logger.ts**:

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
}
```

#### Step 1.4: Gateway Manager Service (5 hours)

Migrate from `electron/gateway/manager.ts` to `server/services/gateway-manager.ts`:

**server/services/gateway-manager.ts**:

```typescript
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger';
import { getSettings } from './storage';

type GatewayStatus = {
  state: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'reconnecting';
  port?: number;
  pid?: number;
  error?: string;
};

export class GatewayManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private process: ChildProcess | null = null;
  private status: GatewayStatus = { state: 'stopped' };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pendingRequests = new Map<string, any>();
  private requestId = 0;

  constructor() {
    super();
  }

  getStatus(): GatewayStatus {
    return { ...this.status };
  }

  async start(): Promise<void> {
    if (this.status.state === 'running' || this.status.state === 'starting') {
      logger.warn('Gateway already running or starting');
      return;
    }

    try {
      this.status = { state: 'starting' };
      this.emit('status', this.status);

      const settings = await getSettings();
      const port = settings.gatewayPort || 18789;

      // Spawn OpenClaw Gateway process
      this.process = spawn('openclaw', ['gateway', 'start', '--port', String(port)], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      this.process.stdout?.on('data', (data) => {
        logger.debug('Gateway stdout:', data.toString());
      });

      this.process.stderr?.on('data', (data) => {
        logger.debug('Gateway stderr:', data.toString());
      });

      this.process.on('exit', (code) => {
        logger.info('Gateway process exited', { code });
        this.emit('exit', code);
        this.handleProcessExit();
      });

      // Wait for Gateway to be ready, then connect
      await this.waitForReady(port);
      await this.connect(port);

      this.status = { state: 'running', port, pid: this.process.pid };
      this.emit('status', this.status);
      logger.info('Gateway started successfully', { port, pid: this.process.pid });
    } catch (error) {
      this.status = { state: 'error', error: String(error) };
      this.emit('status', this.status);
      this.emit('error', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.status.state === 'stopped') {
      return;
    }

    try {
      this.status = { state: 'stopping' };
      this.emit('status', this.status);

      // Close WebSocket
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      // Kill process
      if (this.process) {
        this.process.kill('SIGTERM');

        // Force kill after 5s
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
        }, 5000);
      }

      this.status = { state: 'stopped' };
      this.emit('status', this.status);
      logger.info('Gateway stopped');
    } catch (error) {
      logger.error('Failed to stop Gateway:', error);
      throw error;
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.start();
  }

  async rpc<T = any>(method: string, params?: any, timeoutMs = 30000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway not connected');
    }

    const id = String(++this.requestId);
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.ws!.send(JSON.stringify(request));
    });
  }

  async checkHealth(): Promise<{ ok: boolean; latency?: number }> {
    try {
      const start = Date.now();
      await this.rpc('ping', {}, 5000);
      const latency = Date.now() - start;
      return { ok: true, latency };
    } catch (error) {
      return { ok: false };
    }
  }

  private async waitForReady(port: number, retries = 60): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
          setTimeout(() => reject(new Error('Timeout')), 1000);
        });
        ws.close();
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    throw new Error('Gateway failed to start');
  }

  private async connect(port: number): Promise<void> {
    const settings = await getSettings();
    const token = settings.gatewayToken;

    this.ws = new WebSocket(`ws://127.0.0.1:${port}?token=${token}`);

    this.ws.on('open', () => {
      logger.info('Connected to Gateway WebSocket');
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        logger.error('Failed to parse Gateway message:', error);
      }
    });

    this.ws.on('close', () => {
      logger.warn('Gateway WebSocket closed');
      this.scheduleReconnect(port);
    });

    this.ws.on('error', (error) => {
      logger.error('Gateway WebSocket error:', error);
      this.emit('error', error);
    });
  }

  private handleMessage(message: any) {
    // JSON-RPC response
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(message.id);
      clearTimeout(timeout);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || 'RPC error'));
      } else {
        resolve(message.result);
      }
      return;
    }

    // Event notification
    if (message.method) {
      this.emit('message', message);

      // Specific event types
      if (message.method === 'status') {
        this.emit('status', message.params);
      } else if (message.method === 'notification') {
        this.emit('notification', message.params);
      } else if (message.method === 'channel:status') {
        this.emit('channel:status', message.params);
      } else if (message.method === 'chat:message') {
        this.emit('chat:message', message.params);
      }
    }
  }

  private scheduleReconnect(port: number) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached');
      this.status = { state: 'error', error: 'Connection lost' };
      this.emit('status', this.status);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.status = { state: 'reconnecting' };
    this.emit('status', this.status);

    this.reconnectTimer = setTimeout(() => {
      logger.info(`Reconnecting to Gateway (attempt ${this.reconnectAttempts})`);
      this.connect(port).catch((error) => {
        logger.error('Reconnect failed:', error);
      });
    }, delay);
  }

  private handleProcessExit() {
    this.process = null;
    this.ws = null;

    if (this.status.state !== 'stopping' && this.status.state !== 'stopped') {
      this.status = { state: 'error', error: 'Process exited unexpectedly' };
      this.emit('status', this.status);
    }
  }
}

// Singleton instance
export const gatewayManager = new GatewayManager();
```

### Day 2: Gateway Routes (8 hours)

#### Step 2.1: Gateway Routes (4 hours)

**server/routes/gateway.ts**:

```typescript
import { Router } from 'express';
import { gatewayManager } from '../services/gateway-manager';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/gateway/status
router.get('/status', (req, res) => {
  try {
    const status = gatewayManager.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Get status error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/gateway/start
router.post('/start', async (req, res) => {
  try {
    await gatewayManager.start();
    res.json({ success: true });
  } catch (error) {
    logger.error('Start gateway error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/gateway/stop
router.post('/stop', async (req, res) => {
  try {
    await gatewayManager.stop();
    res.json({ success: true });
  } catch (error) {
    logger.error('Stop gateway error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/gateway/restart
router.post('/restart', async (req, res) => {
  try {
    await gatewayManager.restart();
    res.json({ success: true });
  } catch (error) {
    logger.error('Restart gateway error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/gateway/health
router.get('/health', async (req, res) => {
  try {
    const health = await gatewayManager.checkHealth();
    res.json({ success: true, ...health });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ success: false, ok: false, error: String(error) });
  }
});

// POST /api/gateway/rpc
const rpcSchema = z.object({
  method: z.string(),
  params: z.any().optional(),
  timeoutMs: z.number().optional(),
});

router.post('/rpc', async (req, res) => {
  try {
    const { method, params, timeoutMs } = rpcSchema.parse(req.body);
    const result = await gatewayManager.rpc(method, params, timeoutMs);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('RPC error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
```

#### Step 2.2: Update app.ts with Routes (1 hour)

**server/app.ts** (updated):

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

import gatewayRoutes from './routes/gateway';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:2003', 'http://127.0.0.1:2003'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests',
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
app.use(requestLogger);

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API routes (auth required)
app.use('/api/gateway', authMiddleware, gatewayRoutes);

// Static files
app.use(express.static('dist'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'dist' });
});

// Error handling
app.use(errorHandler);

export { app };
```

#### Step 2.3: Test Gateway Routes (3 hours)

Create test script:

```bash
# Test gateway status
curl -H "Authorization: Bearer <token>" http://localhost:2003/api/gateway/status

# Test gateway start
curl -X POST -H "Authorization: Bearer <token>" http://localhost:2003/api/gateway/start

# Test RPC
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"method":"ping","params":{}}' \
  http://localhost:2003/api/gateway/rpc
```

### Day 3: Additional Routes + WebSocket (8 hours)

#### Step 3.1: Provider Routes (2 hours)

**server/routes/providers.ts**:

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
} from '../services/storage';

const router = Router();

// GET /api/providers
router.get('/', async (req, res) => {
  try {
    const providers = await getAllProviders();
    res.json(providers);
  } catch (error) {
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
    enabled: z.boolean().optional(),
  }),
  apiKey: z.string().optional(),
});

router.post('/', async (req, res) => {
  try {
    const { config, apiKey } = saveProviderSchema.parse(req.body);
    await saveProvider(config, apiKey);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// DELETE /api/providers/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteProvider(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/providers/default
router.post('/default', async (req, res) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.body);
    await setDefaultProvider(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/providers/default
router.get('/default', async (req, res) => {
  try {
    const defaultId = await getDefaultProvider();
    res.json({ id: defaultId });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
```

#### Step 3.2: WebSocket Server (4 hours)

**server/websocket/server.ts**:

```typescript
import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { gatewayManager } from '../services/gateway-manager';
import { logger } from '../utils/logger';
import { getSettings } from '../services/storage';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function startWebSocketServer(server: HTTPServer) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const ip = req.socket.remoteAddress;
    logger.info('WebSocket client connected', { ip });

    // Authenticate
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    try {
      const settings = await getSettings();
      if (token !== settings.serverToken) {
        logger.warn('WebSocket auth failed', { ip });
        ws.close(1008, 'Unauthorized');
        return;
      }
    } catch (error) {
      logger.error('WebSocket auth error:', error);
      ws.close(1011, 'Internal error');
      return;
    }

    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
      logger.info('WebSocket client disconnected', { ip });
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Forward gateway events
  gatewayManager.on('status', (status) => {
    broadcast({ type: 'gateway:status-changed', data: status });
  });

  gatewayManager.on('message', (message) => {
    broadcast({ type: 'gateway:message', data: message });
  });

  gatewayManager.on('notification', (notification) => {
    broadcast({ type: 'gateway:notification', data: notification });
  });

  gatewayManager.on('channel:status', (data) => {
    broadcast({ type: 'gateway:channel-status', data });
  });

  gatewayManager.on('chat:message', (data) => {
    broadcast({ type: 'gateway:chat-message', data });
  });

  gatewayManager.on('exit', (code) => {
    broadcast({ type: 'gateway:exit', data: code });
  });

  gatewayManager.on('error', (error) => {
    broadcast({ type: 'gateway:error', data: error.message });
  });

  logger.info('WebSocket server started on /ws');
}

function broadcast(message: any) {
  const payload = JSON.stringify(message);
  let sent = 0;

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent++;
    }
  });

  if (sent > 0) {
    logger.debug('Broadcast message', { type: message.type, clients: sent });
  }
}

export { broadcast };
```

#### Step 3.3: Update server/index.ts (1 hour)

```typescript
import { app } from './app';
import { startWebSocketServer } from './websocket/server';
import { initStorage } from './services/storage';
import { logger } from './utils/logger';
import { createServer } from 'http';

const PORT = process.env.PORT || 2003;
const HOST = '127.0.0.1';

async function start() {
  try {
    // Initialize storage
    await initStorage();
    logger.info('Storage initialized');

    // Create HTTP server
    const server = createServer(app);

    // Start WebSocket server
    startWebSocketServer(server);

    // Start listening
    server.listen(PORT, HOST, () => {
      logger.info(`Server running on http://${HOST}:${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
```

#### Step 3.4: Test WebSocket (1 hour)

Create test client:

```javascript
const ws = new WebSocket('ws://localhost:2003/ws?token=<token>');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Message:', JSON.parse(event.data));
ws.onerror = (error) => console.error('Error:', error);
ws.onclose = () => console.log('Disconnected');
```

## Todo List

### Day 1
- [ ] Create auth middleware
- [ ] Create error handler middleware
- [ ] Create request logger middleware
- [ ] Migrate Gateway manager service
- [ ] Test Gateway manager

### Day 2
- [ ] Create gateway routes
- [ ] Update app.ts with routes
- [ ] Test gateway status endpoint
- [ ] Test gateway start/stop
- [ ] Test gateway RPC

### Day 3
- [ ] Create provider routes
- [ ] Create channel routes (stub)
- [ ] Create cron routes (stub)
- [ ] Create skill routes (stub)
- [ ] Implement WebSocket server
- [ ] Update server/index.ts
- [ ] Test WebSocket connection
- [ ] Test event broadcasting

## Success Criteria

- [ ] Auth middleware enforcing token
- [ ] Gateway manager starting/stopping
- [ ] Gateway RPC calls working
- [ ] WebSocket server broadcasting events
- [ ] Provider routes CRUD working
- [ ] All routes returning proper JSON
- [ ] Error handling working
- [ ] Request logging working

## Risk Assessment

**Medium Risk**: Gateway process management
- Mitigation: Test start/stop/restart thoroughly
- Mitigation: Add process monitoring

**Low Risk**: WebSocket connection stability
- Mitigation: Auto-reconnect with exponential backoff

## Security Considerations

- Token authentication on all API routes
- WebSocket authentication via query param
- Rate limiting (100 req/min)
- Localhost-only binding
- Input validation with Zod schemas

## Next Steps

After completion, proceed to Phase 3 (Frontend API Client Migration) to replace Electron IPC with REST/WebSocket calls.
