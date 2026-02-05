/**
 * Skill Type Definitions
 * Types for skills/plugins
 */

/**
 * Skill category
 */
export type SkillCategory =
  | 'productivity'
  | 'developer'
  | 'smart-home'
  | 'media'
  | 'communication'
  | 'security'
  | 'information'
  | 'utility'
  | 'custom';

/**
 * Skill data structure
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: SkillCategory;
  icon?: string;
  version?: string;
  author?: string;
  configurable?: boolean;
  isCore?: boolean;
  dependencies?: string[];
}

/**
 * Skill bundle (preset skill collection)
 */
export interface SkillBundle {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  skills: string[];
  recommended?: boolean;
}

/**
 * Skill configuration schema
 */
export interface SkillConfigSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array';
    title?: string;
    description?: string;
    default?: unknown;
    enum?: unknown[];
  }>;
  required?: string[];
}
