export type IngredientCategory =
  | "meat_egg"
  | "vegetable"
  | "seafood"
  | "staple"
  | "seasoning"
  | "other";

/**
 * 独立食材实体（规范化）。
 * 当前 MVP 为了减少数据冗余，把 name/category 内联进 DishIngredient，
 * 但保留该类型以便后续接入后端食材库 / 食材搜索时复用。
 */
export type Ingredient = {
  id: string;
  name: string;
  category: IngredientCategory;
  /** 默认采购单位，用于跨菜品合并时的单位换算兜底 */
  defaultUnit: string;
};

export type Dish = {
  id: string;
  name: string;
  imageUrl: string;
  tags: string[];
  cookTimeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  description: string;
  baseServings: number;
  ingredients: DishIngredient[];
  recipe: Recipe;
};

export type DishIngredient = {
  ingredientId: string;
  name: string;
  category: IngredientCategory;
  quantity: number;
  unit: string;
};

export type UserSelection = {
  selectedDishIds: string[];
  pendingDishIds: string[];
  skippedDishIds: string[];
  history: SwipeAction[];
  servings: number;
};

export type SwipeAction = {
  dishId: string;
  action: "like" | "pending" | "skip";
  timestamp: number;
};

export type ShoppingListItem = {
  key: string;
  name: string;
  category: IngredientCategory;
  quantity: number;
  unit: string;
  checked: boolean;
  sourceDishIds: string[];
};

export type RecipeMedia =
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string; caption?: string };

export type Recipe = {
  /** 食材处理：洗、切、腌、焯水等准备工作 */
  ingredientSteps: string[];
  /** 准备步骤：调汁、备料、器具准备 */
  prepSteps: string[];
  /** 烹饪步骤：开火后的实际操作 */
  cookSteps: string[];
  /** 图文 / 视频占位，MVP 阶段可为空数组 */
  media: RecipeMedia[];
  tips: string[];
};

export type AppStep = "swipe" | "selected" | "pending" | "shopping" | "recipes";

/** 滑动动作类型，集中维护以便键盘快捷键与按钮共用 */
export type SwipeActionKind = "like" | "pending" | "skip";
