# Phase 3: UX Improvements

**Priority:** MEDIUM | **Status:** Pending

## Issues Covered

| # | File | Issue |
|---|------|-------|
| 14 | `index.tsx:144-147` | Delete has no loading state, no error feedback |
| 15 | `index.tsx:102-104` | Refresh button no loading animation |
| 16 | `index.tsx:102-104` | Refresh button missing aria-label |
| 17 | `index.tsx:133-154` | No empty state when channels list empty |
| 18 | `AddChannelDialog.tsx:350-358` | No auto-refresh after gateway restart |

## Implementation Steps

### 3.1 Delete with confirmation dialog + loading
- Replace `confirm()` with a proper confirmation (or at minimum, add loading state)
- Show spinner on the card while deleting
- Show toast on success/error
- Use `AsyncButton` for the remove button in ChannelCard

### 3.2 Refresh button with loading animation
```typescript
<AsyncButton
  variant="outline"
  size="icon"
  iconOnly
  loading={loading}
  icon={<RefreshCw className="h-4 w-4" />}
  onClick={fetchChannels}
  aria-label={t('refresh')}
/>
```

### 3.3 Add empty state for configured channels
When `channels.length === 0` and not loading, show EmptyState component:
```typescript
<EmptyState
  icon={<Radio className="h-full w-full" />}
  title={t('empty.title')}
  description={t('empty.desc')}
  action={<Button onClick={...}>{t('empty.cta')}</Button>}
/>
```

### 3.4 Auto-refresh after channel add
After gateway restart in AddChannelDialog, call `fetchChannels()` with a small delay:
```typescript
await window.electron.ipcRenderer.invoke('gateway:restart');
setTimeout(() => fetchChannels(), 2000);
onChannelAdded();
```

## Success Criteria
- Delete shows loading state and error feedback
- Refresh button animates during fetch
- Empty state shown when no channels
- Channels auto-refresh after adding new one
- All interactive elements have aria-labels
