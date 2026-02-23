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

export const useCronStore = create<CronState>((set) => ({
  jobs: [],
  loading: false,
  error: null,

  fetchJobs: async () => {
    set({ loading: true, error: null });

    try {
      let result: CronJob[];

      if (platform.isElectron) {
        result = await window.electron.ipcRenderer.invoke('cron:list') as CronJob[];
      } else {
        result = await api.getCronJobs();
      }

      set({ jobs: Array.isArray(result) ? result : [], loading: false });
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
        job = await api.createCronJob(input);
      }

      set((state) => ({ jobs: [...state.jobs, job] }));
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
        await api.updateCronJob(id, input);
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
        await api.toggleCronJob(id, enabled);
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
        let jobs: CronJob[];

        if (platform.isElectron) {
          jobs = await window.electron.ipcRenderer.invoke('cron:list') as CronJob[];
        } else {
          jobs = await api.getCronJobs();
        }

        set({ jobs: Array.isArray(jobs) ? jobs : [] });
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
