# Research: Replacing Electron IPC with REST/WebSocket APIs

## Executive Summary

ClawX currently uses Electron IPC for main-renderer communication (130+ channels) and WebSocket JSON-RPC 2.0 for gateway communication. This research identifies patterns for migrating to REST/WebSocket while maintaining security for LAN-only deployments.

---

## 1. IPC → REST API Mapping Strategies

### Current IPC Architecture
- **Invoke pattern** (request-response): `ipcRenderer.invoke(channel, ...args)` → `ipcMain.handle(channel, handler)`
- **Event pattern** (pub-sub): `ipcRenderer.on(channel, callback)` → `mainWindow.webContents.send(channel, data)`
- **130+ channels** across: gateway, settings, providers, channels, cron, file staging, media, logs

### REST Mapping Strategy

**Invoke → POST/GET endpoints:**
```typescript
// IPC: await window.electron.ipcRenderer.invoke('gateway:status')
// REST: GET /api/gateway/status

// IPC: await window.electron.ipcRenderer.invoke('provider:setApiKey', id, key)
// REST: POST /api/providers/{id}/api-key { key: string }

// IPC: await window.electron.ipcRenderer.invoke('file:stage', paths)
// REST: POST /api/files/stage (multipart/form-data)
```

**Event → WebSocket subscriptions:**
```typescript
// IPC: window.electron.ipcRenderer.on('gateway:status-changed', handler)
// WebSocket: ws.on('message', (msg) => {
//   if (msg.type === 'gateway.status_changed') handler(msg.data)
// })
```

### Implementation Pattern
```typescript
// Express REST layer (main process)
app.post('/api/gateway/start', async (req, res) => {
  try {
    await gatewayManager.start();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Frontend client
const response = await fetch('http://127.0.0.1:3000/api/gateway/start', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 2. WebSocket Event Broadcasting

### Current Gateway Protocol
- **JSON-RPC 2.0** over WebSocket (`ws://localhost:18789/ws`)
- Request/response with correlation IDs
- Notifications (no response expected)
- Device identity authentication via handshake

### Unified Event Model
```typescript
// Broadcast to all connected clients
interface BroadcastMessage {
  type: 'gateway.status_changed' | 'chat.message' | 'channel.status';
  timestamp: string;
  data: unknown;
}

// WebSocket server (main process)
wss.broadcast((msg: BroadcastMessage) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(msg));
    }
  });
});
```

### Event Subscription Pattern
```typescript
// Frontend
const ws = new WebSocket('ws://127.0.0.1:3000/ws');
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'gateway.status_changed':
      updateGatewayStatus(msg.data);
      break;
    case 'chat.message':
      addChatMessage(msg.data);
      break;
  }
};
```

---

## 3. File Upload Handling (Express + Multer)

### Current IPC Pattern
- `file:stage` → copies files to `~/.openclaw/media/outbound/`
- `file:stageBuffer` → writes base64 buffer to disk
- `media:getThumbnails` → generates image previews
- Files referenced by path in messages

### REST + Multer Pattern
```typescript
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const outboundDir = path.join(os.homedir(), '.openclaw/media/outbound');
    cb(null, outboundDir);
  },
  filename: (req, file, cb) => {
    const id = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Endpoint
app.post('/api/files/stage', upload.array('files', 10), (req, res) => {
  const results = req.files.map(file => ({
    id: path.parse(file.filename).name,
    fileName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    stagedPath: file.path,
    preview: generateImagePreview(file.path, file.mimetype)
  }));
  res.json(results);
});
```

### Base64 Upload Fallback
```typescript
app.post('/api/files/stage-buffer', express.json({ limit: '500mb' }), (req, res) => {
  const { base64, fileName, mimeType } = req.body;
  const buffer = Buffer.from(base64, 'base64');
  const id = crypto.randomUUID();
  const ext = path.extname(fileName) || mimeToExt(mimeType);
  const stagedPath = path.join(OUTBOUND_DIR, `${id}${ext}`);

  fs.writeFileSync(stagedPath, buffer);
  res.json({ id, fileName, mimeType, fileSize: buffer.length, stagedPath });
});
```

---

## 4. CORS & Security for LAN-Only Apps

### Threat Model
- **Trusted**: Local network (127.0.0.1, localhost, 192.168.x.x)
- **Untrusted**: External networks, public internet
- **Attack vectors**: CSRF, XSS, unauthorized API access

### Security Implementation

