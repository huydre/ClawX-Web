/**
 * Claw3D Manager
 * Clones, configures, and runs the Claw3D 3D visualization app.
 * Repo: https://github.com/iamlukethedev/Claw3D
 * Install dir: ~/.clawx/claw3d/
 */
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';
const REPO_URL = 'https://github.com/iamlukethedev/Claw3D.git';
const INSTALL_DIR = join(homedir(), '.clawx', 'claw3d');
const DEFAULT_PORT = 3333;
function generateEnv(gatewayPort) {
    return [
        `NEXT_PUBLIC_GATEWAY_URL=ws://localhost:${gatewayPort}`,
        'DEBUG=true',
        `PORT=${DEFAULT_PORT}`,
        'HOST=127.0.0.1',
    ].join('\n');
}
class Claw3dManager extends EventEmitter {
    process = null;
    state = 'stopped';
    error = null;
    port = DEFAULT_PORT;
    setState(state, error) {
        this.state = state;
        this.error = error ?? null;
        this.emit('stateChange', state);
        logger.info('Claw3D state changed', { state, error });
    }
    isInstalled() {
        return existsSync(join(INSTALL_DIR, 'package.json'));
    }
    isRunning() {
        return this.state === 'running';
    }
    getStatus() {
        return {
            state: this.state,
            port: this.port,
            url: this.state === 'running' ? `http://localhost:${this.port}` : null,
            error: this.error,
            installed: this.isInstalled(),
        };
    }
    async setup(gatewayPort = 18789) {
        if (this.state === 'cloning' || this.state === 'installing') {
            throw new Error('Setup already in progress');
        }
        try {
            // Clone if not installed
            if (!this.isInstalled()) {
                this.setState('cloning');
                await this.runCommand('git', ['clone', '--depth', '1', REPO_URL, INSTALL_DIR]);
            }
            // Write .env
            const envPath = join(INSTALL_DIR, '.env');
            writeFileSync(envPath, generateEnv(gatewayPort), 'utf-8');
            logger.info('Claw3D .env written', { envPath });
            // Install dependencies
            this.setState('installing');
            const pm = existsSync(join(INSTALL_DIR, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm';
            await this.runCommand(pm, ['install'], INSTALL_DIR);
            this.setState('stopped');
            logger.info('Claw3D setup complete');
        }
        catch (err) {
            this.setState('error', String(err));
            throw err;
        }
    }
    async start(gatewayPort = 18789) {
        if (this.state === 'running')
            return;
        try {
            // Auto-setup if not installed
            if (!this.isInstalled()) {
                await this.setup(gatewayPort);
            }
            else {
                // Update .env with current gateway port
                writeFileSync(join(INSTALL_DIR, '.env'), generateEnv(gatewayPort), 'utf-8');
            }
            this.setState('starting');
            const pm = existsSync(join(INSTALL_DIR, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm';
            this.process = spawn(pm, ['run', 'dev'], {
                cwd: INSTALL_DIR,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env, PORT: String(this.port) },
                shell: true,
                detached: false,
            });
            this.process.stdout?.on('data', (data) => {
                const output = data.toString();
                logger.debug('Claw3D stdout', { output: output.trim() });
                // Detect ready state from Next.js or Vite output
                if (output.includes('Ready on') ||
                    output.includes('ready in') ||
                    output.includes('started server') ||
                    output.includes(`localhost:${this.port}`) ||
                    output.includes('Local:')) {
                    if (this.state !== 'running') {
                        this.setState('running');
                    }
                }
            });
            this.process.stderr?.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    logger.debug('Claw3D stderr', { output });
                }
            });
            this.process.on('exit', (code) => {
                logger.info('Claw3D process exited', { code });
                this.process = null;
                if (this.state !== 'stopped') {
                    this.setState('error', `Process exited with code ${code}`);
                }
            });
            this.process.on('error', (err) => {
                logger.error('Claw3D process error', { error: err.message });
                this.process = null;
                this.setState('error', err.message);
            });
            // Timeout: if not running after 60s, mark as error
            setTimeout(() => {
                if (this.state === 'starting') {
                    this.setState('running'); // Assume running if no crash after 60s
                }
            }, 60000);
        }
        catch (err) {
            this.setState('error', String(err));
            throw err;
        }
    }
    async stop() {
        if (!this.process) {
            this.setState('stopped');
            return;
        }
        this.process.kill('SIGTERM');
        await new Promise((resolve) => {
            const forceKill = setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
                resolve();
            }, 5000);
            if (this.process) {
                this.process.once('exit', () => {
                    clearTimeout(forceKill);
                    resolve();
                });
            }
            else {
                clearTimeout(forceKill);
                resolve();
            }
        });
        this.process = null;
        this.setState('stopped');
    }
    async restart(gatewayPort = 18789) {
        await this.stop();
        await this.start(gatewayPort);
    }
    runCommand(cmd, args, cwd) {
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, args, {
                cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true,
            });
            let stderr = '';
            child.stdout?.on('data', (d) => {
                logger.debug(`Claw3D [${cmd}] stdout`, { line: d.toString().trim() });
            });
            child.stderr?.on('data', (d) => {
                stderr += d.toString();
                logger.debug(`Claw3D [${cmd}] stderr`, { line: d.toString().trim() });
            });
            child.on('close', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}: ${stderr.slice(-200)}`));
            });
            child.on('error', (err) => reject(err));
        });
    }
}
export const claw3dManager = new Claw3dManager();
