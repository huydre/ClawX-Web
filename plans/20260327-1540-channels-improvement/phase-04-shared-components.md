# Phase 4: Migrate to Shared Components

**Priority:** MEDIUM | **Status:** Pending

## Issues Covered

| # | File | Issue |
|---|------|-------|
| 19 | `ChannelSettingsPanel.tsx:95` | Uses inline modal, not ModalDialog |
| 20 | `AddChannelDialog.tsx:410` | Uses inline modal, not ModalDialog |

## Implementation Steps

### 4.1 Migrate ChannelSettingsPanel to ModalDialog
Replace:
```typescript
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
  <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
    <CardHeader>...</CardHeader>
    <CardContent>...</CardContent>
  </Card>
</div>
```
With:
```typescript
<ModalDialog
  open={true}
  onClose={onClose}
  title={t('settings.title')}
  maxWidth="lg"
  footer={<>cancel + save buttons</>}
>
  ...content...
</ModalDialog>
```

### 4.2 Migrate AddChannelDialog to ModalDialog
Same pattern — replace inline overlay with ModalDialog component.
Benefits: Portal rendering, Escape key, body scroll lock, consistent blur overlay.

## Success Criteria
- Both dialogs use ModalDialog (Portal-based, consistent styling)
- No more inline `fixed inset-0` overlays in Channels
- Escape key and click-outside work consistently
