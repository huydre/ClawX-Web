"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const logger_1 = require("../utils/logger");
const os_1 = __importDefault(require("os"));
const router = (0, express_1.Router)();
// Configure multer for file uploads
const uploadDir = path_1.default.join(os_1.default.homedir(), '.clawx', 'uploads');
// Ensure upload directory exists
promises_1.default.mkdir(uploadDir, { recursive: true }).catch((err) => {
    logger_1.logger.error('Failed to create upload directory', { error: err });
});
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
});
const upload = (0, multer_1.default)({
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
        logger_1.logger.info('File uploaded', {
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
    }
    catch (error) {
        logger_1.logger.error('File upload error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
// GET /api/files/:filename
router.get('/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path_1.default.join(uploadDir, filename);
        // Security: prevent path traversal
        if (!filePath.startsWith(uploadDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        // Check if file exists
        await promises_1.default.access(filePath);
        res.sendFile(filePath);
    }
    catch (error) {
        logger_1.logger.error('File download error:', error);
        res.status(404).json({ error: 'File not found' });
    }
});
// DELETE /api/files/:filename
router.delete('/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path_1.default.join(uploadDir, filename);
        // Security: prevent path traversal
        if (!filePath.startsWith(uploadDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        await promises_1.default.unlink(filePath);
        logger_1.logger.info('File deleted', { filename });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('File delete error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});
exports.default = router;
