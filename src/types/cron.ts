/**
 * Cron Job Type Definitions
 * Types for scheduled tasks
 */

import { ChannelType } from './channel';

export interface CronJobTarget {
  channelType: ChannelType;
  channelId: string;
  channelName: string;
}

export interface CronJobLastRun {
  time: string;
  success: boolean;
  error?: string;
  duration?: number;
}

/** Gateway CronSchedule object format */
export type CronSchedule =
  | { kind: 'at'; at: string }
  | { kind: 'every'; everyMs: number; anchorMs?: number }
  | { kind: 'cron'; expr: string; tz?: string };

/** Session target: isolated (default), main, or custom named session */
export type SessionTarget = 'isolated' | 'main' | (string & {});

/** Schedule mode toggle for UI */
export type ScheduleMode = 'recurring' | 'one-time';

/** Cron job run history entry */
export interface CronJobRun {
  id: string;
  jobId: string;
  startedAt: string;
  completedAt?: string;
  status: 'success' | 'failed' | 'running' | 'retrying';
  error?: string;
  duration?: number;
  retryCount?: number;
}

export interface CronJob {
  id: string;
  name: string;
  message: string;
  schedule: string | CronSchedule;
  target: CronJobTarget;
  enabled: boolean;
  agentId?: string;
  sessionTarget?: SessionTarget;
  createdAt: string;
  updatedAt: string;
  lastRun?: CronJobLastRun;
  nextRun?: string;
}

export interface CronJobCreateInput {
  name: string;
  message: string;
  schedule: string | CronSchedule;
  target: CronJobTarget;
  agentId?: string;
  sessionTarget?: SessionTarget;
  enabled?: boolean;
}

export interface CronJobUpdateInput {
  name?: string;
  message?: string;
  schedule?: string | CronSchedule;
  target?: CronJobTarget;
  agentId?: string;
  sessionTarget?: SessionTarget;
  enabled?: boolean;
}

/** Schedule type for UI picker */
export type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'interval' | 'custom';
