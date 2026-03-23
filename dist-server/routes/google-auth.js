/**
 * Google Workspace OAuth Routes — /api/google-auth
 * Proxy OAuth flow to the centralized Google OAuth server (api-googles.openclaw-box.com)
 * and inject the access token into the OpenClaw Gateway environment
 * for the GWS CLI skill.
 *
 * OAuth Server API (Duong-Anh-Duc/Skill):
 *   GET  /api/oauth/connect?userId=xxx  → redirects to Google consent
 *   GET  /api/oauth/callback            → exchanges code, saves tokens, redirects to APP_URL
 *   GET  /api/token/:userId             → { success, data: { access_token, expiry, refreshed } }
 *   DELETE /api/token/:userId           → revoke + delete
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
const router = Router();
// Centralized Google OAuth server
const GOOGLE_OAUTH_SERVER = process.env.GOOGLE_OAUTH_SERVER_URL || 'https://api-googles.openclaw-box.com';
// File to persist the Google userId across restarts
const STATE_FILE = path.join(os.homedir(), '.openclaw', '.google-auth-state.json');
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        }
    }
    catch { /* ignore */ }
    return null;
}
function saveState(state) {
    try {
        const dir = path.dirname(STATE_FILE);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    }
    catch (err) {
        logger.error('Failed to save Google auth state', { error: String(err) });
    }
}
function clearState() {
    try {
        if (fs.existsSync(STATE_FILE))
            fs.unlinkSync(STATE_FILE);
    }
    catch { /* ignore */ }
}
/**
 * Inject Google access token into gateway environment.
 * Writes both the legacy token JSON and GOG_ACCESS_TOKEN env file.
 */
async function injectTokenToGateway(accessToken) {
    const credDir = path.join(os.homedir(), '.openclaw');
    try {
        if (!fs.existsSync(credDir))
            fs.mkdirSync(credDir, { recursive: true });
        // Legacy token file
        const credFile = path.join(credDir, 'google-workspace-token.json');
        fs.writeFileSync(credFile, JSON.stringify({ token: accessToken, updatedAt: Date.now() }));
        fs.chmodSync(credFile, 0o600);
        // gogcli env file — sourced before gog commands
        const gogEnvFile = path.join(credDir, 'gog.env');
        fs.writeFileSync(gogEnvFile, `export GOG_ACCESS_TOKEN="${accessToken}"\n`);
        fs.chmodSync(gogEnvFile, 0o600);
        logger.info('Google access token written (token.json + gog.env)');
    }
    catch (err) {
        logger.error('Failed to write Google token files', { error: String(err) });
    }
}
// ── Auto-refresh timer ─────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes
let refreshTimer = null;
async function doTokenRefresh() {
    const state = loadState();
    if (!state)
        return;
    try {
        const tokenResp = await fetch(`${GOOGLE_OAUTH_SERVER}/api/token/${state.userId}`);
        if (!tokenResp.ok) {
            logger.warn('Auto-refresh: token expired or revoked');
            return;
        }
        const tokenData = await tokenResp.json();
        if (tokenData.success && tokenData.data) {
            await injectTokenToGateway(tokenData.data.access_token);
            logger.info('Auto-refresh: Google token refreshed successfully');
        }
    }
    catch (err) {
        logger.error('Auto-refresh failed', { error: String(err) });
    }
}
/** Start auto-refresh timer. Call on server boot. */
export function startAutoRefresh() {
    // Only start if user has already connected
    const state = loadState();
    if (!state) {
        logger.info('Google auto-refresh: no connection found, skipping');
        return;
    }
    if (refreshTimer)
        clearInterval(refreshTimer);
    // Do an immediate refresh on boot
    doTokenRefresh();
    refreshTimer = setInterval(doTokenRefresh, REFRESH_INTERVAL_MS);
    logger.info(`Google auto-refresh started (every ${REFRESH_INTERVAL_MS / 60000} min)`);
}
export function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}
// ── Routes ─────────────────────────────────────────────────────────────────
/**
 * GET /api/google-auth/start
 * Redirect user to the OAuth server's /api/oauth/connect endpoint.
 * The OAuth server will redirect to Google consent, then callback,
 * then redirect to our /api/google-auth/callback with userId.
 */
router.get('/start', async (req, res) => {
    try {
        // Generate a unique userId for this ClawX instance
        const state = loadState();
        const userId = state?.userId || `clawx-${crypto.randomBytes(8).toString('hex')}`;
        // Build the callback URL pointing back to this ClawX instance
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const redirectUrl = `${protocol}://${host}/api/google-auth/callback`;
        // The OAuth server's /api/oauth/connect?userId=xxx&redirectUrl=xxx redirects to Google
        const connectUrl = `${GOOGLE_OAUTH_SERVER}/api/oauth/connect?userId=${encodeURIComponent(userId)}&redirectUrl=${encodeURIComponent(redirectUrl)}`;
        // Save userId early so we can retrieve tokens after callback
        saveState({ userId, connectedAt: Date.now() });
        res.json({ authUrl: connectUrl });
    }
    catch (error) {
        logger.error('Google auth start error:', error);
        res.status(500).json({ error: String(error) });
    }
});
/**
 * GET /api/google-auth/callback
 * Called when user returns from OAuth flow.
 * The OAuth server redirects to APP_URL with ?status=connected&userId=xxx
 * We need APP_URL on the OAuth server to point here.
 *
 * But since we can't control APP_URL dynamically per-box, the frontend
 * handles the return by checking status via /api/google-auth/status.
 */
