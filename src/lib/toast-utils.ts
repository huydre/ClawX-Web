import { toast } from 'sonner';

/**
 * Wrap an async function with standardized toast error handling.
 * On success, optionally shows a success toast.
 * On failure, shows an error toast with the error message.
 *
 * @example
 * await withToastError(
 *   () => api.deleteProvider(id),
 *   { success: 'Provider deleted' }
 * );
 */
export async function withToastError<T>(
  fn: () => Promise<T>,
  options?: {
    success?: string;
    errorPrefix?: string;
    onFinally?: () => void;
  }
): Promise<T | undefined> {
  try {
    const result = await fn();
    if (options?.success) {
      toast.success(options.success);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const prefix = options?.errorPrefix ? `${options.errorPrefix}: ` : '';
    toast.error(`${prefix}${message}`);
    return undefined;
  } finally {
    options?.onFinally?.();
  }
}
