import { create } from "zustand";

type EditorMode = "editing" | "recording";
type ViewMode = "focus" | "edit";

interface SavedPanelStates {
  sidebarOpen: boolean;
  versionHistoryOpen: boolean;
  commentsOpen: boolean;
  annotationsOpen: boolean;
  speakersOpen: boolean;
}

interface EditorState {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  toggleMode: () => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  versionHistoryOpen: boolean;
  setVersionHistoryOpen: (open: boolean) => void;
  toggleVersionHistory: () => void;

  commentsOpen: boolean;
  setCommentsOpen: (open: boolean) => void;
  toggleComments: () => void;

  annotationsOpen: boolean;
  setAnnotationsOpen: (open: boolean) => void;
  toggleAnnotations: () => void;

  speakersOpen: boolean;
  setSpeakersOpen: (open: boolean) => void;
  toggleSpeakers: () => void;

  selectedAnnotationId: string | null;
  setSelectedAnnotationId: (id: string | null) => void;

  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;

  lastSavedAt: number | null;
  setLastSavedAt: (timestamp: number | null) => void;

  // Collaboration settings
  collaborationEnabled: boolean;
  setCollaborationEnabled: (enabled: boolean) => void;
  toggleCollaboration: () => void;

  // View Mode (Focus vs Edit)
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  savedPanelStates: SavedPanelStates | null;
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: "editing",
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((state) => ({
      mode: state.mode === "editing" ? "recording" : "editing",
    })),

  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  versionHistoryOpen: false,
  setVersionHistoryOpen: (versionHistoryOpen) => set({ versionHistoryOpen }),
  toggleVersionHistory: () =>
    set((state) => ({ versionHistoryOpen: !state.versionHistoryOpen })),

  commentsOpen: false,
  setCommentsOpen: (commentsOpen) => set({ commentsOpen }),
  toggleComments: () =>
    set((state) => ({ commentsOpen: !state.commentsOpen })),

  annotationsOpen: false,
  setAnnotationsOpen: (annotationsOpen) => set({ annotationsOpen }),
  toggleAnnotations: () =>
    set((state) => ({ annotationsOpen: !state.annotationsOpen })),

  speakersOpen: false,
  setSpeakersOpen: (speakersOpen) => set({ speakersOpen }),
  toggleSpeakers: () =>
    set((state) => ({ speakersOpen: !state.speakersOpen })),

  selectedAnnotationId: null,
  setSelectedAnnotationId: (selectedAnnotationId) =>
    set({ selectedAnnotationId }),

  isSaving: false,
  setIsSaving: (isSaving) => set({ isSaving }),

  lastSavedAt: null,
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),

  // Collaboration - disabled by default until server is running
  collaborationEnabled: false,
  setCollaborationEnabled: (collaborationEnabled) => set({ collaborationEnabled }),
  toggleCollaboration: () =>
    set((state) => ({ collaborationEnabled: !state.collaborationEnabled })),

  // View Mode - defaults to "edit" (full UI)
  viewMode: "edit",
  savedPanelStates: null,
  setViewMode: (viewMode) =>
    set((state) => {
      // Entering Focus Mode
      if (viewMode === "focus") {
        // Save current panel states
        const savedPanelStates: SavedPanelStates = {
          sidebarOpen: state.sidebarOpen,
          versionHistoryOpen: state.versionHistoryOpen,
          commentsOpen: state.commentsOpen,
          annotationsOpen: state.annotationsOpen,
          speakersOpen: state.speakersOpen,
        };

        // Close all panels
        return {
          viewMode,
          savedPanelStates,
          sidebarOpen: false,
          versionHistoryOpen: false,
          commentsOpen: false,
          annotationsOpen: false,
          speakersOpen: false,
        };
      }

      // Exiting Focus Mode - restore panel states
      if (viewMode === "edit" && state.savedPanelStates) {
        const { savedPanelStates } = state;
        return {
          viewMode,
          savedPanelStates: null,
          sidebarOpen: savedPanelStates.sidebarOpen,
          versionHistoryOpen: savedPanelStates.versionHistoryOpen,
          commentsOpen: savedPanelStates.commentsOpen,
          annotationsOpen: savedPanelStates.annotationsOpen,
          speakersOpen: savedPanelStates.speakersOpen,
        };
      }

      // Default case (shouldn't normally hit this)
      return { viewMode };
    }),
  toggleViewMode: () =>
    set((state) => {
      const newMode: ViewMode = state.viewMode === "focus" ? "edit" : "focus";
      // Call setViewMode logic by returning the same state transformation
      if (newMode === "focus") {
        const savedPanelStates: SavedPanelStates = {
          sidebarOpen: state.sidebarOpen,
          versionHistoryOpen: state.versionHistoryOpen,
          commentsOpen: state.commentsOpen,
          annotationsOpen: state.annotationsOpen,
          speakersOpen: state.speakersOpen,
        };
        return {
          viewMode: newMode,
          savedPanelStates,
          sidebarOpen: false,
          versionHistoryOpen: false,
          commentsOpen: false,
          annotationsOpen: false,
          speakersOpen: false,
        };
      } else if (state.savedPanelStates) {
        const { savedPanelStates } = state;
        return {
          viewMode: newMode,
          savedPanelStates: null,
          sidebarOpen: savedPanelStates.sidebarOpen,
          versionHistoryOpen: savedPanelStates.versionHistoryOpen,
          commentsOpen: savedPanelStates.commentsOpen,
          annotationsOpen: savedPanelStates.annotationsOpen,
          speakersOpen: savedPanelStates.speakersOpen,
        };
      }
      return { viewMode: newMode };
    }),
}));
