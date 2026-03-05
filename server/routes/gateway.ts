import { Router } from 'express';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';
import { gatewayManager } from '../services/gateway-manager.js';


const router = Router();

// GET /api/gateway/status
router.get('/status', (_req, res) => {
  try {
    const state = gatewayManager.getState();
    const connected = gatewayManager.isConnected();
    res.json({ state, connected });
  } catch (error) {
    logger.error('Get status error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/gateway/start
router.post('/start', async (_req, res) => {
  try {
    await gatewayManager.start();
    res.json({ success: true });
  } catch (error) {
    logger.error('Start gateway error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/gateway/stop
router.post('/stop', async (_req, res) => {
  try {
    await gatewayManager.stop();
    res.json({ success: true });
  } catch (error) {
    logger.error('Stop gateway error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/gateway/restart-openclaw
// Reconnect to the OpenClaw gateway (managed by systemd/pm2 externally)
router.post('/restart-openclaw', async (_req, res) => {
  try {
    // Disconnect existing connection
    try {
      await gatewayManager.stop();
    } catch { /* ignore */ }

    // Wait briefly then reconnect
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      await gatewayManager.start();
      logger.info('Gateway manager reconnected');
    } catch (err) {
      logger.warn('Gateway reconnect failed, will retry automatically', { err });
    }

    res.json({ success: true, method: 'reconnect' });
  } catch (error) {
    logger.error('Restart OpenClaw error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/gateway/channels
// Returns channel status from the gateway (used for polling login completion)
router.get('/channels', async (_req, res) => {
  try {
    const result = await gatewayManager.rpc('channels.status', {});
    res.json(result || { channels: {} });
  } catch (error) {
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

    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;

    // Read agents.defaults.model
    const agents = config.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    const modelConfig = defaults?.model as { primary?: string } | string | undefined;

    const modelStr = typeof modelConfig === 'string'
      ? modelConfig
      : modelConfig?.primary ?? null;

    // Parse "provider/model" format
    let provider: string | null = null;
    let model: string | null = null;

    if (modelStr) {
      const slashIdx = modelStr.indexOf('/');
      if (slashIdx !== -1) {
        provider = modelStr.slice(0, slashIdx);
        model = modelStr.slice(slashIdx + 1);
      } else {
        model = modelStr;
      }
    }

    res.json({ model: modelStr, provider, modelId: model, source: 'openclaw_config' });
  } catch (error) {
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
    const { sessionKey, message, deliver, idempotencyKey, media } = req.body as {
      sessionKey: string;
      message: string;
      deliver?: boolean;
      idempotencyKey: string;
      media: Array<{ filePath: string; mimeType: string; fileName: string }>;
    };

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
    const imageAttachments: Array<Record<string, unknown>> = [];
    const fileReferences: string[] = [];
    let fullMessage = message;

    for (const item of media) {
      const exists = existsSync(item.filePath);
      const isVision = VISION_MIME_TYPES.has(item.mimeType);
      logger.info(`[send-with-media] Processing: ${item.fileName} (${item.mimeType}), path: ${item.filePath}, exists: ${exists}, isVision: ${isVision}`);

      // Always add file path reference so the model can access via tools
      fileReferences.push(
        `[media attached: ${item.filePath} (${item.mimeType}) | ${item.filePath}]`
      );

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
        } catch (err) {
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
    const rpcParams: Record<string, unknown> = {
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
    res.json({ success: true, result });
  } catch (error) {
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

    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const tools = config.tools as Record<string, unknown> | undefined;
    const exec = tools?.exec as Record<string, unknown> | undefined;

    res.json({
      host: exec?.host ?? 'sandbox',
      security: exec?.security ?? 'deny',
      configured: !!(exec?.host),
    });
  } catch (error) {
    logger.error('Get exec config error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/gateway/exec-config
// Update exec tool configuration in ~/.openclaw/openclaw.json
router.post('/exec-config', (req, res) => {
  try {
    const { host, security } = req.body as { host?: string; security?: string };
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');

    let config: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    }

    // Ensure tools.exec path exists
    if (!config.tools) config.tools = {};
    const tools = config.tools as Record<string, unknown>;
    if (!tools.exec) tools.exec = {};
    const exec = tools.exec as Record<string, unknown>;

    if (host !== undefined) exec.host = host;
    if (security !== undefined) exec.security = security;

    // Manage tools.deny list — remove 'exec' and 'process' when enabling
    const execTools = ['exec', 'process'];
    if (security && security !== 'deny') {
      // Remove exec/process from deny list if present
      if (Array.isArray(tools.deny)) {
        tools.deny = (tools.deny as string[]).filter(t => !execTools.includes(t));
        if ((tools.deny as string[]).length === 0) delete tools.deny;
      }
    } else if (security === 'deny') {
      // Add exec/process to deny list
      const deny = Array.isArray(tools.deny) ? tools.deny as string[] : [];
      for (const t of execTools) {
        if (!deny.includes(t)) deny.push(t);
      }
      tools.deny = deny;
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    logger.info(`Exec config updated: host=${exec.host}, security=${exec.security}, deny=${JSON.stringify(tools.deny)}`);

    res.json({ success: true, host: exec.host, security: exec.security });
  } catch (error) {
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

    // Retry logic for RPC calls (max 3 attempts)
    let lastError: Error | null = null;
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
      } catch (error) {
        lastError = error as Error;
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
  } catch (error) {
    logger.error('RPC error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
