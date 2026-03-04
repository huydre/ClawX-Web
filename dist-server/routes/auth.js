/**
 * Auth Routes — /api/auth
 * Login, logout, and session status for password gate.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isAuthEnabled, verifyPassword, createSessionToken, verifySessionToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
const router = Router();
// Rate limit login attempts: 5 per minute, lockout 15 min
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});
// GET /api/auth/status
router.get('/status', (req, res) => {
    const enabled = isAuthEnabled();
    if (!enabled) {
        return res.json({ authRequired: false, authenticated: true });
    }
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/clawx_session=([^;]+)/);
    const token = match ? decodeURIComponent(match[1]) : null;
    const authenticated = token ? verifySessionToken(token) : false;
    res.json({ authRequired: true, authenticated });
});
// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
    if (!isAuthEnabled()) {
        return res.json({ success: true });
    }
    const { password } = req.body;
    if (!password || !verifyPassword(password)) {
        logger.warn('Failed login attempt', { ip: req.ip });
        return res.status(401).json({ success: false, error: 'Incorrect password' });
    }
    const token = createSessionToken();
    logger.info('Successful login', { ip: req.ip });
    res.setHeader('Set-Cookie', `clawx_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
    res.json({ success: true });
});
// POST /api/auth/logout
router.post('/logout', (_req, res) => {
    res.setHeader('Set-Cookie', 'clawx_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    res.json({ success: true });
});
export default router;
