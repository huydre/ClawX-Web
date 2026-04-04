/**
 * Cron Runs Drawer
 * Side panel showing job execution history
 */
import { useEffect, useCallback } from 'react';
import { X, CheckCircle2, XCircle, Loader2, Clock, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCronStore } from '@/stores/cron';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatRelativeTime, cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { CronJobRun } from '@/types/cron';

interface CronRunsDrawerProps {
  jobId: string | null;
  jobName?: string;
  onClose: () => void;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  running: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  retrying: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
};

function RunEntry({ run }: { run: CronJobRun }) {
  const { t } = useTranslation('cron');
  const cfg = statusConfig[run.status] || statusConfig.failed;
  const Icon = cfg.icon;

  return (
    <div className="p-3 rounded-lg border space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('rounded-full p-1', cfg.bg)}>
            <Icon className={cn('h-3.5 w-3.5', cfg.color, run.status === 'running' && 'animate-spin')} />
          </div>
          <Badge variant={run.status === 'success' ? 'success' : 'destructive'} className="text-xs">
            {t(`runs.status.${run.status}`)}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{formatRelativeTime(run.startedAt)}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{t('runs.startedAt')}: {new Date(run.startedAt).toLocaleString()}</span>
        {run.duration != null && <span>{t('runs.duration')}: {(run.duration / 1000).toFixed(1)}s</span>}
        {run.retryCount != null && run.retryCount > 0 && (
          <span>{t('runs.retries')}: {run.retryCount}</span>
        )}
      </div>
      {run.error && (
        <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
          {run.error}
        </div>
      )}
    </div>
  );
}

export function CronRunsDrawer({ jobId, jobName, onClose }: CronRunsDrawerProps) {
  const { t } = useTranslation('cron');
  const { runs, runsLoading, fetchRuns } = useCronStore();
  const isOpen = jobId !== null;

  useEffect(() => {
    if (jobId) fetchRuns(jobId);
  }, [jobId, fetchRuns]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{t('runs.title')}</h3>
            {jobName && <p className="text-sm text-muted-foreground truncate">{jobName}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Retry policy info */}
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>{t('card.retryPolicyDesc')}</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {runsLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mb-3" />
              <p className="text-sm">{t('runs.empty')}</p>
            </div>
          ) : (
            runs.map((run) => <RunEntry key={run.id} run={run} />)
          )}
        </div>
      </div>
    </>
  );
}
