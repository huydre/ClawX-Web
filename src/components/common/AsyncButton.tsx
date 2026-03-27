/**
 * AsyncButton — Button with built-in loading state, icons, and variants.
 * Wraps the existing Button component with loading spinner, icon support,
 * and auto-disable during loading.
 */
import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AsyncButtonProps extends ButtonProps {
  /** Show loading spinner and disable the button */
  loading?: boolean;
  /** Text to show while loading (defaults to children) */
  loadingText?: string;
  /** Icon element to show before the label */
  icon?: React.ReactNode;
  /** Custom loading icon (defaults to spinning Loader2) */
  loadingIcon?: React.ReactNode;
  /** Render as icon-only button (hides text, square aspect ratio) */
  iconOnly?: boolean;
  /** Full width of parent container */
  fullWidth?: boolean;
}

const spinnerSizes: Record<string, string> = {
  sm: 'h-3.5 w-3.5',
  default: 'h-4 w-4',
  lg: 'h-5 w-5',
  icon: 'h-4 w-4',
};

const AsyncButton = React.forwardRef<HTMLButtonElement, AsyncButtonProps>(
  (
    {
      loading = false,
      loadingText,
      icon,
      loadingIcon,
      iconOnly = false,
      fullWidth = false,
      disabled,
      children,
      className,
      size,
      ...props
    },
    ref
  ) => {
    const sizeKey = (size as string) || 'default';
    const spinnerClass = spinnerSizes[sizeKey] || spinnerSizes.default;

    const spinner = loadingIcon ?? (
      <Loader2 className={cn(spinnerClass, 'animate-spin')} />
    );

    const currentIcon = loading ? spinner : icon;
    const showText = !iconOnly;

    return (
      <Button
        ref={ref}
        size={iconOnly ? 'icon' : size}
        disabled={disabled || loading}
        className={cn(
          'relative transition-all duration-200',
          fullWidth && 'w-full',
          loading && 'cursor-wait',
          className
        )}
        {...props}
      >
        {currentIcon && (
          <span
            className={cn(
              'shrink-0 transition-transform duration-200',
              showText && 'mr-2',
              loading && 'animate-in spin-in-180 duration-300'
            )}
          >
            {currentIcon}
          </span>
        )}
        {showText && (
          <span className={cn(
            'transition-opacity duration-150',
            loading && !loadingText && 'opacity-80'
          )}>
            {loading && loadingText ? loadingText : children}
          </span>
        )}
      </Button>
    );
  }
);
AsyncButton.displayName = 'AsyncButton';

export { AsyncButton };
