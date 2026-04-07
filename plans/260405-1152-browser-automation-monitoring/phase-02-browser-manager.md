# Phase 2: Backend Browser Manager Service (v2)

**Priority:** CRITICAL | **Status:** Pending

## Overview

Create `BrowserManager` singleton: wraps supervisorctl (start/stop/status), executes
`agent-browser` CLI commands (navigate, click, fill, snapshot, screenshot), manages
turn-based lock state. No npm CDP dependency — all via CLI `execFile`.

## Changes from v1

- Replaced `chrome-remote-interface` (npm) with `agent-browser` CLI calls via `execFile`
- Added snapshot with `@ref` element IDs (AI-friendly)
- Added `--cdp 9222` flag for connecting to existing Chrome
- No new npm dependencies needed

## Files to Create

- `server/services/browser-manager.ts` (~180 LOC)

## Design

```typescript
// server/services/browser-manager.ts
import { execFile } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { platform } from 'os';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export type BrowserStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
export type LockOwner = 'agent' | 'human' | null;

interface BrowserState {
  status: BrowserStatus;
  currentUrl: string;
  title: string;
  lockOwner: LockOwner;
  lastHumanInputAt: number;
  lastAgentActionAt: number;
  error: string | null;
}

const HUMAN_IDLE_MS = 3000; // FR-306: 3s idle threshold
const SUPERVISORCTL = '/usr/bin/supervisorctl';
const CDP_PORT = '9222';
const CMD_TIMEOUT = 15000; // 15s per command

export class BrowserManager extends EventEmitter {
  private state: BrowserState = { ... };
  private isLinux = platform() === 'linux';

  getState(): BrowserState { return { ...this.state }; }

  // --- Lifecycle ---

  async start(): Promise<void> {
    // supervisorctl start browser-stack:*
    // Wait for CDP ready (poll agent-browser get cdp-url)
    // Set status = 'running'
  }

  async stop(): Promise<void> {
    // supervisorctl stop browser-stack:*
    // Reset state
  }

  // --- agent-browser CLI wrapper ---

  private async ab(args: string[]): Promise<string> {
    // Core CLI executor
    const { stdout } = await execFileAsync(
      'agent-browser',
      ['--cdp', CDP_PORT, ...args],
      { timeout: CMD_TIMEOUT }
    );
    return stdout.trim();
  }

  async navigate(url: string): Promise<void> {
    await this.ensureAgentTurn();
    await this.ab(['open', url]);
    await this.updatePageInfo();
    this.state.lastAgentActionAt = Date.now();
    this.emit('state-change', this.getState());
  }

  async click(selector: string): Promise<string> {
    await this.ensureAgentTurn();
    const result = await this.ab(['click', selector]);
    this.state.lastAgentActionAt = Date.now();
    return result;
  }

  async fill(selector: string, value: string): Promise<string> {
    await this.ensureAgentTurn();
    const result = await this.ab(['fill', selector, value]);
    this.state.lastAgentActionAt = Date.now();
    return result;
  }

  async type(selector: string, text: string): Promise<string> {
    await this.ensureAgentTurn();
    const result = await this.ab(['type', selector, text]);
    this.state.lastAgentActionAt = Date.now();
    return result;
  }

  async press(key: string): Promise<string> {
    await this.ensureAgentTurn();
    return this.ab(['press', key]);
  }

  async snapshot(): Promise<string> {
    // Returns accessibility tree with @refs
    return this.ab(['snapshot', '-i', '--json']);
  }

  async screenshot(path?: string): Promise<string> {
    const args = ['screenshot'];
    if (path) args.push(path);
    args.push('--json');
    return this.ab(args);
  }

  async getPageInfo(): Promise<{ url: string; title: string }> {
    const [url, title] = await Promise.all([
      this.ab(['get', 'url']),
      this.ab(['get', 'title']),
    ]);
    return { url, title };
  }

  async eval(js: string): Promise<string> {
    await this.ensureAgentTurn();
    return this.ab(['eval', js]);
  }

  // --- Turn-based lock (FR-306) ---

  markHumanInput(): void {
    this.state.lastHumanInputAt = Date.now();
    this.state.lockOwner = 'human';
    this.emit('state-change', this.getState());
  }

  takeControl(owner: LockOwner): void {
    this.state.lockOwner = owner;
    if (owner === 'human') this.state.lastHumanInputAt = Date.now();
    this.emit('state-change', this.getState());
  }

  private async ensureAgentTurn(): Promise<void> {
    const sinceHuman = Date.now() - this.state.lastHumanInputAt;
    if (this.state.lockOwner === 'human' && sinceHuman < HUMAN_IDLE_MS) {
      throw new Error(`Human controlling; wait ${HUMAN_IDLE_MS - sinceHuman}ms`);
    }
    if (this.state.lockOwner === 'human' && sinceHuman >= HUMAN_IDLE_MS) {
      this.state.lockOwner = 'agent';
      this.emit('state-change', this.getState());
    }
  }

  // --- Internal ---

  private async waitForCDP(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        await this.ab(['get', 'url']);
        return true;
      } catch { /* retry */ }
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  }

  private async updatePageInfo(): Promise<void> {
    try {
      const info = await this.getPageInfo();
      this.state.currentUrl = info.url;
      this.state.title = info.title;
    } catch { /* ignore */ }
  }
}

export const browserManager = new BrowserManager();
```

