/**
 * Backup & Restore Routes — /api/backup
 * Export/import ~/.openclaw + ~/.clawx config as a tar.gz archive.
 */
import { Router } from 'express';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import multer from 'multer';
import { logger } from '../utils/logger.js';
const router = Router();
const OPENCLAW_DIR = join(homedir(), '.openclaw');
const CLAWX_DIR = join(homedir(), '.clawx');
// Multer config for restore upload
const upload = multer({
    dest: join(homedir(), '.clawx', 'tmp'),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
    fileFilter: (_req, file, cb) => {
        if (file.originalname.endsWith('.tar.gz') || file.originalname.endsWith('.tgz') || file.mimetype === 'application/gzip') {
            cb(null, true);
        }
        else {
            cb(new Error('Only .tar.gz files are allowed'));
        }
    },
});
/**
 * GET /api/backup/export
 * Stream a tar.gz archive of ~/.openclaw + ~/.clawx to the client.
 */
router.get('/export', async (_req, res) => {
    try {
        const dirs = [];
        if (existsSync(OPENCLAW_DIR))
            dirs.push('.openclaw');
        if (existsSync(CLAWX_DIR))
            dirs.push('.clawx');
        if (dirs.length === 0) {
            return res.status(404).json({ error: 'No config directories found to backup' });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `clawx-backup-${timestamp}.tar.gz`;
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await pipeline(tar.create({ gzip: true, cwd: homedir(), portable: true }, dirs), res);
        logger.info('Backup exported', { dirs, filename });
    }
    catch (error) {
        logger.error('Backup export error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: String(error) });
        }
    }
});
/**
 * POST /api/backup/restore
 * Upload a tar.gz archive and extract it to ~/
 * Overwrites existing config files.
 */
router.post('/restore', upload.single('backup'), async (req, res) => {
    const uploadedFile = req.file;
    if (!uploadedFile) {
        return res.status(400).json({ error: 'No file uploaded. Send a .tar.gz file as "backup" field.' });
    }
    try {
        // Verify archive contains expected dirs
        const entries = [];
        await tar.list({
            file: uploadedFile.path,
            onReadEntry: (entry) => { entries.push(entry.path); },
        });
        const hasOpenclaw = entries.some(e => e.startsWith('.openclaw/') || e.startsWith('.openclaw'));
        const hasClawx = entries.some(e => e.startsWith('.clawx/') || e.startsWith('.clawx'));
        if (!hasOpenclaw && !hasClawx) {
            unlinkSync(uploadedFile.path);
            return res.status(400).json({ error: 'Invalid backup: archive must contain .openclaw or .clawx directories' });
        }
        // Extract to home directory
        await tar.extract({
            file: uploadedFile.path,
            cwd: homedir(),
        });
        // Cleanup uploaded temp file
        unlinkSync(uploadedFile.path);
        logger.info('Backup restored', { entries: entries.length, hasOpenclaw, hasClawx });
        res.json({
            success: true,
            restored: {
                openclaw: hasOpenclaw,
                clawx: hasClawx,
                totalFiles: entries.length,
            },
        });
    }
    catch (error) {
        // Cleanup on error
        try {
            if (uploadedFile?.path)
                unlinkSync(uploadedFile.path);
        }
        catch { /* ignore */ }
        logger.error('Backup restore error:', error);
        res.status(500).json({ error: String(error) });
    }
});
/**
 * GET /api/backup/info
 * Return info about what would be backed up (sizes, file counts).
 */
router.get('/info', async (_req, res) => {
    try {
        const info = {
            openclaw: existsSync(OPENCLAW_DIR),
            clawx: existsSync(CLAWX_DIR),
        };
        res.json(info);
    }
    catch (error) {
        logger.error('Backup info error:', error);
        res.status(500).json({ error: String(error) });
    }
});
export default router;
