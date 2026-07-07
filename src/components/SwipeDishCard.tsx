import { useState } from "react";
import type { Dish, SwipeActionKind } from "../types";
import { useDragGesture } from "../hooks/useDragGesture";
import { SWIPE_THRESHOLD, STAMP_THRESHOLD } from "../lib/constants";
import { handleImageError } from "../lib/image";

export function SwipeDishCard({ dish, onSwipe }: { dish: Dish; onSwipe: (action: SwipeActionKind) => void }) {
  const [resting, setResting] = useState(true);
  // When a swipe commits we play a fly-out animation, THEN notify the parent
  // so the next card mounts — R19.
  const [flying, setFlying] = useState<null | { x: number; y: number; rot: number }>(null);

  const gesture = useDragGesture(({ x, y }) => {
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    let action: SwipeActionKind | null = null;
    if (absX > absY && x > SWIPE_THRESHOLD) action = "like";
    else if (absX > absY && x < -SWIPE_THRESHOLD) action = "skip";
    else if (y < -STAMP_THRESHOLD) action = "pending";
    if (!action) {
      setResting(true);
      return;
    }
    const offX = action === "like" ? window.innerWidth : action === "skip" ? -window.innerWidth : 0;
    const offY = action === "pending" ? -window.innerHeight : 0;
    setFlying({ x: offX, y: offY, rot: offX / 18 });
    window.setTimeout(() => onSwipe(action), 260);
  });

  const { drag } = gesture;
  const absX = Math.abs(drag.x);
  const absY = Math.abs(drag.y);
  const label =
    absX > absY && drag.x > STAMP_THRESHOLD
      ? "想吃"
      : absX > absY && drag.x < -STAMP_THRESHOLD
        ? "跳过"
        : drag.y < -STAMP_THRESHOLD
          ? "待定"
          : "";
  const labelClass = label === "想吃" ? "like" : label === "跳过" ? "skip" : label === "待定" ? "pending" : "";

  // R5: a single style branch — the old ternary returned the identical object
  // for both states (dead code).
  const style = flying
    ? {
        transform: `translate(${flying.x}px, ${flying.y}px) rotate(${flying.rot}deg)`,
        opacity: 0,
        transition: "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 260ms ease",
      }
    : { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)` };

  return (
    <article
      className={`dish-card ${drag.active ? "dragging" : resting ? "resting" : ""}`}
      style={style}
      onPointerDown={(event) => {
        setResting(false);
        gesture.onPointerDown(event);
      }}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
      onPointerCancel={gesture.onPointerCancel}
    >
      <img className="dish-card-image" src={dish.imageUrl} alt={dish.name} loading="lazy" draggable={false} onError={handleImageError} />
      {label ? <div className={`swipe-stamp ${labelClass}`}>{label}</div> : null}
      <div className="dish-card-content">
        <div className="dish-tags">
          {dish.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <h2>{dish.name}</h2>
        <p>{dish.description}</p>
        <div className="dish-meta">
          <span>{dish.cookTimeMinutes} 分钟</span>
          <span>{dish.difficulty === "easy" ? "简单" : dish.difficulty === "medium" ? "适中" : "进阶"}</span>
        </div>
      </div>
    </article>
  );
}
