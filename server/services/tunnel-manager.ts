import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger.js';
import { cloudflaredBinaryManager } from './cloudflared-binary-manager.js';
import { saveCloudflareSettings } from './storage.js';

// Types
export type TunnelState = 'stopped' | 'starting' | 'connected' | 'error';
export type TunnelMode = 'quick' | 'named';

export interface TunnelConfig {
  mode: TunnelMode;
  token?: string; // For named tunnels
  localUrl?: string; // Default: http://localhost:2003
}

export interface TunnelStatus {
  state: TunnelState;
  mode?: TunnelMode;
  publicUrl?: string;
  uptime?: number;
  connections: number;
  error?: string;
}

interface ReconnectState {
  attempts: number;
  maxAttempts: number;
  delays: number[];
  timer: NodeJS.Timeout | null;
}

class TunnelManager extends EventEmitter {
  private state: TunnelState = 'stopped';
  private process: ChildProcess | null = null;
  private config: TunnelConfig | null = null;
  private publicUrl: string | null = null;
  private connections: number = 0;
  private startTime: number | null = null;
  private errorMessage: string | null = null;
  private reconnectState: ReconnectState = {
    attempts: 0,
    maxAttempts: 5,
    delays: [5000, 15000, 30000, 60000, 120000], // 5s, 15s, 30s, 60s, 120s
    timer: null,
  };

