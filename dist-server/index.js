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
            const cloudflareSettings = await getCloudflareSettings();
            if (cloudflareSettings?.tunnelEnabled && cloudflareSettings?.tunnelMode) {
                logger.info('Auto-starting Cloudflare tunnel', { mode: cloudflareSettings.tunnelMode });
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
