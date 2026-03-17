/**
 * Tunnel Settings Component
 * Manage Cloudflare Tunnel configuration in Settings page
 */
import { useState, useEffect } from 'react';
import {
  Copy,
  Loader2,
  AlertCircle,
  Info,
  ExternalLink,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useTunnelStore } from '@/stores/tunnel';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function TunnelSettings() {
  const { t } = useTranslation('settings');
  const {
    configured,
    enabled,
    running,
    mode,
    publicUrl,
    dashboardUrl,
    uptime,
    state,
    loading,
    error,
    autoSetupTunnel,
    stopNamedTunnel,
    teardownTunnel,
    validateToken,
    fetchStatus,
  } = useTunnelStore();

  // Fetch status on mount and poll when enabled
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [enabled, fetchStatus]);

  // Format uptime
  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  // Copy URL to clipboard
  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('tunnel.urlCopied'));
    } catch {
      toast.error(t('tunnel.copyFailed'));
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Status Card */}
      {(running || configured) && (
        <Card className={running ? "border-green-500/50 bg-green-500/5" : "border-gray-500/50 bg-gray-500/5"}>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex gap-3 items-start sm:items-center flex-1 min-w-0">
                <div className={`h-3 w-3 rounded-full shrink-0 mt-1.5 sm:mt-0 ${running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {running ? 'Tunnel Active' : 'Tunnel Configured'}
                  </p>
                  {publicUrl && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground truncate">{publicUrl}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 shrink-0"
                        onClick={() => handleCopyUrl(publicUrl)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {dashboardUrl && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground truncate">
                        <span className="text-xs text-blue-500 mr-1">[Dashboard]</span>
                        {dashboardUrl}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 shrink-0"
                        onClick={() => handleCopyUrl(dashboardUrl)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 shrink-0"
                        onClick={() => window.open(dashboardUrl, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {running && uptime !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    {formatUptime(uptime)}
                  </span>
                )}
                <StatusBadge status={state === 'connected' ? 'connected' : state === 'starting' ? 'starting' : state === 'error' ? 'error' : 'stopped'} />
                {running && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      try {
                        await stopNamedTunnel();
                      } catch (error) {
                        console.error('Failed to stop tunnel:', error);
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Stop Tunnel'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">{t('tunnel.error')}</p>
                <p className="text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto Setup Form - Only show when not configured or not running */}
      {!running && (
        <AutoSetupForm
          loading={loading}
          onAutoSetup={autoSetupTunnel}
        />
      )}
    </div>
  );
}

// ==================== Quick Tunnel Card ====================

interface QuickTunnelCardProps {
  enabled: boolean;
  running: boolean;
  state: 'stopped' | 'starting' | 'connected' | 'error';
  publicUrl?: string;
  uptime?: number;
  loading: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onCopyUrl: () => void;
  formatUptime: (seconds?: number) => string;
}

function QuickTunnelCard({
  enabled,
  running,
  state,
  publicUrl,
  uptime,
  loading,
  onStart,
  onStop,
  onCopyUrl,
  formatUptime,
}: QuickTunnelCardProps) {
  const { t } = useTranslation('settings');
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (enabled) {
        await onStop();
      } else {
        await onStart();
      }
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{t('tunnel.quick.title')}</CardTitle>
            <CardDescription>{t('tunnel.quick.description')}</CardDescription>
          </div>
          <StatusBadge
            status={state === 'connected' ? 'connected' : state === 'starting' ? 'starting' : state === 'error' ? 'error' : 'stopped'}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between">
          <div>
            <Label>{t('tunnel.quick.enable')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('tunnel.quick.enableDesc')}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={loading || toggling}
          />
        </div>

        {/* Public URL */}
        {enabled && publicUrl && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label>{t('tunnel.publicUrl')}</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={publicUrl}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onCopyUrl}
                  title={t('tunnel.copyUrl')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Uptime */}
        {enabled && running && uptime !== undefined && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('tunnel.uptime')}</span>
            <span className="font-mono">{formatUptime(uptime)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== Auto Setup Form ====================

interface AutoSetupFormProps {
  loading: boolean;
  onAutoSetup: (config: { apiToken: string; baseDomain?: string; localUrl?: string }) => Promise<void>;
}

function AutoSetupForm({ loading, onAutoSetup }: AutoSetupFormProps) {
  const handleEnableTunnel = async () => {
    // Token and domain are loaded from .env on server side
    // Just trigger auto-setup with empty config
    await onAutoSetup({
      apiToken: '', // Server will use env token
      baseDomain: 'veoforge.ggff.net',
      localUrl: 'http://localhost:2003',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cloudflare Tunnel</CardTitle>
        <CardDescription>
          Enable tunnel to expose your application to the internet with a random subdomain.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleEnableTunnel}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Creating Tunnel...
            </>
          ) : (
            <>
              <Settings2 className="h-5 w-5 mr-2" />
              Enable Tunnel
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Tunnel will be created automatically using configuration from environment variables.
        </p>
      </CardContent>
    </Card>
  );
}

// ==================== Named Tunnel Setup Form ====================

interface NamedTunnelSetupFormProps {
  loading: boolean;
  onSetup: (config: { apiToken: string; tunnelName: string; domain?: string }) => Promise<void>;
  onValidateToken: (apiToken: string) => Promise<{ valid: boolean; accountId?: string }>;
}

function NamedTunnelSetupForm({ loading, onSetup, onValidateToken }: NamedTunnelSetupFormProps) {
  const { t } = useTranslation('settings');
  const [apiToken, setApiToken] = useState('');
  const [tunnelName, setTunnelName] = useState('');
  const [domain, setDomain] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);

  const handleValidate = async () => {
    if (!apiToken.trim()) {
      toast.error(t('tunnel.named.tokenRequired'));
      return;
    }

    setValidating(true);
    try {
      const result = await onValidateToken(apiToken);
      if (result.valid) {
        setValidated(true);
        toast.success(t('tunnel.named.tokenValid'));
      } else {
        setValidated(false);
        toast.error(t('tunnel.named.tokenInvalid'));
      }
    } finally {
      setValidating(false);
    }
  };

  const handleSetup = async () => {
    if (!apiToken.trim() || !tunnelName.trim()) {
      toast.error(t('tunnel.named.fillRequired'));
      return;
    }

    await onSetup({
      apiToken: apiToken.trim(),
      tunnelName: tunnelName.trim(),
      domain: domain.trim() || undefined,
    });
  };

  const isFormValid = apiToken.trim() && tunnelName.trim() && validated;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('tunnel.named.setup')}</CardTitle>
        <CardDescription>{t('tunnel.named.setupDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Token */}
        <div className="space-y-2">
          <Label htmlFor="apiToken">
            {t('tunnel.named.apiToken')}
            <span className="text-destructive ml-1">*</span>
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="apiToken"
                type={showToken ? 'text' : 'password'}
                placeholder={t('tunnel.named.apiTokenPlaceholder')}
                value={apiToken}
                onChange={(e) => {
                  setApiToken(e.target.value);
                  setValidated(false);
                }}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={!apiToken.trim() || validating}
            >
              {validating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : validated ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                t('tunnel.named.validate')
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('tunnel.named.apiTokenHelp')}
          </p>
        </div>

        {/* Tunnel Name */}
        <div className="space-y-2">
          <Label htmlFor="tunnelName">
            {t('tunnel.named.tunnelName')}
            <span className="text-destructive ml-1">*</span>
          </Label>
          <Input
            id="tunnelName"
            placeholder={t('tunnel.named.tunnelNamePlaceholder')}
            value={tunnelName}
            onChange={(e) => setTunnelName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('tunnel.named.tunnelNameHelp')}
          </p>
        </div>

        {/* Domain (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="domain">{t('tunnel.named.domain')}</Label>
          <Input
            id="domain"
            placeholder={t('tunnel.named.domainPlaceholder')}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('tunnel.named.domainHelp')}
          </p>
        </div>

        <Separator />

        {/* Setup Button */}
        <Button
          onClick={handleSetup}
          disabled={!isFormValid || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('tunnel.named.setting')}
            </>
          ) : (
            <>
              <Settings2 className="h-4 w-4 mr-2" />
              {t('tunnel.named.setupButton')}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ==================== Named Tunnel Control Panel ====================

interface NamedTunnelControlPanelProps {
  enabled: boolean;
  running: boolean;
  state: 'stopped' | 'starting' | 'connected' | 'error';
  publicUrl?: string;
  uptime?: number;
  loading: boolean;
  showTeardownConfirm: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onTeardown: () => Promise<void>;
  onCopyUrl: () => void;
  onShowTeardownConfirm: (show: boolean) => void;
  formatUptime: (seconds?: number) => string;
}

function NamedTunnelControlPanel({
  enabled,
  running,
  state,
  publicUrl,
  uptime,
  loading,
  showTeardownConfirm,
  onStart,
  onStop,
  onTeardown,
  onCopyUrl,
  onShowTeardownConfirm,
  formatUptime,
}: NamedTunnelControlPanelProps) {
  const { t } = useTranslation('settings');
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (enabled) {
        await onStop();
      } else {
        await onStart();
      }
    } finally {
      setToggling(false);
    }
  };

  const handleTeardown = async () => {
    await onTeardown();
    onShowTeardownConfirm(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{t('tunnel.named.title')}</CardTitle>
            <CardDescription>{t('tunnel.named.configured')}</CardDescription>
          </div>
          <StatusBadge
            status={state === 'connected' ? 'connected' : state === 'starting' ? 'starting' : state === 'error' ? 'error' : 'stopped'}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between">
          <div>
            <Label>{t('tunnel.named.enable')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('tunnel.named.enableDesc')}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={loading || toggling}
          />
        </div>

        {/* Public URL */}
        {enabled && publicUrl && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label>{t('tunnel.publicUrl')}</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={publicUrl}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onCopyUrl}
                  title={t('tunnel.copyUrl')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Uptime */}
        {enabled && running && uptime !== undefined && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('tunnel.uptime')}</span>
            <span className="font-mono">{formatUptime(uptime)}</span>
          </div>
        )}

        {/* Danger Zone */}
        <Separator />
        <div className="space-y-3">
          <div>
            <Label className="text-destructive">{t('tunnel.named.dangerZone')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('tunnel.named.dangerZoneDesc')}
            </p>
          </div>

          {showTeardownConfirm ? (
            <div className="p-4 rounded-lg border border-destructive bg-destructive/5 space-y-3">
              <div className="flex gap-2 items-start">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">{t('tunnel.named.confirmTeardown')}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('tunnel.named.confirmTeardownDesc')}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="destructive"
                  onClick={handleTeardown}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {t('tunnel.named.confirmButton')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onShowTeardownConfirm(false)}
                  disabled={loading}
                  className="flex-1"
                >
                  {t('common:actions.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => onShowTeardownConfirm(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('tunnel.named.teardown')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
