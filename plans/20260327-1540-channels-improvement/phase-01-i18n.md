# Phase 1: i18n & Hardcoded Strings

**Priority:** CRITICAL | **Status:** Pending

## Overview

ChannelCard and ChannelSettingsPanel have zero i18n — all text hardcoded in English/Vietnamese mix. Several i18n keys referenced but not defined in locale files.

## Issues Covered

| # | File | Issue |
|---|------|-------|
| 1 | `ChannelSettingsPanel.tsx` | No `useTranslation`, mixed EN/VI hardcoded text |
| 2 | `ChannelCard.tsx` | All labels hardcoded English (Online, Settings, Remove...) |
| 3 | `index.tsx:145` | `deleteConfirm` key missing from locales |
| 4 | `index.tsx:189` | `configuredBadge` key missing from locales |
| 5 | `AddChannelDialog.tsx:516` | `doneScan` key missing from locales |

## Implementation Steps

### 1.1 Add missing i18n keys to all 3 locale files
Add to `en/channels.json`, `vi/channels.json`, `ja/channels.json`:
```json
{
  "card": {
    "online": "Online",
    "offline": "Offline",
    "error": "Error",
    "active": "Active",
    "inactive": "Inactive",
    "connection": "Connection",
    "lastMessage": "Last message",
    "settings": "Settings",
    "remove": "Remove",
    "docs": "Docs"
  },
  "settings": {
    "title": "Channel Settings",
    "groupPolicy": "Group Policy",
    "groupPolicyDesc": "Allow bot to respond in groups",
    "pairingPolicy": "Pairing Policy",
    "pairingPolicyDesc": "How users pair with bot",
    "allowFrom": "Allow From (DM)",
    "allowFromDesc": "User IDs allowed to send DMs",
    "groupAllowFrom": "Group Allow From",
    "groupAllowFromDesc": "Group IDs allowed to use bot",
    "save": "Save",
    "cancel": "Cancel",
    "open": "Open",
    "allowlist": "Allowlist",
    "code": "Code",
    "disabled": "Disabled"
  },
  "deleteConfirm": "Are you sure you want to remove this channel?",
  "configuredBadge": "Configured",
  "doneScan": "Done scanning"
}
```

### 1.2 Update ChannelCard.tsx
- Import `useTranslation`
- Replace all hardcoded strings with `t('card.xxx')` calls

### 1.3 Update ChannelSettingsPanel.tsx
- Import `useTranslation`
- Replace all hardcoded labels/descriptions with `t('settings.xxx')` calls
- Remove all inline Vietnamese text

### 1.4 Fix missing keys in index.tsx and AddChannelDialog.tsx
- Verify `deleteConfirm`, `configuredBadge`, `doneScan` keys exist after step 1.1

## Success Criteria
- Zero hardcoded UI strings in Channel components
- All 3 locales have complete channel keys
- Language switching works correctly for all Channel UI
