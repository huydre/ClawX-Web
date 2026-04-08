import { Router } from 'express';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';
import { gatewayManager } from '../services/gateway-manager.js';
import { trackEvent } from '../services/analytics.js';
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
// Restart the OpenClaw gateway process, then reconnect
router.post('/restart-openclaw', async (_req, res) => {
    try {
        // Disconnect existing connection
        try {
            await gatewayManager.stop();
        }
        catch { /* ignore */ }
        // Try to restart via systemctl first, then fallback to pkill
        const { exec: execCmd } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(execCmd);
        let method = 'reconnect';
        // Try systemctl restart (if openclaw-gateway or openclaw service exists)
        try {
            await execAsync('systemctl restart openclaw-gateway 2>/dev/null || systemctl restart openclaw 2>/dev/null', { timeout: 15000 });
            method = 'systemctl';
            logger.info('OpenClaw restarted via systemctl');
        }
        catch {
            // Fallback: kill the process and let systemd/supervisor restart it
            try {
                await execAsync('pkill -SIGTERM -x openclaw-gateway 2>/dev/null || pkill -SIGTERM -x openclaw 2>/dev/null || pkill -SIGTERM -f "openclaw" 2>/dev/null || true', { timeout: 5000 });
                method = 'pkill';
                logger.info('OpenClaw process killed, waiting for restart...');
            }
            catch {
                logger.warn('Could not kill OpenClaw process, attempting reconnect only');
            }
        }
        // Wait longer for process to restart
        await new Promise(resolve => setTimeout(resolve, method === 'reconnect' ? 2000 : 5000));
        // Retry reconnect up to 3 times
        let connected = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await gatewayManager.start();
                logger.info('Gateway manager reconnected after restart', { attempt });
                connected = true;
                break;
            }
            catch (err) {
                logger.warn(`Gateway reconnect attempt ${attempt}/3 failed`, { err });
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        res.json({ success: true, method, connected });
    }
    catch (error) {
        logger.error('Restart OpenClaw error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/gateway/doctor
// Run openclaw doctor --fix
router.post('/doctor', async (_req, res) => {
    try {
        const { exec: execCmd } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(execCmd);
        let output = '';
        let fixed = false;
        try {
            const result = await execAsync('openclaw doctor --fix 2>&1', { timeout: 30000 });
            output = result.stdout || result.stderr || 'Doctor completed with no output';
            fixed = true;
        }
        catch (err) {
            // openclaw doctor may exit with non-zero even when it fixes things
            output = err.stdout || err.stderr || err.message || String(err);
            fixed = output.includes('fixed') || output.includes('removed') || output.includes('Fixed');
        }
        res.json({ success: true, output, fixed });
    }
    catch (error) {
        logger.error('Doctor fix error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// GET /api/gateway/channels
// Returns channel status from the gateway (used for polling login completion)
router.get('/channels', async (_req, res) => {
    try {
        const result = await gatewayManager.rpc('channels.status', {});
        res.json(result || { channels: {} });
    }
    catch (error) {
        // Fallback: try to extract from last health event
        logger.warn('channels.status RPC failed, returning empty', { error });
        res.json({ channels: {} });
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
// Uses the same dual-path approach as Electron:
// Path A: `attachments` param → { content: base64, mimeType, fileName }
//   → Gateway injects as inline vision content when model supports images.
// Path B: `[media attached: ...]` in message text → Gateway's native image
//   detection reads the file from disk. Also works for history replay.
const VISION_MIME_TYPES = new Set([
    'image/png', 'image/jpeg', 'image/bmp', 'image/webp',
]);
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
        // Build attachments and file references (matching Electron's format)
        const imageAttachments = [];
        const fileReferences = [];
        let fullMessage = message;
        for (const item of media) {
            const exists = existsSync(item.filePath);
            const isVision = VISION_MIME_TYPES.has(item.mimeType);
            logger.info(`[send-with-media] Processing: ${item.fileName} (${item.mimeType}), path: ${item.filePath}, exists: ${exists}, isVision: ${isVision}`);
            // Always add file path reference so the model can access via tools
            fileReferences.push(`[media attached: ${item.filePath} (${item.mimeType}) | ${item.filePath}]`);
            // For vision-compatible images, also add as base64 attachment
            if (isVision && exists) {
                try {
                    const fileBuffer = readFileSync(item.filePath);
                    const base64Data = fileBuffer.toString('base64');
                    logger.info(`[send-with-media] Read ${fileBuffer.length} bytes, base64 length: ${base64Data.length}`);
                    imageAttachments.push({
                        content: base64Data,
                        mimeType: item.mimeType,
                        fileName: item.fileName,
                    });
                }
                catch (err) {
                    logger.warn('[send-with-media] Failed to read file for base64', { filePath: item.filePath, err });
                }
            }
        }
        // Append file references to message text
        if (fileReferences.length > 0) {
            const refs = fileReferences.join('\n');
            fullMessage = fullMessage ? `${fullMessage}\n\n${refs}` : refs;
        }
        // Build RPC params (matching Electron's format)
        const rpcParams = {
            sessionKey,
            message: fullMessage,
            deliver: deliver ?? false,
            idempotencyKey,
        };
        // Add attachments separately (NOT inside message)
        // Gateway expects: { content: base64String, mimeType: string, fileName?: string }
        if (imageAttachments.length > 0) {
            rpcParams.attachments = imageAttachments;
        }
        logger.info(`[send-with-media] Sending: message="${fullMessage.substring(0, 100)}", attachments=${imageAttachments.length}, fileRefs=${fileReferences.length}`);
        // Use longer timeout when images are present (120s vs 60s)
        const timeoutMs = imageAttachments.length > 0 ? 120000 : 60000;
        const result = await gatewayManager.rpc('chat.send', rpcParams, timeoutMs);
        logger.info(`[send-with-media] RPC result: ${JSON.stringify(result)}`);
        // Track message_sent analytics (fire-and-forget)
        trackEvent({
            type: 'message_sent',
            sessionKey,
            metadata: { method: 'chat.send', hasMedia: true, mediaCount: media.length },
        }).catch(() => { });
        res.json({ success: true, result });
    }
    catch (error) {
        logger.error('Send with media error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// GET /api/gateway/exec-config
// Read exec tool configuration from ~/.openclaw/openclaw.json
router.get('/exec-config', (_req, res) => {
    try {
        const configPath = join(homedir(), '.openclaw', 'openclaw.json');
        if (!existsSync(configPath)) {
            return res.json({ host: 'sandbox', security: 'deny', configured: false });
        }
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        const tools = config.tools;
        const exec = tools?.exec;
        res.json({
            host: exec?.host ?? 'sandbox',
            security: exec?.security ?? 'deny',
            configured: !!(exec?.host),
        });
    }
    catch (error) {
        logger.error('Get exec config error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/gateway/exec-config
// Update exec tool configuration in ~/.openclaw/openclaw.json
router.post('/exec-config', (req, res) => {
    try {
        const { host, security } = req.body;
        const configPath = join(homedir(), '.openclaw', 'openclaw.json');
        let config = {};
        if (existsSync(configPath)) {
            config = JSON.parse(readFileSync(configPath, 'utf-8'));
        }
        // Ensure tools.exec path exists
        if (!config.tools)
            config.tools = {};
        const tools = config.tools;
        if (!tools.exec)
            tools.exec = {};
        const exec = tools.exec;
        if (host !== undefined)
            exec.host = host;
        if (security !== undefined)
            exec.security = security;
        // Manage tools.deny list — remove 'exec' and 'process' when enabling
        const execTools = ['exec', 'process'];
        if (security && security !== 'deny') {
            // Remove exec/process from deny list if present
            if (Array.isArray(tools.deny)) {
                tools.deny = tools.deny.filter(t => !execTools.includes(t));
                if (tools.deny.length === 0)
                    delete tools.deny;
            }
        }
        else if (security === 'deny') {
            // Add exec/process to deny list
            const deny = Array.isArray(tools.deny) ? tools.deny : [];
            for (const t of execTools) {
                if (!deny.includes(t))
                    deny.push(t);
            }
            tools.deny = deny;
        }
        writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        logger.info(`Exec config updated: host=${exec.host}, security=${exec.security}, deny=${JSON.stringify(tools.deny)}`);
        res.json({ success: true, host: exec.host, security: exec.security });
    }
    catch (error) {
        logger.error('Set exec config error:', error);
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
        // chat.send is fire-and-forget: response comes via streaming events
        // channels.status with probe can be slow — give 30s
        const isChatSend = method === 'chat.send';
        const isChannelStatus = method === 'channels.status';
        const defaultTimeout = isChatSend ? 120000 : isChannelStatus ? 30000 : 10000;
        const effectiveTimeout = timeoutMs || defaultTimeout;
        const maxRetries = isChatSend ? 0 : 2;
        let lastError = null;
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
                const result = await gatewayManager.rpc(method, params, effectiveTimeout);
                // Track message_sent analytics for chat.send (fire-and-forget)
                if (isChatSend) {
                    trackEvent({
                        type: 'message_sent',
                        sessionKey: params?.sessionKey,
                        metadata: { method },
                    }).catch(() => { });
                }
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
