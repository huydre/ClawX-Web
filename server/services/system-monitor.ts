/**
 * System Monitor Service
 * Collects CPU, RAM, disk, network, temperature, and Docker container metrics
 * using the `systeminformation` package.
 */
import si from 'systeminformation';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface SystemMetrics {
  cpu: {
    usage: number;          // overall %
    cores: number;
    model: string;
    speed: number;          // GHz
    temp: number | null;    // celsius
  };
  memory: {
    total: number;          // bytes
    used: number;
    free: number;
    usagePercent: number;
    swapTotal: number;
    swapUsed: number;
  };
  disk: Array<{
    fs: string;
    mount: string;
    type: string;
    size: number;           // bytes
    used: number;
    available: number;
    usagePercent: number;
  }>;
  network: {
    rxSec: number;          // bytes/sec
    txSec: number;
    rxTotal: number;
    txTotal: number;
    interface: string;
  };
  os: {
    platform: string;
    distro: string;
    release: string;
    hostname: string;
    arch: string;
    uptime: number;         // seconds
  };
  gpu: Array<{
    model: string;
    vendor: string;
    vram: number;           // MB
    temp: number | null;
  }>;
  containers: Array<{
    id: string;
    name: string;
    image: string;
    state: string;
    cpuPercent: number;
    memUsage: number;       // bytes
    memLimit: number;
    netIO: { rx: number; tx: number };
  }>;
  timestamp: number;
}

class SystemMonitor extends EventEmitter {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private cachedMetrics: SystemMetrics | null = null;
  private cachedStatic: Pick<SystemMetrics, 'cpu' | 'os' | 'gpu'> | null = null;
  private collecting = false;

  /** Collect all metrics once */
  async collect(): Promise<SystemMetrics> {
    if (this.collecting) {
      return this.cachedMetrics ?? this.emptyMetrics();
    }
    this.collecting = true;

    try {
      // Static info (CPU model, OS, GPU) — cache after first call
      if (!this.cachedStatic) {
        const [cpuInfo, osInfo, graphics] = await Promise.all([
          si.cpu(),
          si.osInfo(),
          si.graphics().catch(() => ({ controllers: [] })),
        ]);

        this.cachedStatic = {
          cpu: {
            usage: 0,
            cores: cpuInfo.cores,
            model: cpuInfo.brand,
            speed: cpuInfo.speed,
            temp: null,
          },
          os: {
            platform: osInfo.platform,
            distro: osInfo.distro,
            release: osInfo.release,
            hostname: osInfo.hostname,
            arch: osInfo.arch,
            uptime: 0,
          },
          gpu: (graphics.controllers || []).map((g: any) => ({
            model: g.model || 'Unknown',
            vendor: g.vendor || '',
            vram: g.vram || 0,
            temp: g.temperatureGpu ?? null,
          })),
        };
      }

      // Dynamic metrics — collected every tick
      const [
        cpuLoad,
        cpuTemp,
        mem,
        disks,
        netStats,
        uptime,
        dockerContainers,
        gpuInfo,
      ] = await Promise.all([
        si.currentLoad(),
        si.cpuTemperature().catch(() => ({ main: null })),
        si.mem(),
        si.fsSize(),
        si.networkStats().catch(() => []),
        si.time(),
        si.dockerContainerStats('*').catch(() => []),
        si.graphics().catch(() => ({ controllers: [] })),
      ]);

      // Pick primary network interface (highest rx)
      const primaryNet = Array.isArray(netStats) && netStats.length > 0
        ? netStats.reduce((best, n) => (n.rx_sec ?? 0) > (best.rx_sec ?? 0) ? n : best, netStats[0])
        : { rx_sec: 0, tx_sec: 0, rx_bytes: 0, tx_bytes: 0, iface: 'none' };

      const metrics: SystemMetrics = {
        cpu: {
          ...this.cachedStatic.cpu,
          usage: Math.round(cpuLoad.currentLoad * 10) / 10,
          temp: cpuTemp.main ?? null,
        },
        memory: {
          total: mem.total,
          used: mem.used,
          free: mem.free,
          usagePercent: Math.round((mem.used / mem.total) * 1000) / 10,
          swapTotal: mem.swaptotal,
          swapUsed: mem.swapused,
        },
        disk: disks
          .filter((d: any) => d.size > 0)
          .map((d: any) => ({
            fs: d.fs,
            mount: d.mount,
            type: d.type,
            size: d.size,
            used: d.used,
            available: d.available,
            usagePercent: Math.round(d.use * 10) / 10,
          })),
        network: {
          rxSec: primaryNet.rx_sec ?? 0,
          txSec: primaryNet.tx_sec ?? 0,
          rxTotal: primaryNet.rx_bytes ?? 0,
          txTotal: primaryNet.tx_bytes ?? 0,
          interface: primaryNet.iface ?? 'none',
        },
        os: {
          ...this.cachedStatic.os,
          uptime: typeof uptime === 'object' ? uptime.uptime : Number(uptime) || 0,
        },
        gpu: (gpuInfo.controllers || []).map((g: any) => ({
          model: g.model || 'Unknown',
          vendor: g.vendor || '',
          vram: g.vram || 0,
          temp: g.temperatureGpu ?? null,
        })),
        containers: Array.isArray(dockerContainers)
          ? dockerContainers.map((c: any) => ({
              id: (c.id || '').substring(0, 12),
              name: c.name || '',
              image: c.image || '',
              state: c.state || 'unknown',
              cpuPercent: Math.round((c.cpuPercent ?? 0) * 10) / 10,
              memUsage: c.memUsage ?? 0,
              memLimit: c.memLimit ?? 0,
              netIO: { rx: c.netIO?.rx ?? 0, tx: c.netIO?.tx ?? 0 },
            }))
          : [],
        timestamp: Date.now(),
      };

      this.cachedMetrics = metrics;
      return metrics;
    } catch (err) {
      logger.error('System monitor collection error', { error: String(err) });
      return this.cachedMetrics ?? this.emptyMetrics();
    } finally {
      this.collecting = false;
    }
  }

  /** Start periodic collection and emit 'metrics' events */
  start(intervalMs = 5000) {
    if (this.intervalId) return;

    logger.info(`System monitor started (interval: ${intervalMs}ms)`);

    // Initial collect
    this.collect().then((m) => this.emit('metrics', m)).catch(() => {});

    this.intervalId = setInterval(async () => {
      const metrics = await this.collect();
      this.emit('metrics', metrics);
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('System monitor stopped');
    }
  }

  getCached(): SystemMetrics | null {
    return this.cachedMetrics;
  }

  private emptyMetrics(): SystemMetrics {
    return {
      cpu: { usage: 0, cores: 0, model: '', speed: 0, temp: null },
      memory: { total: 0, used: 0, free: 0, usagePercent: 0, swapTotal: 0, swapUsed: 0 },
      disk: [],
      network: { rxSec: 0, txSec: 0, rxTotal: 0, txTotal: 0, interface: 'none' },
      os: { platform: '', distro: '', release: '', hostname: '', arch: '', uptime: 0 },
      gpu: [],
      containers: [],
      timestamp: Date.now(),
    };
  }
}

export const systemMonitor = new SystemMonitor();
