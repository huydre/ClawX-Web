/**
 * Pairing Routes — /api/pairing
 * Manage DM pairing requests (approve/reject pending users)
 * Uses openclaw CLI for approve (communicates directly with gateway)
 */
import { Router } from 'express';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
const router = Router();
const execAsync = promisify(exec);
/** Find the .openclaw dir (may be under a different user than who runs this service) */
function findOpenClawDir() {
    const defaultDir = join(homedir(), '.openclaw');
    if (existsSync(join(defaultDir, 'openclaw.json')))
        return defaultDir;
    try {
        for (const user of readdirSync('/home')) {
            const candidate = join('/home', user, '.openclaw');
            if (existsSync(join(candidate, 'openclaw.json')))
                return candidate;
        }
    }
    catch { /* no access */ }
    if (existsSync('/root/.openclaw/openclaw.json'))
        return '/root/.openclaw';
    return defaultDir;
}
/** Read the .clawx-owner file to get the real user who installed openclaw */
function getOwnerUser() {
    try {
        const ownerFile = join(process.cwd(), '.clawx-owner');
        if (existsSync(ownerFile)) {
            return readFileSync(ownerFile, 'utf-8').trim();
        }
    }
    catch { /* ignore */ }
    // Fallback: detect from openclaw dir path
    const dir = findOpenClawDir();
    const match = dir.match(/\/home\/([^/]+)\//);
    return match?.[1] || null;
}
const OPENCLAW_DIR = findOpenClawDir();
const CREDENTIALS_DIR = join(OPENCLAW_DIR, 'credentials');
const OWNER_USER = getOwnerUser();
/** Find the actual openclaw binary path */
function findOpenClawBin() {
    const searchPaths = [
        '/usr/local/bin/openclaw',
        '/usr/bin/openclaw',
        join(homedir(), '.local', 'bin', 'openclaw'),
        join(homedir(), '.openclaw', 'bin', 'openclaw'),
    ];
    // Also search in owner user's paths
    if (OWNER_USER) {
        const ownerHome = `/home/${OWNER_USER}`;
        searchPaths.push(join(ownerHome, '.local', 'bin', 'openclaw'), join(ownerHome, '.openclaw', 'bin', 'openclaw'), join(ownerHome, '.npm-global', 'bin', 'openclaw'), join(ownerHome, '.nvm', 'current', 'bin', 'openclaw'), join(ownerHome, '.local', 'share', 'pnpm', 'openclaw'));
    }
    for (const p of searchPaths) {
        if (existsSync(p))
            return p;
    }
    // Last resort: use just 'openclaw' and hope PATH works
    return 'openclaw';
}
const OPENCLAW_BIN = findOpenClawBin();
logger.info(`Pairing: openclaw dir=${OPENCLAW_DIR}, bin=${OPENCLAW_BIN}, owner=${OWNER_USER}`);
/** Build the CLI command, running as owner user if needed */
function buildCmd(args) {
    const currentUser = process.env.USER || process.env.LOGNAME || '';
    if (OWNER_USER && OWNER_USER !== currentUser) {
        return `sudo -i -u ${OWNER_USER} ${OPENCLAW_BIN} ${args}`;
    }
    return `${OPENCLAW_BIN} ${args}`;
}
/** Parse OpenClaw v1 pairing file */
function readPairingFile(channel) {
    const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
    try {
        if (!existsSync(filePath))
            return [];
        const raw = readFileSync(filePath, 'utf-8').trim();
        if (!raw || raw === '{}' || raw === '[]')
            return [];
        const data = JSON.parse(raw);
        if (data.requests && Array.isArray(data.requests)) {
            return data.requests.map((req) => ({
                id: req.id || '',
                code: req.code || '',
                channel,
                senderName: req.meta?.firstName || req.meta?.displayName || '',
                username: req.meta?.username || '',
                createdAt: req.createdAt || '',
            }));
        }
        return [];
    }
    catch (err) {
        logger.warn(`Failed to read pairing file for ${channel}`, { error: String(err) });
        return [];
    }
}
// GET /api/pairing/pending
router.get('/pending', (_req, res) => {
    try {
        const pending = [];
        for (const ch of ['telegram', 'openzalo']) {
            pending.push(...readPairingFile(ch));
        }
        res.json({ pending });
    }
    catch (error) {
        logger.error('Get pending pairings error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/pairing/approve — uses CLI only
router.post('/approve', async (req, res) => {
    try {
        const { channel, code } = req.body;
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }
        const cmd = buildCmd(`pairing approve ${channel} ${code}`);
        logger.info(`Pairing approve: running "${cmd}"`);
        const { stdout, stderr } = await execAsync(cmd, {
            timeout: 15000,
            env: { ...process.env, CI: 'true' },
        });
        logger.info(`Pairing approved: ${channel} ${code}`, { stdout: stdout.trim(), stderr: stderr.trim() });
        res.json({ success: true, method: 'cli', output: stdout.trim() });
    }
    catch (error) {
        logger.error('Approve pairing error:', { error: error?.message, stderr: error?.stderr });
        res.status(500).json({
            error: `CLI failed: ${error?.stderr || error?.message || String(error)}`,
            hint: OWNER_USER
                ? `Ensure sudoers: clawx ALL=(${OWNER_USER}) NOPASSWD: ALL`
                : 'Could not detect openclaw owner user',
        });
    }
});
// POST /api/pairing/reject — uses CLI
router.post('/reject', async (req, res) => {
    try {
        const { channel, code } = req.body;
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }
        const cmd = buildCmd(`pairing reject ${channel} ${code}`);
        logger.info(`Pairing reject: running "${cmd}"`);
        try {
            const { stdout } = await execAsync(cmd, { timeout: 15000, env: { ...process.env, CI: 'true' } });
            logger.info(`Pairing rejected: ${channel} ${code}`, { stdout: stdout.trim() });
            res.json({ success: true });
        }
        catch {
            // Reject may not have CLI support — try with 'deny' alias
            try {
                const denyCmd = buildCmd(`pairing deny ${channel} ${code}`);
                const { stdout } = await execAsync(denyCmd, { timeout: 15000, env: { ...process.env, CI: 'true' } });
                res.json({ success: true, output: stdout.trim() });
            }
            catch (err2) {
                logger.warn('CLI reject failed', { error: String(err2) });
                res.status(500).json({ error: 'Reject CLI failed: ' + String(err2) });
            }
        }
    }
    catch (error) {
        logger.error('Reject pairing error:', error);
        res.status(500).json({ error: String(error) });
    }
});
export default router;
