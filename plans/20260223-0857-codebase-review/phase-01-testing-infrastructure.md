# Phase 1: Testing Infrastructure

**Status**: Not Started
**Priority**: HIGH
**Effort**: 2 weeks
**Start Date**: TBD
**Owner**: TBD

## Context

Currently only 2 test files exist (`tests/unit/stores.test.ts`, `tests/unit/utils.test.ts`), providing minimal coverage for a production application with 51+ source files. Critical components like gateway manager (1163 lines) and chat store (1438 lines) have zero test coverage.

**Related Files**:
- `/Users/hnam/Desktop/ClawX-Web/vitest.config.ts` - Test configuration
- `/Users/hnam/Desktop/ClawX-Web/tests/unit/stores.test.ts` - Example store tests
- `/Users/hnam/Desktop/ClawX-Web/electron/gateway/manager.ts` - Needs integration tests
- `/Users/hnam/Desktop/ClawX-Web/electron/main/ipc-handlers.ts` - Needs IPC tests
- `/Users/hnam/Desktop/ClawX-Web/.github/workflows/check.yml` - CI pipeline

## Overview

Establish comprehensive testing infrastructure covering unit, integration, and E2E tests. Achieve 70%+ code coverage for critical paths and ensure all user workflows are validated.

**Dependencies**: None
**Blocks**: Phase 2 (security changes need test validation)

## Key Insights

- Vitest already configured with jsdom environment
- Playwright installed but no E2E tests exist
- CI pipeline runs `pnpm test` but no E2E step
- Complex IPC communication needs integration testing
- Gateway manager has complex lifecycle (start/stop/reconnect) requiring thorough testing

## Requirements

1. Achieve 70%+ code coverage for `src/` directory
2. Achieve 60%+ code coverage for `electron/` directory
3. E2E tests for main user workflows (setup, chat, channel management)
4. Integration tests for IPC handlers and gateway manager
5. Mock external dependencies (OpenClaw gateway, WebSocket connections)
6. Coverage reporting in CI pipeline
7. Test execution time under 5 minutes

## Architecture

### Testing Strategy

**Unit Tests** (Vitest + React Testing Library)
- All Zustand stores (`src/stores/*.ts`)
- Utility functions (`src/lib/utils.ts`, `electron/utils/*.ts`)
- React components (`src/components/ui/*.tsx`)
- Snapshot tests for complex UI

**Integration Tests** (Vitest + Electron test utilities)
- IPC handlers (`electron/main/ipc-handlers.ts`)
- Gateway manager lifecycle
- Provider storage and auth integration
- Mock child processes and WebSocket connections

**E2E Tests** (Playwright + Electron)
- Setup wizard flow
- Chat interface (send/receive messages)
- Channel management (create/start/stop)
- Settings persistence
- Gateway auto-start

### Mocking Strategy

```typescript
// Mock WebSocket connections
vi.mock('ws', () => ({
  WebSocket: vi.fn(() => ({
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
  })),
}));

// Mock child process spawning
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    kill: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  })),
}));

// Mock Electron APIs
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock/path') },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
}));
```

## Implementation Steps

### Step 1: Unit Test Expansion (3 days)

**Tasks**:
- [ ] Test all Zustand stores (settings, gateway, channels, providers, skills, cron, chat, update)
- [ ] Test utility functions in `src/lib/utils.ts`
- [ ] Test electron utils (secure-storage, openclaw-auth, provider-registry, device-identity)
- [ ] Test React components in `src/components/ui/*.tsx`
- [ ] Add snapshot tests for ChatMessage, SkillCard, ChannelCard

**Files to Create**:
- `tests/unit/stores/settings.test.ts`
- `tests/unit/stores/gateway.test.ts`
- `tests/unit/stores/channels.test.ts`
- `tests/unit/stores/providers.test.ts`
- `tests/unit/stores/skills.test.ts`
- `tests/unit/stores/cron.test.ts`
- `tests/unit/stores/chat.test.ts`
- `tests/unit/electron/secure-storage.test.ts`
- `tests/unit/electron/openclaw-auth.test.ts`
- `tests/unit/components/ChatMessage.test.tsx`

