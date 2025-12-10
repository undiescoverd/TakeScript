import { useSpeakerStore } from "@/store/speaker-store";

// Callback type for pill clicks
type PillClickHandler = (speakerId: string, position: number, faceVisible: boolean) => void;

let pillClickHandler: PillClickHandler | null = null;

// Flag to prevent infinite loops from MutationObserver
let isProcessing = false;

export function setPillClickHandler(handler: PillClickHandler) {
  pillClickHandler = handler;
}

// Apply speaker colors to all paragraphs with speaker-text marks
function applySpeakerColorsToParagraphs(container: HTMLElement) {
  // Find ALL paragraphs in the editor
  const allParagraphs = container.querySelectorAll("p");

  allParagraphs.forEach((paragraph) => {
    // Look for speaker-text elements within this paragraph - check all descendants
    const speakerTextElement = paragraph.querySelector(".speaker-text, [data-speaker-id]");
    // Also check if paragraph has data-speaker-id directly (from pill widget)
    const paragraphSpeakerId = (paragraph as HTMLElement).getAttribute("data-speaker-id");

    const paraEl = paragraph as HTMLElement;

    // Get speaker ID from either speaker-text element or paragraph attribute
    let speakerId: string | null = null;
    if (speakerTextElement) {
      speakerId = speakerTextElement.getAttribute("data-speaker-id");
    }
    if (!speakerId && paragraphSpeakerId) {
      speakerId = paragraphSpeakerId;
    }

    if (speakerId) {
      const speaker = useSpeakerStore.getState().getSpeaker(speakerId);
      if (speaker) {
        // Only modify if values actually changed to avoid triggering more mutations
        if (!paraEl.classList.contains("has-speaker")) {
          paraEl.classList.add("has-speaker");
        }
        // CRITICAL: Set CSS variable - this should cascade to ::before pseudo-element
        if (paraEl.style.getPropertyValue("--speaker-color") !== speaker.color) {
          paraEl.style.setProperty("--speaker-color", speaker.color);
        }
        if (paraEl.getAttribute("data-speaker-id") !== speakerId) {
          paraEl.setAttribute("data-speaker-id", speakerId);
        }
        if (paraEl.getAttribute("data-speaker-color") !== speaker.color) {
          paraEl.setAttribute("data-speaker-color", speaker.color);
        }
      }
    } else {
      // Remove the class, color variable, and data attributes if no speaker text found
      if (paraEl.classList.contains("has-speaker")) {
        paraEl.classList.remove("has-speaker");
      }
      if (paraEl.style.getPropertyValue("--speaker-color")) {
        paraEl.style.removeProperty("--speaker-color");
      }
      if (paraEl.style.getPropertyValue("border-left-color")) {
        paraEl.style.removeProperty("border-left-color");
      }
      // Only remove data attributes if we're sure there's no speaker
      if (!paraEl.querySelector("[data-speaker-id]")) {
        if (paraEl.hasAttribute("data-speaker-id")) {
          paraEl.removeAttribute("data-speaker-id");
        }
        if (paraEl.hasAttribute("data-speaker-color")) {
          paraEl.removeAttribute("data-speaker-color");
        }
      }
    }
  });
}

