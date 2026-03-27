/**
 * Channels Page
 * Manage messaging channel connections with configuration UI
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useChannelsStore } from '@/stores/channels';
import { useGatewayStore } from '@/stores/gateway';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ChannelIcon } from '@/components/ui/ChannelIcon';
import {
  CHANNEL_META,
  getPrimaryChannels,
  type ChannelType,
  type Channel,
} from '@/types/channel';
import { PairingApprovals } from '@/components/channels/PairingApprovals';
import { useTranslation } from 'react-i18next';
import { platform } from '@/lib/platform';
import { ChannelCard } from './ChannelCard';
import { ChannelSettingsPanel } from './ChannelSettingsPanel';
import { AddChannelDialog } from './AddChannelDialog';

export function Channels() {
  const { t } = useTranslation('channels');
  const { channels, loading, error, fetchChannels, deleteChannel } = useChannelsStore();
  const isGatewayRunning = useGatewayStore((state) => state.isRunning());

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType | null>(null);
  const [configuredTypes, setConfiguredTypes] = useState<string[]>([]);
  const [settingsChannel, setSettingsChannel] = useState<Channel | null>(null);

  // Fetch channels on mount
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Fetch configured channel types from config file (Electron only)
  const fetchConfiguredTypes = useCallback(async () => {
    if (!platform.isElectron) return;
    try {
      const result = await window.electron.ipcRenderer.invoke('channel:listConfigured') as {
        success: boolean;
        channels?: string[];
      };
      if (result.success && result.channels) {
        setConfiguredTypes(result.channels);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConfiguredTypes();
  }, [fetchConfiguredTypes]);

  useEffect(() => {
    if (!platform.isElectron) return;
    const unsubscribe = window.electron.ipcRenderer.on('gateway:channel-status', () => {
      fetchChannels();
      fetchConfiguredTypes();
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [fetchChannels, fetchConfiguredTypes]);

  // Get channel types to display
  const displayedChannelTypes = getPrimaryChannels();

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 pb-16 md:pb-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="icon" onClick={fetchChannels}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t('addChannel')}</span>
          </Button>
        </div>
      </div>

      {/* Gateway Warning */}
      {!isGatewayRunning && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {t('gatewayWarning')}
          </span>
        </div>
      )}

      {/* Pending Pairing Approvals */}
      <PairingApprovals />

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 dark:border-red-800 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* Connected Channels */}
      {channels.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t('configured')}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onDelete={() => {
                  if (confirm(t('deleteConfirm'))) {
                    deleteChannel(channel.id);
                  }
                }}
                onSettings={() => setSettingsChannel(channel)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available Channels */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('available')}</CardTitle>
              <CardDescription>
                {t('availableDesc')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
            {displayedChannelTypes.map((type) => {
              const meta = CHANNEL_META[type];
              const isConfigured = configuredTypes.includes(type);
              return (
                <button
                  key={type}
                  className={`p-3 md:p-4 rounded-lg border hover:bg-accent transition-colors text-left relative ${isConfigured ? 'border-green-500/50 bg-green-500/5' : ''}`}
                  onClick={() => {
                    setSelectedChannelType(type);
                    setShowAddDialog(true);
                  }}
                >
                  <ChannelIcon type={type} className="h-8 w-8" />
                  <p className="font-medium mt-2">{meta.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {meta.description}
                  </p>
                  {isConfigured && (
                    <Badge className="absolute top-2 right-2 text-xs bg-green-600 hover:bg-green-600">
                      {t('configuredBadge')}
                    </Badge>
                  )}
                  {!isConfigured && meta.isPlugin && (
                    <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                      {t('pluginBadge')}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Channel Dialog */}
      {showAddDialog && (
        <AddChannelDialog
          selectedType={selectedChannelType}
          onSelectType={setSelectedChannelType}
          onClose={() => {
            setShowAddDialog(false);
            setSelectedChannelType(null);
          }}
          onChannelAdded={() => {
            fetchChannels();
            fetchConfiguredTypes();
            setShowAddDialog(false);
            setSelectedChannelType(null);
          }}
        />
      )}

      {/* Channel Settings Panel */}
      {settingsChannel && (
        <ChannelSettingsPanel
          channel={settingsChannel}
          onClose={() => setSettingsChannel(null)}
        />
      )}
    </div>
  );
}

export default Channels;
