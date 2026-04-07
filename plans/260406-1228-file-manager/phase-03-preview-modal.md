# Phase 3: Media Preview Modal

**Priority:** HIGH | **Status:** Pending | **Depends on:** Phase 2

## Overview

Create `FilePreviewModal` component: click any file in list → opens ModalDialog with appropriate viewer. Image (full-size + zoom), Video (HTML5 player with streaming), Audio (HTML5 player), Text (pre tag fallback). Arrow key navigation between files.

## Files to Create

### `src/pages/Files/FilePreviewModal.tsx` (~150 LOC)

```tsx
// Props:
// - file: FileEntry | null (null = closed)
// - rootId: string
// - files: FileEntry[] (all files in current dir, for prev/next nav)
// - onClose: () => void
// - onNavigate: (file: FileEntry) => void

import { useEffect, useCallback, useState } from 'react';
import { ModalDialog } from '@/components/common/ModalDialog';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

function FilePreviewModal({ file, rootId, files, onClose, onNavigate }) {
  const [zoom, setZoom] = useState(1);

  // Build serve URL for current file
  const serveUrl = file ? api.getFmServeUrl(rootId, file.path) : '';

  // Find prev/next media files for arrow navigation
  const mediaFiles = files.filter(f => !f.isDirectory);
  const currentIndex = file ? mediaFiles.findIndex(f => f.path === file.path) : -1;
  const prevFile = currentIndex > 0 ? mediaFiles[currentIndex - 1] : null;
  const nextFile = currentIndex < mediaFiles.length - 1 ? mediaFiles[currentIndex + 1] : null;

  // Keyboard navigation
  useEffect(() => {
    if (!file) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && prevFile) onNavigate(prevFile);
      if (e.key === 'ArrowRight' && nextFile) onNavigate(nextFile);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [file, prevFile, nextFile, onNavigate, onClose]);

  // Reset zoom on file change
  useEffect(() => { setZoom(1); }, [file?.path]);

  // Render content based on category
  const renderContent = () => {
    if (!file) return null;

    switch (file.category) {
      case 'image':
        return (
          <div className="flex items-center justify-center overflow-auto max-h-[70vh]">
            <img
              src={serveUrl}
              alt={file.name}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
              className="max-w-full transition-transform cursor-zoom-in"
              onClick={() => setZoom(z => z < 3 ? z + 0.5 : 1)}
            />
          </div>
        );

      case 'video':
        return (
          <video
            src={serveUrl}
            controls
            autoPlay={false}
            className="w-full max-h-[70vh] rounded"
            preload="metadata"
          >
            Your browser does not support video playback.
          </video>
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
              <span className="text-3xl">♫</span>
            </div>
            <audio src={serveUrl} controls autoPlay={false} className="w-full max-w-md">
              Your browser does not support audio playback.
            </audio>
          </div>
        );

      default:
        // Text fallback — load via fetch for small files
        return <TextPreview rootId={rootId} file={file} />;
    }
  };

  return (
    <ModalDialog
      open={!!file}
      onClose={onClose}
      title={file?.name ?? ''}
      maxWidth="xl"
    >
      {file && (
        <div className="space-y-3">
          {/* File info bar */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="secondary">{file.category}</Badge>
            <span>{formatSize(file.size)}</span>
            {file.mimeType && <span>{file.mimeType}</span>}
          </div>

          {/* Content */}
          {renderContent()}

          {/* Navigation arrows */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => prevFile && onNavigate(prevFile)}
              disabled={!prevFile}
              className="btn btn-ghost btn-sm"
            >
              <ChevronLeft size={16} /> Prev
            </button>

            {file.category === 'image' && (
              <div className="flex items-center gap-2">
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="btn btn-ghost btn-sm">
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="btn btn-ghost btn-sm">
                  <ZoomIn size={16} />
                </button>
              </div>
            )}

            <button
              onClick={() => nextFile && onNavigate(nextFile)}
              disabled={!nextFile}
              className="btn btn-ghost btn-sm"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </ModalDialog>
  );
}
```

### TextPreview sub-component (inline, ~30 LOC)

For non-media files < 100KB: fetch text content via new API endpoint and display in `<pre>`.

```tsx
function TextPreview({ rootId, file }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (file.size > 100_000) { setContent(null); setLoading(false); return; }
    // Fetch raw text via serve endpoint
    fetch(api.getFmServeUrl(rootId, file.path))
      .then(res => res.ok ? res.text() : null)
      .then(text => setContent(text))
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [rootId, file.path]);

  if (loading) return <Skeleton variant="text" height={200} />;
  if (!content) return <p className="text-sm text-muted-foreground">Preview not available.</p>;

  return (
    <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap break-all">
      {content}
    </pre>
  );
}
```

## Integration with Files/index.tsx

```tsx
// In Files page, add state:
const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);

// In handleFileClick:
if (file.isDirectory) {
  navigateTo(file.path);
} else {
  setPreviewFile(file);
}

// Render modal:
<FilePreviewModal
  file={previewFile}
  rootId={selectedRoot}
  files={files}
  onClose={() => setPreviewFile(null)}
  onNavigate={(f) => setPreviewFile(f)}
/>
```

## Features

| Feature | Implementation |
|---|---|
| Image preview | `<img src={serveUrl}>`, click to zoom (0.5x-4x), CSS transform |
| Video player | HTML5 `<video controls>`, src = streaming endpoint, Range headers enable seek |
| Audio player | HTML5 `<audio controls>`, album art placeholder |
| Text fallback | Fetch text via serve endpoint, display in `<pre>` (max 100KB) |
| Prev/Next nav | Arrow keys + buttons, cycle through non-directory files |
| Zoom controls | Image only: +/- buttons + click-to-zoom, percentage display |

## Todo

- [ ] Create `src/pages/Files/FilePreviewModal.tsx`
- [ ] Wire into Files/index.tsx (handleFileClick + modal render)
- [ ] Test image zoom (click + buttons)
- [ ] Test video streaming + seek (Range headers)
- [ ] Test audio playback
- [ ] Test arrow key navigation
- [ ] Test text fallback for small files
- [ ] Test large file (>100KB text) → "Preview not available"

## Success Criteria

- Click image → modal shows full-size image, zoom works
- Click video → modal shows HTML5 player, seek works (no re-buffer)
- Click audio → modal shows player with placeholder icon
- Arrow keys navigate between files
- ESC closes modal
- Text files show content in monospace
- Non-previewable files show "Preview not available"

## Risks

- **Video MIME type**: server must send correct Content-Type. `mime-types` package handles this.
- **Large images**: loading 10MB+ raw image in modal → slow. Acceptable for MVP, could add "loading" spinner.
- **SVG rendering**: `<img src>` renders SVG but no interaction. OK for preview.

## Next

Phase 4: Thumbnails optimization + polish.
