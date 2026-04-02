/**
 * CrossAgentSettings — Toggle for cross-agent communication
 * Sets tools.sessions.visibility and tools.agentToAgent in openclaw.json
 */
import { useState, useEffect } from 'react';
import { Eye, Users, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export function CrossAgentSettings() {
  const { t } = useTranslation('agents');
  const [visibility, setVisibility] = useState('tree');
  const [agentToAgent, setAgentToAgent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getCrossAgentConfig()
      .then((data) => {
        setVisibility(data.sessionsVisibility || 'tree');
        setAgentToAgent(data.agentToAgentEnabled || false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleVisibilityChange = async (value: string) => {
    setVisibility(value);
    setSaving(true);
    try {
      await api.setCrossAgentConfig({ sessionsVisibility: value });
      toast.success(t('crossAgent.saved'));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAgentToAgentToggle = async (enabled: boolean) => {
    setAgentToAgent(enabled);
    setSaving(true);
    try {
      await api.setCrossAgentConfig({ agentToAgentEnabled: enabled });
      toast.success(t('crossAgent.saved'));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-muted-foreground" />
          {t('crossAgent.title')}
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>

        {/* Session Visibility */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label className="text-sm flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              {t('crossAgent.visibility')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('crossAgent.visibilityDesc')}</p>
          </div>
          <div className="flex rounded-lg border overflow-hidden shrink-0">
            {['self', 'tree', 'agent', 'all'].map((v) => (
              <button
                key={v}
                onClick={() => handleVisibilityChange(v)}
                disabled={saving}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  'hover:bg-accent disabled:opacity-50',
                  visibility === v
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground',
                )}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Agent-to-Agent */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label className="text-sm flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {t('crossAgent.agentToAgent')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('crossAgent.agentToAgentDesc')}</p>
          </div>
          <Switch
            checked={agentToAgent}
            onCheckedChange={handleAgentToAgentToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
