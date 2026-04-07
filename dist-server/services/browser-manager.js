/**
 * Browser Manager Service
 * Launches Chrome directly on Xvfb with CDP port 9222 (shared with OpenClaw).
 * Uses agent-browser CLI via --cdp 9222 for browser commands.
 * Manages turn-based lock between agent and human.
 */
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { platform, homedir } from 'os';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
const execFileAsync = promisify(execFile);
const HUMAN_IDLE_MS = 3000;
const SUPERVISORCTL = '/usr/bin/supervisorctl';
const CDP_PORT = '9222';
const CMD_TIMEOUT = 15000;
const DISPLAY = ':99';
/** Find Chrome binary installed by agent-browser */
function findChromeBinary() {
    const browsersDir = join(homedir(), '.agent-browser', 'browsers');
    if (!existsSync(browsersDir))
        return null;
    try {
        const dirs = readdirSync(browsersDir).filter(d => d.startsWith('chrome-'));
        // Sort descending to get latest version
        dirs.sort().reverse();
        for (const dir of dirs) {
            const chromePath = join(browsersDir, dir, 'chrome');
            if (existsSync(chromePath))
                return chromePath;
        }
    }
    catch { /* ignore */ }
    return null;
}
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
    chromeProcess = null;
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
            // 1. Find Chrome binary
            const chromePath = findChromeBinary();
            if (!chromePath)
                throw new Error('Chrome not found. Run: agent-browser install');
            // 2. Start display stack (Xvfb + x11vnc + noVNC)
            await execFileAsync('sudo', [SUPERVISORCTL, 'start', 'browser-stack:*'], { timeout: 20000 });
            // Wait for Xvfb to be ready
            await new Promise(r => setTimeout(r, 1500));
            // 3. Kill any existing Chrome on CDP port
            try {
                await execFileAsync('fuser', ['-k', `${CDP_PORT}/tcp`], { timeout: 3000 });
            }
            catch { /* no process on port */ }
            // 4. Launch Chrome directly on Xvfb with fixed CDP port 9222
            this.chromeProcess = spawn(chromePath, [
                '--no-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--disable-background-networking',
                `--remote-debugging-port=${CDP_PORT}`,
                '--remote-debugging-address=127.0.0.1',
                '--window-size=1280,720',
                '--no-first-run',
                `--user-data-dir=${join(homedir(), '.chromium-agent')}`,
            ], {
                env: { ...process.env, DISPLAY },
                stdio: 'ignore',
                detached: true,
            });
            this.chromeProcess.unref();
            this.chromeProcess.on('exit', (code) => {
                logger.warn('BrowserManager: Chrome exited', { code });
                if (this.state.status === 'running') {
                    this.state.status = 'error';
                    this.state.error = `Chrome exited (code ${code})`;
                    this.emit('state-change', this.getState());
                }
            });
            // 5. Wait for CDP to become ready
            const ready = await this.waitForCDP(15000);
            if (!ready)
                throw new Error('Chrome CDP did not become ready within 15s');
            this.state.status = 'running';
            await this.updatePageInfo();
            logger.info('BrowserManager: started', { chromePath, cdpPort: CDP_PORT });
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
            // 1. Kill Chrome process
            if (this.chromeProcess && !this.chromeProcess.killed) {
                this.chromeProcess.kill('SIGTERM');
                this.chromeProcess = null;
            }
            // Also kill by port in case detached
            try {
                await execFileAsync('fuser', ['-k', `${CDP_PORT}/tcp`], { timeout: 3000 });
            }
            catch { /* ignore */ }
            // 2. Stop display stack
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
    // ── agent-browser CLI wrapper (connects to Chrome via --cdp 9222) ──
    /** Execute an agent-browser command connected to CDP port 9222 */
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
        if (this.state.lockOwner === 'human' && sinceHuman >= HUMAN_IDLE_MS) {
            this.state.lockOwner = 'agent';
            this.emit('state-change', this.getState());
        }
    }
    // ── Internal ───────────────────────────────────────────────────────
    /** Wait for Chrome CDP to respond on port 9222 */
    async waitForCDP(timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            try {
                const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
                if (res.ok)
                    return true;
            }
            catch { /* not ready yet */ }
            await new Promise(r => setTimeout(r, 500));
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
