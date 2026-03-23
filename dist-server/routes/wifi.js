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
async function nmcli(...args) {
    try {
        const { stdout } = await execAsync('sudo', ['nmcli', ...args], {
            timeout: 15000,
            env: { ...process.env, LANG: 'C' },
        });
        return stdout;
    }
    catch (err) {
        throw new Error(err.stderr || err.message || 'nmcli command failed');
    }
}
// nmcli -t escapes colons in values as \: — this splits correctly
function splitTerse(line) {
    const parts = [];
    let cur = '';
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\' && i + 1 < line.length && line[i + 1] === ':') {
            cur += ':';
            i++;
        }
        else if (line[i] === ':') {
            parts.push(cur);
            cur = '';
        }
        else {
            cur += line[i];
        }
    }
    parts.push(cur);
    return parts;
}
/**
 * GET /api/wifi/scan — Scan available WiFi networks
 */
router.get('/scan', async (_req, res) => {
    try {
        // Rescan first
        try {
            await nmcli('device', 'wifi', 'rescan');
        }
        catch { /* ignore rescan errors */ }
        await new Promise(r => setTimeout(r, 2000));
        const output = await nmcli('-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list');
        const networks = [];
        const seenSSIDs = new Set();
        for (const line of output.trim().split('\n')) {
            if (!line.trim())
                continue;
            const parts = splitTerse(line);
            // Fields: IN-USE, SSID, SIGNAL, SECURITY
            if (parts.length < 4)
                continue;
            const inUse = parts[0] === '*';
            const ssid = parts[1];
            const signal = parseInt(parts[2], 10) || 0;
            const security = parts[3];
            if (!ssid || ssid === '--')
                continue;
            if (seenSSIDs.has(ssid))
                continue;
            seenSSIDs.add(ssid);
            networks.push({
                inUse, bssid: '', ssid, mode: '', channel: 0, rate: '',
                signal, security,
            });
        }
        // Sort: in-use first, then by signal strength
        networks.sort((a, b) => {
            if (a.inUse && !b.inUse)
                return -1;
            if (!a.inUse && b.inUse)
                return 1;
            return b.signal - a.signal;
        });
        res.json({ success: true, networks });
    }
    catch (error) {
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
                if (match)
                    ip = match[1].trim();
            }
            catch { /* ignore */ }
        }
        res.json({ success: true, connected, ssid, device, ip });
    }
    catch (error) {
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
        const { ssid, password } = req.body;
        if (!ssid)
            return res.status(400).json({ success: false, error: 'SSID is required' });
        const args = ['device', 'wifi', 'connect', ssid];
        if (password)
            args.push('password', password);
        await nmcli(...args);
        logger.info('WiFi connected', { ssid });
        res.json({ success: true, ssid });
    }
    catch (error) {
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
    }
    catch (error) {
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
        const saved = [];
        for (const line of output.trim().split('\n')) {
            const parts = line.split(':');
            if (parts[1] === '802-11-wireless') {
                saved.push(parts[0]);
            }
        }
        res.json({ success: true, saved });
    }
    catch (error) {
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
    }
    catch (error) {
        logger.error('WiFi forget error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
export default router;
