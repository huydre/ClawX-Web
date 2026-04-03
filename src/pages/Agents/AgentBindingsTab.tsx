/**
 * AgentBindingsTab — Manage channel bindings for a specific agent
 * Bindings route incoming messages from channels to this agent.
 *
 * Config format in openclaw.json:
 *   bindings: [{ agentId: "x", match: { channel: "whatsapp", accountId?, peer? } }]
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
  { value: 'signal', label: 'Signal' },
  { value: 'feishu', label: 'Feishu / Lark' },
  { value: 'imessage', label: 'iMessage' },
  { value: 'matrix', label: 'Matrix' },
  { value: 'line', label: 'LINE' },
  { value: 'msteams', label: 'Microsoft Teams' },
  { value: 'googlechat', label: 'Google Chat' },
  { value: 'mattermost', label: 'Mattermost' },
  { value: 'openzalo', label: 'Zalo' },
];

const PEER_KIND_OPTIONS = [
  { value: '', label: 'None (all)' },
  { value: 'direct', label: 'Direct Message' },
  { value: 'group', label: 'Group' },
  { value: 'channel', label: 'Channel' },
];

interface Binding {
  channel: string;
  accountId: string;
  peerKind: string;
  peerId: string;
}

interface AgentBindingsTabProps {
  agentId: string;
}

export function AgentBindingsTab({ agentId }: AgentBindingsTabProps) {
  const { t } = useTranslation('agents');
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getAgentBindings(agentId)
      .then((data) => {
        const parsed: Binding[] = (data.bindings || []).map((b) => ({
          channel: b.match?.channel || '',
          accountId: b.match?.accountId || '',
          peerKind: b.match?.peer?.kind || '',
          peerId: b.match?.peer?.id || '',
        }));
        setBindings(parsed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  const addBinding = () => {
    setBindings([...bindings, { channel: 'telegram', accountId: '', peerKind: '', peerId: '' }]);
    setDirty(true);
  };

  const removeBinding = (index: number) => {
    setBindings(bindings.filter((_, i) => i !== index));
    setDirty(true);
  };

  const updateBinding = (index: number, field: keyof Binding, value: string) => {
    setBindings(bindings.map((b, i) => i === index ? { ...b, [field]: value } : b));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const apiBindings = bindings
        .filter((b) => b.channel) // must have channel
        .map((b) => {
          const match: Record<string, unknown> = { channel: b.channel };
          if (b.accountId.trim()) match.accountId = b.accountId.trim();
          if (b.peerKind && b.peerId.trim()) {
            match.peer = { kind: b.peerKind, id: b.peerId.trim() };
          }
          return { match };
        });

      await api.setAgentBindings(agentId, apiBindings);
      setDirty(false);
      toast.success(t('bindings.saved'));
    } catch (err) {
      toast.error(t('bindings.saveError') + ': ' + String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t('bindings.description')}
      </p>

      {bindings.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
          {t('bindings.empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {bindings.map((binding, index) => (
            <div
              key={index}
              className="rounded-lg border bg-muted/30 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('bindings.rule')} #{index + 1}
                </span>
                <button
                  onClick={() => removeBinding(index)}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/30 text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Channel */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('bindings.channel')}</Label>
                  <Select
                    value={binding.channel}
                    onChange={(e) => updateBinding(index, 'channel', e.target.value)}
                    className="text-xs"
                  >
                    {CHANNEL_OPTIONS.map((ch) => (
                      <option key={ch.value} value={ch.value}>{ch.label}</option>
                    ))}
                  </Select>
                </div>

                {/* Account ID */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('bindings.accountId')}</Label>
                  <Input
                    value={binding.accountId}
                    onChange={(e) => updateBinding(index, 'accountId', e.target.value)}
                    placeholder={t('bindings.accountIdHint')}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Peer Kind */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('bindings.peerKind')}</Label>
                  <Select
                    value={binding.peerKind}
                    onChange={(e) => updateBinding(index, 'peerKind', e.target.value)}
                    className="text-xs"
                  >
                    {PEER_KIND_OPTIONS.map((pk) => (
                      <option key={pk.value} value={pk.value}>{pk.label}</option>
                    ))}
                  </Select>
                </div>

                {/* Peer ID */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('bindings.peerId')}</Label>
                  <Input
                    value={binding.peerId}
                    onChange={(e) => updateBinding(index, 'peerId', e.target.value)}
                    placeholder={t('bindings.peerIdHint')}
                    className="text-xs h-9"
                    disabled={!binding.peerKind}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-1">
        <Button size="sm" variant="outline" onClick={addBinding}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t('bindings.add')}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? t('detail.saving') : t('common:actions.save')}
        </Button>
      </div>
    </div>
  );
}
