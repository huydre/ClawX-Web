# Phase 4: Thumbnails + Polish

**Priority:** MEDIUM | **Status:** Pending | **Depends on:** Phase 1-3

## Overview

Optimize thumbnail loading, add loading states, handle edge cases, verify sharp works on LIVA, polish UI details.

## Tasks

### 1. Thumbnail lazy loading optimization

In the file list table, thumbnails load as `<img>` with `loading="lazy"`. Add:

- **Intersection Observer**: Only request thumbnail when row scrolls into view (browser `loading="lazy"` may not work well in scrollable table).
- **Error fallback**: If sharp fails (unsupported format, corrupt file), show file type icon instead.
- **Loading skeleton**: Show 40x40 gray skeleton while loading.

```tsx
function Thumbnail({ rootId, file }: { rootId: string; file: FileEntry }) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error || file.category !== 'image') {
    return <FileTypeIcon type={file.category} />;
  }

  return (
    <div className="relative w-10 h-10">
      {!loaded && <Skeleton variant="rectangular" width={40} height={40} className="absolute inset-0 rounded" />}
      <img
        src={api.getFmThumbUrl(rootId, file.path, 40, 40)}
        alt={file.name}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          'w-10 h-10 rounded object-cover transition-opacity',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}
```

### 2. Video thumbnail (poster frame)

For video files in the list, show a film icon (no server-side video thumbnail — ffmpeg too heavy for LIVA).

Future enhancement: extract poster frame via ffmpeg on demand. Not in MVP.

### 3. Browser cache headers

Backend thumbnail endpoint already sets `Cache-Control: public, max-age=3600`. Verify:
- Second request for same thumbnail → served from browser cache (HTTP 304 or cache hit).
- Different size params → different cache entry (query string varies).

### 4. Polish items

| Item | Detail |
|---|---|
| **formatSize / formatDate** | Extract from USB page to `src/lib/format-utils.ts` shared module. Both USB + Files pages import from there. |
| **FileTypeIcon** | Extend with `Image`, `Video`, `Music` lucide icons for media categories. Move to shared `src/components/common/FileTypeIcon.tsx`. |
| **Root icon mapping** | Map root.icon string to lucide component: `Home` → `<Home>`, `Usb` → `<Usb>`, `Bot` → `<Bot>`. |
| **Empty root** | If root folder doesn't exist or is empty, show appropriate EmptyState. |
| **Error toast** | Show toast on API errors (network, 500). |
| **Responsive** | Hide Modified column on mobile (`hidden md:table-cell`). Reduce thumbnail to 32x32 on mobile. |

### 5. Shared utilities extraction

Create `src/lib/format-utils.ts`:
```typescript
export function formatSize(bytes: number): string { ... }
export function formatDate(ts: string | number): string { ... }
```

Update USB page to import from shared module instead of local function.

Create `src/components/common/FileTypeIcon.tsx`:
```typescript
// Extend existing USB FileTypeIcon with image/video/audio categories
export function FileTypeIcon({ type }: { type: string }) { ... }
```

## Todo

- [ ] Create `src/lib/format-utils.ts` (extract from USB)
- [ ] Create `src/components/common/FileTypeIcon.tsx` (extend with media icons)
- [ ] Update USB page to use shared imports
- [ ] Add Thumbnail component with loading/error states
- [ ] Add responsive hiding for Modified column
- [ ] Test on LIVA: verify sharp generates thumbnails for jpg/png/webp/gif
- [ ] Test cache headers (browser DevTools Network tab)
- [ ] Test error fallback (corrupt image file)
- [ ] Build dist-server and verify no TypeScript errors

## Success Criteria

- Thumbnails load smoothly with skeleton placeholder
- Corrupt/unsupported images fallback to icon
- USB page still works after shared util extraction
- Mobile layout hides date column, smaller thumbnails
- No TypeScript compile errors

## Risks

- **sharp SVG support**: sharp handles SVG but may need `librsvg`. On LIVA apt install handles this. Test.
- **Shared module refactor**: Changing USB imports could break if not careful. Test USB page after.

## Definition of Done (Full Feature)

After Phase 4:
1. Files tab in sidebar works
2. Browse Home / USB / Workspace roots
3. Image thumbnails in list
4. Click image → modal with zoom
5. Click video → modal with player + seek
6. Click audio → modal with player
7. Text files → modal with content preview
8. Arrow key navigation in preview modal
9. Path traversal blocked on server
10. No new TypeScript errors
11. USB page unaffected
