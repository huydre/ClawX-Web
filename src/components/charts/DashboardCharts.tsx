/**
 * Dashboard Chart Components
 * Area chart, activity heatmap, and tool usage bar chart for the dashboard.
 */
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/common/Skeleton';

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-muted-foreground" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  1. MessageAreaChart                                                       */
/* -------------------------------------------------------------------------- */

export interface MessageAreaChartProps {
  data: Array<{ date: string; sent: number; received: number }>;
  loading?: boolean;
}

export function MessageAreaChart({ data, loading }: MessageAreaChartProps) {
  const { t } = useTranslation();

  if (loading) {
    return <Skeleton className="w-full" height={160} />;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
        <Bar
          dataKey="sent"
          name={t('charts.sent', 'Sent')}
          fill="hsl(var(--foreground))"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="received"
          name={t('charts.received', 'Received')}
          fill="hsl(var(--primary))"
          fillOpacity={0.7}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------------------- */
/*  2. ActivityHeatmap                                                        */
/* -------------------------------------------------------------------------- */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const HOURS = [8, 10, 12, 14, 16, 18, 20, 22] as const;

export interface ActivityHeatmapProps {
  /** Keys are "dayOfWeek-hour", e.g. "1-14". dayOfWeek 1=Mon, 7=Sun. */
  data: Record<string, number>;
  loading?: boolean;
}

export function ActivityHeatmap({ data, loading }: ActivityHeatmapProps) {
  const maxCount = useMemo(() => {
    const values = Object.values(data);
    return values.length > 0 ? Math.max(...values) : 1;
  }, [data]);

  if (loading) {
    return <Skeleton className="w-full" height={160} />;
  }

  function intensityClass(count: number): string {
    if (count === 0 || maxCount === 0) return 'bg-muted/40';
    const ratio = count / maxCount;
    if (ratio < 0.2) return 'bg-primary/15';
    if (ratio < 0.4) return 'bg-primary/30';
    if (ratio < 0.6) return 'bg-primary/50';
    if (ratio < 0.8) return 'bg-primary/70';
    return 'bg-primary/90';
  }

  return (
    <div className="w-full space-y-2">
      {/* Grid */}
      <div className="grid gap-1" style={{ gridTemplateColumns: `1.8rem repeat(7, 1fr)` }}>
        {/* Header: empty + day labels */}
        <div />
        {DAYS.map((day) => (
          <div key={day} className="text-center text-[10px] text-muted-foreground/70 font-medium pb-0.5">
            {day}
          </div>
        ))}

        {/* Rows */}
        {HOURS.map((hour) => (
          <div key={`row-${hour}`} className="contents">
            <div className="text-[10px] text-muted-foreground/50 flex items-center justify-end pr-1.5 tabular-nums">
              {hour}
            </div>
            {DAYS.map((_, dayIdx) => {
              const key = `${dayIdx + 1}-${hour}`;
              const count = data[key] ?? 0;
              return (
                <div
                  key={key}
                  title={`${DAYS[dayIdx]} ${hour}:00 — ${count} events`}
                  className={cn(
                    'h-5 rounded-md transition-all duration-300 hover:scale-110 hover:ring-1 hover:ring-foreground/20 cursor-default',
                    intensityClass(count),
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 pt-0.5">
        <span className="text-[10px] text-muted-foreground/50">Less</span>
        <div className="h-2.5 w-2.5 rounded-sm bg-muted/40" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary/20" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary/40" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary/65" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary/90" />
        <span className="text-[10px] text-muted-foreground/50">More</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  3. ToolUsageBar                                                           */
/* -------------------------------------------------------------------------- */

export interface ToolUsageBarProps {
  data: Array<{ name: string; count: number }>;
  loading?: boolean;
}

export function ToolUsageBar({ data, loading }: ToolUsageBarProps) {
  const { t } = useTranslation();
  const sliced = useMemo(() => data.slice(0, 5), [data]);

  if (loading) {
    return <Skeleton className="w-full" height={200} />;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={sliced} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
        <XAxis
          type="number"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
        />
        <Bar
          dataKey="count"
          name={t('charts.usage', 'Usage')}
          fill="hsl(var(--primary))"
          fillOpacity={0.8}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
