"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatewayManager = void 0;
const events_1 = require("events");
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("../utils/logger");
const storage_1 = require("./storage");
class GatewayManager extends events_1.EventEmitter {
    ws = null;
    state = 'stopped';
    reconnectTimer = null;
    pingInterval = null;
    pendingRequests = new Map();
    requestId = 0;
    constructor() {
        super();
    }
    getState() {
        return this.state;
    }
    isConnected() {
        return this.state === 'connected' && this.ws?.readyState === ws_1.default.OPEN;
    }
    async start() {
        if (this.state === 'starting' || this.state === 'connected') {
            logger_1.logger.warn('Gateway already starting or connected');
            return;
        }
        this.setState('starting');
        await this.connect();
    }
    async stop() {
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
    async rpc(method, params, timeoutMs = 30000) {
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
                this.ws.send(JSON.stringify(request));
                logger_1.logger.debug('RPC request sent', { method, params, id });
            }
            catch (error) {
                clearTimeout(timeout);
                this.pendingRequests.delete(id);
                reject(error);
            }
        });
    }
    async connect() {
        try {
            const gatewayPort = await (0, storage_1.getSetting)('gatewayPort');
            const gatewayToken = await (0, storage_1.getSetting)('gatewayToken');
            const url = `ws://127.0.0.1:${gatewayPort}`;
            logger_1.logger.info('Connecting to gateway', { url });
            // Try connecting without Authorization header first
            // OpenClaw Gateway might not require authentication for localhost connections
            this.ws = new ws_1.default(url);
            this.ws.on('open', () => {
                logger_1.logger.info('Gateway connected');
                this.setState('connected');
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                // Start ping interval to keep connection alive
                this.pingInterval = setInterval(() => {
                    if (this.ws?.readyState === ws_1.default.OPEN) {
                        // Send WebSocket ping to keep connection alive
                        this.ws.ping();
                    }
                }, 8000); // Ping every 8 seconds (before 10s timeout)
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    // Handle connect.challenge event - send proper connect request
                    if (message.type === 'event' && message.event === 'connect.challenge') {
                        logger_1.logger.info('Received connect challenge', { nonce: message.payload?.nonce });
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
                        this.ws.send(JSON.stringify(connectReq));
                        logger_1.logger.info('Sent connect request');
                        return;
                    }
                    // Handle connect response
                    if (message.type === 'res' && message.id === 'connect-1') {
                        if (message.ok) {
                            logger_1.logger.info('Gateway handshake completed successfully');
                        }
                        else {
                            logger_1.logger.error('Gateway handshake failed', { error: message.error });
                            this.setState('error');
                        }
                        return;
                    }
                    this.handleMessage(message);
                }
                catch (error) {
                    logger_1.logger.error('Failed to parse gateway message', { error, data: data.toString() });
                }
            });
            this.ws.on('error', (error) => {
                logger_1.logger.error('Gateway WebSocket error', { error: error.message, stack: error.stack });
                this.setState('error');
            });
            this.ws.on('close', (code, reason) => {
                logger_1.logger.warn('Gateway disconnected', { code, reason: reason.toString() });
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
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to gateway', { error });
            this.setState('error');
            this.scheduleReconnect();
        }
    }
    handleMessage(message) {
        // Handle OpenClaw protocol response (type: 'res')
        if (message.type === 'res' && message.id !== undefined) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(message.id);
                if (message.ok) {
                    pending.resolve(message.payload);
                }
                else {
                    const errorMsg = message.error?.message || 'Unknown error';
                    pending.reject(new Error(errorMsg));
                }
            }
            return;
        }
        // Handle OpenClaw protocol event (type: 'event')
        if (message.type === 'event' && message.event) {
            logger_1.logger.info('Gateway event received', { event: message.event, payload: message.payload });
            this.emit('notification', message.event, message.payload);
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimer) {
            return;
        }
        const delay = 5000; // 5 seconds
        logger_1.logger.info('Scheduling gateway reconnect', { delay });
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.state !== 'stopped') {
                this.connect();
            }
        }, delay);
    }
    setState(state) {
        if (this.state !== state) {
            const oldState = this.state;
            this.state = state;
            logger_1.logger.info('Gateway state changed', { from: oldState, to: state });
            this.emit('stateChange', state, oldState);
        }
    }
}
// Singleton instance
exports.gatewayManager = new GatewayManager();
