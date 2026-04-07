# Phase 2: Backend Browser Manager Service

**Priority:** CRITICAL | **Status:** Pending

## Overview

Create `BrowserManager` singleton: wraps supervisorctl (start/stop/status), connects to Chromium CDP via `chrome-remote-interface`, exposes action methods (navigate, click, fill, screenshot, snapshot), manages turn-based lock state.

## Files to Create

- `server/services/browser-manager.ts` (~180 LOC)

## Dependencies

```bash
pnpm add chrome-remote-interface
pnpm add -D @types/chrome-remote-interface
```

## Design

```typescript
// server/services/browser-manager.ts
import CDP from 'chrome-remote-interface';
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
  cdpConnected: boolean;
  currentUrl: string;
  title: string;
  lockOwner: LockOwner;
  lastHumanInputAt: number; // epoch ms
  lastAgentActionAt: number;
  error: string | null;
}

const HUMAN_IDLE_MS = 3000; // FR-306: 3s idle threshold
const SUPERVISORCTL = '/usr/bin/supervisorctl';

export class BrowserManager extends EventEmitter {
  private state: BrowserState = {
    status: 'stopped',
    cdpConnected: false,
    currentUrl: 'about:blank',
    title: '',
    lockOwner: null,
    lastHumanInputAt: 0,
    lastAgentActionAt: 0,
    error: null,
  };
  private client: any = null; // CDP client
  private isLinux = platform() === 'linux';

  getState(): BrowserState { return { ...this.state }; }

  async start(): Promise<void> {
    if (!this.isLinux) {
      this.state.error = 'Browser stack only supported on Linux';
      return;
    }
    if (this.state.status === 'running' || this.state.status === 'starting') return;

    this.state.status = 'starting';
    this.state.error = null;
    this.emit('state-change', this.getState());

    try {
      await execFileAsync('sudo', [SUPERVISORCTL, 'start', 'browser-stack:*'], { timeout: 20000 });
      // Wait for CDP to come up (poll up to 15s)
      const connected = await this.waitForCDP(15000);
      if (!connected) throw new Error('CDP did not become ready');
      await this.connectCDP();
      this.state.status = 'running';
      logger.info('BrowserManager: started');
    } catch (err: any) {
      this.state.status = 'error';
      this.state.error = err.message;
      logger.error('BrowserManager: start failed', { error: err });
    }
    this.emit('state-change', this.getState());
  }

  async stop(): Promise<void> {
    if (!this.isLinux) return;
    if (this.state.status === 'stopped') return;

    this.state.status = 'stopping';
    this.emit('state-change', this.getState());

    try {
      if (this.client) { await this.client.close().catch(() => {}); this.client = null; }
      await execFileAsync('sudo', [SUPERVISORCTL, 'stop', 'browser-stack:*'], { timeout: 15000 });
      this.state = {
        status: 'stopped', cdpConnected: false, currentUrl: 'about:blank',
        title: '', lockOwner: null, lastHumanInputAt: 0, lastAgentActionAt: 0, error: null,
      };
      logger.info('BrowserManager: stopped');
    } catch (err: any) {
      this.state.status = 'error';
      this.state.error = err.message;
    }
    this.emit('state-change', this.getState());
  }

  // --- CDP Actions ---

  async navigate(url: string): Promise<void> {
    await this.ensureAgentTurn();
    await this.ensureCDP();
    await this.client.Page.navigate({ url });
    await this.client.Page.loadEventFired();
    await this.updatePageInfo();
    this.state.lastAgentActionAt = Date.now();
    this.emit('state-change', this.getState());
  }

  async click(selector: string): Promise<void> {
    await this.ensureAgentTurn();
    await this.ensureCDP();
    const expr = `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('not found');el.click();return true;})()`;
    await this.client.Runtime.evaluate({ expression: expr, awaitPromise: true });
    this.state.lastAgentActionAt = Date.now();
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.ensureAgentTurn();
    await this.ensureCDP();
    const expr = `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('not found');el.focus();el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`;
    await this.client.Runtime.evaluate({ expression: expr, awaitPromise: true });
    this.state.lastAgentActionAt = Date.now();
  }

  async screenshot(): Promise<string> {
    await this.ensureCDP();
    const { data } = await this.client.Page.captureScreenshot({ format: 'png' });
    return data; // base64
  }

  async snapshot(): Promise<any> {
    await this.ensureCDP();
    const { nodes } = await this.client.Accessibility.getFullAXTree();
    return nodes;
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
    // Auto-release to agent after idle
    if (this.state.lockOwner === 'human' && sinceHuman >= HUMAN_IDLE_MS) {
      this.state.lockOwner = 'agent';
      this.emit('state-change', this.getState());
    }
  }

  // --- CDP internal ---

  private async waitForCDP(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch('http://127.0.0.1:9222/json/version');
        if (res.ok) return true;
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  }

  private async connectCDP(): Promise<void> {
    this.client = await CDP({ host: '127.0.0.1', port: 9222 });
    await this.client.Page.enable();
    await this.client.Runtime.enable();
    await this.client.Accessibility.enable();
    this.state.cdpConnected = true;
    await this.updatePageInfo();
  }

  private async ensureCDP(): Promise<void> {
    if (!this.client) await this.connectCDP();
  }

  private async updatePageInfo(): Promise<void> {
    try {
      const { result: urlRes } = await this.client.Runtime.evaluate({ expression: 'location.href' });
      const { result: titleRes } = await this.client.Runtime.evaluate({ expression: 'document.title' });
      this.state.currentUrl = urlRes?.value ?? '';
      this.state.title = titleRes?.value ?? '';
    } catch { /* ignore */ }
  }
}

export const browserManager = new BrowserManager();
```

## Todo

- [ ] Install `chrome-remote-interface` + types
- [ ] Create `server/services/browser-manager.ts`
- [ ] Implement start/stop via supervisorctl
- [ ] Implement CDP connect with retry
- [ ] Implement navigate/click/fill/screenshot/snapshot
- [ ] Implement turn-based lock (markHumanInput, ensureAgentTurn)
- [ ] Emit `state-change` events for WebSocket broadcast
- [ ] Add no-op path for non-Linux (macOS dev)

## Success Criteria

- `browserManager.start()` brings stack up in <15s.
- `navigate('https://google.com')` returns, updates `currentUrl`.
- `markHumanInput()` blocks `navigate()` for 3s.
- `stop()` gracefully shuts down, resets state.
- macOS: returns error "Linux only" without crashing.

## Risks

- **CDP reconnect**: If Chromium crashes + supervisord restarts it, `client` becomes stale. Need reconnect logic on error.
- **sudo supervisorctl**: Must match sudoers rule exactly (Phase 1).

## Next

Phase 3: Expose REST routes + WebSocket events.