**Example Test**:
```typescript
// tests/unit/stores/gateway.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGatewayStore } from '@/stores/gateway';

describe('Gateway Store', () => {
  beforeEach(() => {
    useGatewayStore.setState({
      status: 'stopped',
      lastError: null,
      pendingRequests: new Map(),
    });
  });

  it('should initialize with stopped status', () => {
    const { status } = useGatewayStore.getState();
    expect(status).toBe('stopped');
  });

  it('should handle RPC calls with timeout', async () => {
    const store = useGatewayStore.getState();
    const promise = store.rpc('test.method', {}, 1000);

    // Simulate timeout
    await vi.advanceTimersByTimeAsync(1001);

    await expect(promise).rejects.toThrow('RPC timeout');
  });
});
```

### Step 2: Integration Tests (4 days)

**Tasks**:
- [ ] Create `tests/integration/` directory structure
- [ ] Test IPC handlers with mock Electron APIs
- [ ] Test gateway manager lifecycle (start/stop/reconnect)
- [ ] Test provider storage and OpenClaw auth integration
- [ ] Test channel config read/write operations
- [ ] Mock child process spawning and WebSocket connections

**Files to Create**:
- `tests/integration/ipc-handlers.test.ts`
- `tests/integration/gateway-manager.test.ts`
- `tests/integration/provider-storage.test.ts`
- `tests/integration/channel-config.test.ts`
- `tests/integration/mocks/electron.ts`
- `tests/integration/mocks/websocket.ts`

**Example Test**:
```typescript
// tests/integration/gateway-manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GatewayManager } from '@electron/gateway/manager';

describe('Gateway Manager', () => {
  let manager: GatewayManager;

  beforeEach(() => {
    manager = new GatewayManager();
  });

  it('should start gateway and connect', async () => {
    const mockSpawn = vi.fn(() => mockProcess);
    vi.mock('child_process', () => ({ spawn: mockSpawn }));

    await manager.start();

    expect(manager.status).toBe('running');
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('openclaw'),
      expect.arrayContaining(['gateway', 'start']),
      expect.any(Object)
    );
  });

  it('should reconnect on disconnect with exponential backoff', async () => {
    await manager.start();

    // Simulate disconnect
    manager.ws?.emit('close');

    // First reconnect attempt after 1s
    await vi.advanceTimersByTimeAsync(1000);
    expect(manager.reconnectAttempts).toBe(1);

    // Second attempt after 2s
    await vi.advanceTimersByTimeAsync(2000);
    expect(manager.reconnectAttempts).toBe(2);
  });
});
```

### Step 3: E2E Test Suite (5 days)

**Tasks**:
- [ ] Create `tests/e2e/` directory with Playwright config
- [ ] Configure Playwright for Electron app testing
- [ ] Test setup wizard flow (language → provider → verification)
- [ ] Test chat interface (send message, receive response, file upload)
- [ ] Test channel management (create, start, stop, QR login)
- [ ] Test settings persistence and theme switching
- [ ] Test gateway auto-start on app launch

**Files to Create**:
- `tests/e2e/playwright.config.ts`
- `tests/e2e/setup-wizard.spec.ts`
- `tests/e2e/chat-interface.spec.ts`
- `tests/e2e/channel-management.spec.ts`
- `tests/e2e/settings.spec.ts`
- `tests/e2e/fixtures/electron-app.ts`

