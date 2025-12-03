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

  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;

  lastSavedAt: number | null;
  setLastSavedAt: (timestamp: number | null) => void;
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

  isSaving: false,
  setIsSaving: (isSaving) => set({ isSaving }),

  lastSavedAt: null,
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
}));
