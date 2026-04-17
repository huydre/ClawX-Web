import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAppBySlug } from '@/lib/applications-catalog';
import { Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Mock consent screen shown when the proxy is not configured.
 * Mimics the Composio magic-link hosted page so UX matches the real flow.
 */
export function MockOAuthPage() {
  const { t } = useTranslation('applications');
  const search = new URLSearchParams(useLocation().search);
  const slug = search.get('app') || '';
  const app = getAppBySlug(slug);
  const [phase, setPhase] = useState<'consent' | 'finalizing' | 'done'>('consent');

  useEffect(() => {
    if (phase !== 'finalizing') return;
    let cancelled = false;
    (async () => {
      try {
        await api.finalizeApplication(slug);
      } catch {
        // ignore — main window will refresh on close
      }
      if (cancelled) return;
      setPhase('done');
      setTimeout(() => window.close(), 800);
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, slug]);

  if (!app) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-white to-purple-50 p-6">
        <p className="text-sm text-muted-foreground">Unknown app: {slug}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-white to-purple-50 dark:from-purple-950/30 dark:via-background dark:to-purple-900/20 p-6">
      <div className="w-full max-w-md rounded-2xl bg-card border shadow-xl p-8 text-center relative">
        <div className="absolute top-3 right-4 text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium">
          MOCK MODE
        </div>

        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <div className="text-muted-foreground">—</div>
          <div className="w-14 h-14 rounded-xl bg-muted/40 flex items-center justify-center overflow-hidden">
            <img src={app.logoUrl} alt={app.name} className="w-10 h-10 object-contain" />
          </div>
        </div>

        {phase === 'consent' && (
          <>
            <h1 className="text-xl font-bold mb-2">
              {t('mock.title', { app: app.name })}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t('mock.subtitle')}
            </p>

            <div className="text-left rounded-lg border bg-muted/30 p-4 mb-6">
              <p className="text-xs font-semibold mb-2">{t('mock.grantAccess')}</p>
              <ul className="space-y-1">
                {app.scopes.slice(0, 5).map((s) => (
                  <li key={s} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    <code className="font-mono">{s}</code>
                  </li>
                ))}
                {app.scopes.length > 5 && (
                  <li className="text-xs text-muted-foreground pl-5">
                    +{app.scopes.length - 5} more…
                  </li>
                )}
              </ul>
            </div>

            <button
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
              onClick={() => setPhase('finalizing')}
            >
              {t('mock.approve')}
            </button>
            <button
              className="w-full h-10 mt-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition"
              onClick={() => window.close()}
            >
              {t('mock.cancel')}
            </button>
          </>
        )}

        {phase === 'finalizing' && (
          <div className="py-6">
            <Loader2 className="h-8 w-8 mx-auto mb-3 text-primary animate-spin" />
            <p className="text-sm">{t('mock.connecting', { app: app.name })}</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="py-6">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
            <p className="text-sm font-medium">{t('mock.done')}</p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-6">
          {t('mock.securedBy')} <span className="font-semibold">ClawX (mock)</span>
        </p>
      </div>
    </div>
  );
}
