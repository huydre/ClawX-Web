/**
 * Agents State Store
 * Manages AI agent CRUD via OpenClaw Gateway RPC
 *
 * OpenClaw schemas (additionalProperties: false — no extra fields allowed):
 *   agents.create: { name, workspace, emoji?, avatar? }
 *   agents.update: { agentId, name?, workspace?, model?, avatar? }
 *   agents.delete: { agentId, deleteFiles? }
 *   agents.list:   {} → { defaultId, mainKey, scope, agents[] }
 *   agents.files.list: { agentId }
 *   agents.files.get:  { agentId, name }
 *   agents.files.set:  { agentId, name, content }
 */
import { create } from 'zustand';
import type { Agent, AgentCreateInput, AgentUpdateInput, AgentFile } from '../types/agent';
import { platform } from '@/lib/platform';
import { api } from '@/lib/api';

interface AgentsListResult {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: Array<{
    id: string;
    name?: string;
    identity?: {
      name?: string;
      theme?: string;
      emoji?: string;
      avatar?: string;
      avatarUrl?: string;
    };
  }>;
}

interface AgentsState {
  agents: Agent[];
  defaultId: string | null;
  loading: boolean;
  error: string | null;

  fetchAgents: () => Promise<void>;
  createAgent: (input: AgentCreateInput) => Promise<Agent>;
  updateAgent: (input: AgentUpdateInput) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;

  getAgentFiles: (agentId: string) => Promise<AgentFile[]>;
  getAgentFile: (agentId: string, fileName: string) => Promise<AgentFile | null>;
  setAgentFile: (agentId: string, fileName: string, content: string) => Promise<void>;

  clearError: () => void;
}

async function rpc(method: string, params: unknown) {
  return platform.isElectron
    ? await window.electron.ipcRenderer.invoke('gateway:rpc', method, params)
    : await api.gatewayRpc(method, params);
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  defaultId: null,
  loading: false,
  error: null,

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const result = await rpc('agents.list', {});
      const typedResult = result as { success: boolean; result?: AgentsListResult; error?: string };

      if (typedResult.success && typedResult.result) {
        const data = typedResult.result;
        const agents: Agent[] = (data.agents || []).map((a) => ({
          id: a.id,
          name: a.name,
          identity: a.identity,
          isDefault: a.id === data.defaultId,
        }));
        set({ agents, defaultId: data.defaultId, loading: false });
      } else {
        set({ agents: [], loading: false, error: typedResult.error });
      }
    } catch (err) {
      set({ agents: [], loading: false, error: String(err) });
    }
  },

  createAgent: async (input) => {
    // Only allowed: { name, workspace, emoji?, avatar? }
    const params: Record<string, string> = {
      name: input.name,
      workspace: input.workspace,
    };
    if (input.emoji) params.emoji = input.emoji;
    if (input.avatar) params.avatar = input.avatar;

    const result = await rpc('agents.create', params);
    const typedResult = result as { success: boolean; result?: { ok: boolean; agentId: string; name: string; workspace: string }; error?: string };

    if (typedResult.success && typedResult.result) {
      const r = typedResult.result;
      const agent: Agent = {
        id: r.agentId,
        name: r.name,
        identity: input.emoji ? { emoji: input.emoji } : undefined,
        isDefault: false,
      };
      set((state) => ({ agents: [...state.agents, agent] }));
      return agent;
    }
    throw new Error(typedResult.error || 'Failed to create agent');
  },

  updateAgent: async (input) => {
    // Only allowed: { agentId, name?, workspace?, model?, avatar? }
    const params: Record<string, string> = { agentId: input.agentId };
    if (input.name) params.name = input.name;
    if (input.workspace) params.workspace = input.workspace;
    if (input.model) params.model = input.model;
    if (input.avatar) params.avatar = input.avatar;

    const result = await rpc('agents.update', params);
    const typedResult = result as { success: boolean; error?: string };

    if (typedResult.success) {
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === input.agentId
            ? { ...a, name: input.name || a.name, model: input.model || a.model }
            : a
        ),
      }));
    } else {
      throw new Error(typedResult.error || 'Failed to update agent');
    }
  },

  deleteAgent: async (agentId) => {
    // Only allowed: { agentId, deleteFiles? }
    const result = await rpc('agents.delete', { agentId });
    const typedResult = result as { success: boolean; error?: string };

    if (typedResult.success) {
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== agentId),
      }));
    } else {
      throw new Error(typedResult.error || 'Failed to delete agent');
    }
  },

  getAgentFiles: async (agentId) => {
    try {
      const result = await rpc('agents.files.list', { agentId });
      const typedResult = result as { success: boolean; result?: { workspace?: string; files: AgentFile[] }; error?: string };
      if (typedResult.success && typedResult.result) {
        return { workspace: typedResult.result.workspace || '', files: typedResult.result.files || [] };
      }
      return { workspace: '', files: [] };
    } catch {
      return { workspace: '', files: [] };
    }
  },

  getAgentFile: async (agentId, fileName) => {
    try {
      const result = await rpc('agents.files.get', { agentId, name: fileName });
      const typedResult = result as { success: boolean; result?: { file: AgentFile }; error?: string };
      if (typedResult.success && typedResult.result) {
        return typedResult.result.file;
      }
      return null;
    } catch {
      return null;
    }
  },

  setAgentFile: async (agentId, fileName, content) => {
    const result = await rpc('agents.files.set', { agentId, name: fileName, content });
    const typedResult = result as { success: boolean; error?: string };
    if (!typedResult.success) {
      throw new Error(typedResult.error || 'Failed to save file');
    }
  },

  clearError: () => set({ error: null }),
}));
