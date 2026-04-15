import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import providersRouter from './routes/providers.js';
import gatewayRouter from './routes/gateway.js';
import settingsRouter from './routes/settings.js';
import filesRouter from './routes/files.js';
import clawhubRouter from './routes/clawhub.js';
import tunnelRouter from './routes/tunnel.js';
import channelsRouter from './routes/channels.js';
import systemRouter from './routes/system.js';
import pairingRouter from './routes/pairing.js';
import authRouter from './routes/auth.js';
import oauthRouter from './routes/oauth.js';
import channelConfigRouter from './routes/channel-config.js';
import googleAuthRouter from './routes/google-auth.js';
import wifiRouter from './routes/wifi.js';
import analyticsRouter from './routes/analytics.js';
import agentsConfigRouter from './routes/agents-config.js';
import usbRouter from './routes/usb.js';
import fileManagerRouter from './routes/file-manager.js';
import { startAutoRefresh } from './routes/google-auth.js';
import { authMiddleware } from './middleware/auth.js';
const app = express();
// ============================================================================
// Dashboard reverse proxy
// Requests with Host: dashboard-* are proxied to the OpenClaw gateway web UI.
// This runs BEFORE all other middleware so that dashboard traffic never reaches
// the ClawX static file handlers.
// ============================================================================
const DASHBOARD_PORT = process.env.OPENCLAW_GATEWAY_PORT || '18789';
const dashboardProxy = createProxyMiddleware({
    target: `http://127.0.0.1:${DASHBOARD_PORT}`,
    changeOrigin: true,
    ws: true,
    on: {
        error: (_err, _req, res) => {
            res.status(502).send('OpenClaw dashboard is unavailable');
        },
    },
});
app.use((req, res, next) => {
    const host = (req.headers.host || '').toLowerCase();
    if (host.startsWith('dashboard-')) {
        return dashboardProxy(req, res, next);
    }
    next();
});
// Security
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    hsts: false, // Disable HSTS for HTTP deployment
    contentSecurityPolicy: false, // Disable CSP to allow CSS/JS loading through Cloudflare Tunnel
}));
app.use(cors({
    origin: [
        'http://localhost:2003',
        'http://127.0.0.1:2003',
        'http://127.0.0.1:5173',
        'http://localhost:5173', // Vite dev server
        'http://localhost:5174', // Vite dev server
        'http://127.0.0.1:5174',
        '*'
    ],
    credentials: true,
}));
// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Request logging
app.use(requestLogger);
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
// Auth routes (before auth middleware so login endpoints are accessible)
app.use('/api/auth', authRouter);
// OAuth callback must be before auth middleware (OpenAI redirects here)
app.use('/api/oauth', oauthRouter);
// Google Auth callback must be before auth middleware (Google redirects here)
app.use('/api/google-auth', googleAuthRouter);
// Password gate — all routes below require authentication
app.use(authMiddleware);
// API routes
app.use('/api/providers', providersRouter);
app.use('/api/gateway', gatewayRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/files', filesRouter);
app.use('/api/clawhub', clawhubRouter);
app.use('/api/tunnel', tunnelRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/system', systemRouter);
app.use('/api/pairing', pairingRouter);
app.use('/api/channel-config', channelConfigRouter);
app.use('/api/wifi', wifiRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/agents-config', agentsConfigRouter);
app.use('/api/usb', usbRouter);
app.use('/api/fm', fileManagerRouter);
import cronRouter from './routes/cron.js';
app.use('/api/cron', cronRouter);
import ticketsRouter from './routes/tickets.js';
app.use('/api/tickets', ticketsRouter);
// Serve hashed assets with long-term immutable cache
app.use('/assets', express.static(path.join('dist', 'assets'), {
    maxAge: '1y',
    immutable: true,
}));
// Serve other static files with no-cache (index.html etc.)
app.use(express.static('dist', {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    },
}));
// SPA fallback - use middleware instead of route
app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws') && !req.path.startsWith('/assets')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    }
    else {
        next();
    }
});
// Error handler (must be last)
app.use(errorHandler);
// Start Google token auto-refresh if already connected
startAutoRefresh();
export { app, dashboardProxy };
