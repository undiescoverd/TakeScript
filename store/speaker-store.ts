import { create } from "zustand";

export interface Speaker {
  id: string;
  name: string;
  color: string;
  faceVisible: boolean;
}

interface SpeakerState {
  speakers: Speaker[];
  addSpeaker: (speaker: Omit<Speaker, "id">) => Speaker;
  updateSpeaker: (id: string, updates: Partial<Omit<Speaker, "id">>) => void;
  deleteSpeaker: (id: string) => void;
  getSpeaker: (id: string) => Speaker | undefined;
  setSpeakers: (speakers: Speaker[]) => void; // Load speakers from Convex
  clearSpeakers: () => void; // Clear speakers when navigating away
  onSpeakerDeleted?: (speakerId: string) => void;
  setOnSpeakerDeleted: (callback: (speakerId: string) => void) => void;
}

// Default color palette for speakers
export const defaultSpeakerColors = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
];

let speakerIdCounter = 0;

export const useSpeakerStore = create<SpeakerState>()((set, get) => ({
  speakers: [],
  onSpeakerDeleted: undefined,

  addSpeaker: (speaker) => {
    const newSpeaker: Speaker = {
      ...speaker,
      id: `speaker_${Date.now()}_${speakerIdCounter++}`,
    };

    set((state) => ({
      speakers: [...state.speakers, newSpeaker],
    }));

    return newSpeaker;
  },

  updateSpeaker: (id, updates) => {
    set((state) => ({
      speakers: state.speakers.map((speaker) =>
        speaker.id === id ? { ...speaker, ...updates } : speaker
      ),
    }));
  },

  deleteSpeaker: (id) => {
    const state = get();

    // Call callback if set (to clean up editor marks)
    if (state.onSpeakerDeleted) {
      state.onSpeakerDeleted(id);
    }

    set((state) => ({
      speakers: state.speakers.filter((speaker) => speaker.id !== id),
    }));
  },

  getSpeaker: (id) => {
    return get().speakers.find((speaker) => speaker.id === id);
  },

  setSpeakers: (speakers) => {
    set({ speakers });
  },

  clearSpeakers: () => {
    set({ speakers: [] });
  },

  setOnSpeakerDeleted: (callback) => {
    set({ onSpeakerDeleted: callback });
  },
}));
