/**
 * Browser Controls Panel
 * Shows lock status, Take/Release control, current URL/title.
 */
import { Bot, User, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBrowserStore } from '@/stores/browser';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function BrowserControls() {
  const { t } = useTranslation('browser');
  const { state, takeControl } = useBrowserStore();

  const ownerLabel =
    state.lockOwner === 'agent' ? t('lock.agent')
    : state.lockOwner === 'human' ? t('lock.human')
    : t('lock.none');

  const ownerIcon =
    state.lockOwner === 'agent' ? <Bot className="h-4 w-4" />
    : state.lockOwner === 'human' ? <User className="h-4 w-4" />
    : <Pause className="h-4 w-4" />;

  const ownerColor =
    state.lockOwner === 'agent' ? 'text-blue-500'
    : state.lockOwner === 'human' ? 'text-green-500'
    : 'text-muted-foreground';

  return (
    <div className="w-56 shrink-0 border rounded-lg p-3 flex flex-col gap-3 bg-card">
      {/* Lock status */}
      <div>
        <div className="text-xs text-muted-foreground mb-1">{t('lock.current')}</div>
        <div className={cn('flex items-center gap-2 font-medium text-sm', ownerColor)}>
          {ownerIcon} {ownerLabel}
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex flex-col gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => takeControl('human')}
          disabled={state.status !== 'running' || state.lockOwner === 'human'}
          className="w-full"
        >
          <User className="h-3.5 w-3.5 mr-1.5" />
          {t('take_control')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => takeControl('agent')}
          disabled={state.status !== 'running' || state.lockOwner === 'agent'}
          className="w-full"
        >
          <Bot className="h-3.5 w-3.5 mr-1.5" />
          {t('release')}
        </Button>
      </div>

      {/* Page info */}
      <div className="border-t pt-2 space-y-1 text-xs">
        <div>
          <span className="text-muted-foreground">{t('info.url')}: </span>
          <span className="break-all">{state.currentUrl || '--'}</span>
        </div>
        <div className="truncate">
          <span className="text-muted-foreground">{t('info.title')}: </span>
          <span>{state.title || '--'}</span>
        </div>
      </div>

      {/* Error */}
      {state.error && (
        <div className="text-xs text-destructive border-t pt-2 break-words">
          {state.error}
        </div>
      )}
    </div>
  );
}
