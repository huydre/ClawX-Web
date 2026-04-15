/**
 * Ticket Routes — /api/tickets
 * Support ticket creation with file uploads, Supabase storage, Telegram notification.
 */
import { Router } from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, unlinkSync } from 'fs';
import { logger } from '../utils/logger.js';
const router = Router();
const upload = multer({
    dest: '/tmp/ticket-uploads',
    limits: { fileSize: 50 * 1024 * 1024 },
});
/** Lazy Supabase client */
function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key)
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required in .env');
    return createClient(url, key);
}
/** Send Telegram notification to support group */
async function notifyTelegram(ticket, fileCount) {
    const token = process.env.TICKET_BOT_TOKEN;
    const chatId = process.env.TICKET_CHAT_ID;
    if (!token || !chatId)
        return;
    const amount = (ticket.amount || 500000).toLocaleString('vi-VN');
    const shortId = ticket.id.substring(0, 8).toUpperCase();
    const text = [
        `\u{1F4CB} Ticket moi #${shortId}`,
        `\u{1F4DD} ${(ticket.description || '').substring(0, 200)}`,
        fileCount > 0 ? `\u{1F4CE} ${fileCount} file dinh kem` : '',
        `\u{1F4B0} ${amount} VND (cho thanh toan)`,
        ticket.contact_info ? `\u{1F4DE} ${ticket.contact_info}` : '',
        `\u{1F551} ${new Date().toLocaleString('vi-VN')}`,
    ].filter(Boolean).join('\n');
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
        });
    }
    catch (err) {
        logger.warn('Ticket telegram notify failed', { error: err });
    }
}
/**
 * POST /api/tickets — create support ticket
 * Body (multipart/form-data): description, contact_info, files[]
 */
router.post('/', upload.array('files', 5), async (req, res) => {
    try {
        const { description, contact_info } = req.body;
        if (!description || description.trim().length < 10) {
            return res.status(400).json({ error: 'Mo ta loi can it nhat 10 ky tu' });
        }
        const supabase = getSupabase();
        const amount = parseInt(process.env.TICKET_AMOUNT || '500000', 10);
        const bankAccount = process.env.TICKET_BANK_ACCOUNT || 'MS01T17213302551927';
        const bankName = process.env.TICKET_BANK_NAME || 'TCB';
        // 1. Insert ticket
        const { data: ticket, error: ticketErr } = await supabase
            .from('tickets')
            .insert({
            description: description.trim(),
            contact_info: contact_info || null,
            amount,
            device_id: req.headers['x-device-id'] || null,
        })
            .select()
            .single();
        if (ticketErr || !ticket) {
            throw new Error(ticketErr?.message || 'Failed to create ticket');
        }
        // 2. Upload files to Supabase Storage
        const files = req.files || [];
        const uploadedFiles = [];
        for (const file of files) {
            try {
                const filePath = `tickets/${ticket.id}/${file.originalname}`;
                const fileBuffer = readFileSync(file.path);
                const { error: uploadErr } = await supabase.storage
                    .from('ticket-files')
                    .upload(filePath, fileBuffer, { contentType: file.mimetype });
                if (!uploadErr) {
                    const { data: urlData } = supabase.storage
                        .from('ticket-files')
                        .getPublicUrl(filePath);
                    await supabase.from('ticket_files').insert({
                        ticket_id: ticket.id,
                        file_url: urlData.publicUrl,
                        file_name: file.originalname,
                        file_type: file.mimetype,
                        file_size: file.size,
                    });
                    uploadedFiles.push({ name: file.originalname, url: urlData.publicUrl });
                }
                // Cleanup temp file
                try {
                    unlinkSync(file.path);
                }
                catch { /* ignore */ }
            }
            catch (fileErr) {
                logger.warn('Ticket file upload failed', { file: file.originalname, error: fileErr });
            }
        }
        // 3. Telegram notification
        await notifyTelegram(ticket, uploadedFiles.length);
        // 4. Build QR URL
        const ticketShortId = ticket.id.substring(0, 8).toUpperCase();
        const addInfo = `TICKET${ticketShortId}`.replace(/[^A-Z0-9]/g, '');
        const qrUrl = `https://img.vietqr.io/image/${bankName}-${bankAccount}-compact.png?amount=${amount}&addInfo=${addInfo}`;
        logger.info('Ticket created', { ticketId: ticket.id, files: uploadedFiles.length });
        res.json({
            success: true,
            ticket: { id: ticket.id, shortId: ticketShortId, status: ticket.status, amount },
            qrUrl,
            files: uploadedFiles,
        });
    }
    catch (error) {
        logger.error('Create ticket failed', { error });
        res.status(500).json({ error: String(error) });
    }
});
/**
 * GET /api/tickets/config — ticket config (for frontend)
 */
router.get('/config', (_req, res) => {
    res.json({
        amount: parseInt(process.env.TICKET_AMOUNT || '500000', 10),
        bankAccount: process.env.TICKET_BANK_ACCOUNT || 'MS01T17213302551927',
        bankName: process.env.TICKET_BANK_NAME || 'TCB',
        enabled: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    });
});
export default router;
