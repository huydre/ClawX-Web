import { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Loader2,
  ExternalLink,
  BookOpen,
  Check,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ModalDialog } from '@/components/common/ModalDialog';
import { useChannelsStore } from '@/stores/channels';
import { ChannelIcon } from '@/components/ui/ChannelIcon';
import {
  CHANNEL_NAMES,
  CHANNEL_META,
  getPrimaryChannels,
  type ChannelType,
  type ChannelMeta,
  type ChannelConfigField,
} from '@/types/channel';
import { toast } from 'sonner';
import { SecretInput } from '@/components/common/SecretInput';
import { useTranslation } from 'react-i18next';
import { platform } from '@/lib/platform';
import { api } from '@/lib/api';

interface AddChannelDialogProps {
  selectedType: ChannelType | null;
  onSelectType: (type: ChannelType | null) => void;
  onClose: () => void;
  onChannelAdded: () => void;
}

export function AddChannelDialog({ selectedType, onSelectType, onClose, onChannelAdded }: AddChannelDialogProps) {
  const { t } = useTranslation('channels');
  const { addChannel } = useChannelsStore();
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [channelName, setChannelName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [isExistingConfig, setIsExistingConfig] = useState(false);
  const [addNewMode, setAddNewMode] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const zaloPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zaloPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup Zalo polling on unmount
  useEffect(() => {
    return () => {
      if (zaloPollRef.current) clearInterval(zaloPollRef.current);
      if (zaloPollTimeoutRef.current) clearTimeout(zaloPollTimeoutRef.current);
    };
  }, []);

  const meta: ChannelMeta | null = selectedType ? CHANNEL_META[selectedType] : null;

  // Load existing config when a channel type is selected
  useEffect(() => {
    if (!selectedType) {
      setConfigValues({});
      setChannelName('');
      setAccountId('');
      setIsExistingConfig(false);
      setAddNewMode(false);
      if (platform.isElectron) {
        window.electron.ipcRenderer.invoke('channel:cancelWhatsAppQr').catch(() => { });
      }
      return;
    }

    let cancelled = false;
    setLoadingConfig(true);

    (async () => {
      try {
        let result: { success: boolean; values?: Record<string, string> | null };

        if (platform.isElectron) {
          result = await window.electron.ipcRenderer.invoke(
            'channel:getFormValues',
            selectedType
          ) as { success: boolean; values?: Record<string, string> };
        } else {
          result = await api.getChannelFormValues(selectedType);
        }

        if (cancelled) return;

        if (result.success && result.values && Object.keys(result.values).length > 0) {
          setConfigValues(result.values);
          setIsExistingConfig(true);
        } else {
          setConfigValues({});
          setIsExistingConfig(false);
        }
      } catch {
        if (!cancelled) {
          setConfigValues({});
          setIsExistingConfig(false);
        }
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedType]);

  // Listen for WhatsApp QR events
  useEffect(() => {
    if (selectedType !== 'whatsapp') return;

    const onQr = (...args: unknown[]) => {
      const data = args[0];
      if (typeof data !== 'object' || data === null || !('qr' in data)) return;
      const qrData = data as { qr: string; raw: string };
      setQrCode(`data:image/png;base64,${qrData.qr}`);
    };

    const onSuccess = async (...args: unknown[]) => {
      const data = args[0] as { accountId?: string } | undefined;
      toast.success(t('toast.whatsappConnected'));
      const accountId = data?.accountId || channelName.trim() || 'default';
      try {
        const saveResult = await window.electron.ipcRenderer.invoke(
          'channel:saveConfig',
          'whatsapp',
          { enabled: true }
        ) as { success?: boolean; error?: string };
        if (!saveResult?.success) {
          console.error('Failed to save WhatsApp config:', saveResult?.error);
        } else {
          console.info('Saved WhatsApp config for account:', accountId);
        }
      } catch (error) {
        console.error('Failed to save WhatsApp config:', error);
      }
      // Register the channel locally so it shows up immediately
      addChannel({
        type: 'whatsapp',
        name: channelName || 'WhatsApp',
      }).then(async () => {
        // Restart gateway to pick up the new session
        try {
          await window.electron.ipcRenderer.invoke('gateway:restart');
        } catch (err) {
          console.error('Gateway restart failed:', err);
        }
        onChannelAdded();
      });
    };

    const onError = (...args: unknown[]) => {
      const err = args[0] as string;
      console.error('WhatsApp Login Error:', err);
      toast.error(t('toast.whatsappFailed', { error: err }));
      setQrCode(null);
      setConnecting(false);
    };

    const removeQrListener = window.electron.ipcRenderer.on('channel:whatsapp-qr', onQr);
    const removeSuccessListener = window.electron.ipcRenderer.on('channel:whatsapp-success', onSuccess);
    const removeErrorListener = window.electron.ipcRenderer.on('channel:whatsapp-error', onError);

    return () => {
      if (typeof removeQrListener === 'function') removeQrListener();
      if (typeof removeSuccessListener === 'function') removeSuccessListener();
      if (typeof removeErrorListener === 'function') removeErrorListener();
      // Cancel when unmounting or switching types
      window.electron.ipcRenderer.invoke('channel:cancelWhatsAppQr').catch(() => { });
    };
  }, [selectedType, addChannel, channelName, onChannelAdded, t]);

  const handleValidate = async () => {
    if (!selectedType) return;

    setValidating(true);
    setValidationResult(null);

    try {
      let result: {
        valid?: boolean;
        errors?: string[];
        warnings?: string[];
        details?: Record<string, string>;
      };

      if (platform.isElectron) {
        result = await window.electron.ipcRenderer.invoke(
          'channel:validateCredentials',
          selectedType,
          configValues
        ) as typeof result;
      } else {
        result = await api.validateChannelCredentials(selectedType, configValues);
      }

      const warnings = result.warnings || [];
      if (result.valid && result.details) {
        const details = result.details;
        if (details.botUsername) warnings.push(`Bot: @${details.botUsername}`);
        if (details.guildName) warnings.push(`Server: ${details.guildName}`);
        if (details.channelName) warnings.push(`Channel: #${details.channelName}`);
      }

      setValidationResult({
        valid: result.valid || false,
        errors: result.errors || [],
        warnings,
      });
    } catch (error) {
      setValidationResult({
        valid: false,
        errors: [String(error)],
        warnings: [],
      });
    } finally {
      setValidating(false);
    }
  };


  const handleConnect = async () => {
    if (!selectedType || !meta) return;

    setConnecting(true);
    setValidationResult(null);

    try {
      // For QR-based channels, request QR code (Electron only)
      if (meta.connectionType === 'qr') {
        if (platform.isElectron) {
          const accountId = channelName.trim() || 'default';
          await window.electron.ipcRenderer.invoke('channel:requestWhatsAppQr', accountId);
        }
        return;
      }

      // OpenZalo: web-based QR login via openzca
      if (selectedType === 'openzalo') {
        try {
          const profile = configValues.profile?.trim() || 'default';
          const response = await fetch('/api/channels/openzalo/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile }),
          });
          const data = await response.json();
          if (data.success && data.qrDataUrl) {
            setQrCode(data.qrDataUrl);

            // Poll gateway health to detect when Zalo login completes
            // Clear any existing poll first
            if (zaloPollRef.current) clearInterval(zaloPollRef.current);
            if (zaloPollTimeoutRef.current) clearTimeout(zaloPollTimeoutRef.current);

            let pollRetries = 0;
            const MAX_POLL_RETRIES = 40; // 40 * 3s = 120s max

            const pollInterval = setInterval(async () => {
              pollRetries++;
              if (pollRetries > MAX_POLL_RETRIES) {
                clearInterval(pollInterval);
                zaloPollRef.current = null;
                setQrCode(null);
                setConnecting(false);
                toast.error('QR code expired. Please try again.');
                return;
              }
              try {
                const statusRes = await fetch('/api/gateway/channels');
                if (!statusRes.ok) return;
                const statusData = await statusRes.json();
                const zaloStatus = statusData?.channels?.openzalo;

                if (zaloStatus?.configured || zaloStatus?.running) {
                  clearInterval(pollInterval);
                  zaloPollRef.current = null;
                  if (zaloPollTimeoutRef.current) {
                    clearTimeout(zaloPollTimeoutRef.current);
                    zaloPollTimeoutRef.current = null;
                  }
                  setQrCode(null);
                  setConnecting(false);
                  toast.success('Zalo connected successfully!');

                  // Save channel config and refresh
                  await addChannel({
                    type: 'openzalo',
                    name: channelName || 'Zalo',
                  });

                  // Gateway hot-reloads config automatically
                  await new Promise((resolve) => setTimeout(resolve, 2000));

                  onChannelAdded();
                }
              } catch { /* ignore poll errors */ }
            }, 3000);

            zaloPollRef.current = pollInterval;

            // Stop polling after 2 minutes (QR expires) as fallback
            zaloPollTimeoutRef.current = setTimeout(() => {
              if (zaloPollRef.current) {
                clearInterval(zaloPollRef.current);
                zaloPollRef.current = null;
              }
              zaloPollTimeoutRef.current = null;
              setQrCode(null);
              setConnecting(false);
              toast.error('QR code expired. Please try again.');
            }, 120000);
          } else {
            toast.error(data.error || 'Failed to generate QR code');
            setConnecting(false);
          }
        } catch (err) {
          toast.error(`QR login failed: ${err instanceof Error ? err.message : String(err)}`);
          setConnecting(false);
        }
        return;
      }

      // Step 1: Validate credentials against the actual service API
      if (meta.connectionType === 'token') {
        let validationResponse: {
          valid?: boolean;
          errors?: string[];
          warnings?: string[];
          details?: Record<string, string>;
        };

        if (platform.isElectron) {
          validationResponse = await window.electron.ipcRenderer.invoke(
            'channel:validateCredentials',
            selectedType,
            configValues
          ) as typeof validationResponse;
        } else {
          validationResponse = await api.validateChannelCredentials(selectedType, configValues);
        }

        if (!validationResponse.valid) {
          setValidationResult({
            valid: false,
            errors: validationResponse.errors || ['Validation failed'],
            warnings: validationResponse.warnings || [],
          });
          setConnecting(false);
          return;
        }

        // Show success details
        const warnings = validationResponse.warnings || [];
        if (validationResponse.details) {
          const details = validationResponse.details;
          if (details.botUsername) warnings.push(`Bot: @${details.botUsername}`);
          if (details.guildName) warnings.push(`Server: ${details.guildName}`);
          if (details.channelName) warnings.push(`Channel: #${details.channelName}`);
        }

        setValidationResult({ valid: true, errors: [], warnings });
      }

      // Step 2: Save channel configuration (with optional accountId for multi-account)
      const config: Record<string, unknown> = { ...configValues };

      if (platform.isElectron) {
        await window.electron.ipcRenderer.invoke('channel:saveConfig', selectedType, config);
      } else {
        await api.saveChannelConfig(selectedType, config, accountId || undefined);
      }

      // Step 3: Register channel + restart
      if (platform.isElectron) {
        // In Electron, use IPC flow
        await addChannel({
          type: selectedType,
          name: channelName || CHANNEL_NAMES[selectedType],
          token: configValues[meta.configFields[0]?.key] || undefined,
        });

        toast.success(t('toast.channelSaved', { name: meta.name }));

        try {
          await window.electron.ipcRenderer.invoke('gateway:restart');
          toast.success(t('toast.channelConnecting', { name: meta.name }));
        } catch (restartError) {
          console.warn('Gateway restart after channel config:', restartError);
          toast.info(t('toast.restartManual'));
        }
      } else {
        // In web mode: config saved, gateway hot-reloads automatically
        toast.success(t('toast.channelSaved', { name: meta.name }));
        toast.info(t('toast.channelConnecting', { name: meta.name }));
        // Brief wait for gateway to pick up config change
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Brief delay so user can see the success state before dialog closes
      await new Promise((resolve) => setTimeout(resolve, 800));
      onChannelAdded();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(t('toast.configFailed', { error: errorMessage }));
      setConnecting(false);
    }
  };

  const openDocs = () => {
    if (meta?.docsUrl) {
      const url = t(meta.docsUrl);
      try {
        if (window.electron?.openExternal) {
          window.electron.openExternal(url);
        } else {
          // Fallback: open in new window
          window.open(url, '_blank');
        }
      } catch (error) {
        console.error('Failed to open docs:', error);
        // Fallback: open in new window
        window.open(url, '_blank');
      }
    }
  };


  const isFormValid = () => {
    if (!meta) return false;

    // Check all required fields are filled
    return meta.configFields
      .filter((field) => field.required)
      .every((field) => configValues[field.key]?.trim());
  };

  const updateConfigValue = (key: string, value: string) => {
    setConfigValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <ModalDialog
      open={true}
      onClose={onClose}
      title={
        selectedType
          ? isExistingConfig
            ? t('dialog.updateTitle', { name: CHANNEL_NAMES[selectedType] })
            : t('dialog.configureTitle', { name: CHANNEL_NAMES[selectedType] })
          : t('dialog.addTitle')
      }
      description={
        selectedType && isExistingConfig
          ? t('dialog.existingDesc')
          : meta ? t(meta.description) : t('dialog.selectDesc')
      }
      maxWidth="lg"
    >
          {!selectedType ? (
            // Channel type selection
            <div className="grid grid-cols-2 gap-4">
              {getPrimaryChannels().map((type) => {
                const channelMeta = CHANNEL_META[type];
                return (
                  <button
                    key={type}
                    onClick={() => onSelectType(type)}
                    className="p-4 rounded-lg border hover:bg-accent transition-colors text-left"
                  >
                    <ChannelIcon type={type} className="h-8 w-8" />
                    <p className="font-medium mt-2">{channelMeta.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {channelMeta.connectionType === 'qr' ? t('dialog.qrCode') : t('dialog.token')}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : qrCode ? (
            // QR Code display
            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded-lg inline-block shadow-sm border">
                {qrCode.startsWith('data:image') ? (
                  <img src={qrCode} alt="Scan QR Code" className="w-64 h-64 object-contain" />
                ) : (
                  <div className="w-64 h-64 bg-gray-100 flex items-center justify-center">
                    <QrCode className="h-32 w-32 text-gray-400" />
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('dialog.scanQR', { name: meta?.name })}
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => {
                  setQrCode(null);
                  handleConnect(); // Retry
                }}>
                  {t('dialog.refreshCode')}
                </Button>
                {selectedType === 'openzalo' && (
                  <Button onClick={async () => {
                    try {
                      setQrCode(null);
                      toast.info('Saving Zalo configuration...');

                      // Save channel config via API
                      const profile = configValues.profile?.trim() || 'default';
                      const saveRes = await fetch('/api/channels/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          type: 'openzalo',
                          name: channelName || 'Zalo',
                          config: { profile, enabled: true },
                        }),
                      });
                      const saveData = await saveRes.json();

                      if (saveData.success) {
                        toast.success('Zalo channel saved!');

                        // Register channel locally
                        await addChannel({
                          type: 'openzalo',
                          name: channelName || 'Zalo',
                        });

                        // Gateway hot-reloads config automatically, just wait a moment
                        toast.info('Waiting for gateway to pick up config...');
                        await new Promise((resolve) => setTimeout(resolve, 3000));

                        onChannelAdded();
                      } else {
                        toast.error(saveData.error || 'Failed to save config');
                      }
                    } catch (err) {
                      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
                    } finally {
                      setConnecting(false);
                    }
                  }}>
                    {t('dialog.doneScan', { defaultValue: 'Done scanning' })}
                  </Button>
                )}
              </div>
            </div>
          ) : loadingConfig ? (
            // Loading saved config
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">{t('dialog.loadingConfig')}</span>
            </div>
          ) : (
            // Connection form
            <div className="space-y-4">
              {/* Multi-account: choose update existing or add new */}
              {isExistingConfig && !addNewMode && (
                <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-lg text-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>{t('dialog.existingHint')}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setAddNewMode(true);
                      setConfigValues({});
                      setAccountId('');
                      setChannelName('');
                      setValidationResult(null);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    {t('dialog.addNewAccount', { defaultValue: 'Add New Account (multi-bot)' })}
                  </Button>
                </div>
              )}

              {/* New account mode: require Account ID */}
              {addNewMode && (
                <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-3 rounded-lg text-sm space-y-2">
                  <p className="font-medium">{t('dialog.newAccountTitle', { defaultValue: 'Adding new account' })}</p>
                  <p className="text-xs">{t('dialog.newAccountDesc', { defaultValue: 'Enter a unique Account ID and configure the new bot token below.' })}</p>
                  <div className="space-y-1">
                    <Label htmlFor="accountId" className="text-xs font-medium">
                      {t('dialog.accountId', { defaultValue: 'Account ID' })} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="accountId"
                      placeholder={t('dialog.accountIdHint', { defaultValue: 'e.g. bot2, alerts, work' })}
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value.trim().replace(/[^a-zA-Z0-9_-]/g, ''))}
                      className="bg-white dark:bg-background text-foreground text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{t('dialog.howToConnect')}</p>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm"
                    onClick={openDocs}
                  >
                    <BookOpen className="h-3 w-3 mr-1" />
                    {t('dialog.viewDocs')}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  {meta?.instructions.map((instruction, i) => (
                    <li key={i}>{t(instruction)}</li>
                  ))}
                </ol>
              </div>

              {/* Channel name */}
              <div className="space-y-2">
                <Label htmlFor="name">{t('dialog.channelName')}</Label>
                <Input
                  id="name"
                  placeholder={t('dialog.channelNamePlaceholder', { name: meta?.name })}
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                />
              </div>

              {/* Configuration fields */}
              {meta?.configFields.map((field) => {
                // Hide allowFrom field unless dmPolicy is 'allowlist' or 'open'
                if (field.key === 'allowFrom') {
                  const dmPolicy = configValues['dmPolicy'] || 'pairing';
                  if (dmPolicy !== 'allowlist' && dmPolicy !== 'open') {
                    return null;
                  }
                }

                return (
                  <ConfigField
                    key={field.key}
                    field={field}
                    value={configValues[field.key] || ''}
                    onChange={(value) => updateConfigValue(field.key, value)}
                  />
                );
              })}

              {/* Validation Results */}
              {validationResult && (
                <div className={`p-4 rounded-lg text-sm ${validationResult.valid ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-destructive/10 text-destructive'
                  }`}>
                  <div className="flex items-start gap-2">
                    {validationResult.valid ? (
                      <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h4 className="font-medium mb-1">
                        {validationResult.valid ? t('dialog.credentialsVerified') : t('dialog.validationFailed')}
                      </h4>
                      {validationResult.errors.length > 0 && (
                        <ul className="list-disc list-inside space-y-0.5">
                          {validationResult.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      )}
                      {validationResult.valid && validationResult.warnings.length > 0 && (
                        <div className="mt-1 text-green-600 dark:text-green-400 space-y-0.5">
                          {validationResult.warnings.map((info, i) => (
                            <p key={i} className="text-xs">{info}</p>
                          ))}
                        </div>
                      )}
                      {!validationResult.valid && validationResult.warnings.length > 0 && (
                        <div className="mt-2 text-yellow-600 dark:text-yellow-500">
                          <p className="font-medium text-xs uppercase mb-1">{t('dialog.warnings')}</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {validationResult.warnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => onSelectType(null)}>
                  {t('dialog.back')}
                </Button>
                <div className="flex gap-2">
                  {/* Validation Button - Only for token-based channels for now */}
                  {meta?.connectionType === 'token' && (
                    <Button
                      variant="secondary"
                      onClick={handleValidate}
                      disabled={validating}
                    >
                      {validating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('dialog.validating')}
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4 mr-2" />
                          {t('dialog.validateConfig')}
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={handleConnect}
                    disabled={connecting || !isFormValid() || (addNewMode && !accountId)}
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {meta?.connectionType === 'qr' ? t('dialog.generatingQR') : t('dialog.validatingAndSaving')}
                      </>
                    ) : meta?.connectionType === 'qr' ? (
                      t('dialog.generateQRCode')
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        {isExistingConfig ? t('dialog.updateAndReconnect') : t('dialog.saveAndConnect')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
    </ModalDialog>
  );
}

// ==================== Config Field Component ====================

interface ConfigFieldProps {
  field: ChannelConfigField;
  value: string;
  onChange: (value: string) => void;
}

function ConfigField({ field, value, onChange }: ConfigFieldProps) {
  const { t } = useTranslation('channels');
  const isPassword = field.type === 'password';
  const isSelect = field.type === 'select';

  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>
        {t(field.label)}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {isSelect ? (
        <select
          id={field.key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">{field.placeholder ? t(field.placeholder) : 'Select...'}</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : isPassword ? (
        <SecretInput
          id={field.key}
          placeholder={field.placeholder ? t(field.placeholder) : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm"
          fullWidth
        />
      ) : (
        <Input
          id={field.key}
          type="text"
          placeholder={field.placeholder ? t(field.placeholder) : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm"
        />
      )}
      {field.description && (
        <p className="text-xs text-muted-foreground">
          {t(field.description)}
        </p>
      )}
      {field.envVar && (
        <p className="text-xs text-muted-foreground">
          {t('dialog.envVar', { var: field.envVar })}
        </p>
      )}
    </div>
  );
}
