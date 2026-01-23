import { toast } from 'sonner';

export interface LogContext {
  [key: string]: any;
}

/**
 * Format an error for logging
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Get stack trace from error if available
 */
function getStackTrace(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return undefined;
}

/**
 * Format timestamp for logging
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Log error with context and optional user notification
 */
export function logError(
  error: unknown,
  message: string,
  context: LogContext = {},
  showToast: boolean = false
): void {
  const timestamp = getTimestamp();
  const errorMessage = formatError(error);
  const stack = getStackTrace(error);

  const logMessage = `[${timestamp}] ERROR: ${message} - ${errorMessage}`;

  console.error(
    logMessage,
    {
      context,
      ...(stack && { stack }),
    }
  );

  if (showToast) {
    toast.error(message, {
      description: errorMessage,
      duration: 5000,
    });
  }
}

/**
 * Log warning with context
 */
export function logWarning(message: string, context: LogContext = {}): void {
  const timestamp = getTimestamp();
  const logMessage = `[${timestamp}] WARNING: ${message}`;

  console.warn(logMessage, context);
}

/**
 * Log info with context
 */
export function logInfo(message: string, context: LogContext = {}): void {
  const timestamp = getTimestamp();
  const logMessage = `[${timestamp}] INFO: ${message}`;

  console.log(logMessage, context);
}
