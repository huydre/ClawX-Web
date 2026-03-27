# Channels Tab Improvement Plan

> Fix 28 issues across i18n, logic bugs, UX, and security in the Channels tab.

## Phases

| Phase | Name | Priority | Status | Est. LOC |
|-------|------|----------|--------|----------|
| 1 | [i18n & Hardcoded Strings](phase-01-i18n.md) | CRITICAL | Pending | ~200 |
| 2 | [Logic Bugs & Error Handling](phase-02-logic-bugs.md) | HIGH | Pending | ~80 |
| 3 | [UX Improvements](phase-03-ux.md) | MEDIUM | Pending | ~120 |
| 4 | [Migrate to Shared Components](phase-04-shared-components.md) | MEDIUM | Pending | ~60 |

## Files Affected

- `src/pages/Channels/index.tsx`
- `src/pages/Channels/ChannelCard.tsx`
- `src/pages/Channels/ChannelSettingsPanel.tsx`
- `src/pages/Channels/AddChannelDialog.tsx`
- `src/stores/channels.ts`
- `src/i18n/locales/*/channels.json` (3 files)
- `server/routes/channels.ts`
- `server/routes/channel-config.ts`
