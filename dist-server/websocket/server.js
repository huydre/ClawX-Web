import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { gatewayManager } from '../services/gateway-manager.js';
import { getSettings } from '../services/storage.js';
export function createWebSocketServer(server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws'
    });
    wss.on('connection', async (ws, req) => {
        logger.info('WebSocket client connected', { ip: req.socket.remoteAddress });
        // Authenticate
        const token = req.headers.authorization?.replace('Bearer ', '');
        const settings = await getSettings();
        // Skip auth for localhost in development
        const isLocalhost = req.socket.remoteAddress === '127.0.0.1' ||
            req.socket.remoteAddress === '::1' ||
            req.socket.remoteAddress === '::ffff:127.0.0.1';
        if (!isLocalhost && token !== settings.serverToken) {
            logger.warn('WebSocket authentication failed', { ip: req.socket.remoteAddress });
            ws.close(1008, 'Authentication failed');
            return;
        }
        ws.isAuthenticated = true;
        // Forward gateway notifications to client
        const onNotification = (method, params) => {
            if (ws.readyState === WebSocket.OPEN) {
                logger.info('Forwarding notification to browser', { method, params });
                ws.send(JSON.stringify({
                    type: 'notification',
                    method,
                    params,
                }));
            }
        };
        const onStateChange = (state) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'stateChange',
                    state,
                }));
            }
        };
        gatewayManager.on('notification', onNotification);
        gatewayManager.on('stateChange', onStateChange);
        // Send initial state
        ws.send(JSON.stringify({
            type: 'stateChange',
            state: gatewayManager.getState(),
        }));
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                logger.debug('WebSocket message received', { message });
                // Echo back for now (can add custom handlers later)
                ws.send(JSON.stringify({ type: 'echo', data: message }));
            }
            catch (error) {
                logger.error('WebSocket message error', { error });
            }
        });
        ws.on('close', () => {
            logger.info('WebSocket client disconnected');
            gatewayManager.off('notification', onNotification);
            gatewayManager.off('stateChange', onStateChange);
        });
        ws.on('error', (error) => {
            logger.error('WebSocket error', { error: error.message });
        });
    });
    logger.info('WebSocket server created');
    return wss;
}
