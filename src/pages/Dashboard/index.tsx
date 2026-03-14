/**
 * Dashboard Page
 * Main overview page showing system status and quick actions
 */
import { useEffect, useState } from 'react';
import {
  Activity,
  MessageSquare,
  Radio,
  Puzzle,
  Clock,
  Settings,
  Plus,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGatewayStore } from '@/stores/gateway';
import { useChannelsStore } from '@/stores/channels';
import { useSkillsStore } from '@/stores/skills';
import { useSettingsStore } from '@/stores/settings';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useTranslation } from 'react-i18next';
import { ChannelIcon } from '@/components/ui/ChannelIcon';

export function Dashboard() {
  const { t } = useTranslation('dashboard');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const isGatewayRunning = useGatewayStore((state) => state.isRunning());
  const { channels, fetchChannels } = useChannelsStore();
  const { skills, fetchSkills } = useSkillsStore();
  const devModeUnlocked = useSettingsStore((state) => state.devModeUnlocked);


  const [uptime, setUptime] = useState(0);

  // Fetch data only when gateway is running
  useEffect(() => {
    if (isGatewayRunning) {
      fetchChannels();
      fetchSkills();
    }
  }, [fetchChannels, fetchSkills, isGatewayRunning]);

  // Calculate statistics safely
  const connectedChannels = Array.isArray(channels) ? channels.filter((c) => c.status === 'connected').length : 0;
  const enabledSkills = Array.isArray(skills) ? skills.filter((s) => s.enabled).length : 0;

  // Update uptime periodically
  useEffect(() => {
    const updateUptime = () => {
      if (gatewayStatus.connectedAt) {
        setUptime(Math.floor((Date.now() - gatewayStatus.connectedAt) / 1000));
      } else {
        setUptime(0);
      }
    };

    // Update immediately
    updateUptime();

    // Update every second
    const interval = setInterval(updateUptime, 1000);

    return () => clearInterval(interval);
  }, [gatewayStatus.connectedAt]);

  const openDevConsole = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('gateway:getControlUiUrl') as {
        success: boolean;
        url?: string;
        error?: string;
      };
      if (result.success && result.url) {
        window.electron.openExternal(result.url);
      } else {
        console.error('Failed to get Dev Console URL:', result.error);
      }
    } catch (err) {
      console.error('Error opening Dev Console:', err);
    }
  };

  const openGatewayDashboard = async () => {
    // Use dashboardUrl from API (includes auth token), fallback to publicUrl + token
    try {
      const status = await api.getTunnelStatus();
      // dashboardUrl already has token, e.g. https://dashboard-xxx/?token=abc
      if (status.dashboardUrl) {
        window.open(status.dashboardUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {
      // ignore
    }
    const { toast } = await import('sonner');
    toast.error('Tunnel chưa kết nối. Vui lòng bật tunnel trước.');
  };

  const [bannerDismissed, setBannerDismissed] = useState(() =>
    localStorage.getItem('gateway-banner-dismissed') === 'true'
  );

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem('gateway-banner-dismissed', 'true');
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-16 md:pb-0">
      {/* Gateway Dashboard Recommendation Banner */}
      {!bannerDismissed && (
        <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 md:p-5">
          <button
            onClick={dismissBanner}
            className="absolute top-2 right-3 text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2 text-2xl">
              <span>✨</span>
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm md:text-base">
                Trải nghiệm chat tốt hơn với Gateway Dashboard
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Sử dụng Gateway Dashboard để chat với AI — giao diện tối ưu, hỗ trợ đầy đủ tính năng và phản hồi nhanh hơn.
              </p>
            </div>
            <Button
              onClick={openGatewayDashboard}
              size="sm"
              className="shrink-0 gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Mở Gateway Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Gateway Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('gateway')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <StatusBadge status={gatewayStatus.state} />
            </div>
            {isGatewayRunning && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('port', { port: gatewayStatus.port })} | {t('pid', { pid: gatewayStatus.pid || 'N/A' })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Channels */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('channels')}</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectedChannels}</div>
            <p className="text-xs text-muted-foreground">
              {t('connectedOf', { connected: connectedChannels, total: channels.length })}
            </p>
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('skills')}</CardTitle>
            <Puzzle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enabledSkills}</div>
            <p className="text-xs text-muted-foreground">
              {t('enabledOf', { enabled: enabledSkills, total: skills.length })}
            </p>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('uptime')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {uptime > 0 ? formatUptime(uptime) : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {isGatewayRunning ? t('sinceRestart') : t('gatewayNotRunning')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickActions.title')}</CardTitle>
          <CardDescription>{t('quickActions.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link to="/channels">
                <Plus className="h-5 w-5" />
                <span>{t('quickActions.addChannel')}</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link to="/skills">
                <Puzzle className="h-5 w-5" />
                <span>{t('quickActions.browseSkills')}</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link to="/">
                <MessageSquare className="h-5 w-5" />
                <span>{t('quickActions.openChat')}</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link to="/settings">
                <Settings className="h-5 w-5" />
                <span>{t('quickActions.settings')}</span>
              </Link>
            </Button>
            {devModeUnlocked && (
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4"
                onClick={openDevConsole}
              >
                <Terminal className="h-5 w-5" />
                <span>{t('quickActions.devConsole')}</span>
              </Button>
            )}
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={openGatewayDashboard}
            >
              <ExternalLink className="h-5 w-5" />
              <span>{t('quickActions.gatewayDashboard', 'Gateway Dashboard')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Connected Channels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('connectedChannels')}</CardTitle>
          </CardHeader>
          <CardContent>
            {channels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t('noChannels')}</p>
                <Button variant="link" asChild className="mt-2">
                  <Link to="/channels">{t('addFirst')}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {channels.slice(0, 5).map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <ChannelIcon type={channel.type} className="h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-medium">{channel.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {channel.type}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={channel.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enabled Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('activeSkills')}</CardTitle>
          </CardHeader>
          <CardContent>
            {skills.filter((s) => s.enabled).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Puzzle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t('noSkills')}</p>
                <Button variant="link" asChild className="mt-2">
                  <Link to="/skills">{t('enableSome')}</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {skills
                  .filter((s) => s.enabled)
                  .slice(0, 12)
                  .map((skill) => (
                    <Badge key={skill.id} variant="secondary">
                      {skill.icon && <span className="mr-1">{skill.icon}</span>}
                      {skill.name}
                    </Badge>
                  ))}
                {skills.filter((s) => s.enabled).length > 12 && (
                  <Badge variant="outline">
                    {t('more', { count: skills.filter((s) => s.enabled).length - 12 })}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export default Dashboard;
