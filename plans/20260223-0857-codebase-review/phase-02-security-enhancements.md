# Phase 2: Security Enhancements

**Status**: Not Started
**Priority**: CRITICAL
**Effort**: 2 weeks
**Start Date**: TBD
**Owner**: TBD

## Context

API keys are currently stored in plain text using electron-store (`electron/utils/secure-storage.ts` lines 45-56). This is a critical security vulnerability. The file is misleadingly named "secure-storage" but provides no encryption. Additionally, multiple security issues exist in CI/CD workflows, dependency chain, and system entitlements.

**Related Files**:
- `/Users/hnam/Desktop/ClawX-Web/electron/utils/secure-storage.ts` - Plain text API key storage
- `/Users/hnam/Desktop/ClawX-Web/electron/utils/openclaw-auth.ts` - Writes keys to JSON files
- `/Users/hnam/Desktop/ClawX-Web/electron/main/ipc-handlers.ts` - IPC handlers for key operations
- `/Users/hnam/Desktop/ClawX-Web/.github/workflows/release.yml` - CI/CD secrets exposure
- `/Users/hnam/Desktop/ClawX-Web/scripts/download-bundled-uv.mjs` - Insecure binary downloads

## Overview

Migrate API keys from plain text to OS-native keychain storage using Electron's `safeStorage` API. Fix critical security vulnerabilities across the codebase including CI/CD secrets, dependency vulnerabilities, and insecure download scripts.

**Dependencies**: Phase 1 (tests needed to validate security changes)
**Blocks**: None

## Key Insights

- `electron-store` used for provider configs and API keys (no encryption)
- Comment in `secure-storage.ts` line 4: "Keys are stored in plain text"
- macOS Keychain, Windows Credential Manager, and Linux Secret Service available
- Electron provides `safeStorage` API for OS-level credential storage
- Multiple provider types store sensitive keys (Anthropic, OpenAI, Google, OpenRouter, etc.)
- CI/CD workflow writes OSS credentials to plain text config file
- UV binary downloads lack checksum verification (supply chain risk)
- Dependency vulnerabilities in tar, hono, ajv, minimatch packages

## Requirements

1. Migrate API key storage to OS native keychain/credential manager
2. Encrypt sensitive data at rest using `safeStorage` API
3. Implement secure key derivation for encryption fallback
4. Provide migration path for existing users (automatic, transparent)
5. Add security audit logging for key access
6. Fix CI/CD secrets exposure in release workflow
7. Add checksum verification for binary downloads
8. Patch dependency vulnerabilities
9. Review and tighten macOS entitlements
10. Ensure backward compatibility during migration

## Architecture

### Keychain Storage Architecture

```typescript
// New architecture using safeStorage
import { safeStorage } from 'electron';

class KeychainStorage {
  // Primary: OS keychain via safeStorage
  async storeKey(id: string, key: string): Promise<void> {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(key);
      await this.store.set(`keys.${id}`, encrypted.toString('base64'));
    } else {
      // Fallback: AES-256-GCM with machine-specific key
      const encrypted = await this.encryptWithFallback(key);
      await this.store.set(`keys.${id}`, encrypted);
    }
  }

  async getKey(id: string): Promise<string | null> {
    const encrypted = await this.store.get(`keys.${id}`);
    if (!encrypted) return null;

    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    } else {
      return await this.decryptWithFallback(encrypted);
    }
  }
}
```

### Migration Strategy

```typescript
// Automatic migration on app startup
async function migrateToKeychain(): Promise<void> {
  const oldStore = await getProviderStore();
  const oldKeys = oldStore.get('apiKeys') as Record<string, string>;

  if (!oldKeys || Object.keys(oldKeys).length === 0) {
    return; // Nothing to migrate
  }

  const keychain = new KeychainStorage();
  const migrated: string[] = [];
  const failed: string[] = [];

  for (const [providerId, apiKey] of Object.entries(oldKeys)) {
    try {
      await keychain.storeKey(providerId, apiKey);
      migrated.push(providerId);
      logger.info(`Migrated key for provider: ${providerId}`);
    } catch (error) {
      failed.push(providerId);
      logger.error(`Failed to migrate key for ${providerId}:`, error);
    }
  }

  if (failed.length === 0) {
    // Delete old plain text keys
    oldStore.delete('apiKeys');
    logger.info(`Migration complete: ${migrated.length} keys migrated`);
  } else {
    logger.error(`Migration incomplete: ${failed.length} keys failed`);
    throw new Error('Key migration failed');
  }
}
```

