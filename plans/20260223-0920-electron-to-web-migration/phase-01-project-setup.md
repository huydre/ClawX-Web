# Phase 1: Project Setup & Dependencies

**Status**: Not Started
**Priority**: HIGH
**Effort**: 1 day
**Dependencies**: None

## Context

Set up Node.js backend infrastructure and remove Electron dependencies. Create directory structure for Express server.

**Related Files**:
- `/Users/hnam/Desktop/ClawX-Web/package.json` - Dependencies
- `/Users/hnam/Desktop/ClawX-Web/vite.config.ts` - Build config
- `/Users/hnam/Desktop/ClawX-Web/tsconfig.json` - TypeScript config

## Overview

Create backend directory structure, install Express/WebSocket dependencies, remove Electron packages, update build configuration.

## Key Insights

- Electron dependencies: electron, electron-builder, electron-store, electron-updater, vite-plugin-electron
- Need Express, ws, multer, lowdb for backend
- Port 2003 for web server, 18789 for gateway
- Localhost-only binding for security

## Requirements

1. Create server/ directory structure
2. Install backend dependencies
3. Remove Electron dependencies
4. Update vite.config.ts (remove Electron plugins)
5. Update package.json scripts
6. Create backend entry point

## Architecture

### Directory Structure

```
server/
├── index.ts              # Entry point
├── app.ts                # Express app setup
├── routes/               # REST API routes
│   ├── gateway.ts
│   ├── providers.ts
│   ├── channels.ts
│   ├── cron.ts
│   ├── skills.ts
│   ├── files.ts
│   └── settings.ts
├── middleware/           # Auth, logging, errors
│   ├── auth.ts
│   ├── logger.ts
│   └── errorHandler.ts
├── services/             # Business logic
│   ├── gateway-manager.ts
│   ├── storage.ts
│   └── file-handler.ts
├── websocket/            # WebSocket server
│   └── server.ts
└── utils/                # Utilities
    ├── paths.ts
    ├── config.ts
    └── logger.ts
```

## Implementation Steps

### Step 1: Create Directory Structure (30 min)

```bash
mkdir -p server/{routes,middleware,services,websocket,utils}
touch server/index.ts server/app.ts
touch server/routes/{gateway,providers,channels,cron,skills,files,settings}.ts
touch server/middleware/{auth,logger,errorHandler}.ts
touch server/services/{gateway-manager,storage,file-handler}.ts
touch server/websocket/server.ts
touch server/utils/{paths,config,logger}.ts
```

### Step 2: Install Backend Dependencies (15 min)

```bash
pnpm add express cors ws multer helmet express-rate-limit lowdb zod winston
pnpm add -D @types/express @types/multer @types/cors @types/ws tsx nodemon
```

**Dependencies**:
- `express` - Web server
- `cors` - CORS middleware
- `ws` - WebSocket server
- `multer` - File upload
- `helmet` - Security headers
- `express-rate-limit` - Rate limiting
- `lowdb` - JSON file storage
- `zod` - Schema validation
- `winston` - Logging
- `tsx` - TypeScript execution
- `nodemon` - Auto-reload

### Step 3: Remove Electron Dependencies (15 min)

```bash
pnpm remove electron electron-builder electron-store electron-updater vite-plugin-electron vite-plugin-electron-renderer
```

### Step 4: Update package.json Scripts (15 min)

```json
{
  "scripts": {
    "dev": "vite",
    "dev:server": "nodemon --watch server --exec tsx server/index.ts",
    "build": "vite build",
    "build:server": "tsc --project tsconfig.server.json",
    "start": "node dist-server/index.js",
    "preview": "vite preview",
    "lint": "eslint . --fix",
    "typecheck": "tsc --noEmit && tsc --project tsconfig.server.json --noEmit",
    "test": "vitest"
  }
}
```

### Step 5: Create tsconfig.server.json (15 min)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist-server",
    "rootDir": "./server",
    "types": ["node"]
  },
  "include": ["server/**/*"],
  "exclude": ["node_modules", "dist", "dist-server"]
}
```

### Step 6: Update vite.config.ts (30 min)

Remove Electron plugins:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:2003',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:2003',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
```

### Step 7: Create Basic Server Entry Point (1 hour)

**server/index.ts**:

```typescript
import { app } from './app';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 2003;
const HOST = '127.0.0.1'; // Localhost only

async function start() {
  try {
    const server = app.listen(PORT, HOST, () => {
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

**server/app.ts**:

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:2003', 'http://127.0.0.1:2003'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve static files
app.use(express.static('dist'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'dist' });
});

export { app };
```

**server/utils/logger.ts**:

```typescript
import winston from 'winston';
import path from 'path';
import { homedir } from 'os';

const logDir = path.join(homedir(), '.clawx', 'logs');

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
  ],
});
```

### Step 8: Test Server Startup (30 min)

```bash
# Start dev server
pnpm dev:server

# In another terminal, test health check
curl http://localhost:2003/health
```

Expected response:
```json
{"status":"ok","timestamp":1708681258829}
```

## Todo List

- [ ] Create server/ directory structure
- [ ] Install backend dependencies (express, ws, multer, lowdb, etc.)
- [ ] Remove Electron dependencies
- [ ] Create tsconfig.server.json
- [ ] Update vite.config.ts (remove Electron plugins)
- [ ] Update package.json scripts
- [ ] Create server/index.ts entry point
- [ ] Create server/app.ts Express setup
- [ ] Create server/utils/logger.ts
- [ ] Test server startup
- [ ] Verify health check endpoint

## Success Criteria

- [ ] server/ directory structure created
- [ ] Backend dependencies installed
- [ ] Electron dependencies removed
- [ ] Server starts on port 2003
- [ ] Health check responds with 200 OK
- [ ] No TypeScript errors
- [ ] Logs written to ~/.clawx/logs/

## Risk Assessment

**Low Risk**: Standard Node.js setup
- Mitigation: Follow Express best practices

**Low Risk**: Dependency conflicts
- Mitigation: Use pnpm for clean installs

## Security Considerations

- Bind to localhost only (127.0.0.1)
- Use helmet for security headers
- CORS restricted to localhost origins
- Rate limiting (added in Phase 2)

## Next Steps

After completion, proceed to Phase 2 (Backend Server Implementation) to implement REST API routes and WebSocket server.
