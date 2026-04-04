/**
 * USB Routes — /api/usb
 * List USB devices, browse files, read content, copy to workspace, eject.
 */
import { Router } from 'express';
import { usbMonitor } from '../services/usb-monitor.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/usb/devices — list connected USB devices
 */
router.get('/devices', (_req, res) => {
  try {
    const devices = usbMonitor.getDevices();
    res.json({ devices });
  } catch (err) {
    logger.error('USB route: failed to list devices', { error: err });
    res.status(500).json({ error: 'Failed to list USB devices' });
  }
});

/**
 * GET /api/usb/files/:deviceId — list files on a USB device
 * Query: ?path=subdir/path for subdirectory listing
 */
router.get('/files/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const subPath = (req.query.path as string) || undefined;
    const files = usbMonitor.getFiles(deviceId, subPath);
    res.json({ files });
  } catch (err) {
    logger.error('USB route: failed to list files', { error: err });
    res.status(500).json({ error: 'Failed to list files' });
  }
});

/**
 * GET /api/usb/file/:deviceId?path=... — read file content (text preview, max 100KB)
 */
router.get('/file/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const filePath = (req.query.path as string) || '';

    if (!filePath) {
      return res.status(400).json({ error: 'File path required (use ?path=)' });
    }

    const result = usbMonitor.readFile(deviceId, filePath);
    if (!result) {
      return res.status(404).json({ error: 'File not found or not readable' });
    }

    res.json({ content: result.content, truncated: result.truncated });
  } catch (err) {
    logger.error('USB route: failed to read file', { error: err });
    res.status(500).json({ error: 'Failed to read file' });
  }
});

/**
 * POST /api/usb/copy — copy files from USB to agent workspace
 * Body: { deviceId: string, files: string[], agentWorkspace: string }
 */
router.post('/copy', async (req, res) => {
  try {
    const { deviceId, files, agentWorkspace } = req.body;

    if (!deviceId || !Array.isArray(files) || !agentWorkspace) {
      return res.status(400).json({ error: 'deviceId, files[], and agentWorkspace are required' });
    }

    const result = await usbMonitor.copyToWorkspace(deviceId, files, agentWorkspace);
    res.json(result);
  } catch (err) {
    logger.error('USB route: copy failed', { error: err });
    res.status(500).json({ error: 'Failed to copy files' });
  }
});

/**
 * POST /api/usb/eject/:deviceId — safely eject a USB device
 */
router.post('/eject/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const success = await usbMonitor.eject(deviceId);

    if (success) {
      res.json({ success: true, message: `Device ${deviceId} ejected` });
    } else {
      res.status(400).json({ success: false, error: 'Eject failed — device may not exist' });
    }
  } catch (err) {
    logger.error('USB route: eject failed', { error: err });
    res.status(500).json({ error: 'Failed to eject device' });
  }
});

export default router;
