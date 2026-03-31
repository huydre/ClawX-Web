/**
 * Agents State Store
 * Manages AI agent state and CRUD operations
 */
import { create } from 'zustand';
import type { Agent, AgentCreateInput, AgentUpdateInput, AgentFile } from '../types/agent';
import { platform } from '@/lib/platform';
import { api } from '@/lib/api';

interface AgentsState {
  agents: Agent[];
  loading: boolean;
  error: string | null;

  // CRUD Actions
  fetchAgents: () => Promise<void>;
  createAgent: (input: AgentCreateInput) => Promise<Agent>;
  updateAgent: (id: string, input: AgentUpdateInput) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  setDefaultAgent: (id: string) => Promise<void>;

  // File operations
  getAgentFiles: (agentKey: string) => Promise<AgentFile[]>;
  getAgentFile: (agentKey: string, fileName: string) => Promise<string>;
  setAgentFile: (agentKey: string, fileName: string, content: string) => Promise<void>;

  // Local state
  setAgents: (agents: Agent[]) => void;
  clearError: () => void;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  loading: false,
  error: null,

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const result = platform.isElectron
        ? await window.electron.ipcRenderer.invoke('gateway:rpc', 'agents.list', {})
        : await api.gatewayRpc('agents.list', {});

      const typedResult = result as {
        success: boolean;
        result?: { agents?: Agent[] };
        error?: string;
      };

      if (typedResult.success && typedResult.result) {
        const rawAgents = typedResult.result.agents || [];
        const agents: Agent[] = rawAgents.map((a: any) => ({
          id: a.id || a.agent_key,
          agent_key: a.agent_key || a.agentKey || a.id,
          display_name: a.display_name || a.displayName || a.name || a.agent_key || 'Unnamed',
          emoji: a.emoji || a.other_config?.emoji || '🤖',
          description: a.description || a.other_config?.description || '',
          agent_type: a.agent_type || a.agentType || 'open',
          status: a.status || 'active',
          provider: a.provider || '',
          model: a.model || '',
          context_window: a.context_window || a.contextWindow,
          max_tool_iterations: a.max_tool_iterations || a.maxToolIterations,
          is_default: a.is_default || a.isDefault || false,
          created_at: a.created_at || a.createdAt,
          updated_at: a.updated_at || a.updatedAt,
        }));
        set({ agents, loading: false });
      } else {
        set({ agents: [], loading: false, error: typedResult.error });
      }
    } catch (err) {
      set({ agents: [], loading: false, error: String(err) });
    }
  },

  createAgent: async (input) => {
    try {
      const result = platform.isElectron
        ? await window.electron.ipcRenderer.invoke('gateway:rpc', 'agents.create', input)
        : await api.gatewayRpc('agents.create', input);

      const typedResult = result as { success: boolean; result?: any; error?: string };

      if (typedResult.success && typedResult.result) {
        const agent: Agent = {
          id: typedResult.result.id || input.agent_key,
          agent_key: input.agent_key,
          display_name: input.display_name,
          emoji: input.emoji || '🤖',
          description: input.description,
          agent_type: input.agent_type,
          status: 'active',
          provider: input.provider,
          model: input.model,
          context_window: input.context_window,
          max_tool_iterations: input.max_tool_iterations,
          is_default: false,
        };
        set((state) => ({ agents: [...state.agents, agent] }));
        return agent;
      }
      throw new Error(typedResult.error || 'Failed to create agent');
    } catch (err) {
      throw err;
    }
  },

  updateAgent: async (id, input) => {
    try {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) throw new Error('Agent not found');

      const result = platform.isElectron
        ? await window.electron.ipcRenderer.invoke('gateway:rpc', 'agents.update', { id: agent.agent_key, ...input })
        : await api.gatewayRpc('agents.update', { id: agent.agent_key, ...input });

      const typedResult = result as { success: boolean; error?: string };

      if (typedResult.success) {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === id ? { ...a, ...input, updated_at: new Date().toISOString() } : a
          ),
        }));
      } else {
        throw new Error(typedResult.error || 'Failed to update agent');
      }
    } catch (err) {
      throw err;
    }
  },

  deleteAgent: async (id) => {
    try {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) throw new Error('Agent not found');

      const result = platform.isElectron
        ? await window.electron.ipcRenderer.invoke('gateway:rpc', 'agents.delete', { id: agent.agent_key })
        : await api.gatewayRpc('agents.delete', { id: agent.agent_key });

      const typedResult = result as { success: boolean; error?: string };

      if (typedResult.success) {
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
        }));
      } else {
        throw new Error(typedResult.error || 'Failed to delete agent');
      }
    } catch (err) {
      throw err;
    }
  },

  setDefaultAgent: async (id) => {
    try {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) throw new Error('Agent not found');

      const result = platform.isElectron
        ? await window.electron.ipcRenderer.invoke('gateway:rpc', 'agents.setDefault', { id: agent.agent_key })
        : await api.gatewayRpc('agents.setDefault', { id: agent.agent_key });

      const typedResult = result as { success: boolean; error?: string };

      if (typedResult.success) {
        set((state) => ({
          agents: state.agents.map((a) => ({
            ...a,
            is_default: a.id === id,
          })),
        }));
      }
    } catch (err) {
      throw err;
    }
  },

  getAgentFiles: async (agentKey) => {
    try {
      const result = platform.isElectron
        ? await window.electron.ipcRenderer.invoke('gateway:rpc', 'agents.files.list', { agentKey })
        : await api.gatewayRpc('agents.files.list', { agentKey });

      const typedResult = result as { success: boolean; result?: { files?: AgentFile[] }; error?: string };

      if (typedResult.success && typedResult.result) {
        return typedResult.result.files || [];
      }
      return [];
    } catch {
      return [];
    }
  },

  getAgentFile: async (agentKey, fileName) => {
    try {
      const result = platform.isElectron
        ? await window.electron.ipcRenderer.invoke('gateway:rpc', 'agents.files.get', { agentKey, fileName })
        : await api.gatewayRpc('agents.files.get', { agentKey, fileName });

      const typedResult = result as { success: boolean; result?: { content?: string }; error?: string };

      if (typedResult.success && typedResult.result) {
        return typedResult.result.content || '';
      }
      return '';
    } catch {
      return '';
    }
  },

  setAgentFile: async (agentKey, fileName, content) => {
    const result = platform.isElectron
      ? await window.electron.ipcRenderer.invoke('gateway:rpc', 'agents.files.set', { agentKey, fileName, content })
      : await api.gatewayRpc('agents.files.set', { agentKey, fileName, content });

    const typedResult = result as { success: boolean; error?: string };
    if (!typedResult.success) {
      throw new Error(typedResult.error || 'Failed to save file');
    }
  },

  setAgents: (agents) => set({ agents }),
  clearError: () => set({ error: null }),
}));
