/**
 * Gateway State Store
 * Manages Gateway connection state and communication
 */
import { create } from 'zustand';
import type { GatewayStatus } from '../types/gateway';
import { api } from '@/lib/api';
import { ws } from '@/lib/websocket';

let gatewayInitPromise: Promise<void> | null = null;

interface GatewayHealth {
  ok: boolean;
  error?: string;
  uptime?: number;
}

interface GatewayState {
  status: GatewayStatus;
  health: GatewayHealth | null;
  isInitialized: boolean;
  lastError: string | null;

  // Actions
  init: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  checkHealth: () => Promise<GatewayHealth>;
  rpc: <T>(method: string, params?: unknown, timeoutMs?: number) => Promise<T>;
  setStatus: (status: GatewayStatus) => void;
  clearError: () => void;
  isRunning: () => boolean;
}

export const useGatewayStore = create<GatewayState>((set, get) => ({
  status: {
    state: 'stopped',
    port: 18789,
  },
  health: null,
  isInitialized: false,
  lastError: null,

  init: async () => {
    if (get().isInitialized) return;
    if (gatewayInitPromise) {
      await gatewayInitPromise;
      return;
    }

    gatewayInitPromise = (async () => {
      try {
        // Get initial status with retry logic (backend might not be ready yet)
        let status;
        let retries = 3;
        while (retries > 0) {
          try {
            status = await api.getGatewayStatus();
            break;
          } catch (error) {
            retries--;
            if (retries === 0) throw error;
            // Wait 1 second before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        set({
          status: {
            state: status.state as any,
            port: 18789
          },
          isInitialized: true
        });

        // Connect WebSocket for real-time updates
        ws.connect();

        // Listen for state changes
        ws.on('stateChange', (data) => {
          set({
            status: {
              ...get().status,
              state: data.state as any
            }
          });
        });

        // Listen for notifications
        ws.on('notification', (data) => {
          const { method, params } = data;

          console.log('[Gateway] Received notification:', { method, params });

          if (method === 'agent' || method === 'chat') {
            // Forward agent and chat notifications to chat store
            const normalizedEvent: Record<string, unknown> = {
              ...(params?.data || {}),
              ...params,
            };

            console.log('[Gateway] Forwarding to chat store:', normalizedEvent);

            import('./chat')
              .then(({ useChatStore }) => {
                useChatStore.getState().handleChatEvent(normalizedEvent);
              })
              .catch((err) => {
                console.warn('Failed to forward gateway notification event:', err);
              });
          } else {
            console.log('[Gateway] Ignoring notification with method:', method);
          }
        });

      } catch (error) {
        console.error('Failed to initialize Gateway:', error);
        set({ lastError: String(error) });
      } finally {
        gatewayInitPromise = null;
      }
    })();

    await gatewayInitPromise;
  },

  start: async () => {
    try {
      set({ status: { ...get().status, state: 'starting' }, lastError: null });
      await api.startGateway();
    } catch (error) {
      set({
        status: { ...get().status, state: 'error', error: String(error) },
        lastError: String(error)
      });
    }
  },

  stop: async () => {
    try {
      await api.stopGateway();
      set({ status: { ...get().status, state: 'stopped' }, lastError: null });
    } catch (error) {
      console.error('Failed to stop Gateway:', error);
      set({ lastError: String(error) });
    }
  },

  restart: async () => {
    try {
      set({ status: { ...get().status, state: 'starting' }, lastError: null });
      await api.restartOpenClaw();

      // Poll status every 2s for up to 30s
      const maxAttempts = 15;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const status = await api.getGatewayStatus();
          if (status.connected) {
            set({ status: { ...get().status, state: 'connected' }, lastError: null });
            return;
          }
        } catch {
          // Ignore polling errors
        }
      }
      // After all attempts, set error
      set({
        status: { ...get().status, state: 'error', error: 'Gateway did not reconnect after restart' },
        lastError: 'Gateway did not reconnect after restart'
      });
    } catch (error) {
      set({
        status: { ...get().status, state: 'error', error: String(error) },
        lastError: String(error)
      });
    }
  },

  checkHealth: async () => {
    try {
      const status = await api.getGatewayStatus();
      const health: GatewayHealth = {
        ok: status.connected,
        error: status.connected ? undefined : 'Gateway not connected',
      };

      set({ health });
      return health;
    } catch (error) {
      const health: GatewayHealth = { ok: false, error: String(error) };
      set({ health });
      return health;
    }
  },

  rpc: async <T>(method: string, params?: unknown, timeoutMs?: number): Promise<T> => {
    const result = await api.gatewayRpc(method, params, timeoutMs);
    return result.result as T;
  },

  setStatus: (status) => set({ status }),

  clearError: () => set({ lastError: null }),

  isRunning: () => {
    const state = get().status.state;
    // Consider gateway as running if it's connected, running, or temporarily disconnected (error state)
    // because it will auto-reconnect. This prevents UI flashing "Gateway Not Running" during reconnects.
    return state === 'running' || state === 'connected' || state === 'error' || state === 'starting';
  },
}));
