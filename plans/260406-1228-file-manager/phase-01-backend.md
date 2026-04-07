# Phase 1: Backend Service + Routes

**Priority:** CRITICAL | **Status:** Pending

## Overview

Create FileManager service (whitelist config, directory listing, file streaming with Range headers, thumbnail generation) and REST routes at `/api/fm`.

## Dependencies to Install

```bash
pnpm add sharp mime-types
pnpm add -D @types/mime-types
```

## Files to Create

### 1. `server/services/file-manager.ts` (~130 LOC)

```typescript
// Core responsibilities:
// - Whitelist roots (id, label, path) — initially hardcoded, later configurable
// - listDirectory(rootId, subPath) → FileEntry[]
// - serveFile(rootId, filePath, rangeHeader?) → ReadStream + headers
// - generateThumbnail(rootId, filePath, width, height) → Buffer (cached)
// - Security: path traversal check, whitelist enforcement

import { existsSync, readdirSync, statSync, createReadStream } from 'fs';
import { join, extname, relative, resolve } from 'path';
import { lookup as mimeLookup } from 'mime-types';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

export interface FileRoot {
  id: string;
  label: string;
  path: string;
  icon: string; // lucide icon name for frontend
}

export interface FileEntry {
  name: string;
  path: string;       // relative to root
  size: number;
  isDirectory: boolean;
  modified: string;
  mimeType: string | null;
  category: 'image' | 'video' | 'audio' | 'documents' | 'code' | 'data' | 'other';
  isMedia: boolean;   // true for image/video/audio — enables preview
}

// Reuse USB's categorizeFile logic
const EXT_CATEGORIES: Record<string, string[]> = {
  image: ['.jpg','.jpeg','.png','.gif','.svg','.webp','.bmp','.ico','.tiff'],
  video: ['.mp4','.mkv','.avi','.mov','.webm','.wmv','.flv'],
  audio: ['.mp3','.wav','.ogg','.flac','.aac','.wma','.m4a'],
  documents: ['.pdf','.doc','.docx','.txt','.rtf','.odt','.xls','.xlsx','.ppt','.pptx','.md'],
  code: ['.ts','.js','.py','.java','.c','.cpp','.go','.rs','.rb','.php','.html','.css','.json','.yaml','.yml','.toml','.xml','.sh'],
  data: ['.csv','.tsv','.sql','.db','.sqlite','.parquet','.jsonl','.log'],
};

function categorize(filename: string): FileEntry['category'] {
  const ext = extname(filename).toLowerCase();
  for (const [cat, exts] of Object.entries(EXT_CATEGORIES)) {
    if (exts.includes(ext)) return cat as FileEntry['category'];
  }
  return 'other';
}

export class FileManager {
  private roots: FileRoot[] = [];

  constructor() {
    this.initRoots();
  }

  private initRoots() {
    const home = homedir();
    this.roots = [
      { id: 'home', label: 'Home', path: home, icon: 'Home' },
      { id: 'media', label: 'USB / Media', path: '/media', icon: 'Usb' },
    ];
    // Add workspace root if exists
    const wsPath = join(home, '.openclaw', 'workspace');
    if (existsSync(wsPath)) {
      this.roots.push({ id: 'workspace', label: 'Agent Workspace', path: wsPath, icon: 'Bot' });
    }
  }

  getRoots(): FileRoot[] {
    return this.roots.filter(r => existsSync(r.path));
  }

  // Resolve and validate path — returns absolute path or null
  private resolvePath(rootId: string, subPath?: string): string | null {
    const root = this.roots.find(r => r.id === rootId);
    if (!root || !existsSync(root.path)) return null;

    const target = subPath ? resolve(root.path, subPath) : root.path;
    // Path traversal check
    if (!target.startsWith(root.path)) return null;
    return target;
  }

  listDirectory(rootId: string, subPath?: string): FileEntry[] {
    const dirPath = this.resolvePath(rootId, subPath);
    if (!dirPath || !existsSync(dirPath)) return [];

    try {
      const entries = readdirSync(dirPath);
      const files: FileEntry[] = [];
      const root = this.roots.find(r => r.id === rootId)!;

      for (const entry of entries) {
        if (entry.startsWith('.')) continue; // skip hidden
        try {
          const absPath = join(dirPath, entry);
          const stat = statSync(absPath);
          const relPath = relative(root.path, absPath);
          const cat = stat.isDirectory() ? 'other' : categorize(entry);
          const mime = stat.isDirectory() ? null : (mimeLookup(entry) || null);

          files.push({
            name: entry,
            path: relPath,
            size: stat.size,
            isDirectory: stat.isDirectory(),
            modified: stat.mtime.toISOString(),
            mimeType: mime,
            category: cat,
            isMedia: ['image','video','audio'].includes(cat),
          });
        } catch { /* skip unreadable */ }
      }

      return files.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      logger.warn('FileManager: listDirectory failed', { rootId, subPath, error: err });
      return [];
    }
  }

  // Returns absolute path + MIME type for streaming, or null
  getServePath(rootId: string, filePath: string): { absPath: string; mimeType: string } | null {
    const absPath = this.resolvePath(rootId, filePath);
    if (!absPath || !existsSync(absPath)) return null;
    try {
      const stat = statSync(absPath);
      if (stat.isDirectory()) return null;
    } catch { return null; }

    const mimeType = mimeLookup(absPath) || 'application/octet-stream';
    return { absPath, mimeType };
  }
}

export const fileManager = new FileManager();
```

