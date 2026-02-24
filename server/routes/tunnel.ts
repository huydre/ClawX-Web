import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { tunnelManager } from '../services/tunnel-manager.js';
import { CloudflareAPI } from '../lib/cloudflare-api.js';
import {
  getCloudflareSettings,
  saveCloudflareSettings,
  clearCloudflareSettings,
} from '../services/storage.js';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const quickStartSchema = z.object({
  localUrl: z.string().url().optional(),
});

const setupSchema = z.object({
  apiToken: z.string().min(40),
  tunnelName: z.string().min(3).max(50),
  domain: z.string().optional(),
});

const autoSetupSchema = z.object({
  apiToken: z.string().min(40),
  baseDomain: z.string().default('veoforge.ggff.net'),
  localUrl: z.string().url().optional(),
});

const validateTokenSchema = z.object({
  apiToken: z.string().min(40),
});

// ============================================================================
// Quick Tunnel Routes (No Auth Required)
// ============================================================================

// POST /api/tunnel/quick/start
router.post('/quick/start', async (req, res) => {
  try {
    const { localUrl } = quickStartSchema.parse(req.body);

    logger.info('Starting quick tunnel', { localUrl });

    // Check if tunnel is already running
    if (tunnelManager.isConnected()) {
      const status = tunnelManager.getStatus();
      return res.json({
        success: true,
        publicUrl: status.publicUrl,
        message: 'Tunnel already running',
      });
    }

    // Start quick tunnel
    await tunnelManager.start({
      mode: 'quick',
      localUrl: localUrl || 'http://localhost:2003',
    });

    // Wait for public URL (with timeout)
    const publicUrl = await waitForPublicUrl(10000);

    res.json({
      success: true,
      publicUrl,
    });
  } catch (error) {
    logger.error('Quick tunnel start error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// POST /api/tunnel/quick/stop
router.post('/quick/stop', async (_req, res) => {
  try {
    logger.info('Stopping quick tunnel');

    await tunnelManager.stop();

    res.json({ success: true });
  } catch (error) {
    logger.error('Quick tunnel stop error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// ============================================================================
// Named Tunnel Routes (Requires Cloudflare API)
// ============================================================================

// POST /api/tunnel/auto-setup - Auto setup with random subdomain
router.post('/auto-setup', async (req, res) => {
  try {
    const { apiToken, baseDomain, localUrl } = autoSetupSchema.parse(req.body);

    logger.info('Auto-setting up tunnel with random subdomain', { baseDomain });

    // Generate random subdomain (8 characters)
    const randomSubdomain = Math.random().toString(36).substring(2, 10);
    const fullDomain = `${randomSubdomain}.${baseDomain}`;
    const tunnelName = `clawx-${randomSubdomain}`;

    logger.info('Generated random subdomain', { fullDomain, tunnelName });

    // Initialize Cloudflare API
    const cfApi = new CloudflareAPI(apiToken);

    // Validate token
    const isValid = await cfApi.validateToken();
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Cloudflare API token',
      });
    }

    // Get account ID
    const accountId = await cfApi.getAccountId();

    // Create tunnel
    const tunnel = await cfApi.createTunnel(accountId, tunnelName);

    // Get tunnel token
    const tunnelToken = await cfApi.getTunnelToken(accountId, tunnel.id);

    // Extract root domain for DNS
    const parts = baseDomain.split('.');
    const rootDomain = parts.slice(-2).join('.');
    const baseSubdomain = parts.slice(0, -2).join('.');
    const finalSubdomain = baseSubdomain ? `${randomSubdomain}.${baseSubdomain}` : randomSubdomain;

    // Create DNS record
    const zoneId = await cfApi.getZoneId(rootDomain);
    await cfApi.createDnsRecord(zoneId, finalSubdomain, tunnel.id);

    const publicUrl = `https://${fullDomain}`;

    // Save configuration
    await saveCloudflareSettings({
      tunnelEnabled: true,
      tunnelMode: 'named',
      tunnelId: tunnel.id,
      tunnelName: tunnel.name,
      tunnelToken,
      accountId,
      domain: fullDomain,
      publicUrl,
    });

    logger.info('Auto tunnel setup complete', {
      tunnelId: tunnel.id,
      tunnelName: tunnel.name,
      publicUrl,
    });

    // Start tunnel immediately
    await tunnelManager.start({
      mode: 'named',
      token: tunnelToken,
      localUrl: localUrl || 'http://localhost:2003',
    });

    res.json({
      success: true,
      tunnelId: tunnel.id,
      publicUrl,
      subdomain: randomSubdomain,
    });
  } catch (error) {
    logger.error('Auto tunnel setup error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// POST /api/tunnel/setup
router.post('/setup', async (req, res) => {
  try {
    const { apiToken, tunnelName, domain } = setupSchema.parse(req.body);

    logger.info('Setting up named tunnel', { tunnelName, domain });

    // Initialize Cloudflare API
    const cfApi = new CloudflareAPI(apiToken);

    // Validate token
    const isValid = await cfApi.validateToken();
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Cloudflare API token',
      });
    }

    // Get account ID
    const accountId = await cfApi.getAccountId();

    // Create tunnel
    const tunnel = await cfApi.createTunnel(accountId, tunnelName);

    // Get tunnel token
    const tunnelToken = await cfApi.getTunnelToken(accountId, tunnel.id);

    // Save configuration
    await saveCloudflareSettings({
      enabled: true,
      tunnelId: tunnel.id,
      tunnelName: tunnel.name,
      tunnelToken,
      accountId,
      domain,
    });

    logger.info('Named tunnel setup complete', {
      tunnelId: tunnel.id,
      tunnelName: tunnel.name,
    });

    // Optionally set up DNS if domain is provided
    let publicUrl: string | undefined;
    if (domain) {
      try {
        // Extract root domain and subdomain
        const parts = domain.split('.');
        if (parts.length >= 2) {
          const rootDomain = parts.slice(-2).join('.');
          const subdomain = parts.slice(0, -2).join('.') || '@';

          const zoneId = await cfApi.getZoneId(rootDomain);
          await cfApi.createDnsRecord(zoneId, subdomain, tunnel.id);

          publicUrl = `https://${domain}`;
          logger.info('DNS record created', { domain, publicUrl });
        }
      } catch (dnsError) {
        logger.warn('Failed to create DNS record', {
          domain,
          error: (dnsError as Error).message,
        });
        // Don't fail the setup if DNS creation fails
      }
    }

    res.json({
      success: true,
      tunnelId: tunnel.id,
      publicUrl,
    });
  } catch (error) {
    logger.error('Tunnel setup error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// POST /api/tunnel/start
router.post('/start', async (_req, res) => {
  try {
    logger.info('Starting named tunnel');

    // Get configuration from storage
    const config = await getCloudflareSettings();

    if (!config.enabled || !config.tunnelToken) {
      return res.status(400).json({
        success: false,
        error: 'Tunnel not configured. Please run setup first.',
      });
    }

    // Check if tunnel is already running
    if (tunnelManager.isConnected()) {
      const status = tunnelManager.getStatus();
      return res.json({
        success: true,
        publicUrl: status.publicUrl || config.domain,
        message: 'Tunnel already running',
      });
    }

    // Start named tunnel
    await tunnelManager.start({
      mode: 'named',
      token: config.tunnelToken,
      localUrl: 'http://localhost:2003',
    });

    // Wait for connection
    await waitForConnection(10000);

    const publicUrl = config.domain ? `https://${config.domain}` : undefined;

    res.json({
      success: true,
      publicUrl,
    });
  } catch (error) {
    logger.error('Named tunnel start error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// POST /api/tunnel/stop
router.post('/stop', async (_req, res) => {
  try {
    logger.info('Stopping named tunnel');

    await tunnelManager.stop();

    res.json({ success: true });
  } catch (error) {
    logger.error('Named tunnel stop error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// DELETE /api/tunnel/teardown
router.delete('/teardown', async (_req, res) => {
  try {
    logger.info('Tearing down tunnel');

    // Stop tunnel if running
    if (tunnelManager.isConnected()) {
      await tunnelManager.stop();
    }

    // Get configuration
    const config = await getCloudflareSettings();

    // Delete tunnel from Cloudflare if configured
    if (config.tunnelId && config.accountId) {
      try {
        // We need the API token to delete the tunnel
        // Since we don't store it, we'll just clear local config
        logger.warn('Cannot delete tunnel from Cloudflare without API token');
      } catch (error) {
        logger.warn('Failed to delete tunnel from Cloudflare', {
          error: (error as Error).message,
        });
      }
    }

    // Clear local configuration
    await clearCloudflareSettings();

    logger.info('Tunnel teardown complete');

    res.json({ success: true });
  } catch (error) {
    logger.error('Tunnel teardown error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// ============================================================================
// Status & Validation Routes
// ============================================================================

// GET /api/tunnel/status
router.get('/status', async (_req, res) => {
  try {
    const status = tunnelManager.getStatus();
    const config = await getCloudflareSettings();

    res.json({
      configured: config.enabled && (!!config.tunnelId || status.mode === 'quick'),
      enabled: config.enabled,
      running: tunnelManager.isConnected(),
      mode: status.mode,
      publicUrl: status.publicUrl || (config.domain ? `https://${config.domain}` : undefined),
      uptime: status.uptime,
      state: status.state,
    });
  } catch (error) {
    logger.error('Get tunnel status error:', error);
    res.status(500).json({
      error: String(error),
    });
  }
});

// POST /api/tunnel/validate-token
router.post('/validate-token', async (req, res) => {
  try {
    const { apiToken } = validateTokenSchema.parse(req.body);

    logger.info('Validating Cloudflare API token');

    const cfApi = new CloudflareAPI(apiToken);
    const isValid = await cfApi.validateToken();

    if (!isValid) {
      return res.json({
        valid: false,
      });
    }

    // Get account ID if valid
    const accountId = await cfApi.getAccountId();

    res.json({
      valid: true,
      accountId,
    });
  } catch (error) {
    logger.error('Token validation error:', error);
    res.status(500).json({
      valid: false,
      error: String(error),
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wait for public URL to be available
 */
function waitForPublicUrl(timeoutMs: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkUrl = () => {
      const status = tunnelManager.getStatus();

      if (status.publicUrl) {
        resolve(status.publicUrl);
        return;
      }

      if (Date.now() - startTime >= timeoutMs) {
        logger.warn('Timeout waiting for public URL');
        resolve(undefined);
        return;
      }

      setTimeout(checkUrl, 500);
    };

    // Listen for URL detection event
    const onUrlDetected = (url: string) => {
      tunnelManager.off('urlDetected', onUrlDetected);
      resolve(url);
    };

    tunnelManager.once('urlDetected', onUrlDetected);

    // Start checking
    checkUrl();
  });
}

/**
 * Wait for tunnel connection
 */
function waitForConnection(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkConnection = () => {
      if (tunnelManager.isConnected()) {
        resolve();
        return;
      }

      const status = tunnelManager.getStatus();
      if (status.state === 'error') {
        reject(new Error(status.error || 'Tunnel connection failed'));
        return;
      }

      if (Date.now() - startTime >= timeoutMs) {
        reject(new Error('Timeout waiting for tunnel connection'));
        return;
      }

      setTimeout(checkConnection, 500);
    };

    // Listen for connection event
    const onConnected = () => {
      tunnelManager.off('connected', onConnected);
      resolve();
    };

    const onError = (error: Error) => {
      tunnelManager.off('error', onError);
      reject(error);
    };

    tunnelManager.once('connected', onConnected);
    tunnelManager.once('error', onError);

    // Start checking
    checkConnection();
  });
}

export default router;
