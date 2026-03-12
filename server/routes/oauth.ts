/**
 * OAuth Routes — /api/oauth
 * Handle OAuth flows for providers that use OAuth instead of API keys.
 * Currently supports: OpenAI Codex
 */
import { Router } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { getCloudflareSettings } from '../services/storage.js';
import {
  saveOAuthTokenToOpenClaw,
  getOAuthTokenFromOpenClaw,
  setOpenClawDefaultModel,
} from '../utils/openclaw-sync.js';

const router = Router();

// ── Codex OAuth Config ─────────────────────────────────────────────────────
const CODEX_CONFIG = {
  clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
  authorizeUrl: 'https://auth.openai.com/oauth/authorize',
  tokenUrl: 'https://auth.openai.com/oauth/token',
  scope: 'openid profile email offline_access',
  codeChallengeMethod: 'S256' as const,
  extraParams: {
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    originator: 'codex_cli_rs',
  },
};

// ── PKCE Helpers ───────────────────────────────────────────────────────────
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

// In-memory store for PKCE state (TTL 5 min)
const pendingFlows = new Map<string, { codeVerifier: string; createdAt: number }>();

function cleanupExpiredFlows(): void {
  const now = Date.now();
  for (const [state, flow] of pendingFlows) {
    if (now - flow.createdAt > 5 * 60 * 1000) {
      pendingFlows.delete(state);
    }
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/oauth/codex/start
 * Generate PKCE + auth URL. Frontend opens this URL in a new tab.
 */
router.get('/codex/start', async (req, res) => {
  try {
    cleanupExpiredFlows();

    // Build callback URL using tunnel domain or request host
    const cf = await getCloudflareSettings();
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = cf?.domain || req.headers.host || 'localhost:2003';
    const redirectUri = `${protocol}://${host}/api/oauth/codex/callback`;

    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store verifier for callback
    pendingFlows.set(state, { codeVerifier, createdAt: Date.now() });

    // Build auth URL manually (encode spaces as %20, not +)
    const params: Record<string, string> = {
      response_type: 'code',
      client_id: CODEX_CONFIG.clientId,
      redirect_uri: redirectUri,
      scope: CODEX_CONFIG.scope,
      code_challenge: codeChallenge,
      code_challenge_method: CODEX_CONFIG.codeChallengeMethod,
      ...CODEX_CONFIG.extraParams,
      state,
    };

    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    const authUrl = `${CODEX_CONFIG.authorizeUrl}?${queryString}`;

    logger.info('Codex OAuth started', { redirectUri, state });
    res.json({ authUrl, state });
  } catch (error) {
    logger.error('Codex OAuth start error:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/oauth/codex/callback
 * OpenAI redirects here after user approves. Exchange code for tokens.
 */
router.get('/codex/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    if (oauthError) {
      logger.error('Codex OAuth error from provider', { oauthError, error_description });
      return res.redirect(`/?oauth=error&message=${encodeURIComponent(String(error_description || oauthError))}`);
    }

    if (!code || !state) {
      return res.redirect('/?oauth=error&message=Missing+code+or+state');
    }

    // Validate state
    const flow = pendingFlows.get(String(state));
    if (!flow) {
      return res.redirect('/?oauth=error&message=Invalid+or+expired+state');
    }
    pendingFlows.delete(String(state));

    // Build redirect URI (must match the one used in /start)
    const cf = await getCloudflareSettings();
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = cf?.domain || req.headers.host || 'localhost:2003';
    const redirectUri = `${protocol}://${host}/api/oauth/codex/callback`;

    // Exchange code for tokens
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CODEX_CONFIG.clientId,
      code: String(code),
      redirect_uri: redirectUri,
      code_verifier: flow.codeVerifier,
    });

    const tokenResp = await fetch(CODEX_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenBody,
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      logger.error('Codex token exchange failed', { status: tokenResp.status, error: errText });
      return res.redirect(`/?oauth=error&message=${encodeURIComponent('Token exchange failed: ' + errText)}`);
    }

    const tokens = await tokenResp.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      id_token?: string;
    };

    // Extract accountId from JWT payload (if present)
    let accountId: string | undefined;
    try {
      const payloadB64 = tokens.access_token.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      accountId = payload?.['https://api.openai.com/auth']?.chatgpt_account_id;
    } catch { /* ignore JWT parse errors */ }

    // Calculate expiry timestamp (ms)
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Save to OpenClaw auth-profiles.json
    saveOAuthTokenToOpenClaw('openai-codex', {
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      expires: expiresAt,
      accountId,
    });

    // Set default model in openclaw.json
    setOpenClawDefaultModel('openai-codex', 'codex-mini');

    logger.info('Codex OAuth complete', { accountId, expiresAt: new Date(expiresAt).toISOString() });
    res.redirect('/?oauth=success&provider=codex');
  } catch (error) {
    logger.error('Codex OAuth callback error:', error);
    res.redirect(`/?oauth=error&message=${encodeURIComponent(String(error))}`);
  }
});

/**
 * POST /api/oauth/codex/refresh
 * Refresh an expired access token using the stored refresh token.
 */
router.post('/codex/refresh', async (_req, res) => {
  try {
    const existing = getOAuthTokenFromOpenClaw('openai-codex');
    if (!existing?.refresh) {
      return res.status(400).json({ error: 'No refresh token available. Please reconnect.' });
    }

    const tokenBody = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CODEX_CONFIG.clientId,
      refresh_token: existing.refresh,
    });

    const tokenResp = await fetch(CODEX_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenBody,
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      logger.error('Codex token refresh failed', { error: errText });
      return res.status(401).json({ error: 'Refresh failed. Please reconnect.', details: errText });
    }

    const tokens = await tokenResp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    saveOAuthTokenToOpenClaw('openai-codex', {
      access: tokens.access_token,
      refresh: tokens.refresh_token || existing.refresh,
      expires: expiresAt,
      accountId: existing.accountId,
    });

    logger.info('Codex token refreshed', { expiresAt: new Date(expiresAt).toISOString() });
    res.json({ success: true, expiresAt });
  } catch (error) {
    logger.error('Codex token refresh error:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/oauth/codex/status
 * Check if Codex OAuth is configured and token validity.
 */
router.get('/codex/status', (_req, res) => {
  try {
    const token = getOAuthTokenFromOpenClaw('openai-codex');
    if (!token) {
      return res.json({ connected: false });
    }

    const now = Date.now();
    const expired = token.expires < now;
    const expiresIn = Math.max(0, Math.floor((token.expires - now) / 1000));

    // Extract email from JWT if possible
    let email: string | undefined;
    try {
      const payloadB64 = token.access.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      email = payload?.['https://api.openai.com/profile']?.email;
    } catch { /* ignore */ }

    res.json({
      connected: true,
      expired,
      expiresIn,
      expiresAt: token.expires,
      accountId: token.accountId,
      email,
    });
  } catch (error) {
    logger.error('Codex status check error:', error);
    res.json({ connected: false, error: String(error) });
  }
});

export default router;
