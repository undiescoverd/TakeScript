"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { ReactRenderer } from "@tiptap/react";
import {
  SpeakerSelectionMenu,
  SpeakerSelectionMenuRef,
} from "./SpeakerSelectionMenu";
import {
  CameraModeMenu,
  CameraModeMenuRef,
} from "./CameraModeMenu";
import { useSpeakerStore } from "@/store/speaker-store";
import { CameraMode } from "@/lib/tiptap/speaker-mark";
import { toast } from "sonner";

interface SpeakerSelectionHandlerProps {
  editor: Editor;
}

export function SpeakerSelectionHandler({
  editor,
}: SpeakerSelectionHandlerProps) {
  const { speakers } = useSpeakerStore();
  const [speakerMenuComponent, setSpeakerMenuComponent] =
    useState<ReactRenderer<SpeakerSelectionMenuRef> | null>(null);
  const [cameraModeMenuComponent, setCameraModeMenuComponent] =
    useState<ReactRenderer<CameraModeMenuRef> | null>(null);
  const clientRectRef = useRef<DOMRect | null>(null);
  const selectedSpeakerRef = useRef<string | null>(null);

  const applySpeakerWithCamera = useCallback(
    (speakerId: string, cameraMode: CameraMode | null) => {
      if (!editor) return;

      const { state } = editor;
      const { $from } = state.selection;

      // Find the paragraph boundaries
      const paragraphStart = $from.start();
      const paragraphEnd = $from.end();

      // Get the speaker details
      const speaker = speakers.find((s) => s.id === speakerId);
      if (!speaker) return;

      // Check if paragraph is empty
      const paragraphContent = state.doc.textBetween(
        paragraphStart,
        paragraphEnd,
        ""
      );
      const isEmpty = paragraphContent.trim().length === 0;

      if (isEmpty) {
        // Insert placeholder text so the speaker mark is visible
        editor
          .chain()
          .focus()
          .setTextSelection({ from: paragraphStart, to: paragraphEnd })
          .insertContent(" ")
          .run();

        // Apply speaker mark to the inserted space
        const newEnd = paragraphStart + 1;
        editor
          .chain()
          .focus()
          .setTextSelection({ from: paragraphStart, to: newEnd })
          .setSpeaker({
            speakerId: speaker.id,
            cameraMode: cameraMode,
          })
          .run();
      } else {
        // Apply speaker to existing content
        editor
          .chain()
          .focus()
          .setTextSelection({ from: paragraphStart, to: paragraphEnd })
          .setSpeaker({
            speakerId: speaker.id,
            cameraMode: cameraMode,
          })
          .run();
      }

      // Update last used speaker/camera in store
      if (typeof window !== "undefined" && (window as any).__speakerStore) {
        (window as any).__speakerStore.setLastUsed(speaker.id, cameraMode);
      }

      const cameraLabel = cameraMode
        ? (cameraMode === "full" ? "Full Screen" : cameraMode === "voiceover" ? "Voiceover" : "Corner")
        : "No camera";
      toast.success(`Assigned to ${speaker.name} (${cameraLabel})`);
    },
    [editor, speakers]
  );

  const showCameraModeMenu = useCallback(
    (speakerId: string) => {
      console.log("[SpeakerSelectionHandler] showCameraModeMenu called for speaker:", speakerId);
      selectedSpeakerRef.current = speakerId;

      // Create and render the camera mode menu at the same position
      const component = new ReactRenderer(CameraModeMenu, {
        props: {
          onSelect: (cameraMode: CameraMode | null) => {
            applySpeakerWithCamera(speakerId, cameraMode);
            // Close camera menu
            component.destroy();
            setCameraModeMenuComponent(null);
            document.removeEventListener("keydown", handleCameraKeyDown);
          },
          clientRect: () => clientRectRef.current,
        },
        editor,
      });

      if (component.element) {
        document.body.appendChild(component.element);
      }

      setCameraModeMenuComponent(component);

      // Add keyboard event handler for camera menu
      const handleCameraKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          component.destroy();
          setCameraModeMenuComponent(null);
          document.removeEventListener("keydown", handleCameraKeyDown);
          return;
        }

        // Delegate to camera menu component
        const handled = component.ref?.onKeyDown({ event: e });
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      // Delay attaching keyboard listener to avoid capturing the Enter/key from previous menu selection
      setTimeout(() => {
        document.addEventListener("keydown", handleCameraKeyDown);
      }, 100);
    },
    [editor, applySpeakerWithCamera]
  );

  useEffect(() => {
    const handleShowSelection = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { editor: eventEditor } = customEvent.detail;

      if (!eventEditor || eventEditor !== editor) return;

      console.log("[SpeakerSelectionHandler] Showing speaker selection menu");

      // Get current cursor position to place menu
      const { selection } = editor.state;
      const { from } = selection;
      const coords = editor.view.coordsAtPos(from);

      clientRectRef.current = new DOMRect(
        coords.left,
        coords.bottom,
        0,
        coords.bottom - coords.top
      );

      // Create and render the speaker selection menu
      const component = new ReactRenderer(SpeakerSelectionMenu, {
        props: {
          onSelect: (speakerId: string) => {
            console.log("[SpeakerSelectionHandler] Speaker selected:", speakerId);
            // Close speaker menu
            component.destroy();
            setSpeakerMenuComponent(null);
            document.removeEventListener("keydown", handleKeyDown);

            // Show camera mode menu
            console.log("[SpeakerSelectionHandler] Now showing camera mode menu");
            showCameraModeMenu(speakerId);
          },
          clientRect: () => clientRectRef.current,
        },
        editor,
      });

      if (component.element) {
        document.body.appendChild(component.element);
      }

      setSpeakerMenuComponent(component);

      // Add keyboard event handler
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          component.destroy();
          setSpeakerMenuComponent(null);
          document.removeEventListener("keydown", handleKeyDown);
          return;
        }

        // Delegate to menu component and check if it handled the event
        const handled = component.ref?.onKeyDown({ event: e });
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }

        // If the menu handled it (selection was made), it will call onSelect which closes the menu
      };

      // Delay attaching keyboard listener to avoid capturing the Enter/key from slash menu selection
      setTimeout(() => {
        document.addEventListener("keydown", handleKeyDown);
      }, 100);

      // Cleanup on component destroy
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    };

    window.addEventListener("speaker:showSelection", handleShowSelection);

    return () => {
      window.removeEventListener("speaker:showSelection", handleShowSelection);
      if (speakerMenuComponent) {
        speakerMenuComponent.destroy();
      }
    };
  }, [editor, showCameraModeMenu, speakerMenuComponent]);

  // Close speaker menu on click outside
  useEffect(() => {
    if (!speakerMenuComponent) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (speakerMenuComponent.element && !speakerMenuComponent.element.contains(e.target as Node)) {
        speakerMenuComponent.destroy();
        setSpeakerMenuComponent(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [speakerMenuComponent]);

  // Close camera menu on click outside
  useEffect(() => {
    if (!cameraModeMenuComponent) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cameraModeMenuComponent.element && !cameraModeMenuComponent.element.contains(e.target as Node)) {
        cameraModeMenuComponent.destroy();
        setCameraModeMenuComponent(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [cameraModeMenuComponent]);

  return null; // This component doesn't render anything itself
}
