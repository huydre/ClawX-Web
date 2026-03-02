import 'dotenv/config';
import { app } from './app.js';
import { logger } from './utils/logger.js';
import { createWebSocketServer } from './websocket/server.js';
import { initStorage, getCloudflareSettings } from './services/storage.js';
import { gatewayManager } from './services/gateway-manager.js';
import { tunnelManager } from './services/tunnel-manager.js';
const PORT = parseInt(process.env.PORT || '2003', 10);
const HOST = process.env.HOST || '0.0.0.0';
async function start() {
    try {
        // Initialize storage
        await initStorage();
        logger.info('Storage initialized');
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
        // Sync gateway token to OpenClaw config so gateway uses same auth token
        try {
            const { getSetting } = await import('./services/storage.js');
            const gatewayToken = await getSetting('gatewayToken');
            if (gatewayToken) {
                const fs = await import('fs');
                const path = await import('path');
                const os = await import('os');
                const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
                if (fs.existsSync(configPath)) {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    const currentToken = config?.gateway?.auth?.token;
                    if (currentToken !== gatewayToken) {
                        if (!config.gateway)
                            config.gateway = {};
                        if (!config.gateway.auth)
                            config.gateway.auth = {};
                        config.gateway.auth.token = gatewayToken;
                        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                        logger.info('Synced gateway auth token to OpenClaw config', { configPath });
                    }
                }
            }
        }
        catch (error) {
            logger.warn('Failed to sync gateway token to OpenClaw config', { error });
        }
        // Auto-start gateway connection
        try {
            await gatewayManager.start();
            logger.info('Gateway manager started');
        }
        catch (error) {
            logger.warn('Failed to auto-start gateway', { error });
        }
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
                    // Check if OpenClaw dashboard port is configured
                    const dashboardPort = process.env.CLOUDFLARE_DASHBOARD_PORT;
                    const hasDashboard = dashboardPort && parseInt(dashboardPort, 10) > 0;
                    let dashboardUrl;
                    let useIngressConfig = false;
                    if (hasDashboard) {
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
                        // Set tunnel ingress rules via API so both hostnames are routed correctly
                        await cfApi.updateTunnelConfig(accountId, tunnel.id, [
                            { hostname: fullDomain, service: `http://localhost:${PORT}` },
                            { hostname: dashboardFullDomain, service: `http://localhost:${dashboardPort}` },
                            { service: 'http_status:404' },
                        ]);
                        dashboardUrl = `https://${dashboardFullDomain}`;
                        useIngressConfig = true;
                        logger.info('Dashboard tunnel ingress configured', { dashboardUrl });
                    }
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
                        useIngressConfig,
                    });
                    // Start tunnel — without --url when ingress config is set via API
                    await tunnelManager.start({
                        mode: 'named',
                        token: tunnelToken,
                        ...(useIngressConfig ? { useIngressConfig: true } : { localUrl: `http://localhost:${PORT}` }),
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
                            ...(cloudflareSettings.useIngressConfig
                                ? { useIngressConfig: true }
                                : { localUrl: `http://localhost:${PORT}` }),
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
