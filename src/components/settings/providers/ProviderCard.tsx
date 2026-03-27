/**
 * ProviderCard Component
 * Displays a single provider card with edit/delete/default actions
 */
import { useState, useEffect } from 'react';
import {
  Trash2,
  Edit,
  Check,
  X,
  Loader2,
  Star,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SecretInput } from '@/components/common/SecretInput';
import { AsyncButton } from '@/components/common/AsyncButton';
import { type ProviderConfig, type ProviderWithKeyInfo } from '@/stores/providers';
import {
  PROVIDER_TYPE_INFO,
  getProviderIconUrl,
  shouldInvertInDark,
} from '@/lib/providers';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { CodexAccountsList } from './CodexAccountsList';

export interface ProviderCardProps {
  provider: ProviderWithKeyInfo;
  isDefault: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onSaveEdits: (payload: { newApiKey?: string; updates?: Partial<ProviderConfig> }) => Promise<void>;
  onValidateKey: (
    key: string,
    options?: { baseUrl?: string }
  ) => Promise<{ valid: boolean; error?: string }>;
}



export function ProviderCard({
  provider,
  isDefault,
  isEditing,
  onEdit,
  onCancelEdit,
  onDelete,
  onSetDefault,
  onSaveEdits,
  onValidateKey,
}: ProviderCardProps) {
  const { t } = useTranslation('settings');
  const [newKey, setNewKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl || '');
  const [modelId, setModelId] = useState(provider.model || '');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customModel, setCustomModel] = useState(false);

  const typeInfo = PROVIDER_TYPE_INFO.find((t) => t.id === provider.type);
  const canEditConfig = Boolean(typeInfo?.showBaseUrl || typeInfo?.showModelId || typeInfo?.models?.length || typeInfo?.canFetchModels);

  // Live model fetch
  const [fetchedModels, setFetchedModels] = useState<{ id: string; name: string }[] | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);

  const effectiveModels = fetchedModels && fetchedModels.length > 0 ? fetchedModels : typeInfo?.models;
  const hasModelDropdown = (effectiveModels?.length ?? 0) > 0;

  // Fetch models when entering edit mode
  useEffect(() => {
    if (!isEditing || !typeInfo?.canFetchModels) return;
    let cancelled = false;
    const fetchModels = async () => {
      setFetchingModels(true);
      try {
        const resp = await fetch(`/api/providers/models/${provider.type}`);
        if (resp.ok && !cancelled) {
          const data = await resp.json();
          if (data.models?.length > 0) {
            setFetchedModels(data.models);
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setFetchingModels(false);
    };
    fetchModels();
    return () => { cancelled = true; };
  }, [isEditing, provider.type, typeInfo?.canFetchModels]);

  useEffect(() => {
    if (isEditing) {
      setNewKey('');
      setShowKey(false);
      setBaseUrl(provider.baseUrl || '');
      setModelId(provider.model || '');
      // Check if current model is in the list
      if (hasModelDropdown && provider.model) {
        const inList = effectiveModels?.some((m) => m.id === provider.model);
        setCustomModel(!inList);
      } else {
        setCustomModel(false);
      }
    }
  }, [isEditing, provider.baseUrl, provider.model, hasModelDropdown, effectiveModels]);

  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      const payload: { newApiKey?: string; updates?: Partial<ProviderConfig> } = {};

      if (newKey.trim()) {
        setValidating(true);
        const result = await onValidateKey(newKey, {
          baseUrl: baseUrl.trim() || undefined,
        });
        setValidating(false);
        if (!result.valid) {
          toast.error(result.error || t('aiProviders.toast.invalidKey'));
          setSaving(false);
          return;
        }
        payload.newApiKey = newKey.trim();
      }

      const updates: Partial<ProviderConfig> = {};
      if (canEditConfig) {
        if (typeInfo?.showModelId && !modelId.trim()) {
          toast.error(t('aiProviders.toast.modelRequired'));
          setSaving(false);
          return;
        }
        if ((baseUrl.trim() || undefined) !== (provider.baseUrl || undefined)) {
          updates.baseUrl = baseUrl.trim() || undefined;
        }
      }
      if ((modelId.trim() || undefined) !== (provider.model || undefined)) {
        updates.model = modelId.trim() || undefined;
      }
      if (Object.keys(updates).length > 0) {
        payload.updates = updates;
      }

      if (!payload.newApiKey && !payload.updates) {
        onCancelEdit();
        setSaving(false);
        return;
      }

      await onSaveEdits(payload);
      setNewKey('');
      toast.success(t('aiProviders.toast.updated'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t('aiProviders.toast.failedUpdate')}: ${errorMessage}`);
    } finally {
      setSaving(false);
      setValidating(false);
    }
  };

  // Get display name for current model
  const modelDisplayName = provider.model
    ? (typeInfo?.models?.find((m) => m.id === provider.model)?.name || provider.model)
    : null;

  return (
    <Card className={cn(isDefault && 'ring-2 ring-primary')}>
      <CardContent className="p-4">
        {/* Top row: icon + name + model */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {getProviderIconUrl(provider.type) ? (
              <img src={getProviderIconUrl(provider.type)} alt={typeInfo?.name || provider.type} className={cn('h-5 w-5', shouldInvertInDark(provider.type) && 'dark:invert')} />
            ) : (
              <span className="text-xl">{typeInfo?.icon || '⚙️'}</span>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{provider.name}</span>
              </div>
              {modelDisplayName && (
                <span className="text-xs text-muted-foreground">{modelDisplayName}</span>
              )}
            </div>
          </div>
        </div>

        {/* Edit mode */}
        {isEditing ? (
          <div className="space-y-2">
            {/* Model selector */}
            {(hasModelDropdown || typeInfo?.canFetchModels) && (
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  Model
                  {fetchingModels && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                {customModel ? (
                  <div className="flex gap-2">
                    <Input
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                      placeholder="model-id"
                      className="h-9 text-sm"
                    />
                    {hasModelDropdown && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs shrink-0"
                        onClick={() => {
                          setCustomModel(false);
                          setModelId(typeInfo?.defaultModelId || effectiveModels?.[0]?.id || '');
                        }}
                      >
                        List
                      </Button>
                    )}
                  </div>
                ) : hasModelDropdown ? (
                  <select
                    value={modelId}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomModel(true);
                        setModelId('');
                      } else {
                        setModelId(e.target.value);
                      }
                    }}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {!effectiveModels?.some((m) => m.id === modelId) && modelId && (
                      <option value={modelId}>{modelId}</option>
                    )}
                    {effectiveModels?.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                    <option value="__custom__">Custom model...</option>
                  </select>
                ) : (
                  <Input
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    placeholder={typeInfo?.modelIdPlaceholder || 'model-id'}
                    className="h-9 text-sm"
                  />
                )}
              </div>
            )}

            {canEditConfig && (
              <>
                {typeInfo?.showBaseUrl && (
                  <div className="space-y-1">
                    <Label className="text-xs">{t('aiProviders.dialog.baseUrl')}</Label>
                    <Input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="h-9 text-sm"
                    />
                  </div>
                )}
                {typeInfo?.showModelId && (
                  <div className="space-y-1">
                    <Label className="text-xs">{t('aiProviders.dialog.modelId')}</Label>
                    <Input
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                      placeholder={typeInfo.modelIdPlaceholder || 'provider/model-id'}
                      className="h-9 text-sm"
                    />
                  </div>
                )}
              </>
            )}
            {/* API Key — collapsed by default if already configured */}
            {provider.hasKey && !showKey ? (
              <button
                type="button"
                onClick={() => setShowKey(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-1"
              >
                <Key className="h-3 w-3" />
                Change API key
              </button>
            ) : (
              <div className="flex gap-2">
                <SecretInput
                  placeholder={typeInfo?.requiresApiKey ? typeInfo?.placeholder : (typeInfo?.id === 'ollama' ? t('aiProviders.notRequired') : t('aiProviders.card.editKey'))}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  size="sm"
                  fullWidth
                />
                {provider.hasKey && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => { setShowKey(false); setNewKey(''); }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <AsyncButton
                variant="outline"
                size="sm"
                onClick={handleSaveEdits}
                loading={validating || saving}
                icon={<Check className="h-3.5 w-3.5" />}
                disabled={
                  (
                    !newKey.trim()
                    && (baseUrl.trim() || undefined) === (provider.baseUrl || undefined)
                    && (modelId.trim() || undefined) === (provider.model || undefined)
                  )
                  || Boolean(typeInfo?.showModelId && !modelId.trim())
                }
              >
                Save
              </AsyncButton>
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono text-muted-foreground truncate">
                {provider.hasKey
                  ? (provider.keyMasked && provider.keyMasked.length > 12
                    ? `${provider.keyMasked.substring(0, 4)}...${provider.keyMasked.substring(provider.keyMasked.length - 4)}`
                    : provider.keyMasked)
                  : t('aiProviders.card.noKey')}
              </span>
              {provider.hasKey && (
                <Badge variant="secondary" className="text-xs shrink-0">{t('aiProviders.card.configured')}</Badge>
              )}
            </div>
            <div className="flex gap-0.5 shrink-0 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={isDefault ? undefined : onSetDefault}
                title={isDefault ? t('aiProviders.card.default') : t('aiProviders.card.setDefault')}
                disabled={isDefault}
              >
                <Star
                  className={cn(
                    'h-3.5 w-3.5 transition-colors',
                    isDefault
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  )}
                />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title={t('aiProviders.card.editKey')}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete} title={t('aiProviders.card.delete')}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        )}

        {/* Codex multi-account list */}
        {provider.type === 'codex' && <CodexAccountsList />}
      </CardContent>
    </Card >
  );
}
