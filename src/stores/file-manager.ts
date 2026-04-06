/**
 * File Manager State Store
 * Browse whitelisted server directories with media preview support.
 */
import { create } from 'zustand';
import { api } from '@/lib/api';

export interface FileRoot {
  id: string;
  label: string;
  path: string;
  icon: string;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modified: string;
  mimeType: string | null;
  category: 'image' | 'video' | 'audio' | 'documents' | 'code' | 'data' | 'other';
  isMedia: boolean;
}

interface FileManagerState {
  roots: FileRoot[];
  selectedRoot: string | null;
  files: FileEntry[];
  currentPath: string;
  loading: boolean;
  error: string | null;

  fetchRoots: () => Promise<void>;
  fetchFiles: (rootId: string, path?: string) => Promise<void>;
  selectRoot: (rootId: string) => void;
  navigateTo: (path: string) => void;
}

export const useFileManagerStore = create<FileManagerState>((set, get) => ({
  roots: [],
  selectedRoot: null,
  files: [],
  currentPath: '/',
  loading: false,
  error: null,

  fetchRoots: async () => {
    try {
      const res = await api.getFmRoots();
      const roots: FileRoot[] = res.roots ?? [];
      set({ roots });

      // Auto-select first root if none selected
      if (roots.length > 0 && !get().selectedRoot) {
        const first = roots[0];
        set({ selectedRoot: first.id });
        get().fetchFiles(first.id);
      }
    } catch (err) {
      set({ error: String(err) });
    }
  },

  fetchFiles: async (rootId: string, path = '/') => {
    set({ loading: true, error: null, currentPath: path });
    try {
      const res = await api.getFmFiles(rootId, path);
      set({ files: res.files ?? [], loading: false });
    } catch (err) {
      set({ files: [], error: String(err), loading: false });
    }
  },

  selectRoot: (rootId: string) => {
    set({ selectedRoot: rootId, files: [], currentPath: '/' });
    get().fetchFiles(rootId);
  },

  navigateTo: (path: string) => {
    const rootId = get().selectedRoot;
    if (rootId) get().fetchFiles(rootId, path);
  },
}));
