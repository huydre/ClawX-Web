import { Router } from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

const router = Router();

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const CONFIG_FILE = join(OPENCLAW_DIR, 'openclaw.json');

interface OpenClawConfig {
    channels?: Record<string, Record<string, unknown>>;
    plugins?: { entries?: Record<string, Record<string, unknown>>;[k: string]: unknown };
    [k: string]: unknown;
}

const PLUGIN_CHANNELS = ['whatsapp', 'openzalo'];

function ensureConfigDir(): void {
    if (!existsSync(OPENCLAW_DIR)) {
        mkdirSync(OPENCLAW_DIR, { recursive: true });
    }
}

function readConfig(): OpenClawConfig {
    ensureConfigDir();
    if (!existsSync(CONFIG_FILE)) return {};
    try {
        return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as OpenClawConfig;
    } catch {
        return {};
    }
}

function writeConfig(config: OpenClawConfig): void {
    ensureConfigDir();
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// POST /api/channels/validate
router.post('/validate', async (req, res) => {
    try {
        const { type, config } = req.body as { type: string; config: Record<string, string> };

        if (!type || !config) {
            return res.status(400).json({ valid: false, errors: ['Missing type or config'] });
        }

        if (type === 'telegram') {
            const botToken = config.botToken?.trim();
            if (!botToken) {
                return res.json({ valid: false, errors: ['Bot token is required'], warnings: [] });
            }

            try {
                const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
                const data = (await response.json()) as { ok?: boolean; description?: string; result?: { username?: string } };

                if (data.ok) {
                    return res.json({
                        valid: true,
                        errors: [],
                        warnings: [],
                        details: { botUsername: data.result?.username || 'Unknown' },
                    });
                }

                return res.json({
                    valid: false,
                    errors: [data.description || 'Invalid bot token'],
                    warnings: [],
                });
            } catch (error) {
                return res.json({
                    valid: false,
                    errors: [`Connection error: ${error instanceof Error ? error.message : String(error)}`],
                    warnings: [],
                });
            }
        }

        if (type === 'discord') {
            const token = config.token?.trim();
            if (!token) {
                return res.json({ valid: false, errors: ['Bot token is required'], warnings: [] });
            }

            const result: { valid: boolean; errors: string[]; warnings: string[]; details: Record<string, string> } = {
                valid: true, errors: [], warnings: [], details: {},
            };

            try {
                const meResponse = await fetch('https://discord.com/api/v10/users/@me', {
                    headers: { Authorization: `Bot ${token}` },
                });

                if (!meResponse.ok) {
                    if (meResponse.status === 401) {
                        return res.json({ valid: false, errors: ['Invalid bot token'], warnings: [] });
                    }
                    return res.json({ valid: false, errors: [`Discord API error: ${meResponse.status}`], warnings: [] });
                }

                const meData = (await meResponse.json()) as { username?: string; id?: string; bot?: boolean };
                if (!meData.bot) {
                    return res.json({ valid: false, errors: ['Token belongs to a user account, not a bot'], warnings: [] });
                }
                result.details.botUsername = meData.username || 'Unknown';
            } catch (error) {
                return res.json({ valid: false, errors: [`Connection error: ${error instanceof Error ? error.message : String(error)}`], warnings: [] });
            }

            // Validate guild ID
            const guildId = config.guildId?.trim();
            if (guildId) {
                try {
                    const guildResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
                        headers: { Authorization: `Bot ${token}` },
                    });
                    if (!guildResponse.ok) {
                        result.errors.push(`Cannot access guild with ID "${guildId}"`);
                        result.valid = false;
                    } else {
                        const guildData = (await guildResponse.json()) as { name?: string };
                        result.details.guildName = guildData.name || 'Unknown';
                    }
                } catch (error) {
                    result.warnings.push(`Could not verify guild: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            return res.json(result);
        }

        // Default: no validation available
        return res.json({ valid: true, errors: [], warnings: ['No online validation available for this channel type.'] });
    } catch (error) {
        logger.error('Channel validate error:', error);
        res.status(500).json({ valid: false, errors: [String(error)], warnings: [] });
    }
});

// POST /api/channels/save
router.post('/save', (req, res) => {
    try {
        const { type, config } = req.body as { type: string; config: Record<string, unknown> };

        if (!type) {
            return res.status(400).json({ success: false, error: 'Missing channel type' });
        }

        const currentConfig = readConfig();

        // Plugin-based channels
        if (PLUGIN_CHANNELS.includes(type)) {
            if (!currentConfig.plugins) currentConfig.plugins = {};
            if (!currentConfig.plugins.entries) currentConfig.plugins.entries = {};
            currentConfig.plugins.entries[type] = {
                ...currentConfig.plugins.entries[type],
                enabled: config.enabled ?? true,
            };

            // OpenZalo: also write channel config for profile/dmPolicy/zcaBinary
            if (type === 'openzalo') {
                if (!currentConfig.channels) currentConfig.channels = {};
                const zaloConfig: Record<string, unknown> = {
                    ...currentConfig.channels.openzalo,
                    enabled: config.enabled ?? true,
                };
                if (config.profile && typeof config.profile === 'string' && (config.profile as string).trim()) {
                    zaloConfig.profile = (config.profile as string).trim();
                }
                if (config.dmPolicy && typeof config.dmPolicy === 'string') {
                    zaloConfig.dmPolicy = config.dmPolicy;
                } else if (!zaloConfig.dmPolicy) {
                    zaloConfig.dmPolicy = 'pairing';
                }
                if (config.zcaBinary && typeof config.zcaBinary === 'string' && (config.zcaBinary as string).trim()) {
                    zaloConfig.zcaBinary = (config.zcaBinary as string).trim();
                }
                currentConfig.channels.openzalo = zaloConfig;
            }

            writeConfig(currentConfig);
            logger.info('Plugin channel config saved', { type });
            return res.json({ success: true });
        }

        if (!currentConfig.channels) currentConfig.channels = {};

        let transformedConfig: Record<string, unknown> = { ...config };

        // Telegram: convert allowFrom comma string → allowFrom array
        if (type === 'telegram') {
            const { allowFrom, ...rest } = config;
            transformedConfig = { ...rest };

            if (allowFrom && typeof allowFrom === 'string') {
                const users = (allowFrom as string).split(',').map(u => (u as string).trim()).filter(u => (u as string).length > 0);
                if (users.length > 0) {
                    transformedConfig.allowFrom = users;
                }
            }

            // OpenClaw requires allowFrom to include "*" when dmPolicy is "open"
            const dmPolicy = transformedConfig.dmPolicy || currentConfig.channels?.[type]?.dmPolicy || 'open';
            if (dmPolicy === 'open') {
                let af = transformedConfig.allowFrom as string[] | undefined;
                if (!af || !Array.isArray(af)) af = ['*'];
                else if (!af.includes('*')) af.push('*');
                transformedConfig.allowFrom = af;
            }

            // Default dmPolicy to "open" if not set
            if (!transformedConfig.dmPolicy) {
                transformedConfig.dmPolicy = 'open';
            }
        }

        // Discord: build guilds structure
        if (type === 'discord') {
            const { guildId, channelId, ...rest } = config;
            transformedConfig = { ...rest };
            transformedConfig.groupPolicy = 'allowlist';
            transformedConfig.dm = { enabled: false };
            transformedConfig.retry = { attempts: 3, minDelayMs: 500, maxDelayMs: 30000, jitter: 0.1 };

            if (guildId && typeof guildId === 'string' && (guildId as string).trim()) {
                const guildConfig: Record<string, unknown> = { users: ['*'], requireMention: true };
                if (channelId && typeof channelId === 'string' && (channelId as string).trim()) {
                    guildConfig.channels = { [(channelId as string).trim()]: { allow: true, requireMention: true } };
                } else {
                    guildConfig.channels = { '*': { allow: true, requireMention: true } };
                }
                transformedConfig.guilds = { [(guildId as string).trim()]: guildConfig };
            }
        }

        // Feishu: default open DM policy
        if (type === 'feishu') {
            const existing = currentConfig.channels[type] || {};
            transformedConfig.dmPolicy = transformedConfig.dmPolicy ?? existing.dmPolicy ?? 'open';
            let allowFrom = transformedConfig.allowFrom ?? existing.allowFrom ?? ['*'];
            if (!Array.isArray(allowFrom)) allowFrom = [allowFrom];
            if (transformedConfig.dmPolicy === 'open' && !(allowFrom as string[]).includes('*')) {
                allowFrom = [...(allowFrom as string[]), '*'];
            }
            transformedConfig.allowFrom = allowFrom;
        }

        currentConfig.channels[type] = {
            ...currentConfig.channels[type],
            ...transformedConfig,
            enabled: (transformedConfig.enabled as boolean) ?? true,
        };

        writeConfig(currentConfig);
        logger.info('Channel config saved', { type });
        res.json({ success: true });
    } catch (error) {
        logger.error('Channel save error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// DELETE /api/channels/:type
router.delete('/:type', (req, res) => {
    try {
        const { type } = req.params;
        const currentConfig = readConfig();

        if (currentConfig.channels?.[type]) {
            delete currentConfig.channels[type];
            writeConfig(currentConfig);
            logger.info('Channel config deleted', { type });
        } else if (PLUGIN_CHANNELS.includes(type)) {
            if (currentConfig.plugins?.entries?.[type]) {
                delete currentConfig.plugins.entries[type];
                if (Object.keys(currentConfig.plugins.entries).length === 0) {
                    delete currentConfig.plugins.entries;
                }
                if (currentConfig.plugins && Object.keys(currentConfig.plugins).length === 0) {
                    delete currentConfig.plugins;
                }
                writeConfig(currentConfig);
                logger.info('Plugin channel config deleted', { type });
            }
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('Channel delete error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// GET /api/channels/:type/form-values
router.get('/:type/form-values', (req, res) => {
    try {
        const { type } = req.params;
        const config = readConfig();
        const saved = config.channels?.[type];

        if (!saved) {
            return res.json({ success: true, values: null });
        }

        const values: Record<string, string> = {};

        if (type === 'discord') {
            if (saved.token && typeof saved.token === 'string') values.token = saved.token;
            const guilds = saved.guilds as Record<string, Record<string, unknown>> | undefined;
            if (guilds) {
                const guildIds = Object.keys(guilds);
                if (guildIds.length > 0) {
                    values.guildId = guildIds[0];
                    const channels = guilds[guildIds[0]]?.channels as Record<string, unknown> | undefined;
                    if (channels) {
                        const channelIds = Object.keys(channels).filter(id => id !== '*');
                        if (channelIds.length > 0) values.channelId = channelIds[0];
                    }
                }
            }
        } else if (type === 'telegram') {
            if (Array.isArray(saved.allowFrom)) {
                values.allowedUsers = (saved.allowFrom as string[]).join(', ');
            }
            for (const [key, value] of Object.entries(saved)) {
                if (typeof value === 'string' && key !== 'enabled') {
                    values[key] = value;
                }
            }
        } else {
            for (const [key, value] of Object.entries(saved)) {
                if (typeof value === 'string' && key !== 'enabled') {
                    values[key] = value;
                }
            }
        }

        res.json({ success: true, values: Object.keys(values).length > 0 ? values : null });
    } catch (error) {
        logger.error('Channel get form values error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

// POST /api/channels/openzalo/login
// Run openzca auth login --qr-base64 and return QR data URL
router.post('/openzalo/login', async (req, res) => {
    try {
        const { profile = 'default' } = req.body as { profile?: string };
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Check if openzca is installed
        try {
            await execAsync('which openzca');
        } catch {
            return res.status(400).json({
                success: false,
                error: 'openzca CLI not found. Install it: npm install -g openzca',
            });
        }

        // Run openzca auth login with --qr-base64 flag
        const cmd = `openzca --profile ${profile.replace(/[^a-zA-Z0-9_-]/g, '')} auth login --qr-base64`;
        logger.info('Running openzca login', { cmd });

        const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });

        // openzca --qr-base64 outputs the data URL on stdout
        const output = stdout.trim();
        if (output.startsWith('data:image')) {
            return res.json({ success: true, qrDataUrl: output });
        }

        // If output doesn't start with data:image, try to find it in multi-line output
        const dataUrlLine = output.split('\n').find(line => line.trim().startsWith('data:image'));
        if (dataUrlLine) {
            return res.json({ success: true, qrDataUrl: dataUrlLine.trim() });
        }

        logger.warn('openzca login did not return QR data URL', { stdout: output.substring(0, 200), stderr: stderr?.substring(0, 200) });
        return res.status(500).json({
            success: false,
            error: 'Could not generate QR code. Output: ' + output.substring(0, 200),
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('openzca login error:', error);
        res.status(500).json({ success: false, error: msg });
    }
});

export default router;
