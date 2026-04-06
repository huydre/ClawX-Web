/**
 * File Preview Modal
 * Image (zoom), Video (HTML5 player), Audio (player), Text fallback.
 * Arrow key navigation between files.
 */
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ModalDialog } from '@/components/common/ModalDialog';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';
import type { FileEntry } from '@/stores/file-manager';
import { useTranslation } from 'react-i18next';

/** Format bytes to human-readable string */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

interface Props {
  file: FileEntry | null;
  rootId: string;
  files: FileEntry[];
  onClose: () => void;
  onNavigate: (file: FileEntry) => void;
}

/** Text preview for non-media files (<100KB) */
function TextPreview({ rootId, file }: { rootId: string; file: FileEntry }) {
  const { t } = useTranslation('files');
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (file.size > 100_000) {
      setContent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(api.getFmServeUrl(rootId, file.path))
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => setContent(text))
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [rootId, file.path, file.size]);

  if (loading) return <Skeleton variant="rectangular" height={200} />;
  if (!content) {
    return <p className="text-sm text-muted-foreground">{t('preview.notAvailable')}</p>;
  }

  return (
    <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap break-all">
      {content}
    </pre>
  );
}

export function FilePreviewModal({ file, rootId, files, onClose, onNavigate }: Props) {
  const { t } = useTranslation('files');
  const [zoom, setZoom] = useState(1);

  const serveUrl = file ? api.getFmServeUrl(rootId, file.path) : '';

  // Find prev/next for navigation
  const currentIndex = file ? files.findIndex((f) => f.path === file.path) : -1;
  const prevFile = currentIndex > 0 ? files[currentIndex - 1] : null;
  const nextFile = currentIndex < files.length - 1 ? files[currentIndex + 1] : null;

  // Keyboard navigation
  useEffect(() => {
    if (!file) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && prevFile) onNavigate(prevFile);
      if (e.key === 'ArrowRight' && nextFile) onNavigate(nextFile);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [file, prevFile, nextFile, onNavigate]);

  // Reset zoom on file change
  useEffect(() => {
    setZoom(1);
  }, [file?.path]);

  const renderContent = () => {
    if (!file) return null;

    switch (file.category) {
      case 'image':
        return (
          <div className="flex items-center justify-center overflow-auto max-h-[70vh] bg-muted/30 rounded">
            <img
              src={serveUrl}
              alt={file.name}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
              className="max-w-full max-h-[70vh] object-contain transition-transform cursor-zoom-in"
              onClick={() => setZoom((z) => (z < 3 ? z + 0.5 : 1))}
            />
          </div>
        );

      case 'video':
        return (
          <video
            key={file.path}
            src={serveUrl}
            controls
            autoPlay={false}
            className="w-full max-h-[70vh] rounded bg-black"
            preload="metadata"
          >
            Your browser does not support video playback.
          </video>
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-3xl text-muted-foreground">
              &#9835;
            </div>
            <p className="text-sm font-medium">{file.name}</p>
            <audio key={file.path} src={serveUrl} controls autoPlay={false} className="w-full max-w-md">
              Your browser does not support audio playback.
            </audio>
          </div>
        );

      default:
        return <TextPreview rootId={rootId} file={file} />;
    }
  };

  return (
    <ModalDialog
      open={!!file}
      onClose={onClose}
      title={file?.name ?? ''}
      maxWidth="xl"
    >
      {file && (
        <div className="space-y-3">
          {/* File info */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="secondary">{t(`categories.${file.category}`)}</Badge>
            <span>{formatSize(file.size)}</span>
            {file.mimeType && <span className="hidden sm:inline">{file.mimeType}</span>}
          </div>

          {/* Content */}
          {renderContent()}

          {/* Navigation + Zoom */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => prevFile && onNavigate(prevFile)}
              disabled={!prevFile}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('preview.prev')}
            </Button>

            {file.category === 'image' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => nextFile && onNavigate(nextFile)}
              disabled={!nextFile}
            >
              {t('preview.next')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Position indicator */}
          {files.length > 1 && (
            <p className="text-xs text-center text-muted-foreground">
              {currentIndex + 1} / {files.length}
            </p>
          )}
        </div>
      )}
    </ModalDialog>
  );
}
