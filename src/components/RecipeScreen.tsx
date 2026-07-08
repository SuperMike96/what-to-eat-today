import type { Dish } from "../types";
import type { PersistedState } from "../hooks/usePersistentState";
import { RecipeCard } from "./RecipeCard";

export function RecipeScreen({
  dishes: selectedDishes,
  recipeIndex,
  patch,
}: {
  dishes: Dish[];
  recipeIndex: number;
  patch: (partial: Partial<PersistedState>) => void;
}) {
  const safeIndex = Math.min(recipeIndex, Math.max(selectedDishes.length - 1, 0));
  const dish = selectedDishes[safeIndex];
  const move = (delta: number) => {
    if (!selectedDishes.length) return;
    patch({ recipeIndex: (safeIndex + delta + selectedDishes.length) % selectedDishes.length });
  };

  return (
    <main className="flow-page recipe-page">
      <header className="flow-header">
        <div>
          <h1>菜谱教学</h1>
        </div>
      </header>
      {dish ? (
        <RecipeCard dish={dish} onPrev={() => move(-1)} onNext={() => move(1)} />
      ) : (
        <div className="empty-state">
          <h3>还没有可查看的菜谱</h3>
          <p>先选中几道想吃的菜，再回来查看做法。</p>
        </div>
      )}
      <div className="flow-actions">
        <button className="secondary-button" onClick={() => move(-1)} type="button" disabled={selectedDishes.length < 2}>上一道</button>
        <button className="primary-button" onClick={() => move(1)} type="button" disabled={selectedDishes.length < 2}>下一道</button>
      </div>
      {selectedDishes.length >= 2 && (
        <p className="recipe-swipe-tip" aria-hidden="true">提示：在卡片上左右滑动可快速切换菜品</p>
      )}
    </main>
  );
}
