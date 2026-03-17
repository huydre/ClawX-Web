/**
 * Providers Settings Component
 * Manage AI provider configurations and API keys
 */
import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  Star,
  Key,
  Download,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useProviderStore, type ProviderConfig, type ProviderWithKeyInfo } from '@/stores/providers';
import { api } from '@/lib/api';
import {
  PROVIDER_TYPE_INFO,
  type ProviderType,
  getProviderIconUrl,
  shouldInvertInDark,
} from '@/lib/providers';
import { cn } from '@/lib/utils';
import { generateId } from '@/lib/uuid';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function ProvidersSettings() {
  const { t } = useTranslation('settings');
  const {
    providers,
    defaultProviderId,
    loading,
    fetchProviders,
    addProvider,
    deleteProvider,
    updateProviderWithKey,
    setDefaultProvider,
    validateApiKey,
  } = useProviderStore();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [detectedModel, setDetectedModel] = useState<{ provider: string; modelId: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Fetch providers on mount
  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Detect current OpenClaw model when providers list is empty
  useEffect(() => {
    if (!loading && providers.length === 0) {
      api.getCurrentModel()
        .then((data) => {
          if (data.provider && data.modelId) {
            setDetectedModel({ provider: data.provider, modelId: data.modelId });
          }
        })
        .catch(() => { });
    } else {
      setDetectedModel(null);
    }
  }, [loading, providers.length]);

  const handleRestartOpenClaw = async () => {
    setRestarting(true);
    try {
      const result = await api.restartOpenClaw();
      if (result.success) {
        toast.success(`OpenClaw đã khởi động lại (${result.method}). Đang kết nối lại...`);
      } else {
        toast.error(result.error || 'Khởi động lại thất bại');
      }
    } catch (error) {
      toast.error(String(error));
    } finally {
      setTimeout(() => setRestarting(false), 4000);
    }
  };

  const handleImportFromOpenClaw = async () => {
    setImporting(true);
    try {
      const result = await api.importFromOpenClaw();
      if (result.success) {
        const count = result.count || 0;
        const names = result.imported?.map((i) => i.provider).join(', ') || '';
        toast.success(count > 0 ? `Imported ${count} provider(s): ${names}` : 'No new providers to import');
        await fetchProviders();
        setDetectedModel(null);
      } else {
        toast.error(result.error || 'Import thất bại');
      }
    } catch (error) {
      toast.error(String(error));
    } finally {
      setImporting(false);
    }
  };

  const handleAddProvider = async (
    type: ProviderType,
    name: string,
    apiKey: string,
    options?: { baseUrl?: string; model?: string }
  ) => {
    // Only custom supports multiple instances.
    // Built-in providers remain singleton by type.
    const id = type === 'custom' ? `custom-${generateId()}` : type;
    try {
      await addProvider(
        {
          id,
          type,
          name,
          baseUrl: options?.baseUrl,
          model: options?.model,
          enabled: true,
        },
        apiKey.trim() || undefined
      );

      // Auto-set as default if this is the first provider
      if (providers.length === 0) {
        await setDefaultProvider(id);
      }

      setShowAddDialog(false);
      toast.success(t('aiProviders.toast.added'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t('aiProviders.toast.failedAdd')}: ${errorMessage}`);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    try {
      await deleteProvider(providerId);
      toast.success(t('aiProviders.toast.deleted'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t('aiProviders.toast.failedDelete')}: ${errorMessage}`);
    }
  };

  const handleSetDefault = async (providerId: string) => {
    try {
      await setDefaultProvider(providerId);
      toast.success(t('aiProviders.toast.defaultUpdated'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t('aiProviders.toast.failedDefault')}: ${errorMessage}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRestartOpenClaw}
          disabled={restarting}
          title="Khởi động lại OpenClaw để áp dụng thay đổi model"
        >
          <RotateCcw className={`h-4 w-4 mr-2 ${restarting ? 'animate-spin' : ''}`} />
          {restarting ? 'Đang khởi động...' : 'Restart OpenClaw'}
        </Button>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('aiProviders.add')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : providers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('aiProviders.empty.title')}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {t('aiProviders.empty.desc')}
            </p>

            {/* Detected OpenClaw model */}
            {detectedModel && (
              <div className="w-full max-w-sm mb-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Phát hiện cấu hình OpenClaw:</p>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium">{detectedModel.provider}</span>
                    <span className="mx-1 text-muted-foreground">/</span>
                    <span className="text-sm font-mono text-foreground/80">{detectedModel.modelId}</span>
                  </div>
                  <Button size="sm" onClick={handleImportFromOpenClaw} disabled={importing}>
                    {importing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="h-3.5 w-3.5 mr-1" />
                    )}
                    Import
                  </Button>
                </div>
              </div>
            )}

            <Button variant={detectedModel ? 'outline' : 'default'} onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('aiProviders.empty.cta')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isDefault={provider.id === defaultProviderId}
              isEditing={editingProvider === provider.id}
              onEdit={() => setEditingProvider(provider.id)}
              onCancelEdit={() => setEditingProvider(null)}
              onDelete={() => handleDeleteProvider(provider.id)}
              onSetDefault={() => handleSetDefault(provider.id)}
              onSaveEdits={async (payload) => {
                await updateProviderWithKey(
                  provider.id,
                  payload.updates || {},
                  payload.newApiKey
                );
                setEditingProvider(null);
              }}
              onValidateKey={(key, options) => validateApiKey(provider.id, key, options)}
            />
          ))}
        </div>
      )}

      {/* Add Provider Dialog */}
      {showAddDialog && (
        <AddProviderDialog
          existingTypes={new Set(providers.map((p) => p.type))}
          onClose={() => setShowAddDialog(false)}
          onAdd={handleAddProvider}
          onValidateKey={(type, key, options) => validateApiKey(type, key, options)}
        />
      )}
    </div>
  );
}

