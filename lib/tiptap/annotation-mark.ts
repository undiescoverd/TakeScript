import { Mark, mergeAttributes } from "@tiptap/core";

export interface AnnotationMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    annotationMark: {
      /**
       * Set an annotation mark
       */
      setAnnotation: (attributes: {
        annotationId: string;
        color?: string;
      }) => ReturnType;
      /**
       * Toggle an annotation mark
       */
      toggleAnnotation: (attributes: {
        annotationId: string;
        color?: string;
      }) => ReturnType;
      /**
       * Unset an annotation mark
       */
      unsetAnnotation: () => ReturnType;
      /**
       * Remove a specific annotation by ID
       */
      removeAnnotation: (annotationId: string) => ReturnType;
    };
  }
}

export const AnnotationMark = Mark.create<AnnotationMarkOptions>({
  name: "annotation",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      annotationId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-annotation-id"),
        renderHTML: (attributes) => {
          if (!attributes.annotationId) {
            return {};
          }
          return {
            "data-annotation-id": attributes.annotationId,
          };
        },
      },
      color: {
        default: "yellow",
        parseHTML: (element) =>
          element.getAttribute("data-annotation-color") || "yellow",
        renderHTML: (attributes) => {
          return {
            "data-annotation-color": attributes.color,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-annotation-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const color = HTMLAttributes["data-annotation-color"] || "yellow";
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `annotation-highlight annotation-${color}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setAnnotation:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      toggleAnnotation:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
      unsetAnnotation:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      removeAnnotation:
        (annotationId) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;

          const { doc } = state;
          const markType = state.schema.marks[this.name];

          // Find and remove all instances of this annotation
          doc.descendants((node, pos) => {
            if (!node.isText) return;

            const marks = node.marks.filter(
              (mark) =>
                mark.type === markType &&
                mark.attrs.annotationId === annotationId
            );

            marks.forEach((mark) => {
              tr.removeMark(pos, pos + node.nodeSize, mark);
            });
          });

          return true;
        },
    };
  },
});

// Annotation colors with their display names
export const annotationColors = [
  { id: "yellow", name: "Yellow", bgClass: "bg-yellow-200/60" },
  { id: "green", name: "Green", bgClass: "bg-green-200/60" },
  { id: "blue", name: "Blue", bgClass: "bg-blue-200/60" },
  { id: "pink", name: "Pink", bgClass: "bg-pink-200/60" },
  { id: "purple", name: "Purple", bgClass: "bg-purple-200/60" },
  { id: "orange", name: "Orange", bgClass: "bg-orange-200/60" },
] as const;

export type AnnotationColor = (typeof annotationColors)[number]["id"];
