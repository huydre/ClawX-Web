# Security & Deployment Guide: REST/WebSocket Migration

## 1. Security Architecture

### Threat Model for LAN-Only Deployment

**Assets to Protect:**
- API keys and credentials (providers, channels)
- Gateway RPC access (arbitrary code execution potential)
- File system access (read/write via file staging)
- User settings and configuration
- Chat history and messages

**Attack Vectors:**
1. **Unauthorized API access** - External attacker on LAN
2. **Token theft** - Malware/XSS stealing auth token
3. **CSRF attacks** - Malicious website triggering actions
4. **Man-in-the-middle** - Network eavesdropping
5. **File traversal** - Path injection in file operations
6. **RPC injection** - Malicious gateway method calls

### Defense Layers

#### Layer 1: Network Isolation
```typescript
// Bind to localhost only - prevents external access
const server = app.listen(3000, '127.0.0.1', () => {
  console.log('Server listening on 127.0.0.1:3000 (localhost only)');
});

// Verify in startup
if (process.env.NODE_ENV === 'production') {
  const address = server.address();
  if (address && typeof address !== 'string' && address.address !== '127.0.0.1') {
    throw new Error('Server must bind to 127.0.0.1 for security');
  }
}
```

#### Layer 2: Token-Based Authentication
```typescript
// Generate cryptographically secure token
import crypto from 'crypto';

function generateApiToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Store in secure storage (not in config files)
import { SecureStorage } from '../utils/secure-storage';

const storage = new SecureStorage();
const token = generateApiToken();
await storage.set('apiToken', token);

// Validate on every request
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = auth.slice(7);
  const storedToken = storage.get('apiToken');

  if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(storedToken))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
});
```

#### Layer 3: Input Validation & Sanitization
```typescript
import { z } from 'zod';

// Schema validation
const GatewayRpcSchema = z.object({
  method: z.string().regex(/^[a-z0-9_.]+$/i, 'Invalid method name'),
  params: z.unknown().optional(),
  timeoutMs: z.number().min(100).max(300000).optional()
});

app.post('/api/gateway/rpc', async (req, res) => {
  try {
    const validated = GatewayRpcSchema.parse(req.body);
    // Use validated data only
    const result = await gatewayManager.rpc(
      validated.method,
      validated.params,
      validated.timeoutMs
    );
    res.json({ success: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Internal error' });
  }
});
```

#### Layer 4: Path Traversal Prevention
```typescript
import path from 'path';
import { existsSync } from 'fs';

function validateFilePath(filePath: string, baseDir: string): boolean {
  // Resolve to absolute path
  const resolved = path.resolve(filePath);
  const base = path.resolve(baseDir);

  // Ensure resolved path is within base directory
  if (!resolved.startsWith(base)) {
    throw new Error('Path traversal detected');
  }

  // Ensure file exists
  if (!existsSync(resolved)) {
    throw new Error('File not found');
  }

  return true;
}

// Usage in file endpoints
app.get('/api/files/:id', (req, res) => {
  try {
    const filePath = path.join(OUTBOUND_DIR, req.params.id);
    validateFilePath(filePath, OUTBOUND_DIR);
    res.sendFile(filePath);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

#### Layer 5: Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Moderate rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  skip: (req) => req.method === 'GET' // Don't limit GET requests
});

app.use('/api/', apiLimiter);
app.post('/api/auth/login', authLimiter, (req, res) => {
  // Auth logic
});
```

#### Layer 6: CORS Hardening
```typescript
import cors from 'cors';

app.use(cors({
  origin: (origin, callback) => {
    // Only allow localhost origins
    const allowedOrigins = [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://localhost:3000'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600,
  preflightContinue: false
}));
```

#### Layer 7: Security Headers
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws://127.0.0.1:3000']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: false,
    preload: false
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'no-referrer' }
}));
```

---

## 2. Secure Configuration Management

### Environment Variables
```bash
# .env.local (never commit)
API_PORT=3000
API_HOST=127.0.0.1
NODE_ENV=production
LOG_LEVEL=info
```

### Secure Storage Pattern
```typescript
// electron/utils/secure-storage.ts
import keytar from 'keytar';

export class SecureStorage {
  private service = 'ClawX';

  async set(key: string, value: string): Promise<void> {
    await keytar.setPassword(this.service, key, value);
  }

  async get(key: string): Promise<string | null> {
    return await keytar.getPassword(this.service, key);
  }