interface ProviderCardProps {
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



function ProviderCard({
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
                <div className="relative flex-1">
                  <Input
                    type="password"
                    placeholder={typeInfo?.requiresApiKey ? typeInfo?.placeholder : (typeInfo?.id === 'ollama' ? t('aiProviders.notRequired') : t('aiProviders.card.editKey'))}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                {provider.hasKey && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => { setShowKey(false); setNewKey(''); }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveEdits}
                disabled={
                  validating
                  || saving
                  || (
                    !newKey.trim()
                    && (baseUrl.trim() || undefined) === (provider.baseUrl || undefined)
                    && (modelId.trim() || undefined) === (provider.model || undefined)
                  )
                  || Boolean(typeInfo?.showModelId && !modelId.trim())
                }
              >
                {validating || saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1" />
                )}
                Save
              </Button>
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
      </CardContent>
    </Card >
  );
}

interface AddProviderDialogProps {
  existingTypes: Set<string>;
  onClose: () => void;
  onAdd: (
    type: ProviderType,
    name: string,
    apiKey: string,
    options?: { baseUrl?: string; model?: string }
  ) => Promise<void>;
  onValidateKey: (
    type: string,
    apiKey: string,
    options?: { baseUrl?: string }
  ) => Promise<{ valid: boolean; error?: string }>;
}

