import { EventEmitter } from 'events';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync, chmodSync, statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import { logger } from '../utils/logger.js';
const execAsync = promisify(exec);
class CloudflaredBinaryManager extends EventEmitter {
    state = 'not_installed';
    binaryPath;
    binDir;
    configDir;
    downloadRetries = 3;
    downloadTimeout = 300000; // 5 minutes
    constructor() {
        super();
        const baseDir = join(homedir(), '.clawx-web');
        this.binDir = join(baseDir, 'bin');
        this.configDir = join(baseDir, 'cloudflare');
        this.binaryPath = join(this.binDir, 'cloudflared');
        // Ensure directories exist
        mkdirSync(this.binDir, { recursive: true });
        mkdirSync(this.configDir, { recursive: true });
        // Check if binary already exists
        if (this.isBinaryInstalled()) {
            this.state = 'ready';
        }
    }
    getState() {
        return this.state;
    }
    getBinaryPath() {
        return this.binaryPath;
    }
    getDownloadUrl() {
        const platform = process.platform;
        const arch = process.arch;
        let binaryName = 'cloudflared';
        if (platform === 'darwin') {
            // macOS
            if (arch === 'arm64') {
                binaryName = 'cloudflared-darwin-arm64.tgz';
            }
            else {
                binaryName = 'cloudflared-darwin-amd64.tgz';
            }
        }
        else if (platform === 'linux') {
            // Linux
            if (arch === 'arm64') {
                binaryName = 'cloudflared-linux-arm64';
            }
            else if (arch === 'x64') {
                binaryName = 'cloudflared-linux-amd64';
            }
            else {
                throw new Error(`Unsupported Linux architecture: ${arch}`);
            }
        }
        else if (platform === 'win32') {
            // Windows
            binaryName = 'cloudflared-windows-amd64.exe';
        }
        else {
            throw new Error(`Unsupported platform: ${platform}`);
        }
        return `https://github.com/cloudflare/cloudflared/releases/latest/download/${binaryName}`;
    }
    getConfigDir() {
        return this.configDir;
    }
    isReady() {
        return this.state === 'ready' && this.isBinaryInstalled();
    }
    isBinaryInstalled() {
        try {
            return existsSync(this.binaryPath) && statSync(this.binaryPath).isFile();
        }
        catch {
            return false;
        }
    }
    async ensureBinary() {
        if (this.isReady()) {
            logger.info('Cloudflared binary already installed', { path: this.binaryPath });
            return this.binaryPath;
        }
        if (this.state === 'downloading') {
            logger.warn('Binary download already in progress');
            throw new Error('Binary download already in progress');
        }
        await this.downloadBinary();
        await this.verifyBinary();
        return this.binaryPath;
    }
    async downloadBinary() {
        this.setState('downloading');
        const downloadUrl = this.getDownloadUrl();
        let lastError = null;
        for (let attempt = 1; attempt <= this.downloadRetries; attempt++) {
            try {
                logger.info('Downloading cloudflared binary', {
                    attempt,
                    maxRetries: this.downloadRetries,
                    url: downloadUrl
                });
                await this.performDownload(downloadUrl);
                // Make binary executable
                chmodSync(this.binaryPath, 0o755);
                logger.info('Binary downloaded and made executable', { path: this.binaryPath });
                this.setState('ready');
                return;
            }
            catch (error) {
                lastError = error;
                logger.error('Failed to download cloudflared binary', {
                    attempt,
                    maxRetries: this.downloadRetries,
                    error: lastError.message
                });
                if (attempt < this.downloadRetries) {
                    const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
                    logger.info('Retrying download', { delay });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        this.setState('error');
        throw new Error(`Failed to download cloudflared binary after ${this.downloadRetries} attempts: ${lastError?.message}`);
    }
    async performDownload(url) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Download timeout'));
            }, this.downloadTimeout);
            (async () => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        clearTimeout(timeout);
                        reject(new Error(`Download failed: ${response.status} ${response.statusText}`));
                        return;
                    }
                    // Check if it's a tar.gz file (macOS binaries)
                    const isTarGz = url.includes('.tgz') || url.includes('.tar.gz');
                    if (isTarGz) {
                        // For macOS: download tar.gz and extract
                        const tar = await import('tar');
                        const { pipeline } = await import('stream/promises');
                        const { Readable } = await import('stream');
                        const { createWriteStream, unlinkSync } = await import('fs');
                        const { join } = await import('path');
                        const tarPath = join(this.binDir, 'cloudflared.tgz');
                        const fileStream = createWriteStream(tarPath);
                        await pipeline(Readable.fromWeb(response.body), fileStream);
                        // Extract tar.gz
                        await tar.x({
                            file: tarPath,
                            cwd: this.binDir,
                        });
                        // Remove tar file
                        unlinkSync(tarPath);
                        // Make binary executable
                        chmodSync(this.binaryPath, 0o755);
                    }
                    else {
                        // For Linux/Windows: direct binary download
                        const { pipeline } = await import('stream/promises');
                        const { Readable } = await import('stream');
                        const fileStream = createWriteStream(this.binaryPath);
                        await pipeline(Readable.fromWeb(response.body), fileStream);
                        // Make binary executable (Linux/macOS only)
                        if (process.platform !== 'win32') {
                            chmodSync(this.binaryPath, 0o755);
                        }
                    }
                    clearTimeout(timeout);
                    logger.info('Binary download completed', { path: this.binaryPath });
                    resolve();
                }
                catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            })();
        });
    }
    async verifyBinary() {
        try {
            // Check if file exists and has reasonable size (> 10MB)
            const stats = statSync(this.binaryPath);
            const minSize = 10 * 1024 * 1024; // 10MB
            if (stats.size < minSize) {
                logger.error('Binary file too small', { size: stats.size, minSize });
                return false;
            }
            // Verify by running version command
            const version = await this.getBinaryVersion();
            logger.info('Binary verification successful', { version, size: stats.size });
            return true;
        }
        catch (error) {
            logger.error('Binary verification failed', { error });
            return false;
        }
    }
    async getBinaryVersion() {
        if (!this.isBinaryInstalled()) {
            throw new Error('Binary not installed');
        }
        try {
            const { stdout } = await execAsync(`"${this.binaryPath}" --version`, {
                timeout: 10000
            });
            // Parse version from output (e.g., "cloudflared version 2024.1.5")
            const match = stdout.trim().match(/cloudflared version ([\d.]+)/);
            const version = match ? match[1] : stdout.trim();
            return version;
        }
        catch (error) {
            logger.error('Failed to get binary version', { error });
            throw new Error(`Failed to get binary version: ${error.message}`, { cause: error });
        }
    }
    setState(state) {
        if (this.state !== state) {
            const oldState = this.state;
            this.state = state;
            logger.info('Cloudflared binary manager state changed', { from: oldState, to: state });
            this.emit('stateChange', state, oldState);
        }
    }
}
// Singleton instance
export const cloudflaredBinaryManager = new CloudflaredBinaryManager();
