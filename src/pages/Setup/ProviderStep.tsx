import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SecretInput } from '@/components/common/SecretInput';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { platform } from '@/lib/platform';
import { api } from '@/lib/api';
import { generateId } from '@/lib/uuid';
import { type ProviderTypeInfo, getProviderIconUrl, shouldInvertInDark } from '@/lib/providers';

export interface ProviderContentProps {
  providers: ProviderTypeInfo[];
  selectedProvider: string | null;
  onSelectProvider: (id: string | null) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onConfiguredChange: (configured: boolean) => void;
}

export function ProviderContent({
  providers,
  selectedProvider,
  onSelectProvider,
  apiKey,
  onApiKeyChange,
  onConfiguredChange,
}: ProviderContentProps) {
  const { t } = useTranslation(['setup', 'settings']);
  const [validating, setValidating] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const [selectedProviderConfigId, setSelectedProviderConfigId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);

  // On mount, try to restore previously configured provider
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let list: Array<{ id: string; type: string; hasKey: boolean }>;
        let defaultId: string | null;
        if (platform.isElectron) {
          list = await window.electron.ipcRenderer.invoke('provider:list') as Array<{ id: string; type: string; hasKey: boolean }>;
          defaultId = await window.electron.ipcRenderer.invoke('provider:getDefault') as string | null;
        } else {
          list = await api.getProviders();
          defaultId = (await api.getDefaultProvider()).id ?? null;
        }
        const setupProviderTypes = new Set<string>(providers.map((p) => p.id));
        const setupCandidates = list.filter((p) => setupProviderTypes.has(p.type));
        const preferred =
          (defaultId && setupCandidates.find((p) => p.id === defaultId))
          || setupCandidates.find((p) => p.hasKey)
          || setupCandidates[0];
        if (preferred && !cancelled) {
          onSelectProvider(preferred.type);
          setSelectedProviderConfigId(preferred.id);
          const typeInfo = providers.find((p) => p.id === preferred.type);
          const requiresKey = typeInfo?.requiresApiKey ?? false;
          onConfiguredChange(!requiresKey || preferred.hasKey);
          if (platform.isElectron) {
            const storedKey = await window.electron.ipcRenderer.invoke('provider:getApiKey', preferred.id) as string | null;
            if (storedKey) onApiKeyChange(storedKey);
          }
          // In web mode, API keys are not exposed for security — user must re-enter
        } else if (!cancelled) {
          onConfiguredChange(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load provider list:', error);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [onApiKeyChange, onConfiguredChange, onSelectProvider, providers]);

  // When provider changes, load stored key + reset base URL
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedProvider) return;
      try {
        let list: Array<{ id: string; type: string; hasKey: boolean }>;
        let defaultId: string | null;
        if (platform.isElectron) {
          list = await window.electron.ipcRenderer.invoke('provider:list') as Array<{ id: string; type: string; hasKey: boolean }>;
          defaultId = await window.electron.ipcRenderer.invoke('provider:getDefault') as string | null;
        } else {
          list = await api.getProviders();
          defaultId = (await api.getDefaultProvider()).id ?? null;
        }
        const sameType = list.filter((p) => p.type === selectedProvider);
        const preferredInstance =
          (defaultId && sameType.find((p) => p.id === defaultId))
          || sameType.find((p) => p.hasKey)
          || sameType[0];
        const providerIdForLoad = preferredInstance?.id || selectedProvider;
        setSelectedProviderConfigId(providerIdForLoad);

        let savedProvider: { baseUrl?: string; model?: string } | null = null;
        if (platform.isElectron) {
          savedProvider = await window.electron.ipcRenderer.invoke('provider:get', providerIdForLoad) as { baseUrl?: string; model?: string } | null;
          const storedKey = await window.electron.ipcRenderer.invoke('provider:getApiKey', providerIdForLoad) as string | null;
          if (!cancelled && storedKey) onApiKeyChange(storedKey);
        } else {
          try { savedProvider = await api.getProvider(providerIdForLoad); } catch { /* not found */ }
          // In web mode, API keys are not exposed for security — user must re-enter
        }

        if (!cancelled) {
          const info = providers.find((p) => p.id === selectedProvider);
          setBaseUrl(savedProvider?.baseUrl || info?.defaultBaseUrl || '');
          setModelId(savedProvider?.model || info?.defaultModelId || '');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load provider key:', error);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [onApiKeyChange, selectedProvider, providers]);

  useEffect(() => {
    if (!providerMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (providerMenuRef.current && !providerMenuRef.current.contains(event.target as Node)) {
        setProviderMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProviderMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [providerMenuOpen]);

  const selectedProviderData = providers.find((p) => p.id === selectedProvider);
  const selectedProviderIconUrl = selectedProviderData
    ? getProviderIconUrl(selectedProviderData.id)
    : undefined;
  const showBaseUrlField = selectedProviderData?.showBaseUrl ?? false;
  const showModelIdField = selectedProviderData?.showModelId ?? false;
  const requiresKey = selectedProviderData?.requiresApiKey ?? false;

  const handleValidateAndSave = async () => {
    if (!selectedProvider) return;

    setValidating(true);
    setKeyValid(null);

    try {
      // Validate key if the provider requires one and a key was entered (Electron only)
      if (platform.isElectron && requiresKey && apiKey) {
        const result = await window.electron.ipcRenderer.invoke(
          'provider:validateKey',
          selectedProviderConfigId || selectedProvider,
          apiKey,
          { baseUrl: baseUrl.trim() || undefined }
        ) as { valid: boolean; error?: string };

        setKeyValid(result.valid);

        if (!result.valid) {
          toast.error(result.error || t('provider.invalid'));
          setValidating(false);
          return;
        }
      } else {
        setKeyValid(true);
      }

      const effectiveModelId =
        modelId.trim() ||
        selectedProviderData?.defaultModelId ||
        undefined;

      const providerIdForSave =
        selectedProvider === 'custom'
          ? (selectedProviderConfigId?.startsWith('custom-')
            ? selectedProviderConfigId
            : `custom-${generateId()}`)
          : selectedProvider;

      const providerConfig = {
        id: providerIdForSave,
        name: selectedProvider === 'custom' ? t('settings:aiProviders.custom') : (selectedProviderData?.name || selectedProvider),
        type: selectedProvider,
        baseUrl: baseUrl.trim() || undefined,
        model: effectiveModelId,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save provider config + API key, then set as default
      let saveResult: { success: boolean; error?: string };
      let defaultResult: { success: boolean; error?: string };
      if (platform.isElectron) {
        saveResult = await window.electron.ipcRenderer.invoke('provider:save', providerConfig, apiKey || undefined) as { success: boolean; error?: string };
        if (!saveResult.success) throw new Error(saveResult.error || 'Failed to save provider config');
        defaultResult = await window.electron.ipcRenderer.invoke('provider:setDefault', providerIdForSave) as { success: boolean; error?: string };
        if (!defaultResult.success) throw new Error(defaultResult.error || 'Failed to set default provider');
      } else {
        saveResult = await api.saveProvider(providerConfig, apiKey || undefined);
        if (!saveResult.success) throw new Error(saveResult.error || 'Failed to save provider config');
        defaultResult = await api.setDefaultProvider(providerIdForSave);
        if (!defaultResult.success) throw new Error(defaultResult.error || 'Failed to set default provider');
      }

      setSelectedProviderConfigId(providerIdForSave);
      onConfiguredChange(true);
      toast.success(t('provider.valid'));
    } catch (error) {
      setKeyValid(false);
      onConfiguredChange(false);
      toast.error('Configuration failed: ' + String(error));
    } finally {
      setValidating(false);
    }
  };

  // Can the user submit?
  const canSubmit =
    selectedProvider
    && (requiresKey ? apiKey.length > 0 : true)
    && (showModelIdField ? modelId.trim().length > 0 : true);

  const handleSelectProvider = (providerId: string) => {
    onSelectProvider(providerId);
    setSelectedProviderConfigId(null);
    onConfiguredChange(false);
    onApiKeyChange('');
    setKeyValid(null);
    setProviderMenuOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Provider selector — dropdown */}
      <div className="space-y-2">
        <Label>{t('provider.label')}</Label>
        <div className="relative" ref={providerMenuRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={providerMenuOpen}
            onClick={() => setProviderMenuOpen((open) => !open)}
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'flex items-center justify-between gap-2',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {selectedProvider && selectedProviderData ? (
                selectedProviderIconUrl ? (
                  <img
                    src={selectedProviderIconUrl}
                    alt={selectedProviderData.name}
                    className={cn('h-4 w-4 shrink-0', shouldInvertInDark(selectedProviderData.id) && 'dark:invert')}
                  />
                ) : (
                  <span className="text-sm leading-none shrink-0">{selectedProviderData.icon}</span>
                )
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">—</span>
              )}
              <span className={cn('truncate text-left', !selectedProvider && 'text-muted-foreground')}>
                {selectedProviderData
                  ? `${selectedProviderData.id === 'custom' ? t('settings:aiProviders.custom') : selectedProviderData.name}${selectedProviderData.model ? ` — ${selectedProviderData.model}` : ''}`
                  : t('provider.selectPlaceholder')}
              </span>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform', providerMenuOpen && 'rotate-180')} />
          </button>

          {providerMenuOpen && (
            <div
              role="listbox"
              className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-64 overflow-auto"
            >
              {providers.map((p) => {
                const iconUrl = getProviderIconUrl(p.id);
                const isSelected = selectedProvider === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectProvider(p.id)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2',
                      'hover:bg-accent transition-colors',
                      isSelected && 'bg-accent/60'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt={p.name}
                          className={cn('h-4 w-4 shrink-0', shouldInvertInDark(p.id) && 'dark:invert')}
                        />
                      ) : (
                        <span className="text-sm leading-none shrink-0">{p.icon}</span>
                      )}
                      <span className="truncate">{p.id === 'custom' ? t('settings:aiProviders.custom') : p.name}{p.model ? ` — ${p.model}` : ''}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic config fields based on selected provider */}
      {selectedProvider && (
        <motion.div
          key={selectedProvider}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Base URL field (for siliconflow, ollama, custom) */}
          {showBaseUrlField && (
            <div className="space-y-2">
              <Label htmlFor="baseUrl">{t('provider.baseUrl')}</Label>
              <Input
                id="baseUrl"
                type="text"
                placeholder="https://api.example.com/v1"
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  onConfiguredChange(false);
                }}
                autoComplete="off"
                className="bg-background border-input"
              />
            </div>
          )}

          {/* Model selector — dropdown for providers with predefined models */}
          {selectedProviderData?.models && selectedProviderData.models.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="modelSelect">{t('provider.modelId')}</Label>
              <select
                id="modelSelect"
                value={modelId}
                onChange={(e) => {
                  setModelId(e.target.value);
                  onConfiguredChange(false);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {selectedProviderData.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Model ID text input — for providers without predefined model list */}
          {showModelIdField && !(selectedProviderData?.models && selectedProviderData.models.length > 0) && (
            <div className="space-y-2">
              <Label htmlFor="modelId">{t('provider.modelId')}</Label>
              <Input
                id="modelId"
                type="text"
                placeholder={selectedProviderData?.modelIdPlaceholder || 'e.g. deepseek-ai/DeepSeek-V3'}
                value={modelId}
                onChange={(e) => {
                  setModelId(e.target.value);
                  onConfiguredChange(false);
                }}
                autoComplete="off"
                className="bg-background border-input"
              />
              <p className="text-xs text-muted-foreground">
                {t('provider.modelIdDesc')}
              </p>
            </div>
          )}

          {/* API Key field (hidden for ollama) */}
          {requiresKey && (
            <div className="space-y-2">
              <Label htmlFor="apiKey">{t('provider.apiKey')}</Label>
              <SecretInput
                id="apiKey"
                placeholder={selectedProviderData?.placeholder}
                value={apiKey}
                onChange={(e) => {
                  onApiKeyChange(e.target.value);
                  onConfiguredChange(false);
                  setKeyValid(null);
                }}
                autoComplete="off"
                className="bg-background border-input"
                fullWidth
              />
            </div>
          )}

          {/* Validate & Save */}
          <Button
            onClick={handleValidateAndSave}
            disabled={!canSubmit || validating}
            className="w-full"
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {requiresKey ? t('provider.validateSave') : t('provider.save')}
          </Button>

          {keyValid !== null && (
            <p className={cn('text-sm text-center', keyValid ? 'text-green-400' : 'text-red-400')}>
              {keyValid ? `✓ ${t('provider.valid')}` : `✗ ${t('provider.invalid')}`}
            </p>
          )}

          <p className="text-sm text-muted-foreground text-center">
            {t('provider.storedLocally')}
          </p>
        </motion.div>
      )}
    </div>
  );
}
