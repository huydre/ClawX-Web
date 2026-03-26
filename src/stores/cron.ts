/**
 * Cron State Store
 * Manages scheduled task state
 */
import { create } from 'zustand';
import type { CronJob, CronJobCreateInput, CronJobUpdateInput } from '../types/cron';
import { platform } from '@/lib/platform';
import { api } from '@/lib/api';

interface CronState {
  jobs: CronJob[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchJobs: () => Promise<void>;
  createJob: (input: CronJobCreateInput) => Promise<CronJob>;
  updateJob: (id: string, input: CronJobUpdateInput) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  toggleJob: (id: string, enabled: boolean) => Promise<void>;
  triggerJob: (id: string) => Promise<void>;
  setJobs: (jobs: CronJob[]) => void;
}

// Transform raw Gateway job object → CronJob UI format
function transformGatewayJob(job: any): CronJob {
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

export const useCronStore = create<CronState>((set) => ({
  jobs: [],
  loading: false,
  error: null,

  fetchJobs: async () => {
    set({ loading: true, error: null });

    try {
      let result: any[];

      if (platform.isElectron) {
        result = await window.electron.ipcRenderer.invoke('cron:list') as any[];
      } else {
        result = await api.getCronJobs();
      }

      const jobs: CronJob[] = Array.isArray(result) ? result.map(transformGatewayJob) : [];
      set({ jobs, loading: false });
    } catch (error) {
      console.error('Failed to fetch cron jobs:', error);
      set({ jobs: [], error: String(error), loading: false });
    }
  },

  createJob: async (input) => {
    try {
      let job: CronJob;

      if (platform.isElectron) {
        job = await window.electron.ipcRenderer.invoke('cron:create', input) as CronJob;
      } else {
        const rawJob = await api.createCronJob(input);
        // In case rawJob only has an ID, we populate optimistic values from input
        job = transformGatewayJob({
          id: rawJob?.id || `temp-${Date.now()}`,
          name: input.name,
          schedule: typeof input.schedule === 'string'
            ? { kind: 'cron', expr: input.schedule }
            : input.schedule,
          payload: { kind: 'agentTurn', message: input.message },
          delivery: {
            channel: input.target.channelType,
            to: input.target.channelId,
          },
          ...rawJob
        });
      }

      set((state) => ({ jobs: [...state.jobs, job] }));
      
      // Sync from gateway in background
      useCronStore.getState().fetchJobs();
      
      return job;
    } catch (error) {
      console.error('Failed to create cron job:', error);
      throw error;
    }
  },

  updateJob: async (id, input) => {
    try {
      if (platform.isElectron) {
        await window.electron.ipcRenderer.invoke('cron:update', id, input);
      } else {
        // Include sessionTarget so API can pick the right payload.kind
        const existingJob = useCronStore.getState().jobs.find(j => j.id === id);
        await api.updateCronJob(id, { ...input, sessionTarget: existingJob?.sessionTarget || 'isolated' });
      }

      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === id ? { ...job, ...input, updatedAt: new Date().toISOString() } : job
        ),
      }));
    } catch (error) {
      console.error('Failed to update cron job:', error);
      throw error;
    }
  },

  deleteJob: async (id) => {
    try {
      if (platform.isElectron) {
        await window.electron.ipcRenderer.invoke('cron:delete', id);
      } else {
        await api.deleteCronJob(id);
      }

      set((state) => ({
        jobs: state.jobs.filter((job) => job.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete cron job:', error);
      throw error;
    }
  },

  toggleJob: async (id, enabled) => {
    try {
      if (platform.isElectron) {
        await window.electron.ipcRenderer.invoke('cron:toggle', id, enabled);
      } else {
        const existingJob = useCronStore.getState().jobs.find(j => j.id === id);
        await api.toggleCronJob(id, enabled, existingJob?.sessionTarget || 'isolated');
      }

      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === id ? { ...job, enabled } : job
        ),
      }));
    } catch (error) {
      console.error('Failed to toggle cron job:', error);
      throw error;
    }
  },

  triggerJob: async (id) => {
    try {
      if (platform.isElectron) {
        const result = await window.electron.ipcRenderer.invoke('cron:trigger', id);
        console.log('Cron trigger result:', result);
      } else {
        await api.triggerCronJob(id);
      }

      // Refresh jobs after trigger to update lastRun/nextRun state
      try {
        let rawJobs: any[];

        if (platform.isElectron) {
          rawJobs = await window.electron.ipcRenderer.invoke('cron:list') as any[];
        } else {
          rawJobs = await api.getCronJobs();
        }

        const jobs = Array.isArray(rawJobs) ? rawJobs.map(transformGatewayJob) : [];
        set({ jobs });
      } catch {
        // Ignore refresh error
      }
    } catch (error) {
      console.error('Failed to trigger cron job:', error);
      throw error;
    }
  },

  setJobs: (jobs) => set({ jobs }),
}));
