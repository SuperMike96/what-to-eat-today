import { PointerEvent, useEffect, useRef, useState } from "react";

export interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

export interface DragGesture {
  drag: DragState;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

/**
 * Shared pointer-drag helper used by the swipe and recipe cards so the
 * boilerplate (pointer capture, delta tracking, cancel handling) lives in one
 * place. `onEnd` receives the final {x, y} delta; callers decide there whether
 * a swipe threshold was crossed. `onMove` (optional) fires on every pointer
 * move with the live delta — used for progress visuals and mid-drag haptics.
 */
export function useDragGesture(
  onEnd: (delta: { x: number; y: number }) => void,
  onMove?: (delta: { x: number; y: number }) => void,
): DragGesture {
  const [drag, setDrag] = useState<DragState>({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
  const dragRef = useRef(drag);
  // Mirror drag into a ref so event handlers read the latest value without
  // re-binding. Updated in an effect (not during render) per react-hooks/refs.
  useEffect(() => {
    dragRef.current = drag;
  });

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ active: true, startX: event.clientX, startY: event.clientY, x: 0, y: 0 });
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragRef.current.active) return;
    const base = dragRef.current;
    const next = { ...base, x: event.clientX - base.startX, y: event.clientY - base.startY };
    setDrag(next);
    onMove?.({ x: next.x, y: next.y });
  };

  const onPointerUp = () => {
    if (!dragRef.current.active) return;
    const { x, y } = dragRef.current;
    setDrag({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
    onEnd({ x, y });
  };

  return { drag, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}
