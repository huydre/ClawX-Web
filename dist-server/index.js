"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const logger_1 = require("./utils/logger");
const server_1 = require("./websocket/server");
const storage_1 = require("./services/storage");
const gateway_manager_1 = require("./services/gateway-manager");
const PORT = parseInt(process.env.PORT || '2003', 10);
const HOST = '127.0.0.1';
async function start() {
    try {
        // Initialize storage
        await (0, storage_1.initStorage)();
        logger_1.logger.info('Storage initialized');
        // Start HTTP server
        const server = app_1.app.listen(PORT, HOST, () => {
            logger_1.logger.info(`Server running on http://${HOST}:${PORT}`);
        });
        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger_1.logger.error(`Port ${PORT} is already in use. Please stop the existing server first.`);
                process.exit(1);
            }
            else {
                logger_1.logger.error('Server error:', error);
                process.exit(1);
            }
        });
        // Create WebSocket server
        (0, server_1.createWebSocketServer)(server);
        // Auto-start gateway connection
        try {
            await gateway_manager_1.gatewayManager.start();
            logger_1.logger.info('Gateway manager started');
        }
        catch (error) {
            logger_1.logger.warn('Failed to auto-start gateway', { error });
        }
        // Graceful shutdown
        const shutdown = async () => {
            logger_1.logger.info('Shutting down gracefully');
            await gateway_manager_1.gatewayManager.stop();
            server.close(() => {
                logger_1.logger.info('Server closed');
                process.exit(0);
            });
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
start();
