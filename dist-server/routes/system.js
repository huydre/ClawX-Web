/**
 * System Routes — /api/system
 * Version info and update management for ClawX-Web (web/VPS deployment).
 */
import { Router } from 'express';
import { spawn, execSync } from 'child_process';
import { logger } from '../utils/logger.js';
import { updateChecker } from '../services/update-checker.js';
import { systemMonitor } from '../services/system-monitor.js';
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
// GET /api/system/metrics
// Returns current system metrics (CPU, RAM, disk, network, temp, containers)
router.get('/metrics', async (_req, res) => {
    try {
        const cached = systemMonitor.getCached();
        if (cached) {
            res.json(cached);
        }
        else {
            const metrics = await systemMonitor.collect();
            res.json(metrics);
        }
    }
    catch (err) {
        logger.error('Failed to get system metrics', { error: String(err) });
        res.status(500).json({ error: 'Failed to collect system metrics' });
    }
});
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
// POST /api/system/force-sync
// Emergency sync: fetch + reset --hard + restart. Bypasses git pull issues.
router.post('/force-sync', async (_req, res) => {
    res.json({ ok: true, message: 'Force sync started' });
    try {
        const cwd = process.cwd();
        execSync('git fetch origin main', { cwd, stdio: 'ignore' });
        execSync('git reset --hard origin/main', { cwd, stdio: 'ignore' });
        execSync('pnpm install --prod --frozen-lockfile --ignore-scripts 2>/dev/null || pnpm install --prod --ignore-scripts', { cwd, stdio: 'ignore', shell: '/bin/bash' });
        logger.info('Force sync complete, restarting...');
        setTimeout(() => process.exit(1), 1000);
    }
    catch (err) {
        logger.error('Force sync failed', { error: String(err) });
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
        await runStream('git', ['pull', '--rebase=false', 'origin', 'main'], cwd, send);
        // 2. pnpm install (full install to ensure all deps present)
        send('installing');
        await runStream('pnpm', ['install', '--frozen-lockfile'], cwd, send)
            .catch(() => runStream('pnpm', ['install'], cwd, send));
        // 3. Check if pre-built dist exists (committed to repo)
        const fs = await import('fs');
        const hasPrebuilt = fs.existsSync(`${cwd}/dist/index.html`) && fs.existsSync(`${cwd}/dist-server/index.js`);
        if (!hasPrebuilt) {
            // No pre-built dist — need full build
            send('building_server');
            await runStream('pnpm', ['build:server'], cwd, send);
            send('building_frontend');
            await runStream('pnpm', ['build'], cwd, send);
        }
        else {
            send('log', { line: 'Pre-built dist found, skipping build' });
        }
        // 4. Setup/ensure 9Router is running
        send('checking_9router');
        try {
            const { homedir } = await import('os');
            const routerScript = `
        export HOME="${homedir()}"
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

        # Find npm (try NVM, then system paths)
        NPM_BIN=""
        if command -v npm &>/dev/null; then
          NPM_BIN="npm"
        elif [ -f "$NVM_DIR/versions/node/$(ls $NVM_DIR/versions/node/ 2>/dev/null | tail -1)/bin/npm" ]; then
          NPM_BIN="$NVM_DIR/versions/node/$(ls $NVM_DIR/versions/node/ | tail -1)/bin/npm"
          export PATH="$(dirname $NPM_BIN):$PATH"
        fi

        if [ -z "$NPM_BIN" ]; then
          echo "ERROR: npm not found"
          exit 1
        fi

        echo "Using npm: $(which npm || echo $NPM_BIN)"

        # Install 9router globally if not installed
        if ! command -v 9router &>/dev/null; then
          echo "Installing 9router globally..."
          $NPM_BIN i -g 9router
        else
          echo "9router already installed: $(which 9router)"
        fi

        # Install PM2 if needed
        if ! command -v pm2 &>/dev/null; then
          echo "Installing PM2..."
          $NPM_BIN i -g pm2
        fi

        # Check if 9router running in PM2
        if pm2 describe 9router &>/dev/null 2>&1; then
          echo "9Router already in PM2, restarting..."
          pm2 restart 9router
        else
          echo "Starting 9Router via PM2..."
          pm2 start 9router --name 9router
          pm2 save 2>/dev/null || true
        fi

        echo "9Router setup complete"
      `;
            await runStream('bash', ['-c', routerScript], cwd, send)
                .catch(() => send('log', { line: '9Router setup had errors (may still work)' }));
            send('log', { line: '9Router checked/started' });
        }
        catch {
            send('log', { line: '9Router setup skipped (non-critical)' });
        }
        // 5. Verify dist-server exists before restarting (prevent boot loop)
        const fs2 = await import('fs');
        if (!fs2.existsSync(`${cwd}/dist-server/index.js`)) {
            send('error', { error: 'dist-server/index.js missing after update — aborting restart' });
            return;
        }
        send('restarting');
        // 6. Restart: exit with non-zero so systemd Restart=on-failure restarts us
        setTimeout(() => {
            process.exit(1);
        }, 1500);
        send('done');
    }
    catch (err) {
        logger.error('Update failed', { error: String(err) });
        send('error', { error: String(err) });
        // No rollback — git reset creates divergent branches on next pull
    }
});
/** Run a command and stream stdout/stderr lines to the broadcast */
function runStream(cmd, args, cwd, send) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { cwd, shell: false, env: { ...process.env, CI: 'true' } });
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
