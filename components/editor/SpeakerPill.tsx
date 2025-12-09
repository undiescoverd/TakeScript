"use client";

import { Eye, EyeOff } from "lucide-react";
import { useSpeakerStore } from "@/store/speaker-store";

interface SpeakerPillProps {
  speakerId: string;
  className?: string;
}

export function SpeakerPill({ speakerId, className = "" }: SpeakerPillProps) {
  const speaker = useSpeakerStore((state) => state.getSpeaker(speakerId));

  if (!speaker) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${className}`}
      style={{ backgroundColor: speaker.color }}
    >
      {speaker.faceVisible ? (
        <Eye className="h-3 w-3" />
      ) : (
        <EyeOff className="h-3 w-3" />
      )}
      <span>{speaker.name}</span>
    </span>
  );
}
