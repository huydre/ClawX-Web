/**
 * USB Page
 * Browse files on connected USB devices and copy to agent workspaces.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Usb,
  Folder,
  File,
  FileText,
  FileCode,
  Database,
  Film,
  ChevronRight,
  Unplug,
  Copy,
  Check,
  HardDrive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select } from '@/components/ui/select';
import { AsyncButton } from '@/components/common/AsyncButton';
import { EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/SearchInput';
import { Skeleton } from '@/components/common/Skeleton';
import { ModalDialog } from '@/components/common/ModalDialog';
import { useUsbStore } from '@/stores/usb';
import type { UsbFile } from '@/stores/usb';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ws } from '@/lib/websocket';

/** Format bytes to human-readable string */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Format timestamp or ISO string to locale date string */
function formatDate(ts: string | number): string {
  if (!ts) return '--';
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Icon for file category */
function FileTypeIcon({ type }: { type: UsbFile['category'] }) {
  const cls = 'h-5 w-5 shrink-0';
  switch (type) {
    case 'documents':
      return <FileText className={cn(cls, 'text-blue-500')} />;
    case 'code':
      return <FileCode className={cn(cls, 'text-green-500')} />;
    case 'data':
      return <Database className={cn(cls, 'text-amber-500')} />;
    case 'media':
      return <Film className={cn(cls, 'text-purple-500')} />;
    default:
      return <File className={cn(cls, 'text-muted-foreground')} />;
  }
}

/** Badge variant for file category */
function typeBadgeVariant(type: UsbFile['category']): 'default' | 'secondary' | 'outline' | 'destructive' {
  return type === 'other' ? 'outline' : 'secondary';
}

export function USB() {
  const { t } = useTranslation('usb');
  const {
    devices,
    selectedDevice,
    files,
    currentPath,
    loading,
    scanning,
    error,
    fetchDevices,
    selectDevice,
    navigateTo,
    copyToWorkspace,
    ejectDevice,
    handleWsEvent,
  } = useUsbStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [targetWorkspace, setTargetWorkspace] = useState('');
  const [copying, setCopying] = useState(false);
  const [ejecting, setEjecting] = useState(false);
  const [previewFile, setPreviewFile] = useState<UsbFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Subscribe to USB WebSocket events
  useEffect(() => {
    const handler = (data: any) => {
      handleWsEvent(data);
    };
    ws.on('usb.connected', handler);
    ws.on('usb.disconnected', handler);
    ws.on('usb.scan.complete', handler);
    return () => {
      ws.off('usb.connected', handler);
      ws.off('usb.disconnected', handler);
      ws.off('usb.scan.complete', handler);
    };
  }, [handleWsEvent]);

  // Current device info
  const currentDevice = useMemo(
    () => devices.find((d) => d.deviceId === selectedDevice),
    [devices, selectedDevice]
  );

  // Breadcrumb segments
  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ label: t('breadcrumb.root'), path: '/' }];
    let accumulated = '';
    for (const part of parts) {
      accumulated += `/${part}`;
      crumbs.push({ label: part, path: accumulated });
    }
    return crumbs;
  }, [currentPath, t]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  // Toggle file selection
  const toggleFileSelection = useCallback((filePath: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  // Handle file click
  const handleFileClick = useCallback(
    (file: UsbFile) => {
      if (file.isDirectory) {
        navigateTo(file.path);
        setSearchQuery('');
        setSelectedFiles(new Set());
      } else {
        setPreviewFile(file);
        setPreviewContent(null);
        // Load preview for small text files
        if (
          selectedDevice &&
          file.size < 100_000 &&
          ['documents', 'code', 'data'].includes(file.category)
        ) {
          setPreviewLoading(true);
          import('@/lib/api').then(({ api }) =>
            api
              .readUsbFile(selectedDevice, file.path)
              .then((res) => setPreviewContent(res.content))
              .catch(() => setPreviewContent(null))
              .finally(() => setPreviewLoading(false))
          );
        }
      }
    },
    [navigateTo, selectedDevice]
  );

  // Copy action
  const handleCopy = useCallback(async () => {
    if (selectedFiles.size === 0 || !targetWorkspace) return;
    setCopying(true);
    try {
      await copyToWorkspace(Array.from(selectedFiles), targetWorkspace);
      toast.success(t('copySuccess'));
      setSelectedFiles(new Set());
      setCopyDialogOpen(false);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCopying(false);
    }
  }, [selectedFiles, targetWorkspace, copyToWorkspace, t]);

  // Eject action
  const handleEject = useCallback(async () => {
    if (!selectedDevice) return;
    setEjecting(true);
    try {
      await ejectDevice(selectedDevice);
      toast.success(t('ejectSuccess'));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setEjecting(false);
    }
  }, [selectedDevice, ejectDevice, t]);

  // No devices state
  if (!loading && devices.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState
          icon={<Usb className="h-12 w-12" />}
          title={t('noDevices')}
          description={t('noDevicesDesc')}
          size="lg"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Usb className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          {scanning && (
            <Badge variant="secondary">{t('scanning')}</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Device selector */}
          {devices.length > 1 && (
            <Select
              value={selectedDevice ?? ''}
              onChange={(e) => selectDevice(e.target.value)}
              className="w-48"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || d.deviceId}
                </option>
              ))}
            </Select>
          )}

          {/* Eject */}
          <AsyncButton
            variant="outline"
            size="sm"
            icon={<Unplug className="h-4 w-4" />}
            loading={ejecting}
            onClick={handleEject}
            disabled={!selectedDevice}
          >
            {t('eject')}
          </AsyncButton>
        </div>
      </div>

      {/* Device info bar */}
      {currentDevice && (
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-4 flex-wrap">
            <HardDrive className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm">{currentDevice.label}</span>
            <div className="flex items-center gap-2 min-w-[200px] flex-1 max-w-xs">
              <Progress
                value={
                  currentDevice.totalSize > 0
                    ? (currentDevice.usedSize / currentDevice.totalSize) * 100
                    : 0
                }
                className="h-2"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatSize(currentDevice.usedSize)} / {formatSize(currentDevice.totalSize)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {currentDevice.fileCount} {t('files')}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Toolbar: breadcrumbs + search + copy button */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm overflow-x-auto flex-1 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1 shrink-0">
              {i > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              <button
                onClick={() => navigateTo(crumb.path)}
                className={cn(
                  'hover:text-primary transition-colors px-1 py-0.5 rounded',
                  i === breadcrumbs.length - 1
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('searchPlaceholder', 'Search files...')}
          size="sm"
          className="w-48"
        />

        {selectedFiles.size > 0 && (
          <Button
            size="sm"
            onClick={() => setCopyDialogOpen(true)}
          >
            <Copy className="h-4 w-4 mr-2" />
            {t('copyToWorkspace')} ({selectedFiles.size})
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto rounded-lg border bg-card">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton variant="rectangular" width={20} height={20} />
                <Skeleton variant="text" className="flex-1" height={16} />
                <Skeleton variant="text" width={60} height={16} />
                <Skeleton variant="text" width={80} height={16} />
              </div>
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          <EmptyState
            icon={<Folder className="h-10 w-10" />}
            title={searchQuery ? t('noResults', 'No matching files') : t('emptyFolder', 'Empty folder')}
            size="sm"
            className="py-12"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="p-3 w-8" />
                <th className="p-3 w-8" />
                <th className="p-3 font-medium">{t('fileName', 'Name')}</th>
                <th className="p-3 font-medium w-20">{t('fileType', 'Type')}</th>
                <th className="p-3 font-medium w-24 text-right">{t('fileSize', 'Size')}</th>
                <th className="p-3 font-medium w-40">{t('fileModified', 'Modified')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file, idx) => {
                const isSelected = selectedFiles.has(file.path);
                return (
                  <tr
                    key={file.path}
                    className={cn(
                      'border-b last:border-0 transition-colors cursor-pointer',
                      'hover:bg-accent/50',
                      'animate-in fade-in-0 slide-in-from-left-1',
                      isSelected && 'bg-primary/5'
                    )}
                    style={{ animationDelay: `${Math.min(idx * 20, 200)}ms` }}
                  >
                    <td className="p-3">
                      {!file.isDirectory && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFileSelection(file.path);
                          }}
                          className={cn(
                            'h-4 w-4 rounded border flex items-center justify-center transition-colors',
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/40 hover:border-primary'
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </button>
                      )}
                    </td>
                    <td
                      className="p-3"
                      onClick={() => handleFileClick(file)}
                    >
                      {file.isDirectory ? (
                        <Folder className="h-5 w-5 text-amber-500" />
                      ) : (
                        <FileTypeIcon type={file.category} />
                      )}
                    </td>
                    <td
                      className="p-3 font-medium truncate max-w-[300px]"
                      onClick={() => handleFileClick(file)}
                    >
                      {file.name}
                    </td>
                    <td className="p-3" onClick={() => handleFileClick(file)}>
                      {!file.isDirectory && (
                        <Badge variant={typeBadgeVariant(file.category)} className="text-[10px] font-normal">
                          {t(`fileTypes.${file.category}`)}
                        </Badge>
                      )}
                      {file.isDirectory && (
                        <span className="text-xs text-muted-foreground">{t('folder', 'Folder')}</span>
                      )}
                    </td>
                    <td
                      className="p-3 text-right text-muted-foreground"
                      onClick={() => handleFileClick(file)}
                    >
                      {file.isDirectory ? '--' : formatSize(file.size)}
                    </td>
                    <td
                      className="p-3 text-muted-foreground"
                      onClick={() => handleFileClick(file)}
                    >
                      {formatDate(file.modified)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Copy to Workspace Dialog */}
      <ModalDialog
        open={copyDialogOpen}
        onClose={() => setCopyDialogOpen(false)}
        title={t('copyToWorkspace')}
        description={t('selectWorkspaceDesc', `Copy ${selectedFiles.size} file(s) to an agent workspace.`)}
        maxWidth="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              {t('cancel', 'Cancel')}
            </Button>
            <AsyncButton
              loading={copying}
              onClick={handleCopy}
              disabled={!targetWorkspace}
              icon={<Copy className="h-4 w-4" />}
            >
              {t('copyToWorkspace')}
            </AsyncButton>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('selectFiles')}: {selectedFiles.size}
          </p>
          <label className="text-sm font-medium">{t('targetWorkspace', 'Target workspace')}</label>
          <input
            type="text"
            value={targetWorkspace}
            onChange={(e) => setTargetWorkspace(e.target.value)}
            placeholder={t('workspacePlaceholder', 'e.g. main-agent')}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background',
              'px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          />
        </div>
      </ModalDialog>

      {/* File Preview Dialog */}
      <ModalDialog
        open={!!previewFile}
        onClose={() => {
          setPreviewFile(null);
          setPreviewContent(null);
        }}
        title={previewFile?.name ?? ''}
        maxWidth="lg"
      >
        {previewFile && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Badge variant="secondary">{previewFile.category}</Badge>
              <span>{formatSize(previewFile.size)}</span>
              <span>{formatDate(previewFile.modified)}</span>
            </div>
            {previewLoading ? (
              <div className="space-y-2">
                <Skeleton variant="text" height={14} />
                <Skeleton variant="text" height={14} />
                <Skeleton variant="text" height={14} width="60%" />
              </div>
            ) : previewContent ? (
              <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap break-all">
                {previewContent}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('noPreview', 'Preview not available for this file type.')}
              </p>
            )}
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
