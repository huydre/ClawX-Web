# Quick Start: REST/WebSocket Migration

**Last Updated:** 2026-02-23
**Status:** Ready to implement

---

## 5-Minute Overview

### Current Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐         ┌──────────────────┐    │
│  │   Renderer       │         │   Main Process   │    │
│  │   (React UI)     │◄────────►│  (Node.js)       │    │
│  │                  │   IPC    │                  │    │
│  │  130+ channels   │  (130+)  │  Gateway Mgr     │    │
│  └──────────────────┘         └──────────────────┘    │
│                                        │               │
│                                        │ WebSocket     │
│                                        ▼               │
│                              ┌──────────────────┐      │
│                              │  OpenClaw        │      │
│                              │  Gateway         │      │
│                              │  (Python)        │      │
│                              └──────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### Target Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐         ┌──────────────────┐    │
│  │   Renderer       │         │   Main Process   │    │
│  │   (React UI)     │◄────────►│  (Node.js)       │    │
│  │                  │ REST/WS  │                  │    │
│  │  API Client      │          │  Express Server  │    │
│  └──────────────────┘          │  (port 3000)     │    │
│         ▲                       │                  │    │
│         │ HTTP/WS              │  Gateway Mgr     │    │
│         │ (localhost:3000)      └──────────────────┘    │
│         │                               │               │
│         └───────────────────────────────┘               │
│                                         │ WebSocket     │
│                                         ▼               │
│                               ┌──────────────────┐      │
│                               │  OpenClaw        │      │
│                               │  Gateway         │      │
│                               │  (Python)        │      │
│                               └──────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist (Quick Version)

### Day 1: Setup
- [ ] Create `electron/server/` directory structure
- [ ] Install dependencies: `express`, `cors`, `ws`, `multer`, `helmet`, `zod`
- [ ] Create `ApiServer` class in `electron/server/index.ts`
- [ ] Implement auth middleware
- [ ] Start Express server on port 3000

### Day 2: Gateway Routes
- [ ] Create `electron/server/routes/gateway.ts`
- [ ] Implement: GET /api/gateway/status, POST /api/gateway/start, etc.
- [ ] Test with curl/Postman
- [ ] Verify gateway operations work

### Day 3: WebSocket
- [ ] Create `electron/server/websocket/server.ts`
- [ ] Implement event broadcasting
- [ ] Test with WebSocket client
- [ ] Verify real-time updates

### Day 4: Frontend Client
- [ ] Create `src/lib/api-client.ts`
- [ ] Create `src/stores/gateway-rest.ts`
- [ ] Update `src/pages/Dashboard/index.tsx` to use REST
- [ ] Test UI with new API

### Day 5: File Handling
- [ ] Create `electron/server/routes/files.ts`
- [ ] Implement multipart upload
- [ ] Test file staging
- [ ] Update chat input component

---

## Code Snippets to Copy

### 1. Minimal Express Server
```typescript
// electron/server/index.ts
import express from 'express';
import cors from 'cors';
import { GatewayManager } from '../gateway/manager';

export class ApiServer {
  private app = express();
  private port: number;

  constructor(private gatewayManager: GatewayManager, port = 3000) {
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors({ origin: 'http://127.0.0.1:5173' }));
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    this.app.get('/api/gateway/status', (req, res) => {
      res.json(this.gatewayManager.getStatus());
    });

    this.app.post('/api/gateway/start', async (req, res) => {
      try {
        await this.gatewayManager.start();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, '127.0.0.1', () => {
        console.log(`API server on http://127.0.0.1:${this.port}`);
        resolve();
      });
    });
  }
}
```

### 2. Minimal API Client
```typescript
// src/lib/api-client.ts
export class ApiClient {
  constructor(private token: string) {}

