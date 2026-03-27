/**
 * Providers Settings Component
 * Manage AI provider configurations and API keys
 */
import { useState, useEffect } from 'react';
import {
  Plus,
  Loader2,
  Key,
  Download,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AsyncButton } from '@/components/common/AsyncButton';
import { EmptyState } from '@/components/common/EmptyState';
import { useProviderStore } from '@/stores/providers';
import { api } from '@/lib/api';
import { type ProviderType } from '@/lib/providers';
import { generateId } from '@/lib/uuid';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ProviderCard } from './providers/ProviderCard';
import { AddProviderDialog } from './providers/AddProviderDialog';

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
        <EmptyState
          variant="card"
          icon={<Key className="h-full w-full" />}
          title={t('aiProviders.empty.title')}
          description={t('aiProviders.empty.desc')}
          renderContent={() => (
            <>
              <h3 className="text-base font-semibold">{t('aiProviders.empty.title')}</h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">{t('aiProviders.empty.desc')}</p>
              {detectedModel && (
                <div className="w-full max-w-sm mt-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Phát hiện cấu hình OpenClaw:</p>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium">{detectedModel.provider}</span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      <span className="text-sm font-mono text-foreground/80">{detectedModel.modelId}</span>
                    </div>
                    <AsyncButton size="sm" onClick={handleImportFromOpenClaw} loading={importing} icon={<Download className="h-3.5 w-3.5" />}>
                      Import
                    </AsyncButton>
                  </div>
                </div>
              )}
              <div className="mt-2">
                <Button variant={detectedModel ? 'outline' : 'default'} onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('aiProviders.empty.cta')}
                </Button>
              </div>
            </>
          )}
        />
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
