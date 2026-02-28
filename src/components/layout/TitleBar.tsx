/**
 * TitleBar Component
 * macOS: empty drag region (native traffic lights handled by hiddenInset).
 * Windows/Linux: icon + "ClawX" on left, minimize/maximize/close on right.
 * Web: just show app name, no window controls
 */
import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import logoSvg from '@/assets/logo.svg';
import { platform } from '@/lib/platform';
import { api } from '@/lib/api';

const isMac = window.electron?.platform === 'darwin';

function useCurrentModel() {
  const [modelId, setModelId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    api.getCurrentModel()
      .then((data) => {
        setModelId(data.modelId);
        setProvider(data.provider);
      })
      .catch(() => {});
  }, []);

  return { modelId, provider };
}

export function TitleBar() {
  // Web mode: simple header without window controls
  if (platform.isWeb) {
    return <WebTitleBar />;
  }

  if (isMac) {
    // macOS: just a drag region, traffic lights are native
    return <div className="drag-region h-10 shrink-0 border-b bg-background" />;
  }

  return <WindowsTitleBar />;
}

function WebTitleBar() {
  const { modelId, provider } = useCurrentModel();

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b bg-background px-3">
      <div className="flex items-center gap-2">
        <img src={logoSvg} alt="ClawX" className="h-5 w-auto" />
        <span className="text-xs font-medium text-muted-foreground select-none">ClawX</span>
      </div>

      {modelId && (
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
          <span className="hidden sm:inline text-muted-foreground/60">{provider}</span>
          <span className="text-foreground/70 font-medium truncate max-w-[100px] sm:max-w-[180px]">{modelId}</span>
        </div>
      )}
    </div>
  );
}

function WindowsTitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    // Check initial state
    window.electron.ipcRenderer.invoke('window:isMaximized').then((val) => {
      setMaximized(val as boolean);
    });
  }, []);

  const handleMinimize = () => {
    window.electron.ipcRenderer.invoke('window:minimize');
  };

  const handleMaximize = () => {
    window.electron.ipcRenderer.invoke('window:maximize').then(() => {
      window.electron.ipcRenderer.invoke('window:isMaximized').then((val) => {
        setMaximized(val as boolean);
      });
    });
  };

  const handleClose = () => {
    window.electron.ipcRenderer.invoke('window:close');
  };

  return (
    <div className="drag-region flex h-10 shrink-0 items-center justify-between border-b bg-background">
      {/* Left: Icon + App Name */}
      <div className="no-drag flex items-center gap-2 pl-3">
        <img src={logoSvg} alt="ClawX" className="h-5 w-auto" />
        <span className="text-xs font-medium text-muted-foreground select-none">
          ClawX
        </span>
      </div>

      {/* Right: Window Controls */}
      <div className="no-drag flex h-full">
        <button
          onClick={handleMinimize}
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
          title="Minimize"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleClose}
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-red-500 hover:text-white transition-colors"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
