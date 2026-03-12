/**
 * OAuth Routes — /api/oauth
 * Handle OAuth flows for providers that use OAuth instead of API keys.
 * Currently supports: OpenAI Codex
 *
 * Uses a temporary HTTP server on port 1455 for the OAuth callback
 * (same as Codex CLI — this is the only redirect_uri whitelisted by OpenAI).
 */
import { Router } from 'express';
import http from 'http';
import crypto from 'crypto';
import { URL } from 'url';
import { logger } from '../utils/logger.js';
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
  callbackPort: 1455,
  // Must match exactly what's registered with OpenAI
  redirectUri: 'http://localhost:1455/auth/callback',
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

// Active OAuth flow state
let activeFlow: {
  state: string;
  codeVerifier: string;
  server: http.Server;
  resolve: (tokens: OAuthTokens) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
} | null = null;

interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token?: string;
}

/**
 * Start a temporary HTTP server on port 1455 to receive the OAuth callback.
 * Returns a promise that resolves with the tokens.
 */
function startCallbackServer(codeVerifier: string, state: string): Promise<OAuthTokens> {
  return new Promise((resolve, reject) => {
    // Clean up any previous flow
    if (activeFlow) {
      clearTimeout(activeFlow.timeout);
      try { activeFlow.server.close(); } catch { /* ignore */ }
      activeFlow = null;
    }

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${CODEX_CONFIG.callbackPort}`);

      if (url.pathname !== '/auth/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDesc = url.searchParams.get('error_description');

      if (error) {
        // Show error page
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family:system-ui;text-align:center;padding:60px">
            <h2>❌ OAuth Failed</h2>
            <p>${errorDesc || error}</p>
            <p style="color:#666">You can close this tab.</p>
          </body></html>
        `);
        cleanup();
        reject(new Error(errorDesc || error));
        return;
      }

      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family:system-ui;text-align:center;padding:60px">
            <h2>❌ Invalid callback</h2>
            <p>Missing code or state mismatch.</p>
          </body></html>
        `);
        cleanup();
        reject(new Error('Invalid callback: missing code or state mismatch'));
        return;
      }

      try {
        // Exchange code for tokens
        const tokenBody = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: CODEX_CONFIG.clientId,
          code,
          redirect_uri: CODEX_CONFIG.redirectUri,
          code_verifier: codeVerifier,
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
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html><body style="font-family:system-ui;text-align:center;padding:60px">
              <h2>❌ Token Exchange Failed</h2>
              <p>${errText}</p>
            </body></html>
          `);
          cleanup();
          reject(new Error('Token exchange failed: ' + errText));
          return;
        }

        const tokens = await tokenResp.json() as OAuthTokens;

        // Show success page
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family:system-ui;text-align:center;padding:60px">
            <h2>✅ OpenAI Connected!</h2>
            <p>Tokens saved successfully. You can close this tab.</p>
            <script>setTimeout(()=>window.close(),2000)</script>
          </body></html>
        `);

        cleanup();
        resolve(tokens);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family:system-ui;text-align:center;padding:60px">
            <h2>❌ Error</h2>
            <p>${String(err)}</p>
          </body></html>
        `);
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('OAuth timeout (5 minutes)'));
    }, 5 * 60 * 1000);

    function cleanup() {
      if (activeFlow?.timeout) clearTimeout(activeFlow.timeout);
      try { server.close(); } catch { /* ignore */ }
      activeFlow = null;
    }

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${CODEX_CONFIG.callbackPort} is already in use. Close any running Codex CLI first.`));
      } else {
        reject(err);
      }
    });

    server.listen(CODEX_CONFIG.callbackPort, '127.0.0.1', () => {
      activeFlow = { state, codeVerifier, server, resolve, reject, timeout };
      logger.info(`OAuth callback server started on port ${CODEX_CONFIG.callbackPort}`);
    });
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/oauth/codex/start
 * Generate PKCE + auth URL + start temp callback server.
 * Frontend opens the returned auth URL in a new tab.
 */
router.get('/codex/start', async (_req, res) => {
  try {
    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Build auth URL manually (encode spaces as %20, not +)
    const params: Record<string, string> = {
      response_type: 'code',
      client_id: CODEX_CONFIG.clientId,
      redirect_uri: CODEX_CONFIG.redirectUri,
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

    // Start callback server and handle token exchange in background
    startCallbackServer(codeVerifier, state)
      .then(async (tokens) => {
        // Extract accountId from JWT payload
        let accountId: string | undefined;
        try {
          const payloadB64 = tokens.access_token.split('.')[1];
          const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
          accountId = payload?.['https://api.openai.com/auth']?.chatgpt_account_id;
        } catch { /* ignore */ }

        const expiresAt = Date.now() + (tokens.expires_in * 1000);

        // Save to OpenClaw auth-profiles.json
        saveOAuthTokenToOpenClaw('openai-codex', {
          access: tokens.access_token,
          refresh: tokens.refresh_token,
          expires: expiresAt,
          accountId,
        });

        // Set default model
        setOpenClawDefaultModel('openai-codex', 'codex-mini-latest');

        logger.info('Codex OAuth complete', { accountId, expiresAt: new Date(expiresAt).toISOString() });
      })
      .catch((err) => {
        logger.error('Codex OAuth flow failed', { error: String(err) });
      });

    logger.info('Codex OAuth started', { redirectUri: CODEX_CONFIG.redirectUri, state });
    res.json({ authUrl, state });
  } catch (error) {
    logger.error('Codex OAuth start error:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/oauth/codex/exchange
 * Accept a callback URL pasted by the user (for remote tunnel access
 * where localhost:1455 can't reach the browser).
 * Body: { callbackUrl: "http://localhost:1455/auth/callback?code=...&state=..." }
 */
router.post('/codex/exchange', async (req, res) => {
  try {
    const { callbackUrl } = req.body as { callbackUrl?: string };
    if (!callbackUrl) {
      return res.status(400).json({ error: 'Missing callbackUrl' });
    }

    // Parse the callback URL to extract code and state
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      return res.status(400).json({ error: 'No code found in callback URL' });
    }
    if (!state) {
      return res.status(400).json({ error: 'No state found in callback URL' });
    }

    // Find active flow matching this state
    if (!activeFlow || activeFlow.state !== state) {
      return res.status(400).json({ error: 'No matching OAuth flow found. Start a new flow first.' });
    }

    const codeVerifier = activeFlow.codeVerifier;

    // Clean up the active flow
    clearTimeout(activeFlow.timeout);
    try { activeFlow.server.close(); } catch { /* ignore */ }
    activeFlow = null;

    // Exchange code for tokens
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CODEX_CONFIG.clientId,
      code,
      redirect_uri: CODEX_CONFIG.redirectUri,
      code_verifier: codeVerifier,
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
      logger.error('Codex token exchange failed (manual)', { error: errText });
      return res.status(400).json({ error: 'Token exchange failed: ' + errText });
    }

    const tokens = await tokenResp.json() as OAuthTokens;

    // Extract accountId from JWT payload
    let accountId: string | undefined;
    try {
      const payloadB64 = tokens.access_token.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      accountId = payload?.['https://api.openai.com/auth']?.chatgpt_account_id;
    } catch { /* ignore */ }

    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Save to OpenClaw auth-profiles.json
    saveOAuthTokenToOpenClaw('openai-codex', {
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      expires: expiresAt,
      accountId,
    });

    // Set default model
    setOpenClawDefaultModel('openai-codex', 'codex-mini-latest');

    logger.info('Codex OAuth complete (manual exchange)', { accountId, expiresAt: new Date(expiresAt).toISOString() });
    res.json({ success: true, accountId, expiresAt });
  } catch (error) {
    logger.error('Codex manual exchange error:', error);
    res.status(500).json({ error: String(error) });
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
