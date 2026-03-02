import { Router } from 'express';
import { z } from 'zod';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import { gatewayManager } from '../services/gateway-manager.js';
const execAsync = promisify(exec);
const router = Router();
// GET /api/gateway/status
router.get('/status', (_req, res) => {
    try {
        const state = gatewayManager.getState();
        const connected = gatewayManager.isConnected();
        res.json({ state, connected });
    }
    catch (error) {
        logger.error('Get status error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/gateway/start
router.post('/start', async (_req, res) => {
    try {
        await gatewayManager.start();
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Start gateway error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/gateway/stop
router.post('/stop', async (_req, res) => {
    try {
        await gatewayManager.stop();
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Stop gateway error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/gateway/restart-openclaw
// Restart the OpenClaw process (supports pm2, systemctl, or pkill on main process)
router.post('/restart-openclaw', async (_req, res) => {
    try {
        let method = 'unknown';
        // Disconnect gateway manager before killing OpenClaw
        try {
            await gatewayManager.stop();
        }
        catch { /* ignore */ }
        // 1. Try PM2 (check multiple possible process names)
        let pm2Success = false;
        for (const name of ['openclaw', 'openclaw-gateway', 'oclaw']) {
            try {
                const { stdout } = await execAsync(`pm2 id ${name} 2>/dev/null`);
                if (stdout && stdout.trim() !== '[]') {
                    await execAsync(`pm2 restart ${name}`);
                    method = `pm2:${name}`;
                    pm2Success = true;
                    logger.info(`OpenClaw restarted via PM2`, { name });
                    break;
                }
            }
            catch { /* try next */ }
        }
        if (!pm2Success) {
            // 2. Try systemctl
            let systemctlSuccess = false;
            for (const name of ['openclaw', 'openclaw-gateway']) {
                try {
                    await execAsync(`systemctl is-active ${name}`);
                    await execAsync(`systemctl restart ${name}`);
                    method = `systemctl:${name}`;
                    systemctlSuccess = true;
                    logger.info(`OpenClaw restarted via systemctl`, { name });
                    break;
                }
                catch { /* try next */ }
            }
            if (!systemctlSuccess) {
                // 3. Kill and respawn openclaw process
                try {
                    // Kill existing process
                    await execAsync('pkill -SIGTERM -x openclaw-gateway 2>/dev/null || pkill -SIGTERM -x openclaw 2>/dev/null || pkill -SIGTERM -f "openclaw" 2>/dev/null || true');
                    method = 'respawn';
                    logger.info('OpenClaw main process killed via SIGTERM');
                    // Wait for process to fully exit
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // Find openclaw entry point (resolve symlink to get actual .mjs path)
                    const { spawn } = await import('child_process');
                    const { realpathSync } = await import('fs');
                    const { dirname } = await import('path');
                    const openclawBin = '/opt/homebrew/bin/openclaw';
                    let openclawScript;
                    try {
                        openclawScript = realpathSync(openclawBin); // resolves symlink → /opt/homebrew/lib/node_modules/openclaw/openclaw.mjs
                    }
                    catch {
                        throw new Error(`OpenClaw not found at ${openclawBin}`);
                    }
                    // Use the current Node.js binary (process.execPath) to run openclaw
                    // This avoids "env: node: No such file or directory" in detached process
                    const nodeBin = process.execPath;
                    const nodeBinDir = dirname(nodeBin);
                    // Ensure PATH includes node binary dir and homebrew
                    const envPath = [nodeBinDir, '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH || ''].join(':');
                    const child = spawn(nodeBin, [openclawScript, 'gateway', '--verbose'], {
                        cwd: homedir(),
                        detached: true,
                        stdio: 'ignore',
                        env: { ...process.env, PATH: envPath },
                    });
                    child.unref();
                    logger.info('OpenClaw respawned as background process', { pid: child.pid, cmd: `${nodeBin} ${openclawScript} gateway --verbose` });
                }
                catch (err) {
                    throw new Error(`Could not restart OpenClaw: ${err instanceof Error ? err.message : String(err)}. Try manually: openclaw`);
                }
            }
        }
        // Reconnect gateway manager after OpenClaw restarts (give it time to boot)
        const reconnectDelay = method === 'respawn' ? 8000 : 3000;
        setTimeout(async () => {
            try {
                await gatewayManager.start();
                logger.info('Gateway manager reconnected after OpenClaw restart');
            }
            catch (err) {
                logger.warn('Gateway reconnect after restart failed, will retry automatically', { err });
            }
        }, reconnectDelay);
        res.json({ success: true, method });
    }
    catch (error) {
        logger.error('Restart OpenClaw error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// GET /api/gateway/current-model
// Reads ~/.openclaw/openclaw.json to detect the currently configured model
router.get('/current-model', (_req, res) => {
    try {
        const configPath = join(homedir(), '.openclaw', 'openclaw.json');
        if (!existsSync(configPath)) {
            return res.json({ model: null, provider: null, source: 'not_configured' });
        }
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        // Read agents.defaults.model
        const agents = config.agents;
        const defaults = agents?.defaults;
        const modelConfig = defaults?.model;
        const modelStr = typeof modelConfig === 'string'
            ? modelConfig
            : modelConfig?.primary ?? null;
        // Parse "provider/model" format
        let provider = null;
        let model = null;
        if (modelStr) {
            const slashIdx = modelStr.indexOf('/');
            if (slashIdx !== -1) {
                provider = modelStr.slice(0, slashIdx);
                model = modelStr.slice(slashIdx + 1);
            }
            else {
                model = modelStr;
            }
        }
        res.json({ model: modelStr, provider, modelId: model, source: 'openclaw_config' });
    }
    catch (error) {
        logger.error('Get current model error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/gateway/send-with-media
// Web mode equivalent of Electron's chat:sendWithMedia IPC handler.
// Builds a text message with [media attached: ...] file references
// and sends via the standard chat.send RPC. Gateway reads files from disk paths.
router.post('/send-with-media', async (req, res) => {
    try {
        const { sessionKey, message, deliver, idempotencyKey, media } = req.body;
        if (!sessionKey || !message || !Array.isArray(media)) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        // Wait for gateway to be connected
        const maxWait = 10000;
        const start = Date.now();
        while (!gatewayManager.isConnected() && Date.now() - start < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (!gatewayManager.isConnected()) {
            return res.status(503).json({ success: false, error: 'Gateway not connected' });
        }
        // Build message text with media references
        // Format: [media attached: /path/to/file (mime/type) | filename]
        // Gateway reads files from these disk paths
        const mediaRefs = media.map(item => `[media attached: ${item.filePath} (${item.mimeType}) | ${item.fileName}]`);
        const fullMessage = mediaRefs.length > 0
            ? `${message}\n\n${mediaRefs.join('\n')}`
            : message;
        const result = await gatewayManager.rpc('chat.send', {
            sessionKey,
            message: fullMessage,
            deliver: deliver ?? false,
            idempotencyKey,
        }, 60000);
        res.json({ success: true, result });
    }
    catch (error) {
        logger.error('Send with media error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/gateway/rpc
const rpcSchema = z.object({
    method: z.string(),
    params: z.any().optional(),
    timeoutMs: z.number().optional(),
});
router.post('/rpc', async (req, res) => {
    try {
        const { method, params, timeoutMs } = rpcSchema.parse(req.body);
        // Retry logic for RPC calls (max 3 attempts)
        let lastError = null;
        const maxRetries = 2;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Wait for gateway to be connected before attempting RPC
                const maxWaitTime = 10000; // 10 seconds
                const startWait = Date.now();
                while (!gatewayManager.isConnected() && (Date.now() - startWait) < maxWaitTime) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                if (!gatewayManager.isConnected()) {
                    throw new Error('Gateway not connected after waiting');
                }
                // Use shorter timeout (10s) to fail fast and retry
                const result = await gatewayManager.rpc(method, params, timeoutMs || 10000);
                res.json({ success: true, result });
                return;
            }
            catch (error) {
                lastError = error;
                const errorMsg = String(error);
                // If this is the last attempt, throw the error
                if (attempt === maxRetries) {
                    throw error;
                }
                // If it's a timeout or connection error, wait and retry
                if (errorMsg.includes('timeout') || errorMsg.includes('not connected')) {
                    logger.warn(`RPC attempt ${attempt + 1} failed: ${errorMsg}, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                // For other errors, don't retry
                throw error;
            }
        }
        throw lastError || new Error('Max retries exceeded');
    }
    catch (error) {
        logger.error('RPC error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
export default router;
