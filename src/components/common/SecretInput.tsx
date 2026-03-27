/**
 * SecretInput — Password/API key input with show/hide toggle.
 * Supports sizes, icons, full-width, copy button, and custom styling.
 */
import * as React from 'react';
import { useState, useCallback } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type SecretInputSize = 'sm' | 'default' | 'lg';

export interface SecretInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  /** Controlled visibility state (uncontrolled by default) */
  visible?: boolean;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Input size variant */
  size?: SecretInputSize;
  /** Icon to show at the start of the input */
  startIcon?: React.ReactNode;
  /** Show a copy-to-clipboard button */
  copyable?: boolean;
  /** Full width of parent container */
  fullWidth?: boolean;
  /** Custom render for the toggle button area */
  renderActions?: (props: { visible: boolean; toggle: () => void }) => React.ReactNode;
}

const sizeStyles: Record<SecretInputSize, string> = {
  sm: 'h-8 text-xs px-2.5',
  default: 'h-10 text-sm px-3',
  lg: 'h-12 text-base px-4',
};

const iconSizes: Record<SecretInputSize, string> = {
  sm: 'h-3 w-3',
  default: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const SecretInput = React.forwardRef<HTMLInputElement, SecretInputProps>(
  (
    {
      className,
      visible: controlledVisible,
      onVisibilityChange,
      size = 'default',
      startIcon,
      copyable = false,
      fullWidth = false,
      renderActions,
      disabled,
      value,
      ...props
    },
    ref
  ) => {
    const [internalVisible, setInternalVisible] = useState(false);
    const [copied, setCopied] = useState(false);

    const isControlled = controlledVisible !== undefined;
    const isVisible = isControlled ? controlledVisible : internalVisible;

    const toggleVisibility = useCallback(() => {
      const next = !isVisible;
      if (isControlled) {
        onVisibilityChange?.(next);
      } else {
        setInternalVisible(next);
      }
    }, [isVisible, isControlled, onVisibilityChange]);

    const handleCopy = useCallback(async () => {
      const text = typeof value === 'string' ? value : String(value ?? '');
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }, [value]);

    const actionCount = 1 + (copyable ? 1 : 0);
    const paddingRight = actionCount === 1 ? 'pr-10' : 'pr-[4.5rem]';

    return (
      <div className={cn('relative group', fullWidth ? 'w-full' : 'w-auto')}>
        {startIcon && (
          <span
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-colors group-focus-within:text-foreground',
              iconSizes[size]
            )}
          >
            {startIcon}
          </span>
        )}
        <input
          ref={ref}
          type={isVisible ? 'text' : 'password'}
          value={value}
          disabled={disabled}
          className={cn(
            'flex w-full rounded-md border border-input bg-background ring-offset-background',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-200',
            sizeStyles[size],
            paddingRight,
            startIcon && 'pl-9',
            className
          )}
          {...props}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {renderActions ? (
            renderActions({ visible: isVisible, toggle: toggleVisibility })
          ) : (
            <>
              {copyable && value && (
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={disabled}
                  className={cn(
                    'rounded-sm p-1.5 text-muted-foreground transition-all duration-200',
                    'hover:text-foreground hover:bg-accent',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    'disabled:pointer-events-none disabled:opacity-50',
                    copied && 'text-green-500 hover:text-green-500'
                  )}
                  aria-label="Copy to clipboard"
                >
                  {copied ? (
                    <Check className={cn(iconSizes[size], 'animate-in zoom-in-50 duration-200')} />
                  ) : (
                    <Copy className={iconSizes[size]} />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={toggleVisibility}
                disabled={disabled}
                className={cn(
                  'rounded-sm p-1.5 text-muted-foreground transition-all duration-200',
                  'hover:text-foreground hover:bg-accent',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'disabled:pointer-events-none disabled:opacity-50'
                )}
                aria-label={isVisible ? 'Hide value' : 'Show value'}
              >
                {isVisible ? (
                  <EyeOff className={cn(iconSizes[size], 'animate-in fade-in-0 duration-150')} />
                ) : (
                  <Eye className={cn(iconSizes[size], 'animate-in fade-in-0 duration-150')} />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
);
SecretInput.displayName = 'SecretInput';

export { SecretInput };
