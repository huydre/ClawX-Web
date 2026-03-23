/**
 * Pairing Routes — /api/pairing
 * Manage DM pairing requests (approve/reject pending users)
 * Uses openclaw CLI for approve (communicates directly with gateway)
 */
import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync, readdirSync, realpathSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { exec, execSync } from 'child_process';
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
/** Resolve the actual home directory for a user via getent passwd (works with any username) */
function resolveUserHome(username) {
    try {
        const passwd = execSync(`getent passwd ${username}`, { encoding: 'utf-8' }).trim();
        const homeDir = passwd.split(':')[5];
        if (homeDir && existsSync(homeDir))
            return homeDir;
    }
    catch { /* getent failed, use fallback */ }
    return `/home/${username}`;
}
const OWNER_HOME = OWNER_USER ? resolveUserHome(OWNER_USER) : homedir();
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
        const ownerHome = OWNER_HOME;
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
/** Resolve openclaw binary to its actual .mjs entry point */
function resolveOpenClawMjs() {
    try {
        return realpathSync(OPENCLAW_BIN);
    }
    catch {
        // Try common pattern: ~/.npm-global/lib/node_modules/openclaw/openclaw.mjs
        if (OWNER_USER) {
            const mjs = join(OWNER_HOME, '.npm-global', 'lib', 'node_modules', 'openclaw', 'openclaw.mjs');
            if (existsSync(mjs))
                return mjs;
        }
        return null;
    }
}
/** Find NVM node binary (highest version) for a given home dir */
function findNvmNode(userHome) {
    try {
        const versionsDir = join(userHome, '.nvm', 'versions', 'node');
        if (!existsSync(versionsDir))
            return null;
        const versions = readdirSync(versionsDir).sort();
        if (versions.length === 0)
            return null;
        const latest = versions[versions.length - 1];
        const nodeBin = join(versionsDir, latest, 'bin', 'node');
        return existsSync(nodeBin) ? nodeBin : null;
    }
    catch {
        return null;
    }
}
const OPENCLAW_MJS = resolveOpenClawMjs();
// OWNER_HOME already defined above via resolveUserHome()
const NVM_NODE = findNvmNode(OWNER_HOME);
logger.info(`Pairing: openclaw dir=${OPENCLAW_DIR}, bin=${OPENCLAW_BIN}, mjs=${OPENCLAW_MJS}, owner=${OWNER_USER}, nvmNode=${NVM_NODE}`);
/** Build CLI command: always use NVM node + openclaw.mjs to bypass shebang version issues */
function buildCmd(args) {
    const currentUser = process.env.USER || process.env.LOGNAME || '';
    const entry = OPENCLAW_MJS || OPENCLAW_BIN;
    const nodeCmd = NVM_NODE || 'node';
    // Embed HOME and CI directly in command to ensure they're available under systemd
    const envPrefix = `HOME=${OWNER_HOME} CI=true`;
    if (OWNER_USER && OWNER_USER !== currentUser) {
        // Different user: use sudo with env preservation
        return `sudo -u ${OWNER_USER} env ${envPrefix} ${nodeCmd} ${entry} ${args}`;
    }
    // Same user: run node directly (bypasses shebang which may use old system node)
    return `env ${envPrefix} ${nodeCmd} ${entry} ${args}`;
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
/** Remove a pairing entry from the credentials file after approve/reject */
function removePairingEntry(channel, code) {
    const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
    try {
        if (!existsSync(filePath))
            return;
        const raw = readFileSync(filePath, 'utf-8').trim();
        if (!raw || raw === '{}' || raw === '[]')
            return;
        const data = JSON.parse(raw);
        if (data.requests && Array.isArray(data.requests)) {
            const before = data.requests.length;
            data.requests = data.requests.filter((req) => req.code !== code);
            if (data.requests.length < before) {
                writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
                logger.info(`Removed pairing entry from file`, { channel, code, removed: before - data.requests.length });
            }
        }
    }
    catch (err) {
        logger.warn(`Failed to clean up pairing file for ${channel}`, { error: String(err) });
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
/** Write sender ID to the allowFrom credentials file (same as what CLI does) */
function approveSenderDirect(channel, code) {
    // 1. Find the sender ID from the pairing request
    const pairingFile = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
    if (!existsSync(pairingFile)) {
        throw new Error(`Pairing file not found: ${pairingFile}`);
    }
    const pairingData = JSON.parse(readFileSync(pairingFile, 'utf-8'));
    const requests = pairingData.requests || [];
    const request = requests.find((r) => r.code === code);
    if (!request) {
        throw new Error(`Pairing request not found for code: ${code}`);
    }
    const senderId = String(request.id);
    const accountId = request.meta?.accountId || 'default';
    // 2. Write sender to allowFrom file (merge with existing)
    const allowFile = join(CREDENTIALS_DIR, `${channel}-${accountId}-allowFrom.json`);
    let allowData = { version: 1, allowFrom: [] };
    try {
        if (existsSync(allowFile)) {
            allowData = JSON.parse(readFileSync(allowFile, 'utf-8'));
        }
    }
    catch { /* start fresh */ }
    if (!allowData.allowFrom.includes(senderId)) {
        allowData.allowFrom.push(senderId);
    }
    writeFileSync(allowFile, JSON.stringify(allowData, null, 2), 'utf-8');
    logger.info(`Written sender ${senderId} to ${allowFile}`);
    // 3. Remove the request from pairing file
    pairingData.requests = requests.filter((r) => r.code !== code);
    writeFileSync(pairingFile, JSON.stringify(pairingData, null, 2), 'utf-8');
    return { senderId };
}
// POST /api/pairing/approve — writes directly to credentials files
router.post('/approve', async (req, res) => {
    try {
        const { channel, code } = req.body;
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }
        try {
            const { senderId } = approveSenderDirect(channel, code);
            logger.info(`Pairing approved (direct file): ${channel} ${code} → sender ${senderId}`);
            res.json({ success: true, method: 'direct', output: `Approved ${channel} sender ${senderId}` });
        }
        catch (directErr) {
            logger.error('Direct approve failed:', { error: String(directErr) });
            res.status(500).json({ error: String(directErr) });
        }
    }
    catch (error) {
        logger.error('Approve pairing unexpected error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/pairing/reject — directly remove from pairing file (no CLI needed)
router.post('/reject', async (req, res) => {
    try {
        const { channel, code } = req.body;
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }
        removePairingEntry(channel, code);
        logger.info(`Pairing rejected (direct): ${channel} ${code}`);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Reject pairing error:', error);
        res.status(500).json({ error: String(error) });
    }
});
export default router;
