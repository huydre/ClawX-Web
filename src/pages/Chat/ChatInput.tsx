/**
 * Chat Input Component
 * Textarea with send button and universal file upload support.
 * Enter to send, Shift+Enter for new line.
 * Supports: native file picker, clipboard paste, drag & drop.
 * Files are staged to disk via IPC — only lightweight path references
 * are sent with the message (no base64 over WebSocket).
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Square, X, Paperclip, FileText, Film, Music,
  FileArchive, File, Loader2, Upload, ImageIcon, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { platform } from '@/lib/platform';
import { api } from '@/lib/api';
import { generateId } from '@/lib/uuid';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// ── Types ────────────────────────────────────────────────────────

export interface FileAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  stagedPath: string;        // disk path for gateway
  preview: string | null;    // data URL for images, null for others
  status: 'staging' | 'ready' | 'error';
  error?: string;
}

interface ChatInputProps {
  onSend: (text: string, attachments?: FileAttachment[]) => void;
  onStop?: () => void;
  disabled?: boolean;
  sending?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('image/')) return <ImageIcon className={className} />;
  if (mimeType.startsWith('video/')) return <Film className={className} />;
  if (mimeType.startsWith('audio/')) return <Music className={className} />;
  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') return <FileText className={className} />;
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('7z')) return <FileArchive className={className} />;
  if (mimeType === 'application/pdf') return <FileText className={className} />;
  return <File className={className} />;
}

function readFileAsBase64(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!dataUrl || !dataUrl.includes(',')) {
        reject(new Error(`Invalid data URL from FileReader for ${file.name}`));
        return;
      }
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject(new Error(`Empty base64 data for ${file.name}`));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ── Component ────────────────────────────────────────────────────

export function ChatInput({ onSend, onStop, disabled = false, sending = false }: ChatInputProps) {
  const { t } = useTranslation('chat');
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Auto-focus on mount
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  // ── File staging via native dialog ─────────────────────────────

  const pickFiles = useCallback(async () => {
    if (!platform.isElectron) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const result = await window.electron.ipcRenderer.invoke('dialog:open', {
        properties: ['openFile', 'multiSelections'],
      }) as { canceled: boolean; filePaths?: string[] };
      if (result.canceled || !result.filePaths?.length) return;

      const tempIds: string[] = [];
      for (const filePath of result.filePaths) {
        const tempId = generateId();
        tempIds.push(tempId);
        const fileName = filePath.split(/[\\/]/).pop() || 'file';
        setAttachments(prev => [...prev, {
          id: tempId, fileName, mimeType: '', fileSize: 0,
          stagedPath: '', preview: null, status: 'staging' as const,
        }]);
      }

      const staged = await window.electron.ipcRenderer.invoke(
        'file:stage', result.filePaths,
      ) as Array<{
        id: string; fileName: string; mimeType: string; fileSize: number;
        stagedPath: string; preview: string | null;
      }>;

      setAttachments(prev => {
        let updated = [...prev];
        for (let i = 0; i < tempIds.length; i++) {
          const tempId = tempIds[i];
          const data = staged[i];
          updated = updated.map(a =>
            a.id === tempId
              ? data ? { ...data, status: 'ready' as const } : { ...a, status: 'error' as const, error: 'Staging failed' }
              : a,
          );
        }
        return updated;
      });
    } catch (err) {
      console.error('[pickFiles] Failed:', err);
      setAttachments(prev => prev.map(a =>
        a.status === 'staging' ? { ...a, status: 'error' as const, error: String(err) } : a,
      ));
    }
  }, []);

  // ── Stage browser File objects (paste / drag-drop) ─────────────

  const stageBufferFiles = useCallback(async (files: globalThis.File[]) => {
    for (const file of files) {
      const tempId = generateId();
      setAttachments(prev => [...prev, {
        id: tempId, fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size, stagedPath: '', preview: null,
        status: 'staging' as const,
      }]);

      try {
        let staged: { id: string; fileName: string; mimeType: string; fileSize: number; stagedPath: string; preview: string | null };
        if (platform.isElectron) {
          const base64 = await readFileAsBase64(file);
          staged = await window.electron.ipcRenderer.invoke('file:stageBuffer', {
            base64, fileName: file.name, mimeType: file.type || 'application/octet-stream',
          }) as typeof staged;
        } else {
          staged = await api.stageFile(file);
        }
        setAttachments(prev => prev.map(a =>
          a.id === tempId ? { ...staged, status: 'ready' as const } : a,
        ));
      } catch (err) {
        console.error(`[stageBuffer] Error staging ${file.name}:`, err);
        setAttachments(prev => prev.map(a =>
          a.id === tempId ? { ...a, status: 'error' as const, error: String(err) } : a,
        ));
      }
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) stageBufferFiles(Array.from(files));
    e.target.value = '';
  }, [stageBufferFiles]);

  // ── Attachment management ──────────────────────────────────────

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const allReady = attachments.length === 0 || attachments.every(a => a.status === 'ready');
  const canSend = (input.trim() || attachments.length > 0) && allReady && !disabled && !sending;
  const canStop = sending && !disabled && !!onStop;
  const charCount = input.length;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const readyAttachments = attachments.filter(a => a.status === 'ready');
    const textToSend = input.trim();
    const attachmentsToSend = readyAttachments.length > 0 ? readyAttachments : undefined;
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(textToSend, attachmentsToSend);
  }, [input, attachments, canSend, onSend]);

  const handleStop = useCallback(() => {
    if (!canStop) return;
    onStop?.();
  }, [canStop, onStop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const nativeEvent = e.nativeEvent as KeyboardEvent;
        if (isComposingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229) return;
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: globalThis.File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        stageBufferFiles(pastedFiles);
      }
    },
    [stageBufferFiles],
  );

  // ── Drag & drop ───────────────────────────────────────────────

  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer?.types?.includes('Files')) setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      dragCounterRef.current = 0;
      if (e.dataTransfer?.files?.length) {
        stageBufferFiles(Array.from(e.dataTransfer.files));
      }
    },
    [stageBufferFiles],
  );

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div
      className="relative bg-background px-4 pb-4 pt-2"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input for web mode */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        aria-hidden="true"
      />

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
          <Upload className="h-8 w-8 text-primary mb-2 animate-bounce" />
          <p className="text-sm font-medium text-primary">
            {t('dropFiles', 'Drop files here')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('dropFilesHint', 'Images, documents, code files...')}
          </p>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Attachment Previews — animated list */}
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap animate-in slide-in-from-bottom-2 duration-200">
            {attachments.map((att) => (
              <AttachmentPreview
                key={att.id}
                attachment={att}
                onRemove={() => removeAttachment(att.id)}
              />
            ))}
          </div>
        )}

        {/* Input container */}
        <div
          className={cn(
            'flex items-end gap-1.5 rounded-2xl border bg-muted/30 px-2 py-1.5',
            'transition-all duration-300 ease-out',
            focused && 'border-primary/50 bg-background shadow-sm shadow-primary/5',
            disabled && 'opacity-50',
            dragOver && 'border-primary',
          )}
        >
          {/* Attach Button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'shrink-0 h-9 w-9 rounded-xl text-muted-foreground',
              'transition-all duration-200',
              'hover:text-foreground hover:bg-accent',
            )}
            onClick={pickFiles}
            disabled={disabled || sending}
            aria-label={t('attachFiles', 'Attach files')}
          >
            <Paperclip className={cn(
              'h-4 w-4 transition-transform duration-200',
              attachments.length > 0 && 'text-foreground rotate-45',
            )} />
          </Button>

          {/* Textarea */}
          <div className="flex-1 relative min-w-0">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { isComposingRef.current = true; }}
              onCompositionEnd={() => { isComposingRef.current = false; }}
              onPaste={handlePaste}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={disabled ? t('gatewayDisconnected', 'Gateway not connected...') : t('messagePlaceholder', 'Message...')}
              disabled={disabled}
              className={cn(
                'min-h-[36px] max-h-[200px] resize-none border-0 bg-transparent px-1 py-2',
                'focus-visible:ring-0 focus-visible:ring-offset-0',
                'placeholder:text-muted-foreground/60',
                'text-sm leading-relaxed',
              )}
              rows={1}
            />
          </div>

          {/* Character count — only show when typing */}
          {charCount > 0 && (
            <span className={cn(
              'self-end pb-2.5 pr-1 text-[10px] tabular-nums select-none shrink-0',
              'transition-all duration-300',
              charCount > 4000 ? 'text-destructive font-medium' : 'text-muted-foreground/50',
              'animate-in fade-in-0 duration-300',
            )}>
              {charCount.toLocaleString()}
            </span>
          )}

          {/* Send / Stop Button */}
          <Button
            onClick={sending ? handleStop : handleSend}
            disabled={sending ? !canStop : !canSend}
            size="icon"
            className={cn(
              'shrink-0 h-9 w-9 rounded-xl',
              'transition-all duration-300 ease-out',
              sending
                ? 'bg-destructive hover:bg-destructive/90'
                : canSend
                  ? 'bg-primary hover:bg-primary/90 scale-100'
                  : 'bg-muted text-muted-foreground scale-95 opacity-50',
              canSend && !sending && 'animate-in zoom-in-90 duration-200',
            )}
            variant={sending ? 'destructive' : 'default'}
            aria-label={sending ? t('stop', 'Stop') : t('send', 'Send')}
          >
            {sending ? (
              <Square className="h-3.5 w-3.5 animate-in zoom-in-50 duration-150" />
            ) : (
              <Send className={cn(
                'h-3.5 w-3.5 transition-transform duration-200',
                canSend && '-rotate-45',
              )} />
            )}
          </Button>
        </div>

        {/* Bottom hint */}
        <div className="flex items-center justify-between mt-1.5 px-2">
          <p className="text-[10px] text-muted-foreground/40 select-none">
            Enter ↵ {t('toSend', 'send')} · Shift+Enter {t('newLine', 'new line')}
          </p>
          {attachments.length > 0 && (
            <p className="text-[10px] text-muted-foreground/40 select-none animate-in fade-in-0 duration-300">
              {attachments.length} {t('filesAttached', 'file(s)')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Attachment Preview ───────────────────────────────────────────

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: FileAttachment;
  onRemove: () => void;
}) {
  const isImage = attachment.mimeType.startsWith('image/') && attachment.preview;

  return (
    <div className={cn(
      'relative group',
      'animate-in zoom-in-90 slide-in-from-bottom-1 duration-250',
    )}>
      {/* Content — clipped */}
      <div className={cn(
        'rounded-xl overflow-hidden border transition-all duration-200',
        attachment.status === 'error'
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-border hover:border-foreground/20',
      )}>
        {isImage ? (
          <img
            src={attachment.preview!}
            alt={attachment.fileName}
            className="w-14 h-14 object-cover block"
          />
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 max-w-[180px]">
            <div className={cn(
              'shrink-0 rounded-lg p-1.5',
              attachment.status === 'error' ? 'bg-destructive/10' : 'bg-accent',
            )}>
              {attachment.status === 'error' ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : (
                <FileIcon mimeType={attachment.mimeType} className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 overflow-hidden">
              <p className="text-xs font-medium truncate">{attachment.fileName}</p>
              <p className="text-[10px] text-muted-foreground">
                {attachment.status === 'error'
                  ? 'Failed'
                  : attachment.fileSize > 0
                    ? formatFileSize(attachment.fileSize)
                    : '...'}
              </p>
            </div>
          </div>
        )}

        {/* Staging overlay */}
        {attachment.status === 'staging' && (
          <div className="absolute inset-0 rounded-xl bg-background/60 backdrop-blur-[1px] flex items-center justify-center animate-in fade-in-0 duration-150">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          </div>
        )}
      </div>

      {/* Remove button — outside overflow-hidden */}
      <button
        onClick={onRemove}
        className={cn(
          'absolute -top-1.5 -right-1.5 z-10 rounded-full p-0.5',
          'bg-destructive text-white shadow-sm',
          'opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100',
          'transition-all duration-200',
          'hover:brightness-110 hover:scale-110',
        )}
        aria-label="Remove file"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
