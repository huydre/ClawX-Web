import { useState } from 'react';
import { CheckCircle2, RefreshCw, Trash2, Plug, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/common/ModalDialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { AppDefinition } from '@/lib/applications-catalog';
import type { ApplicationConnection } from '@/stores/applications';

interface Props {
  open: boolean;
  onClose: () => void;
  app: AppDefinition;
  connection: ApplicationConnection | undefined;
  onReconnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function AppDetailDialog({ open, onClose, app, connection, onReconnect, onDisconnect }: Props) {
  const { t } = useTranslation('applications');
  const [disconnecting, setDisconnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const isConnected = connection?.status === 'ACTIVE' || connection?.status === 'MOCK';

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('toast.copied'));
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
      toast.success(t('toast.disconnected', { app: app.name }));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await onReconnect();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setReconnecting(false);
    }
  };

  return (
    <ModalDialog open={open} onClose={onClose} maxWidth="2xl" showCloseButton={false}>
      <div className="flex items-start gap-4 -mt-2">
        <div className="shrink-0 w-14 h-14 rounded-xl bg-muted/40 flex items-center justify-center overflow-hidden">
          <img src={app.logoUrl} alt={app.name} className="w-10 h-10 object-contain" onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}/>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">{app.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{app.description}</p>
          <div className="flex items-center gap-2 mt-2">
            {isConnected && (
              <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-500">
                <CheckCircle2 className="h-3 w-3" />
                {t('status.connected')}
              </Badge>
            )}
            <Badge variant="outline">{app.authType}</Badge>
            {connection?.connectedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(connection.connectedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* Permissions */}
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Plug className="h-4 w-4 text-primary" />
            {t('sections.permissions')}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {app.scopes.map((s) => (
              <code
                key={s}
                className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground font-mono"
              >
                {s}
              </code>
            ))}
          </div>
          {isConnected && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={handleReconnect}
              disabled={reconnecting}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${reconnecting ? 'animate-spin' : ''}`} />
              {t('actions.update')}
            </Button>
          )}
        </section>

        {/* Tools / How to use */}
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            🚀 {t('sections.howToUse')}
          </h3>
          <div className="rounded-lg border bg-primary/5 border-primary/20 px-3 py-2 mb-3">
            <p className="text-xs font-medium text-primary">{t('hints.copyPrompt')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('hints.aiAutoUse')}</p>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {app.tools.map((tool) => (
              <div key={tool.id} className="rounded-lg border p-3 bg-card/50">
                <code className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono">
                  {tool.id}
                </code>
                <p className="text-xs mt-2 leading-relaxed">
                  {t('hints.toolPreamble', { tool: tool.id })} {tool.summary}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-xs"
                  onClick={() =>
                    handleCopy(
                      t('hints.toolPreamble', { tool: tool.id }) + ' ' + tool.summary,
                    )
                  }
                >
                  <Copy className="h-3 w-3 mr-1.5" />
                  {t('actions.copyToChat')}
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {isConnected && (
        <div className="mt-6 pt-4 border-t flex justify-end">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {disconnecting ? t('actions.disconnecting') : t('actions.disconnect')}
          </Button>
        </div>
      )}
    </ModalDialog>
  );
}
