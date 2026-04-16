/**
 * Dashboard Page
 * System overview with status, quick actions, and connected services
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  MessageSquare,
  Radio,
  Puzzle,
  Clock,
  Settings,
  Plus,
  Terminal,
  ChevronRight,
  Zap,
  ArrowUpRight,
  X,
  Monitor,
  Coins,
} from 'lucide-react';
import { TicketButton } from '@/components/chat/TicketButton';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGatewayStore } from '@/stores/gateway';
import { useChannelsStore } from '@/stores/channels';
import { useSkillsStore } from '@/stores/skills';
import { useSettingsStore } from '@/stores/settings';
import { useSystemMonitorStore } from '@/stores/system-monitor';
import { api } from '@/lib/api';
import { ws } from '@/lib/websocket';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { ChannelIcon } from '@/components/ui/ChannelIcon';
import { Skeleton } from '@/components/common/Skeleton';
import { MessageAreaChart, ActivityHeatmap } from '@/components/charts/DashboardCharts';
import {
  CpuGauge,
  MemoryBar,
  DiskBars,
  NetworkSparkline,
  GpuInfo,
  ContainerList,
  SystemInfoBadges,
  PowerEstimate,
} from '@/components/charts/SystemCharts';

export function Dashboard() {
  const { t } = useTranslation('dashboard');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const isGatewayRunning = useGatewayStore((state) => state.isRunning());
  const { channels, loading: channelsLoading, fetchChannels } = useChannelsStore();
  const { skills, loading: skillsLoading, fetchSkills } = useSkillsStore();
  const devModeUnlocked = useSettingsStore((state) => state.devModeUnlocked);
  const isLoading = channelsLoading || skillsLoading;

  const [uptime, setUptime] = useState(0);
  const [analyticsDaily, setAnalyticsDaily] = useState<Array<{ date: string; sent: number; received: number }>>([]);
  const [analyticsHourly, setAnalyticsHourly] = useState<Record<string, number>>({});
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Token usage stats
  const [tokenStats, setTokenStats] = useState<{
    daily: Array<{ date: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; estimatedCost: number; requests: number }>;
    byProvider: Record<string, { inputTokens: number; outputTokens: number; estimatedCost: number; requests: number }>;
    totals: { inputTokens: number; outputTokens: number; cacheReadTokens: number; estimatedCost: number; requests: number };
  } | null>(null);

  // System monitor
  const systemMetrics = useSystemMonitorStore((s) => s.metrics);
  const networkHistory = useSystemMonitorStore((s) => s.networkHistory);
  const setSystemMetrics = useSystemMonitorStore((s) => s.setMetrics);

  // Listen for real-time system metrics via WebSocket
  useEffect(() => {
    const handler = (data: any) => {
      setSystemMetrics(data);
    };
    ws.on('system.metrics', handler);

    // Also fetch initial metrics via REST if no cached data
    if (!systemMetrics) {
      api.getSystemMetrics().then(setSystemMetrics).catch(() => {});
    }

    return () => { ws.off('system.metrics', handler); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isGatewayRunning) {
      fetchChannels();
      fetchSkills();
    }
  }, [fetchChannels, fetchSkills, isGatewayRunning]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAnalytics() {
      setAnalyticsLoading(true);
      try {
        const [dailyRaw, hourlyRaw, tokenStatsRaw] = await Promise.all([
          api.getAnalyticsDaily(7).catch(() => ({})),
          api.getAnalyticsHourly().catch(() => ({})),
          api.getTokenStats(7).catch(() => null),
        ]);
        if (!cancelled && tokenStatsRaw) {
          setTokenStats(tokenStatsRaw);
        }
        if (!cancelled) {
          // Transform daily stats object to array for chart
          const dailyArray = Object.entries(dailyRaw as Record<string, { sent: number; received: number }>)
            .map(([date, stats]) => ({
              date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
              sent: stats?.sent ?? 0,
              received: stats?.received ?? 0,
            }))
            .reverse();
          setAnalyticsDaily(dailyArray);
          setAnalyticsHourly((hourlyRaw ?? {}) as Record<string, number>);
        }
      } catch {
        // graceful fallback — charts will show empty state
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    }
    fetchAnalytics();
    return () => { cancelled = true; };
  }, []);

  const connectedChannels = Array.isArray(channels) ? channels.filter((c) => c.status === 'connected').length : 0;
  const enabledSkills = Array.isArray(skills) ? skills.filter((s) => s.enabled).length : 0;

  useEffect(() => {
    const updateUptime = () => {
      if (gatewayStatus.connectedAt) {
        setUptime(Math.floor((Date.now() - gatewayStatus.connectedAt) / 1000));
      } else {
        setUptime(0);
      }
    };
    updateUptime();
    const interval = setInterval(updateUptime, 1000);
    return () => clearInterval(interval);
  }, [gatewayStatus.connectedAt]);

  const openGatewayDashboard = useCallback(async () => {
    try {
      const status = await api.getTunnelStatus();
      if (status.dashboardUrl) {
        window.open(status.dashboardUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch { /* ignore */ }
    const { toast } = await import('sonner');
    toast.error(t('tunnelNotConnected', 'Tunnel chưa kết nối. Vui lòng bật tunnel trước.'));
  }, [t]);

  const openDevConsole = useCallback(async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('gateway:getControlUiUrl') as {
        success: boolean; url?: string; error?: string;
      };
      if (result.success && result.url) {
        window.electron.openExternal(result.url);
      }
    } catch (err) {
      console.error('Error opening Dev Console:', err);
    }
  }, []);

  const [bannerDismissed, setBannerDismissed] = useState(() =>
    localStorage.getItem('gateway-banner-dismissed') === 'true'
  );
  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    localStorage.setItem('gateway-banner-dismissed', 'true');
  }, []);

  return (
    <div className="space-y-6 pb-16 md:pb-0">
      {/* Banner */}
      {!bannerDismissed && (
        <div className="relative rounded-lg border bg-muted/50 p-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <button
            onClick={dismissBanner}
            className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="shrink-0 rounded-lg bg-primary/10 p-2">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {t('banner.title', 'Trải nghiệm chat tốt hơn với Gateway Dashboard')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('banner.desc', 'Giao diện tối ưu, hỗ trợ đầy đủ tính năng và phản hồi nhanh hơn.')}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={openGatewayDashboard} className="shrink-0 gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {t('banner.cta', 'Mở Dashboard')}
            </Button>
          </div>
        </div>
      )}

      {/* Status Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusCard
          label={t('gateway')}
          icon={Activity}
          delay={0}
        >
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              'h-2 w-2 rounded-full shrink-0',
              isGatewayRunning ? 'bg-green-500' : 'bg-muted-foreground/30',
              isGatewayRunning && 'animate-pulse',
            )} />
            <span className={cn(
              'text-sm font-medium',
              isGatewayRunning ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
            )}>
              {isGatewayRunning ? 'Connected' : 'Offline'}
            </span>
          </div>
          {isGatewayRunning && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('port', { port: gatewayStatus.port })}
            </p>
          )}
        </StatusCard>

        <StatusCard label={t('channels')} icon={Radio} delay={50}>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-10 mt-1" />
              <Skeleton variant="text" className="w-24 mt-1.5" />
            </>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-tight mt-1">{connectedChannels}</p>
              <p className="text-[11px] text-muted-foreground">
                {t('connectedOf', { connected: connectedChannels, total: channels.length })}
              </p>
            </>
          )}
        </StatusCard>

        <StatusCard label={t('skills')} icon={Puzzle} delay={100}>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-10 mt-1" />
              <Skeleton variant="text" className="w-28 mt-1.5" />
            </>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-tight mt-1">{enabledSkills}</p>
              <p className="text-[11px] text-muted-foreground">
                {t('enabledOf', { enabled: enabledSkills, total: skills.length })}
              </p>
            </>
          )}
        </StatusCard>

        <StatusCard label={t('uptime')} icon={Clock} delay={150}>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-14 mt-1" />
              <Skeleton variant="text" className="w-20 mt-1.5" />
            </>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-tight tabular-nums mt-1">
                {uptime > 0 ? formatUptime(uptime) : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isGatewayRunning ? t('sinceRestart') : t('gatewayNotRunning')}
              </p>
            </>
          )}
        </StatusCard>
      </div>

      {/* Token Usage */}
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '180ms', animationFillMode: 'both' }}>
        <div className="flex items-center gap-2 mb-3">
          <Coins className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">{t('tokenUsage.title', 'Token Usage')}</h3>
        </div>
        {analyticsLoading || !tokenStats ? (
          /* Loading skeleton */
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton variant="text" className="w-20 mb-2" />
                  <Skeleton className="h-8 w-24 mb-1" />
                  <Skeleton variant="text" className="w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tokenStats.totals.inputTokens === 0 && tokenStats.totals.outputTokens === 0 ? (
          /* Empty state */
          <Card>
            <CardContent className="p-4">
              <div className="text-center py-4">
                <Coins className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t('tokenUsage.noData', 'No token usage data yet. Start chatting to see stats.')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Data cards */
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Cost */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('tokenUsage.estimatedCost', 'Est. Cost (7d)')}</span>
                </div>
                <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums">
                  ${tokenStats.totals.estimatedCost.toFixed(4)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatTokenCount(tokenStats.totals.inputTokens + tokenStats.totals.outputTokens)} {t('tokenUsage.totalTokens', 'total tokens')}
                </p>
              </CardContent>
            </Card>
            {/* Input Tokens */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('tokenUsage.inputTokens', 'Input Tokens')}</span>
                </div>
                <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums">
                  {formatTokenCount(tokenStats.totals.inputTokens)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t('tokenUsage.last7days', 'Last 7 days')}</p>
              </CardContent>
            </Card>
            {/* Output Tokens */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('tokenUsage.outputTokens', 'Output Tokens')}</span>
                </div>
                <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums">
                  {formatTokenCount(tokenStats.totals.outputTokens)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t('tokenUsage.last7days', 'Last 7 days')}</p>
              </CardContent>
            </Card>
            {/* Cache Read */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('tokenUsage.cacheRead', 'Cache Read')}</span>
                </div>
                <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums">
                  {formatTokenCount(tokenStats.totals.cacheReadTokens)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t('tokenUsage.savedFromCache', 'tokens saved from cache')}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('quickActions.title')}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <QuickAction to="/channels" icon={Plus} label={t('quickActions.addChannel')} />
          <QuickAction to="/skills" icon={Puzzle} label={t('quickActions.browseSkills')} />
          <QuickAction to="/" icon={MessageSquare} label={t('quickActions.openChat')} />
          <QuickAction to="/settings" icon={Settings} label={t('quickActions.settings')} />
          {devModeUnlocked && (
            <QuickAction icon={Terminal} label={t('quickActions.devConsole')} onClick={openDevConsole} />
          )}
        </div>
      </div>

      {/* System Monitor */}
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '230ms', animationFillMode: 'both' }}>
        <div className="flex items-center gap-2 mb-3">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">{t('systemMonitor.title', 'System Monitor')}</h3>
          {systemMetrics && (
            <SystemInfoBadges os={systemMetrics.os} />
          )}
        </div>

        {!systemMetrics ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="w-full" height={120} /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {/* CPU */}
            <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '240ms', animationFillMode: 'both' }}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('systemMonitor.cpu', 'CPU')}</p>
                <CpuGauge
                  usage={systemMetrics.cpu.usage}
                  temp={systemMetrics.cpu.temp}
                  model={systemMetrics.cpu.model}
                />
              </CardContent>
            </Card>

            {/* Memory */}
            <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '260ms', animationFillMode: 'both' }}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('systemMonitor.memory', 'Memory')}</p>
                <MemoryBar memory={systemMetrics.memory} />
              </CardContent>
            </Card>

            {/* Network */}
            <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '280ms', animationFillMode: 'both' }}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('systemMonitor.networkTitle', 'Network I/O')}</p>
                <NetworkSparkline history={networkHistory} current={systemMetrics.network} />
              </CardContent>
            </Card>

            {/* Power / Energy */}
            <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '290ms', animationFillMode: 'both' }}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('systemMonitor.power', 'Power')}</p>
                <PowerEstimate cpuUsage={systemMetrics.cpu.usage} uptimeSeconds={systemMetrics.os.uptime} />
              </CardContent>
            </Card>

            {/* Disk */}
            {systemMetrics.disk.length > 0 && (
              <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '310ms', animationFillMode: 'both' }}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('systemMonitor.storage', 'Storage')}</p>
                  <DiskBars disks={systemMetrics.disk} />
                </CardContent>
              </Card>
            )}

            {/* GPU */}
            {systemMetrics.gpu.length > 0 && (
              <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '320ms', animationFillMode: 'both' }}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('systemMonitor.gpu', 'GPU')}</p>
                  <GpuInfo gpus={systemMetrics.gpu} />
                </CardContent>
              </Card>
            )}

            {/* Docker Containers */}
            {systemMetrics.containers.length > 0 && (
              <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '340ms', animationFillMode: 'both' }}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('systemMonitor.docker', 'Docker')}</p>
                  <ContainerList containers={systemMetrics.containers} />
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Analytics */}
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '350ms', animationFillMode: 'both' }}>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('analytics.title')}</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('analytics.messages')}</p>
              <MessageAreaChart data={analyticsDaily} loading={analyticsLoading} />
            </CardContent>
          </Card>
          <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '450ms', animationFillMode: 'both' }}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('analytics.activity')}</p>
              <ActivityHeatmap data={analyticsHourly} loading={analyticsLoading} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Grid: Channels + Skills */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
        {/* Connected Channels */}
        <Card>
          <div className="flex items-center justify-between p-4 pb-0">
            <h3 className="text-sm font-medium">{t('connectedChannels')}</h3>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-muted-foreground">
              <Link to="/channels">
                {t('viewAll', 'Xem tất cả')}
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Link>
            </Button>
          </div>
          <CardContent className="p-4 pt-3">
            {channelsLoading ? (
              <div className="space-y-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <Skeleton variant="circular" width={16} height={16} />
                      <Skeleton variant="text" className="w-24" />
                    </div>
                    <Skeleton variant="circular" width={6} height={6} />
                  </div>
                ))}
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-6">
                <Radio className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t('noChannels')}</p>
                <Button variant="link" size="sm" asChild className="mt-1 h-auto p-0 text-xs">
                  <Link to="/channels">{t('addFirst')}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {channels.slice(0, 5).map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChannelIcon type={channel.type} className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate">{channel.name}</span>
                    </div>
                    <span className={cn(
                      'h-1.5 w-1.5 rounded-full shrink-0',
                      channel.status === 'connected' ? 'bg-green-500' : 'bg-muted-foreground/30',
                    )} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Skills */}
        <Card>
          <div className="flex items-center justify-between p-4 pb-0">
            <h3 className="text-sm font-medium">{t('activeSkills')}</h3>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-muted-foreground">
              <Link to="/skills">
                {t('viewAll', 'Xem tất cả')}
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Link>
            </Button>
          </div>
          <CardContent className="p-4 pt-3">
            {skillsLoading ? (
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <Skeleton key={i} className="h-6 rounded-full" style={{ width: `${60 + (i % 3) * 20}px` }} />
                ))}
              </div>
            ) : enabledSkills === 0 ? (
              <div className="text-center py-6">
                <Puzzle className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t('noSkills')}</p>
                <Button variant="link" size="sm" asChild className="mt-1 h-auto p-0 text-xs">
                  <Link to="/skills">{t('enableSome')}</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {skills
                  .filter((s) => s.enabled)
                  .slice(0, 15)
                  .map((skill) => (
                    <Badge
                      key={skill.id}
                      variant="secondary"
                      className="text-xs font-normal py-0.5"
                    >
                      {skill.name}
                    </Badge>
                  ))}
                {enabledSkills > 15 && (
                  <Badge variant="outline" className="text-xs font-normal py-0.5">
                    {t('more', { count: enabledSkills - 15 })}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Support Ticket Button */}
      <TicketButton />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function StatusCard({
  label,
  icon: Icon,
  delay,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <Card
      className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground/50" />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      <span className="text-xs">{label}</span>
    </>
  );

  const className = cn(
    'group flex items-center gap-2.5 rounded-lg border px-3 py-2.5',
    'text-foreground/80 hover:text-foreground hover:bg-muted/50 hover:border-foreground/10',
    'transition-all duration-200',
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export default Dashboard;
