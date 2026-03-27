/**
 * Shared types and constants for the Setup wizard
 */
import { SETUP_PROVIDERS } from '@/lib/providers';

export interface SetupStep {
  id: string;
  title: string;
  description: string;
}

export const STEP = {
  WELCOME: 0,
  RUNTIME: 1,
  PROVIDER: 2,
  CHANNEL: 3,
  INSTALLING: 4,
  COMPLETE: 5,
} as const;

export const steps: SetupStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ClawX',
    description: 'Your AI assistant is ready to be configured',
  },
  {
    id: 'runtime',
    title: 'Environment Check',
    description: 'Verifying system requirements',
  },
  {
    id: 'provider',
    title: 'AI Provider',
    description: 'Configure your AI service',
  },
  {
    id: 'channel',
    title: 'Connect a Channel',
    description: 'Connect a messaging platform (optional)',
  },
  {
    id: 'installing',
    title: 'Setting Up',
    description: 'Installing essential components',
  },
  {
    id: 'complete',
    title: 'All Set!',
    description: 'ClawX is ready to use',
  },
];

// Default skills to auto-install (no additional API keys required)
export interface DefaultSkill {
  id: string;
  name: string;
  description: string;
}

export const defaultSkills: DefaultSkill[] = [
  { id: 'opencode', name: 'OpenCode', description: 'AI coding assistant backend' },
  { id: 'python-env', name: 'Python Environment', description: 'Python runtime for skills' },
  { id: 'code-assist', name: 'Code Assist', description: 'Code analysis and suggestions' },
  { id: 'file-tools', name: 'File Tools', description: 'File operations and management' },
  { id: 'terminal', name: 'Terminal', description: 'Shell command execution' },
];

// Use the shared provider registry for setup providers
export const providers = SETUP_PROVIDERS;
