---
name: File Manager with Media Preview
slug: file-manager
created: 2026-04-06
status: pending
branch: feature/browser
blockedBy: []
blocks: []
---

# File Manager with Media Preview

> Browse server filesystem (whitelist folders), preview images/video/audio in modal, list view with thumbnails. Streaming via Range headers.

## Overview

| Phase | Name | Priority | Status | Est. LOC |
|-------|------|----------|--------|----------|
| 1 | [Backend Service + Routes](phase-01-backend.md) | CRITICAL | Pending | ~200 |
| 2 | [Frontend Page + Store](phase-02-frontend.md) | HIGH | Pending | ~250 |
| 3 | [Media Preview Modal](phase-03-preview-modal.md) | HIGH | Pending | ~150 |
| 4 | [Thumbnails + Polish](phase-04-thumbnails.md) | MEDIUM | Pending | ~100 |

**Total:** ~700 LOC

## Architecture

```
Frontend (/files)
  ├── RootSelector (Home / USB / Workspace dropdown)
  ├── FileList (table rows + thumbnails)
  └── FilePreviewModal (image zoom, video/audio player, text fallback)
        │
        ▼ REST API
Backend
  ├── GET  /api/fm/roots              → whitelist folders
  ├── GET  /api/fm/list/:rootId       → directory listing (?path=)
  ├── GET  /api/fm/serve/:rootId/*    → stream file (Range headers)
  └── GET  /api/fm/thumb/:rootId/*    → thumbnail 200x200 (sharp)
        │
        ▼
FileManager service
  ├── Whitelist validation + path traversal check
  ├── Directory listing with file categorization (reuse from USB)
  ├── Range-header streaming (video seek)
  └── Thumbnail generation (sharp, cached to /tmp)
```

## Key Decisions

| Decision | Reason |
|---|---|
| Route prefix `/api/fm` (not `/api/files`) | `/api/files` already used for chat uploads |
| Whitelist roots configurable | Security: only browse approved folders |
| `sharp` for thumbnails | Mature, fast, x86 native. Cached to /tmp |
| HTML5 `<video>`/`<audio>` native player | Zero extra deps, Range streaming for seek |
| No PDF/Office preview | YAGNI, complex, user didn't request |
| Separate from USB page | USB has device-specific logic (eject, mount). Merge later if needed |

## Files

**New:**
- `server/services/file-manager.ts` — whitelist config, listing, streaming, thumbnails
- `server/routes/file-manager.ts` — REST endpoints
- `src/stores/file-manager.ts` — Zustand store
- `src/pages/Files/index.tsx` — Main page
- `src/pages/Files/FilePreviewModal.tsx` — Image/video/audio modal
- `src/i18n/locales/{en,ja,vi}/files.json`

**Modified:**
- `server/app.ts` — mount `/api/fm` route
- `src/App.tsx` — add `/files` route
- `src/components/layout/Sidebar.tsx` — add Files nav item
- `src/components/layout/BottomNav.tsx` — add Files
- `src/i18n/index.ts` — register `files` namespace
- `src/lib/api.ts` — add file manager API methods

## Dependencies

| Package | Purpose |
|---|---|
| `sharp` | Image thumbnail generation |
| `mime-types` | MIME type detection for streaming |

## Risks

- `sharp` native build on LIVA x86 → should work but verify
- Large video files (>1GB) → streaming works but may saturate LIVA network
- Whitelist roots hardcoded initially → make configurable via settings API later

## Success Criteria

- Browse Home / USB / Workspace folders
- Click image → modal with full-size view
- Click video/audio → modal with native HTML5 player, seek works
- Thumbnails load for images in list view
- Path traversal blocked
- No access outside whitelist roots
