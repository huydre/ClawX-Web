import { app } from './app';
import { logger } from './utils/logger';
import { createWebSocketServer } from './websocket/server';
import { initStorage } from './services/storage';
import { gatewayManager } from './services/gateway-manager';

const PORT = parseInt(process.env.PORT || '2003', 10);
const HOST = '127.0.0.1';

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
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Please stop the existing server first.`);
        process.exit(1);
      } else {
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
    } catch (error) {
      logger.warn('Failed to auto-start gateway', { error });
    }

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully');

      await gatewayManager.stop();

      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