## Implementation Steps

### Step 1: Implement Keychain Storage (4 days)

**Tasks**:
- [ ] Create new `electron/utils/keychain-storage.ts` module
- [ ] Implement `safeStorage` wrapper with encryption availability check
- [ ] Add AES-256-GCM fallback encryption for Linux systems without Secret Service
- [ ] Implement key derivation using machine ID + app secret
- [ ] Implement CRUD operations (store, get, delete, list)
- [ ] Add error handling and logging
- [ ] Write unit tests for keychain storage

**Files to Create**:
- `electron/utils/keychain-storage.ts` - New keychain storage implementation
- `tests/unit/electron/keychain-storage.test.ts` - Unit tests

**Example Implementation**:
```typescript
// electron/utils/keychain-storage.ts
import { safeStorage, app } from 'electron';
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';
import { machineIdSync } from 'node-machine-id';
import Store from 'electron-store';
import { logger } from './logger';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

export class KeychainStorage {
  private store: Store;
  private machineKey: Buffer | null = null;

  constructor() {
    this.store = new Store({ name: 'clawx-keychain' });
  }

  async storeKey(id: string, key: string): Promise<void> {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(key);
        this.store.set(`keys.${id}`, {
          type: 'safeStorage',
          data: encrypted.toString('base64'),
        });
        logger.info(`Stored key in OS keychain: ${id}`);
      } else {
        const encrypted = await this.encryptWithFallback(key);
        this.store.set(`keys.${id}`, {
          type: 'fallback',
          data: encrypted,
        });
        logger.warn(`Stored key with fallback encryption: ${id}`);
      }
    } catch (error) {
      logger.error(`Failed to store key ${id}:`, error);
      throw error;
    }
  }

  async getKey(id: string): Promise<string | null> {
    try {
      const entry = this.store.get(`keys.${id}`) as any;
      if (!entry) return null;

      if (entry.type === 'safeStorage') {
        const buffer = Buffer.from(entry.data, 'base64');
        return safeStorage.decryptString(buffer);
      } else if (entry.type === 'fallback') {
        return await this.decryptWithFallback(entry.data);
      }

      return null;
    } catch (error) {
      logger.error(`Failed to retrieve key ${id}:`, error);
      throw error;
    }
  }

  async deleteKey(id: string): Promise<void> {
    this.store.delete(`keys.${id}`);
    logger.info(`Deleted key: ${id}`);
  }

  listKeys(): string[] {
    const keys = this.store.get('keys') as Record<string, any> || {};
    return Object.keys(keys);
  }

  private getMachineKey(): Buffer {
    if (!this.machineKey) {
      const machineId = machineIdSync();
      const appSecret = app.getName() + app.getVersion();
      this.machineKey = pbkdf2Sync(
        appSecret,
        machineId,
        100000,
        KEY_LENGTH,
        'sha256'
      );
    }
    return this.machineKey;
  }

  private async encryptWithFallback(plaintext: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = this.getMachineKey();

    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
  }

  private async decryptWithFallback(ciphertext: string): Promise<string> {
    const buffer = Buffer.from(ciphertext, 'base64');
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = this.getMachineKey();
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final('utf8');
  }
}

export const keychainStorage = new KeychainStorage();
```

### Step 2: Migration System (3 days)

**Tasks**:
- [ ] Create `electron/utils/storage-migration.ts`
- [ ] Detect existing plain text keys on startup
- [ ] Migrate keys to keychain storage with error handling
- [ ] Delete plain text keys after successful migration
- [ ] Add migration status tracking
- [ ] Handle migration failures gracefully (keep backup)
- [ ] Write integration tests for migration

**Files to Create**:
- `electron/utils/storage-migration.ts` - Migration logic
- `tests/integration/storage-migration.test.ts` - Integration tests

