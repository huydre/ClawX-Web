/**
 * Ticket Routes — /api/tickets
 * Forward support tickets to admin API (admin.openclaw-box.com).
 * Files uploaded to Supabase Storage first, then URLs sent in ticket payload.
 */
import { Router } from 'express';
import multer from 'multer';
import { readFileSync, unlinkSync } from 'fs';
import { logger } from '../utils/logger.js';

const router = Router();

const ADMIN_API = 'https://admin.openclaw-box.com';
const API_KEY = '7a04a90a1ba8935b275bc5de6f840f77d0b1bea1c7300c27856e39f3c814677e';

const upload = multer({
  dest: '/tmp/ticket-uploads',
  limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * POST /api/tickets — create support ticket
 * Receives multipart form from frontend, forwards as JSON to admin API
 */
router.post('/', upload.array('files', 5), async (req, res) => {
  try {
    const { description, contact_info } = req.body;
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'Mo ta loi can it nhat 10 ky tu' });
    }

    const amount = 500000;
    const bankAccount = 'MS01T17213302551927';
    const bankName = 'TCB';

    // Build file list (convert uploaded files to base64 data URLs for now)
    // TODO: Upload to Supabase Storage when credentials available
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];
    const fileList: Array<{ url: string; name: string; type: string; size: number }> = [];

    for (const file of uploadedFiles) {
      try {
        const buffer = readFileSync(file.path);
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${file.mimetype};base64,${base64}`;
        fileList.push({
          url: dataUrl,
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
        });
      } catch { /* skip */ }
      try { unlinkSync(file.path); } catch { /* ignore */ }
    }

    // Device ID from tunnel subdomain or hostname
    const { hostname } = await import('os');
    const deviceId = process.env.CLOUDFLARE_TUNNEL_SUBDOMAIN || hostname();

    // Forward to admin API as JSON
    const ticketPayload = {
      description: description.trim(),
      contact_info: contact_info || null,
      device_id: deviceId,
      amount,
      files: fileList,
    };

    const response = await fetch(`${ADMIN_API}/api/tickets`, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(ticketPayload),
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      logger.warn('Admin API returned non-JSON', { status: response.status, body: text.substring(0, 200) });
      return res.status(502).json({ error: 'Admin API unavailable' });
    }

    const data = await response.json();

    if (!response.ok) {
      logger.warn('Admin API ticket failed', { status: response.status, data });
      return res.status(response.status).json({ error: data.error || 'Ticket creation failed' });
    }

    // Build QR URL from ticket_id
    const ticketId = data.ticket_id || '';
    const shortId = ticketId.substring(0, 8).toUpperCase();
    const addInfo = `TICKET${shortId}`.replace(/[^A-Z0-9]/g, '');
    const qrUrl = `https://img.vietqr.io/image/${bankName}-${bankAccount}-compact.png?amount=${amount}&addInfo=${addInfo}`;

    logger.info('Ticket created via admin API', { ticketId });

    res.json({
      success: true,
      ticket: { id: ticketId, shortId, status: 'pending_payment', amount },
      qrUrl,
      files: fileList.map(f => ({ name: f.name, url: '' })),
    });
  } catch (error) {
    logger.error('Create ticket failed', { error });
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/tickets/config — ticket config for frontend
 */
router.get('/config', (_req, res) => {
  res.json({
    amount: 500000,
    bankAccount: 'MS01T17213302551927',
    bankName: 'TCB',
    enabled: true,
  });
});

export default router;
