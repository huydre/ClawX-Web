/**
 * Pairing Routes — /api/pairing
 * Manage DM pairing requests (approve/reject pending users)
 */
import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
const router = Router();
const execAsync = promisify(exec);
const CREDENTIALS_DIR = join(homedir(), '.openclaw', 'credentials');
function readPairingFile(channel) {
    const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
    try {
        if (!existsSync(filePath))
            return [];
        const raw = readFileSync(filePath, 'utf-8').trim();
        if (!raw || raw === '[]' || raw === '{}')
            return [];
        const data = JSON.parse(raw);
        // Handle both array and object formats
        if (Array.isArray(data)) {
            return data.map((item) => ({
                code: item.code || item.pairingCode || '',
                channel,
                senderId: item.senderId || item.sender || item.userId || '',
                senderName: item.senderName || item.name || item.displayName || '',
                createdAt: item.createdAt || item.timestamp || '',
                expiresAt: item.expiresAt || '',
            }));
        }
        // Object format: { "CODE": { senderId, ... } }
        return Object.entries(data).map(([code, val]) => ({
            code,
            channel,
            senderId: val?.senderId || val?.sender || val?.userId || '',
            senderName: val?.senderName || val?.name || val?.displayName || '',
            createdAt: val?.createdAt || val?.timestamp || '',
            expiresAt: val?.expiresAt || '',
        }));
    }
    catch (err) {
        logger.warn(`Failed to read pairing file for ${channel}`, { error: String(err) });
        return [];
    }
}
// GET /api/pairing/pending
// Returns all pending pairing requests across channels
router.get('/pending', (_req, res) => {
    try {
        const channels = ['telegram', 'openzalo'];
        const pending = [];
        for (const channel of channels) {
            pending.push(...readPairingFile(channel));
        }
        res.json({ pending });
    }
    catch (error) {
        logger.error('Get pending pairings error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/pairing/approve
// Approve a pairing request via openclaw CLI
router.post('/approve', async (req, res) => {
    try {
        const { channel, code } = req.body;
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }
        // Try openclaw CLI first
        try {
            const { stdout, stderr } = await execAsync(`openclaw pairing approve ${channel} ${code}`, { timeout: 10000, env: { ...process.env, CI: 'true' } });
            logger.info(`Pairing approved via CLI: ${channel} ${code}`, { stdout, stderr });
            res.json({ success: true, method: 'cli', output: stdout.trim() });
        }
        catch (cliErr) {
            // Fallback: try to remove from pairing file directly
            logger.warn('CLI approve failed, trying direct file edit', { error: String(cliErr) });
            const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
            if (existsSync(filePath)) {
                const raw = readFileSync(filePath, 'utf-8').trim();
                const data = JSON.parse(raw);
                if (typeof data === 'object' && !Array.isArray(data) && code in data) {
                    // Move to allowFrom file
                    const allowPath = join(CREDENTIALS_DIR, `${channel}-allowFrom.json`);
                    let allowList = [];
                    if (existsSync(allowPath)) {
                        try {
                            allowList = JSON.parse(readFileSync(allowPath, 'utf-8'));
                        }
                        catch {
                            allowList = [];
                        }
                    }
                    const senderId = data[code]?.senderId || data[code]?.sender || data[code]?.userId;
                    if (senderId && !allowList.includes(senderId)) {
                        allowList.push(senderId);
                        writeFileSync(allowPath, JSON.stringify(allowList, null, 2), 'utf-8');
                    }
                    delete data[code];
                    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
                    logger.info(`Pairing approved via file edit: ${channel} ${code}`);
                    res.json({ success: true, method: 'file' });
                }
                else {
                    res.status(404).json({ error: 'Pairing code not found' });
                }
            }
            else {
                res.status(500).json({ error: 'CLI failed and no pairing file found: ' + String(cliErr) });
            }
        }
    }
    catch (error) {
        logger.error('Approve pairing error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// POST /api/pairing/reject
// Remove a pending pairing request
router.post('/reject', (req, res) => {
    try {
        const { channel, code } = req.body;
        if (!channel || !code) {
            return res.status(400).json({ error: 'Missing channel or code' });
        }
        const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`);
        if (!existsSync(filePath)) {
            return res.status(404).json({ error: 'No pairing file found' });
        }
        const raw = readFileSync(filePath, 'utf-8').trim();
        const data = JSON.parse(raw);
        if (typeof data === 'object' && !Array.isArray(data) && code in data) {
            delete data[code];
            writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            logger.info(`Pairing rejected: ${channel} ${code}`);
            res.json({ success: true });
        }
        else if (Array.isArray(data)) {
            const filtered = data.filter((item) => item.code !== code && item.pairingCode !== code);
            writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf-8');
            logger.info(`Pairing rejected: ${channel} ${code}`);
            res.json({ success: true });
        }
        else {
            res.status(404).json({ error: 'Pairing code not found' });
        }
    }
    catch (error) {
        logger.error('Reject pairing error:', error);
        res.status(500).json({ error: String(error) });
    }
});
export default router;
