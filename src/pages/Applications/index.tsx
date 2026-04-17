import { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, AlertTriangle, Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { APPLICATIONS_CATALOG, POPULAR_SLUGS, type AppDefinition } from '@/lib/applications-catalog';
import { useApplicationsStore } from '@/stores/applications';
import { AppCard } from './AppCard';
import { AppDetailDialog } from './AppDetailDialog';

export function Applications() {
  const { t } = useTranslation('applications');
  const { status, connections, fetchStatus, fetchConnections, connect, disconnect, finalize } =
    useApplicationsStore();
  const [query, setQuery] = useState('');
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchConnections();
  }, [fetchStatus, fetchConnections]);

  // Handle callback query param after real OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    if (connected) {
      finalize(connected)
        .then((status) => {
          if (status === 'ACTIVE') toast.success(t('toast.connected', { app: connected }));
        })
        .catch(() => {});
      // Clean URL
      window.history.replaceState({}, '', '/applications');
    }
  }, [finalize, t]);

  // Poll for popup close (mock or real flow) → refresh connections
  useEffect(() => {
    if (!popupWindow) return;
    const timer = setInterval(() => {
      if (popupWindow.closed) {
        clearInterval(timer);
        setPopupWindow(null);
        fetchConnections();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [popupWindow, fetchConnections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return APPLICATIONS_CATALOG;
    return APPLICATIONS_CATALOG.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.slug.includes(q),
    );
  }, [query]);

  const popular = useMemo(
    () => filtered.filter((a) => POPULAR_SLUGS.includes(a.slug)),
    [filtered],
  );
  const others = useMemo(
    () => filtered.filter((a) => !POPULAR_SLUGS.includes(a.slug)),
    [filtered],
  );

  const handleConnect = async (app: AppDefinition) => {
    try {
      const result = await connect(app.slug);
      const w = window.open(
        result.redirectUrl,
        `composio-${app.slug}`,
        'width=520,height=680,resizable=yes,scrollbars=yes',
      );
      if (w) {
        setPopupWindow(w);
      } else {
        toast.error(t('toast.popupBlocked'));
      }
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleDisconnect = async (slug: string) => {
    await disconnect(slug);
  };

  const detailApp = detailSlug ? APPLICATIONS_CATALOG.find((a) => a.slug === detailSlug) : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>

        {/* Mock mode banner */}
        {status?.mockMode && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {t('banner.mockTitle')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t('banner.mockDesc')}</p>
            </div>
          </div>
        )}

        {status && !status.mockMode && !status.proxyReachable && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">{t('banner.proxyUnreachable')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('banner.proxyUnreachableDesc')}
              </p>
              {status.error && (
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{status.error}</p>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder', { count: APPLICATIONS_CATALOG.length })}
            className="pl-9"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {APPLICATIONS_CATALOG.length} apps
          </div>
        </div>

        {/* Popular */}
        {popular.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('sections.popular')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {popular.map((app) => (
                <AppCard
                  key={app.slug}
                  app={app}
                  connection={connections[app.slug]}
                  onConnect={() => handleConnect(app)}
                  onManage={() => setDetailSlug(app.slug)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Others */}
        {others.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Plug className="h-4 w-4 text-muted-foreground" />
              {t('sections.all')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {others.map((app) => (
                <AppCard
                  key={app.slug}
                  app={app}
                  connection={connections[app.slug]}
                  onConnect={() => handleConnect(app)}
                  onManage={() => setDetailSlug(app.slug)}
                />
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {t('search.empty')}
          </div>
        )}
      </div>

      {detailApp && (
        <AppDetailDialog
          open={!!detailSlug}
          onClose={() => setDetailSlug(null)}
          app={detailApp}
          connection={connections[detailApp.slug]}
          onReconnect={async () => {
            await handleConnect(detailApp);
          }}
          onDisconnect={async () => {
            await handleDisconnect(detailApp.slug);
            setDetailSlug(null);
          }}
        />
      )}
    </div>
  );
}
