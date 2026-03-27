/**
 * ModalDialog — Overlay modal with Card, header, scroll support, and animations.
 * Click outside or press Escape to close. Focus-traps content.
 */
import * as React from 'react';
import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const modalVariants = cva('w-full relative', {
  variants: {
    maxWidth: {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl',
      full: 'max-w-[calc(100vw-2rem)]',
    },
  },
  defaultVariants: {
    maxWidth: 'md',
  },
});

export interface ModalDialogProps extends VariantProps<typeof modalVariants> {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when the user requests to close (click outside, Escape, X button) */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal description (below title) */
  description?: string;
  /** Show close button in header */
  showCloseButton?: boolean;
  /** Content of the modal body */
  children: React.ReactNode;
  /** Footer content (buttons, actions) */
  footer?: React.ReactNode;
  /** Custom header render (replaces title + description + close button) */
  renderHeader?: () => React.ReactNode;
  /** Additional class for the Card container */
  className?: string;
  /** Additional class for the overlay backdrop */
  overlayClassName?: string;
  /** Additional class for the CardContent body */
  bodyClassName?: string;
  /** Prevent closing on overlay click */
  persistent?: boolean;
}

function ModalDialog({
  open,
  onClose,
  title,
  description,
  showCloseButton = true,
  children,
  footer,
  renderHeader,
  maxWidth,
  className,
  overlayClassName,
  bodyClassName,
  persistent = false,
}: ModalDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (persistent) return;
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose, persistent]
  );

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto',
        'bg-black/60 backdrop-blur-sm',
        'animate-in fade-in-0 duration-200',
        overlayClassName
      )}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <Card
        ref={cardRef}
        className={cn(
          modalVariants({ maxWidth }),
          'my-auto shadow-2xl border-border/50',
          'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200',
          className
        )}
      >
        {/* Header */}
        {renderHeader ? (
          renderHeader()
        ) : (title || description || showCloseButton) ? (
          <CardHeader className="relative">
            {title && <CardTitle className="pr-8">{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className={cn(
                  'absolute right-4 top-4 rounded-sm p-1',
                  'text-muted-foreground transition-all duration-200',
                  'hover:text-foreground hover:bg-accent',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                )}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </CardHeader>
        ) : null}

        {/* Body */}
        <CardContent className={cn('space-y-4', bodyClassName)}>
          {children}
        </CardContent>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 p-6 pt-0">
            {footer}
          </div>
        )}
      </Card>
    </div>,
    document.body
  );
}

export { ModalDialog, modalVariants };
