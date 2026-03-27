import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from '../utils/logger.js';
import { gatewayManager } from '../services/gateway-manager.js';
import { tunnelManager } from '../services/tunnel-manager.js';
import { updateChecker } from '../services/update-checker.js';
import { getSettings } from '../services/storage.js';
import { trackEvent } from '../services/analytics.js';

// Exported so routes can broadcast to all clients
export let wss: WebSocketServer;

interface AuthenticatedWebSocket extends WebSocket {
  isAuthenticated?: boolean;
}

export function createWebSocketServer(server: any): WebSocketServer {
  wss = new WebSocketServer({
    server,
    path: '/ws'
  });

  wss.on('connection', async (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
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
    const onNotification = (method: string, params: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        logger.info('Forwarding notification to browser', { method, params });
        ws.send(JSON.stringify({
          type: 'notification',
          method,
          params,
        }));
      }

      // --- Analytics tracking (fire-and-forget, errors silenced) ---
      try {
        const sessionKey = params?.sessionKey || params?.data?.sessionKey;
        const eventState = params?.state || params?.data?.state;
        const message = params?.message || params?.data?.message;

        if (method === 'agent' || method === 'chat') {
          // Track assistant response completion
          if (eventState === 'final') {
            // Check if the final message contains tool_use blocks
            const content = message?.content;
            const hasToolUse = Array.isArray(content) &&
              content.some((b: any) => b.type === 'tool_use' || b.type === 'toolCall');

            if (hasToolUse) {
              const toolNames = content
                .filter((b: any) => b.type === 'tool_use' || b.type === 'toolCall')
                .map((b: any) => b.name)
                .filter(Boolean);
              trackEvent({
                type: 'tool_call',
                sessionKey,
                metadata: { method, toolNames },
              }).catch(() => {});
            }

            // Check if this is a tool_result role (tool execution result)
            const role = message?.role;
            const isToolResult = typeof role === 'string' &&
              (role.toLowerCase() === 'toolresult' || role.toLowerCase() === 'tool_result');

            if (!isToolResult) {
              trackEvent({
                type: 'message_received',
                sessionKey,
                metadata: { method },
              }).catch(() => {});
            }
          }
        } else if (method.startsWith('channels.') || method.startsWith('channel.')) {
          trackEvent({
            type: 'channel_activity',
            channel: params?.channelType || params?.channelId || method,
            metadata: { method, channelType: params?.channelType },
          }).catch(() => {});
        }
      } catch {
        // Silently ignore analytics errors
      }
    };

    const onStateChange = (state: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'stateChange',
          state,
        }));
      }
    };

    const onTunnelStateChange = (state: string) => {
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

    const onTunnelConnected = (status: any) => {
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

    const onUpdateChecked = (info: any) => {
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

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        logger.debug('WebSocket message received', { message });

        // Echo back for now (can add custom handlers later)
        ws.send(JSON.stringify({ type: 'echo', data: message }));
      } catch (error) {
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