**Example Test**:
```typescript
// tests/e2e/setup-wizard.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronApplication } from 'playwright';

test.describe('Setup Wizard', () => {
  let app: ElectronApplication;

  test.beforeEach(async ({ playwright }) => {
    app = await playwright.electron.launch({
      args: ['dist-electron/main/index.js'],
    });
  });

  test.afterEach(async () => {
    await app.close();
  });

  test('should complete setup flow', async () => {
    const window = await app.firstWindow();

    // Step 1: Language selection
    await expect(window.locator('h1')).toContainText('Welcome');
    await window.locator('button:has-text("English")').click();
    await window.locator('button:has-text("Next")').click();

    // Step 2: Provider setup
    await window.locator('select[name="provider"]').selectOption('anthropic');
    await window.locator('input[name="apiKey"]').fill('sk-ant-test-key');
    await window.locator('button:has-text("Next")').click();

    // Step 3: Verification
    await expect(window.locator('text=Setup Complete')).toBeVisible();
    await window.locator('button:has-text("Get Started")').click();

    // Should navigate to dashboard
    await expect(window.locator('h1')).toContainText('Dashboard');
  });
});
```

### Step 4: Coverage & CI Integration (2 days)

**Tasks**:
- [ ] Configure coverage thresholds in `vitest.config.ts`
- [ ] Add coverage reporting to `.github/workflows/check.yml`
- [ ] Create E2E test job in CI pipeline
- [ ] Set up test artifacts upload for failed tests
- [ ] Add coverage badge to README
- [ ] Configure coverage reports (text, JSON, HTML)

**Files to Modify**:
- `vitest.config.ts` - Add coverage thresholds
- `.github/workflows/check.yml` - Add E2E job and coverage reporting
- `README.md` - Add coverage badge

**Coverage Configuration**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'dist-electron/',
        'tests/',
        '**/*.config.*',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
});
```

**CI Configuration**:
```yaml
# .github/workflows/check.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json

  e2e:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results-${{ matrix.os }}
          path: test-results/
```

## Todo List

- [ ] Write unit tests for all Zustand stores
- [ ] Write unit tests for electron utils
- [ ] Write unit tests for React components
- [ ] Create integration test suite for IPC handlers
- [ ] Create integration tests for gateway manager
- [ ] Set up Playwright for Electron E2E testing
- [ ] Write E2E tests for setup wizard
- [ ] Write E2E tests for chat interface
- [ ] Write E2E tests for channel management
- [ ] Configure coverage thresholds
- [ ] Update CI pipeline with E2E tests
- [ ] Add coverage reporting to CI
- [ ] Add coverage badge to README

## Success Criteria

- [ ] 70%+ code coverage for `src/` directory
- [ ] 60%+ code coverage for `electron/` directory
- [ ] All critical user flows covered by E2E tests
- [ ] CI pipeline fails on coverage regression
- [ ] E2E tests run in CI on every PR
- [ ] Test execution time under 5 minutes
- [ ] Zero flaky tests in CI

## Risk Assessment

**Medium Risk**: Mocking Electron APIs and child processes can be complex
- **Mitigation**: Use established patterns from Electron testing documentation
- **Mitigation**: Start with simple mocks and iterate

**Medium Risk**: E2E tests may be flaky due to timing issues with gateway startup
- **Mitigation**: Use Playwright's auto-waiting and retry mechanisms
- **Mitigation**: Add explicit wait conditions for gateway ready state

**Low Risk**: Vitest and Playwright are well-documented and stable
- **Mitigation**: Follow official documentation and best practices

## Security Considerations

- Ensure test fixtures don't contain real API keys
- Mock all external network calls in tests
- Use environment variables for test configuration
- Don't commit test artifacts with sensitive data
- Sanitize logs in test output

## Next Steps

1. Set up test directory structure
2. Configure test mocks and fixtures
3. Start with unit tests for stores (quick wins)
4. Move to integration tests for IPC/Gateway
5. Implement E2E tests last (most complex)
6. Integrate coverage reporting into CI
7. Review coverage reports and identify gaps
8. Iterate to reach 70%+ coverage target

**After Completion**: Proceed to Phase 2 (Security Enhancements) with confidence that all changes are validated by comprehensive tests.
