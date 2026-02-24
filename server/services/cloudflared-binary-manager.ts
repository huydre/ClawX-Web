import { EventEmitter } from 'events';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync, chmodSync, statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

type BinaryState = 'not_installed' | 'downloading' | 'ready' | 'error';

interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

class CloudflaredBinaryManager extends EventEmitter {
  private state: BinaryState = 'not_installed';
  private binaryPath: string;
  private binDir: string;
  private configDir: string;
  private downloadRetries = 3;
  private downloadTimeout = 300000; // 5 minutes

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

  getState(): BinaryState {
    return this.state;
  }

  getBinaryPath(): string {
    return this.binaryPath;
  }

  getConfigDir(): string {
    return this.configDir;
  }

  isReady(): boolean {
    return this.state === 'ready' && this.isBinaryInstalled();
  }

  private isBinaryInstalled(): boolean {
    try {
      return existsSync(this.binaryPath) && statSync(this.binaryPath).isFile();
    } catch {
      return false;
    }
  }

  async ensureBinary(): Promise<string> {
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

  async downloadBinary(): Promise<void> {
    this.setState('downloading');

    const downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64';
    let lastError: Error | null = null;

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
      } catch (error) {
        lastError = error as Error;
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

  private async performDownload(url: string): Promise<void> {
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

          const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
          let downloadedSize = 0;

          const fileStream = createWriteStream(this.binaryPath);

          if (!response.body) {
            clearTimeout(timeout);
            reject(new Error('Response body is null'));
            return;
          }

          // Track download progress
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            chunks.push(value);
            downloadedSize += value.length;

            if (totalSize > 0) {
              const progress: DownloadProgress = {
                downloaded: downloadedSize,
                total: totalSize,
                percentage: Math.round((downloadedSize / totalSize) * 100)
              };
              this.emit('downloadProgress', progress);

              if (progress.percentage % 10 === 0) {
                logger.debug('Download progress', progress);
              }
            }
          }

          // Write all chunks to file
          for (const chunk of chunks) {
            fileStream.write(chunk);
          }

          fileStream.end();

          fileStream.on('finish', () => {
            clearTimeout(timeout);
            logger.info('Binary download completed', {
              size: downloadedSize,
              path: this.binaryPath
            });
            resolve();
          });

          fileStream.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });

        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      })();
    });
  }

  async verifyBinary(): Promise<boolean> {
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
    } catch (error) {
      logger.error('Binary verification failed', { error });
      return false;
    }
  }

  async getBinaryVersion(): Promise<string> {
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
    } catch (error) {
      logger.error('Failed to get binary version', { error });
      throw new Error(`Failed to get binary version: ${(error as Error).message}`, { cause: error });
    }
  }

  private setState(state: BinaryState): void {
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
