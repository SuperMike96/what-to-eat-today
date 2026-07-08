import { useState } from "react";
import type { Dish } from "../types";
import { useDragGesture } from "../hooks/useDragGesture";
import { SWIPE_THRESHOLD, STAMP_THRESHOLD } from "../lib/constants";
import { handleImageError } from "../lib/image";
import { RecipeSection } from "./RecipeSection";
import { RecipeMediaBlock } from "./RecipeMediaBlock";

export function RecipeCard({
  dish,
  onPrev,
  onNext,
}: {
  dish: Dish;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [resting, setResting] = useState(true);
  const gesture = useDragGesture(({ x }) => {
    setResting(true);
    if (x < -SWIPE_THRESHOLD) onNext();
    else if (x > SWIPE_THRESHOLD) onPrev();
  });

  const { drag } = gesture;
  const dragHint =
    drag.active && Math.abs(drag.x) > STAMP_THRESHOLD ? (drag.x < 0 ? "下一道 →" : "← 上一道") : "";

  return (
    <article
      className={`recipe-card ${drag.active ? "dragging" : resting ? "resting" : ""}`}
      onPointerDown={(event) => {
        setResting(false);
        gesture.onPointerDown(event);
      }}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
      onPointerCancel={gesture.onPointerCancel}
    >
      <img src={dish.imageUrl} alt={dish.name} draggable={false} onError={handleImageError} />
      <div className="recipe-content">
        <div className="recipe-title-row">
          <div>
            <h2>{dish.name}</h2>
            <p>{dish.description}</p>
          </div>
        </div>
        <RecipeSection title="食材处理">
          <ol>{dish.recipe.ingredientSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </RecipeSection>
        <RecipeSection title="准备步骤">
          <ol>{dish.recipe.prepSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </RecipeSection>
        <RecipeSection title="烹饪步骤">
          <ol>{dish.recipe.cookSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </RecipeSection>
        {dish.recipe.media.length > 0 && (
          <RecipeSection title="图文 / 视频">
            <RecipeMediaBlock media={dish.recipe.media} />
          </RecipeSection>
        )}
        {dish.recipe.tips.length > 0 && (
          <RecipeSection title="小贴士">
            <ul>{dish.recipe.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
          </RecipeSection>
        )}
      </div>
      {dragHint ? <div className={`recipe-swipe-hint ${drag.x < 0 ? "next" : "prev"}`}>{dragHint}</div> : null}
    </article>
  );
}
