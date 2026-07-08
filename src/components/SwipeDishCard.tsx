import { useEffect, useRef, useState } from "react";
import type { Dish, SwipeActionKind } from "../types";
import { useDragGesture } from "../hooks/useDragGesture";
import { SWIPE_THRESHOLD, STAMP_THRESHOLD } from "../lib/constants";
import { handleImageError } from "../lib/image";
import { haptic } from "../lib/haptics";

type Stamp = { kind: SwipeActionKind; opacity: number };

const STAMP_STYLE: Record<SwipeActionKind, { label: string; tint: string }> = {
  like: { label: "想吃", tint: "rgba(69, 212, 131, 0.55)" },
  skip: { label: "不吃", tint: "rgba(255, 119, 95, 0.55)" },
  pending: { label: "待定", tint: "rgba(255, 194, 75, 0.55)" },
};

export function SwipeDishCard({
  dish,
  onSwipe,
  preview = null,
  showIntro = false,
  onIntroDismiss,
}: {
  dish: Dish;
  onSwipe: (action: SwipeActionKind) => void;
  preview?: SwipeActionKind | null;
  showIntro?: boolean;
  onIntroDismiss?: () => void;
}) {
  const [resting, setResting] = useState(true);
  const [flying, setFlying] = useState<null | { x: number; y: number; rot: number }>(null);
  const [showHint, setShowHint] = useState(showIntro);
  const [expanded, setExpanded] = useState(false);
  const tickedRef = useRef(false);
  const maxDragRef = useRef(0);

  const commit = (action: SwipeActionKind) => {
    const offX = action === "like" ? window.innerWidth : action === "skip" ? -window.innerWidth : 0;
    const offY = action === "pending" ? -window.innerHeight : 0;
    setFlying({ x: offX, y: offY, rot: offX / 18 });
    haptic(action === "like" ? [10, 30, 10] : action === "skip" ? 18 : 14);
    window.setTimeout(() => onSwipe(action), 260);
  };

  const gesture = useDragGesture(
    ({ x, y }) => {
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
      setResting(false);
      commit(action);
    },
    ({ x, y }) => {
      maxDragRef.current = Math.max(maxDragRef.current, Math.abs(x) + Math.abs(y));
      const passed = Math.max(Math.abs(x), Math.abs(y)) > STAMP_THRESHOLD;
      if (passed && !tickedRef.current) {
        tickedRef.current = true;
        haptic(8);
      } else if (!passed) {
        tickedRef.current = false;
      }
    },
  );

  const { drag } = gesture;
  const moving = drag.active;
  const absX = Math.abs(drag.x);
  const absY = Math.abs(drag.y);

  let stamp: Stamp = { kind: "like", opacity: 0 };
  if (moving) {
    if (absX > absY && drag.x > 0) stamp = { kind: "like", opacity: Math.min(1, drag.x / SWIPE_THRESHOLD) };
    else if (absX > absY && drag.x < 0) stamp = { kind: "skip", opacity: Math.min(1, absX / SWIPE_THRESHOLD) };
    // Upward swipe still triggers "pending" but no stamp is shown
  } else if (preview) {
    stamp = { kind: preview, opacity: 0.9 };
  }

  const progress = stamp.opacity;
  const tint = STAMP_STYLE[stamp.kind].tint;
  const dragShadow = `0 0 0 3px ${tint}, 0 ${20 + progress * 46}px ${50 + progress * 70}px rgba(79, 53, 28, ${
    0.18 + progress * 0.22
  })`;
  const previewShadow = `0 0 0 3px ${tint}, var(--shadow)`;

  const px = moving ? drag.x : preview === "like" ? 18 : preview === "skip" ? -18 : 0;
  const py = moving ? drag.y : preview === "pending" ? -16 : 0;
  const prot = moving ? drag.x / 16 : preview === "like" ? 3 : preview === "skip" ? -3 : 0;

  const style = flying
    ? {
        transform: `translate(${flying.x}px, ${flying.y}px) rotate(${flying.rot}deg) scale(0.94)`,
        opacity: 0,
        transition: "transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 280ms ease",
      }
    : {
        transform: `translate(${px}px, ${py}px) rotate(${prot}deg)`,
        ...(moving ? { boxShadow: dragShadow } : preview ? { boxShadow: previewShadow } : null),
      };

  const dismissHint = () => {
    if (showHint) {
      onIntroDismiss?.();
      setShowHint(false);
    }
  };

  useEffect(() => {
    if (!showHint) return;
    const timer = window.setTimeout(() => {
      onIntroDismiss?.();
      setShowHint(false);
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [showHint, onIntroDismiss]);

  return (
    <article
      className={`dish-card${moving ? " dragging" : resting ? " resting" : ""}${flying ? " flying" : ""}`}
      style={style}
      onPointerDown={(event) => {
        setResting(false);
        dismissHint();
        maxDragRef.current = 0;
        gesture.onPointerDown(event);
      }}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={(event) => {
        if (!flying && maxDragRef.current < 10) {
          setExpanded((prev) => !prev);
        }
        gesture.onPointerUp(event);
      }}
      onPointerCancel={gesture.onPointerCancel}
    >
      <img
        className="dish-card-image"
        src={dish.imageUrl}
        alt={dish.name}
        loading="lazy"
        draggable={false}
        onError={handleImageError}
      />
      {stamp.opacity > 0.04 && (
        <div className={`swipe-stamp ${stamp.kind}`} style={{ opacity: Math.max(0.15, stamp.opacity) }}>
          {STAMP_STYLE[stamp.kind].label}
        </div>
      )}
      {showHint && !flying && (
        <div className="swipe-hint" aria-hidden="true">
          <span className="hint-chevron left">‹</span>
          <span className="hint-text">拖动卡片 · 右滑想吃 / 左滑不吃</span>
          <span className="hint-chevron right">›</span>
        </div>
      )}

      {expanded && !flying && (
        <div className="dish-card-detail">
          <h3>食材 ({dish.baseServings} 人份)</h3>
          <ul>
            {dish.ingredients.map((ing) => (
              <li key={ing.ingredientId}>{ing.name} {ing.quantity}{ing.unit}</li>
            ))}
          </ul>
          <h3>烹饪步骤</h3>
          <ol>
            {dish.recipe.cookSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {dish.recipe.tips.length > 0 && (
            <>
              <h3>小贴士</h3>
              <ul>
                {dish.recipe.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </>
          )}
          <p className="detail-tap-hint">点击卡片关闭</p>
        </div>
      )}

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
        </div>
        {!expanded && (
          <div className="card-actions" aria-label="菜品操作">
            <button
              className="round-action skip"
              type="button"
              aria-label="不吃"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={() => commit("skip")}
            >
              <span>不吃</span>
            </button>
            <button
              className="round-action like"
              type="button"
              aria-label="想吃"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={() => commit("like")}
            >
              <span>想吃</span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