**1. Localhost-only binding:**
```typescript
const server = app.listen(3000, '127.0.0.1', () => {
  console.log('Server listening on 127.0.0.1:3000 (localhost only)');
});
```

**2. Token-based authentication:**
```typescript
// Generate token on startup (stored in secure storage)
const token = crypto.randomBytes(32).toString('hex');
await setSetting('apiToken', token);

// Middleware
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  if (token !== getSetting('apiToken')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
```

**3. CORS for localhost:**
```typescript
import cors from 'cors';

app.use(cors({
  origin: ['http://127.0.0.1:5173', 'http://localhost:5173'], // Vite dev server
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**4. WebSocket authentication:**
```typescript
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  if (!token || token !== getSetting('apiToken')) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});
```

---

## 5. Error Handling & Logging

### Standardized Error Response
```typescript
interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

// Express error middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('API error:', err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});
```

### Request/Response Logging
```typescript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});
```

### WebSocket Error Handling
```typescript
ws.on('error', (error) => {
  logger.error('WebSocket error:', error);
  ws.close(1011, 'Server error');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    handleMessage(msg);
  } catch (error) {
    logger.error('Failed to parse message:', error);
    ws.send(JSON.stringify({
      type: 'error',
      code: 'PARSE_ERROR',
      message: 'Invalid JSON'
    }));
  }
});
```

---

## 6. Migration Roadmap

### Phase 1: Parallel Operation
- Start Express server on port 3000 (main process)
- Keep IPC handlers intact
- Implement REST endpoints alongside IPC
- Frontend uses IPC (no changes yet)

### Phase 2: Frontend Migration
- Update frontend stores to use REST/WebSocket
- Implement API client wrapper
- Gradual channel migration (gateway → providers → settings)
- A/B test both paths

### Phase 3: Cleanup
- Remove IPC handlers
- Remove preload script
- Simplify main process
- Update security model

---

## 7. Code Examples

### API Client Wrapper
```typescript
class ApiClient {
  private token: string;
  private baseUrl = 'http://127.0.0.1:3000/api';
  private ws: WebSocket | null = null;

  async invoke<T>(method: string, ...args: unknown[]): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.ws) this.connectWebSocket();
    const handler = (msg: MessageEvent) => {
      const data = JSON.parse(msg.data);
      if (data.type === event) callback(data.data);
    };
    this.ws!.addEventListener('message', handler);
    return () => this.ws!.removeEventListener('message', handler);
  }

  private connectWebSocket() {
    this.ws = new WebSocket(`ws://127.0.0.1:3000/ws?token=${this.token}`);
  }
}
```

### Express Server Setup
```typescript
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.use(cors({ origin: 'http://127.0.0.1:5173' }));
app.use(express.json({ limit: '500mb' }));
app.use(authMiddleware);

// Routes
app.get('/api/gateway/status', (req, res) => {
  res.json(gatewayManager.getStatus());
});

app.post('/api/gateway/start', async (req, res) => {
  try {
    await gatewayManager.start();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  gatewayManager.on('status', (status) => {
    ws.send(JSON.stringify({ type: 'gateway.status_changed', data: status }));
  });
});

server.listen(3000, '127.0.0.1');
```

---

## 8. Key Findings

| Aspect | IPC | REST/WebSocket |
|--------|-----|-----------------|
| **Latency** | <1ms | 1-5ms (localhost) |
| **Complexity** | Low (Electron API) | Medium (HTTP/WS) |
| **Security** | Process isolation | Token + localhost binding |
| **Scalability** | Single process | Multi-process ready |
| **Testing** | Requires Electron | Standard HTTP testing |
| **Portability** | Electron-only | Any platform |

---

## 9. References

- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/api/ipc-main)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Multer File Upload](https://github.com/expressjs/multer)
- [WebSocket Protocol RFC 6455](https://tools.ietf.org/html/rfc6455)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [OWASP CORS Security](https://owasp.org/www-community/attacks/csrf)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

## 10. Recommendations

1. **Start with gateway communication** - Already uses WebSocket JSON-RPC, easier migration
2. **Implement token auth first** - Secure the API before exposing endpoints
3. **Use localhost binding** - Prevent external access by default
4. **Maintain IPC during transition** - Parallel operation reduces risk
5. **Add comprehensive logging** - REST/WebSocket requires better observability
6. **Test with network tools** - Use curl, Postman, WebSocket clients for validation

---

**Report Generated:** 2026-02-23
**Codebase:** ClawX v0.1.15
**Status:** Ready for implementation planning
