import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Id } from "@/convex/_generated/dataModel";

type ViewMode = "grid" | "list";

interface FolderState {
  // Current folder being viewed (null = root)
  currentFolderId: Id<"scripts"> | null;
  setCurrentFolder: (id: Id<"scripts"> | null) => void;

  // View mode for the main panel
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Expanded folders in the sidebar tree
  expandedFolders: Set<string>;
  toggleFolderExpanded: (id: string) => void;
  setFolderExpanded: (id: string, expanded: boolean) => void;
  isExpanded: (id: string) => boolean;
  expandAll: (ids: string[]) => void;
  collapseAll: () => void;

  // Sidebar visibility
  folderSidebarOpen: boolean;
  setFolderSidebarOpen: (open: boolean) => void;
  toggleFolderSidebar: () => void;
}

export const useFolderStore = create<FolderState>()(
  persist(
    (set, get) => ({
      currentFolderId: null,
      setCurrentFolder: (currentFolderId) => set({ currentFolderId }),

      viewMode: "grid",
      setViewMode: (viewMode) => set({ viewMode }),

      expandedFolders: new Set<string>(),
      toggleFolderExpanded: (id) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          if (newExpanded.has(id)) {
            newExpanded.delete(id);
          } else {
            newExpanded.add(id);
          }
          return { expandedFolders: newExpanded };
        }),
      setFolderExpanded: (id, expanded) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          if (expanded) {
            newExpanded.add(id);
          } else {
            newExpanded.delete(id);
          }
          return { expandedFolders: newExpanded };
        }),
      isExpanded: (id) => get().expandedFolders.has(id),
      expandAll: (ids) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          ids.forEach((id) => newExpanded.add(id));
          return { expandedFolders: newExpanded };
        }),
      collapseAll: () => set({ expandedFolders: new Set<string>() }),

      folderSidebarOpen: true,
      setFolderSidebarOpen: (folderSidebarOpen) => set({ folderSidebarOpen }),
      toggleFolderSidebar: () => set((state) => ({ folderSidebarOpen: !state.folderSidebarOpen })),
    }),
    {
      name: "takescript-folder-store",
      partialize: (state) => ({
        viewMode: state.viewMode,
        folderSidebarOpen: state.folderSidebarOpen,
        // Note: expandedFolders is not persisted as Set doesn't serialize well
        // and folder IDs may become stale across sessions
      }),
    }
  )
);