// This function will be called to populate speaker pill widgets
export function renderSpeakerPills(container: HTMLElement, force = false) {
  // Prevent infinite loops - if we're already processing, skip
  if (isProcessing) return;
  isProcessing = true;

  try {
    // First, apply colors to all paragraphs with speaker marks
    applySpeakerColorsToParagraphs(container);

    const widgets = container.querySelectorAll(".speaker-pill-widget");

    widgets.forEach((widget) => {
      const speakerId = widget.getAttribute("data-speaker-id");
      if (!speakerId) return;

      // Skip if already rendered (has click handler attached) unless forcing re-render
      if ((widget as any).__pillRendered && !force) return;

      const faceVisibleAttr = widget.getAttribute("data-face-visible");
      const faceVisible = faceVisibleAttr !== "false";
      const position = parseInt(widget.getAttribute("data-position") || "0", 10);

      // Get speaker data from store
      const speaker = useSpeakerStore.getState().getSpeaker(speakerId);
      if (!speaker) {
        widget.textContent = "[Unknown Speaker]";
        return;
      }

      // Apply speaker color to parent paragraph (redundant but safe)
      const paragraph = widget.closest("p");
      if (paragraph) {
        const paraEl = paragraph as HTMLElement;
        if (!paraEl.classList.contains("has-speaker")) {
          paraEl.classList.add("has-speaker");
        }
        if (paraEl.style.getPropertyValue("--speaker-color") !== speaker.color) {
          paraEl.style.setProperty("--speaker-color", speaker.color);
        }
        if (paraEl.getAttribute("data-speaker-id") !== speakerId) {
          paraEl.setAttribute("data-speaker-id", speakerId);
        }
        if (paraEl.getAttribute("data-speaker-color") !== speaker.color) {
          paraEl.setAttribute("data-speaker-color", speaker.color);
        }
      }

      // Create pill content
      widget.innerHTML = "";
      widget.className = "speaker-pill-widget speaker-pill-container";
      (widget as HTMLElement).style.backgroundColor = speaker.color;
      (widget as HTMLElement).style.cursor = "pointer";

      // Add click handler with debouncing to prevent double-clicks
      let isHandling = false;
      (widget as HTMLElement).onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Prevent double-clicks
        if (isHandling) {
          return;
        }

        isHandling = true;

        if (pillClickHandler) {
          pillClickHandler(speakerId, position, faceVisible);
        }

        // Reset after a short delay
        setTimeout(() => {
          isHandling = false;
        }, 300);
      };

      // Mark as rendered to prevent re-rendering
      (widget as any).__pillRendered = true;

      // Add icon
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("fill", "none");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("stroke-width", "1.5");
      icon.setAttribute("stroke", "currentColor");
      icon.style.pointerEvents = "none"; // Allow clicks to pass through to parent

      if (faceVisible) {
        // Eye icon
        icon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        `;
      } else {
        // EyeOff icon
        icon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        `;
      }

      widget.appendChild(icon);

      // Add speaker name
      const nameSpan = document.createElement("span");
      nameSpan.textContent = speaker.name;
      nameSpan.style.pointerEvents = "none"; // Allow clicks to pass through to parent
      widget.appendChild(nameSpan);
    });
  } finally {
    isProcessing = false;
  }
}

// Set up mutation observer to watch for new widgets
export function setupSpeakerPillObserver(editorElement: HTMLElement) {
  const observer = new MutationObserver((mutations) => {
    // Skip if we're already processing to prevent infinite loops
    if (isProcessing) return;

    let shouldRender = false;

    mutations.forEach((mutation) => {
      // Check for added nodes (widgets, paragraphs, speaker-text elements)
      mutation.addedNodes.forEach((node) => {
        if (
          node instanceof HTMLElement &&
          (node.classList.contains("speaker-pill-widget") ||
           node.querySelector(".speaker-pill-widget") ||
           node.classList.contains("speaker-text") ||
           node.querySelector(".speaker-text") ||
           node.tagName === "P")
        ) {
          shouldRender = true;
        }
      });

      // Check for attribute changes on paragraphs or speaker-text elements
      // BUT skip if the change is on a data attribute we set (to avoid loops)
      if (mutation.type === "attributes") {
        const target = mutation.target;
        if (target instanceof HTMLElement) {
          // Only trigger on speaker-text or new speaker elements, not on our own changes
          if (target.classList.contains("speaker-text")) {
            shouldRender = true;
          }
        }
      }

      // Check for removed nodes that might have been speaker-related
      mutation.removedNodes.forEach((node) => {
        if (
          node instanceof HTMLElement &&
          (node.classList.contains("speaker-text") ||
           node.querySelector(".speaker-text") ||
           node.tagName === "P")
        ) {
          shouldRender = true;
        }
      });
    });

    // Re-render pills if we detected relevant changes
    if (shouldRender) {
      renderSpeakerPills(editorElement);
    }
  });

  observer.observe(editorElement, {
    childList: true,
    subtree: true,
    attributes: true,
    // Only watch for speaker-text class changes, not our own attribute changes
    attributeFilter: ["class"],
  });

  // Initial render
  renderSpeakerPills(editorElement);

  return observer;
}

// Export function to manually apply colors (useful for editor update hooks)
export function applySpeakerColors(editorElement: HTMLElement) {
  if (isProcessing) return;
  isProcessing = true;
  try {
    applySpeakerColorsToParagraphs(editorElement);
  } finally {
    isProcessing = false;
  }
}
