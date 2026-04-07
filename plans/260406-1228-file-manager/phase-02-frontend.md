# Phase 2: Frontend Page + Store

**Priority:** HIGH | **Status:** Pending | **Depends on:** Phase 1

## Overview

Create Files page with root selector, breadcrumb navigation, file list table (with thumbnails for images), and Zustand store. Reuse existing patterns from USB page.

## Files to Create

### 1. `src/stores/file-manager.ts` (~80 LOC)

```typescript
import { create } from 'zustand';
import { api } from '@/lib/api';

export interface FileRoot {
  id: string;
  label: string;
  path: string;
  icon: string;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modified: string;
  mimeType: string | null;
  category: string;
  isMedia: boolean;
}

interface FileManagerState {
  roots: FileRoot[];
  selectedRoot: string | null;
  files: FileEntry[];
  currentPath: string;
  loading: boolean;
  error: string | null;

  fetchRoots: () => Promise<void>;
  fetchFiles: (rootId: string, path?: string) => Promise<void>;
  selectRoot: (rootId: string) => void;
  navigateTo: (path: string) => void;
}

export const useFileManagerStore = create<FileManagerState>((set, get) => ({
  roots: [],
  selectedRoot: null,
  files: [],
  currentPath: '/',
  loading: false,
  error: null,

  fetchRoots: async () => {
    const res = await api.getFmRoots();
    const roots = res.roots ?? [];
    set({ roots });
    // Auto-select first root
    if (roots.length > 0 && !get().selectedRoot) {
      const first = roots[0];
      set({ selectedRoot: first.id });
      get().fetchFiles(first.id);
    }
  },

  fetchFiles: async (rootId, path = '/') => {
    set({ loading: true, error: null, currentPath: path });
    try {
      const res = await api.getFmFiles(rootId, path);
      set({ files: res.files ?? [], loading: false });
    } catch (err) {
      set({ files: [], error: String(err), loading: false });
    }
  },

  selectRoot: (rootId) => {
    set({ selectedRoot: rootId, files: [], currentPath: '/' });
    get().fetchFiles(rootId);
  },

  navigateTo: (path) => {
    const rootId = get().selectedRoot;
    if (rootId) get().fetchFiles(rootId, path);
  },
}));
```

### 2. `src/lib/api.ts` additions

```typescript
// File Manager API
async getFmRoots() {
  return this.request<{ roots: any[] }>('/fm/roots');
}

async getFmFiles(rootId: string, path?: string) {
  const params = path && path !== '/' ? `?path=${encodeURIComponent(path)}` : '';
  return this.request<{ files: any[] }>(`/fm/list/${rootId}${params}`);
}

// Serve URL builders (not API calls — used for <img>/<video> src)
getFmServeUrl(rootId: string, filePath: string): string {
  return `/api/fm/serve/${rootId}?path=${encodeURIComponent(filePath)}`;
}

getFmThumbUrl(rootId: string, filePath: string, w = 200, h = 200): string {
  return `/api/fm/thumb/${rootId}?path=${encodeURIComponent(filePath)}&w=${w}&h=${h}`;
}
```

Note: `getFmServeUrl` and `getFmThumbUrl` return URL strings, not promises. Used directly in `<img src>` and `<video src>`.

### 3. `src/pages/Files/index.tsx` (~170 LOC)

Structure (mirrors USB page pattern):

```
┌─ Header ────────────────────────────────────┐
│ FolderOpen icon | "Files" title | RootSelect│
├─ Breadcrumbs + Search ──────────────────────┤
│ Home > Documents > Photos     [🔍 Search...]│
├─ File Table ────────────────────────────────┤
│ [thumb] photo1.jpg      Image  2.1MB  Today │
│ [thumb] photo2.png      Image  1.5MB  Today │
│ [icon]  video.mp4       Video  150MB  Yday  │
│ [📁]    subfolder       Folder  --    Yday  │
├─────────────────────────────────────────────┤
│ Empty state if no files                     │
└─────────────────────────────────────────────┘
```

Key differences from USB:
- **RootSelector** dropdown (Home / USB / Workspace) instead of device selector
- **Thumbnail column**: 40x40 `<img>` for image files, icon for others
- **Click file**: if directory → navigate. If media → open preview modal (Phase 3). If text → text preview.
- **No checkbox/copy/eject** (those are USB-specific)

Thumbnail rendering in table row:
```tsx
{file.category === 'image' ? (
  <img
    src={api.getFmThumbUrl(selectedRoot, file.path, 40, 40)}
    alt={file.name}
    className="w-10 h-10 rounded object-cover"
    loading="lazy"
  />
) : (
  <FileTypeIcon type={file.category} />
)}
```

### 4. i18n files

`src/i18n/locales/en/files.json`:
```json
{
  "title": "Files",
  "searchPlaceholder": "Search files...",
  "emptyFolder": "Empty folder",
  "noResults": "No matching files",
  "noRoots": "No accessible folders",
  "noRootsDesc": "No file roots are configured on this server.",
  "fileName": "Name",
  "fileType": "Type",
  "fileSize": "Size",
  "fileModified": "Modified",
  "folder": "Folder",
  "root": "Root",
  "breadcrumb": { "root": "Root" },
  "categories": {
    "image": "Image",
    "video": "Video",
    "audio": "Audio",
    "documents": "Document",
    "code": "Code",
    "data": "Data",
    "other": "Other"
  },
  "preview": {
    "title": "Preview",
    "notAvailable": "Preview not available for this file type.",
    "close": "Close",
    "prev": "Previous",
    "next": "Next"
  }
}
```

Vietnamese + Japanese: translate keys above.

## Files to Modify

- `src/App.tsx` — add route: `<Route path="/files" element={<Files />} />`
- `src/components/layout/Sidebar.tsx` — add Files nav item with `FolderOpen` icon
- `src/components/layout/BottomNav.tsx` — add Files entry
- `src/i18n/index.ts` — register `files` namespace

## Reusable Components (from USB)

- `formatSize()` → extract to shared util or copy
- `formatDate()` → same
- `FileTypeIcon` → extend with image/video/audio icons
- `SearchInput`, `Skeleton`, `EmptyState`, `Badge` → reuse directly
- `ModalDialog` → reuse for preview (Phase 3)

## Todo

- [ ] Create `src/stores/file-manager.ts`
- [ ] Add API methods to `src/lib/api.ts`
- [ ] Create `src/pages/Files/index.tsx` with list view + thumbnails
- [ ] Create i18n files (en/ja/vi)
- [ ] Register namespace in `src/i18n/index.ts`
- [ ] Add route in `src/App.tsx`
- [ ] Add Sidebar + BottomNav entries (FolderOpen icon)
- [ ] Test: navigate folders, search, breadcrumbs, thumbnails load

## Success Criteria

- Files tab visible in sidebar
- Root selector shows available folders
- Table rows display with thumbnails for images
- Click folder → navigates into it
- Breadcrumbs work correctly
- Search filters files by name
- Empty state shown for empty folders

## Next

Phase 3: Media preview modal.
