"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const REVEAL_THRESHOLD_PX = 140;
const HIDE_DELAY_MS = 350;

type ViewMode = "focus" | "edit";

export function useFocusChromeReveal(viewMode: ViewMode) {
  const [chromeRevealed, setChromeRevealed] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromePinnedRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showChrome = useCallback(() => {
    clearHideTimer();
    setChromeRevealed(true);
  }, [clearHideTimer]);

  const scheduleHideChrome = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (!chromePinnedRef.current) {
        setChromeRevealed(false);
      }
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
  }, [clearHideTimer]);

  useEffect(() => {
    if (viewMode !== "focus") {
      chromePinnedRef.current = false;
      clearHideTimer();
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.clientY <= REVEAL_THRESHOLD_PX) {
        showChrome();
      } else if (!chromePinnedRef.current) {
        scheduleHideChrome();
      }
    };

    document.addEventListener("pointermove", onPointerMove);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      clearHideTimer();
    };
  }, [viewMode, showChrome, scheduleHideChrome, clearHideTimer]);

  const onChromeMouseEnter = useCallback(() => {
    chromePinnedRef.current = true;
    showChrome();
  }, [showChrome]);

  const onChromeMouseLeave = useCallback(() => {
    chromePinnedRef.current = false;
    scheduleHideChrome();
  }, [scheduleHideChrome]);

  const chromeMouseHandlers = useMemo(
    () => ({
      onMouseEnter: onChromeMouseEnter,
      onMouseLeave: onChromeMouseLeave,
    }),
    [onChromeMouseEnter, onChromeMouseLeave]
  );

  return {
    chromeRevealed: viewMode === "focus" && chromeRevealed,
    chromeMouseHandlers,
  };
}
