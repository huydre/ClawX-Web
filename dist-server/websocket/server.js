import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { gatewayManager } from '../services/gateway-manager.js';
import { tunnelManager } from '../services/tunnel-manager.js';
import { updateChecker } from '../services/update-checker.js';
import { getSettings } from '../services/storage.js';
// Exported so routes can broadcast to all clients
export let wss;
export function createWebSocketServer(server) {
    wss = new WebSocketServer({
        server,
        path: '/ws'
    });
    wss.on('connection', async (ws, req) => {
        logger.info('WebSocket client connected', { ip: req.socket.remoteAddress });
        // Authenticate: check Authorization header or query param ?token=xxx
        const headerToken = req.headers.authorization?.replace('Bearer ', '');
        const queryToken = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('token');
        const token = headerToken || queryToken || '';
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
        const onTunnelStateChange = (state) => {
            if (ws.readyState === WebSocket.OPEN) {
                const status = tunnelManager.getStatus();
                logger.info('Sending tunnel state change to browser', { state, status });
                ws.send(JSON.stringify({
                    type: 'tunnelStateChange',
                    state,
                    status,
                }));
            }
        };
        const onTunnelConnected = (status) => {
            if (ws.readyState === WebSocket.OPEN) {
                logger.info('Sending tunnel connected to browser', { status });
                ws.send(JSON.stringify({
                    type: 'tunnelConnected',
                    status,
                }));
            }
        };
        const onTunnelDisconnected = () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'tunnelDisconnected',
                }));
            }
        };
        const onUpdateChecked = (info) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'updateInfo', info }));
            }
        };
        gatewayManager.on('notification', onNotification);
        gatewayManager.on('stateChange', onStateChange);
        tunnelManager.on('stateChange', onTunnelStateChange);
        tunnelManager.on('connected', onTunnelConnected);
        tunnelManager.on('disconnected', onTunnelDisconnected);
        updateChecker.on('checked', onUpdateChecked);
        // Send initial state
        ws.send(JSON.stringify({
            type: 'stateChange',
            state: gatewayManager.getState(),
        }));
        // Send initial tunnel state
        ws.send(JSON.stringify({
            type: 'tunnelStateChange',
            state: tunnelManager.getState(),
            status: tunnelManager.getStatus(),
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
        // Send cached update info if available
        const cachedInfo = updateChecker.getCached();
        if (cachedInfo) {
            ws.send(JSON.stringify({ type: 'updateInfo', info: cachedInfo }));
        }
        ws.on('close', () => {
            logger.info('WebSocket client disconnected');
            gatewayManager.off('notification', onNotification);
            gatewayManager.off('stateChange', onStateChange);
            tunnelManager.off('stateChange', onTunnelStateChange);
            tunnelManager.off('connected', onTunnelConnected);
            tunnelManager.off('disconnected', onTunnelDisconnected);
            updateChecker.off('checked', onUpdateChecked);
        });
        ws.on('error', (error) => {
            logger.error('WebSocket error', { error: error.message });
        });
    });
    logger.info('WebSocket server created');
    return wss;
}
