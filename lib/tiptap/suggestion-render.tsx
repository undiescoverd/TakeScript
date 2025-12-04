import { ReactRenderer } from "@tiptap/react";
import { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import {
  SlashCommandMenu,
  SlashCommandMenuRef,
} from "@/components/editor/SlashCommandMenu";
import { SlashCommandItem } from "./slash-commands";

export function createSlashCommandsRender() {
  let component: ReactRenderer<SlashCommandMenuRef> | null = null;
  let commandFn: ((item: SlashCommandItem) => void) | null = null;

  return {
    onStart: (props: SuggestionProps<SlashCommandItem>) => {
      // Store the command function so it stays current
      commandFn = props.command;

      component = new ReactRenderer(SlashCommandMenu, {
        props: {
          items: props.items,
          command: (item: SlashCommandItem) => {
            if (commandFn) {
              commandFn(item);
            }
          },
          clientRect: props.clientRect,
        },
        editor: props.editor,
      });

      // Append to body for proper positioning
      if (component.element) {
        document.body.appendChild(component.element);
      }
    },

    onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
      // Update the command function reference
      commandFn = props.command;

      component?.updateProps({
        items: props.items,
        command: (item: SlashCommandItem) => {
          if (commandFn) {
            commandFn(item);
          }
        },
        clientRect: props.clientRect,
      });
    },

    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === "Escape") {
        component?.destroy();
        component = null;
        return true;
      }

      // Delegate to the component's keyboard handler
      return component?.ref?.onKeyDown(props) ?? false;
    },

    onExit: () => {
      component?.destroy();
      component = null;
      commandFn = null;
    },
  };
}