function AddProviderDialog({ existingTypes, onClose, onAdd, onValidateKey }: AddProviderDialogProps) {
  const { t } = useTranslation('settings');
  const [selectedType, setSelectedType] = useState<ProviderType | null>(null);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [showPasteCallback, setShowPasteCallback] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  const typeInfo = PROVIDER_TYPE_INFO.find((t) => t.id === selectedType);

  // Live model fetch
  const [fetchedModels, setFetchedModels] = useState<{ id: string; name: string }[] | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);

  const effectiveModels = fetchedModels && fetchedModels.length > 0 ? fetchedModels : typeInfo?.models;
  const hasModelDropdown = (effectiveModels?.length ?? 0) > 0;

  // Auto-fetch models when API key changes (debounced)
  useEffect(() => {
    if (!selectedType || !typeInfo?.canFetchModels) return;
    if (!apiKey.trim() && typeInfo?.requiresApiKey) return;

    const timer = setTimeout(async () => {
      setFetchingModels(true);
      try {
        const params = new URLSearchParams();
        if (apiKey.trim()) params.set('apiKey', apiKey.trim());
        if (baseUrl.trim()) params.set('baseUrl', baseUrl.trim());
        const resp = await fetch(`/api/providers/models/${selectedType}?${params}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.models?.length > 0) {
            setFetchedModels(data.models);
            // Auto-select first model if none selected
            if (!modelId.trim() || modelId === typeInfo?.defaultModelId) {
              setModelId(data.models[0].id);
            }
          }
        }
      } catch { /* ignore */ }
      setFetchingModels(false);
    }, apiKey ? 800 : 0); // Debounce for key changes, immediate for no-key (Ollama)

    return () => clearTimeout(timer);
  }, [apiKey, selectedType, baseUrl, typeInfo?.canFetchModels, typeInfo?.requiresApiKey]);

  // custom and 9router can be added multiple times (multiple instances/configs).
  const MULTI_INSTANCE_TYPES = new Set(['custom', '9router']);
  const availableTypes = PROVIDER_TYPE_INFO.filter(
    (t) => MULTI_INSTANCE_TYPES.has(t.id) || !existingTypes.has(t.id),
  );

  const handleAdd = async () => {
    if (!selectedType) return;

    setSaving(true);
    setValidationError(null);

    try {
      // Validate key first if the provider requires one and a key was entered
      const requiresKey = typeInfo?.requiresApiKey ?? false;
      if (requiresKey && !apiKey.trim()) {
        setValidationError(t('aiProviders.toast.invalidKey'));
        setSaving(false);
        return;
      }
      if (requiresKey && apiKey) {
        const result = await onValidateKey(selectedType, apiKey, {
          baseUrl: baseUrl.trim() || undefined,
        });
        if (!result.valid) {
          setValidationError(result.error || t('aiProviders.toast.invalidKey'));
          setSaving(false);
          return;
        }
      }

      const requiresModel = typeInfo?.showModelId ?? false;
      if (requiresModel && !modelId.trim()) {
        setValidationError(t('aiProviders.toast.modelRequired'));
        setSaving(false);
        return;
      }

      const finalModel = modelId.trim() || typeInfo?.defaultModelId;

      await onAdd(
        selectedType,
        name || (typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name) || selectedType,
        apiKey.trim(),
        {
          baseUrl: baseUrl.trim() || undefined,
          model: finalModel || undefined,
        }
      );
    } catch {
      // error already handled via toast in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('aiProviders.dialog.title')}</CardTitle>
          <CardDescription>
            {t('aiProviders.dialog.desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedType ? (
            <div className="grid grid-cols-2 gap-3">
              {availableTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setSelectedType(type.id);
                    setName(type.id === 'custom' ? t('aiProviders.custom') : type.name);
                    setBaseUrl(type.defaultBaseUrl || '');
                    setModelId(type.defaultModelId || '');
                    setCustomModel(false);
                  }}
                  className="p-4 rounded-lg border hover:bg-accent transition-colors text-center"
                >
                  {getProviderIconUrl(type.id) ? (
                    <img src={getProviderIconUrl(type.id)} alt={type.name} className={cn('h-7 w-7 mx-auto', shouldInvertInDark(type.id) && 'dark:invert')} />
                  ) : (
                    <span className="text-2xl">{type.icon}</span>
                  )}
                  <p className="font-medium mt-2">{type.id === 'custom' ? t('aiProviders.custom') : type.name}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                {getProviderIconUrl(selectedType!) ? (
                  <img src={getProviderIconUrl(selectedType!)} alt={typeInfo?.name} className={cn('h-7 w-7', shouldInvertInDark(selectedType!) && 'dark:invert')} />
                ) : (
                  <span className="text-2xl">{typeInfo?.icon}</span>
                )}
                <div>
                  <p className="font-medium">{typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name}</p>
                  <button
                    onClick={() => {
                      setSelectedType(null);
                      setValidationError(null);
                      setBaseUrl('');
                      setModelId('');
                      setCustomModel(false);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t('aiProviders.dialog.change')}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t('aiProviders.dialog.displayName')}</Label>
                <Input
                  id="name"
                  placeholder={typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {typeInfo?.useOAuth ? (
                /* OAuth flow — show connect button instead of API key input */
                <div className="space-y-2">
                  <Label>Authentication</Label>
                  <Button
                    className="w-full"
                    disabled={oauthConnecting || showPasteCallback}
                    onClick={async () => {
                      setOauthConnecting(true);
                      setValidationError(null);
                      setShowPasteCallback(false);
                      try {
                        const resp = await fetch('/api/oauth/codex/start');
                        const data = await resp.json();
                        if (data.authUrl) {
                          window.open(data.authUrl, '_blank');
                          setShowPasteCallback(true);
                          // Record when flow started to ignore stale tokens
                          const flowStartedAt = Date.now();
                          // Start polling for auto-completion (localhost:1455 callback)
                          const pollInterval = setInterval(async () => {
                            try {
                              const statusResp = await fetch('/api/oauth/codex/status');
                              const statusData = await statusResp.json();
                              // Only accept NEW tokens (savedAt must be after flow started)
                              if (statusData.connected && !statusData.expired && statusData.savedAt > flowStartedAt) {
                                clearInterval(pollInterval);
                                setShowPasteCallback(false);
                                const finalModel = modelId.trim() || typeInfo?.defaultModelId;
                                await onAdd(
                                  selectedType!,
                                  name || typeInfo?.name || selectedType!,
                                  '',
                                  { model: finalModel || undefined }
                                );
                              }
                            } catch { /* ignore */ }
                          }, 3000);
                          // Stop polling after 5 min
                          setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
                        } else {
                          setValidationError(data.error || 'Failed to start OAuth');
                        }
                      } catch (err) {
                        setValidationError(String(err));
                      } finally {
                        setOauthConnecting(false);
                      }
                    }}
                  >
                    {oauthConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    {showPasteCallback ? 'Waiting for login...' : 'Connect with OpenAI'}
                  </Button>

                  {showPasteCallback && (
                    <div className="space-y-2 mt-3 p-3 rounded-md border border-dashed border-muted-foreground/30">
                      <Label className="text-xs">Paste callback URL (for remote access)</Label>
                      <p className="text-xs text-muted-foreground">
                        If the page didn't auto-close, copy the URL from the browser tab and paste it here.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="http://localhost:1455/auth/callback?code=..."
                          value={callbackUrl}
                          onChange={(e) => setCallbackUrl(e.target.value)}
                          className="text-xs"
                        />
                        <Button
                          size="sm"
                          disabled={!callbackUrl.trim() || exchanging}
                          onClick={async () => {
                            setExchanging(true);
                            setValidationError(null);
                            try {
                              const resp = await fetch('/api/oauth/codex/exchange', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ callbackUrl: callbackUrl.trim() }),
                              });
                              const data = await resp.json();
                              if (data.success) {
                                setShowPasteCallback(false);
                                setCallbackUrl('');
                                // Now add the provider
                                const finalModel = modelId.trim() || typeInfo?.defaultModelId;
                                await onAdd(
                                  selectedType!,
                                  name || typeInfo?.name || selectedType!,
                                  '',
                                  { model: finalModel || undefined }
                                );
                              } else {
                                setValidationError(data.error || 'Exchange failed');
                              }
                            } catch (err) {
                              setValidationError(String(err));
                            } finally {
                              setExchanging(false);
                            }
                          }}
                        >
                          {exchanging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  {validationError && (
                    <p className="text-xs text-destructive">{validationError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Opens OpenAI login in a new tab. After approving, tokens are saved automatically.
                  </p>
                </div>
              ) : (
                /* Standard API key input */
                <div className="space-y-2">
                  <Label htmlFor="apiKey">{t('aiProviders.dialog.apiKey')}</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showKey ? 'text' : 'password'}
                      placeholder={typeInfo?.id === 'ollama' ? t('aiProviders.notRequired') : typeInfo?.placeholder}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setValidationError(null);
                      }}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {validationError && (
                    <p className="text-xs text-destructive">{validationError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('aiProviders.dialog.apiKeyStored')}
                  </p>
                </div>
              )}

              {/* Model Selection */}
              {(hasModelDropdown || typeInfo?.canFetchModels) && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Model
                    {fetchingModels && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  </Label>
                  {customModel ? (
                    <div className="flex gap-2">
                      <Input
                        value={modelId}
                        onChange={(e) => setModelId(e.target.value)}
                        placeholder="model-id"
                      />
                      {hasModelDropdown && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
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
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
                    />
                  )}
                </div>
              )}

              {typeInfo?.showBaseUrl && (
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">{t('aiProviders.dialog.baseUrl')}</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://api.example.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              )}

              {typeInfo?.showModelId && (
                <div className="space-y-2">
                  <Label htmlFor="modelId">{t('aiProviders.dialog.modelId')}</Label>
                  <Input
                    id="modelId"
                    placeholder={typeInfo.modelIdPlaceholder || 'provider/model-id'}
                    value={modelId}
                    onChange={(e) => {
                      setModelId(e.target.value);
                      setValidationError(null);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('aiProviders.dialog.cancel')}
            </Button>
            {!typeInfo?.useOAuth && (
              <Button
                onClick={handleAdd}
                disabled={!selectedType || saving || ((typeInfo?.showModelId ?? false) && modelId.trim().length === 0)}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t('aiProviders.dialog.add')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
