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
