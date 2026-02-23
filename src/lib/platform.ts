// Platform compatibility layer for web vs Electron
// Detects if running in Electron or web browser and provides unified API

export const isElectron = typeof window !== 'undefined' && 'electron' in window;
export const isWeb = !isElectron;

export const platform = {
  isElectron,
  isWeb,

  // Platform info
  os: isElectron ? (window as any).electron?.platform : 'web',
  isDev: isElectron ? (window as any).electron?.isDev : false,

  // Feature flags
  features: {
    autoUpdates: isElectron,
    systemTray: isElectron,
    fileSystem: isElectron,
    channels: false, // Disabled for web version
    logs: isWeb, // Web version can show logs via API
  }
};

// Mock Electron API for web mode
if (isWeb && typeof window !== 'undefined') {
  (window as any).electron = {
    platform: 'web',
    isDev: false,
    ipcRenderer: {
      invoke: async (channel: string, ...args: any[]) => {
        console.warn(`IPC call not available in web mode: ${channel}`, args);
        return { success: false, error: 'Not available in web mode' };
      },
      on: (channel: string, _callback: (...args: any[]) => void) => {
        console.warn(`IPC listener not available in web mode: ${channel}`);
        return () => {}; // Return unsubscribe function
      },
    },
  };
}
