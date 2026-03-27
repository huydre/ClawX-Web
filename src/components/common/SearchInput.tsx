/**
 * SearchInput — Input with search icon, optional clear button, and loading state.
 * Supports sizes, full-width, debounced onChange, and custom icons.
 */
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchInputSize = 'sm' | 'default' | 'lg';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'onChange'> {
  /** Controlled value */
  value?: string;
  /** Called on every keystroke (or after debounce if set) */
  onChange?: (value: string) => void;
  /** Debounce delay in ms (0 = no debounce) */
  debounce?: number;
  /** Input size variant */
  size?: SearchInputSize;
  /** Show a loading spinner instead of the search icon */
  loading?: boolean;
  /** Show clear (X) button when input has value */
  clearable?: boolean;
  /** Called when user clicks the clear button */
  onClear?: () => void;
  /** Custom icon to replace the default Search icon */
  icon?: React.ReactNode;
  /** Full width of parent container */
  fullWidth?: boolean;
  /** Form submit handler (for search-on-enter) */
  onSubmit?: () => void;
}

const sizeStyles: Record<SearchInputSize, { input: string; icon: string; clearBtn: string }> = {
  sm: {
    input: 'h-8 text-xs pl-8 pr-8',
    icon: 'left-2.5 top-2 h-3.5 w-3.5',
    clearBtn: 'right-2 top-1.5 p-0.5',
  },
  default: {
    input: 'h-10 text-sm pl-9 pr-9',
    icon: 'left-3 top-3 h-4 w-4',
    clearBtn: 'right-2.5 top-2.5 p-0.5',
  },
  lg: {
    input: 'h-12 text-base pl-11 pr-11',
    icon: 'left-3.5 top-3.5 h-5 w-5',
    clearBtn: 'right-3 top-3 p-1',
  },
};

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value: controlledValue,
      onChange,
      debounce = 0,
      size = 'default',
      loading = false,
      clearable = true,
      onClear,
      icon,
      fullWidth = false,
      onSubmit,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(controlledValue ?? '');
    const isControlled = controlledValue !== undefined;
    const currentValue = isControlled ? controlledValue : internalValue;

    // Sync internal state when controlled value changes
    useEffect(() => {
      if (isControlled) {
        setInternalValue(controlledValue);
      }
    }, [controlledValue, isControlled]);

    // Debounced onChange
    useEffect(() => {
      if (debounce <= 0 || !onChange) return;
      const timer = setTimeout(() => {
        onChange(internalValue);
      }, debounce);
      return () => clearTimeout(timer);
    }, [internalValue, debounce, onChange]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInternalValue(newValue);
        if (debounce <= 0 && onChange) {
          onChange(newValue);
        }
      },
      [debounce, onChange]
    );

    const handleClear = useCallback(() => {
      setInternalValue('');
      onChange?.('');
      onClear?.();
    }, [onChange, onClear]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && onSubmit) {
          e.preventDefault();
          onSubmit();
        }
        if (e.key === 'Escape' && currentValue) {
          handleClear();
        }
      },
      [onSubmit, currentValue, handleClear]
    );

    const styles = sizeStyles[size];
    const showClear = clearable && currentValue && !disabled;

    const SearchIcon = loading ? (
      <Loader2 className={cn('absolute text-muted-foreground animate-spin', styles.icon)} />
    ) : icon ? (
      <span className={cn('absolute text-muted-foreground pointer-events-none', styles.icon)}>
        {icon}
      </span>
    ) : (
      <Search className={cn('absolute text-muted-foreground pointer-events-none', styles.icon)} />
    );

    return (
      <div className={cn('relative group', fullWidth ? 'w-full' : 'w-auto')}>
        {SearchIcon}
        <input
          ref={ref}
          type="text"
          value={currentValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            'flex w-full rounded-md border border-input bg-background ring-offset-background',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-200',
            styles.input,
            !showClear && size === 'default' && 'pr-3',
            className
          )}
          {...props}
        />
        {showClear && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              'absolute rounded-sm text-muted-foreground transition-all duration-150',
              'hover:text-foreground hover:bg-accent',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
              styles.clearBtn
            )}
            aria-label="Clear search"
          >
            <X className={size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';

export { SearchInput };
