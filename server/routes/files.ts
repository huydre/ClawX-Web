import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import { logger } from '../utils/logger.js';
import os from 'os';
import crypto from 'crypto';

const VISION_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp', 'image/tiff',
]);

const router = Router();

// Configure multer for file uploads
const uploadDir = path.join(os.homedir(), '.clawx', 'uploads');
const stagedDir = path.join(os.homedir(), '.clawx', 'staged');

// Ensure directories exist
fs.mkdir(uploadDir, { recursive: true }).catch((err) => {
  logger.error('Failed to create upload directory', { error: err });
});
fs.mkdir(stagedDir, { recursive: true }).catch((err) => {
  logger.error('Failed to create staged directory', { error: err });
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

const stageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, stagedDir);
  },
  filename: (_req, file, cb) => {
    const id = crypto.randomUUID();
    cb(null, `${id}-${file.originalname}`);
  },
});

const stageUpload = multer({
  storage: stageStorage,
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

// POST /api/files/stage
// Stages a browser-uploaded file for chat attachment; returns metadata + image preview.
router.post('/stage', stageUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const id = crypto.randomUUID();
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const isImage = VISION_MIME_TYPES.has(mimeType);

    let preview: string | null = null;
    if (isImage) {
      try {
        const data = readFileSync(req.file.path);
        preview = `data:${mimeType};base64,${data.toString('base64')}`;
      } catch (err) {
        logger.warn('Failed to generate image preview', { error: err });
      }
    }

    logger.info('File staged', {
      originalname: req.file.originalname,
      mimeType,
      size: req.file.size,
      stagedPath: req.file.path,
    });

    res.json({
      id,
      fileName: req.file.originalname,
      mimeType,
      fileSize: req.file.size,
      stagedPath: req.file.path,
      preview,
    });
  } catch (error) {
    logger.error('File stage error:', error);
    res.status(500).json({ error: String(error) });
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
