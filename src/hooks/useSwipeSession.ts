import { useEffect, useRef, useState } from "react";
import type { Dish, SwipeActionKind } from "../types";
import type { PersistedState } from "./usePersistentState";
import { HISTORY_LIMIT } from "./usePersistentState";
import { updateListsByAction } from "../lib/dishActions";
import { haptic } from "../lib/haptics";

/**
 * Encapsulates all swipe-session logic (preview, keyboard shortcuts,
 * undo, reset, sweep) so App.tsx stays focused on layout and routing.
 */
export function useSwipeSession(
  state: PersistedState,
  setState: (updater: (current: PersistedState) => PersistedState) => void,
  remainingDishes: Dish[],
  activeDish: Dish | undefined,
) {
  const activeDishIdRef = useRef<string | undefined>(activeDish?.id);

  useEffect(() => {
    activeDishIdRef.current = activeDish?.id;
  }, [activeDish]);

  // Live preview of hovered dock button action on the card.
  const [preview, setPreview] = useState<SwipeActionKind | null>(null);

  // Intro hint: only shown on the very first card of the session.
  const [introDismissed, setIntroDismissed] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem("what-to-eat-intro-shown") === "1";
    } catch {
      return false;
    }
  });

  const dismissIntro = () => {
    setIntroDismissed(true);
    try {
      window.sessionStorage.setItem("what-to-eat-intro-shown", "1");
    } catch {
      /* ignore */
    }
  };

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

  const sweep = (action: SwipeActionKind) => {
    if (!activeDish) return;
    setPreview(null);
    haptic(action === "like" ? [10, 30, 10] : action === "skip" ? 18 : 14);
    applySwipe(activeDish.id, action);
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
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        applySwipe(id, "skip");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        applySwipe(id, "pending");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        applySwipe(id, "like");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.history.length]);

  // Progress: fraction of total dishes reviewed
  const totalDishes = remainingDishes.length + state.selectedDishIds.length + state.pendingDishIds.length + state.skippedDishIds.length;
  const reviewedCount = totalDishes - remainingDishes.length;
  const progress = totalDishes > 0 ? reviewedCount / totalDishes : 0;

  return {
    preview,
    setPreview,
    introDismissed,
    dismissIntro,
    applySwipe,
    undoLast,
    sweep,
    progress,
    reviewedCount,
    totalDishes,
  };
}

export type SwipeSession = ReturnType<typeof useSwipeSession>;
