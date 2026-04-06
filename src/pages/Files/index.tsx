/**
 * Files Page
 * Browse server filesystem (whitelist folders) with media preview.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  FolderOpen,
  Folder,
  File,
  FileText,
  FileCode,
  Database,
  Image,
  Video,
  Music,
  ChevronRight,
  Home,
  Usb,
  Bot,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/SearchInput';
import { Skeleton } from '@/components/common/Skeleton';
import { useFileManagerStore } from '@/stores/file-manager';
import type { FileEntry, FileRoot } from '@/stores/file-manager';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { FilePreviewModal } from './FilePreviewModal';

/** Format bytes to human-readable string */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Format timestamp to locale date string */
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

/** Icon for root type */
function RootIcon({ icon }: { icon: string }) {
  const cls = 'h-4 w-4';
  switch (icon) {
    case 'Home': return <Home className={cls} />;
    case 'Usb': return <Usb className={cls} />;
    case 'Bot': return <Bot className={cls} />;
    default: return <FolderOpen className={cls} />;
  }
}

/** Icon for file category */
function FileTypeIcon({ type }: { type: string }) {
  const cls = 'h-5 w-5 shrink-0';
  switch (type) {
    case 'image': return <Image className={cn(cls, 'text-pink-500')} />;
    case 'video': return <Video className={cn(cls, 'text-purple-500')} />;
    case 'audio': return <Music className={cn(cls, 'text-orange-500')} />;
    case 'documents': return <FileText className={cn(cls, 'text-blue-500')} />;
    case 'code': return <FileCode className={cn(cls, 'text-green-500')} />;
    case 'data': return <Database className={cn(cls, 'text-amber-500')} />;
    default: return <File className={cn(cls, 'text-muted-foreground')} />;
  }
}

/** Image thumbnail with loading/error fallback */
function Thumbnail({ rootId, file }: { rootId: string; file: FileEntry }) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error || file.category !== 'image') {
    return <FileTypeIcon type={file.category} />;
  }

  return (
    <div className="relative w-10 h-10">
      {!loaded && (
        <Skeleton variant="rectangular" width={40} height={40} className="absolute inset-0 rounded" />
      )}
      <img
        src={api.getFmThumbUrl(rootId, file.path, 40, 40)}
        alt={file.name}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          'w-10 h-10 rounded object-cover transition-opacity',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}

export function Files() {
  const { t } = useTranslation('files');
  const {
    roots,
    selectedRoot,
    files,
    currentPath,
    loading,
    error,
    fetchRoots,
    selectRoot,
    navigateTo,
  } = useFileManagerStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);

  // Fetch roots on mount
  useEffect(() => {
    fetchRoots();
  }, [fetchRoots]);

  // Current root info
  const currentRoot = useMemo(
    () => roots.find((r) => r.id === selectedRoot),
    [roots, selectedRoot]
  );

  // Breadcrumb segments
  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ label: currentRoot?.label || t('breadcrumb.root'), path: '/' }];
    let accumulated = '';
    for (const part of parts) {
      accumulated += `/${part}`;
      crumbs.push({ label: part, path: accumulated });
    }
    return crumbs;
  }, [currentPath, currentRoot, t]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  // Handle file click
  const handleFileClick = useCallback(
    (file: FileEntry) => {
      if (file.isDirectory) {
        navigateTo(file.path);
        setSearchQuery('');
      } else {
        setPreviewFile(file);
      }
    },
    [navigateTo]
  );

  // No roots
  if (!loading && roots.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState
          icon={<FolderOpen className="h-12 w-12" />}
          title={t('noRoots')}
          description={t('noRootsDesc')}
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
          <FolderOpen className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">{t('title')}</h1>
        </div>

        {/* Root selector */}
        {roots.length > 0 && (
          <Select
            value={selectedRoot ?? ''}
            onChange={(e) => selectRoot(e.target.value)}
            className="w-56"
          >
            {roots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Breadcrumbs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <nav className="flex items-center gap-1 text-sm overflow-x-auto flex-1 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
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
          placeholder={t('searchPlaceholder')}
          size="sm"
          className="w-48"
        />
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
                <Skeleton variant="rectangular" width={40} height={40} />
                <Skeleton variant="text" className="flex-1" height={16} />
                <Skeleton variant="text" width={60} height={16} />
                <Skeleton variant="text" width={80} height={16} />
              </div>
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          <EmptyState
            icon={<Folder className="h-10 w-10" />}
            title={searchQuery ? t('noResults') : t('emptyFolder')}
            size="sm"
            className="py-12"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="p-3 w-14" />
                <th className="p-3 font-medium">{t('fileName')}</th>
                <th className="p-3 font-medium w-20">{t('fileType')}</th>
                <th className="p-3 font-medium w-24 text-right">{t('fileSize')}</th>
                <th className="p-3 font-medium w-40 hidden md:table-cell">{t('fileModified')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  className={cn(
                    'border-b last:border-0 transition-colors cursor-pointer',
                    'hover:bg-accent/50'
                  )}
                >
                  <td className="p-3">
                    {file.isDirectory ? (
                      <Folder className="h-10 w-10 text-amber-500 p-2" />
                    ) : selectedRoot ? (
                      <Thumbnail rootId={selectedRoot} file={file} />
                    ) : (
                      <FileTypeIcon type={file.category} />
                    )}
                  </td>
                  <td className="p-3 font-medium truncate max-w-[300px]">
                    {file.name}
                  </td>
                  <td className="p-3">
                    {file.isDirectory ? (
                      <span className="text-xs text-muted-foreground">{t('folder')}</span>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {t(`categories.${file.category}`)}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-right text-muted-foreground">
                    {file.isDirectory ? '--' : formatSize(file.size)}
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {formatDate(file.modified)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Preview Modal */}
      {selectedRoot && (
        <FilePreviewModal
          file={previewFile}
          rootId={selectedRoot}
          files={filteredFiles.filter((f) => !f.isDirectory)}
          onClose={() => setPreviewFile(null)}
          onNavigate={setPreviewFile}
        />
      )}
    </div>
  );
}
