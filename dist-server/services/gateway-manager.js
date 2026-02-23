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
        const id = ++this.requestId;
        const request = {
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
            this.ws = new ws_1.default(url, {
                headers: {
                    Authorization: `Bearer ${gatewayToken}`,
                },
            });
            this.ws.on('open', () => {
                logger_1.logger.info('Gateway connected');
                this.setState('connected');
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(message);
                }
                catch (error) {
                    logger_1.logger.error('Failed to parse gateway message', { error, data: data.toString() });
                }
            });
            this.ws.on('error', (error) => {
                logger_1.logger.error('Gateway WebSocket error', { error: error.message });
                this.setState('error');
            });
            this.ws.on('close', () => {
                logger_1.logger.warn('Gateway disconnected');
                this.ws = null;
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
        // Handle RPC response
        if ('id' in message && message.id !== undefined) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(message.error.message));
                }
                else {
                    pending.resolve(message.result);
                }
            }
            return;
        }
        // Handle notification
        if ('method' in message) {
            logger_1.logger.debug('Gateway notification', { method: message.method, params: message.params });
            this.emit('notification', message.method, message.params);
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
