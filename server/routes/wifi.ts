/**
 * WiFi Management Routes — /api/wifi
 * Uses nmcli to scan, connect, disconnect, and manage WiFi networks.
 */
import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const router = Router();
const execAsync = promisify(execFile);

// Helper: run nmcli with sudo
async function nmcli(...args: string[]): Promise<string> {
  try {
    const { stdout } = await execAsync('sudo', ['nmcli', ...args], {
      timeout: 15000,
      env: { ...process.env, LANG: 'C' },
    });
    return stdout;
  } catch (err: any) {
    throw new Error(err.stderr || err.message || 'nmcli command failed');
  }
}

interface WifiNetwork {
  inUse: boolean;
  bssid: string;
  ssid: string;
  mode: string;
  channel: number;
  rate: string;
  signal: number;
  security: string;
}

/**
 * GET /api/wifi/scan — Scan available WiFi networks
 */
router.get('/scan', async (_req, res) => {
  try {
    // Rescan first
    try { await nmcli('device', 'wifi', 'rescan'); } catch { /* ignore rescan errors */ }
    await new Promise(r => setTimeout(r, 1500));

    const output = await nmcli(
      '-t', '-f', 'IN-USE,BSSID,SSID,MODE,CHAN,RATE,SIGNAL,SECURITY',
      'device', 'wifi', 'list'
    );

    const networks: WifiNetwork[] = [];
    const seenSSIDs = new Set<string>();

    for (const line of output.trim().split('\n')) {
      if (!line.trim()) continue;
      // nmcli -t uses : as separator, but BSSID also has colons
      // Format: *:AA\:BB\:CC\:DD\:EE\:FF:SSID:Infra:6:130 Mbit/s:85:WPA2
      const parts = line.split(':');
      if (parts.length < 8) continue;

      const inUse = parts[0] === '*';
      // BSSID: next 6 parts joined with :  (they're escaped with \)
      const bssid = parts.slice(1, 7).join(':').replace(/\\\\/g, '');
      const remaining = parts.slice(7);
      // Last 4 are: MODE, CHAN, RATE, SIGNAL, SECURITY
      const security = remaining.pop() || '';
      const signal = parseInt(remaining.pop() || '0', 10);
      const rate = remaining.pop() || '';
      const channel = parseInt(remaining.pop() || '0', 10);
      const mode = remaining.pop() || '';
      const ssid = remaining.join(':');

      if (!ssid || ssid === '--') continue;
      // Deduplicate by SSID, keep strongest signal
      if (seenSSIDs.has(ssid)) continue;
      seenSSIDs.add(ssid);

      networks.push({ inUse, bssid, ssid, mode, channel, rate, signal, security });
    }

    // Sort: in-use first, then by signal strength
    networks.sort((a, b) => {
      if (a.inUse && !b.inUse) return -1;
      if (!a.inUse && b.inUse) return 1;
      return b.signal - a.signal;
    });

    res.json({ success: true, networks });
  } catch (error) {
    logger.error('WiFi scan error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/wifi/status — Current WiFi connection status + IP
 */
router.get('/status', async (_req, res) => {
  try {
    const output = await nmcli('-t', '-f', 'TYPE,NAME,DEVICE,STATE', 'connection', 'show', '--active');
    let connected = false;
    let ssid = '';
    let device = '';

    for (const line of output.trim().split('\n')) {
      const parts = line.split(':');
      if (parts[0] === '802-11-wireless' && parts[3]?.includes('activated')) {
        connected = true;
        ssid = parts[1];
        device = parts[2];
        break;
      }
    }

    let ip = '';
    if (connected && device) {
      try {
        const ipOut = await nmcli('-t', '-f', 'IP4.ADDRESS', 'device', 'show', device);
        const match = ipOut.match(/IP4\.ADDRESS\[1\]:(.+)/);
        if (match) ip = match[1].trim();
      } catch { /* ignore */ }
    }

    res.json({ success: true, connected, ssid, device, ip });
  } catch (error) {
    logger.error('WiFi status error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/wifi/connect — Connect to a WiFi network
 * Body: { ssid: string, password?: string }
 */
router.post('/connect', async (req, res) => {
  try {
    const { ssid, password } = req.body as { ssid?: string; password?: string };
    if (!ssid) return res.status(400).json({ success: false, error: 'SSID is required' });

    const args = ['device', 'wifi', 'connect', ssid];
    if (password) args.push('password', password);

    await nmcli(...args);
    logger.info('WiFi connected', { ssid });
    res.json({ success: true, ssid });
  } catch (error: any) {
    const msg = String(error?.message || error);
    logger.error('WiFi connect error:', error);

    if (msg.includes('Secrets were required')) {
      return res.status(401).json({ success: false, error: 'Mật khẩu WiFi không đúng' });
    }
    if (msg.includes('No network with SSID')) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy mạng WiFi' });
    }
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/wifi/disconnect — Disconnect current WiFi
 */
router.post('/disconnect', async (_req, res) => {
  try {
    // Find active wifi connection
    const output = await nmcli('-t', '-f', 'TYPE,NAME,DEVICE', 'connection', 'show', '--active');
    for (const line of output.trim().split('\n')) {
      const parts = line.split(':');
      if (parts[0] === '802-11-wireless') {
        await nmcli('connection', 'down', parts[1]);
        logger.info('WiFi disconnected', { ssid: parts[1] });
        return res.json({ success: true });
      }
    }
    res.json({ success: true, message: 'No active WiFi connection' });
  } catch (error) {
    logger.error('WiFi disconnect error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/wifi/saved — List saved WiFi connections
 */
router.get('/saved', async (_req, res) => {
  try {
    const output = await nmcli('-t', '-f', 'NAME,TYPE', 'connection', 'show');
    const saved: string[] = [];
    for (const line of output.trim().split('\n')) {
      const parts = line.split(':');
      if (parts[1] === '802-11-wireless') {
        saved.push(parts[0]);
      }
    }
    res.json({ success: true, saved });
  } catch (error) {
    logger.error('WiFi saved list error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * DELETE /api/wifi/saved/:ssid — Forget a saved WiFi network
 */
router.delete('/saved/:ssid', async (req, res) => {
  try {
    const ssid = decodeURIComponent(req.params.ssid);
    await nmcli('connection', 'delete', ssid);
    logger.info('WiFi connection forgotten', { ssid });
    res.json({ success: true });
  } catch (error) {
    logger.error('WiFi forget error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
