/**
 * System Monitoring Chart Components
 * CPU gauge, RAM/disk progress, network sparkline, temp display, container list
 */
import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { SystemMetrics } from '@/stores/system-monitor';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function usageColor(percent: number): string {
  if (percent < 50) return 'text-green-500';
  if (percent < 75) return 'text-yellow-500';
  if (percent < 90) return 'text-orange-500';
  return 'text-red-500';
}

function usageBarColor(percent: number): string {
  if (percent < 50) return 'bg-green-500';
  if (percent < 75) return 'bg-yellow-500';
  if (percent < 90) return 'bg-orange-500';
  return 'bg-red-500';
}

/* -------------------------------------------------------------------------- */
/*  1. CPU Ring Gauge                                                         */
/* -------------------------------------------------------------------------- */

export function CpuGauge({ usage, temp, model }: {
  usage: number;
  temp: number | null;
  model: string;
}) {
  const { t } = useTranslation('dashboard');
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (usage / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle
            cx="48" cy="48" r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
            opacity={0.3}
          />
          <circle
            cx="48" cy="48" r={radius}
            fill="none"
            stroke={usage < 50 ? 'hsl(142, 76%, 36%)' : usage < 75 ? 'hsl(48, 96%, 53%)' : usage < 90 ? 'hsl(25, 95%, 53%)' : 'hsl(0, 84%, 60%)'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-lg font-bold tabular-nums', usageColor(usage))}>
            {usage.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{model || 'CPU'}</p>
        {temp !== null && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('systemMonitor.temp', 'Temp')}: {temp}°C
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  2. Memory Bar                                                             */
/* -------------------------------------------------------------------------- */

export function MemoryBar({ memory }: { memory: SystemMetrics['memory'] }) {
  const { t } = useTranslation('dashboard');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('systemMonitor.ram', 'RAM')}</span>
        <span className={cn('text-sm font-bold tabular-nums', usageColor(memory.usagePercent))}>
          {memory.usagePercent.toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', usageBarColor(memory.usagePercent))}
          style={{ width: `${Math.min(memory.usagePercent, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{formatBytes(memory.used)} / {formatBytes(memory.total)}</span>
        <span>{formatBytes(memory.free)} {t('systemMonitor.free', 'free')}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  3. Disk Usage Bars                                                        */
/* -------------------------------------------------------------------------- */

export function DiskBars({ disks }: { disks: SystemMetrics['disk'] }) {
  const { t } = useTranslation('dashboard');

  // Show max 3 most-used partitions
  const sorted = useMemo(() =>
    [...disks].sort((a, b) => b.usagePercent - a.usagePercent).slice(0, 3),
    [disks],
  );

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium">{t('systemMonitor.disk', 'Disk')}</span>
      {sorted.map((d) => (
        <div key={d.mount} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground truncate max-w-[60%]" title={d.mount}>
              {d.mount}
            </span>
            <span className={cn('text-xs font-medium tabular-nums', usageColor(d.usagePercent))}>
              {d.usagePercent.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700 ease-out', usageBarColor(d.usagePercent))}
              style={{ width: `${Math.min(d.usagePercent, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            {formatBytes(d.used)} / {formatBytes(d.size)}
          </p>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  4. Network Sparkline                                                      */
/* -------------------------------------------------------------------------- */

export function NetworkSparkline({ history, current }: {
  history: Array<{ rx: number; tx: number }>;
  current: SystemMetrics['network'];
}) {
  const { t } = useTranslation('dashboard');

  const chartData = useMemo(() =>
    history.map((h, i) => ({ idx: i, rx: h.rx, tx: h.tx })),
    [history],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('systemMonitor.network', 'Network')}</span>
        <span className="text-[11px] text-muted-foreground">{current.interface}</span>
      </div>
      {chartData.length > 1 && (
        <ResponsiveContainer width="100%" height={48}>
          <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <YAxis hide domain={[0, 'auto']} />
            <Area
              type="monotone"
              dataKey="rx"
              stroke="hsl(142, 76%, 36%)"
              fill="hsl(142, 76%, 36%)"
              fillOpacity={0.15}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="tx"
              stroke="hsl(217, 91%, 60%)"
              fill="hsl(217, 91%, 60%)"
              fillOpacity={0.15}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
      <div className="flex justify-between text-[11px]">
        <span className="text-green-500">
          {t('systemMonitor.download', 'DL')}: {formatSpeed(current.rxSec)}
        </span>
        <span className="text-blue-500">
          {t('systemMonitor.upload', 'UL')}: {formatSpeed(current.txSec)}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  5. GPU Card                                                               */
/* -------------------------------------------------------------------------- */

export function GpuInfo({ gpus }: { gpus: SystemMetrics['gpu'] }) {
  const { t } = useTranslation('dashboard');

  if (gpus.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{t('systemMonitor.gpu', 'GPU')}</span>
      {gpus.map((g, i) => (
        <div key={i} className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[65%]" title={g.model}>
            {g.model}
          </span>
          <div className="flex items-center gap-2 text-xs">
            {g.vram > 0 && (
              <span className="text-muted-foreground">{g.vram} MB</span>
            )}
            {g.temp !== null && (
              <span className={cn(
                'font-medium tabular-nums',
                g.temp < 70 ? 'text-green-500' : g.temp < 85 ? 'text-yellow-500' : 'text-red-500',
              )}>
                {g.temp}°C
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  6. Docker Containers                                                      */
/* -------------------------------------------------------------------------- */

export function ContainerList({ containers }: { containers: SystemMetrics['containers'] }) {
  const { t } = useTranslation('dashboard');

  if (containers.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('systemMonitor.containers', 'Containers')}</span>
        <span className="text-[11px] text-muted-foreground">{containers.length} running</span>
      </div>
      <div className="space-y-1">
        {containers.slice(0, 6).map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={cn(
                'h-1.5 w-1.5 rounded-full shrink-0',
                c.state === 'running' ? 'bg-green-500' : 'bg-muted-foreground/30',
              )} />
              <span className="text-xs truncate" title={c.name}>{c.name}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums shrink-0">
              <span>{c.cpuPercent.toFixed(1)}%</span>
              <span>{formatBytes(c.memUsage)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  7. System Info Badge Row                                                  */
/* -------------------------------------------------------------------------- */

export function SystemInfoBadges({ os }: { os: SystemMetrics['os'] }) {
  const { t } = useTranslation('dashboard');

  const uptimeStr = useMemo(() => {
    const s = os.uptime;
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }, [os.uptime]);

  return (
    <div className="flex flex-wrap gap-1.5">
      <InfoBadge label={os.hostname} />
      <InfoBadge label={os.distro || os.platform} />
      <InfoBadge label={os.arch} />
      <InfoBadge label={`${t('systemMonitor.sysUptime', 'Up')} ${uptimeStr}`} />
    </div>
  );
}

function InfoBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  8. Power / Energy Estimate                                                */
/* -------------------------------------------------------------------------- */

/**
 * Estimates power consumption based on CPU usage and known TDP.
 * LIVA Q3 Plus (R1505G): TDP 15W, system idle ~8W, max ~25W
 * Formula: power = basePower + (tdp × cpuUsage/100 × loadFactor)
 */
const SYSTEM_BASE_POWER = 6;      // W — board + RAM + eMMC idle
const CPU_TDP = 15;               // W — R1505G TDP
const CPU_LOAD_FACTOR = 0.7;      // efficiency factor
const PRICE_PER_KWH = 3000;       // VNĐ/kWh — default 3k

function estimatePower(cpuUsage: number): number {
  return SYSTEM_BASE_POWER + CPU_TDP * (0.3 + CPU_LOAD_FACTOR * cpuUsage / 100);
}

export function PowerEstimate({ cpuUsage, uptimeSeconds }: {
  cpuUsage: number;
  uptimeSeconds: number;
}) {
  const { t } = useTranslation('dashboard');

  const currentPower = useMemo(() => estimatePower(cpuUsage), [cpuUsage]);

  // Estimate average power (assume avg CPU ~35% over uptime — conservative)
  const avgCpuEstimate = Math.max(cpuUsage * 0.8, 25); // rough average
  const avgPower = estimatePower(avgCpuEstimate);

  const uptimeHours = uptimeSeconds / 3600;
  const energyKwh = (avgPower * uptimeHours) / 1000;
  const costVnd = energyKwh * PRICE_PER_KWH;

  // Monthly projection
  const monthlyKwh = (avgPower * 720) / 1000; // 30 days
  const monthlyCost = monthlyKwh * PRICE_PER_KWH;

  const uptimeDays = Math.floor(uptimeSeconds / 86400);
  const uptimeHoursRem = Math.floor((uptimeSeconds % 86400) / 3600);

  return (
    <div className="space-y-3">
      {/* Current power */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('systemMonitor.currentPower', 'Current')}</span>
        <span className="text-sm font-bold tabular-nums">{currentPower.toFixed(1)}W</span>
      </div>

      {/* Energy consumed */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {t('systemMonitor.energyUsed', 'Energy used')} ({uptimeDays}d {uptimeHoursRem}h)
          </span>
          <span className="font-medium tabular-nums">{energyKwh.toFixed(2)} kWh</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t('systemMonitor.estimatedCost', 'Est. cost')}</span>
          <span className="font-medium tabular-nums">{Math.round(costVnd).toLocaleString()}đ</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Monthly projection */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('systemMonitor.monthlyProjection', 'Monthly est.')}</p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t('systemMonitor.energy', 'Energy')}</span>
          <span className="font-medium tabular-nums">{monthlyKwh.toFixed(1)} kWh</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t('systemMonitor.cost', 'Cost')}</span>
          <span className="font-bold tabular-nums text-primary">{Math.round(monthlyCost).toLocaleString()}đ</span>
        </div>
        <p className="text-[10px] text-muted-foreground/50">
          @{(PRICE_PER_KWH).toLocaleString()}đ/kWh · ~{avgPower.toFixed(0)}W avg
        </p>
      </div>
    </div>
  );
}
