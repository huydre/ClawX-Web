/**
 * Ticket Routes — /api/tickets
 * Forward support tickets to admin API (https://admin.openclaw-box.com).
 * No Supabase credentials stored locally — admin handles storage + Telegram.
 */
import { Router } from 'express';
import multer from 'multer';
import { logger } from '../utils/logger.js';
const router = Router();
const ADMIN_API = 'https://admin.openclaw-box.com';
const upload = multer({
    dest: '/tmp/ticket-uploads',
    limits: { fileSize: 50 * 1024 * 1024 },
});
/**
 * POST /api/tickets — create support ticket
 * Receives form data + files, forwards to admin API
 */
router.post('/', upload.array('files', 5), async (req, res) => {
    try {
        const { description, contact_info } = req.body;
        if (!description || description.trim().length < 10) {
            return res.status(400).json({ error: 'Mo ta loi can it nhat 10 ky tu' });
        }
        // Build FormData to forward to admin API
        const formData = new FormData();
        formData.append('description', description.trim());
        if (contact_info)
            formData.append('contact_info', contact_info);
        formData.append('device_id', req.headers['x-device-id'] || '');
        // Read and attach files
        const files = req.files || [];
        const { readFileSync, unlinkSync } = await import('fs');
        for (const file of files) {
            try {
                const buffer = readFileSync(file.path);
                const blob = new Blob([buffer], { type: file.mimetype });
                formData.append('files', blob, file.originalname);
            }
            catch { /* skip unreadable */ }
        }
        // Forward to admin API
        const response = await fetch(`${ADMIN_API}/api/tickets`, {
            method: 'POST',
            body: formData,
        });
        // Cleanup temp files
        for (const file of files) {
            try {
                unlinkSync(file.path);
            }
            catch { /* ignore */ }
        }
        // Handle non-JSON responses (admin API may return HTML errors)
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await response.text();
            logger.warn('Admin API returned non-JSON', { status: response.status, body: text.substring(0, 200) });
            return res.status(502).json({ error: 'Admin API unavailable or returned invalid response' });
        }
        const data = await response.json();
        if (!response.ok) {
            logger.warn('Admin API ticket creation failed', { status: response.status, data });
            return res.status(response.status).json(data);
        }
        logger.info('Ticket forwarded to admin API', { ticketId: data.ticket?.id });
        res.json(data);
    }
    catch (error) {
        logger.error('Create ticket failed', { error });
        res.status(500).json({ error: String(error) });
    }
});
/**
 * GET /api/tickets/config — get ticket config from admin API
 */
router.get('/config', async (_req, res) => {
    try {
        const response = await fetch(`${ADMIN_API}/api/tickets/config`);
        const data = await response.json();
        res.json(data);
    }
    catch {
        // Fallback defaults if admin API unreachable
        res.json({
            amount: 500000,
            bankAccount: 'MS01T17213302551927',
            bankName: 'TCB',
            enabled: true,
        });
    }
});
export default router;
