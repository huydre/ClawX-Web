import { useState, useEffect } from 'react';
import {
  Plus,
  Loader2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ModalDialog } from '@/components/common/ModalDialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAgentsStore } from '@/stores/agents';
import {
  CHANNEL_NAMES,
  type Channel,
} from '@/types/channel';
import { toast } from 'sonner';

interface ChannelSettingsPanelProps {
  channel: Channel;
  onClose: () => void;
}

export function ChannelSettingsPanel({ channel, onClose }: ChannelSettingsPanelProps) {
  const { t } = useTranslation('channels');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupPolicy, setGroupPolicy] = useState('allowlist');
  const [pairingPolicy, setPairingPolicy] = useState('code');
  const [allowFrom, setAllowFrom] = useState<string[]>([]);
  const [groupAllowFrom, setGroupAllowFrom] = useState<string[]>([]);
  const [newAllowFrom, setNewAllowFrom] = useState('');
  const [newGroupAllowFrom, setNewGroupAllowFrom] = useState('');
  const [boundAgentId, setBoundAgentId] = useState('');

  // Load agents for the dropdown
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/channel-config/${channel.type}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        setGroupPolicy(data.groupPolicy || 'allowlist');
        setPairingPolicy(data.pairingPolicy || 'code');
        setAllowFrom(data.allowFrom || []);
        setGroupAllowFrom(data.groupAllowFrom || []);
        setBoundAgentId(data.boundAgentId || '');
      } catch {
        toast.error('Failed to load channel config');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [channel.type]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/channel-config/${channel.type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupPolicy, pairingPolicy, allowFrom, groupAllowFrom, boundAgentId }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.success) {
        toast.success('Channel config saved');
        onClose();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save channel config');
    } finally {
      setSaving(false);
    }
  };

  const addToList = (list: string[], setList: (v: string[]) => void, value: string, setInput: (v: string) => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput('');
    }
  };

  const removeFromList = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <ModalDialog open={true} onClose={onClose} maxWidth="lg">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      </ModalDialog>
    );
  }

  return (
    <ModalDialog
      open={true}
      onClose={onClose}
      title={`${t('settings.title')} — ${CHANNEL_NAMES[channel.type]}`}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t('settings.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('settings.save')}
          </Button>
        </>
      }
    >
        <div className="space-y-5">
          {/* Agent Binding */}
          <div className="space-y-2">
            <Label className="font-medium">{t('settings.boundAgent')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.boundAgentDesc')}</p>
            <Select
              value={boundAgentId}
              onChange={(e) => setBoundAgentId(e.target.value)}
            >
              <option value="">{t('settings.defaultAgent')}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.identity?.emoji || '🤖'} {a.identity?.name || a.name || a.id}
                </option>
              ))}
            </Select>
          </div>

          {/* Group Policy */}
          <div className="space-y-2">
            <Label className="font-medium">{t('settings.groupPolicy')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.groupPolicyDesc')}</p>
            <div className="flex gap-2">
              <Button
                variant={groupPolicy === 'open' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setGroupPolicy('open')}
              >
                {t('settings.open')}
              </Button>
              <Button
                variant={groupPolicy === 'allowlist' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setGroupPolicy('allowlist')}
              >
                {t('settings.allowlist')}
              </Button>
            </div>
          </div>

          {/* Pairing Policy */}
          <div className="space-y-2">
            <Label className="font-medium">{t('settings.pairingPolicy')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.pairingPolicyDesc')}</p>
            <div className="flex gap-2">
              {(['open', 'code', 'disabled'] as const).map((p) => (
                <Button
                  key={p}
                  variant={pairingPolicy === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPairingPolicy(p)}
                >
                  {t(`settings.${p}`)}
                </Button>
              ))}
            </div>
          </div>

          {/* Allow From (DM) */}
          <div className="space-y-2">
            <Label className="font-medium">{t('settings.allowFrom')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.allowFromDesc')}</p>
            <div className="flex gap-2">
              <Input
                placeholder="User ID"
                value={newAllowFrom}
                onChange={(e) => setNewAllowFrom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToList(allowFrom, setAllowFrom, newAllowFrom, setNewAllowFrom);
                  }
                }}
              />
              <Button size="sm" variant="outline" onClick={() => addToList(allowFrom, setAllowFrom, newAllowFrom, setNewAllowFrom)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {allowFrom.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allowFrom.map((id, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {id}
                    <button onClick={() => removeFromList(allowFrom, setAllowFrom, i)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Group Allow From */}
          <div className="space-y-2">
            <Label className="font-medium">{t('settings.groupAllowFrom')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.groupAllowFromDesc')}</p>
            <div className="flex gap-2">
              <Input
                placeholder="Group ID"
                value={newGroupAllowFrom}
                onChange={(e) => setNewGroupAllowFrom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToList(groupAllowFrom, setGroupAllowFrom, newGroupAllowFrom, setNewGroupAllowFrom);
                  }
                }}
              />
              <Button size="sm" variant="outline" onClick={() => addToList(groupAllowFrom, setGroupAllowFrom, newGroupAllowFrom, setNewGroupAllowFrom)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {groupAllowFrom.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {groupAllowFrom.map((id, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {id}
                    <button onClick={() => removeFromList(groupAllowFrom, setGroupAllowFrom, i)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
    </ModalDialog>
  );
}
