/**
 * Cron Page
 * Orchestrator for scheduled tasks management
 */
import { useEffect, useState, useCallback } from 'react';
import { Plus, Clock, Play, Pause, RefreshCw, AlertCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCronStore } from '@/stores/cron';
import { useChannelsStore } from '@/stores/channels';
import { useGatewayStore } from '@/stores/gateway';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { CronTaskDialog } from '@/components/cron/cron-task-dialog';
import { CronJobCard } from '@/components/cron/cron-job-card';
import { CronRunsDrawer } from '@/components/cron/cron-runs-drawer';
import type { CronJob, CronJobCreateInput } from '@/types/cron';

export function Cron() {
  const { t } = useTranslation('cron');
  const { jobs, loading, error, selectedJobId, fetchJobs, createJob, updateJob, toggleJob, deleteJob, triggerJob, selectJob, clearSelection } = useCronStore();
  const { fetchChannels } = useChannelsStore();
  const isGatewayRunning = useGatewayStore((state) => state.isRunning());
  const [showDialog, setShowDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | undefined>();

  useEffect(() => {
    if (isGatewayRunning) {
      fetchJobs();
      fetchChannels();
    }
  }, [fetchJobs, fetchChannels, isGatewayRunning]);

  const activeJobs = jobs.filter((j) => j.enabled);
  const pausedJobs = jobs.filter((j) => !j.enabled);
  const failedJobs = jobs.filter((j) => j.lastRun && !j.lastRun.success);

  const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) : undefined;

  const handleSave = useCallback(async (input: CronJobCreateInput) => {
    if (editingJob) {
      await updateJob(editingJob.id, input);
    } else {
      await createJob(input);
    }
  }, [editingJob, createJob, updateJob]);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    try {
      await toggleJob(id, enabled);
      toast.success(enabled ? t('toast.enabled') : t('toast.paused'));
    } catch {
      toast.error(t('toast.failedUpdate'));
    }
  }, [toggleJob, t]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteJob(id);
      toast.success(t('toast.deleted'));
    } catch {
      toast.error(t('toast.failedDelete'));
    }
  }, [deleteJob, t]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-16 md:pb-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="icon" className="md:hidden" onClick={fetchJobs} disabled={!isGatewayRunning}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="hidden md:flex" onClick={fetchJobs} disabled={!isGatewayRunning}>
            <RefreshCw className="h-4 w-4 mr-2" />{t('refresh')}
          </Button>
          <Button onClick={() => { setEditingJob(undefined); setShowDialog(true); }} disabled={!isGatewayRunning}>
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">{t('newTask')}</span>
          </Button>
        </div>
      </div>

      {/* Gateway Warning */}
      {!isGatewayRunning && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-700 dark:text-yellow-400">{t('gatewayWarning')}</span>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { icon: Clock, count: jobs.length, label: t('stats.total'), bg: 'bg-primary/10', color: 'text-primary' },
          { icon: Play, count: activeJobs.length, label: t('stats.active'), bg: 'bg-green-100 dark:bg-green-900/30', color: 'text-green-600' },
          { icon: Pause, count: pausedJobs.length, label: t('stats.paused'), bg: 'bg-yellow-100 dark:bg-yellow-900/30', color: 'text-yellow-600' },
          { icon: XCircle, count: failedJobs.length, label: t('stats.failed'), bg: 'bg-red-100 dark:bg-red-900/30', color: 'text-red-600' },
        ].map(({ icon: Icon, count, label, bg, color }) => (
          <Card key={label}>
            <CardContent className="p-4 md:pt-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className={`rounded-full p-2 md:p-3 shrink-0 ${bg}`}>
                  <Icon className={`h-5 w-5 md:h-6 md:w-6 ${color}`} />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold">{count}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />{error}
          </CardContent>
        </Card>
      )}

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('empty.title')}</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">{t('empty.description')}</p>
            <Button onClick={() => { setEditingJob(undefined); setShowDialog(true); }} disabled={!isGatewayRunning}>
              <Plus className="h-4 w-4 mr-2" />{t('empty.create')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <CronJobCard
              key={job.id}
              job={job}
              onToggle={(enabled) => handleToggle(job.id, enabled)}
              onEdit={() => { setEditingJob(job); setShowDialog(true); }}
              onDelete={() => handleDelete(job.id)}
              onTrigger={() => triggerJob(job.id)}
              onHistory={() => selectJob(job.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {showDialog && (
        <CronTaskDialog
          job={editingJob}
          onClose={() => { setShowDialog(false); setEditingJob(undefined); }}
          onSave={handleSave}
        />
      )}

      {/* Runs History Drawer */}
      <CronRunsDrawer
        jobId={selectedJobId}
        jobName={selectedJob?.name}
        lastRun={selectedJob?.lastRun}
        onClose={clearSelection}
      />
    </div>
  );
}

export default Cron;
