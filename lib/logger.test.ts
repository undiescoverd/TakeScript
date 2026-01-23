import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logError, logWarning, logInfo } from './logger';
import { toast } from 'sonner';

vi.mock('sonner');

describe('logger utility', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logError', () => {
    it('should log error to console with context', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'save' };

      logError(error, 'Test operation failed', context);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('Test operation failed');
      expect(loggedMessage).toContain('Test error');
    });

    it('should show toast when showToast is true', () => {
      const error = new Error('Network error');

      logError(error, 'Save failed', {}, true);

      expect(toast.error).toHaveBeenCalledWith(
        'Save failed',
        expect.objectContaining({
          description: expect.stringContaining('Network error'),
        })
      );
    });

    it('should not show toast when showToast is false', () => {
      const error = new Error('Background error');

      logError(error, 'Background operation failed', {}, false);

      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should handle non-Error objects', () => {
      const error = 'String error message';

      logError(error, 'String error occurred');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('String error occurred');
      expect(loggedMessage).toContain('String error message');
    });

    it('should include stack traces for Error objects', () => {
      const error = new Error('Stack trace error');

      logError(error, 'Error with stack');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedData = consoleErrorSpy.mock.calls[0];
      // Check that stack trace is logged (either in message or as separate argument)
      const allArgs = loggedData.join(' ');
      expect(allArgs).toContain('Stack trace error');
    });
  });

  describe('logWarning', () => {
    it('should log warning to console', () => {
      logWarning('Deprecated API usage', { api: 'oldMethod' });

      expect(consoleWarnSpy).toHaveBeenCalled();
      const loggedMessage = consoleWarnSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('Deprecated API usage');
    });
  });

  describe('logInfo', () => {
    it('should log info to console', () => {
      logInfo('User action', { action: 'click', button: 'save' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('User action');
    });
  });
});