  constructor() {
    super();
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Start the tunnel with the given configuration
   */
  async start(config: TunnelConfig): Promise<void> {
    if (this.state === 'starting' || this.state === 'connected') {
      logger.warn('Tunnel already starting or connected');
      throw new Error('Tunnel already running');
    }

    // Validate configuration
    if (config.mode === 'named' && !config.token) {
      throw new Error('Token is required for named tunnel mode');
    }

    this.config = config;
    this.setState('starting');
    this.errorMessage = null;
    this.reconnectState.attempts = 0;

    try {
      await this.spawn();
    } catch (error) {
      logger.error('Failed to start tunnel', { error: (error as Error).message });
      this.errorMessage = (error as Error).message;
      this.setState('error');
      throw error;
    }
  }

  /**
   * Stop the tunnel gracefully
   */
  async stop(): Promise<void> {
    logger.info('Stopping tunnel');

    // Clear reconnect timer
    if (this.reconnectState.timer) {
      clearTimeout(this.reconnectState.timer);
      this.reconnectState.timer = null;
    }

    // Kill the process
    if (this.process) {
      try {
        this.process.kill('SIGTERM');

        // Wait for graceful shutdown, force kill after 5 seconds
        await new Promise<void>((resolve) => {
          const forceKillTimer = setTimeout(() => {
            if (this.process && !this.process.killed) {
              logger.warn('Force killing tunnel process');
              this.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          if (this.process) {
            this.process.once('exit', () => {
              clearTimeout(forceKillTimer);
              resolve();
            });
          } else {
            clearTimeout(forceKillTimer);
            resolve();
          }
        });
      } catch (error) {
        logger.error('Error stopping tunnel process', { error: (error as Error).message });
      }

      this.process = null;
    }

    // Reset state
    this.publicUrl = null;
    this.connections = 0;
    this.startTime = null;
    this.errorMessage = null;
    this.config = null;
    this.reconnectState.attempts = 0;

    this.setState('stopped');
    logger.info('Tunnel stopped');
  }

  /**
   * Restart the tunnel
   */
  async restart(): Promise<void> {
    logger.info('Restarting tunnel');

    const currentConfig = this.config;
    if (!currentConfig) {
      throw new Error('No configuration available for restart');
    }

    await this.stop();
    await this.start(currentConfig);
  }

  // ============================================================================
  // Status Methods
  // ============================================================================

  /**
   * Get the current state
   */
  getState(): TunnelState {
    return this.state;
  }

  /**
   * Check if tunnel is connected
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.process !== null && !this.process.killed;
  }

  /**
   * Get detailed status
   */
  getStatus(): TunnelStatus {
    const status: TunnelStatus = {
      state: this.state,
      mode: this.config?.mode,
      publicUrl: this.publicUrl || undefined,
      connections: this.connections,
      error: this.errorMessage || undefined,
    };

    if (this.startTime && this.state === 'connected') {
      status.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    }

    return status;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Spawn the cloudflared process
   */
  private async spawn(): Promise<void> {
    try {
      // Ensure binary is available
      const binaryPath = await cloudflaredBinaryManager.ensureBinary();

      if (!this.config) {
        throw new Error('No configuration available');
      }

      // Build command arguments
      const args: string[] = [];
      const localUrl = this.config.localUrl || 'http://localhost:2003';

      if (this.config.mode === 'quick') {
        // Quick tunnel mode: cloudflared tunnel --url http://localhost:2003
        args.push('tunnel', '--url', localUrl);
        logger.info('Starting quick tunnel', { localUrl });
      } else if (this.config.mode === 'named') {
        // Named tunnel mode: cloudflared tunnel run --token <token> --url <localUrl>
        if (!this.config.token) {
          throw new Error('Token is required for named tunnel');
        }
        args.push('tunnel', 'run', '--token', this.config.token, '--url', localUrl);
        logger.info('Starting named tunnel', { localUrl });
      }

      // Spawn the process
      logger.info('Spawning cloudflared process', { binaryPath, args: args.filter(a => a !== this.config?.token) });

      this.process = spawn(binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      // Handle stdout
      if (this.process.stdout) {
        this.process.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          this.parseOutput(output);
        });
      }

      // Handle stderr
      if (this.process.stderr) {
        this.process.stderr.on('data', (data: Buffer) => {
          const output = data.toString();
          this.parseOutput(output);
        });
      }

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        logger.warn('Cloudflared process exited', { code, signal });

        this.process = null;
        this.connections = 0;

        if (this.state !== 'stopped') {
          this.errorMessage = `Process exited with code ${code}`;
          this.setState('error');
          this.emit('disconnected', { code, signal });

          // Schedule reconnect
          this.scheduleReconnect();
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        logger.error('Cloudflared process error', { error: error.message });

        this.errorMessage = error.message;
        this.setState('error');
        this.emit('error', error);

        // Schedule reconnect
        this.scheduleReconnect();
      });

      logger.info('Cloudflared process spawned', { pid: this.process.pid });

    } catch (error) {
      logger.error('Failed to spawn cloudflared process', { error: (error as Error).message });
      this.errorMessage = (error as Error).message;
      this.setState('error');
      throw error;
    }
  }

  /**
   * Parse cloudflared output to extract information
   */
  private parseOutput(output: string): void {
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Log all output for debugging
      logger.debug('Cloudflared output', { line: trimmed });

      // Parse public URL from quick tunnel
      // Example: "Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):"
      // Example: "https://random-subdomain.trycloudflare.com"
      if (trimmed.includes('trycloudflare.com') || trimmed.includes('cfargotunnel.com')) {
        const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          const url = urlMatch[1];
          if (this.publicUrl !== url) {
            this.publicUrl = url;
            logger.info('Tunnel public URL detected', { url });
            this.emit('urlDetected', url);

            // Save to storage
            saveCloudflareSettings({
              enabled: true,
              domain: url
            }).catch(err => {
              logger.error('Failed to save public URL to storage', { error: err.message });
            });
          }
        }
      }

      // Detect connection registration
      // Example: "Registered tunnel connection"
      if (trimmed.includes('Registered tunnel connection') ||
          trimmed.includes('Connection registered')) {
        this.connections++;
        logger.info('Tunnel connection registered', {
          connections: this.connections,
          maxConnections: 4
        });

        // Cloudflare tunnels typically establish 4 connections for redundancy
        if (this.connections >= 4 && this.state !== 'connected') {
          this.startTime = Date.now();
          this.setState('connected');
          this.reconnectState.attempts = 0; // Reset reconnect attempts on successful connection
          this.emit('connected', {
            publicUrl: this.publicUrl,
            connections: this.connections,
          });
          logger.info('Tunnel fully connected', {
            publicUrl: this.publicUrl,
            connections: this.connections
          });
        }
      }

      // Detect connection errors
      if (trimmed.includes('error') || trimmed.includes('failed') || trimmed.includes('ERR')) {
        // Only log errors, don't change state unless it's critical
        if (trimmed.toLowerCase().includes('fatal') ||
            trimmed.toLowerCase().includes('authentication failed') ||
            trimmed.toLowerCase().includes('invalid token')) {
          logger.error('Critical tunnel error detected', { line: trimmed });
          this.errorMessage = trimmed;
          if (this.state !== 'error') {
            this.setState('error');
            this.emit('error', new Error(trimmed));
          }
        } else {
          logger.warn('Tunnel warning', { line: trimmed });
        }
      }

      // Detect successful tunnel start (for quick tunnels)
      if (trimmed.includes('Tunnel started') ||
          trimmed.includes('Your quick Tunnel has been created')) {
        logger.info('Tunnel started successfully');
      }
    }
  }

  /**
   * Schedule a reconnect attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectState.timer) {
      return; // Already scheduled
    }

    if (this.reconnectState.attempts >= this.reconnectState.maxAttempts) {
      logger.error('Max reconnect attempts reached', {
        attempts: this.reconnectState.attempts,
        maxAttempts: this.reconnectState.maxAttempts,
      });
      this.errorMessage = `Failed to reconnect after ${this.reconnectState.maxAttempts} attempts`;
      this.setState('error');
      return;
    }

    const delayIndex = Math.min(this.reconnectState.attempts, this.reconnectState.delays.length - 1);
    const delay = this.reconnectState.delays[delayIndex];

    logger.info('Scheduling tunnel reconnect', {
      attempt: this.reconnectState.attempts + 1,
      maxAttempts: this.reconnectState.maxAttempts,
      delay,
    });

    this.reconnectState.timer = setTimeout(async () => {
      this.reconnectState.timer = null;
      this.reconnectState.attempts++;

      if (!this.config) {
        logger.error('No configuration available for reconnect');
        return;
      }

      logger.info('Attempting to reconnect tunnel', {
        attempt: this.reconnectState.attempts,
        maxAttempts: this.reconnectState.maxAttempts,
      });

      try {
        this.setState('starting');
        await this.spawn();
      } catch (error) {
        logger.error('Reconnect attempt failed', {
          attempt: this.reconnectState.attempts,
          error: (error as Error).message,
        });
        this.errorMessage = (error as Error).message;
        this.setState('error');

        // Schedule next reconnect
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Set the tunnel state and emit events
   */
  private setState(state: TunnelState): void {
    if (this.state !== state) {
      const oldState = this.state;
      this.state = state;

      logger.info('Tunnel state changed', { from: oldState, to: state });
      this.emit('stateChange', state, oldState);

      // Emit specific state events
      if (state === 'connected') {
        this.emit('connected', this.getStatus());
      } else if (state === 'error') {
        this.emit('error', new Error(this.errorMessage || 'Unknown error'));
      } else if (state === 'stopped') {
        this.emit('disconnected');
      }
    }
  }
}

// Singleton instance
export const tunnelManager = new TunnelManager();
