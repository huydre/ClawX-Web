import { create } from 'zustand';
import { api } from '@/lib/api';

export type ConnectionStatus = 'PENDING' | 'ACTIVE' | 'FAILED' | 'MOCK';

export interface ApplicationConnection {
  slug: string;
  connectionId: string;
  status: ConnectionStatus;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
}

export interface ApplicationsStatus {
  proxyConfigured: boolean;
  proxyReachable: boolean;
  composioConfigured: boolean;
  mockMode: boolean;
  error?: string;
}

interface ApplicationsState {
  status: ApplicationsStatus | null;
  connections: Record<string, ApplicationConnection>;
  loading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  fetchConnections: () => Promise<void>;
  connect: (slug: string) => Promise<{ redirectUrl: string; connectionId: string; mock: boolean }>;
  finalize: (slug: string) => Promise<ConnectionStatus>;
  disconnect: (slug: string) => Promise<void>;
}

export const useApplicationsStore = create<ApplicationsState>((set, get) => ({
  status: null,
  connections: {},
  loading: false,
  error: null,

  fetchStatus: async () => {
    try {
      const status = await api.getApplicationsStatus();
      set({ status });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  fetchConnections: async () => {
    set({ loading: true, error: null });
    try {
      const { items } = await api.getApplicationConnections();
      const map: Record<string, ApplicationConnection> = {};
      for (const c of items) map[c.slug] = c;
      set({ connections: map, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  connect: async (slug) => {
    const callbackUrl = `${window.location.origin}/applications?connected=${encodeURIComponent(slug)}`;
    const result = await api.connectApplication(slug, callbackUrl);
    // refresh list so PENDING entry shows up
    await get().fetchConnections();
    return result;
  },

  finalize: async (slug) => {
    const { status } = await api.finalizeApplication(slug);
    await get().fetchConnections();
    return status as ConnectionStatus;
  },

  disconnect: async (slug) => {
    await api.disconnectApplication(slug);
    await get().fetchConnections();
  },
}));
