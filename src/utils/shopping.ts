import type { Dish, IngredientCategory, ShoppingListItem } from "../types";

export const categoryLabels: Record<IngredientCategory, string> = {
  meat_egg: "肉禽蛋",
  vegetable: "蔬菜",
  seafood: "海鲜水产",
  staple: "主食",
  seasoning: "调料",
  other: "其他",
};

export const categoryOrder: IngredientCategory[] = [
  "meat_egg",
  "vegetable",
  "seafood",
  "staple",
  "seasoning",
  "other",
];

export function formatQuantity(quantity: number) {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1).replace(/\.0$/, "");
}

export function buildShoppingList(
  selectedDishes: Dish[],
  servings: number,
  checkedMap: Record<string, boolean>,
): ShoppingListItem[] {
  const merged = new Map<string, ShoppingListItem>();

  selectedDishes.forEach((dish) => {
    const ratio = servings / dish.baseServings;

    dish.ingredients.forEach((ingredient) => {
      const key = `${ingredient.ingredientId}-${ingredient.unit}`;
      const nextQuantity = ingredient.quantity * ratio;
      const current = merged.get(key);

      if (current) {
        current.quantity += nextQuantity;
        current.sourceDishIds = Array.from(new Set([...current.sourceDishIds, dish.id]));
      } else {
        merged.set(key, {
          key,
          name: ingredient.name,
          category: ingredient.category,
          quantity: nextQuantity,
          unit: ingredient.unit,
          checked: checkedMap[key] ?? false,
          sourceDishIds: [dish.id],
        });
      }
    });
  });

  return Array.from(merged.values()).sort((a, b) => {
    const categoryDelta = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    return categoryDelta || a.name.localeCompare(b.name, "zh-CN");
  });
}
