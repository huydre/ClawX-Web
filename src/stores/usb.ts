/**
 * USB State Store
 * Manages USB device detection, file browsing, and file operations
 */
import { create } from 'zustand';
import { api } from '@/lib/api';

export interface UsbFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  category: 'documents' | 'code' | 'data' | 'media' | 'other';
}

export interface UsbDevice {
  deviceId: string;
  label: string;
  mountPath: string;
  totalSize: number;
  usedSize: number;
  fileCount: number;
  status: 'mounting' | 'scanning' | 'ready' | 'ejecting';
}

interface UsbState {
  devices: UsbDevice[];
  selectedDevice: string | null;
  files: UsbFile[];
  currentPath: string;
  loading: boolean;
  scanning: boolean;
  error: string | null;

  fetchDevices: () => Promise<void>;
  fetchFiles: (deviceId: string, path?: string) => Promise<void>;
  selectDevice: (deviceId: string) => void;
  navigateTo: (path: string) => void;
  copyToWorkspace: (files: string[], workspace: string) => Promise<void>;
  ejectDevice: (deviceId: string) => Promise<void>;
  handleWsEvent: (event: any) => void;
}

export const useUsbStore = create<UsbState>((set, get) => ({
  devices: [],
  selectedDevice: null,
  files: [],
  currentPath: '/',
  loading: false,
  scanning: false,
  error: null,

  fetchDevices: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.getUsbDevices();
      const devices: UsbDevice[] = res.devices ?? [];
      set({ devices, loading: false });

      // Auto-select first device if none selected
      if (devices.length > 0 && !get().selectedDevice) {
        const first = devices[0];
        set({ selectedDevice: first.deviceId });
        get().fetchFiles(first.deviceId);
      }
    } catch (error) {
      set({ devices: [], error: String(error), loading: false });
    }
  },

  fetchFiles: async (deviceId: string, path = '/') => {
    set({ loading: true, error: null, currentPath: path });
    try {
      const res = await api.getUsbFiles(deviceId, path);
      const files: UsbFile[] = res.files ?? [];
      set({ files, loading: false });
    } catch (error) {
      set({ files: [], error: String(error), loading: false });
    }
  },

  selectDevice: (deviceId: string) => {
    set({ selectedDevice: deviceId, files: [], currentPath: '/' });
    get().fetchFiles(deviceId);
  },

  navigateTo: (path: string) => {
    const deviceId = get().selectedDevice;
    if (deviceId) {
      get().fetchFiles(deviceId, path);
    }
  },

  copyToWorkspace: async (files: string[], workspace: string) => {
    const deviceId = get().selectedDevice;
    if (!deviceId) return;
    set({ loading: true, error: null });
    try {
      await api.copyUsbFiles(deviceId, files, workspace);
      set({ loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  ejectDevice: async (deviceId: string) => {
    set((s) => ({
      devices: s.devices.map((d) =>
        d.deviceId === deviceId ? { ...d, status: 'ejecting' as const } : d
      ),
    }));
    try {
      await api.ejectUsb(deviceId);
      set((s) => ({
        devices: s.devices.filter((d) => d.deviceId !== deviceId),
        selectedDevice:
          s.selectedDevice === deviceId ? null : s.selectedDevice,
        files: s.selectedDevice === deviceId ? [] : s.files,
        currentPath: s.selectedDevice === deviceId ? '/' : s.currentPath,
      }));
    } catch (error) {
      // Revert status on failure
      set((s) => ({
        devices: s.devices.map((d) =>
          d.deviceId === deviceId ? { ...d, status: 'ready' as const } : d
        ),
        error: String(error),
      }));
    }
  },

  handleWsEvent: (event: any) => {
    const { type } = event;

    if (type === 'usb.connected') {
      // New device plugged in — refresh list
      get().fetchDevices();
    } else if (type === 'usb.disconnected') {
      const removedId = event.deviceId;
      set((s) => ({
        devices: s.devices.filter((d) => d.deviceId !== removedId),
        selectedDevice:
          s.selectedDevice === removedId ? null : s.selectedDevice,
        files: s.selectedDevice === removedId ? [] : s.files,
        currentPath: s.selectedDevice === removedId ? '/' : s.currentPath,
      }));
    } else if (type === 'usb.scan.complete') {
      const deviceId = event.deviceId;
      set((s) => ({
        devices: s.devices.map((d) =>
          d.deviceId === deviceId
            ? { ...d, status: 'ready' as const, fileCount: event.fileCount ?? d.fileCount }
            : d
        ),
        scanning: false,
      }));
      // Refresh files if currently viewing this device
      if (get().selectedDevice === deviceId) {
        get().fetchFiles(deviceId, get().currentPath);
      }
    }
  },
}));
