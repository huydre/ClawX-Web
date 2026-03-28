/**
 * System Monitor Store
 * Tracks real-time system metrics received via WebSocket
 */
import { create } from 'zustand';

export interface SystemMetrics {
  cpu: { usage: number; cores: number; model: string; speed: number; temp: number | null };
  memory: { total: number; used: number; free: number; usagePercent: number; swapTotal: number; swapUsed: number };
  disk: Array<{ fs: string; mount: string; type: string; size: number; used: number; available: number; usagePercent: number }>;
  network: { rxSec: number; txSec: number; rxTotal: number; txTotal: number; interface: string };
  os: { platform: string; distro: string; release: string; hostname: string; arch: string; uptime: number };
  gpu: Array<{ model: string; vendor: string; vram: number; temp: number | null }>;
  containers: Array<{ id: string; name: string; image: string; state: string; cpuPercent: number; memUsage: number; memLimit: number; netIO: { rx: number; tx: number } }>;
  timestamp: number;
}

interface SystemMonitorState {
  metrics: SystemMetrics | null;
  cpuHistory: number[];        // last 20 CPU usage values for sparkline
  networkHistory: Array<{ rx: number; tx: number }>;  // last 20 for sparkline
  setMetrics: (m: SystemMetrics) => void;
}

const MAX_HISTORY = 20;

export const useSystemMonitorStore = create<SystemMonitorState>((set) => ({
  metrics: null,
  cpuHistory: [],
  networkHistory: [],
  setMetrics: (m) =>
    set((state) => ({
      metrics: m,
      cpuHistory: [...state.cpuHistory.slice(-(MAX_HISTORY - 1)), m.cpu.usage],
      networkHistory: [
        ...state.networkHistory.slice(-(MAX_HISTORY - 1)),
        { rx: m.network.rxSec, tx: m.network.txSec },
      ],
    })),
}));