  async delete(key: string): Promise<boolean> {
    return await keytar.deletePassword(this.service, key);
  }
}

// Usage
const storage = new SecureStorage();
const token = await storage.get('apiToken');
```

### Secrets Rotation
```typescript
// Rotate API token periodically
async function rotateApiToken(): Promise<void> {
  const oldToken = await storage.get('apiToken');
  const newToken = crypto.randomBytes(32).toString('hex');

  await storage.set('apiToken', newToken);

  // Notify all connected WebSocket clients
  broadcast(wss, {
    type: 'auth.token_rotated',
    timestamp: new Date().toISOString(),
    data: { newToken }
  });

  logger.info('API token rotated');
}

// Schedule rotation (e.g., weekly)
setInterval(rotateApiToken, 7 * 24 * 60 * 60 * 1000);
```

---

## 3. Logging & Monitoring

### Structured Logging
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'clawx-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Security Event Logging
```typescript
function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, unknown>
): void {
  logger.warn({
    type: 'security_event',
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details
  });

  // Alert on critical events
  if (severity === 'critical') {
    notifyAdmin({
      subject: `Critical Security Event: ${event}`,
      body: JSON.stringify(details, null, 2)
    });
  }
}

// Usage
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode === 401 || res.statusCode === 403) {
      logSecurityEvent('unauthorized_access_attempt', 'medium', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        statusCode: res.statusCode
      });
    }
  });
  next();
});
```

### Audit Trail
```typescript
interface AuditLog {
  timestamp: string;
  action: string;
  actor: string; // token hash
  resource: string;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
}

const auditLogs: AuditLog[] = [];

function logAudit(
  action: string,
  resource: string,
  result: 'success' | 'failure',
  details?: Record<string, unknown>
): void {
  const tokenHash = crypto.createHash('sha256')
    .update(currentToken)
    .digest('hex')
    .slice(0, 8);

  auditLogs.push({
    timestamp: new Date().toISOString(),
    action,
    actor: tokenHash,
    resource,
    result,
    details
  });

  // Persist to file
  fs.appendFileSync('audit.log', JSON.stringify(auditLogs[auditLogs.length - 1]) + '\n');
}

// Usage
app.post('/api/providers/:id/api-key', async (req, res) => {
  try {
    await updateProviderKey(req.params.id, req.body.key);
    logAudit('provider_key_updated', `provider:${req.params.id}`, 'success');
    res.json({ success: true });
  } catch (error) {
    logAudit('provider_key_updated', `provider:${req.params.id}`, 'failure', {
      error: error.message
    });
    res.status(500).json({ error: error.message });
  }
});
```

---

## 4. Deployment Patterns

### Development Setup
```bash
# Start API server with hot reload
npm run dev:api

# Start frontend dev server
npm run dev:ui

# Both connect to localhost:3000 and localhost:5173
```

### Production Build
```bash
# Build frontend
npm run build:ui

# Bundle API server
npm run build:api

# Package with Electron
npm run package
```

### Docker Deployment (Optional)
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist-electron ./dist-electron
COPY dist ./dist

ENV NODE_ENV=production
ENV API_HOST=127.0.0.1
ENV API_PORT=3000

EXPOSE 3000

CMD ["node", "dist-electron/main/index.js"]
```

### Systemd Service (Linux)
```ini
[Unit]
Description=ClawX API Server
After=network.target

[Service]
Type=simple
User=clawx
WorkingDirectory=/opt/clawx
ExecStart=/usr/bin/node /opt/clawx/dist-electron/main/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

---

## 5. Incident Response

### Security Incident Checklist
```typescript
interface SecurityIncident {
  id: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  affectedResources: string[];
  status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  actions: string[];
}

// Incident detection
function detectIncident(event: SecurityEvent): SecurityIncident | null {
  // Detect brute force attempts
  if (failedAuthAttempts > 5 && timeWindow < 5 * 60 * 1000) {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      severity: 'high',
      type: 'brute_force_attempt',
      description: 'Multiple failed authentication attempts detected',
      affectedResources: ['auth'],
      status: 'open',
      actions: [
        'Temporarily block IP',
        'Rotate API token',
        'Alert administrator'
      ]
    };
  }

  // Detect path traversal attempts
  if (event.type === 'path_traversal_attempt') {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      severity: 'critical',
      type: 'path_traversal',
      description: 'Path traversal attack detected',
      affectedResources: ['file_system'],
      status: 'open',
      actions: [
        'Block request immediately',
        'Rotate API token',
        'Alert administrator',
        'Review file access logs'
      ]
    };
  }

  return null;
}

