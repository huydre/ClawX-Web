/**
 * Browser State Store
 * Manages virtual browser lifecycle, navigation, and turn-based control.
 */
import { create } from 'zustand';
import { api } from '@/lib/api';

export type BrowserStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
export type LockOwner = 'agent' | 'human' | null;

export interface BrowserState {
  status: BrowserStatus;
  currentUrl: string;
  title: string;
  lockOwner: LockOwner;
  lastHumanInputAt: number;
  lastAgentActionAt: number;
  error: string | null;
}

interface BrowserStore {
  state: BrowserState;
  loading: boolean;
  activeTab: 'browser' | 'activity';

  fetchStatus: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  navigate: (url: string) => Promise<void>;
  takeControl: (owner: LockOwner) => Promise<void>;
  markHumanInput: () => Promise<void>;
  setActiveTab: (tab: 'browser' | 'activity') => void;
  handleWsEvent: (event: any) => void;
}

const INITIAL_STATE: BrowserState = {
  status: 'stopped',
  currentUrl: '',
  title: '',
  lockOwner: null,
  lastHumanInputAt: 0,
  lastAgentActionAt: 0,
  error: null,
};

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  state: INITIAL_STATE,
  loading: false,
  activeTab: 'browser',

  fetchStatus: async () => {
    try {
      const res = await api.getBrowserStatus();
      set({ state: res.state });
    } catch { /* ignore */ }
  },

  start: async () => {
    set({ loading: true });
    try {
      const res = await api.startBrowser();
      set({ state: res.state });
    } finally {
      set({ loading: false });
    }
  },

  stop: async () => {
    set({ loading: true });
    try {
      const res = await api.stopBrowser();
      set({ state: res.state });
    } finally {
      set({ loading: false });
    }
  },

  navigate: async (url: string) => {
    try {
      const res = await api.navigateBrowser(url);
      set({ state: res.state });
    } catch (err) {
      set((s) => ({ state: { ...s.state, error: String(err) } }));
    }
  },

  takeControl: async (owner: LockOwner) => {
    try {
      const res = await api.setBrowserControl(owner);
      set({ state: res.state });
    } catch { /* ignore */ }
  },

  markHumanInput: async () => {
    try {
      await api.markBrowserHumanInput();
    } catch { /* ignore */ }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  handleWsEvent: (event: any) => {
    if (event.type === 'browser.state') {
      set({ state: event.state });
    }
  },
}));
