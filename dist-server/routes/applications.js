import { Router } from 'express';
import { getAllApplicationConnections, getApplicationConnection, saveApplicationConnection, deleteApplicationConnection, } from '../services/storage.js';
import { initiateConnection, getConnection, deleteConnection, isProxyConfigured, proxyStatus, } from '../services/composio.js';
import { logger } from '../utils/logger.js';
const router = Router();
// GET /api/applications/status — proxy reachability
router.get('/status', async (_req, res) => {
    const status = await proxyStatus();
    res.json({
        proxyConfigured: isProxyConfigured(),
        proxyReachable: status.reachable,
        composioConfigured: status.configured,
        mockMode: !isProxyConfigured(),
        error: status.error,
    });
});
// GET /api/applications/connections — list current connections
router.get('/connections', async (_req, res) => {
    try {
        const items = await getAllApplicationConnections();
        res.json({ items });
    }
    catch (err) {
        logger.error('list connections', err);
        res.status(500).json({ error: String(err) });
    }
});
// POST /api/applications/:slug/connect — start OAuth flow
router.post('/:slug/connect', async (req, res) => {
    const slug = req.params.slug;
    try {
        const callbackUrl = (req.body && req.body.callbackUrl) || undefined;
        const result = await initiateConnection({ appSlug: slug, callbackUrl });
        await saveApplicationConnection({
            slug,
            connectionId: result.connectionId,
            status: result.mock ? 'MOCK' : 'PENDING',
            scopes: [],
            connectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        res.json({
            redirectUrl: result.redirectUrl,
            connectionId: result.connectionId,
            mock: !!result.mock,
        });
    }
    catch (err) {
        logger.error('connect app', err);
        res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
    }
});
// POST /api/applications/:slug/finalize — mark connection active (called after OAuth completes)
router.post('/:slug/finalize', async (req, res) => {
    const slug = req.params.slug;
    try {
        const existing = await getApplicationConnection(slug);
        if (!existing)
            return res.status(404).json({ error: 'Connection not initialized' });
        // Mock mode: always mark active
        if (existing.status === 'MOCK') {
            await saveApplicationConnection({
                ...existing,
                status: 'ACTIVE',
                updatedAt: new Date().toISOString(),
            });
            return res.json({ status: 'ACTIVE' });
        }
        // Real: poll proxy to confirm ACTIVE
        const info = await getConnection(existing.connectionId);
        const status = info?.status || 'PENDING';
        await saveApplicationConnection({
            ...existing,
            status,
            updatedAt: new Date().toISOString(),
        });
        res.json({ status });
    }
    catch (err) {
        logger.error('finalize app', err);
        res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
    }
});
// DELETE /api/applications/:slug — disconnect
router.delete('/:slug', async (req, res) => {
    const slug = req.params.slug;
    try {
        const existing = await getApplicationConnection(slug);
        if (existing && existing.status !== 'MOCK') {
            try {
                await deleteConnection(existing.connectionId);
            }
            catch (err) {
                logger.warn('proxy delete failed, removing locally anyway', err);
            }
        }
        await deleteApplicationConnection(slug);
        res.json({ success: true });
    }
    catch (err) {
        logger.error('disconnect app', err);
        res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
    }
});
export default router;
