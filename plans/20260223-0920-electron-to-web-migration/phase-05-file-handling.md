# Phase 5: File Upload/Download

**Status**: Not Started
**Priority**: MEDIUM
**Effort**: 1 day
**Dependencies**: Phase 2 (Backend Server)

## Context

Implement file upload/download to replace Electron's dialog.showOpenDialog and file staging system.

**Related Files**:
- `/Users/hnam/Desktop/ClawX-Web/electron/main/ipc-handlers.ts` - file:stage, file:stageBuffer handlers
- `/Users/hnam/Desktop/ClawX-Web/src/pages/Chat/ChatInput.tsx` - File upload UI
- `/Users/hnam/Desktop/ClawX-Web/src/stores/chat.ts` - File handling logic

## Overview

Replace native file picker with HTML input, implement multer for file upload, maintain staging directory structure.

## Key Insights

- File staging: ~/.openclaw/media/outbound/ with UUID naming
- Supports: images, PDFs, text files (up to 50MB)
- Image preview generation (512px max, base64 data URIs)
- Drag-and-drop + paste support
- Returns metadata: id, fileName, mimeType, fileSize, stagedPath, preview

## Requirements

1. Implement multer file upload middleware
2. Create file staging endpoint
3. Create buffer staging endpoint (for paste/drag-drop)
4. Generate image previews
5. Replace dialog.showOpenDialog with HTML input
6. Update ChatInput component
7. Implement file cleanup (old files)

## Architecture

### File Upload Flow

```
Browser → HTML Input → FormData → Multer → Stage to Disk → Return Metadata
```

### File Staging

```
~/.openclaw/media/outbound/
├── <uuid>-file1.jpg
├── <uuid>-file2.pdf
└── <uuid>-file3.txt
```

## Implementation Steps

### Step 1: Create File Handler Service (2 hours)

**server/services/file-handler.ts**:

```typescript
import { randomUUID } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import sharp from 'sharp';
import { logger } from '../utils/logger';

const STAGING_DIR = join(homedir(), '.openclaw', 'media', 'outbound');

// Ensure staging directory exists
mkdirSync(STAGING_DIR, { recursive: true });

export interface StagedFile {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  stagedPath: string;
  preview?: string; // base64 data URI for images
}

export async function stageFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<StagedFile> {
  const id = randomUUID();
  const ext = fileName.split('.').pop() || '';
  const stagedFileName = `${id}-${fileName}`;
  const stagedPath = join(STAGING_DIR, stagedFileName);

  // Write file to disk
  writeFileSync(stagedPath, buffer);

  const fileSize = buffer.length;
  logger.info('File staged', { id, fileName, fileSize, mimeType });

  // Generate preview for images
  let preview: string | undefined;
  if (mimeType.startsWith('image/')) {
    try {
      preview = await generateImagePreview(buffer, mimeType);
    } catch (error) {
      logger.warn('Failed to generate preview', { fileName, error });
    }
  }

  return {
    id,
    fileName,
    mimeType,
    fileSize,
    stagedPath,
    preview,
  };
}

export async function stageFileFromBase64(
  base64: string,
  fileName: string,
  mimeType: string
): Promise<StagedFile> {
  const buffer = Buffer.from(base64, 'base64');
  return stageFile(buffer, fileName, mimeType);
}

async function generateImagePreview(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  // Resize to max 512px
  const resized = await sharp(buffer)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  // Convert to base64 data URI
  const base64 = resized.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

export function cleanupOldFiles(maxAgeMs = 24 * 60 * 60 * 1000): number {
  try {
    const files = readdirSync(STAGING_DIR);
    const now = Date.now();
    let cleaned = 0;

    for (const file of files) {
      const filePath = join(STAGING_DIR, file);
      const stats = statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAgeMs) {
        unlinkSync(filePath);
        cleaned++;
        logger.debug('Cleaned up old file', { file, ageHours: age / 3600000 });
      }
    }

    if (cleaned > 0) {
      logger.info('Cleanup completed', { cleaned });
    }

    return cleaned;
  } catch (error) {
    logger.error('Cleanup failed', error);
    return 0;
  }
}

// Schedule cleanup every hour
setInterval(() => {
  cleanupOldFiles();
}, 60 * 60 * 1000);
```

### Step 2: Create File Routes (2 hours)

**server/routes/files.ts**:

```typescript
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { stageFile, stageFileFromBase64, cleanupOldFiles } from '../services/file-handler';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10, // Max 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// POST /api/files/stage
router.post('/stage', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const staged = await Promise.all(
      files.map((file) =>
        stageFile(file.buffer, file.originalname, file.mimetype)
      )
    );

    logger.info('Files staged', { count: staged.length });
    res.json({ success: true, files: staged });
  } catch (error) {
    logger.error('File staging error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/files/stage-buffer
const stageBufferSchema = z.object({
  base64: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
});

router.post('/stage-buffer', async (req, res) => {
  try {
    const { base64, fileName, mimeType } = stageBufferSchema.parse(req.body);

    const staged = await stageFileFromBase64(base64, fileName, mimeType);

    logger.info('Buffer staged', { fileName });
    res.json({ success: true, file: staged });
  } catch (error) {
    logger.error('Buffer staging error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/files/cleanup
router.post('/cleanup', async (req, res) => {
  try {
    const cleaned = cleanupOldFiles();
    res.json({ success: true, cleaned });
  } catch (error) {
    logger.error('Cleanup error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
```

