/**
 * Update Checker Service
 * Polls GitHub API every 6 hours to detect new versions.
 * Compares remote commit SHA with local git HEAD.
 */
import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';

const GITHUB_REPO = 'huydre/ClawX-Web';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface VersionInfo {
  localSha: string;
  localShort: string;
  remoteSha: string;
  remoteShort: string;
  remoteMessage: string;
  remoteAuthor: string;
  remoteDate: string;
  updateAvailable: boolean;
  checkedAt: number | null;
}

class UpdateChecker extends EventEmitter {
  private cache: VersionInfo | null = null;
  private timer: NodeJS.Timeout | null = null;

  getLocalSha(): string {
    try {
      return execSync('git rev-parse HEAD', { cwd: process.cwd(), encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  async fetchRemote(): Promise<{ sha: string; message: string; author: string; date: string }> {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ClawX-Web-Updater' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json() as any;
    return {
      sha: data.sha,
      message: data.commit?.message?.split('\n')[0] ?? '',
      author: data.commit?.author?.name ?? '',
      date: data.commit?.author?.date ?? '',
    };
  }

  async check(): Promise<VersionInfo> {
    const localSha = this.getLocalSha();
    let remoteSha = localSha;
    let remoteMessage = '';
    let remoteAuthor = '';
    let remoteDate = '';

    try {
      const remote = await this.fetchRemote();
      remoteSha = remote.sha;
      remoteMessage = remote.message;
      remoteAuthor = remote.author;
      remoteDate = remote.date;
    } catch (err) {
      logger.warn('Update check failed (GitHub API)', { error: String(err) });
    }

    const info: VersionInfo = {
      localSha,
      localShort: localSha.slice(0, 7),
      remoteSha,
      remoteShort: remoteSha.slice(0, 7),
      remoteMessage,
      remoteAuthor,
      remoteDate,
      updateAvailable: localSha !== 'unknown' && remoteSha !== localSha,
      checkedAt: Date.now(),
    };

    this.cache = info;
    logger.info('Update check complete', {
      local: info.localShort,
      remote: info.remoteShort,
      updateAvailable: info.updateAvailable,
    });

    this.emit('checked', info);
    if (info.updateAvailable) {
      this.emit('updateAvailable', info);
    }

    return info;
  }

  getCached(): VersionInfo | null {
    return this.cache;
  }

  start() {
    // Initial check after 5 seconds (let server fully start)
    setTimeout(() => this.check().catch(() => {}), 5_000);

    // Periodic check every 6 hours
    this.timer = setInterval(() => this.check().catch(() => {}), CHECK_INTERVAL_MS);
    logger.info('Update checker started', { intervalHours: 6 });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const updateChecker = new UpdateChecker();
