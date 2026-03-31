/**
 * Agent Type Definitions
 * Types for AI agent management
 */

/**
 * Agent type — how context is scoped
 */
export type AgentType = 'open' | 'predefined';

/**
 * Agent status
 */
export type AgentStatus = 'active' | 'inactive' | 'error';

/**
 * Agent data structure
 */
export interface Agent {
  id: string;
  agent_key: string;
  display_name: string;
  emoji?: string;
  description?: string;
  agent_type: AgentType;
  status: AgentStatus;
  provider?: string;
  model?: string;
  context_window?: number;
  max_tool_iterations?: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Agent creation input
 */
export interface AgentCreateInput {
  agent_key: string;
  display_name: string;
  emoji?: string;
  description?: string;
  agent_type: AgentType;
  provider?: string;
  model?: string;
  context_window?: number;
  max_tool_iterations?: number;
}

/**
 * Agent update input
 */
export interface AgentUpdateInput {
  display_name?: string;
  emoji?: string;
  description?: string;
  provider?: string;
  model?: string;
  context_window?: number;
  max_tool_iterations?: number;
  is_default?: boolean;
  status?: AgentStatus;
}

/**
 * Agent context file (SOUL.md, IDENTITY.md, etc.)
 */
export interface AgentFile {
  name: string;
  content: string;
  readonly?: boolean;
}

/**
 * Default emojis for agent selection
 */
export const AGENT_EMOJIS = [
  '🤖', '🧠', '💡', '⚡', '🔮', '🎯', '🛡️', '🔧',
  '📊', '🎨', '🔬', '📝', '🌐', '🚀', '💬', '🦾',
  '🐾', '🦊', '🐱', '🐶', '🦅', '🐝', '🦋', '🐙',
];

/**
 * Default context window sizes
 */
export const CONTEXT_WINDOW_OPTIONS = [
  { value: 4096, label: '4K' },
  { value: 8192, label: '8K' },
  { value: 16384, label: '16K' },
  { value: 32768, label: '32K' },
  { value: 65536, label: '64K' },
  { value: 131072, label: '128K' },
  { value: 200000, label: '200K' },
];
