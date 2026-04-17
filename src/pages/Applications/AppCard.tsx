import { Plus, Settings as SettingsIcon, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppDefinition } from '@/lib/applications-catalog';
import type { ApplicationConnection } from '@/stores/applications';
import { useTranslation } from 'react-i18next';

interface AppCardProps {
  app: AppDefinition;
  connection: ApplicationConnection | undefined;
  onConnect: () => void;
  onManage: () => void;
}

export function AppCard({ app, connection, onConnect, onManage }: AppCardProps) {
  const { t } = useTranslation('applications');
  const isConnected = connection?.status === 'ACTIVE' || connection?.status === 'MOCK';
  const isPending = connection?.status === 'PENDING';

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-all',
        'hover:border-primary/40 hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-11 h-11 rounded-lg bg-muted/40 flex items-center justify-center overflow-hidden">
            <img
              src={app.logoUrl}
              alt={app.name}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{app.name}</h3>
            <p className="text-xs text-muted-foreground">{app.authType}</p>
          </div>
        </div>
        {isConnected && (
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-500">
            <CheckCircle2 className="h-3 w-3" />
            {t('status.connected')}
          </Badge>
        )}
        {isPending && (
          <Badge variant="outline" className="border-amber-500/40 text-amber-500">
            {t('status.pending')}
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground flex-1 line-clamp-3 mb-4">{app.description}</p>

      <div className="flex flex-wrap gap-1 mb-4">
        {app.scopes.slice(0, 3).map((s) => (
          <code
            key={s}
            className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono truncate max-w-[140px]"
            title={s}
          >
            {s}
          </code>
        ))}
        {app.scopes.length > 3 && (
          <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">
            +{app.scopes.length - 3}
          </code>
        )}
      </div>

      {isConnected ? (
        <Button variant="secondary" size="sm" className="w-full" onClick={onManage}>
          <SettingsIcon className="h-4 w-4 mr-2" />
          {t('actions.manage')}
        </Button>
      ) : (
        <Button size="sm" className="w-full" onClick={onConnect} disabled={isPending}>
          <Plus className="h-4 w-4 mr-2" />
          {isPending ? t('status.connecting') : t('actions.connect')}
        </Button>
      )}
    </div>
  );
}
