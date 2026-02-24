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
                    // Create tunnel
                    const tunnel = await cfApi.createTunnel(accountId, tunnelName);
                    // Get tunnel token
                    const tunnelToken = await cfApi.getTunnelToken(accountId, tunnel.id);
                    // Create DNS record
                    const { zoneId, zoneName } = await cfApi.getZoneId(envDomain);
                    let dnsSubdomain;
                    if (envDomain === zoneName) {
                        dnsSubdomain = subdomain;
                    }
                    else {
                        const subdomainPrefix = envDomain.replace(`.${zoneName}`, '');
                        dnsSubdomain = `${subdomain}.${subdomainPrefix}`;
                    }
                    await cfApi.createDnsRecord(zoneId, dnsSubdomain, tunnel.id);
                    const publicUrl = `https://${fullDomain}`;
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
                    });
                    // Start tunnel
                    await tunnelManager.start({
                        mode: 'named',
                        token: tunnelToken,
                        localUrl: `http://localhost:${PORT}`,
                    });
                    logger.info('Tunnel auto-setup complete from environment', { publicUrl });
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
