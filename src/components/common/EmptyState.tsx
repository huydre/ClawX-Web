/**
 * EmptyState — Placeholder for empty lists/pages with icon, text, and CTA.
 * Supports multiple sizes, variants, and custom content rendering.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const emptyStateVariants = cva(
  'flex flex-col items-center justify-center text-center transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2',
  {
    variants: {
      variant: {
        default: '',
        card: 'rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50',
        ghost: '',
      },
      size: {
        sm: 'py-6 px-4 gap-2',
        default: 'py-10 px-6 gap-3',
        lg: 'py-16 px-8 gap-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const iconVariants = cva(
  'text-muted-foreground/60 transition-colors duration-200 group-hover:text-muted-foreground/80',
  {
    variants: {
      size: {
        sm: 'h-8 w-8 mb-1',
        default: 'h-12 w-12 mb-2',
        lg: 'h-16 w-16 mb-3',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

const titleVariants = cva('font-semibold text-foreground', {
  variants: {
    size: {
      sm: 'text-sm',
      default: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

const descVariants = cva('text-muted-foreground max-w-[280px]', {
  variants: {
    size: {
      sm: 'text-xs',
      default: 'text-sm',
      lg: 'text-sm',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
  /** Icon or illustration to display */
  icon?: React.ReactNode;
  /** Main heading */
  title: string;
  /** Supporting description text */
  description?: string;
  /** CTA button or link */
  action?: React.ReactNode;
  /** Full width of parent container */
  fullWidth?: boolean;
  /** Custom content renderer (replaces title+description+action) */
  renderContent?: () => React.ReactNode;
}

function EmptyState({
  icon,
  title,
  description,
  action,
  variant,
  size,
  fullWidth = false,
  renderContent,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'group',
        emptyStateVariants({ variant, size }),
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {icon && (
        <div className={iconVariants({ size })}>
          {icon}
        </div>
      )}
      {renderContent ? (
        renderContent()
      ) : (
        <>
          <h3 className={titleVariants({ size })}>{title}</h3>
          {description && (
            <p className={descVariants({ size })}>{description}</p>
          )}
          {action && (
            <div className="mt-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-500 delay-150">
              {action}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { EmptyState, emptyStateVariants };
