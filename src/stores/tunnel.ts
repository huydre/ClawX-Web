/**
 * Tunnel State Store
 * Manages Cloudflare Tunnel state and operations
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface TunnelState {
  // State
  configured: boolean;
  enabled: boolean;
  running: boolean;
  mode?: 'quick' | 'named';
  publicUrl?: string;
  uptime?: number;
  state: 'stopped' | 'starting' | 'connected' | 'error';
  loading: boolean;
  error: string | null;

  // Actions
  fetchStatus: () => Promise<void>;

  // Quick tunnel
  startQuickTunnel: (localUrl?: string) => Promise<void>;
  stopQuickTunnel: () => Promise<void>;

  // Named tunnel
  setupNamedTunnel: (config: {
    apiToken: string;
    tunnelName: string;
    domain?: string;
  }) => Promise<void>;
  autoSetupTunnel: (config: {
    apiToken: string;
    baseDomain?: string;
    localUrl?: string;
  }) => Promise<void>;
  startNamedTunnel: () => Promise<void>;
  stopNamedTunnel: () => Promise<void>;
  teardownTunnel: () => Promise<void>;

  // Validation
  validateToken: (apiToken: string) => Promise<{
    valid: boolean;
    accountId?: string;
  }>;

  // Helpers
  clearError: () => void;
}

export const useTunnelStore = create<TunnelState>()(
  persist(
    (set, get) => ({
      // Initial state
      configured: false,
      enabled: false,
      running: false,
      mode: undefined,
      publicUrl: undefined,
      uptime: undefined,
      state: 'stopped',
      loading: false,
      error: null,

      fetchStatus: async () => {
        set({ loading: true, error: null });

        try {
          const status = await api.getTunnelStatus();

          set({
            configured: status.configured,
            enabled: status.enabled,
            running: status.running,
            mode: status.mode,
            publicUrl: status.publicUrl,
            uptime: status.uptime,
            state: status.state,
            error: status.error || null,
            loading: false,
          });
        } catch (error) {
          set({
            error: String(error),
            loading: false,
            state: 'error',
          });
        }
      },

      startQuickTunnel: async (localUrl?: string) => {
        set({ loading: true, error: null, state: 'starting' });

        try {
          const result = await api.startQuickTunnel(localUrl);

          if (result.success) {
            toast.success('Quick tunnel started successfully');

            // Refresh status to get updated state
            await get().fetchStatus();
          } else {
            throw new Error('Failed to start quick tunnel');
          }
        } catch (error) {
          const errorMsg = String(error);
          set({
            error: errorMsg,
            loading: false,
            state: 'error',
          });
          toast.error(`Failed to start quick tunnel: ${errorMsg}`);
          throw error;
        }
      },

      stopQuickTunnel: async () => {
        set({ loading: true, error: null });

        try {
          const result = await api.stopQuickTunnel();

          if (result.success) {
            toast.success('Quick tunnel stopped');

            // Refresh status
            await get().fetchStatus();
          } else {
            throw new Error('Failed to stop quick tunnel');
          }
        } catch (error) {
          const errorMsg = String(error);
          set({
            error: errorMsg,
            loading: false,
          });
          toast.error(`Failed to stop quick tunnel: ${errorMsg}`);
          throw error;
        }
      },

      setupNamedTunnel: async (config) => {
        set({ loading: true, error: null });

        try {
          const result = await api.setupTunnel(config);

          if (result.success) {
            toast.success('Named tunnel configured successfully');

            // Refresh status
            await get().fetchStatus();
          } else {
            throw new Error('Failed to setup named tunnel');
          }
        } catch (error) {
          const errorMsg = String(error);
          set({
            error: errorMsg,
            loading: false,
          });
          toast.error(`Failed to setup tunnel: ${errorMsg}`);
          throw error;
        }
      },

      autoSetupTunnel: async (config) => {
        set({ loading: true, error: null });

        try {
          const result = await api.autoSetupTunnel(config);

          if (result.success) {
            toast.success(`Tunnel created: ${result.publicUrl}`);

            // Update state with new tunnel info
            set({
              configured: true,
              enabled: true,
              running: true,
              mode: 'named',
              publicUrl: result.publicUrl,
              state: 'connected',
              loading: false,
            });

            // Refresh status
            await get().fetchStatus();
          } else {
            throw new Error('Failed to auto-setup tunnel');
          }
        } catch (error) {
          const errorMsg = String(error);
          set({
            error: errorMsg,
            loading: false,
          });
          toast.error(`Failed to auto-setup tunnel: ${errorMsg}`);
          throw error;
        }
      },

      startNamedTunnel: async () => {
        set({ loading: true, error: null, state: 'starting' });

        try {
          const result = await api.startTunnel();

          if (result.success) {
            toast.success('Named tunnel started successfully');

            // Refresh status
            await get().fetchStatus();
          } else {
            throw new Error('Failed to start named tunnel');
          }
        } catch (error) {
          const errorMsg = String(error);
          set({
            error: errorMsg,
            loading: false,
            state: 'error',
          });
          toast.error(`Failed to start tunnel: ${errorMsg}`);
          throw error;
        }
      },

      stopNamedTunnel: async () => {
        set({ loading: true, error: null });

        try {
          const result = await api.stopTunnel();

          if (result.success) {
            toast.success('Named tunnel stopped');

            // Refresh status
            await get().fetchStatus();
          } else {
            throw new Error('Failed to stop named tunnel');
          }
        } catch (error) {
          const errorMsg = String(error);
          set({
            error: errorMsg,
            loading: false,
          });
          toast.error(`Failed to stop tunnel: ${errorMsg}`);
          throw error;
        }
      },

      teardownTunnel: async () => {
        set({ loading: true, error: null });

        try {
          const result = await api.teardownTunnel();

          if (result.success) {
            toast.success('Tunnel configuration removed');

            // Refresh status
            await get().fetchStatus();
          } else {
            throw new Error('Failed to teardown tunnel');
          }
        } catch (error) {
          const errorMsg = String(error);
          set({
            error: errorMsg,
            loading: false,
          });
          toast.error(`Failed to teardown tunnel: ${errorMsg}`);
          throw error;
        }
      },

      validateToken: async (apiToken: string) => {
        try {
          const result = await api.validateTunnelToken(apiToken);

          if (!result.valid) {
            toast.error('Invalid Cloudflare API token');
          }

          return result;
        } catch (error) {
          const errorMsg = String(error);
          toast.error(`Token validation failed: ${errorMsg}`);
          return { valid: false };
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'tunnel-storage',
      partialize: (state) => ({
        configured: state.configured,
        enabled: state.enabled,
        mode: state.mode,
      }),
    }
  )
);
