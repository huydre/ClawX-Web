import 'dotenv/config';
import { app, dashboardProxy, novncProxy } from './app.js';
import { logger } from './utils/logger.js';
import { createWebSocketServer } from './websocket/server.js';
import { initStorage, getCloudflareSettings } from './services/storage.js';
import { initAnalytics } from './services/analytics.js';
import { gatewayManager } from './services/gateway-manager.js';
import { tunnelManager } from './services/tunnel-manager.js';
import { startAutoPairing } from './services/auto-pairing.js';
import { updateChecker } from './services/update-checker.js';
import { usbMonitor } from './services/usb-monitor.js';
import { wss } from './websocket/server.js';
import { WebSocket } from 'ws';
const PORT = parseInt(process.env.PORT || '2003', 10);
const HOST = process.env.HOST || '0.0.0.0';
async function start() {
    try {
        // Ensure git pull works even after force-push (set merge strategy)
        try {
            const { execSync } = await import('child_process');
            execSync('git config pull.rebase false', { cwd: process.cwd(), stdio: 'ignore' });
        }
        catch { /* ignore on non-git environments */ }
        // Initialize storage
        await initStorage();
        logger.info('Storage initialized');
        await initAnalytics();
        logger.info('Analytics initialized');
        // Start HTTP server
        const server = app.listen(PORT, HOST, () => {
            logger.info(`Server running on http://${HOST}:${PORT}`);
        });
        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use. Please stop the existing server first.`);
                process.exit(1);
            }
            else {
                logger.error('Server error:', error);
                process.exit(1);
            }
        });
        // Create WebSocket server
        createWebSocketServer(server);
        // Proxy WebSocket upgrade requests
        server.on('upgrade', (req, socket, head) => {
            const host = (req.headers.host || '').toLowerCase();
            const url = req.url || '';
            if (host.startsWith('dashboard-')) {
                // Dashboard proxy (OpenClaw gateway)
                dashboardProxy.upgrade(req, socket, head);
            }
            else if (url.startsWith('/vnc')) {
                // noVNC WebSocket proxy — strip /vnc prefix before forwarding
                req.url = url.replace(/^\/vnc/, '') || '/';
                novncProxy.ws(req, socket, head);
            }
        });
        // Set gateway token from environment BEFORE starting gateway
        try {
            const envGatewayToken = process.env.GATEWAY_TOKEN;
            if (envGatewayToken && envGatewayToken.trim().length > 0) {
                const { setSetting } = await import('./services/storage.js');
                await setSetting('gatewayToken', envGatewayToken.trim());
                logger.info('Gateway token set from environment');
            }
        }
        catch (error) {
            logger.warn('Failed to load gateway token from environment', { error });
        }
        // Sync gateway token FROM OpenClaw config (not the other way around)
        // OpenClaw gateway owns the token, ClawX-Web reads it
        try {
            const { getSetting, setSetting } = await import('./services/storage.js');
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');
            const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                const openclawToken = config?.gateway?.auth?.token;
                if (openclawToken) {
                    const currentToken = await getSetting('gatewayToken');
                    if (currentToken !== openclawToken) {
                        await setSetting('gatewayToken', openclawToken);
                        logger.info('Synced gateway token from OpenClaw config', { configPath });
                    }
                }
            }
        }
        catch (error) {
            logger.warn('Failed to sync gateway token from OpenClaw config', { error });
        }
        // Auto-start gateway connection
        try {
            await gatewayManager.start();
            logger.info('Gateway manager started');
        }
        catch (error) {
            logger.warn('Failed to auto-start gateway', { error });
        }
        // Auto-approve OpenClaw device pairing requests (so remote dashboard works without manual CLI)
        startAutoPairing();
        // Start update checker (polls GitHub every 6h)
        updateChecker.start();
        // Start USB device monitor and forward events to WebSocket clients
        usbMonitor.start();
        const broadcastUsb = (data) => {
            if (!wss)
                return;
            const message = JSON.stringify(data);
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        };
        usbMonitor.on('connected', (device) => broadcastUsb({ type: 'usb.connected', device }));
        usbMonitor.on('disconnected', (deviceId) => broadcastUsb({ type: 'usb.disconnected', deviceId }));
        usbMonitor.on('scan-complete', (deviceId, summary) => broadcastUsb({ type: 'usb.scan.complete', deviceId, summary }));
        // Auto-start tunnel if enabled
        try {
            // Check for environment variables first
            const envToken = process.env.CLOUDFLARE_API_TOKEN;
            const envDomain = process.env.CLOUDFLARE_TUNNEL_DOMAIN || 'veoforge.ggff.net';
            const envSubdomain = process.env.CLOUDFLARE_TUNNEL_SUBDOMAIN;
            if (envToken && envToken.trim().length > 0) {
                logger.info('Found Cloudflare API token in environment, auto-setting up tunnel', { domain: envDomain });
                // Import CloudflareAPI and auto-setup
                const { CloudflareAPI } = await import('./lib/cloudflare-api.js');
                const cfApi = new CloudflareAPI(envToken);
                // Validate token
                const isValid = await cfApi.validateToken();
                if (!isValid) {
                    logger.warn('Invalid Cloudflare API token in environment');
                }
                else {
                    // Use fixed subdomain if provided, otherwise generate random
                    const subdomain = envSubdomain || Math.random().toString(36).substring(2, 10);
                    const fullDomain = `${subdomain}.${envDomain}`;
                    const tunnelName = `clawx-${subdomain}`;
                    logger.info('Creating tunnel from environment config', { fullDomain, tunnelName, fixed: !!envSubdomain });
                    // Get account ID
                    const accountId = await cfApi.getAccountId();
                    // Check if tunnel already exists
                    let tunnel = await cfApi.findTunnelByName(accountId, tunnelName);
                    if (tunnel) {
                        logger.info('Found existing tunnel, reusing it', { tunnelId: tunnel.id, tunnelName });
                    }
                    else {
                        // Create new tunnel
                        tunnel = await cfApi.createTunnel(accountId, tunnelName);
                        logger.info('Created new tunnel', { tunnelId: tunnel.id, tunnelName });
                    }
                    // Get tunnel token
                    const tunnelToken = await cfApi.getTunnelToken(accountId, tunnel.id);
                    // Create or update DNS record
                    const { zoneId, zoneName } = await cfApi.getZoneId(envDomain);
                    let dnsSubdomain;
                    if (envDomain === zoneName) {
                        dnsSubdomain = subdomain;
                    }
                    else {
                        const subdomainPrefix = envDomain.replace(`.${zoneName}`, '');
                        dnsSubdomain = `${subdomain}.${subdomainPrefix}`;
                    }
                    // Helper: ensure DNS record points to the correct tunnel
                    const ensureDnsRecord = async (recordName, dnsSubdomainName) => {
                        const existing = await cfApi.findDnsRecord(zoneId, recordName);
                        if (existing) {
                            const expected = `${tunnel.id}.cfargotunnel.com`;
                            if (existing.content !== expected) {
                                logger.info('Updating DNS record', { recordId: existing.id, name: recordName });
                                await cfApi.updateDnsRecord(zoneId, existing.id, tunnel.id);
                            }
                            else {
                                logger.info('DNS record OK', { name: recordName });
                            }
                        }
                        else {
                            logger.info('Creating DNS record', { subdomain: dnsSubdomainName, tunnelId: tunnel.id });
                            await cfApi.createDnsRecord(zoneId, dnsSubdomainName, tunnel.id);
                        }
                    };
                    // Ensure main domain DNS record
                    await ensureDnsRecord(fullDomain, dnsSubdomain);
                    const publicUrl = `https://${fullDomain}`;
                    // Always set up dashboard subdomain when a fixed subdomain is configured.
                    // Dashboard = OpenClaw gateway web UI running on OPENCLAW_GATEWAY_PORT (default 18789).
                    // Access requires ?token=<gateway_token> — we include it in the stored URL.
                    const dashboardPort = process.env.OPENCLAW_GATEWAY_PORT || '18789';
                    const dashboardSubdomain = `dashboard-${subdomain}`;
                    const dashboardFullDomain = `${dashboardSubdomain}.${envDomain}`;
                    let dashboardDnsSubdomain;
                    if (envDomain === zoneName) {
                        dashboardDnsSubdomain = dashboardSubdomain;
                    }
                    else {
                        const subdomainPrefix = envDomain.replace(`.${zoneName}`, '');
                        dashboardDnsSubdomain = `${dashboardSubdomain}.${subdomainPrefix}`;
                    }
                    // Ensure dashboard DNS record
                    await ensureDnsRecord(dashboardFullDomain, dashboardDnsSubdomain);
                    // Set up terminal (ttyd) subdomain for remote support
                    const ttydPort = process.env.TTYD_PORT || '7681';
                    const terminalSubdomain = `terminal-${subdomain}`;
                    const terminalFullDomain = `${terminalSubdomain}.${envDomain}`;
                    let terminalDnsSubdomain;
                    if (envDomain === zoneName) {
                        terminalDnsSubdomain = terminalSubdomain;
                    }
                    else {
                        const subdomainPrefix = envDomain.replace(`.${zoneName}`, '');
                        terminalDnsSubdomain = `${terminalSubdomain}.${subdomainPrefix}`;
                    }
                    // Ensure terminal DNS record
                    await ensureDnsRecord(terminalFullDomain, terminalDnsSubdomain);
                    const terminalUrl = `https://${terminalFullDomain}`;
                    logger.info('Terminal tunnel ingress configured', { terminalUrl });
                    // Set up Company 3D (Claw3D) subdomain
                    const companyPort = process.env.COMPANY_3D_PORT || '3333';
                    const companySubdomain = `company-${subdomain}`;
                    const companyFullDomain = `${companySubdomain}.${envDomain}`;
                    let companyDnsSubdomain;
                    if (envDomain === zoneName) {
                        companyDnsSubdomain = companySubdomain;
                    }
                    else {
                        const subdomainPrefix = envDomain.replace(`.${zoneName}`, '');
                        companyDnsSubdomain = `${companySubdomain}.${subdomainPrefix}`;
                    }
                    await ensureDnsRecord(companyFullDomain, companyDnsSubdomain);
                    logger.info('Company 3D tunnel ingress configured', { companyFullDomain });
                    // Set tunnel ingress rules via API so all hostnames route to the right service
                    await cfApi.updateTunnelConfig(accountId, tunnel.id, [
                        { hostname: fullDomain, service: `http://localhost:${PORT}` },
                        { hostname: dashboardFullDomain, service: `http://localhost:${dashboardPort}` },
                        { hostname: terminalFullDomain, service: `http://localhost:${ttydPort}` },
                        { hostname: companyFullDomain, service: `http://localhost:${companyPort}` },
                        { service: 'http_status:404' },
                    ]);
                    // Build dashboard URL with gateway auth token so users can open it directly
                    const { getSetting } = await import('./services/storage.js');
                    const gatewayToken = await getSetting('gatewayToken');
                    const dashboardUrl = `https://${dashboardFullDomain}/?token=${gatewayToken}`;
                    logger.info('Dashboard tunnel ingress configured', { dashboardUrl });
                    // Save configuration
                    const { saveCloudflareSettings } = await import('./services/storage.js');
                    await saveCloudflareSettings({
                        tunnelEnabled: true,
                        tunnelMode: 'named',
                        tunnelId: tunnel.id,
                        tunnelName: tunnel.name,
                        tunnelToken,
                        accountId,
                        domain: fullDomain,
                        publicUrl,
                        dashboardUrl,
                        terminalUrl,
                        useIngressConfig: false,
                    });
                    // Use --url pointing to ClawX (port 2003).
                    // Dashboard routing is handled by the Express proxy middleware (Host: dashboard-*).
                    await tunnelManager.start({
                        mode: 'named',
                        token: tunnelToken,
                        localUrl: `http://localhost:${PORT}`,
                    });
                    logger.info('Tunnel auto-setup complete from environment', { publicUrl, dashboardUrl });
                }
            }
            else {
                // Fallback to saved settings
                const cloudflareSettings = await getCloudflareSettings();
                if (cloudflareSettings?.tunnelEnabled && cloudflareSettings?.tunnelMode) {
                    logger.info('Auto-starting Cloudflare tunnel from saved settings', { mode: cloudflareSettings.tunnelMode });
                    if (cloudflareSettings.tunnelMode === 'quick') {
                        await tunnelManager.start({
                            mode: 'quick',
                            localUrl: `http://localhost:${PORT}`,
                        });
                        logger.info('Quick tunnel started automatically');
                    }
                    else if (cloudflareSettings.tunnelMode === 'named' && cloudflareSettings.tunnelToken) {
                        await tunnelManager.start({
                            mode: 'named',
                            token: cloudflareSettings.tunnelToken,
                            localUrl: `http://localhost:${PORT}`,
                        });
                        logger.info('Named tunnel started automatically');
                    }
                }
            }
        }
        catch (error) {
            logger.warn('Failed to auto-start tunnel', { error });
        }
        // Graceful shutdown
        const shutdown = async () => {
            logger.info('Shutting down gracefully');
            usbMonitor.stop();
            await gatewayManager.stop();
            await tunnelManager.stop();
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
    catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
start();