**Example Implementation**:
```typescript
// electron/utils/storage-migration.ts
import { keychainStorage } from './keychain-storage';
import { getProviderStore } from './secure-storage';
import { logger } from './logger';

export async function migrateToKeychain(): Promise<{
  success: boolean;
  migrated: string[];
  failed: string[];
}> {
  const oldStore = await getProviderStore();
  const oldKeys = (oldStore.get('apiKeys') || {}) as Record<string, string>;

  if (Object.keys(oldKeys).length === 0) {
    logger.info('No keys to migrate');
    return { success: true, migrated: [], failed: [] };
  }

  const migrated: string[] = [];
  const failed: string[] = [];

  logger.info(`Starting migration of ${Object.keys(oldKeys).length} keys`);

  for (const [providerId, apiKey] of Object.entries(oldKeys)) {
    try {
      await keychainStorage.storeKey(providerId, apiKey);
      migrated.push(providerId);
      logger.info(`✓ Migrated key: ${providerId}`);
    } catch (error) {
      failed.push(providerId);
      logger.error(`✗ Failed to migrate key ${providerId}:`, error);
    }
  }

  if (failed.length === 0) {
    // Backup old keys before deletion
    oldStore.set('apiKeys.backup', oldKeys);
    oldStore.set('apiKeys.migrated', true);
    oldStore.delete('apiKeys');

    logger.info(`Migration complete: ${migrated.length} keys migrated successfully`);
    return { success: true, migrated, failed };
  } else {
    logger.error(`Migration incomplete: ${failed.length} keys failed`);
    return { success: false, migrated, failed };
  }
}

export async function checkMigrationStatus(): Promise<boolean> {
  const oldStore = await getProviderStore();
  return oldStore.get('apiKeys.migrated') === true;
}
```

### Step 3: Update Storage Layer (3 days)

**Tasks**:
- [ ] Refactor `secure-storage.ts` to use keychain backend
- [ ] Update `openclaw-auth.ts` to avoid writing keys to JSON
- [ ] Update IPC handlers to use new storage layer
- [ ] Maintain API compatibility for renderer process
- [ ] Add deprecation warnings for old methods
- [ ] Update provider registry to use keychain

**Files to Modify**:
- `electron/utils/secure-storage.ts` - Use keychain backend
- `electron/utils/openclaw-auth.ts` - Remove plain text JSON writes
- `electron/main/ipc-handlers.ts` - Update key operation handlers

