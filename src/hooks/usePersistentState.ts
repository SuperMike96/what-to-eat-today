import { useEffect, useState } from "react";
import type { AppStep, SwipeAction, UserSelection } from "../types";

export type PersistedState = UserSelection & {
  step: AppStep;
  checkedMap: Record<string, boolean>;
  recipeIndex: number;
};

export const initialState: PersistedState = {
  step: "swipe",
  selectedDishIds: [],
  pendingDishIds: [],
  skippedDishIds: [],
  history: [],
  servings: 2,
  checkedMap: {},
  recipeIndex: 0,
};

export const storageKey = "what-to-eat-web-mvp-v1";
const STEP_VALUES: AppStep[] = ["swipe", "menu", "shopping", "recipes"];

export const HISTORY_LIMIT = 50;
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 12;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      step: STEP_VALUES.includes(parsed.step as AppStep) ? (parsed.step as AppStep) : initialState.step,
      selectedDishIds: isStringArray(parsed.selectedDishIds) ? parsed.selectedDishIds : [],
      pendingDishIds: isStringArray(parsed.pendingDishIds) ? parsed.pendingDishIds : [],
      skippedDishIds: isStringArray(parsed.skippedDishIds) ? parsed.skippedDishIds : [],
      history: Array.isArray(parsed.history)
        ? parsed.history
            .filter(
              (h): h is SwipeAction =>
                !!h && typeof h.dishId === "string" && (["like", "pending", "skip"] as const).includes(h.action),
            )
            .slice(-HISTORY_LIMIT)
        : [],
      servings:
        typeof parsed.servings === "number" && parsed.servings >= MIN_SERVINGS && parsed.servings <= MAX_SERVINGS
          ? Math.round(parsed.servings)
          : initialState.servings,
      checkedMap:
        parsed.checkedMap && typeof parsed.checkedMap === "object" ? (parsed.checkedMap as Record<string, boolean>) : {},
      recipeIndex: typeof parsed.recipeIndex === "number" && parsed.recipeIndex >= 0 ? Math.floor(parsed.recipeIndex) : 0,
    };
  } catch {
    return initialState;
  }
}

function saveState(state: PersistedState) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function usePersistentState() {
  const [state, setState] = useState<PersistedState>(() => loadState());

  // Persist as a debounced side effect of state changes. Writing to
  // localStorage inside a setState updater is an anti-pattern (impure updater
  // breaks under React StrictMode double-invocation and blocks the main
  // thread) — see R2.
  useEffect(() => {
    const timer = setTimeout(() => saveState(state), 150);
    return () => clearTimeout(timer);
  }, [state]);

  return [state, setState] as const;
}