router.get('/callback', async (req, res) => {
    try {
        const { userId, error } = req.query;
        if (error) {
            return res.status(400).send(`
        <html><body style="font-family:system-ui;text-align:center;padding:60px;background:#0a0a0a;color:#fff">
          <h2>❌ Google Auth Failed</h2>
          <p style="color:#f87171">${String(error)}</p>
          <p style="color:#666">You can close this tab.</p>
          <script>setTimeout(()=>window.close(),3000)</script>
        </body></html>
      `);
        }
        if (userId) {
            // Fetch the access token from the OAuth server
            const tokenResp = await fetch(`${GOOGLE_OAUTH_SERVER}/api/token/${userId}`);
            if (tokenResp.ok) {
                const tokenData = await tokenResp.json();
                if (tokenData.success && tokenData.data) {
                    saveState({ userId: String(userId), connectedAt: Date.now() });
                    await injectTokenToGateway(tokenData.data.access_token);
                    logger.info('Google Workspace connected', { userId });
                }
            }
        }
        // Redirect back to ClawX Settings
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        res.send(`
      <html><body style="font-family:system-ui;text-align:center;padding:60px;background:#0a0a0a;color:#fff">
        <h2>✅ Google Workspace Connected!</h2>
        <p style="color:#aaa">Redirecting back to ClawX...</p>
        <script>
          setTimeout(function(){
            window.location.href = '${protocol}://${host}/#/settings?google=connected';
          }, 1500);
        </script>
      </body></html>
    `);
    }
    catch (error) {
        logger.error('Google auth callback error:', error);
        res.status(500).send(`
      <html><body style="font-family:system-ui;text-align:center;padding:60px">
        <h2>❌ Error</h2>
        <p>${String(error)}</p>
      </body></html>
    `);
    }
});
/**
 * GET /api/google-auth/status
 * Check if Google is connected and token is valid.
 */
router.get('/status', async (_req, res) => {
    try {
        const state = loadState();
        if (!state) {
            return res.json({ connected: false });
        }
        // Fetch fresh token from OAuth server (it auto-refreshes if expired)
        const tokenResp = await fetch(`${GOOGLE_OAUTH_SERVER}/api/token/${state.userId}`);
        if (!tokenResp.ok) {
            clearState();
            return res.json({ connected: false, error: 'Token expired or revoked' });
        }
        const tokenData = await tokenResp.json();
        if (!tokenData.success || !tokenData.data) {
            clearState();
            return res.json({ connected: false, error: 'Token not found' });
        }
        // Re-inject token (it may have been refreshed)
        await injectTokenToGateway(tokenData.data.access_token);
        const token = tokenData.data.access_token;
        const tokenPreview = token.substring(0, 20) + '••••••••';
        res.json({
            connected: true,
            userId: state.userId,
            email: state.email,
            connectedAt: state.connectedAt,
            accessToken: token,
            tokenPreview,
        });
    }
    catch (error) {
        logger.error('Google auth status error:', error);
        res.json({ connected: false, error: String(error) });
    }
});
/**
 * POST /api/google-auth/refresh
 * Force-refresh the token and re-inject into gateway.
 */
router.post('/refresh', async (_req, res) => {
    try {
        const state = loadState();
        if (!state) {
            return res.status(400).json({ error: 'Not connected. Please connect Google first.' });
        }
        const tokenResp = await fetch(`${GOOGLE_OAUTH_SERVER}/api/token/${state.userId}`);
        if (!tokenResp.ok) {
            clearState();
            return res.status(401).json({ error: 'Token expired or revoked. Please reconnect.' });
        }
        const tokenData = await tokenResp.json();
        if (!tokenData.success || !tokenData.data) {
            clearState();
            return res.status(401).json({ error: 'Token not found. Please reconnect.' });
        }
        await injectTokenToGateway(tokenData.data.access_token);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Google auth refresh error:', error);
        res.status(500).json({ error: String(error) });
    }
});
/**
 * DELETE /api/google-auth/disconnect
 * Remove Google connection.
 */
router.delete('/disconnect', async (_req, res) => {
    try {
        const state = loadState();
        if (state) {
            try {
                await fetch(`${GOOGLE_OAUTH_SERVER}/api/token/${state.userId}`, { method: 'DELETE' });
            }
            catch { /* ignore */ }
        }
        clearState();
        // Remove token file
        const credFile = path.join(os.homedir(), '.openclaw', 'google-workspace-token.json');
        try {
            if (fs.existsSync(credFile))
                fs.unlinkSync(credFile);
        }
        catch { /* ignore */ }
        logger.info('Google Workspace disconnected');
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Google auth disconnect error:', error);
        res.status(500).json({ error: String(error) });
    }
});
export default router;
