/**
 * Chat Toolbar
 * Session selector, new session, refresh, and thinking toggle.
 * Rendered in the Header when on the Chat page.
 */
import { RefreshCw, Brain, ChevronDown, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat';
import { useProviderStore } from '@/stores/providers';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

function ModelBadge() {
  const modelId = useProviderStore((s) => s.currentModel.modelId);
  const provider = useProviderStore((s) => s.currentModel.provider);
  const refreshCurrentModel = useProviderStore((s) => s.refreshCurrentModel);

  useEffect(() => {
    refreshCurrentModel();
  }, [refreshCurrentModel]);

  if (!modelId) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground cursor-default select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="max-w-[160px] truncate font-medium">{modelId}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Provider: {provider}</p>
        <p>Model: {modelId}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ChatToolbar() {
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const switchSession = useChatStore((s) => s.switchSession);
  const newSession = useChatStore((s) => s.newSession);
  const refresh = useChatStore((s) => s.refresh);
  const loading = useChatStore((s) => s.loading);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const { t } = useTranslation('chat');

  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    switchSession(e.target.value);
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Current Model Badge — hidden on mobile (shown in TitleBar instead) */}
      <div className="hidden sm:block">
        <ModelBadge />
      </div>

      {/* Session Selector */}
      <div className="relative">
        <select
          value={currentSessionKey}
          onChange={handleSessionChange}
          className={cn(
            'appearance-none rounded-md border border-border bg-background px-2 py-1.5 pr-7 sm:px-3 sm:pr-8',
            'text-xs sm:text-sm text-foreground cursor-pointer max-w-[120px] sm:max-w-none',
            'focus:outline-none focus:ring-2 focus:ring-ring',
          )}
        >
          {/* Render all sessions; if currentSessionKey is not in the list, add it */}
          {!sessions.some((s) => s.key === currentSessionKey) && (
            <option value={currentSessionKey}>
              {currentSessionKey}
            </option>
          )}
          {sessions.map((s) => (
            <option key={s.key} value={s.key}>
              {s.key}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      </div>

      {/* New Session */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={newSession}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('toolbar.newSession')}</p>
        </TooltipContent>
      </Tooltip>

      {/* Refresh */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('toolbar.refresh')}</p>
        </TooltipContent>
      </Tooltip>

      {/* Thinking Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              showThinking && 'bg-primary/10 text-primary',
            )}
            onClick={toggleThinking}
          >
            <Brain className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{showThinking ? t('toolbar.hideThinking') : t('toolbar.showThinking')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
