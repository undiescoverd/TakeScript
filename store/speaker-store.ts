import { create } from "zustand";

export type CameraMode = "full" | "corner" | "voiceover";
export type CameraModeNullable = CameraMode | null;

export interface Speaker {
  id: string;
  name: string;
  color: string;
  defaultVisibility?: CameraModeNullable;
}

interface SpeakerState {
  speakers: Speaker[];
  lastUsedSpeakerId: string | null;
  lastUsedCameraMode: CameraModeNullable;
  // Pending speaker - set via shortcut, applied to next typed text
  pendingSpeakerId: string | null;
  pendingCameraMode: CameraModeNullable;
  setSpeakers: (speakers: Speaker[]) => void;
  addSpeaker: (speaker: Speaker) => void;
  updateSpeaker: (id: string, updates: Partial<Speaker>) => void;
  removeSpeaker: (id: string) => void;
  getSpeakerById: (id: string) => Speaker | undefined;
  setLastUsed: (speakerId: string, cameraMode: CameraModeNullable) => void;
  setPendingSpeaker: (speakerId: string | null, cameraMode: CameraModeNullable) => void;
  clearPendingSpeaker: () => void;
}

// Default speaker colors palette
export const defaultSpeakerColors = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

// Get next available color for a new speaker
export function getNextSpeakerColor(existingSpeakers: Speaker[]): string {
  const usedColors = new Set(existingSpeakers.map((s) => s.color));
  const availableColor = defaultSpeakerColors.find((c) => !usedColors.has(c));
  return availableColor || defaultSpeakerColors[existingSpeakers.length % defaultSpeakerColors.length];
}

// Generate a unique speaker ID
export function generateSpeakerId(): string {
  return `speaker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useSpeakerStore = create<SpeakerState>((set, get) => ({
  speakers: [],
  lastUsedSpeakerId: null,
  lastUsedCameraMode: null,
  pendingSpeakerId: null,
  pendingCameraMode: null,

  setSpeakers: (speakers) => set({ speakers }),

  addSpeaker: (speaker) =>
    set((state) => ({
      speakers: [...state.speakers, speaker],
    })),

  updateSpeaker: (id, updates) =>
    set((state) => ({
      speakers: state.speakers.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  removeSpeaker: (id) =>
    set((state) => ({
      speakers: state.speakers.filter((s) => s.id !== id),
    })),

  getSpeakerById: (id) => get().speakers.find((s) => s.id === id),

  setLastUsed: (speakerId, cameraMode) =>
    set({ lastUsedSpeakerId: speakerId, lastUsedCameraMode: cameraMode }),

  setPendingSpeaker: (speakerId, cameraMode) =>
    set({ pendingSpeakerId: speakerId, pendingCameraMode: cameraMode }),

  clearPendingSpeaker: () =>
    set({ pendingSpeakerId: null, pendingCameraMode: null }),
}));
