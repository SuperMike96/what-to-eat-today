import { useEffect, useRef, useState } from "react";
import type { SwipeActionKind } from "../types";
import {
  HISTORY_LIMIT,
  type PersistedState,
} from "./usePersistentState";
import { updateListsByAction } from "../lib/dishActions";
import { haptic } from "../lib/haptics";

interface UseSwipeSessionParams {
  state: PersistedState;
  setState: (updater: (current: PersistedState) => PersistedState) => void;
  activeDish: import("../types").Dish | undefined;
}

/**
 * Extracts the swipe-session concerns from App.tsx:
 *   - applySwipe / undoLast / sweep
 *   - preview state (Tinder-style visual feedback on dock hover)
 *   - intro hint dismissal
 *   - keyboard shortcuts (arrow keys + Ctrl+Z)
 *
 * resetAll and patch stay in App.tsx — they're not swipe-specific.
 */
export function useSwipeSession({
  state,
  setState,
  activeDish,
}: UseSwipeSessionParams) {
  const activeDishIdRef = useRef<string | undefined>(activeDish?.id);
  useEffect(() => {
    activeDishIdRef.current = activeDish?.id;
  }, [activeDish]);

  const applySwipe = (dishId: string, action: SwipeActionKind) => {
    setState((current) => {
      const lists = updateListsByAction(current, dishId, action);
      const nextHistory = [...current.history, { dishId, action, timestamp: Date.now() }];
      const trimmedHistory = nextHistory.length > HISTORY_LIMIT ? nextHistory.slice(-HISTORY_LIMIT) : nextHistory;
      return { ...current, ...lists, history: trimmedHistory };
    });
  };

  const undoLast = () => {
    setState((current) => {
      const last = current.history[current.history.length - 1];
      if (!last) return current;
      const lists = updateListsByAction(current, last.dishId, null);
      return { ...current, ...lists, history: current.history.slice(0, -1) };
    });
  };

  // Live "preview" of which action a hovered/pressed dock button implies.
  const [preview, setPreview] = useState<SwipeActionKind | null>(null);

  const sweep = (action: SwipeActionKind) => {
    if (!activeDish) return;
    setPreview(null);
    haptic(action === "like" ? [10, 30, 10] : action === "skip" ? 18 : 14);
    applySwipe(activeDish.id, action);
  };

  // Intro hint: shown only on the very first card, then permanently dismissed.
  const [introDismissed, setIntroDismissed] = useState<boolean>(() => {
    try { return window.sessionStorage.getItem("what-to-eat-intro-shown") === "1"; }
    catch { return false; }
  });
  const dismissIntro = () => {
    setIntroDismissed(true);
    try { window.sessionStorage.setItem("what-to-eat-intro-shown", "1"); }
    catch { /* ignore */ }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (state.step !== "swipe") return;
        event.preventDefault();
        undoLast();
        return;
      }
      if (state.step !== "swipe") return;
      const id = activeDishIdRef.current;
      if (!id) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); applySwipe(id, "skip"); }
      else if (event.key === "ArrowUp") { event.preventDefault(); applySwipe(id, "pending"); }
      else if (event.key === "ArrowRight") { event.preventDefault(); applySwipe(id, "like"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.history.length]);

  return {
    preview,
    setPreview,
    sweep,
    applySwipe,
    undoLast,
    introDismissed,
    dismissIntro,
  };
}
