/**
 * Cron Schedule Helpers
 * Parsing utilities and schedule presets for cron UI
 */
import type { ScheduleType } from '@/types/cron';

export const schedulePresets: { label: string; i18nKey: string; value: string; type: ScheduleType }[] = [
  { label: 'Every minute', i18nKey: 'everyMinute', value: '* * * * *', type: 'interval' },
  { label: 'Every 5 minutes', i18nKey: 'every5Min', value: '*/5 * * * *', type: 'interval' },
  { label: 'Every 15 minutes', i18nKey: 'every15Min', value: '*/15 * * * *', type: 'interval' },
  { label: 'Every hour', i18nKey: 'everyHour', value: '0 * * * *', type: 'interval' },
  { label: 'Daily at 9am', i18nKey: 'daily9am', value: '0 9 * * *', type: 'daily' },
  { label: 'Daily at 6pm', i18nKey: 'daily6pm', value: '0 18 * * *', type: 'daily' },
  { label: 'Weekly (Mon 9am)', i18nKey: 'weeklyMon', value: '0 9 * * 1', type: 'weekly' },
  { label: 'Monthly (1st at 9am)', i18nKey: 'monthly1st', value: '0 9 1 * *', type: 'monthly' },
];

/** Parse a plain cron expression string to human-readable text */
export function parseCronExpr(cron: string): string {
  const preset = schedulePresets.find((p) => p.value === cron);
  if (preset) return preset.label;

  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  if (minute === '*' && hour === '*') return 'Every minute';
  if (minute.startsWith('*/')) return `Every ${minute.slice(2)} minutes`;
  if (hour === '*' && minute === '0') return 'Every hour';
  if (dayOfWeek !== '*' && dayOfMonth === '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayIdx = parseInt(dayOfWeek);
    const dayName = !isNaN(dayIdx) && days[dayIdx] ? days[dayIdx] : dayOfWeek;
    return `Weekly on ${dayName} at ${hour}:${minute.padStart(2, '0')}`;
  }
  if (dayOfMonth !== '*') {
    return `Monthly on day ${dayOfMonth} at ${hour}:${minute.padStart(2, '0')}`;
  }
  if (hour !== '*') {
    return `Daily at ${hour}:${minute.padStart(2, '0')}`;
  }

  return cron;
}

/**
 * Parse cron schedule to human-readable format.
 * Handles both plain cron strings and Gateway CronSchedule objects.
 */
export function parseCronSchedule(schedule: unknown): string {
  if (!schedule) return 'Unknown schedule';

  if (typeof schedule === 'object') {
    const s = schedule as Record<string, unknown>;
    if (typeof s.expr === 'string') {
      const label = parseCronExpr(s.expr);
      return s.tz && typeof s.tz === 'string' ? `${label} (${s.tz})` : label;
    }
    if (typeof s.everyMs === 'number') {
      const ms = s.everyMs;
      if (ms < 60_000) return `Every ${Math.round(ms / 1000)}s`;
      if (ms < 3_600_000) return `Every ${Math.round(ms / 60_000)} minutes`;
      if (ms < 86_400_000) return `Every ${Math.round(ms / 3_600_000)} hours`;
      return `Every ${Math.round(ms / 86_400_000)} days`;
    }
    if (typeof s.at === 'string') {
      try {
        return `Once at ${new Date(s.at).toLocaleString()}`;
      } catch {
        return `Once at ${s.at}`;
      }
    }
    return 'Unknown schedule';
  }

  if (typeof schedule === 'string') return parseCronExpr(schedule);
  return 'Unknown schedule';
}

/** Extract cron expression string from CronSchedule object or use as-is */
export function extractCronExpr(schedule: unknown): string {
  if (!schedule) return '0 9 * * *';
  if (typeof schedule === 'string') return schedule;
  if (typeof schedule === 'object') {
    const s = schedule as Record<string, unknown>;
    if (typeof s.expr === 'string') return s.expr;
  }
  return '0 9 * * *';
}
