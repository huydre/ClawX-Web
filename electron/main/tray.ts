/**
 * System Tray Management
 * Creates and manages the system tray icon and menu
 */
import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron';
import { join } from 'path';

let tray: Tray | null = null;

/**
 * Create system tray icon and menu
 */
export function createTray(mainWindow: BrowserWindow): Tray {
  // Create tray icon
  const iconPath = join(__dirname, '../../resources/icons/tray-icon.png');
  
  // Create a template image for macOS (adds @2x support automatically)
  let icon = nativeImage.createFromPath(iconPath);
  
  // If icon doesn't exist, create a simple placeholder
  if (icon.isEmpty()) {
    // Create a simple 16x16 icon as placeholder
    icon = nativeImage.createEmpty();
  }
  
  // On macOS, set as template image for proper dark/light mode support
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  
  tray = new Tray(icon);
  
  // Set tooltip
  tray.setToolTip('ClawX - AI Assistant');
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show ClawX',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Gateway Status',
      enabled: false,
    },
    {
      label: '  Running',
      type: 'checkbox',
      checked: true,
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: 'Quick Actions',
      submenu: [
        {
          label: 'Open Dashboard',
          click: () => {
            mainWindow.show();
            mainWindow.webContents.send('navigate', '/');
          },
        },
        {
          label: 'Open Chat',
          click: () => {
            mainWindow.show();
            mainWindow.webContents.send('navigate', '/chat');
          },
        },
        {
          label: 'Open Settings',
          click: () => {
            mainWindow.show();
            mainWindow.webContents.send('navigate', '/settings');
          },
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: 'Check for Updates...',
      click: () => {
        mainWindow.webContents.send('update:check');
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit ClawX',
      click: () => {
        app.quit();
      },
    },
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Click to show window (Windows/Linux)
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  // Double-click to show window (Windows)
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  
  return tray;
}

/**
 * Update tray tooltip with Gateway status
 */
export function updateTrayStatus(status: string): void {
  if (tray) {
    tray.setToolTip(`ClawX - ${status}`);
  }
}

/**
 * Destroy tray icon
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