**Example Refactor**:
```typescript
// electron/utils/secure-storage.ts (refactored)
import { keychainStorage } from './keychain-storage';
import { logger } from './logger';

export async function storeApiKey(providerId: string, apiKey: string): Promise<boolean> {
  try {
    await keychainStorage.storeKey(providerId, apiKey);
    logger.info(`Stored API key for provider: ${providerId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to store API key for ${providerId}:`, error);
    return false;
  }
}

export async function getApiKey(providerId: string): Promise<string | null> {
  try {
    return await keychainStorage.getKey(providerId);
  } catch (error) {
    logger.error(`Failed to retrieve API key for ${providerId}:`, error);
    return null;
  }
}

export async function deleteApiKey(providerId: string): Promise<boolean> {
  try {
    await keychainStorage.deleteKey(providerId);
    logger.info(`Deleted API key for provider: ${providerId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete API key for ${providerId}:`, error);
    return false;
  }
}

export function listStoredKeyIds(): string[] {
  return keychainStorage.listKeys();
}
```

### Step 4: Fix CI/CD & Build Security (4 days)

**Tasks**:
- [ ] Fix OSS credential exposure in release.yml (use CLI args instead of config file)
- [ ] Add checksum verification to download-bundled-uv.mjs
- [ ] Update vulnerable dependencies (pnpm update)
- [ ] Review and tighten macOS entitlements
- [ ] Remove token from URL in gateway Control UI handler
- [ ] Add input validation to IPC handlers
- [ ] Replace execSync with execFile for command execution

**Files to Modify**:
- `.github/workflows/release.yml` - Fix OSS credential handling
- `scripts/download-bundled-uv.mjs` - Add checksum verification
- `package.json` - Update dependencies
- `entitlements.mac.plist` - Tighten entitlements
- `electron/main/ipc-handlers.ts` - Add input validation, remove token from URL

**Example Fixes**:
```yaml
# .github/workflows/release.yml (fixed)
- name: Upload to OSS
  run: |
    # Use CLI args instead of config file
    ossutil cp -r release/*.dmg oss://clawx-releases/mac/ \
      -e ${{ secrets.OSS_ENDPOINT }} \
      -i ${{ secrets.OSS_ACCESS_KEY_ID }} \
      -k ${{ secrets.OSS_ACCESS_KEY_SECRET }}
```

```typescript
// scripts/download-bundled-uv.mjs (with checksum)
const CHECKSUMS = {
  'darwin-arm64': 'sha256:abc123...',
  'darwin-x64': 'sha256:def456...',
  'win32-x64': 'sha256:ghi789...',
  'linux-x64': 'sha256:jkl012...',
};

async function verifyChecksum(filePath, expectedChecksum) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  const actual = `sha256:${hash.digest('hex')}`;
  if (actual !== expectedChecksum) {
    throw new Error(`Checksum mismatch: expected ${expectedChecksum}, got ${actual}`);
  }
}

// After download
await verifyChecksum(archivePath, CHECKSUMS[platform]);
```

### Step 5: Security Audit & Testing (4 days)

**Tasks**:
- [ ] Add security audit logging for all key access
- [ ] Write comprehensive security tests
- [ ] Test encryption/decryption on all platforms
- [ ] Test migration scenarios (success, partial failure, rollback)
- [ ] Verify keys are not logged or exposed in error messages
- [ ] Test cross-platform compatibility (macOS, Windows, Linux)
- [ ] Perform security review of key handling code
- [ ] Run static analysis tools (eslint security rules)

**Files to Create**:
- `tests/security/keychain-security.test.ts` - Security-focused tests
- `tests/integration/migration-scenarios.test.ts` - Migration tests

## Todo List

- [ ] Implement keychain-storage.ts with safeStorage API
- [ ] Add AES-256-GCM fallback encryption
- [ ] Create storage migration utility
- [ ] Update secure-storage.ts to use keychain backend
- [ ] Refactor openclaw-auth.ts to avoid plain text JSON
- [ ] Update all IPC handlers for key operations
- [ ] Fix OSS credential exposure in CI/CD
- [ ] Add checksum verification to UV downloads
- [ ] Update vulnerable dependencies
- [ ] Tighten macOS entitlements
- [ ] Add security audit logging
- [ ] Write comprehensive security tests
- [ ] Test migration on all platforms
- [ ] Update documentation with security best practices

## Success Criteria

- [ ] All API keys stored in OS keychain/credential manager
- [ ] Zero plain text keys in electron-store or JSON files
- [ ] Successful migration for 100% of existing users
- [ ] Security audit log captures all key access attempts
- [ ] Tests verify encryption strength and key isolation
- [ ] No credentials exposed in CI/CD logs
- [ ] All binary downloads verified with checksums
- [ ] All dependency vulnerabilities patched
- [ ] Documentation updated with security architecture

## Risk Assessment

**High Risk**: Migration failure could lock users out of their accounts
- **Mitigation**: Keep backup of plain text keys during migration
- **Mitigation**: Provide rollback mechanism if migration fails
- **Mitigation**: Comprehensive testing on all platforms

**Medium Risk**: Cross-platform keychain behavior differences
- **Mitigation**: Test on macOS, Windows, and Linux
- **Mitigation**: Implement fallback encryption for systems without keychain

**Medium Risk**: Performance impact of encryption/decryption operations
- **Mitigation**: Cache decrypted keys in memory during session
- **Mitigation**: Use async operations to avoid blocking UI

**Low Risk**: Breaking changes for existing users
- **Mitigation**: Automatic migration on app startup
- **Mitigation**: Maintain backward compatibility during transition

## Security Considerations

- Never log actual key values, only access events (provider ID, timestamp, operation)
- Use secure random number generation for encryption keys (crypto.randomBytes)
- Implement key rotation mechanism for future use
- Add rate limiting for key access attempts (prevent brute force)
- Consider adding master password option for additional security layer
- Ensure error messages don't leak sensitive information
- Sanitize all logs to prevent credential exposure
- Use constant-time comparison for authentication tags
- Clear sensitive data from memory after use

## Next Steps

1. Implement keychain storage with safeStorage API
2. Create and test migration system
3. Update all storage layer code to use keychain
4. Fix CI/CD and build security issues
5. Run comprehensive security tests
6. Perform security audit and code review
7. Update documentation with security architecture
8. Deploy with migration enabled

**After Completion**: All sensitive credentials will be protected by OS-level security, significantly reducing attack surface. Users can confidently store API keys knowing they're encrypted at rest.
