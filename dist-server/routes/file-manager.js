/**
 * File Manager Routes — /api/fm
 * Browse whitelisted directories, stream files (Range support), generate thumbnails.
 */
import { Router } from 'express';
import { statSync, createReadStream } from 'fs';
import { fileManager } from '../services/file-manager.js';
import { logger } from '../utils/logger.js';
/** Try to load sharp (optional native dep). Falls back to serving original image. */
let sharp = null;
try {
    sharp = (await import('sharp')).default;
}
catch {
    logger.info('sharp not available — thumbnail generation disabled, serving originals');
}
const router = Router();
/** Simple in-memory thumbnail cache (max 500 entries) */
const thumbCache = new Map();
/**
 * GET /api/fm/roots — list available file roots
 */
router.get('/roots', (_req, res) => {
    res.json({ roots: fileManager.getRoots() });
});
/**
 * GET /api/fm/list/:rootId — list directory contents
 * Query: ?path=subdir/path
 */
router.get('/list/:rootId', (req, res) => {
    const { rootId } = req.params;
    const subPath = req.query.path || undefined;
    const files = fileManager.listDirectory(rootId, subPath);
    res.json({ files });
});
/**
 * GET /api/fm/serve/:rootId — stream a file with Range header support
 * Query: ?path=relative/file/path
 */
router.get('/serve/:rootId', (req, res) => {
    const { rootId } = req.params;
    const filePath = req.query.path;
    if (!filePath) {
        return res.status(400).json({ error: 'path query parameter required' });
    }
    const result = fileManager.getServePath(rootId, filePath);
    if (!result)
        return res.status(404).json({ error: 'File not found' });
    const { absPath, mimeType } = result;
    try {
        const stat = statSync(absPath);
        const fileSize = stat.size;
        const range = req.headers.range;
        if (range) {
            // Range request — partial content for video/audio seek
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType,
            });
            createReadStream(absPath, { start, end }).pipe(res);
        }
        else {
            // Full file response
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': mimeType,
                'Accept-Ranges': 'bytes',
            });
            createReadStream(absPath).pipe(res);
        }
    }
    catch (err) {
        logger.error('FileManager serve error', { rootId, filePath, error: err });
        res.status(500).json({ error: 'Failed to serve file' });
    }
});
/**
 * GET /api/fm/thumb/:rootId — generate image thumbnail
 * Query: ?path=relative/file/path&w=200&h=200
 */
router.get('/thumb/:rootId', async (req, res) => {
    const { rootId } = req.params;
    const filePath = req.query.path;
    if (!filePath) {
        return res.status(400).json({ error: 'path query parameter required' });
    }
    const result = fileManager.getServePath(rootId, filePath);
    if (!result || !result.mimeType.startsWith('image/')) {
        return res.status(404).json({ error: 'Not an image or file not found' });
    }
    // Check cache
    const cacheKey = `${rootId}:${filePath}`;
    if (thumbCache.has(cacheKey)) {
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(thumbCache.get(cacheKey));
    }
    // If sharp not available, serve original image
    if (!sharp) {
        res.set('Content-Type', result.mimeType);
        res.set('Cache-Control', 'public, max-age=3600');
        return createReadStream(result.absPath).pipe(res);
    }
    try {
        const w = Math.min(parseInt(req.query.w) || 200, 400);
        const h = Math.min(parseInt(req.query.h) || 200, 400);
        const thumb = await sharp(result.absPath)
            .resize(w, h, { fit: 'cover' })
            .jpeg({ quality: 70 })
            .toBuffer();
        // Evict cache if too large
        if (thumbCache.size > 500)
            thumbCache.clear();
        thumbCache.set(cacheKey, thumb);
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(thumb);
    }
    catch (err) {
        logger.warn('Thumbnail generation failed, serving original', { rootId, filePath, error: err });
        res.set('Content-Type', result.mimeType);
        createReadStream(result.absPath).pipe(res);
    }
});
export default router;
