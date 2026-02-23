import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { getSetting } from './storage';

type GatewayState = 'stopped' | 'starting' | 'connected' | 'error';

class GatewayManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: GatewayState = 'stopped';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private requestId = 0;

  constructor() {
    super();
  }

  getState(): GatewayState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  async start(): Promise<void> {
    if (this.state === 'starting' || this.state === 'connected') {
      logger.warn('Gateway already starting or connected');
      return;
    }

    this.setState('starting');
    await this.connect();
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Gateway stopped'));
      this.pendingRequests.delete(id);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('stopped');
  }

  async rpc(method: string, params?: any, timeoutMs = 30000): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Gateway not connected');
    }

    const id = `rpc-${++this.requestId}`;
    const request = {
      type: 'req',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        this.ws!.send(JSON.stringify(request));
        logger.debug('RPC request sent', { method, params, id });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  private async connect(): Promise<void> {
    try {
      const gatewayPort = await getSetting('gatewayPort');
      const gatewayToken = await getSetting('gatewayToken');
      const url = `ws://127.0.0.1:${gatewayPort}`;

      logger.info('Connecting to gateway', { url });

      // Try connecting without Authorization header first
      // OpenClaw Gateway might not require authentication for localhost connections
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        logger.info('Gateway connected');
        this.setState('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Start ping interval to keep connection alive
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            // Send WebSocket ping to keep connection alive
            this.ws.ping();
          }
        }, 8000); // Ping every 8 seconds (before 10s timeout)
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());

          // Handle connect.challenge event - send proper connect request
          if (message.type === 'event' && message.event === 'connect.challenge') {
            logger.info('Received connect challenge', { nonce: message.payload?.nonce });

            // Send connect request with proper protocol
            const connectReq = {
              type: 'req',
              id: 'connect-1',
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: 'webchat',
                  version: '0.1.15',
                  platform: 'web',
                  mode: 'webchat'
                },
                role: 'operator',
                scopes: ['operator.read', 'operator.write', 'operator.admin'],
                auth: { token: gatewayToken },
                locale: 'en-US',
                userAgent: 'clawx-web/0.1.15'
              }
            };

            this.ws!.send(JSON.stringify(connectReq));
            logger.info('Sent connect request');
            return;
          }

          // Handle connect response
          if (message.type === 'res' && message.id === 'connect-1') {
            if (message.ok) {
              logger.info('Gateway handshake completed successfully');
            } else {
              logger.error('Gateway handshake failed', { error: message.error });
              this.setState('error');
            }
            return;
          }

          this.handleMessage(message);
        } catch (error) {
          logger.error('Failed to parse gateway message', { error, data: data.toString() });
        }
      });

      this.ws.on('error', (error) => {
        logger.error('Gateway WebSocket error', { error: error.message, stack: error.stack });
        this.setState('error');
      });

      this.ws.on('close', (code, reason) => {
        logger.warn('Gateway disconnected', { code, reason: reason.toString() });
        this.ws = null;

        // Clear ping interval
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        if (this.state !== 'stopped') {
          this.setState('error');
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      logger.error('Failed to connect to gateway', { error });
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  private handleMessage(message: any): void {
    // Handle OpenClaw protocol response (type: 'res')
    if (message.type === 'res' && message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);

        if (message.ok) {
          pending.resolve(message.payload);
        } else {
          const errorMsg = message.error?.message || 'Unknown error';
          pending.reject(new Error(errorMsg));
        }
      }
      return;
    }

    // Handle OpenClaw protocol event (type: 'event')
    if (message.type === 'event' && message.event) {
      logger.info('Gateway event received', { event: message.event, payload: message.payload });
      this.emit('notification', message.event, message.payload);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    const delay = 5000; // 5 seconds
    logger.info('Scheduling gateway reconnect', { delay });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.state !== 'stopped') {
        this.connect();
      }
    }, delay);
  }

  private setState(state: GatewayState): void {
    if (this.state !== state) {
      const oldState = this.state;
      this.state = state;
      logger.info('Gateway state changed', { from: oldState, to: state });
      this.emit('stateChange', state, oldState);
    }
  }
}

// Singleton instance
export const gatewayManager = new GatewayManager();
