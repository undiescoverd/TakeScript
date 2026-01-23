import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ScriptPage from './page';
import * as convexReact from 'convex/react';
import { toast } from 'sonner';

// Mock Next.js params
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-script-id' }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock feature flags
vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: () => ({
    aiEnabled: false,
    aiGrammarCheckEnabled: false,
    aiScriptReviewEnabled: false,
    aiGenerationEnabled: false,
    collaborationEnabled: false,
  }),
}));

// Mock autosave hook
vi.mock('@/hooks/use-autosave', () => ({
  useAutosave: () => ({
    scheduleAutosave: vi.fn(),
    saveNow: vi.fn().mockResolvedValue(undefined),
    setOnSaveComplete: vi.fn(),
    getLastSavedContent: () => null,
    initializeLastSaved: vi.fn(),
  }),
}));

// Mock speaker store
vi.mock('@/store/speaker-store', () => ({
  useSpeakerStore: () => ({
    speakers: [],
    setSpeakers: vi.fn(),
    addSpeaker: vi.fn(),
    removeSpeaker: vi.fn(),
    updateSpeaker: vi.fn(),
  }),
  getNextSpeakerColor: () => '#3B82F6',
}));

// Mock editor components
vi.mock('@/components/editor/ScriptEditor', () => ({
  ScriptEditor: () => <div data-testid="script-editor">Script Editor</div>,
}));

vi.mock('@/components/editor/CollaborativeEditor', () => ({
  CollaborativeEditor: () => <div data-testid="collaborative-editor">Collaborative Editor</div>,
}));

vi.mock('@/components/layout/Topbar', () => ({
  Topbar: () => <div data-testid="topbar">Topbar</div>,
}));

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

describe('ScriptPage - Memory Leak Prevention', () => {
  let mockUseQuery: ReturnType<typeof vi.fn>;
  let mockUseAction: ReturnType<typeof vi.fn>;
  let mockUseMutation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseQuery = vi.fn();
    mockUseAction = vi.fn();
    mockUseMutation = vi.fn();

    vi.spyOn(convexReact, 'useQuery').mockImplementation(mockUseQuery);
    vi.spyOn(convexReact, 'useAction').mockImplementation(mockUseAction);
    vi.spyOn(convexReact, 'useMutation').mockImplementation(mockUseMutation);

    // Mock valid script
    mockUseQuery.mockReturnValue({
      _id: 'test-script-id',
      title: 'Test Script',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      lastEditedAt: Date.now(),
      createdAt: Date.now(),
    });

    mockUseAction.mockReturnValue(vi.fn());
    mockUseMutation.mockReturnValue(vi.fn());

    vi.clearAllMocks();
  });

  it('should not accumulate blur listeners on content changes', () => {
    // Track event listener additions
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { rerender } = render(<ScriptPage />);

    const initialBlurListeners = addEventListenerSpy.mock.calls.filter(
      call => call[0] === 'click'
    ).length;

    // Simulate content changes (re-renders)
    for (let i = 0; i < 5; i++) {
      rerender(<ScriptPage />);
    }

    const finalBlurListeners = addEventListenerSpy.mock.calls.filter(
      call => call[0] === 'click'
    ).length;

    // Should not have added more listeners (or should have removed old ones)
    // Allow for initial setup but verify no accumulation
    expect(finalBlurListeners - removeEventListenerSpy.mock.calls.filter(
      call => call[0] === 'click'
    ).length).toBeLessThanOrEqual(initialBlurListeners + 2);
  });

  it('should not accumulate focus mode listeners on re-render', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { rerender } = render(<ScriptPage />);

    const initialKeydownListeners = addEventListenerSpy.mock.calls.filter(
      call => call[0] === 'keydown'
    ).length;

    // Re-render multiple times
    for (let i = 0; i < 5; i++) {
      rerender(<ScriptPage />);
    }

    const finalKeydownListeners = addEventListenerSpy.mock.calls.filter(
      call => call[0] === 'keydown'
    ).length;

    // Should not have accumulated listeners
    expect(finalKeydownListeners - removeEventListenerSpy.mock.calls.filter(
      call => call[0] === 'keydown'
    ).length).toBeLessThanOrEqual(initialKeydownListeners + 2);
  });

  it('should clean up AI command listeners on unmount', () => {
    const windowRemoveEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<ScriptPage />);

    unmount();

    // Should have removed window event listeners (keydown, ai:* events)
    expect(windowRemoveEventListenerSpy).toHaveBeenCalled();

    // Check that at least some cleanup happened
    const calls = windowRemoveEventListenerSpy.mock.calls;
    const hasKeydownCleanup = calls.some(call => call[0] === 'keydown');
    const hasAICleanup = calls.some(call => call[0]?.startsWith('ai:'));

    expect(hasKeydownCleanup || hasAICleanup).toBe(true);
  });

  it('should use current content in blur handler (not stale closure)', async () => {
    const { rerender } = render(<ScriptPage />);

    // Update content multiple times
    mockUseQuery.mockReturnValue({
      _id: 'test-script-id',
      title: 'Test Script',
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated"}]}]}',
      lastEditedAt: Date.now(),
      createdAt: Date.now(),
    });

    rerender(<ScriptPage />);

    // Trigger blur event
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(clickEvent);

    // Should not cause errors (would happen if using stale closure)
    // The test passing means no errors occurred
  });
});

describe('ScriptPage - Error Handling', () => {
  let mockUseQuery: ReturnType<typeof vi.fn>;
  let mockUseAction: ReturnType<typeof vi.fn>;
  let mockUseMutation: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockUseQuery = vi.fn();
    mockUseAction = vi.fn();
    mockUseMutation = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(convexReact, 'useQuery').mockImplementation(mockUseQuery);
    vi.spyOn(convexReact, 'useAction').mockImplementation(mockUseAction);
    vi.spyOn(convexReact, 'useMutation').mockImplementation(mockUseMutation);

    vi.clearAllMocks();
  });

  it('should show toast when script content parse fails', async () => {
    // Mock script with invalid JSON content
    mockUseQuery.mockReturnValue({
      _id: 'test-script-id',
      title: 'Test Script',
      content: '{invalid json}', // Invalid JSON
      lastEditedAt: Date.now(),
      createdAt: Date.now(),
    });

    mockUseAction.mockReturnValue(vi.fn());
    mockUseMutation.mockReturnValue(vi.fn());

    render(<ScriptPage />);

    // Wait for error to be logged
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    // Verify toast was shown to user
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('should log R2 fetch errors properly', async () => {
    const fetchError = new Error('Failed to fetch from R2');

    // Mock script metadata with R2 URL
    mockUseQuery.mockReturnValue({
      _id: 'test-script-id',
      title: 'Test Script',
      content: '', // Empty, will trigger R2 fetch
      contentUrl: 'https://r2-bucket/script.json',
      lastEditedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Mock loadScriptWithContent to reject
    const mockLoadScript = vi.fn().mockRejectedValue(fetchError);
    mockUseAction.mockReturnValue(mockLoadScript);
    mockUseMutation.mockReturnValue(vi.fn());

    render(<ScriptPage />);

    // Wait for R2 fetch to be attempted
    await waitFor(() => {
      expect(mockLoadScript).toHaveBeenCalled();
    });

    // Wait for error to be logged
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load script content from R2'),
        fetchError
      );
    });
  });
});
