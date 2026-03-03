/**
 * WebUpdateSettings — Update management for web/VPS deployment
 * Shows current vs latest version, check now, and one-click update.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, Loader2, CheckCircle, AlertCircle, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { ws } from '@/lib/websocket';
import { toast } from 'sonner';

interface VersionInfo {
  localShort: string;
  remoteShort: string;
  remoteMessage: string;
  remoteAuthor: string;
  remoteDate: string;
  updateAvailable: boolean;
  checkedAt: number | null;
}

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'updating' | 'done' | 'error';

export function WebUpdateSettings() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  // Load version info on mount
  useEffect(() => {
    api.getSystemInfo().then((data) => {
      setInfo(data);
      setStatus(data.updateAvailable ? 'available' : 'up-to-date');
    }).catch(() => {});
  }, []);

  // WebSocket listeners
  useEffect(() => {
    const onUpdateInfo = (data: any) => {
      const d = data.info ?? data;
      setInfo(d);
      if (statusRef.current !== 'updating' && statusRef.current !== 'done') {
        setStatus(d.updateAvailable ? 'available' : 'up-to-date');
      }
    };

    const onProgress = (data: any) => {
      const step: string = data.step;
      const line: string = data.line ?? '';

      if (step === 'log' && line) {
        setLogs((prev) => [...prev.slice(-200), line]);
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else if (step === 'done') {
        setStatus('done');
        toast.success('Update complete — server is restarting…');
      } else if (step === 'rollback_done') {
        setStatus('error');
        toast.error('Update failed, rolled back to previous version');
      } else if (step === 'rollback_failed') {
        setStatus('error');
        toast.error('Update failed and rollback also failed — please reinstall manually');
      } else if (step !== 'log') {
        setLogs((prev) => [...prev, `▸ ${step.replace(/_/g, ' ')}…`]);
      }
    };

    ws.on('updateInfo', onUpdateInfo);
    ws.on('system.update.progress', onProgress);
    return () => {
      ws.off('updateInfo', onUpdateInfo);
      ws.off('system.update.progress', onProgress);
    };
  }, []);

  const handleCheck = useCallback(async () => {
    setStatus('checking');
    try {
      const data = await api.checkUpdate();
      setInfo(data);
      setStatus(data.updateAvailable ? 'available' : 'up-to-date');
    } catch {
      setStatus(info?.updateAvailable ? 'available' : 'up-to-date');
      toast.error('Failed to check for updates');
    }
  }, [info]);

  const handleUpdate = useCallback(async () => {
    setLogs([]);
    setStatus('updating');
    try {
      await api.startUpdate();
    } catch {
      setStatus('error');
      toast.error('Failed to start update');
    }
  }, []);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
  };

  const isbusy = status === 'checking' || status === 'updating';

  return (
    <div className="space-y-4">
      {/* Version row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">Current version:</span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
              {info?.localShort ?? '…'}
            </code>
            {info?.updateAvailable ? (
              <Badge variant="warning" className="text-xs">Update available</Badge>
            ) : info ? (
              <Badge variant="success" className="text-xs">Up to date</Badge>
            ) : null}
          </div>

          {info?.updateAvailable && (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Latest:</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  {info.remoteShort}
                </code>
                {info.remoteDate && (
                  <span className="text-xs text-muted-foreground">{formatDate(info.remoteDate)}</span>
                )}
              </div>
              {info.remoteMessage && (
                <p className="text-xs text-muted-foreground">{info.remoteMessage}</p>
              )}
            </div>
          )}

          {info?.checkedAt && (
            <p className="text-xs text-muted-foreground">
              Checked: {new Date(info.checkedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCheck} disabled={isbusy}>
            {status === 'checking'
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <RefreshCw className="h-4 w-4 mr-2" />}
            Check now
          </Button>

          {info?.updateAvailable && !['updating', 'done'].includes(status) && (
            <Button size="sm" onClick={handleUpdate} disabled={isbusy}>
              {status === 'updating'
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <ArrowUpCircle className="h-4 w-4 mr-2" />}
              Update now
            </Button>
          )}
        </div>
      </div>

      {/* Status messages */}
      {status === 'done' && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          Update complete — server is restarting, the page will reload in a few seconds
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Update failed. See log below.
        </div>
      )}

      {/* Progress log */}
      {(status === 'updating' || status === 'done' || status === 'error') && logs.length > 0 && (
        <div className="rounded-lg border bg-black/5 dark:bg-black/30 p-3">
          <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
            {status === 'updating' && <Loader2 className="h-3 w-3 animate-spin" />}
            {status === 'done' && <CheckCircle className="h-3 w-3 text-green-500" />}
            {status === 'error' && <AlertCircle className="h-3 w-3 text-destructive" />}
            Update log
          </p>
          <pre className="text-xs font-mono text-muted-foreground max-h-52 overflow-y-auto whitespace-pre-wrap leading-5 select-text">
            {logs.join('\n')}
          </pre>
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}
