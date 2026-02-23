"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebSocketServer = createWebSocketServer;
const ws_1 = require("ws");
const logger_1 = require("../utils/logger");
const gateway_manager_1 = require("../services/gateway-manager");
const storage_1 = require("../services/storage");
function createWebSocketServer(server) {
    const wss = new ws_1.WebSocketServer({
        server,
        path: '/ws'
    });
    wss.on('connection', async (ws, req) => {
        logger_1.logger.info('WebSocket client connected', { ip: req.socket.remoteAddress });
        // Authenticate
        const token = req.headers.authorization?.replace('Bearer ', '');
        const settings = await (0, storage_1.getSettings)();
        if (token !== settings.serverToken) {
            logger_1.logger.warn('WebSocket authentication failed', { ip: req.socket.remoteAddress });
            ws.close(1008, 'Authentication failed');
            return;
        }
        ws.isAuthenticated = true;
        // Forward gateway notifications to client
        const onNotification = (method, params) => {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'notification',
                    method,
                    params,
                }));
            }
        };
        const onStateChange = (state) => {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'stateChange',
                    state,
                }));
            }
        };
        gateway_manager_1.gatewayManager.on('notification', onNotification);
        gateway_manager_1.gatewayManager.on('stateChange', onStateChange);
        // Send initial state
        ws.send(JSON.stringify({
            type: 'stateChange',
            state: gateway_manager_1.gatewayManager.getState(),
        }));
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                logger_1.logger.debug('WebSocket message received', { message });
                // Echo back for now (can add custom handlers later)
                ws.send(JSON.stringify({ type: 'echo', data: message }));
            }
            catch (error) {
                logger_1.logger.error('WebSocket message error', { error });
            }
        });
        ws.on('close', () => {
            logger_1.logger.info('WebSocket client disconnected');
            gateway_manager_1.gatewayManager.off('notification', onNotification);
            gateway_manager_1.gatewayManager.off('stateChange', onStateChange);
        });
        ws.on('error', (error) => {
            logger_1.logger.error('WebSocket error', { error: error.message });
        });
    });
    logger_1.logger.info('WebSocket server created');
    return wss;
}
