/**
 * Pairing Routes — /api/pairing
 * Manage DM pairing requests (approve/reject pending users)
 * Uses openclaw CLI for approve (communicates directly with gateway)
 */
import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

const router = Router();

interface PairingRequest {
    id: string;
    code: string;
    channel: string;
    accountId: string;
    senderId: string;
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

logger.info(`Pairing: openclaw dir=${OPENCLAW_DIR}, owner=${OWNER_USER}`);

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
                accountId: req.meta?.accountId || 'default',
                senderName: req.meta?.firstName || req.meta?.displayName || '',
                username: req.meta?.username || '',
                senderId: String(req.id || ''),
                createdAt: req.createdAt || '',
            }));
        }
        return [];
    } catch (err) {
        logger.warn(`Failed to read pairing file for ${channel}`, { error: String(err) });
        return [];
    }
}

/** Remove a pairing entry from the credentials file after approve/reject */
function removePairingEntry(channel: string, code: string): void {
    const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
    try {
        if (!existsSync(filePath)) return;
        const raw = readFileSync(filePath, 'utf-8').trim();
        if (!raw || raw === '{}' || raw === '[]') return;

        const data = JSON.parse(raw);
        if (data.requests && Array.isArray(data.requests)) {
            const before = data.requests.length;
            data.requests = data.requests.filter((req: any) => req.code !== code);
            if (data.requests.length < before) {
                writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
                logger.info(`Removed pairing entry from file`, { channel, code, removed: before - data.requests.length });
            }
        }
    } catch (err) {
        logger.warn(`Failed to clean up pairing file for ${channel}`, { error: String(err) });
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

/** Write sender ID to the allowFrom credentials file (same as what CLI does) */
function approveSenderDirect(channel: string, code: string): { senderId: string } {
    // 1. Find the sender ID from the pairing request
    const pairingFile = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
    if (!existsSync(pairingFile)) {
        throw new Error(`Pairing file not found: ${pairingFile}`);
    }

    const pairingData = JSON.parse(readFileSync(pairingFile, 'utf-8'));
    const requests = pairingData.requests || [];
    const request = requests.find((r: any) => r.code === code);
    if (!request) {
        throw new Error(`Pairing request not found for code: ${code}`);
    }

    const senderId = String(request.id);
    const accountId = request.meta?.accountId || 'default';

    // 2. Write sender to allowFrom file (merge with existing)
    const allowFile = join(CREDENTIALS_DIR, `${channel}-${accountId}-allowFrom.json`);
    let allowData: { version: number; allowFrom: string[] } = { version: 1, allowFrom: [] };

    try {
        if (existsSync(allowFile)) {
            allowData = JSON.parse(readFileSync(allowFile, 'utf-8'));
        }
    } catch { /* start fresh */ }

    if (!allowData.allowFrom.includes(senderId)) {
        allowData.allowFrom.push(senderId);
    }

    writeFileSync(allowFile, JSON.stringify(allowData, null, 2), 'utf-8');
    logger.info(`Written sender ${senderId} to ${allowFile}`);

    // 3. Remove the request from pairing file
    pairingData.requests = requests.filter((r: any) => r.code !== code);
    writeFileSync(pairingFile, JSON.stringify(pairingData, null, 2), 'utf-8');

    return { senderId };
}

// POST /api/pairing/approve — writes directly to credentials files
router.post('/approve', async (req, res) => {
    try {
        const { channel, code } = req.body as { channel: string; code: string };
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }

        try {
            const { senderId } = approveSenderDirect(channel, code);
            logger.info(`Pairing approved (direct file): ${channel} ${code} → sender ${senderId}`);
            res.json({ success: true, method: 'direct', output: `Approved ${channel} sender ${senderId}` });
        } catch (directErr) {
            logger.error('Direct approve failed:', { error: String(directErr) });
            res.status(500).json({ error: String(directErr) });
        }
    } catch (error) {
        logger.error('Approve pairing unexpected error:', error);
        res.status(500).json({ error: String(error) });
    }
});

// POST /api/pairing/reject — directly remove from pairing file (no CLI needed)
router.post('/reject', async (req, res) => {
    try {
        const { channel, code } = req.body as { channel: string; code: string };
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }

        removePairingEntry(channel, code);
        logger.info(`Pairing rejected (direct): ${channel} ${code}`);
        res.json({ success: true });
    } catch (error) {
        logger.error('Reject pairing error:', error);
        res.status(500).json({ error: String(error) });
    }
});

export default router;
