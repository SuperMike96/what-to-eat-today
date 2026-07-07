import { PointerEvent, useRef, useState } from "react";

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
 * a swipe threshold was crossed.
 */
export function useDragGesture(onEnd: (delta: { x: number; y: number }) => void): DragGesture {
  const [drag, setDrag] = useState<DragState>({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ active: true, startX: event.clientX, startY: event.clientY, x: 0, y: 0 });
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragRef.current.active) return;
    setDrag((current) => ({ ...current, x: event.clientX - current.startX, y: event.clientY - current.startY }));
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!dragRef.current.active) return;
    const { x, y } = dragRef.current;
    setDrag({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
    onEnd({ x, y });
  };

  return { drag, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}
