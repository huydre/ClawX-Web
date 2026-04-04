/**
 * Cron Job Card
 * Displays job info with agent badge, retry tooltip, and history button
 */
import { useState } from 'react';
import {
  Clock, Play, Trash2, Edit, History,
  MessageSquare, Loader2, Timer, Calendar,
  CheckCircle2, XCircle, AlertCircle, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChannelIcon } from '@/components/ui/ChannelIcon';
import { useAgentsStore } from '@/stores/agents';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { parseCronSchedule } from './cron-schedule-helpers';
import type { CronJob } from '@/types/cron';

interface CronJobCardProps {
  job: CronJob;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTrigger: () => Promise<void>;
  onHistory: () => void;
}

export function CronJobCard({ job, onToggle, onEdit, onDelete, onTrigger, onHistory }: CronJobCardProps) {
  const { t } = useTranslation('cron');
  const [triggering, setTriggering] = useState(false);
  const agents = useAgentsStore((s) => s.agents);
  const agent = job.agentId ? agents.find((a) => a.id === job.agentId) : null;

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await onTrigger();
      toast.success(t('toast.triggered'));
    } catch (error) {
      toast.error(`Failed to trigger task: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTriggering(false);
    }
  };

  const handleDelete = () => {
    if (confirm(t('card.deleteConfirm'))) onDelete();
  };

  return (
    <Card className={cn('transition-colors', job.enabled && 'border-primary/30')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className={cn('rounded-full p-2 shrink-0', job.enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted')}>
              <Clock className={cn('h-4 w-4 md:h-5 md:w-5', job.enabled ? 'text-green-600' : 'text-muted-foreground')} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base md:text-lg truncate">{job.name}</CardTitle>
              <CardDescription className="flex items-center gap-1.5 text-xs md:text-sm">
                <Timer className="h-3 w-3 shrink-0" />
                <span className="truncate">{parseCronSchedule(job.schedule)}</span>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <Badge variant={job.enabled ? 'success' : 'secondary'} className="hidden sm:inline-flex text-xs">
              {job.enabled ? t('stats.active') : t('stats.paused')}
            </Badge>
            <Switch checked={job.enabled} onCheckedChange={onToggle} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message Preview */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
          <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground line-clamp-2">{job.message}</p>
        </div>

        {/* Metadata Badges */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs md:text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <ChannelIcon type={job.target?.channelType || 'telegram'} className="h-3.5 w-3.5 shrink-0" />
            {job.target?.channelName || 'Telegram'}
          </span>

          {agent && (
            <Badge variant="outline" className="text-xs">
              {agent.identity?.emoji ? `${agent.identity.emoji} ` : ''}{agent.name || agent.id}
            </Badge>
          )}

          {job.sessionTarget && job.sessionTarget !== 'isolated' && (
            <Badge variant="outline" className="text-xs">
              {t('card.session')}: {job.sessionTarget}
            </Badge>
          )}

          {/* Retry Policy Tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 cursor-help">
                  <Info className="h-3.5 w-3.5" />
                  {t('card.retryPolicy')}
                </span>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs max-w-[200px]">{t('card.retryPolicyDesc')}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {job.lastRun && (
            <span className="flex items-center gap-1">
              <History className="h-4 w-4" />
              {t('card.last')}: {formatRelativeTime(job.lastRun.time)}
              {job.lastRun.success ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
            </span>
          )}

          {job.nextRun && job.enabled && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {t('card.next')}: {new Date(job.nextRun).toLocaleString()}
            </span>
          )}
        </div>

        {/* Last Run Error */}
        {job.lastRun && !job.lastRun.success && job.lastRun.error && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{job.lastRun.error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-1 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={onHistory}>
            <History className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">{t('card.history')}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleTrigger} disabled={triggering}>
            {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">{t('card.runNow')}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Edit</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="ml-1 hidden sm:inline text-destructive">Delete</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
