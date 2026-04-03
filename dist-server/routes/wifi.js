/**
 * WiFi Status Route — /api/wifi
 * Read-only: shows current WiFi connection status via nmcli (no sudo).
 */
import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
const router = Router();
const execAsync = promisify(execFile);
async function nmcli(...args) {
    try {
        const { stdout } = await execAsync('nmcli', args, {
            timeout: 10000,
            env: { ...process.env, LANG: 'C' },
        });
        return stdout;
    }
    catch (err) {
        throw new Error(err.stderr || err.message || 'nmcli command failed');
    }
}
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
export default router;
