import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';
import os from 'os';

const router = Router();

// Configure multer for file uploads
const uploadDir = path.join(os.homedir(), '.clawx', 'uploads');

// Ensure upload directory exists
fs.mkdir(uploadDir, { recursive: true }).catch((err) => {
  logger.error('Failed to create upload directory', { error: err });
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// POST /api/files/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logger.info('File uploaded', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
    });

    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    logger.error('File upload error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/files/:filename
router.get('/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    // Security: prevent path traversal
    if (!filePath.startsWith(uploadDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    await fs.access(filePath);

    res.sendFile(filePath);
  } catch (error) {
    logger.error('File download error:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

// DELETE /api/files/:filename
router.delete('/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    // Security: prevent path traversal
    if (!filePath.startsWith(uploadDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await fs.unlink(filePath);
    logger.info('File deleted', { filename });

    res.json({ success: true });
  } catch (error) {
    logger.error('File delete error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
