/**
 * System Routes — /api/system
 * Version info and update management for ClawX-Web (web/VPS deployment).
 */
import { Router } from 'express';
import { spawn, execSync } from 'child_process';
import { logger } from '../utils/logger.js';
import { updateChecker } from '../services/update-checker.js';
import { wss } from '../websocket/server.js';
import { WebSocket } from 'ws';
const router = Router();
// Broadcast a message to all connected WebSocket clients
function broadcast(payload) {
    if (!wss)
        return;
    const msg = JSON.stringify(payload);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}
// GET /api/system/info
// Returns local + remote version info, whether update is available
router.get('/info', async (_req, res) => {
    try {
        let info = updateChecker.getCached();
        if (!info) {
            // First request — do a quick check
            info = await updateChecker.check();
        }
        res.json(info);
    }
    catch (err) {
        logger.error('Failed to get system info', { error: String(err) });
        res.status(500).json({ error: 'Failed to get version info' });
    }
});
// POST /api/system/check-update
// Triggers an immediate version check
router.post('/check-update', async (_req, res) => {
    try {
        const info = await updateChecker.check();
        res.json(info);
    }
    catch (err) {
        logger.error('Check update failed', { error: String(err) });
        res.status(500).json({ error: 'Failed to check for updates' });
    }
});
// POST /api/system/update
// Starts the update process (git pull → build → restart)
// Progress is streamed to all WebSocket clients as system.update.progress messages
router.post('/update', async (_req, res) => {
    res.json({ ok: true, message: 'Update started — watch for progress via WebSocket' });
    logger.info('Starting system update...');
    const send = (step, data = {}) => {
        broadcast({ type: 'system.update.progress', step, ...data });
        logger.info(`[update] ${step}`, data);
    };
    const cwd = process.cwd();
    const saveSha = updateChecker.getLocalSha();
    try {
        send('started', { sha: saveSha });
        // 1. git pull
        send('pulling');
        await runStream('git', ['pull', 'origin', 'main'], cwd, send);
        // 2. pnpm install
        send('installing');
        await runStream('pnpm', ['install', '--frozen-lockfile'], cwd, send);
        // 3. Build server
        send('building_server');
        await runStream('pnpm', ['build:server'], cwd, send);
        // 4. Build frontend
        send('building_frontend');
        await runStream('pnpm', ['build'], cwd, send);
        send('restarting');
        // 5. Restart: try systemctl, fall back to process.exit
        setTimeout(() => {
            try {
                execSync('sudo systemctl restart clawx', { stdio: 'ignore' });
            }
            catch {
                // Not in systemd — just exit and let process manager restart
                process.exit(0);
            }
        }, 1500);
        send('done');
    }
    catch (err) {
        logger.error('Update failed, rolling back', { error: String(err) });
        send('rollback', { error: String(err) });
        try {
            execSync(`git reset --hard ${saveSha}`, { cwd, stdio: 'ignore' });
            await runStream('pnpm', ['build:server'], cwd, send).catch(() => { });
            send('rollback_done');
        }
        catch (rollbackErr) {
            send('rollback_failed', { error: String(rollbackErr) });
        }
    }
});
/** Run a command and stream stdout/stderr lines to the broadcast */
function runStream(cmd, args, cwd, send) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { cwd, shell: false });
        child.stdout.on('data', (d) => {
            send('log', { line: d.toString().trimEnd() });
        });
        child.stderr.on('data', (d) => {
            send('log', { line: d.toString().trimEnd() });
        });
        child.on('close', (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`${cmd} exited with code ${code}`));
        });
        child.on('error', reject);
    });
}
export default router;
