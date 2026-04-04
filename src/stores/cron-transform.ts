/**
 * Cron Job Transform Helper
 * Transforms raw Gateway job objects to CronJob UI format
 */
import type { CronJob } from '../types/cron';

// Transform raw Gateway job object → CronJob UI format
export function transformGatewayJob(job: any): CronJob {
  const delivery = job.delivery || {};
  const state = job.state || {};
  const payload = job.payload || {};
  // agentTurn uses 'message', systemEvent uses 'text'
  const msg = payload.message || payload.text || '';
  return {
    id: job.id,
    name: job.name || 'Unnamed',
    message: msg,
    schedule: job.schedule,
    target: {
      channelType: delivery.channel || 'telegram',
      channelId: delivery.to || '',
      channelName: delivery.channel || 'telegram',
    },
    enabled: job.enabled ?? true,
    agentId: job.agentId || undefined,
    sessionTarget: job.sessionTarget || 'isolated',
    createdAt: job.createdAtMs ? new Date(job.createdAtMs).toISOString() : new Date().toISOString(),
    updatedAt: job.updatedAtMs ? new Date(job.updatedAtMs).toISOString() : new Date().toISOString(),
    lastRun: state.lastRunAtMs ? {
      time: new Date(state.lastRunAtMs).toISOString(),
      success: state.lastRunStatus === 'success',
      error: typeof state.lastError === 'string' ? state.lastError : undefined,
      duration: state.lastDurationMs,
    } : undefined,
    nextRun: state.nextRunAtMs ? new Date(state.nextRunAtMs).toISOString() : undefined,
  };
}
