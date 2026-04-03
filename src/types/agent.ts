/**
 * Agent Type Definitions
 * Based on OpenClaw Gateway RPC schemas (additionalProperties: false)
 *
 * agents.create: { name, workspace, emoji?, avatar? }
 * agents.update: { agentId, name?, workspace?, model?, avatar? }
 * agents.delete: { agentId, deleteFiles? }
 * agents.list:   {} → { defaultId, mainKey, scope, agents[] }
 * agents.files.list: { agentId }
 * agents.files.get:  { agentId, name }
 * agents.files.set:  { agentId, name, content }
 */

/**
 * Agent status (derived from presence in config)
 */
export type AgentStatus = 'active' | 'inactive';

/**
 * Agent summary from agents.list response
 */
export interface Agent {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
  /** Whether this is the default agent (derived from defaultId) */
  isDefault?: boolean;
  /** Model string (from agents.update, not in list response) */
  model?: string;
}

/**
 * Agent creation input — only these 4 fields are allowed
 */
export interface AgentCreateInput {
  name: string;
  workspace: string;
  emoji?: string;
  avatar?: string;
}

/**
 * Agent update input — only these 5 fields are allowed
 */
export interface AgentUpdateInput {
  agentId: string;
  name?: string;
  workspace?: string;
  model?: string;
  avatar?: string;
}

/**
 * Agent context file entry from agents.files.list
 */
export interface AgentFile {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
}

/**
 * Default emojis for agent selection
 */
export const AGENT_EMOJIS = [
  '🤖', '🧠', '💡', '⚡', '🔮', '🎯', '🛡️', '🔧',
  '📊', '🎨', '🔬', '📝', '🌐', '🚀', '💬', '🦾',
  '🐾', '🦊', '🐱', '🐶', '🦅', '🐝', '🦋', '🐙',
];
