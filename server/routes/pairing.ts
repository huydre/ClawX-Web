/**
 * Pairing Routes — /api/pairing
 * Manage DM pairing requests (approve/reject pending users)
 */
import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import { gatewayManager } from '../services/gateway-manager.js';

const router = Router();
const execAsync = promisify(exec);

interface PairingRequest {
    id: string;
    code: string;
    channel: string;
    senderId: string;
    senderName: string;
    username: string;
    createdAt: string;
}

/**
 * Find the actual .openclaw directory.
 * Service may run as 'clawx' user but OpenClaw data lives under another user.
 */
function findOpenClawDir(): string {
    // 1. Check current user's home
    const defaultDir = join(homedir(), '.openclaw');
    if (existsSync(join(defaultDir, 'openclaw.json'))) return defaultDir;

    // 2. Check common home dirs for openclaw installations
    const homeBase = '/home';
    try {
        const users = readdirSync(homeBase);
        for (const user of users) {
            const candidate = join(homeBase, user, '.openclaw');
            if (existsSync(join(candidate, 'openclaw.json'))) {
                return candidate;
            }
        }
    } catch { /* no /home access */ }

    // 3. Check root
    const rootDir = '/root/.openclaw';
    if (existsSync(join(rootDir, 'openclaw.json'))) return rootDir;

    return defaultDir;
}

const OPENCLAW_DIR = findOpenClawDir();
const CREDENTIALS_DIR = join(OPENCLAW_DIR, 'credentials');
logger.info(`Pairing routes: using OpenClaw dir ${OPENCLAW_DIR}`);

/**
 * Read pairing file in OpenClaw v1 format:
 * { "version": 1, "requests": [{ "id", "code", "createdAt", "meta": { "username", "firstName" } }] }
 */
function readPairingFile(channel: string): PairingRequest[] {
    const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
    try {
        if (!existsSync(filePath)) return [];
        const raw = readFileSync(filePath, 'utf-8').trim();
        if (!raw || raw === '{}' || raw === '[]') return [];

        const data = JSON.parse(raw);

        // OpenClaw v1 format: { version: 1, requests: [...] }
        if (data.requests && Array.isArray(data.requests)) {
            return data.requests.map((req: any) => ({
                id: req.id || '',
                code: req.code || '',
                channel,
                senderId: req.id || '',
                senderName: req.meta?.firstName || req.meta?.displayName || '',
                username: req.meta?.username || '',
                createdAt: req.createdAt || '',
            }));
        }

        // Fallback: Object format { "CODE": { ... } }
        if (typeof data === 'object' && !Array.isArray(data)) {
            return Object.entries(data)
                .filter(([key]) => key !== 'version')
                .map(([code, val]: [string, any]) => ({
                    id: val?.id || val?.senderId || '',
                    code,
                    channel,
                    senderId: val?.senderId || val?.id || '',
                    senderName: val?.senderName || val?.firstName || '',
                    username: val?.username || '',
                    createdAt: val?.createdAt || '',
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
        const channels = ['telegram', 'openzalo'];
        const pending: PairingRequest[] = [];

        for (const channel of channels) {
            pending.push(...readPairingFile(channel));
        }

        res.json({ pending });
    } catch (error) {
        logger.error('Get pending pairings error:', error);
        res.status(500).json({ error: String(error) });
    }
});

// POST /api/pairing/approve
router.post('/approve', async (req, res) => {
    try {
        const { channel, code } = req.body as { channel: string; code: string };
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }

        // Method 1: Gateway RPC
        try {
            const result = await gatewayManager.rpc('pairing.approve', { channel, code }, 8000);
            logger.info(`Pairing approved via RPC: ${channel} ${code}`, { result });
            return res.json({ success: true, method: 'rpc' });
        } catch (rpcErr) {
            logger.warn('RPC pairing.approve failed', { error: String(rpcErr) });
        }

        // Method 2: CLI (runs as current user or finds openclaw)
        try {
            const { stdout } = await execAsync(
                `openclaw pairing approve ${channel} ${code}`,
                { timeout: 15000, env: { ...process.env, CI: 'true' } }
            );
            logger.info(`Pairing approved via CLI: ${channel} ${code}`, { stdout: stdout.trim() });
            return res.json({ success: true, method: 'cli', output: stdout.trim() });
        } catch (cliErr) {
            logger.warn('CLI pairing approve failed', { error: String(cliErr) });
        }

        // Method 3: Try running as the user who owns the openclaw dir
        try {
            const ownerUser = OPENCLAW_DIR.match(/\/home\/([^/]+)\//)?.[1];
            if (ownerUser && ownerUser !== 'clawx') {
                const { stdout } = await execAsync(
                    `sudo -u ${ownerUser} openclaw pairing approve ${channel} ${code}`,
                    { timeout: 15000, env: { ...process.env, CI: 'true' } }
                );
                logger.info(`Pairing approved via sudo CLI: ${channel} ${code}`, { stdout: stdout.trim() });
                return res.json({ success: true, method: 'sudo-cli', output: stdout.trim() });
            }
        } catch (sudoErr) {
            logger.warn('sudo CLI pairing approve failed', { error: String(sudoErr) });
        }

        // Method 4: Direct file edit
        const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
        if (!existsSync(filePath)) {
            return res.status(500).json({ error: 'All approve methods failed' });
        }

        const raw = readFileSync(filePath, 'utf-8').trim();
        const data = JSON.parse(raw);

        // v1 format with requests array
        if (data.requests && Array.isArray(data.requests)) {
            const reqEntry = data.requests.find((r: any) => r.code === code);
            if (!reqEntry) {
                return res.status(404).json({ error: 'Pairing code not found' });
            }

            // Add sender to allowFrom
            const allowPath = join(CREDENTIALS_DIR, `${channel}-allowFrom.json`);
            let allowList: string[] = [];
            if (existsSync(allowPath)) {
                try { allowList = JSON.parse(readFileSync(allowPath, 'utf-8')); } catch { allowList = []; }
            }
            if (!Array.isArray(allowList)) allowList = [];

            const senderId = reqEntry.id;
            if (senderId && !allowList.includes(senderId)) {
                allowList.push(senderId);
                writeFileSync(allowPath, JSON.stringify(allowList, null, 2), 'utf-8');
            }

            // Remove from requests
            data.requests = data.requests.filter((r: any) => r.code !== code);
            writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

            logger.info(`Pairing approved via file edit: ${channel} ${code}, senderId=${senderId}`);
            return res.json({ success: true, method: 'file' });
        }

        res.status(404).json({ error: 'Pairing code not found in file' });
    } catch (error) {
        logger.error('Approve pairing error:', error);
        res.status(500).json({ error: String(error) });
    }
});

// POST /api/pairing/reject
router.post('/reject', (req, res) => {
    try {
        const { channel, code } = req.body as { channel: string; code: string };
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }

        const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
        if (!existsSync(filePath)) {
            return res.status(404).json({ error: 'No pairing file found' });
        }

        const raw = readFileSync(filePath, 'utf-8').trim();
        const data = JSON.parse(raw);

        if (data.requests && Array.isArray(data.requests)) {
            data.requests = data.requests.filter((r: any) => r.code !== code);
            writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            logger.info(`Pairing rejected: ${channel} ${code}`);
            return res.json({ success: true });
        }

        res.status(404).json({ error: 'Pairing code not found' });
    } catch (error) {
        logger.error('Reject pairing error:', error);
        res.status(500).json({ error: String(error) });
    }
});

export default router;