## Key Design Decisions

| Decision | Reason |
|---|---|
| `execFile('agent-browser', [...])` not npm CDP | No npm dep, reuse agent-browser's Rust speed + snapshot refs |
| `--cdp 9222` on every call | Connect to supervisord-managed Chrome, not agent-browser's own Chrome |
| `--json` flag on snapshot/screenshot | Structured output for API responses |
| Selectors: `@e1` refs OR CSS `#id` | agent-browser supports both, AI agents use @refs from snapshot |

## agent-browser CLI Commands Used

| Action | CLI Command |
|---|---|
| Navigate | `agent-browser --cdp 9222 open <url>` |
| Click | `agent-browser --cdp 9222 click <selector>` |
| Fill | `agent-browser --cdp 9222 fill <selector> "<value>"` |
| Type | `agent-browser --cdp 9222 type <selector> "<text>"` |
| Press key | `agent-browser --cdp 9222 press Enter` |
| Snapshot | `agent-browser --cdp 9222 snapshot -i --json` |
| Screenshot | `agent-browser --cdp 9222 screenshot [path] --json` |
| Get URL | `agent-browser --cdp 9222 get url` |
| Get title | `agent-browser --cdp 9222 get title` |

## Todo

- [ ] Create `server/services/browser-manager.ts`
- [ ] Implement start/stop via supervisorctl
- [ ] Implement `ab()` CLI wrapper with `--cdp 9222`
- [ ] Implement navigate/click/fill/type/press/snapshot/screenshot
- [ ] Implement turn-based lock (markHumanInput, ensureAgentTurn)
- [ ] Emit `state-change` events for WebSocket broadcast
- [ ] Add no-op path for non-Linux (macOS dev)
- [ ] Test: `agent-browser --cdp 9222 open https://google.com` returns OK

## Success Criteria

- `browserManager.start()` brings stack up in <15s
- `navigate('https://google.com')` executes CLI, updates state
- `snapshot()` returns JSON accessibility tree with @refs
- `markHumanInput()` blocks agent commands for 3s
- `stop()` gracefully shuts down, resets state
- macOS: returns error "Linux only" without crashing

## Risks

- **agent-browser not installed globally**: `ab()` will throw ENOENT. Detect in `start()` and return helpful error.
- **CLI timeout on slow pages**: 15s default may not be enough for heavy sites. Make configurable.
- **JSON parse errors**: Some commands may not support `--json`. Fallback to raw stdout.

## Next

Phase 3: Expose REST routes.
