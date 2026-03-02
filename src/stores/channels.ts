/**
 * Channels State Store
 * Manages messaging channel state
 */
import { create } from 'zustand';
import type { Channel, ChannelType } from '../types/channel';
import { platform } from '@/lib/platform';
import { api } from '@/lib/api';

interface AddChannelParams {
  type: ChannelType;
  name: string;
  token?: string;
}

interface ChannelsState {
  channels: Channel[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchChannels: () => Promise<void>;
  addChannel: (params: AddChannelParams) => Promise<Channel>;
  deleteChannel: (channelId: string) => Promise<void>;
  connectChannel: (channelId: string) => Promise<void>;
  disconnectChannel: (channelId: string) => Promise<void>;
  requestQrCode: (channelType: ChannelType) => Promise<{ qrCode: string; sessionId: string }>;
  setChannels: (channels: Channel[]) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  clearError: () => void;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: [],
  loading: false,
  error: null,

  fetchChannels: async () => {
    set({ loading: true, error: null });
    try {
      // Use API in web mode, IPC in Electron mode
      const result = platform.isElectron
        ? await window.electron.ipcRenderer.invoke(
          'gateway:rpc',
          'channels.status',
          { probe: true }
        )
        : await api.gatewayRpc('channels.status', { probe: true });

      const typedResult = result as {
        success: boolean;
        result?: {
          channelOrder?: string[];
          channels?: Record<string, unknown>;
          channelAccounts?: Record<string, Array<{
            accountId?: string;
            configured?: boolean;
            connected?: boolean;
            running?: boolean;
            lastError?: string;
            name?: string;
            linked?: boolean;
            lastConnectedAt?: number | null;
            lastInboundAt?: number | null;
            lastOutboundAt?: number | null;
          }>>;
          channelDefaultAccountId?: Record<string, string>;
        };
        error?: string;
      };

      if (typedResult.success && typedResult.result) {
        const data = typedResult.result;
        const channels: Channel[] = [];

        // Parse the complex channels.status response into simple Channel objects
        const channelOrder = data.channelOrder || Object.keys(data.channels || {});
        for (const channelId of channelOrder) {
          const summary = (data.channels as Record<string, unknown> | undefined)?.[channelId] as Record<string, unknown> | undefined;
          const configured =
            typeof summary?.configured === 'boolean'
              ? summary.configured
              : typeof (summary as { running?: boolean })?.running === 'boolean'
                ? true
                : false;
          const running = typeof (summary as { running?: boolean })?.running === 'boolean'
            ? (summary as { running?: boolean }).running
            : false;
          if (!configured && !running) continue;

          const accounts = data.channelAccounts?.[channelId] || [];
          const defaultAccountId = data.channelDefaultAccountId?.[channelId];
          const primaryAccount =
            (defaultAccountId ? accounts.find((a) => a.accountId === defaultAccountId) : undefined) ||
            accounts.find((a) => a.connected === true || a.linked === true) ||
            accounts[0];

          // Map gateway status to our status format
          let status: Channel['status'] = 'disconnected';
          const now = Date.now();
          const RECENT_MS = 10 * 60 * 1000;
          const hasRecentActivity = (a: { lastInboundAt?: number | null; lastOutboundAt?: number | null; lastConnectedAt?: number | null }) =>
            (typeof a.lastInboundAt === 'number' && now - a.lastInboundAt < RECENT_MS) ||
            (typeof a.lastOutboundAt === 'number' && now - a.lastOutboundAt < RECENT_MS) ||
            (typeof a.lastConnectedAt === 'number' && now - a.lastConnectedAt < RECENT_MS);
          const anyConnected = accounts.some((a) => a.connected === true || a.linked === true || hasRecentActivity(a));
          const anyRunning = accounts.some((a) => a.running === true);
          const summaryError =
            typeof (summary as { error?: string })?.error === 'string'
              ? (summary as { error?: string }).error
              : typeof (summary as { lastError?: string })?.lastError === 'string'
                ? (summary as { lastError?: string }).lastError
                : undefined;
          const anyError =
            accounts.some((a) => typeof a.lastError === 'string' && a.lastError) || Boolean(summaryError);

          if (anyConnected) {
            status = 'connected';
          } else if (anyRunning && !anyError) {
            status = 'connected';
          } else if (anyError) {
            status = 'error';
          } else if (anyRunning) {
            status = 'connecting';
          }

          channels.push({
            id: `${channelId}-${primaryAccount?.accountId || 'default'}`,
            type: channelId as ChannelType,
            name: primaryAccount?.name || channelId,
            status,
            accountId: primaryAccount?.accountId,
            error:
              (typeof primaryAccount?.lastError === 'string' ? primaryAccount.lastError : undefined) ||
              (typeof summaryError === 'string' ? summaryError : undefined),
            mode: (primaryAccount as Record<string, unknown>)?.mode as string | null | undefined,
            tokenSource: (primaryAccount as Record<string, unknown>)?.tokenSource as string | undefined,
            lastInboundAt: primaryAccount?.lastInboundAt,
            lastOutboundAt: primaryAccount?.lastOutboundAt,
            botUsername: ((summary as Record<string, unknown>)?.probe as Record<string, unknown>)?.bot
              ? (((summary as Record<string, unknown>)?.probe as Record<string, unknown>)?.bot as Record<string, unknown>)?.username as string
              : undefined,
            probe: (summary as Record<string, unknown>)?.probe as Channel['probe'],
          });
        }

        set({ channels, loading: false });
      } else {
        // Gateway not available - try to show channels from local config
        set({ channels: [], loading: false });
      }
    } catch {
      // Gateway not connected, show empty
      set({ channels: [], loading: false });
    }
  },

  addChannel: async (params) => {
    try {
      // Use API in web mode, IPC in Electron mode
      const result = platform.isElectron
        ? await window.electron.ipcRenderer.invoke(
          'gateway:rpc',
          'channels.add',
          params
        )
        : await api.gatewayRpc('channels.add', params);

      const typedResult = result as { success: boolean; result?: Channel; error?: string };

      if (typedResult.success && typedResult.result) {
        set((state) => ({
          channels: [...state.channels, typedResult.result!],
        }));
        return typedResult.result;
      } else {
        // If gateway is not available, create a local channel for now
        const newChannel: Channel = {
          id: `local-${Date.now()}`,
          type: params.type,
          name: params.name,
          status: 'disconnected',
        };
        set((state) => ({
          channels: [...state.channels, newChannel],
        }));
        return newChannel;
      }
    } catch {
      // Create local channel if gateway unavailable
      const newChannel: Channel = {
        id: `local-${Date.now()}`,
        type: params.type,
        name: params.name,
        status: 'disconnected',
      };
      set((state) => ({
        channels: [...state.channels, newChannel],
      }));
      return newChannel;
    }
  },

  deleteChannel: async (channelId) => {
    // Extract channel type from the channelId (format: "channelType-accountId")
    const channelType = channelId.split('-')[0];

    try {
      if (platform.isElectron) {
        // Delete the channel configuration via IPC (Electron only)
        await window.electron.ipcRenderer.invoke('channel:deleteConfig', channelType);
      } else {
        // Delete via REST API (web mode)
        await api.deleteChannelConfig(channelType);
        // Restart OpenClaw so it picks up the removed channel
        await api.restartOpenClaw().catch(() => { /* ignore restart errors */ });
      }
    } catch (error) {
      console.error('Failed to delete channel config:', error);
    }

    // Remove from local state
    set((state) => ({
      channels: state.channels.filter((c) => c.id !== channelId),
    }));
  },

  connectChannel: async (channelId) => {
    const { updateChannel } = get();
    updateChannel(channelId, { status: 'connecting', error: undefined });

    try {
      // Use API in web mode, IPC in Electron mode
      const result = platform.isElectron
        ? await window.electron.ipcRenderer.invoke(
          'gateway:rpc',
          'channels.connect',
          { channelId }
        )
        : await api.gatewayRpc('channels.connect', { channelId });

      const typedResult = result as { success: boolean; error?: string };

      if (typedResult.success) {
        updateChannel(channelId, { status: 'connected' });
      } else {
        updateChannel(channelId, { status: 'error', error: typedResult.error });
      }
    } catch (error) {
      updateChannel(channelId, { status: 'error', error: String(error) });
    }
  },

  disconnectChannel: async (channelId) => {
    const { updateChannel } = get();

    try {
      // Use API in web mode, IPC in Electron mode
      if (platform.isElectron) {
        await window.electron.ipcRenderer.invoke(
          'gateway:rpc',
          'channels.disconnect',
          { channelId }
        );
      } else {
        await api.gatewayRpc('channels.disconnect', { channelId });
      }
    } catch (error) {
      console.error('Failed to disconnect channel:', error);
    }

    updateChannel(channelId, { status: 'disconnected', error: undefined });
  },

  requestQrCode: async (channelType) => {
    // Use API in web mode, IPC in Electron mode
    const result = platform.isElectron
      ? await window.electron.ipcRenderer.invoke(
        'gateway:rpc',
        'channels.requestQr',
        { type: channelType }
      )
      : await api.gatewayRpc('channels.requestQr', { type: channelType });

    const typedResult = result as { success: boolean; result?: { qrCode: string; sessionId: string }; error?: string };

    if (typedResult.success && typedResult.result) {
      return typedResult.result;
    }

    throw new Error(typedResult.error || 'Failed to request QR code');
  },

  setChannels: (channels) => set({ channels }),

  updateChannel: (channelId, updates) => {
    set((state) => ({
      channels: state.channels.map((channel) =>
        channel.id === channelId ? { ...channel, ...updates } : channel
      ),
    }));
  },

  clearError: () => set({ error: null }),
}));
