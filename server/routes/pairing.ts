/**
 * Pairing Routes — /api/pairing
 * Manage DM pairing requests (approve/reject pending users)
 * Uses openclaw CLI for approve (communicates directly with gateway)
 */
import { Router } from 'express';
import { readFileSync, existsSync, readdirSync, realpathSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const router = Router();
const execAsync = promisify(exec);

interface PairingRequest {
    id: string;
    code: string;
    channel: string;
    senderName: string;
    username: string;
    createdAt: string;
}

/** Find the .openclaw dir (may be under a different user than who runs this service) */
function findOpenClawDir(): string {
    const defaultDir = join(homedir(), '.openclaw');
    if (existsSync(join(defaultDir, 'openclaw.json'))) return defaultDir;

    try {
        for (const user of readdirSync('/home')) {
            const candidate = join('/home', user, '.openclaw');
            if (existsSync(join(candidate, 'openclaw.json'))) return candidate;
        }
    } catch { /* no access */ }

    if (existsSync('/root/.openclaw/openclaw.json')) return '/root/.openclaw';
    return defaultDir;
}

/** Read the .clawx-owner file to get the real user who installed openclaw */
function getOwnerUser(): string | null {
    try {
        const ownerFile = join(process.cwd(), '.clawx-owner');
        if (existsSync(ownerFile)) {
            return readFileSync(ownerFile, 'utf-8').trim();
        }
    } catch { /* ignore */ }

    // Fallback: detect from openclaw dir path
    const dir = findOpenClawDir();
    const match = dir.match(/\/home\/([^/]+)\//);
    return match?.[1] || null;
}

const OPENCLAW_DIR = findOpenClawDir();
const CREDENTIALS_DIR = join(OPENCLAW_DIR, 'credentials');
const OWNER_USER = getOwnerUser();

/** Find the actual openclaw binary path */
function findOpenClawBin(): string {
    const searchPaths = [
        '/usr/local/bin/openclaw',
        '/usr/bin/openclaw',
        join(homedir(), '.local', 'bin', 'openclaw'),
        join(homedir(), '.openclaw', 'bin', 'openclaw'),
    ];

    // Also search in owner user's paths
    if (OWNER_USER) {
        const ownerHome = `/home/${OWNER_USER}`;
        searchPaths.push(
            join(ownerHome, '.local', 'bin', 'openclaw'),
            join(ownerHome, '.openclaw', 'bin', 'openclaw'),
            join(ownerHome, '.npm-global', 'bin', 'openclaw'),
            join(ownerHome, '.nvm', 'current', 'bin', 'openclaw'),
            join(ownerHome, '.local', 'share', 'pnpm', 'openclaw'),
        );
    }

    for (const p of searchPaths) {
        if (existsSync(p)) return p;
    }

    // Last resort: use just 'openclaw' and hope PATH works
    return 'openclaw';
}

const OPENCLAW_BIN = findOpenClawBin();

/** Resolve openclaw binary to its actual .mjs entry point */
function resolveOpenClawMjs(): string | null {
    try {
        return realpathSync(OPENCLAW_BIN);
    } catch {
        // Try common pattern: ~/.npm-global/lib/node_modules/openclaw/openclaw.mjs
        if (OWNER_USER) {
            const mjs = join(`/home/${OWNER_USER}`, '.npm-global', 'lib', 'node_modules', 'openclaw', 'openclaw.mjs');
            if (existsSync(mjs)) return mjs;
        }
        return null;
    }
}

const OPENCLAW_MJS = resolveOpenClawMjs();
logger.info(`Pairing: openclaw dir=${OPENCLAW_DIR}, bin=${OPENCLAW_BIN}, mjs=${OPENCLAW_MJS}, owner=${OWNER_USER}`);

/** Build CLI command: source nvm + run node openclaw.mjs (bypasses shebang) */
function buildCmd(args: string): string {
    const currentUser = process.env.USER || process.env.LOGNAME || '';
    if (OWNER_USER && OWNER_USER !== currentUser) {
        const ownerHome = `/home/${OWNER_USER}`;
        const nvmInit = `export NVM_DIR="${ownerHome}/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`;
        const entry = OPENCLAW_MJS || OPENCLAW_BIN;
        // Run via 'node <mjs>' to bypass shebang (which would use system node v20)
        return `sudo -u ${OWNER_USER} bash -c '${nvmInit} && node ${entry} ${args}'`;
    }
    return `${OPENCLAW_BIN} ${args}`;
}

/** Parse OpenClaw v1 pairing file */
function readPairingFile(channel: string): PairingRequest[] {
    const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
    try {
        if (!existsSync(filePath)) return [];
        const raw = readFileSync(filePath, 'utf-8').trim();
        if (!raw || raw === '{}' || raw === '[]') return [];

        const data = JSON.parse(raw);

        if (data.requests && Array.isArray(data.requests)) {
            return data.requests.map((req: any) => ({
                id: req.id || '',
                code: req.code || '',
                channel,
                senderName: req.meta?.firstName || req.meta?.displayName || '',
                username: req.meta?.username || '',
                createdAt: req.createdAt || '',
            }));
        }
        return [];
    } catch (err) {
        logger.warn(`Failed to read pairing file for ${channel}`, { error: String(err) });
        return [];
    }
}

// GET /api/pairing/pending
router.get('/pending', (_req, res) => {
    try {
        const pending: PairingRequest[] = [];
        for (const ch of ['telegram', 'openzalo']) {
            pending.push(...readPairingFile(ch));
        }
        res.json({ pending });
    } catch (error) {
        logger.error('Get pending pairings error:', error);
        res.status(500).json({ error: String(error) });
    }
});

// POST /api/pairing/approve — uses CLI only
router.post('/approve', async (req, res) => {
    try {
        const { channel, code } = req.body as { channel: string; code: string };
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }

        const cmd = buildCmd(`pairing approve ${channel} ${code}`);
        logger.info(`Pairing approve: running "${cmd}"`);

        try {
            const { stdout, stderr } = await execAsync(cmd, {
                timeout: 15000,
                env: { ...process.env, CI: 'true' },
            });
            logger.info(`Pairing approved: ${channel} ${code}`, { stdout: stdout.trim(), stderr: stderr.trim() });
            res.json({ success: true, method: 'cli', output: stdout.trim() });
        } catch (error: any) {
            // openclaw CLI exits non-zero even on success — only treat as error if we see real error keywords
            const stdout = error?.stdout || '';
            const stderr = error?.stderr || '';
            const output = stdout + stderr;
            const realErrorKeywords = ['not found', 'permission denied', 'enoent', 'no such file', 'invalid', 'unknown command'];
            const hasRealError = realErrorKeywords.some(kw => output.toLowerCase().includes(kw));

            if (hasRealError) {
                logger.error('Approve pairing error:', { error: error?.message, stderr });
                res.status(500).json({
                    error: `CLI failed: ${stderr || error?.message || String(error)}`,
                    hint: OWNER_USER
                        ? `Ensure sudoers: clawx ALL=(${OWNER_USER}) NOPASSWD: ALL`
                        : 'Could not detect openclaw owner user',
                });
            } else {
                // No real error → assume success
                logger.info(`Pairing approve OK (non-zero exit): ${channel} ${code}`, { output: output.trim() });
                res.json({ success: true, method: 'cli', output: output.trim() });
            }
        }
    } catch (error) {
        logger.error('Approve pairing unexpected error:', error);
        res.status(500).json({ error: String(error) });
    }
});

// POST /api/pairing/reject — uses CLI
router.post('/reject', async (req, res) => {
    try {
        const { channel, code } = req.body as { channel: string; code: string };
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }

        const cmd = buildCmd(`pairing reject ${channel} ${code}`);
        logger.info(`Pairing reject: running "${cmd}"`);

        try {
            const { stdout } = await execAsync(cmd, { timeout: 15000, env: { ...process.env, CI: 'true' } });
            logger.info(`Pairing rejected: ${channel} ${code}`, { stdout: stdout.trim() });
            res.json({ success: true });
        } catch {
            // Reject may not have CLI support — try with 'deny' alias
            try {
                const denyCmd = buildCmd(`pairing deny ${channel} ${code}`);
                const { stdout } = await execAsync(denyCmd, { timeout: 15000, env: { ...process.env, CI: 'true' } });
                res.json({ success: true, output: stdout.trim() });
            } catch (err2) {
                logger.warn('CLI reject failed', { error: String(err2) });
                res.status(500).json({ error: 'Reject CLI failed: ' + String(err2) });
            }
        }
    } catch (error) {
        logger.error('Reject pairing error:', error);
        res.status(500).json({ error: String(error) });
    }
});

export default router;
