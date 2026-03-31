/**
 * Agents State Store
 * Manages AI agent state and CRUD operations
 * Gateway RPC uses: name (not display_name), agentId (not id), workspace
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
  getAgentFiles: (agentId: string) => Promise<AgentFile[]>;
  getAgentFile: (agentId: string, fileName: string) => Promise<string>;
  setAgentFile: (agentId: string, fileName: string, content: string) => Promise<void>;

  // Local state
  setAgents: (agents: Agent[]) => void;
  clearError: () => void;
}

async function rpc(method: string, params: unknown) {
  return platform.isElectron
    ? await window.electron.ipcRenderer.invoke('gateway:rpc', method, params)
    : await api.gatewayRpc(method, params);
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  loading: false,
  error: null,

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const result = await rpc('agents.list', {});

      const typedResult = result as {
        success: boolean;
        result?: { agents?: any[] } | any[];
        error?: string;
      };

      if (typedResult.success && typedResult.result) {
        // Handle both { agents: [...] } and direct array
        const rawAgents = Array.isArray(typedResult.result)
          ? typedResult.result
          : (typedResult.result.agents || []);

        const agents: Agent[] = rawAgents.map((a: any) => ({
          id: a.id || a.agent_key || a.agentKey,
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
      // Gateway expects: name (required), workspace (optional),
      // emoji, provider, model, agent_type, context_window, max_tool_iterations
      // and other_config for extra fields like description
      const gatewayParams: Record<string, unknown> = {
        name: input.display_name,
        emoji: input.emoji || '🤖',
        agent_type: input.agent_type,
      };

      if (input.provider) gatewayParams.provider = input.provider;
      if (input.model) gatewayParams.model = input.model;
      if (input.context_window) gatewayParams.context_window = input.context_window;
      if (input.max_tool_iterations) gatewayParams.max_tool_iterations = input.max_tool_iterations;
      if (input.description) {
        gatewayParams.other_config = { description: input.description };
      }

      const result = await rpc('agents.create', gatewayParams);
      const typedResult = result as { success: boolean; result?: any; error?: string };

      if (typedResult.success && typedResult.result) {
        const r = typedResult.result;
        const agent: Agent = {
          id: r.id || r.agent_key || r.agentKey,
          agent_key: r.agent_key || r.agentKey || r.id,
          display_name: r.name || r.display_name || input.display_name,
          emoji: r.emoji || input.emoji || '🤖',
          description: input.description,
          agent_type: r.agent_type || input.agent_type,
          status: r.status || 'active',
          provider: r.provider || input.provider,
          model: r.model || input.model,
          context_window: r.context_window || input.context_window,
          max_tool_iterations: r.max_tool_iterations || input.max_tool_iterations,
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

      // Gateway expects: agentId (required), then optional fields
      const gatewayParams: Record<string, unknown> = {
        agentId: agent.agent_key,
      };

      if (input.display_name !== undefined) gatewayParams.name = input.display_name;
      if (input.emoji !== undefined) gatewayParams.emoji = input.emoji;
      if (input.provider !== undefined) gatewayParams.provider = input.provider;
      if (input.model !== undefined) gatewayParams.model = input.model;
      if (input.context_window !== undefined) gatewayParams.context_window = input.context_window;
      if (input.max_tool_iterations !== undefined) gatewayParams.max_tool_iterations = input.max_tool_iterations;
      if (input.is_default !== undefined) gatewayParams.is_default = input.is_default;
      if (input.status !== undefined) gatewayParams.status = input.status;
      if (input.description !== undefined) {
        gatewayParams.other_config = { description: input.description };
      }

      const result = await rpc('agents.update', gatewayParams);
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

      // Gateway expects: agentId (required)
      const result = await rpc('agents.delete', { agentId: agent.agent_key });
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

      // No agents.setDefault method — use agents.update with is_default
      const result = await rpc('agents.update', {
        agentId: agent.agent_key,
        is_default: true,
      });
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

  // Gateway expects: agentId (optional, defaults to "default")
  getAgentFiles: async (agentId) => {
    try {
      const result = await rpc('agents.files.list', { agentId });
      const typedResult = result as { success: boolean; result?: { files?: AgentFile[] } | AgentFile[]; error?: string };

      if (typedResult.success && typedResult.result) {
        const files = Array.isArray(typedResult.result)
          ? typedResult.result
          : (typedResult.result.files || []);
        return files;
      }
      return [];
    } catch {
      return [];
    }
  },

  // Gateway expects: agentId, name (file name)
  getAgentFile: async (agentId, fileName) => {
    try {
      const result = await rpc('agents.files.get', { agentId, name: fileName });
      const typedResult = result as { success: boolean; result?: { content?: string } | string; error?: string };

      if (typedResult.success && typedResult.result) {
        if (typeof typedResult.result === 'string') return typedResult.result;
        return typedResult.result.content || '';
      }
      return '';
    } catch {
      return '';
    }
  },

  // Gateway expects: agentId, name (file name), content
  setAgentFile: async (agentId, fileName, content) => {
    const result = await rpc('agents.files.set', { agentId, name: fileName, content });
    const typedResult = result as { success: boolean; error?: string };
    if (!typedResult.success) {
      throw new Error(typedResult.error || 'Failed to save file');
    }
  },

  setAgents: (agents) => set({ agents }),
  clearError: () => set({ error: null }),
}));
