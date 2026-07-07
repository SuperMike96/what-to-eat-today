import { dishes } from "../data/dishes";
import type { Dish, SwipeActionKind } from "../types";

export const remove = (items: string[], item: string) => items.filter((id) => id !== item);
export const addUnique = (items: string[], item: string) => (items.includes(item) ? items : [...items, item]);

export function getDishes(ids: string[]) {
  return ids.map((id) => dishes.find((dish) => dish.id === id)).filter((dish): dish is Dish => Boolean(dish));
}

export const difficultyLabel = (level: Dish["difficulty"]) =>
  level === "easy" ? "简单" : level === "medium" ? "适中" : "进阶";

// The three disjoint lists a dish can live in.
export interface DishLists {
  selectedDishIds: string[];
  pendingDishIds: string[];
  skippedDishIds: string[];
}

// Single source of truth for moving a dish between the selected / pending /
// skipped lists. `action === null` removes the dish from every list (used by
// undo) — see R8.
export function updateListsByAction(lists: DishLists, dishId: string, action: SwipeActionKind | null): DishLists {
  const next: DishLists = {
    selectedDishIds: remove(lists.selectedDishIds, dishId),
    pendingDishIds: remove(lists.pendingDishIds, dishId),
    skippedDishIds: remove(lists.skippedDishIds, dishId),
  };
  if (action === "like") next.selectedDishIds = addUnique(next.selectedDishIds, dishId);
  else if (action === "pending") next.pendingDishIds = addUnique(next.pendingDishIds, dishId);
  else if (action === "skip") next.skippedDishIds = addUnique(next.skippedDishIds, dishId);
  return next;
}
