import {
  Trash2,
  ExternalLink,
  Wifi,
  WifiOff,
  Settings,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChannelIcon } from '@/components/ui/ChannelIcon';
import {
  CHANNEL_NAMES,
  CHANNEL_META,
  type Channel,
} from '@/types/channel';
import { formatRelativeTime } from '@/lib/utils';

interface ChannelCardProps {
  channel: Channel;
  onDelete: () => void;
  onSettings: () => void;
}

export function ChannelCard({ channel, onDelete, onSettings }: ChannelCardProps) {
  const isOnline = channel.status === 'connected';
  const isError = channel.status === 'error';
  const statusColor = isOnline
    ? 'bg-emerald-500'
    : isError
      ? 'bg-red-500'
      : 'bg-zinc-400 dark:bg-zinc-600';
  const statusLabel = isOnline ? 'Online' : isError ? 'Error' : 'Offline';

  const lastActivity = channel.lastInboundAt || channel.lastOutboundAt;
  const botName = channel.botUsername || channel.probe?.bot?.username;

  return (
    <div className="group rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20">
      {/* Header: Icon + Name + Status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-md bg-muted p-2 shrink-0">
            <ChannelIcon type={channel.type} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{CHANNEL_NAMES[channel.type]}</p>
            {botName && (
              <p className="text-xs text-muted-foreground truncate">@{botName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-muted-foreground">{statusLabel}</span>
        </div>
      </div>

      {/* Error */}
      {channel.error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-3 line-clamp-2">{channel.error}</p>
      )}

      {/* Info Grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <p className="text-[11px] text-muted-foreground">Connection</p>
          <div className="flex items-center gap-1 mt-0.5">
            {isOnline ? (
              <Wifi className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <WifiOff className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="text-xs font-medium capitalize">
              {channel.mode || (isOnline ? 'Active' : 'Inactive')}
            </span>
          </div>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Last message</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium">
              {formatRelativeTime(lastActivity)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onSettings}
          >
            <Settings className="h-3.5 w-3.5 mr-1" />
            Settings
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Remove
          </Button>
        </div>
        <a
          href={CHANNEL_META[channel.type]?.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          Docs
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
