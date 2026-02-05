/**
 * Skills State Store
 * Manages skill/plugin state
 */
import { create } from 'zustand';
import type { Skill } from '../types/skill';

interface SkillsState {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchSkills: () => Promise<void>;
  enableSkill: (skillId: string) => Promise<void>;
  disableSkill: (skillId: string) => Promise<void>;
  setSkills: (skills: Skill[]) => void;
  updateSkill: (skillId: string, updates: Partial<Skill>) => void;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  loading: false,
  error: null,
  
  fetchSkills: async () => {
    // skills.status returns a complex nested object, not a simple Skill[] array.
    // Skill management is handled in the Skills page.
    // For now, use empty list - will be properly integrated later.
    set({ skills: [], loading: false });
  },
  
  enableSkill: async (skillId) => {
    const { updateSkill } = get();
    
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'gateway:rpc',
        'skills.enable',
        { skillId }
      ) as { success: boolean; error?: string };
      
      if (result.success) {
        updateSkill(skillId, { enabled: true });
      } else {
        throw new Error(result.error || 'Failed to enable skill');
      }
    } catch (error) {
      console.error('Failed to enable skill:', error);
      throw error;
    }
  },
  
  disableSkill: async (skillId) => {
    const { updateSkill, skills } = get();
    
    // Check if skill is a core skill
    const skill = skills.find((s) => s.id === skillId);
    if (skill?.isCore) {
      throw new Error('Cannot disable core skill');
    }
    
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'gateway:rpc',
        'skills.disable',
        { skillId }
      ) as { success: boolean; error?: string };
      
      if (result.success) {
        updateSkill(skillId, { enabled: false });
      } else {
        throw new Error(result.error || 'Failed to disable skill');
      }
    } catch (error) {
      console.error('Failed to disable skill:', error);
      throw error;
    }
  },
  
  setSkills: (skills) => set({ skills }),
  
  updateSkill: (skillId, updates) => {
    set((state) => ({
      skills: state.skills.map((skill) =>
        skill.id === skillId ? { ...skill, ...updates } : skill
      ),
    }));
  },
}));
