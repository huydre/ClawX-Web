/**
 * Browser Manager Service
 * Wraps supervisorctl (start/stop browser stack) and agent-browser CLI
 * for AI agent browser control. Manages turn-based lock between agent and human.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { platform } from 'os';
import { logger } from '../utils/logger.js';
const execFileAsync = promisify(execFile);
const HUMAN_IDLE_MS = 3000;
const SUPERVISORCTL = '/usr/bin/supervisorctl';
const CDP_PORT = '9222';
const CMD_TIMEOUT = 15000;
export class BrowserManager extends EventEmitter {
    state = {
        status: 'stopped',
        currentUrl: '',
        title: '',
        lockOwner: null,
        lastHumanInputAt: 0,
        lastAgentActionAt: 0,
        error: null,
    };
    isLinux = platform() === 'linux';
    getState() {
        return { ...this.state };
    }
    // ── Lifecycle ──────────────────────────────────────────────────────
    async start() {
        if (!this.isLinux) {
            this.state.error = 'Browser stack only supported on Linux';
            this.state.status = 'error';
            this.emit('state-change', this.getState());
            return;
        }
        if (this.state.status === 'running' || this.state.status === 'starting')
            return;
        this.state.status = 'starting';
        this.state.error = null;
        this.emit('state-change', this.getState());
        try {
            await execFileAsync('sudo', [SUPERVISORCTL, 'start', 'browser-stack:*'], { timeout: 20000 });
            // Wait for CDP to become ready
            const ready = await this.waitForCDP(15000);
            if (!ready)
                throw new Error('Chrome CDP did not become ready within 15s');
            this.state.status = 'running';
            await this.updatePageInfo();
            logger.info('BrowserManager: started');
        }
        catch (err) {
            this.state.status = 'error';
            this.state.error = err.message;
            logger.error('BrowserManager: start failed', { error: err });
        }
        this.emit('state-change', this.getState());
    }
    async stop() {
        if (!this.isLinux || this.state.status === 'stopped')
            return;
        this.state.status = 'stopping';
        this.emit('state-change', this.getState());
        try {
            await execFileAsync('sudo', [SUPERVISORCTL, 'stop', 'browser-stack:*'], { timeout: 15000 });
            this.state = {
                status: 'stopped', currentUrl: '', title: '',
                lockOwner: null, lastHumanInputAt: 0, lastAgentActionAt: 0, error: null,
            };
            logger.info('BrowserManager: stopped');
        }
        catch (err) {
            this.state.status = 'error';
            this.state.error = err.message;
        }
        this.emit('state-change', this.getState());
    }
    // ── agent-browser CLI wrapper ──────────────────────────────────────
    /** Execute an agent-browser command connected to the managed Chrome */
    async ab(args) {
        const { stdout } = await execFileAsync('agent-browser', ['--cdp', CDP_PORT, ...args], { timeout: CMD_TIMEOUT });
        return stdout.trim();
    }
    async navigate(url) {
        await this.ensureAgentTurn();
        await this.ab(['open', url]);
        await this.updatePageInfo();
        this.state.lastAgentActionAt = Date.now();
        this.emit('state-change', this.getState());
    }
    async click(selector) {
        await this.ensureAgentTurn();
        const result = await this.ab(['click', selector]);
        this.state.lastAgentActionAt = Date.now();
        return result;
    }
    async fill(selector, value) {
        await this.ensureAgentTurn();
        const result = await this.ab(['fill', selector, value]);
        this.state.lastAgentActionAt = Date.now();
        return result;
    }
    async type(selector, text) {
        await this.ensureAgentTurn();
        const result = await this.ab(['type', selector, text]);
        this.state.lastAgentActionAt = Date.now();
        return result;
    }
    async press(key) {
        await this.ensureAgentTurn();
        const result = await this.ab(['press', key]);
        this.state.lastAgentActionAt = Date.now();
        return result;
    }
    async snapshot() {
        return this.ab(['snapshot', '-i']);
    }
    async screenshot(path) {
        const args = ['screenshot'];
        if (path)
            args.push(path);
        return this.ab(args);
    }
    async evalJs(js) {
        await this.ensureAgentTurn();
        return this.ab(['eval', js]);
    }
    async getPageInfo() {
        try {
            const [url, title] = await Promise.all([
                this.ab(['get', 'url']),
                this.ab(['get', 'title']),
            ]);
            return { url, title };
        }
        catch {
            return { url: this.state.currentUrl, title: this.state.title };
        }
    }
    // ── Turn-based lock (FR-306) ───────────────────────────────────────
    markHumanInput() {
        this.state.lastHumanInputAt = Date.now();
        this.state.lockOwner = 'human';
        this.emit('state-change', this.getState());
    }
    takeControl(owner) {
        this.state.lockOwner = owner;
        if (owner === 'human')
            this.state.lastHumanInputAt = Date.now();
        this.emit('state-change', this.getState());
    }
    async ensureAgentTurn() {
        if (this.state.status !== 'running') {
            throw new Error('Browser stack not running');
        }
        const sinceHuman = Date.now() - this.state.lastHumanInputAt;
        if (this.state.lockOwner === 'human' && sinceHuman < HUMAN_IDLE_MS) {
            throw new Error(`Human controlling; wait ${HUMAN_IDLE_MS - sinceHuman}ms`);
        }
        // Auto-release to agent after idle timeout
        if (this.state.lockOwner === 'human' && sinceHuman >= HUMAN_IDLE_MS) {
            this.state.lockOwner = 'agent';
            this.emit('state-change', this.getState());
        }
    }
    // ── Internal ───────────────────────────────────────────────────────
    async waitForCDP(timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            try {
                await this.ab(['get', 'url']);
                return true;
            }
            catch { /* CDP not ready yet, retry */ }
            await new Promise(r => setTimeout(r, 1000));
        }
        return false;
    }
    async updatePageInfo() {
        try {
            const info = await this.getPageInfo();
            this.state.currentUrl = info.url;
            this.state.title = info.title;
        }
        catch { /* ignore */ }
    }
}
export const browserManager = new BrowserManager();
