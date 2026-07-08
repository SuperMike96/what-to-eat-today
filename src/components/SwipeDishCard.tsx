import { useRef, useState } from "react";
import type { Dish, SwipeActionKind } from "../types";
import { useDragGesture } from "../hooks/useDragGesture";
import { SWIPE_THRESHOLD, STAMP_THRESHOLD } from "../lib/constants";
import { handleImageError } from "../lib/image";
import { haptic } from "../lib/haptics";

type Stamp = { kind: SwipeActionKind; opacity: number };

const STAMP_STYLE: Record<SwipeActionKind, { label: string; tint: string }> = {
  like: { label: "想吃", tint: "rgba(69, 212, 131, 0.55)" },
  skip: { label: "跳过", tint: "rgba(255, 119, 95, 0.55)" },
  pending: { label: "待定", tint: "rgba(255, 194, 75, 0.55)" },
};

export function SwipeDishCard({
  dish,
  onSwipe,
  preview = null,
}: {
  dish: Dish;
  onSwipe: (action: SwipeActionKind) => void;
  preview?: SwipeActionKind | null;
}) {
  const [resting, setResting] = useState(true);
  // When a swipe commits we play a fly-out animation, THEN notify the parent
  // so the next card mounts (R19).
  const [flying, setFlying] = useState<null | { x: number; y: number; rot: number }>(null);
  const tickedRef = useRef(false);

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
      // A single subtle "tock" the moment the drag passes the reveal
      // threshold — tactile confirmation that a direction is now locked in.
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

  // Dominant drag direction → stamp kind + progress (0..1). Replaces the old
  // all-or-nothing reveal so the stamp fades in proportionally to drag depth.
  let stamp: Stamp = { kind: "like", opacity: 0 };
  if (moving) {
    if (absX > absY && drag.x > 0) stamp = { kind: "like", opacity: Math.min(1, drag.x / SWIPE_THRESHOLD) };
    else if (absX > absY && drag.x < 0) stamp = { kind: "skip", opacity: Math.min(1, absX / SWIPE_THRESHOLD) };
    else if (drag.y < 0) stamp = { kind: "pending", opacity: Math.min(1, absY / STAMP_THRESHOLD) };
  } else if (preview) {
    // Hovering an action button previews its stamp on the card (Tinder-style).
    stamp = { kind: preview, opacity: 0.9 };
  }

  const progress = stamp.opacity;
  const tint = STAMP_STYLE[stamp.kind].tint;
  const dragShadow = `0 0 0 3px ${tint}, 0 ${20 + progress * 46}px ${50 + progress * 70}px rgba(79, 53, 28, ${
    0.18 + progress * 0.22
  })`;
  const previewShadow = `0 0 0 3px ${tint}, var(--shadow)`;

  // Position the card: follow the finger while dragging, otherwise nudge
  // slightly toward the previewed action so the button feels connected.
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

  return (
    <article
      className={`dish-card${moving ? " dragging" : resting ? " resting" : ""}${flying ? " flying" : ""}`}
      style={style}
      onPointerDown={(event) => {
        setResting(false);
        gesture.onPointerDown(event);
      }}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
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
          <span>
            {dish.difficulty === "easy" ? "简单" : dish.difficulty === "medium" ? "适中" : "进阶"}
          </span>
        </div>
      </div>
    </article>
  );
}
