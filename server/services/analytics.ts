import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import crypto from 'crypto';

// Types
export interface AnalyticsEvent {
  id: string;
  type: 'message_sent' | 'message_received' | 'tool_call' | 'channel_activity' | 'session_created';
  timestamp: number;
  channel?: string;
  sessionKey?: string;
  metadata?: Record<string, unknown>;
}

interface DailyStat {
  sent: number;
  received: number;
  tools: number;
}

interface AnalyticsDB {
  events: AnalyticsEvent[];
  dailyStats: Record<string, DailyStat>;
  hourlyActivity: Record<string, number>;
}

const MAX_EVENTS = 10000;

// Default data
const defaultData: AnalyticsDB = {
  events: [],
  dailyStats: {},
  hourlyActivity: {},
};

// Database setup
const dataDir = join(homedir(), '.clawx');
const dbPath = join(dataDir, 'analytics.json');

mkdirSync(dataDir, { recursive: true });

const adapter = new JSONFile<AnalyticsDB>(dbPath);
const db = new Low(adapter, defaultData);

// Initialize
export async function initAnalytics() {
  await db.read();
  db.data ||= defaultData;
  await db.write();
}

// Helper: get YYYY-MM-DD key from timestamp
function getDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Helper: get "dayOfWeek-hour" key from timestamp
function getHourKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDay()}-${d.getHours()}`;
}

// Track an event
export async function trackEvent(
  event: Omit<AnalyticsEvent, 'id' | 'timestamp'>
): Promise<void> {
  await db.read();

  const fullEvent: AnalyticsEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };

  db.data!.events.push(fullEvent);

  // FIFO: keep max events
  if (db.data!.events.length > MAX_EVENTS) {
    db.data!.events = db.data!.events.slice(-MAX_EVENTS);
  }

  // Update daily stats
  const dayKey = getDayKey(fullEvent.timestamp);
  if (!db.data!.dailyStats[dayKey]) {
    db.data!.dailyStats[dayKey] = { sent: 0, received: 0, tools: 0 };
  }
  const dayStat = db.data!.dailyStats[dayKey];
  if (fullEvent.type === 'message_sent') dayStat.sent++;
  if (fullEvent.type === 'message_received') dayStat.received++;
  if (fullEvent.type === 'tool_call') dayStat.tools++;

  // Update hourly activity
  const hourKey = getHourKey(fullEvent.timestamp);
  db.data!.hourlyActivity[hourKey] = (db.data!.hourlyActivity[hourKey] || 0) + 1;

  await db.write();
}

// Get daily stats for last N days
export async function getDailyStats(
  days: number
): Promise<Record<string, DailyStat>> {
  await db.read();

  const result: Record<string, DailyStat> = {};
  const now = Date.now();

  for (let i = 0; i < days; i++) {
    const key = getDayKey(now - i * 86400000);
    result[key] = db.data!.dailyStats[key] || { sent: 0, received: 0, tools: 0 };
  }

  return result;
}

// Get hourly activity map
export async function getHourlyActivity(): Promise<Record<string, number>> {
  await db.read();
  return { ...db.data!.hourlyActivity };
}

// Get recent events
export async function getRecentEvents(limit: number): Promise<AnalyticsEvent[]> {
  await db.read();
  return db.data!.events.slice(-limit).reverse();
}

// Get total stats
export async function getTotalStats(): Promise<{
  totalSent: number;
  totalReceived: number;
  totalTools: number;
  totalSessions: number;
}> {
  await db.read();

  const stats = { totalSent: 0, totalReceived: 0, totalTools: 0, totalSessions: 0 };

  for (const day of Object.values(db.data!.dailyStats)) {
    stats.totalSent += day.sent;
    stats.totalReceived += day.received;
    stats.totalTools += day.tools;
  }

  stats.totalSessions = db.data!.events.filter(
    (e) => e.type === 'session_created'
  ).length;

  return stats;
}
