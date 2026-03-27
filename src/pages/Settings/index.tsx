/**
 * Settings Page
 * Application configuration
 */
import { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  Terminal,
  ExternalLink,
  Key,
  Download,
  Copy,
  FileText,
  Globe,
  Shield,
  Loader2,
  Eye,
  EyeOff,
  LogOut,
  Stethoscope,
  Wifi,
  AlertTriangle,
  Gift,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings';
import { useGatewayStore } from '@/stores/gateway';
import { useUpdateStore } from '@/stores/update';
import { ProvidersSettings } from '@/components/settings/ProvidersSettings';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
import { WebUpdateSettings } from '@/components/settings/WebUpdateSettings';
import { TunnelSettings } from '@/components/settings/TunnelSettings';
import { ExecSettings } from '@/components/settings/ExecSettings';
import { WifiSettings } from '@/components/settings/WifiSettings';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { platform } from '@/lib/platform';
type ControlUiInfo = {
  url: string;
  token: string;
  port: number;
};

/** Security Settings — change password & logout */
function SecuritySettings() {
  const { t } = useTranslation('settings');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(d => setAuthEnabled(d.authRequired))
      .catch(() => { });
  }, []);

  if (!authEnabled) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('security.passwordMismatch'));
      return;
    }
    if (newPassword.length < 4) {
      toast.error(t('security.passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('security.passwordChanged'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Failed to change password');
      }
    } catch {
      toast.error(t('security.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('security.title')}
        </CardTitle>
        <CardDescription>{t('security.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="space-y-2">
            <Label>{t('security.currentPassword')}</Label>
            <div className="relative">
              <Input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('security.currentPasswordPlaceholder')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('security.newPassword')}</Label>
            <div className="relative">
              <Input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('security.newPasswordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('security.confirmPassword')}</Label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('security.confirmPasswordPlaceholder')}
            />
          </div>
          <Button type="submit" disabled={loading || !currentPassword || !newPassword || !confirmPassword} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {t('security.changePassword')}
          </Button>
        </form>

        <Separator />

        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          {t('security.signOut')}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Google Workspace Card — Connect Google account for GWS skill */
function GoogleWorkspaceCard() {
  const [status, setStatus] = useState<{
    connected: boolean;
    userId?: string;
    email?: string;
    accessToken?: string;
    tokenPreview?: string;
    error?: string;
  }>({ connected: false });
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [installingSkill, setInstallingSkill] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/google-auth/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Check if returning from OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') === 'connected') {
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('google');
      window.history.replaceState({}, '', url.toString());
      // Recheck status and auto-install skill
      checkStatus().then(() => installSkill());
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/google-auth/start');
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error('Failed to get auth URL');
      }
    } catch {
      toast.error('Failed to start Google auth');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/google-auth/disconnect', { method: 'DELETE' });
      setStatus({ connected: false });
      toast.success('Google Workspace disconnected');
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const installSkill = async () => {
    setInstallingSkill(true);
    try {
      await fetch('/api/gateway/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'openclaw skill install luccast/gogcli' }),
      });
      toast.success('gogcli (Google Workspace CLI) skill installed');
    } catch {
      // Skill install is best-effort
    } finally {
      setInstallingSkill(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google Workspace
        </CardTitle>
        <CardDescription>
          Kết nối Google để sử dụng Gmail, Drive, Calendar, Sheets, Docs, Slides, Contacts, Tasks qua AI (gogcli)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang kiểm tra...
          </div>
        ) : status.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                ✓ Đã kết nối
              </Badge>
              {status.email && (
                <span className="text-sm text-muted-foreground">{status.email}</span>
              )}
            </div>

            {/* Access Token Preview */}
            {status.accessToken && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Access Token</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted/50 px-3 py-2 rounded-md border font-mono truncate select-all">
                    {showToken ? status.accessToken : status.tokenPreview}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setShowToken(!showToken)}
                    title={showToken ? 'Ẩn token' : 'Hiện token'}
                  >
                    {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(status.accessToken!);
                      toast.success('Đã copy Access Token');
                    }}
                    title="Copy token"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              OpenClaw sử dụng gogcli để đọc/gửi Gmail, quản lý Drive, Calendar, Sheets, Docs, Slides, Contacts, Tasks. Token tự động làm mới.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
              Ngắt kết nối
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Kết nối tài khoản Google để cho phép OpenClaw truy cập Gmail, Drive, Calendar, Sheets, Docs và các dịch vụ khác.
            </p>
            <Button
              onClick={handleConnect}
              disabled={connecting || installingSkill}
              className="w-full"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {connecting ? 'Đang kết nối...' : 'Kết nối Google Account'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Doctor Fix Card — run openclaw doctor --fix */
function DoctorFixCard() {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const runDoctor = async () => {
    setLoading(true);
    setOutput(null);
    try {
      const res = await fetch('/api/gateway/doctor', { method: 'POST' });
      const data = await res.json();
      setOutput(data.output || 'No output');
      if (data.fixed) {
        toast.success('Doctor fix completed');
      } else {
        toast.info('Doctor completed');
      }
    } catch {
      toast.error('Failed to run doctor fix');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          Doctor Fix
        </CardTitle>
        <CardDescription>Kiểm tra và sửa lỗi cấu hình OpenClaw</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={runDoctor} disabled={loading} variant="outline" className="w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Stethoscope className="w-4 h-4 mr-2" />}
          {loading ? 'Đang chạy...' : 'Run Doctor Fix'}
        </Button>
        {output && (
          <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg max-h-60 overflow-auto whitespace-pre-wrap font-mono border">
            {output}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

export function Settings() {
  const { t } = useTranslation('settings');
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    gatewayAutoStart,
    setGatewayAutoStart,
    autoCheckUpdate,
    setAutoCheckUpdate,
    autoDownloadUpdate,
    setAutoDownloadUpdate,
    devModeUnlocked,
    setDevModeUnlocked,
  } = useSettingsStore();

  const { status: gatewayStatus, restart: restartGateway } = useGatewayStore();
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const updateSetAutoDownload = useUpdateStore((state) => state.setAutoDownload);
  const [controlUiInfo, setControlUiInfo] = useState<ControlUiInfo | null>(null);
  const [openclawCliCommand, setOpenclawCliCommand] = useState('');
  const [openclawCliError, setOpenclawCliError] = useState<string | null>(null);
  const [installingCli, setInstallingCli] = useState(false);

  const isMac = platform.os === 'darwin';
  const isWindows = platform.os === 'win32';
  const isLinux = platform.os === 'linux';
  const isDev = platform.isDev;
  const showCliTools = platform.isElectron && (isMac || isWindows || isLinux);
  const [showLogs, setShowLogs] = useState(false);
  const [logContent, setLogContent] = useState('');

  const handleShowLogs = async () => {
    try {
      const logs = await window.electron.ipcRenderer.invoke('log:readFile', 100) as string;
      setLogContent(logs);
      setShowLogs(true);
    } catch {
      setLogContent('(Failed to load logs)');
      setShowLogs(true);
    }
  };

  const handleOpenLogDir = async () => {
    try {
      const logDir = await window.electron.ipcRenderer.invoke('log:getDir') as string;
      if (logDir) {
        await window.electron.ipcRenderer.invoke('shell:showItemInFolder', logDir);
      }
    } catch {
      // ignore
    }
  };

  // Open developer console
  const openDevConsole = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('gateway:getControlUiUrl') as {
        success: boolean;
        url?: string;
        token?: string;
        port?: number;
        error?: string;
      };
      if (result.success && result.url && result.token && typeof result.port === 'number') {
        setControlUiInfo({ url: result.url, token: result.token, port: result.port });
        window.electron.openExternal(result.url);
      } else {
        console.error('Failed to get Dev Console URL:', result.error);
      }
    } catch (err) {
      console.error('Error opening Dev Console:', err);
    }
  };

  const refreshControlUiInfo = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('gateway:getControlUiUrl') as {
        success: boolean;
        url?: string;
        token?: string;
        port?: number;
      };
      if (result.success && result.url && result.token && typeof result.port === 'number') {
        setControlUiInfo({ url: result.url, token: result.token, port: result.port });
      }
    } catch {
      // Ignore refresh errors
    }
  };

  const handleCopyGatewayToken = async () => {
    if (!controlUiInfo?.token) return;
    try {
      await navigator.clipboard.writeText(controlUiInfo.token);
      toast.success(t('developer.tokenCopied'));
    } catch (error) {
      toast.error(`Failed to copy token: ${String(error)}`);
    }
  };

  useEffect(() => {
    if (!showCliTools) return;
    let cancelled = false;

    const loadCliCommand = async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke('openclaw:getCliCommand') as {
          success: boolean;
          command?: string;
          error?: string;
        };
        if (cancelled) return;
        if (result.success && result.command) {
          setOpenclawCliCommand(result.command);
          setOpenclawCliError(null);
        } else {
          setOpenclawCliCommand('');
          setOpenclawCliError(result.error || 'OpenClaw CLI unavailable');
        }
      } catch (error) {
        if (cancelled) return;
        setOpenclawCliCommand('');
        setOpenclawCliError(String(error));
      }
    };

    loadCliCommand();
    return () => {
      cancelled = true;
    };
  }, [devModeUnlocked, showCliTools]);

  const handleCopyCliCommand = async () => {
    if (!openclawCliCommand) return;
    try {
      await navigator.clipboard.writeText(openclawCliCommand);
      toast.success(t('developer.cmdCopied'));
    } catch (error) {
      toast.error(`Failed to copy command: ${String(error)}`);
    }
  };

  const handleInstallCliCommand = async () => {
    if (!isMac || installingCli) return;
    try {
      const confirmation = await window.electron.ipcRenderer.invoke('dialog:message', {
        type: 'question',
        title: t('developer.installTitle'),
        message: t('developer.installMessage'),
        detail: t('developer.installDetail'),
        buttons: ['Cancel', 'Install'],
        defaultId: 1,
        cancelId: 0,
      }) as { response: number };

      if (confirmation.response !== 1) return;

      setInstallingCli(true);
      const result = await window.electron.ipcRenderer.invoke('openclaw:installCliMac') as {
        success: boolean;
        path?: string;
        error?: string;
      };

      if (result.success) {
        toast.success(`Installed command at ${result.path ?? '/usr/local/bin/openclaw'}`);
      } else {
        toast.error(result.error || 'Failed to install command');
      }
    } catch (error) {
      toast.error(`Install failed: ${String(error)}`);
    } finally {
      setInstallingCli(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 md:p-6 pb-16 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* OpenClaw Version Warning */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
        <div className="flex gap-3">
          <div className="shrink-0 rounded-lg bg-amber-500/10 p-2 h-fit">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              OpenClaw v2026.3.2
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-0.5 leading-relaxed">
              Vui lòng không update OpenClaw để tránh lỗi ngoài ý muốn. Nếu cố tình update OpenClaw sẽ không bảo hành phần mềm.
            </p>
          </div>
        </div>
      </div>

      {/* Codex Trial Banner */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 animate-in fade-in-0 slide-in-from-top-2 duration-300" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        <div className="flex gap-3">
          <div className="shrink-0 rounded-lg bg-primary/10 p-2 h-fit">
            <Gift className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Dùng thử Codex — 4 ngày
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Chúng tôi đã add sẵn tài khoản GPT Codex để dùng thử. Sau khi hết thời gian dùng thử, vui lòng mua và sử dụng tài khoản theo{' '}
              <a
                href="https://docs.openclaw-box.com/usage/codex.html#huong-dan-mua-va-su-dung-codex"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                hướng dẫn tại đây
              </a>.
            </p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>{t('appearance.title')}</CardTitle>
          <CardDescription>{t('appearance.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('appearance.theme')}</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-4 w-4 mr-2" />
                {t('appearance.light')}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-4 w-4 mr-2" />
                {t('appearance.dark')}
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
              >
                <Monitor className="h-4 w-4 mr-2" />
                {t('appearance.system')}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('appearance.language')}</Label>
            <div className="flex gap-2 flex-wrap">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <Button
                  key={lang.code}
                  variant={language === lang.code ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLanguage(lang.code)}
                >
                  {lang.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t('aiProviders.title')}
          </CardTitle>
          <CardDescription>{t('aiProviders.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProvidersSettings />
        </CardContent>
      </Card>

      {/* Gateway */}
      <Card>
        <CardHeader>
          <CardTitle>{t('gateway.title')}</CardTitle>
          <CardDescription>{t('gateway.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <Label>{t('gateway.status')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('gateway.port')}: {gatewayStatus.port}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={
                  gatewayStatus.state === 'running' || gatewayStatus.state === 'connected'
                    ? 'success'
                    : gatewayStatus.state === 'error'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {gatewayStatus.state}
              </Badge>
              <Button variant="outline" size="sm" onClick={restartGateway}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('common:actions.restart')}
              </Button>
              {platform.isElectron && (
                <Button variant="outline" size="sm" onClick={handleShowLogs}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('gateway.logs')}
                </Button>
              )}
            </div>
          </div>

          {showLogs && (
            <div className="mt-4 p-4 rounded-lg bg-black/10 dark:bg-black/40 border border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">{t('gateway.appLogs')}</p>
                <div className="flex gap-2">
                  {platform.isElectron && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleOpenLogDir}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {t('gateway.openFolder')}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowLogs(false)}>
                    {t('common:actions.close')}
                  </Button>
                </div>
              </div>
              <pre className="text-xs text-muted-foreground bg-background/50 p-3 rounded max-h-60 overflow-auto whitespace-pre-wrap font-mono">
                {logContent || t('chat:noLogs')}
              </pre>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Cloudflare Tunnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('tunnel.title')}
          </CardTitle>
          <CardDescription>{t('tunnel.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <TunnelSettings />
        </CardContent>
      </Card>

      {/* WiFi Settings (temporarily hidden) */}
      {false && platform.isWeb && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              WiFi
            </CardTitle>
            <CardDescription>Quản lý kết nối WiFi — quét, kết nối, ngắt mạng</CardDescription>
          </CardHeader>
          <CardContent>
            <WifiSettings />
          </CardContent>
        </Card>
      )}

      {/* Google Workspace */}
      {platform.isWeb && (
        <GoogleWorkspaceCard />
      )}

      {/* Doctor Fix */}
      {platform.isWeb && (
        <DoctorFixCard />
      )}

      {/* Updates - Web/VPS mode */}
      {platform.isWeb && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('updates.title')}
            </CardTitle>
            <CardDescription>Check for and install ClawX-Web updates</CardDescription>
          </CardHeader>
          <CardContent>
            <WebUpdateSettings />
          </CardContent>
        </Card>
      )}

      {/* Updates - Only available in Electron mode */}
      {platform.isElectron && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('updates.title')}
            </CardTitle>
            <CardDescription>{t('updates.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UpdateSettings />

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('updates.autoCheck')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('updates.autoCheckDesc')}
                </p>
              </div>
              <Switch
                checked={autoCheckUpdate}
                onCheckedChange={setAutoCheckUpdate}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('updates.autoDownload')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('updates.autoDownloadDesc')}
                </p>
              </div>
              <Switch
                checked={autoDownloadUpdate}
                onCheckedChange={(value) => {
                  setAutoDownloadUpdate(value);
                  updateSetAutoDownload(value);
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}


      {/* Security — only in web mode when auth is enabled */}
      {platform.isWeb && (
        <SecuritySettings />
      )}

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>{t('about.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>{t('about.appName')}</strong> - {t('about.tagline')}
          </p>
          <p>{t('about.basedOn')}</p>
          <p>{t('about.version', { version: currentVersion })}</p>
          <div className="flex gap-4 pt-2">
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => window.electron.openExternal('https://claw-x.com')}
            >
              {t('about.docs')}
            </Button>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => window.electron.openExternal('https://github.com/ValueCell-ai/ClawX')}
            >
              {t('about.github')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;