### 2. `server/routes/file-manager.ts` (~70 LOC)

```typescript
import { Router } from 'express';
import { statSync, createReadStream } from 'fs';
import { fileManager } from '../services/file-manager.js';
import { logger } from '../utils/logger.js';
import sharp from 'sharp';

const router = Router();
const THUMB_CACHE = new Map<string, Buffer>(); // in-memory LRU (simple)

// GET /api/fm/roots
router.get('/roots', (_req, res) => {
  res.json({ roots: fileManager.getRoots() });
});

// GET /api/fm/list/:rootId?path=subdir
router.get('/list/:rootId', (req, res) => {
  const { rootId } = req.params;
  const subPath = (req.query.path as string) || undefined;
  const files = fileManager.listDirectory(rootId, subPath);
  res.json({ files });
});

// GET /api/fm/serve/:rootId/* — stream file with Range support
router.get('/serve/:rootId/*', (req, res) => {
  const { rootId } = req.params;
  const filePath = req.params[0]; // Express 5 wildcard → req.params[0]
  // NOTE: Express 5 changed wildcard capture. Test this.
  // If Express 5 doesn't support /serve/:rootId/*, use query param ?path= instead.

  const result = fileManager.getServePath(rootId, filePath);
  if (!result) return res.status(404).json({ error: 'File not found' });

  const { absPath, mimeType } = result;
  const stat = statSync(absPath);
  const fileSize = stat.size;

  // Range header support (video/audio seek)
  const range = req.headers.range;
  if (range) {
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
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
    });
    createReadStream(absPath).pipe(res);
  }
});

// GET /api/fm/thumb/:rootId/* — generate thumbnail (images only, 200x200)
router.get('/thumb/:rootId/*', async (req, res) => {
  const { rootId } = req.params;
  const filePath = req.params[0];

  const result = fileManager.getServePath(rootId, filePath);
  if (!result || !result.mimeType.startsWith('image/')) {
    return res.status(404).json({ error: 'Not an image' });
  }

  const cacheKey = `${rootId}:${filePath}`;
  if (THUMB_CACHE.has(cacheKey)) {
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    return res.send(THUMB_CACHE.get(cacheKey)!);
  }

  try {
    const w = parseInt(req.query.w as string) || 200;
    const h = parseInt(req.query.h as string) || 200;
    const thumb = await sharp(result.absPath)
      .resize(Math.min(w, 400), Math.min(h, 400), { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();

    // Simple cache (max 500 entries)
    if (THUMB_CACHE.size > 500) THUMB_CACHE.clear();
    THUMB_CACHE.set(cacheKey, thumb);

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(thumb);
  } catch (err) {
    logger.warn('Thumbnail generation failed', { rootId, filePath, error: err });
    res.status(500).json({ error: 'Thumbnail failed' });
  }
});

export default router;
```

## Files to Modify

### `server/app.ts`

```diff
+import fileManagerRouter from './routes/file-manager.js';
 ...
 app.use('/api/usb', usbRouter);
+app.use('/api/fm', fileManagerRouter);
```

## Express 5 Wildcard Note

Express 5 with path-to-regexp v8 changed wildcard syntax. `/:rootId/*` may NOT work. Already hit this bug with USB routes.

**Fallback if wildcard fails:** Use query param instead:
```
GET /api/fm/serve/:rootId?path=subdir/file.jpg
GET /api/fm/thumb/:rootId?path=subdir/file.jpg
```

Must test Express 5 wildcard behavior. If it fails, switch to query param approach (consistent with USB routes).

## Todo

- [ ] Install `sharp` + `mime-types`
- [ ] Create `server/services/file-manager.ts`
- [ ] Create `server/routes/file-manager.ts`
- [ ] Mount in `server/app.ts`
- [ ] Test Express 5 wildcard vs query param
- [ ] Test Range header streaming with `curl -H "Range: bytes=0-1000"`
- [ ] Test thumbnail generation with sharp
- [ ] Verify path traversal blocked

## Success Criteria

- `GET /api/fm/roots` → returns available roots
- `GET /api/fm/list/home?path=Documents` → lists files
- `GET /api/fm/serve/home/Documents/photo.jpg` → streams image
- `GET /api/fm/serve/home/video.mp4` with `Range` header → 206 partial content
- `GET /api/fm/thumb/home/photo.jpg` → 200x200 JPEG thumbnail
- `GET /api/fm/list/home?path=../../etc` → empty (traversal blocked)

## Risks

- Express 5 wildcard issue (known, has fallback)
- `sharp` install fail → fallback: serve original image, skip thumbnails
- Large directory (10K+ files) → add limit parameter later

## Next

Phase 2: Frontend page + store.
