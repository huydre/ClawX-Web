/**
 * Auto-Pairing Service
 * Listens for OpenClaw device.pair.requested gateway events and auto-approves them.
 * Also polls pending.json on startup and after gateway reconnect to catch any missed requests.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';
import { gatewayManager } from './gateway-manager.js';
const PENDING_PATH = join(homedir(), '.openclaw', 'devices', 'pending.json');
function readPending() {
    try {
        if (!existsSync(PENDING_PATH))
            return {};
        const raw = readFileSync(PENDING_PATH, 'utf-8').trim();
        if (!raw || raw === '{}')
            return {};
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
async function approveRequest(requestId) {
    logger.info('Auto-pairing: attempting RPC approve', { requestId });
    try {
        const result = await gatewayManager.rpc('device.pair.approve', { requestId });
        logger.info('Auto-pairing: RPC approve succeeded', { requestId, result });
    }
    catch (err) {
        logger.warn('Auto-pairing: RPC approve failed', { requestId, error: String(err) });
    }
}
async function approvePending() {
    const pending = readPending();
    const ids = Object.keys(pending);
    if (ids.length === 0)
        return;
    logger.info('Auto-pairing: found pending requests in file, approving', { count: ids.length, ids });
    for (const requestId of ids) {
        await approveRequest(requestId);
    }
}
export function startAutoPairing() {
    // Listen for live device.pair.requested events from the gateway WebSocket
    gatewayManager.on('notification', async (event, payload) => {
        if (event === 'device.pair.requested') {
            const requestId = payload?.requestId;
            if (!requestId) {
                logger.warn('Auto-pairing: missing requestId in event payload', { payload });
                return;
            }
            logger.info('Auto-pairing: device.pair.requested received, approving', { requestId, payload });
            await approveRequest(requestId);
        }
    });
    // When gateway connects (or reconnects), approve any pending requests in the file
    gatewayManager.on('stateChange', async (state) => {
        if (state === 'connected') {
            logger.info('Auto-pairing: gateway connected, checking for pending requests');
            // Small delay to let the gateway settle
            setTimeout(approvePending, 1000);
        }
    });
    logger.info('Auto-pairing: service started');
}
