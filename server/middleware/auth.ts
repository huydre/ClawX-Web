/**
 * Auth Middleware — Password Gate for ClawX-Web
 * If CLAWX_AUTH_PASSWORD is set, all requests require a valid session token.
 * No external dependencies — uses Node.js crypto.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Generate a stable secret from the password (used for HMAC signing)
const getSecret = (): string => {
  const password = process.env.CLAWX_AUTH_PASSWORD;
  if (!password) return '';
  return crypto.createHash('sha256').update(`clawx-session-${password}`).digest('hex');
};

/** Check if auth is enabled */
export const isAuthEnabled = (): boolean => {
  const pw = process.env.CLAWX_AUTH_PASSWORD;
  return Boolean(pw && pw.trim().length > 0);
};

/** Create a session token (HMAC-signed, 7-day expiry) */
export const createSessionToken = (): string => {
  const secret = getSecret();
  const payload = `${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}:${signature}`;
};

/** Verify a session token */
export const verifySessionToken = (token: string): boolean => {
  if (!token) return false;
  const secret = getSecret();
  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [ts, nonce, sig] = parts;
  const payload = `${ts}:${nonce}`;

  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      return false;
    }
  } catch {
    return false;
  }

  // Check expiry (7 days)
  const timestamp = parseInt(ts, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  return true;
};

/** Verify password (constant-time) */
export const verifyPassword = (input: string): boolean => {
  const password = process.env.CLAWX_AUTH_PASSWORD;
  if (!password) return true;
  if (input.length !== password.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(password));
  } catch {
    return false;
  }
};

/** Extract session token from cookie header (no cookie-parser needed) */
const getTokenFromCookies = (req: Request): string | null => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith('clawx_session=')) {
      return decodeURIComponent(cookie.substring('clawx_session='.length));
    }
  }
  return null;
};

/**
 * Auth middleware — gates all requests when CLAWX_AUTH_PASSWORD is set.
 * Exempt: /api/auth/*, /health, static assets (handled by SPA).
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip if auth not enabled
  if (!isAuthEnabled()) {
    return next();
  }

  // Allow auth endpoints and health check
  if (req.path.startsWith('/api/auth') || req.path === '/health') {
    return next();
  }

  // Check session token from cookie or Authorization header
  const token = getTokenFromCookies(req) || (req.headers.authorization?.replace('Bearer ', '') ?? null);

  if (token && verifySessionToken(token)) {
    return next();
  }

  // Not authenticated
  if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
    // API/WebSocket request — return 401
    res.status(401).json({ error: 'Authentication required' });
  } else {
    // Browser request — let through so SPA can show login page
    return next();
  }
};