// Incident response
async function respondToIncident(incident: SecurityIncident): Promise<void> {
  logger.error('Security incident detected', incident);

  switch (incident.severity) {
    case 'critical':
      // Immediate actions
      await rotateApiToken();
      await notifyAdmin(incident);
      break;
    case 'high':
      // Investigate and monitor
      await logAudit('security_incident', incident.type, 'failure', incident);
      break;
  }
}
```

---

## 6. Compliance & Auditing

### Data Protection
```typescript
// Encrypt sensitive data at rest
import crypto from 'crypto';

function encryptSensitiveData(data: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptSensitiveData(encrypted: string, key: string): string {
  const [iv, authTag, data] = encrypted.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key),
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Privacy Controls
```typescript
// Redact sensitive data in logs
function redactSensitiveData(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['apiKey', 'token', 'password', 'secret'];
  const redacted = { ...obj };

  for (const key of sensitiveKeys) {
    if (key in redacted) {
      const value = String(redacted[key]);
      redacted[key] = value.length > 8
        ? `${value.slice(0, 4)}***${value.slice(-4)}`
        : '***';
    }
  }

  return redacted;
}

// Usage in logging
logger.info('API request', redactSensitiveData(req.body));
```

---

## 7. Performance & Reliability

### Connection Pooling
```typescript
// Reuse WebSocket connections
class WebSocketPool {
  private connections: Map<string, WebSocket> = new Map();
  private maxConnections = 100;

  getConnection(id: string): WebSocket | null {
    return this.connections.get(id) || null;
  }

  addConnection(id: string, ws: WebSocket): void {
    if (this.connections.size >= this.maxConnections) {
      // Remove oldest connection
      const oldest = this.connections.keys().next().value;
      this.connections.delete(oldest);
    }
    this.connections.set(id, ws);
  }

  removeConnection(id: string): void {
    this.connections.delete(id);
  }
}
```

### Circuit Breaker Pattern
```typescript
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime! > 60000) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'closed';
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= 5) {
      this.state = 'open';
    }
  }
}
```

### Health Checks
```typescript
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    gateway: {
      connected: gatewayManager.isConnected(),
      status: gatewayManager.getStatus()
    }
  };

  res.json(health);
});

// Periodic health monitoring
setInterval(async () => {
  const health = await checkHealth();
  if (!health.gateway.connected) {
    logger.warn('Gateway disconnected, attempting reconnect');
    await gatewayManager.restart();
  }
}, 30000);
```

---

## 8. Testing Security

### Security Test Suite
```typescript
describe('API Security', () => {
  it('rejects requests without authorization header', async () => {
    const response = await request(app)
      .get('/api/gateway/status');
    expect(response.status).toBe(401);
  });

  it('rejects requests with invalid token', async () => {
    const response = await request(app)
      .get('/api/gateway/status')
      .set('Authorization', 'Bearer invalid-token');
    expect(response.status).toBe(403);
  });

  it('prevents path traversal attacks', async () => {
    const response = await request(app)
      .get('/api/files/../../etc/passwd')
      .set('Authorization', `Bearer ${validToken}`);
    expect(response.status).toBe(400);
  });

  it('enforces rate limiting', async () => {
    for (let i = 0; i < 101; i++) {
      await request(app)
        .get('/api/gateway/status')
        .set('Authorization', `Bearer ${validToken}`);
    }
    const response = await request(app)
      .get('/api/gateway/status')
      .set('Authorization', `Bearer ${validToken}`);
    expect(response.status).toBe(429);
  });

  it('validates input schemas', async () => {
    const response = await request(app)
      .post('/api/gateway/rpc')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ method: 'invalid@method' });
    expect(response.status).toBe(400);
  });
});
```

---

## Deployment Checklist

- [ ] Security audit completed
- [ ] All dependencies updated and scanned
- [ ] Environment variables configured
- [ ] API token generated and stored securely
- [ ] CORS whitelist configured
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Health checks implemented
- [ ] Incident response plan documented
- [ ] Security tests passing
- [ ] Performance benchmarks acceptable
- [ ] Backup and recovery plan ready
- [ ] Monitoring and alerting configured
- [ ] Documentation updated
- [ ] Team trained on security procedures

---

**Last Updated:** 2026-02-23
**Status:** Production Ready
