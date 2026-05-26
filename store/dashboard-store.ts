import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "grid" | "list" | "kanban";

interface DashboardState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      viewMode: "grid",
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    {
      name: "takescript-dashboard-store",
      partialize: (state) => ({
        viewMode: state.viewMode,
      }),
    }
  )
);
