/**
 * Browser Page
 * Virtual browser with noVNC iframe (interactive) + agent-browser dashboard (monitoring).
 */
import { useEffect, useState, useRef } from 'react';
import { Globe, Play, Square, Monitor, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { useBrowserStore } from '@/stores/browser';
import { BrowserControls } from './BrowserControls';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

/** Status badge color mapping */
const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500',
  starting: 'bg-yellow-500',
  stopping: 'bg-orange-500',
  stopped: 'bg-gray-500',
  error: 'bg-red-500',
};

export function Browser() {
  const { t } = useTranslation('browser');
  const {
    state, loading, activeTab,
    fetchStatus, start, stop, navigate, markHumanInput, setActiveTab,
  } = useBrowserStore();

  const [urlInput, setUrlInput] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Detect human interaction via iframe focus (Phase 5 proxy)
  useEffect(() => {
    if (state.status !== 'running') return;

    const interval = setInterval(() => {
      if (document.activeElement === iframeRef.current) {
        markHumanInput();
      }
    }, 2000);

    const handleMouseEnter = () => markHumanInput();
    const iframe = iframeRef.current;
    iframe?.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      clearInterval(interval);
      iframe?.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [state.status, markHumanInput]);

  // Build iframe URLs
  const serverHost = window.location.hostname;
  const isLan = serverHost.match(/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|localhost|127\.0\.0\.1)/);
  // LAN: connect directly to noVNC on port 6080
  // Tunnel: proxy through /vnc/ on same origin
  const vncUrl = isLan
    ? `http://${serverHost}:6080/vnc.html?autoconnect=1&resize=scale`
    : `/vnc/vnc.html?autoconnect=1&resize=scale&path=vnc/websockify`;
  const dashUrl = `http://${serverHost}:4848`;

  const handleGo = async () => {
    if (!urlInput.trim()) return;
    const url = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
    await navigate(url);
  };

  return (
    <div className="flex-1 flex flex-col gap-3 p-4 md:p-6 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Globe className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">{t('title')}</h1>

        <Badge className={cn('text-white text-[10px]', STATUS_COLORS[state.status] || 'bg-gray-500')}>
          {state.status}
        </Badge>

        <div className="flex-1" />

        {state.status === 'stopped' || state.status === 'error' ? (
          <Button onClick={start} disabled={loading} size="sm">
            <Play className="h-4 w-4 mr-1.5" />
            {t('start')}
          </Button>
        ) : (
          <Button onClick={stop} disabled={loading} variant="outline" size="sm">
            <Square className="h-4 w-4 mr-1.5" />
            {t('stop')}
          </Button>
        )}
      </div>

      {/* URL bar (only when running) */}
      {state.status === 'running' && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGo()}
            placeholder={t('url_placeholder')}
            className={cn(
              'flex h-9 flex-1 rounded-md border border-input bg-background',
              'px-3 py-1 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          />
          <Button onClick={handleGo} size="sm">
            {t('go')}
          </Button>
        </div>
      )}

      {/* Tab bar */}
      {state.status === 'running' && (
        <div className="flex gap-1 border-b">
          <button
            onClick={() => setActiveTab('browser')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'browser'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Monitor className="h-4 w-4" />
            {t('tab.browser')}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'activity'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Activity className="h-4 w-4" />
            {t('tab.activity')}
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Iframe area */}
        <div className={cn(
          'flex-1 border rounded-lg overflow-hidden bg-black relative',
          state.lockOwner === 'agent' && 'ring-2 ring-blue-500/50'
        )}>
          {state.status === 'running' ? (
            <>
              {activeTab === 'browser' && (
                <iframe
                  ref={iframeRef}
                  src={vncUrl}
                  className="w-full h-full"
                  title="Virtual Browser"
                />
              )}
              {activeTab === 'activity' && (
                <iframe
                  src={dashUrl}
                  className="w-full h-full"
                  title="Activity Feed"
                />
              )}
            </>
          ) : state.status === 'starting' ? (
            <div className="flex items-center justify-center h-full text-muted-foreground gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              <span>{t('starting')}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={<Globe className="h-12 w-12" />}
                title={t('not_running')}
                size="lg"
              />
            </div>
          )}
        </div>

        {/* Controls panel (only when running) */}
        {state.status === 'running' && <BrowserControls />}
      </div>
    </div>
  );
}
