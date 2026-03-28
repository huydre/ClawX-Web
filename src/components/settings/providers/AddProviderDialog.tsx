/**
 * AddProviderDialog Component
 * Dialog for adding a new AI provider
 */
import { useState, useEffect } from 'react';
import {
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SecretInput } from '@/components/common/SecretInput';
import { AsyncButton } from '@/components/common/AsyncButton';
import { ModalDialog } from '@/components/common/ModalDialog';
import {
  PROVIDER_TYPE_INFO,
  type ProviderType,
  getProviderIconUrl,
  shouldInvertInDark,
} from '@/lib/providers';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export interface AddProviderDialogProps {
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

export function AddProviderDialog({ existingTypes, onClose, onAdd, onValidateKey }: AddProviderDialogProps) {
  const { t } = useTranslation('settings');
  const [selectedType, setSelectedType] = useState<ProviderType | null>(null);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [showPasteCallback, setShowPasteCallback] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [codexTab, setCodexTab] = useState<'auth' | 'buy'>('auth');
  const [buyEmail, setBuyEmail] = useState('');
  const [showQR, setShowQR] = useState(false);

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
            // Auto-select: prefer defaultModelId if it exists in fetched list, otherwise first
            if (!modelId.trim()) {
              const preferred = typeInfo?.defaultModelId && data.models.some((m: { id: string }) => m.id === typeInfo.defaultModelId)
                ? typeInfo.defaultModelId
                : data.models[0].id;
              setModelId(preferred);
            }
          }
        }
      } catch { /* ignore */ }
      setFetchingModels(false);
    }, apiKey ? 800 : 0); // Debounce for key changes, immediate for no-key (Ollama)

    return () => clearTimeout(timer);
  }, [apiKey, selectedType, baseUrl, typeInfo?.canFetchModels, typeInfo?.requiresApiKey]);

  // custom, 9router, and codex can be added multiple times (multi-account OAuth rotation).
  const MULTI_INSTANCE_TYPES = new Set(['custom', '9router', 'codex']);
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
    <ModalDialog
      open={true}
      onClose={onClose}
      title={t('aiProviders.dialog.title')}
      description={t('aiProviders.dialog.desc')}
      showCloseButton={false}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('aiProviders.dialog.cancel')}
          </Button>
          {!typeInfo?.useOAuth && selectedType && (
            <AsyncButton
              onClick={handleAdd}
              loading={saving}
              disabled={!selectedType || ((typeInfo?.showModelId ?? false) && modelId.trim().length === 0)}
            >
              {t('aiProviders.dialog.add')}
            </AsyncButton>
          )}
        </>
      }
    >
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
                /* Codex — tabs: have account / buy slot */
                <div className="space-y-3">
                  <div className="flex rounded-lg border overflow-hidden">
                    <button
                      className={cn(
                        'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                        codexTab === 'auth' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      )}
                      onClick={() => setCodexTab('auth')}
                    >
                      {t('aiProviders.codexBuy.tabHaveAccount')}
                    </button>
                    <button
                      className={cn(
                        'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                        codexTab === 'buy' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      )}
                      onClick={() => setCodexTab('buy')}
                    >
                      {t('aiProviders.codexBuy.tabBuySlot')}
                    </button>
                  </div>

                  {codexTab === 'auth' ? (
                    /* Existing OAuth flow */
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
                              const flowStartedAt = Date.now();
                              const pollInterval = setInterval(async () => {
                                try {
                                  const statusResp = await fetch('/api/oauth/codex/status');
                                  const statusData = await statusResp.json();
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
                    /* Buy Codex slot flow */
                    <div className="space-y-3">
                      {!showQR ? (
                        /* Step 1: Email input */
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-muted text-center space-y-1">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm text-muted-foreground line-through">{t('aiProviders.codexBuy.originalPrice')}</span>
                              <span className="text-xs font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">{t('aiProviders.codexBuy.discount')}</span>
                            </div>
                            <p className="text-lg font-bold">{t('aiProviders.codexBuy.price')}</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="buyEmail">{t('aiProviders.codexBuy.emailLabel')}</Label>
                            <Input
                              id="buyEmail"
                              type="email"
                              placeholder={t('aiProviders.codexBuy.emailPlaceholder')}
                              value={buyEmail}
                              onChange={(e) => setBuyEmail(e.target.value)}
                            />
                          </div>
                          <Button
                            className="w-full"
                            disabled={!buyEmail.trim() || !buyEmail.includes('@')}
                            onClick={() => setShowQR(true)}
                          >
                            {t('aiProviders.codexBuy.generateQR')}
                          </Button>
                        </div>
                      ) : (
                        /* Step 2: QR + instructions */
                        <div className="space-y-3">
                          <button
                            onClick={() => setShowQR(false)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            ← {t('aiProviders.dialog.change')}
                          </button>

                          {/* QR Code */}
                          <div className="text-center space-y-2">
                            <img
                              src={`https://img.vietqr.io/image/970407-MS01T17213302551927-compact.png?amount=200000&addInfo=CODEX%20${encodeURIComponent(buyEmail.trim())}&accountName=TECHLA%20AI%20CO.,%20LTD`}
                              alt="VietQR Payment"
                              className="mx-auto rounded-lg border max-w-[220px]"
                            />
                            <p className="text-xs text-muted-foreground">
                              {t('aiProviders.codexBuy.scanQR')}
                            </p>
                          </div>

                          {/* Manual transfer info */}
                          <div className="p-3 rounded-lg border text-sm space-y-1">
                            <p className="font-medium">{t('aiProviders.codexBuy.paymentInfo')}</p>
                            <p>{t('aiProviders.codexBuy.bank')} — {t('aiProviders.codexBuy.accountNo')}</p>
                            <p>{t('aiProviders.codexBuy.accountName')}</p>
                            <p className="font-mono text-xs">
                              {t('aiProviders.codexBuy.transferContent')}: <span className="font-bold select-all">CODEX {buyEmail.trim()}</span>
                            </p>
                          </div>

                          <Separator />

                          {/* Post-payment instructions */}
                          <div className="space-y-2">
                            <p className="text-sm font-medium">{t('aiProviders.codexBuy.afterPayment')}</p>
                            <p className="text-xs text-muted-foreground">{t('aiProviders.codexBuy.waitNote')}</p>
                            <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                              <li>{t('aiProviders.codexBuy.step1')}</li>
                              <li>{t('aiProviders.codexBuy.step2')}</li>
                              <li>{t('aiProviders.codexBuy.step3')}</li>
                            </ol>
                          </div>

                          {/* Connect button — triggers existing OAuth flow */}
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
                                  const flowStartedAt = Date.now();
                                  const pollInterval = setInterval(async () => {
                                    try {
                                      const statusResp = await fetch('/api/oauth/codex/status');
                                      const statusData = await statusResp.json();
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
                            {showPasteCallback ? 'Waiting for login...' : t('aiProviders.codexBuy.connectCodex')}
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
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Standard API key input */
                <div className="space-y-2">
                  <Label htmlFor="apiKey">{t('aiProviders.dialog.apiKey')}</Label>
                  <SecretInput
                    id="apiKey"
                    placeholder={typeInfo?.id === 'ollama' ? t('aiProviders.notRequired') : typeInfo?.placeholder}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setValidationError(null);
                    }}
                    fullWidth
                  />
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

    </ModalDialog>
  );
}