### Step 3: Update ChatInput Component (2 hours)

**src/pages/Chat/ChatInput.tsx** (key changes):

```typescript
import { api } from '@/lib/api-client';

// Replace dialog.showOpenDialog with HTML input
const fileInputRef = useRef<HTMLInputElement>(null);

const handleFileSelect = () => {
  fileInputRef.current?.click();
};

const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  try {
    setUploading(true);
    const result = await api.files.stage(files);

    if (result.success) {
      setAttachments(result.files);
    }
  } catch (error) {
    console.error('File upload failed:', error);
    toast.error('Failed to upload files');
  } finally {
    setUploading(false);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }
};

// Handle paste
const handlePaste = async (e: React.ClipboardEvent) => {
  const items = Array.from(e.clipboardData.items);
  const imageItems = items.filter(item => item.type.startsWith('image/'));

  if (imageItems.length === 0) return;

  e.preventDefault();

  try {
    setUploading(true);

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;

      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      const result = await api.files.stageBuffer({
        base64,
        fileName: `pasted-${Date.now()}.png`,
        mimeType: file.type,
      });

      if (result.success) {
        setAttachments(prev => [...prev, result.file]);
      }
    }
  } catch (error) {
    console.error('Paste upload failed:', error);
    toast.error('Failed to upload pasted image');
  } finally {
    setUploading(false);
  }
};

// Handle drag and drop
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  setDragging(false);

  const files = Array.from(e.dataTransfer.files);
  if (files.length === 0) return;

  try {
    setUploading(true);
    const result = await api.files.stage(files);

    if (result.success) {
      setAttachments(result.files);
    }
  } catch (error) {
    console.error('Drop upload failed:', error);
    toast.error('Failed to upload files');
  } finally {
    setUploading(false);
  }
};

return (
  <div
    onDrop={handleDrop}
    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
    onDragLeave={() => setDragging(false)}
    onPaste={handlePaste}
  >
    {/* Hidden file input */}
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept="image/*,.pdf,.txt,.csv,.json"
      onChange={handleFileChange}
      style={{ display: 'none' }}
    />

    {/* Attach button */}
    <button onClick={handleFileSelect} disabled={uploading}>
      <Paperclip className="w-5 h-5" />
    </button>

    {/* Show attachments */}
    {attachments.length > 0 && (
      <div className="flex gap-2 p-2">
        {attachments.map((file) => (
          <div key={file.id} className="relative">
            {file.preview ? (
              <img src={file.preview} alt={file.fileName} className="w-16 h-16 object-cover rounded" />
            ) : (
              <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                <File className="w-8 h-8" />
              </div>
            )}
            <button
              onClick={() => setAttachments(prev => prev.filter(f => f.id !== file.id))}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    )}

    {uploading && <div>Uploading...</div>}
  </div>
);
```

### Step 4: Update app.ts with File Routes (30 min)

**server/app.ts** (add routes):

```typescript
import fileRoutes from './routes/files';

// ... existing code ...

app.use('/api/files', authMiddleware, fileRoutes);
```

### Step 5: Install sharp Dependency (15 min)

```bash
pnpm add sharp
pnpm add -D @types/sharp
```

### Step 6: Test File Upload (1.5 hours)

Create test HTML page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>File Upload Test</title>
</head>
<body>
  <h1>File Upload Test</h1>

  <input type="file" id="fileInput" multiple>
  <button onclick="uploadFiles()">Upload</button>

  <div id="result"></div>

  <script>
    const TOKEN = '<your-token>';

    async function uploadFiles() {
      const files = document.getElementById('fileInput').files;
      const formData = new FormData();

      for (let file of files) {
        formData.append('files', file);
      }

      const response = await fetch('http://localhost:2003/api/files/stage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        },
        body: formData
      });

      const result = await response.json();
      document.getElementById('result').innerHTML = JSON.stringify(result, null, 2);
    }
  </script>
</body>
</html>
```

## Todo List

- [ ] Create server/services/file-handler.ts
- [ ] Implement file staging
- [ ] Implement buffer staging
- [ ] Implement image preview generation
- [ ] Implement cleanup function
- [ ] Create server/routes/files.ts
- [ ] Configure multer middleware
- [ ] Update app.ts with file routes
- [ ] Install sharp dependency
- [ ] Update ChatInput component
- [ ] Replace dialog.showOpenDialog with HTML input
- [ ] Implement paste handler
- [ ] Implement drag-and-drop handler
- [ ] Test file upload
- [ ] Test image preview
- [ ] Test cleanup

## Success Criteria

- [ ] File upload working via HTML input
- [ ] Multiple files supported
- [ ] Drag-and-drop working
- [ ] Paste working for images
- [ ] Image previews generated
- [ ] Files staged to ~/.openclaw/media/outbound/
- [ ] Old files cleaned up automatically
- [ ] File size limit enforced (50MB)
- [ ] File type validation working

## Risk Assessment

**Low Risk**: Multer is stable and well-tested
- Mitigation: Use latest version

**Medium Risk**: Image processing (sharp)
- Mitigation: Wrap in try-catch, fallback to no preview

**Low Risk**: File cleanup
- Mitigation: Test cleanup logic thoroughly

## Security Considerations

- File size limit: 50MB
- File type whitelist (images, PDFs, text)
- Files stored in user directory (not web-accessible)
- Cleanup old files (24 hours)
- No path traversal (UUID naming)

## Next Steps

After completion, proceed to Phase 6 (Systemd Auto-start) to configure service for boot.
