/** Cron Task Dialog — create/edit form with agent, one-shot, session pickers */
import { useState, useEffect } from 'react';
import { X, CheckCircle2, Loader2, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { useChannelsStore } from '@/stores/channels';
import { useAgentsStore } from '@/stores/agents';
import { ChannelIcon } from '@/components/ui/ChannelIcon';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { schedulePresets, extractCronExpr } from './cron-schedule-helpers';
import type { CronJob, CronJobCreateInput, ScheduleMode, SessionTarget } from '@/types/cron';

interface KnownRecipient { id: string; label: string; }

interface Props { job?: CronJob; onClose: () => void; onSave: (input: CronJobCreateInput) => Promise<void>; }

export function CronTaskDialog({ job, onClose, onSave }: Props) {
  const { t } = useTranslation('cron');
  const { channels } = useChannelsStore();
  const { agents, defaultId, fetchAgents } = useAgentsStore();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(job?.name || '');
  const [message, setMessage] = useState(job?.message || '');
  const [schedule, setSchedule] = useState(extractCronExpr(job?.schedule));
  const [customSchedule, setCustomSchedule] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const isOneShot = job?.schedule && typeof job.schedule === 'object' && 'at' in job.schedule;
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(isOneShot ? 'one-time' : 'recurring');
  const [oneTimeDate, setOneTimeDate] = useState(isOneShot ? (job!.schedule as { at: string }).at.slice(0, 16) : '');
  const [agentId, setAgentId] = useState(job?.agentId || defaultId || '');
  const [sessionTarget, setSessionTarget] = useState<SessionTarget>(job?.sessionTarget || 'isolated');
  const [customSessionName, setCustomSessionName] = useState(
    job?.sessionTarget && job.sessionTarget !== 'isolated' && job.sessionTarget !== 'main'
      ? job.sessionTarget.replace('session:', '') : ''
  );
  const initChId = job?.target?.channelId || (job?.target?.channelType ? channels.find(c => c.type === job.target.channelType)?.id : '') || '';
  const [channelId, setChannelId] = useState(initChId);
  const [recipientId, setRecipientId] = useState(job?.target?.channelId || '');
  const [enabled, setEnabled] = useState(job?.enabled ?? true);
  const selectedChannel = channels.find((c) => c.id === channelId);
  const isDiscord = selectedChannel?.type === 'discord';
  const isTelegram = selectedChannel?.type === 'telegram';
  const needsRecipientId = isDiscord || isTelegram;

  const [knownRecipients, setKnownRecipients] = useState<KnownRecipient[]>([]);
  const [useManualId, setUseManualId] = useState(false);

  useEffect(() => { if (agents.length === 0) fetchAgents(); }, [agents.length, fetchAgents]);
  useEffect(() => { if (!agentId && defaultId) setAgentId(defaultId); }, [defaultId, agentId]);

  // Fetch known recipients from sessions.list when channel changes
  useEffect(() => {
    if (!selectedChannel) return;
    const chType = selectedChannel.type;
    if (chType !== 'telegram' && chType !== 'discord') { setKnownRecipients([]); return; }
    (async () => {
      try {
        const result = await api.gatewayRpc('sessions.list', { limit: 100 });
        if (!result.success || !result.result) return;
        const sessions = Array.isArray(result.result.sessions) ? result.result.sessions : [];
        const recipients: KnownRecipient[] = [];
        const seen = new Set<string>();
        for (const s of sessions) {
          const key = String(s.key || '');
          if (!key.startsWith(`${chType}:`)) continue;
          const id = key.split(':')[1];
          if (!id || seen.has(id)) continue;
          seen.add(id);
          recipients.push({ id, label: s.displayName || s.label || id });
        }
        setKnownRecipients(recipients);
      } catch { setKnownRecipients([]); }
    })();
  }, [selectedChannel]);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error(t('toast.nameRequired')); return; }
    if (!message.trim()) { toast.error(t('toast.messageRequired')); return; }
    if (!channelId) { toast.error(t('toast.channelRequired')); return; }
    if (needsRecipientId && !recipientId.trim()) { toast.error(isTelegram ? t('toast.recipientIdRequired') : t('toast.discordIdRequired')); return; }
    let finalSchedule: string | { kind: 'at'; at: string };
    if (scheduleMode === 'one-time') {
      if (!oneTimeDate) { toast.error(t('toast.scheduleRequired')); return; }
      finalSchedule = { kind: 'at', at: new Date(oneTimeDate).toISOString() };
    } else {
      const cronExpr = useCustom ? customSchedule : schedule;
      if (!cronExpr.trim()) { toast.error(t('toast.scheduleRequired')); return; }
      finalSchedule = cronExpr;
    }
    const resolvedSession: SessionTarget = sessionTarget === 'isolated' || sessionTarget === 'main'
      ? sessionTarget : `session:${customSessionName || 'custom'}`;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(), message: message.trim(), schedule: finalSchedule,
        target: { channelType: selectedChannel?.type || 'telegram', channelId: needsRecipientId ? recipientId.trim() : '', channelName: selectedChannel?.name || 'Telegram' },
        agentId: agentId || undefined, sessionTarget: resolvedSession, enabled,
      });
      onClose();
      toast.success(job ? t('toast.updated') : t('toast.created'));
    } catch (err) { toast.error(String(err)); } finally { setSaving(false); }
  };

  const isCustomSession = sessionTarget !== 'isolated' && sessionTarget !== 'main';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{job ? t('dialog.editTitle') : t('dialog.createTitle')}</CardTitle>
            <CardDescription>{t('dialog.description')}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('dialog.taskName')}</Label>
            <Input placeholder={t('dialog.taskNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('dialog.agent')}</Label>
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">{t('dialog.agentPlaceholder')}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.identity?.emoji ? `${a.identity.emoji} ` : ''}{a.name || a.id}{a.isDefault ? ` ${t('dialog.agentDefault')}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('dialog.message')}</Label>
            <Textarea placeholder={t('dialog.messagePlaceholder')} value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>{t('dialog.scheduleMode')}</Label>
            <div className="flex gap-2">
              {(['recurring', 'one-time'] as const).map((m) => (
                <Button key={m} type="button" variant={scheduleMode === m ? 'default' : 'outline'} size="sm" onClick={() => setScheduleMode(m)}>
                  {t(m === 'recurring' ? 'dialog.recurring' : 'dialog.oneTime')}
                </Button>
              ))}
            </div>
          </div>
          {scheduleMode === 'recurring' ? (
            <div className="space-y-2">
              <Label>{t('dialog.schedule')}</Label>
              {!useCustom ? (
                <div className="grid grid-cols-2 gap-2">
                  {schedulePresets.map((p) => (
                    <Button key={p.value} type="button" variant={schedule === p.value ? 'default' : 'outline'} size="sm" onClick={() => setSchedule(p.value)} className="justify-start">
                      <Timer className="h-4 w-4 mr-2" />{t(`presets.${p.i18nKey}`)}
                    </Button>
                  ))}
                </div>
              ) : (
                <Input placeholder={t('dialog.cronPlaceholder')} value={customSchedule} onChange={(e) => setCustomSchedule(e.target.value)} />
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => setUseCustom(!useCustom)} className="text-xs">
                {useCustom ? t('dialog.usePresets') : t('dialog.useCustomCron')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t('dialog.dateTime')}</Label>
              <Input type="datetime-local" value={oneTimeDate} onChange={(e) => setOneTimeDate(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
              <p className="text-xs text-muted-foreground">{t('dialog.dateTimeDesc')}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('dialog.sessionType')}</Label>
            <div className="flex gap-2">
              {(['isolated', 'main', 'custom'] as const).map((st) => (
                <Button key={st} type="button" variant={(st === 'custom' ? isCustomSession : sessionTarget === st) ? 'default' : 'outline'} size="sm"
                  onClick={() => setSessionTarget(st === 'custom' ? `session:${customSessionName || 'custom'}` : st)}>
                  {t(`dialog.session${st.charAt(0).toUpperCase() + st.slice(1)}`)}
                </Button>
              ))}
            </div>
            {isCustomSession && (
              <Input placeholder={t('dialog.sessionNamePlaceholder')} value={customSessionName}
                onChange={(e) => { setCustomSessionName(e.target.value); setSessionTarget(`session:${e.target.value || 'custom'}`); }} />
            )}
            <p className="text-xs text-muted-foreground">
              {sessionTarget === 'main' ? t('dialog.sessionMainDesc') : sessionTarget === 'isolated' ? t('dialog.sessionIsolatedDesc') : t('dialog.sessionCustomDesc')}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t('dialog.targetChannel')}</Label>
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dialog.noChannels')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {channels.map((ch) => (
                  <Button key={ch.id} type="button" variant={channelId === ch.id ? 'default' : 'outline'} size="sm" onClick={() => setChannelId(ch.id)} className="justify-start">
                    <ChannelIcon type={ch.type} className="h-4 w-4 mr-2 shrink-0" />{ch.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
          {needsRecipientId && (
            <div className="space-y-2">
              <Label>{isTelegram ? t('dialog.telegramChatId') : t('dialog.discordChannelId')}</Label>
              {knownRecipients.length > 0 && !useManualId ? (
                <>
                  <Select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
                    <option value="">{t('dialog.selectRecipient')}</option>
                    {knownRecipients.map((r) => (
                      <option key={r.id} value={r.id}>{r.label} ({r.id})</option>
                    ))}
                  </Select>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setUseManualId(true)} className="text-xs">
                    {t('dialog.enterManually')}
                  </Button>
                </>
              ) : (
                <>
                  <Input value={recipientId} onChange={(e) => setRecipientId(e.target.value)}
                    placeholder={isTelegram ? t('dialog.telegramChatIdPlaceholder') : t('dialog.discordChannelIdPlaceholder')} />
                  {knownRecipients.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setUseManualId(false)} className="text-xs">
                      {t('dialog.selectFromList')}
                    </Button>
                  )}
                </>
              )}
              <p className="text-xs text-muted-foreground">
                {isTelegram ? t('dialog.telegramChatIdDesc') : t('dialog.discordChannelIdDesc')}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('dialog.enableImmediately')}</Label>
              <p className="text-sm text-muted-foreground">{t('dialog.enableImmediatelyDesc')}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : (<><CheckCircle2 className="h-4 w-4 mr-2" />{job ? t('dialog.saveChanges') : t('dialog.createTitle')}</>)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
