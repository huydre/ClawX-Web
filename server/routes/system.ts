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
function broadcast(payload: object) {
  if (!wss) return;
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
    } else {
      const metrics = await systemMonitor.collect();
      res.json(metrics);
    }
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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

  const send = (step: string, data: Record<string, unknown> = {}) => {
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

    // 2. pnpm install (prod only — devDeps like tsc not needed for pre-built)
    send('installing');
    await runStream('pnpm', ['install', '--prod', '--frozen-lockfile'], cwd, send)
      .catch(() => runStream('pnpm', ['install', '--prod'], cwd, send));

    // 3. Check if pre-built dist exists (committed to repo)
    const fs = await import('fs');
    const hasPrebuilt = fs.existsSync(`${cwd}/dist/index.html`) && fs.existsSync(`${cwd}/dist-server/index.js`);

    if (!hasPrebuilt) {
      // No pre-built dist — need full build
      send('installing_dev');
      await runStream('pnpm', ['install', '--frozen-lockfile'], cwd, send)
        .catch(() => runStream('pnpm', ['install'], cwd, send));

      send('building_server');
      await runStream('pnpm', ['build:server'], cwd, send);

      send('building_frontend');
      await runStream('pnpm', ['build'], cwd, send);
    } else {
      send('log', { line: 'Pre-built dist found, skipping build' });
    }

    // 4. Setup/Update Claw3D (clone if missing, update if exists)
    send('updating_claw3d');
    try {
      await runStream('bash', ['-c', `cd "${cwd}" && bash setup.sh --update-claw3d 2>&1 || true`], cwd, send);
      send('log', { line: 'Claw3D updated' });
    } catch {
      send('log', { line: 'Claw3D update skipped (non-critical)' });
    }
    // Restart claw3d service (sudoers rule allows this)
    try {
      execSync('sudo systemctl restart claw3d 2>/dev/null || true', { stdio: 'ignore' });
      send('log', { line: 'Claw3D service restarted' });
    } catch { /* ignore */ }

    send('restarting');

    // 5. Restart: exit with non-zero so systemd Restart=on-failure restarts us
    setTimeout(() => {
      process.exit(1);
    }, 1500);

    send('done');
  } catch (err) {
    logger.error('Update failed, rolling back', { error: String(err) });
    send('rollback', { error: String(err) });

    try {
      execSync(`git reset --hard ${saveSha}`, { cwd, stdio: 'ignore' });
      send('rollback_done');
    } catch (rollbackErr) {
      send('rollback_failed', { error: String(rollbackErr) });
    }
  }
});

/** Run a command and stream stdout/stderr lines to the broadcast */
function runStream(
  cmd: string,
  args: string[],
  cwd: string,
  send: (step: string, data?: Record<string, unknown>) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: false, env: { ...process.env, CI: 'true' } });

    child.stdout.on('data', (d: Buffer) => {
      send('log', { line: d.toString().trimEnd() });
    });
    child.stderr.on('data', (d: Buffer) => {
      send('log', { line: d.toString().trimEnd() });
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

export default router;
