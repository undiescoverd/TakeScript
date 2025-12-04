import { create } from "zustand";

type EditorMode = "editing" | "recording";

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
}));
