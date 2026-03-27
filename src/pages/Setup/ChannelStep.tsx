import { useState, useEffect } from 'react';
import {
  Check,
  ChevronLeft,
  Loader2,
  BookOpen,
  ExternalLink,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecretInput } from '@/components/common/SecretInput';
import { ChannelIcon } from '@/components/ui/ChannelIcon';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { platform } from '@/lib/platform';
import {
  CHANNEL_META,
  getPrimaryChannels,
  type ChannelType,
  type ChannelMeta,
  type ChannelConfigField,
} from '@/types/channel';

export function SetupChannelContent() {
  const { t } = useTranslation(['setup', 'channels']);
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const meta: ChannelMeta | null = selectedChannel ? CHANNEL_META[selectedChannel] : null;
  const primaryChannels = getPrimaryChannels();

  useEffect(() => {
    if (!selectedChannel) return;
    if (!platform.isElectron) {
      // Web mode: channel config is handled from the Channels page
      setConfigValues({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke(
          'channel:getFormValues',
          selectedChannel
        ) as { success: boolean; values?: Record<string, string> };
        if (cancelled) return;
        if (result.success && result.values) {
          setConfigValues(result.values);
        } else {
          setConfigValues({});
        }
      } catch {
        if (!cancelled) {
          setConfigValues({});
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedChannel]);

  const isFormValid = () => {
    if (!meta) return false;
    return meta.configFields
      .filter((f: ChannelConfigField) => f.required)
      .every((f: ChannelConfigField) => configValues[f.key]?.trim());
  };

  const handleSave = async () => {
    if (!selectedChannel || !meta || !isFormValid()) return;

    setSaving(true);
    setValidationError(null);

    try {
      if (!platform.isElectron) {
        // Web mode: channel config is not available in setup — direct user to Channels page
        toast.info('Channel configuration is available in the Channels page after setup.');
        setSaved(true);
        setSaving(false);
        return;
      }

      // Validate credentials first
      const validation = await window.electron.ipcRenderer.invoke(
        'channel:validateCredentials',
        selectedChannel,
        configValues
      ) as { success: boolean; valid?: boolean; errors?: string[]; details?: Record<string, string> };

      if (!validation.valid) {
        setValidationError((validation.errors || ['Validation failed']).join(', '));
        setSaving(false);
        return;
      }

      // Save config
      await window.electron.ipcRenderer.invoke('channel:saveConfig', selectedChannel, { ...configValues });

      const botName = validation.details?.botUsername ? ` (@${validation.details.botUsername})` : '';
      toast.success(`${meta.name} configured${botName}`);
      setSaved(true);
    } catch (error) {
      setValidationError(String(error));
    } finally {
      setSaving(false);
    }
  };

  // Already saved — show success
  if (saved) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-semibold">
          {t('channel.connected', { name: meta?.name || 'Channel' })}
        </h2>
        <p className="text-muted-foreground">
          {t('channel.connectedDesc')}
        </p>
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            setSaved(false);
            setSelectedChannel(null);
            setConfigValues({});
          }}
        >
          {t('channel.configureAnother')}
        </Button>
      </div>
    );
  }

  // Channel type not selected — show picker
  if (!selectedChannel) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-2">
          <div className="text-4xl mb-3">📡</div>
          <h2 className="text-xl font-semibold">{t('channel.title')}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {t('channel.subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {primaryChannels.map((type) => {
            const channelMeta = CHANNEL_META[type];
            if (channelMeta.connectionType !== 'token') return null;
            return (
              <button
                key={type}
                onClick={() => setSelectedChannel(type)}
                className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-all text-left"
              >
                <ChannelIcon type={type} className="h-8 w-8" />
                <p className="font-medium mt-2">{channelMeta.name}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {t(channelMeta.description)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Channel selected — show config form
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => { setSelectedChannel(null); setConfigValues({}); setValidationError(null); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {meta && <ChannelIcon type={meta.id} className="h-5 w-5" />} {t('channel.configure', { name: meta?.name })}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{t(meta?.description || '')}</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-3 rounded-lg bg-muted/50 text-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-foreground">{t('channel.howTo')}</p>
          {meta?.docsUrl && (
            <button
              onClick={() => {
                try {
                  const url = t(meta.docsUrl!);
                  if (window.electron?.openExternal) {
                    window.electron.openExternal(url);
                  } else {
                    window.open(url, '_blank');
                  }
                } catch {
                  // ignore
                }
              }}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              {t('channel.viewDocs')}
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
        <ol className="list-decimal list-inside text-muted-foreground space-y-1">
          {meta?.instructions.map((inst, i) => (
            <li key={i}>{t(inst)}</li>
          ))}
        </ol>
      </div>

      {/* Config fields */}
      {meta?.configFields.map((field: ChannelConfigField) => {
        const isPassword = field.type === 'password';
        const isSelect = field.type === 'select';
        return (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`setup-${field.key}`} className="text-foreground">
              {t(field.label)}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            {isSelect && field.options ? (
              <select
                id={`setup-${field.key}`}
                value={configValues[field.key] || ''}
                onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{field.placeholder ? t(field.placeholder) : '-- Select --'}</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : isPassword ? (
              <SecretInput
                id={`setup-${field.key}`}
                placeholder={field.placeholder ? t(field.placeholder) : undefined}
                value={configValues[field.key] || ''}
                onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                autoComplete="off"
                className="font-mono text-sm bg-background border-input"
                fullWidth
              />
            ) : (
              <Input
                id={`setup-${field.key}`}
                placeholder={field.placeholder ? t(field.placeholder) : undefined}
                value={configValues[field.key] || ''}
                onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                autoComplete="off"
                className="font-mono text-sm bg-background border-input"
              />
            )}
            {field.description && (
              <p className="text-xs text-slate-500 mt-1">{t(field.description)}</p>
            )}
          </div>
        );
      })}

      {/* Validation error */}
      {validationError && (
        <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-sm text-red-300 flex items-start gap-2">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Save button */}
      <Button
        className="w-full"
        onClick={handleSave}
        disabled={!isFormValid() || saving}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t('provider.validateSave')}
          </>
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            {t('provider.validateSave')}
          </>
        )}
      </Button>
    </div>
  );
}