  async invoke<T>(endpoint: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`http://127.0.0.1:3000${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.invoke<T>(endpoint, 'POST', body);
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.invoke<T>(endpoint, 'GET');
  }
}
```

### 3. Minimal Store Update
```typescript
// src/stores/gateway-rest.ts
import { create } from 'zustand';
import { ApiClient } from '../lib/api-client';

export const useGatewayRestStore = create((set, get) => ({
  status: { state: 'stopped', port: 18789 },
  client: null as ApiClient | null,

  init: (client: ApiClient) => {
    set({ client });
    client.get('/api/gateway/status').then(status => set({ status }));
  },

  start: async () => {
    const client = (get() as any).client;
    await client.post('/api/gateway/start', {});
  }
}));
```

---

## Testing Endpoints with curl

### Test Gateway Status
```bash
# Get status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://127.0.0.1:3000/api/gateway/status

# Start gateway
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://127.0.0.1:3000/api/gateway/start

# Stop gateway
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://127.0.0.1:3000/api/gateway/stop
```

### Test File Upload
```bash
# Upload file
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@/path/to/file.txt" \
  http://127.0.0.1:3000/api/files/stage
```

### Test WebSocket
```bash
# Using wscat (npm install -g wscat)
wscat -c "ws://127.0.0.1:3000/ws?token=YOUR_TOKEN"

# Should receive messages like:
# {"type":"gateway.status_changed","timestamp":"...","data":{...}}
```

---

## Common Issues & Solutions

### Issue: CORS Error
**Symptom:** `Access to XMLHttpRequest blocked by CORS policy`

**Solution:**
```typescript
app.use(cors({
  origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
  credentials: true
}));
```

### Issue: 401 Unauthorized
**Symptom:** All requests return 401

**Solution:**
```bash
# Verify token is being sent
curl -H "Authorization: Bearer $(cat ~/.clawx-token)" \
  http://127.0.0.1:3000/api/gateway/status

# Check token in secure storage
node -e "require('keytar').getPassword('ClawX', 'apiToken').then(console.log)"
```

### Issue: WebSocket Connection Refused
**Symptom:** `WebSocket connection failed`

**Solution:**
```typescript
// Ensure WebSocket upgrade handler is registered
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});
```

### Issue: File Upload Fails
**Symptom:** `413 Payload Too Large`

**Solution:**
```typescript
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
```

---

## Performance Tuning

### Enable Compression
```typescript
import compression from 'compression';
app.use(compression());
```

### Connection Pooling
```typescript
const http = require('http');
const agent = new http.Agent({ keepAlive: true, maxSockets: 50 });
```

### Caching
```typescript
app.get('/api/gateway/status', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(gatewayManager.getStatus());
});
```

---

## Monitoring & Debugging

### Enable Debug Logging
```bash
DEBUG=clawx:* npm run dev
```

### Monitor Network Traffic
```bash
# macOS
sudo tcpdump -i lo0 -n 'tcp port 3000'

# Linux
sudo tcpdump -i lo -n 'tcp port 3000'
```

### Check Memory Usage
```bash
node --inspect=9229 dist-electron/main/index.js
# Then open chrome://inspect
```

---

## Migration Path (Detailed)

### Step 1: Parallel Operation (No Breaking Changes)
```typescript
// Keep IPC handlers
ipcMain.handle('gateway:status', () => gatewayManager.getStatus());

// Add REST endpoint
app.get('/api/gateway/status', (req, res) => {
  res.json(gatewayManager.getStatus());
});

// Frontend still uses IPC
const status = await window.electron.ipcRenderer.invoke('gateway:status');
```

### Step 2: Gradual Frontend Migration
```typescript
// Create feature flag
const useRestApi = localStorage.getItem('useRestApi') === 'true';

// Use conditional logic
const status = useRestApi
  ? await apiClient.get('/api/gateway/status')
  : await window.electron.ipcRenderer.invoke('gateway:status');
```

### Step 3: Complete Migration
```typescript
// Remove IPC handlers
// Remove preload script
// Remove contextBridge exposure
// Use REST/WebSocket exclusively
```

---

## Rollback Plan

If issues occur:

1. **Immediate:** Disable REST API, revert to IPC
   ```typescript
   const useRestApi = false; // Feature flag
   ```

2. **Short-term:** Keep both IPC and REST running
   ```typescript
   // Both endpoints available
   // Frontend can switch via feature flag
   ```

3. **Long-term:** Fix issues and re-enable gradually
   ```typescript
   // Test with subset of users first
   // Monitor for issues
   // Gradually increase rollout
   ```

---

## Documentation Links

- **Full Research:** `RESEARCH_IPC_TO_REST_WEBSOCKET.md`
- **Implementation:** `IMPLEMENTATION_GUIDE_REST_WEBSOCKET.md`
- **Security:** `SECURITY_DEPLOYMENT_GUIDE.md`
- **Summary:** `RESEARCH_SUMMARY.md`

---

## Key Metrics to Track

### Performance
- API latency (target: <5ms)
- WebSocket message latency (target: <10ms)
- Memory usage (target: +20-30MB)
- CPU usage (target: <5% idle)

### Reliability
- Uptime (target: 99.9%)
- Error rate (target: <0.1%)
- Connection stability (target: 99.99%)

### Security
- Failed auth attempts (monitor for attacks)
- Rate limit violations (monitor for abuse)
- Error logs (monitor for exploits)

---

## Team Responsibilities

### Backend Developer
- Implement Express server
- Create REST endpoints
- Set up WebSocket server
- Write integration tests

### Frontend Developer
- Create API client wrapper
- Update Zustand stores
- Update React components
- Write unit tests

### DevOps/Security
- Configure deployment
- Set up monitoring
- Perform security audit
- Plan incident response

### QA
- Test all endpoints
- Verify security
- Performance testing
- User acceptance testing

---

## Timeline Estimate

| Phase | Duration | Effort |
|-------|----------|--------|
| Setup & Foundation | 1-2 days | 16 hours |
| Gateway Migration | 2-3 days | 24 hours |
| Provider & Settings | 2-3 days | 24 hours |
| File Handling | 1-2 days | 16 hours |
| Testing & Optimization | 2-3 days | 24 hours |
| **Total** | **8-13 days** | **104 hours** |

---

## Success Indicators

✅ All 130+ IPC channels working via REST/WebSocket
✅ API latency <5ms on localhost
✅ Zero security vulnerabilities
✅ 80%+ test coverage
✅ Complete documentation
✅ Team trained and confident
✅ Smooth user experience

---

## Next Actions

1. **Review** this quick start guide (15 min)
2. **Read** the full research documents (1-2 hours)
3. **Discuss** with team and get approval (30 min)
4. **Plan** detailed sprint (1 hour)
5. **Start** implementation (Day 1)

---

**Ready to begin? Start with Day 1 checklist above.**

For questions, refer to the detailed guides or reach out to the research team.

---

**Quick Start Guide Complete**
**Status:** Ready for Implementation
**Confidence:** High
