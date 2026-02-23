import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { getSetting } from './storage';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

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

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
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

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
        },
      });

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
            // Send both WebSocket ping and RPC ping
            this.ws.ping();
            // Send a lightweight RPC call to keep the connection active
            this.rpc('ping').catch(() => {
              // Ignore ping errors
            });
          }
        }, 8000); // Ping every 8 seconds (before 10s timeout)
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          logger.error('Failed to parse gateway message', { error, data: data.toString() });
        }
      });

      this.ws.on('error', (error) => {
        logger.error('Gateway WebSocket error', { error: error.message });
        this.setState('error');
      });

      this.ws.on('close', () => {
        logger.warn('Gateway disconnected');
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

  private handleMessage(message: JsonRpcResponse | JsonRpcNotification): void {
    // Handle RPC response
    if ('id' in message && message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // Handle notification
    if ('method' in message) {
      logger.debug('Gateway notification', { method: message.method, params: message.params });
      this.emit('notification', message.method, message.params);
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
