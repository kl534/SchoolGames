export type GestureKind = 'tap' | 'swipe';
export type Direction = 'left' | 'right' | 'up' | 'down';

export interface Gesture {
  kind: GestureKind;
  dx: number;
  dy: number;
  distance: number;
  duration: number;
  /** Pixels per millisecond. */
  velocity: number;
  direction: Direction | null;
}

export interface GestureThresholds {
  /** Max movement (px) still counted as a tap. */
  tapMaxDistance: number;
  /** Max duration (ms) still counted as a tap. */
  tapMaxDuration: number;
}

export const DEFAULT_THRESHOLDS: GestureThresholds = { tapMaxDistance: 10, tapMaxDuration: 300 };

/** Pure classification of a finished pointer stroke. */
export function classifyGesture(
  dx: number,
  dy: number,
  duration: number,
  thresholds: GestureThresholds = DEFAULT_THRESHOLDS,
): Gesture {
  const distance = Math.hypot(dx, dy);
  const isTap = distance <= thresholds.tapMaxDistance && duration <= thresholds.tapMaxDuration;
  const direction: Direction | null = isTap
    ? null
    : Math.abs(dx) >= Math.abs(dy)
      ? dx >= 0
        ? 'right'
        : 'left'
      : dy >= 0
        ? 'down'
        : 'up';
  return {
    kind: isTap ? 'tap' : 'swipe',
    dx,
    dy,
    distance,
    duration,
    velocity: duration > 0 ? distance / duration : 0,
    direction,
  };
}

/**
 * Runs `handler` as soon as a button is pressed, rather than on `click`. A click is lost
 * when the finger slides (the browser turns it into a pan) or lifts just off the edge,
 * which young players do a lot. Enter/Space still work. Returns a cleanup function.
 */
export function onPress(element: HTMLElement, handler: () => void): () => void {
  const onDown = (e: PointerEvent) => {
    if (e.isPrimary && e.button === 0) handler();
  };
  // Keyboard activation fires a click with detail 0; pointer clicks were handled on press.
  const onClick = (e: MouseEvent) => {
    if (e.detail === 0) handler();
  };
  element.addEventListener('pointerdown', onDown);
  element.addEventListener('click', onClick);
  return () => {
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('click', onClick);
  };
}

export interface DragState {
  x: number;
  y: number;
  /** Movement since the previous event. */
  dx: number;
  dy: number;
  /** Movement since pointer down. */
  totalDx: number;
  totalDy: number;
}

export interface PointerHandlers {
  onTap?: (gesture: Gesture, x: number, y: number) => void;
  onSwipe?: (gesture: Gesture, x: number, y: number) => void;
  onDragStart?: (state: DragState) => void;
  onDrag?: (state: DragState) => void;
  onDragEnd?: (state: DragState, gesture: Gesture) => void;
}

/**
 * Unified tap/swipe/drag handling for touch and mouse via Pointer Events.
 * Returns a cleanup function.
 */
export function createPointerInput(
  element: HTMLElement,
  handlers: PointerHandlers,
  thresholds: GestureThresholds = DEFAULT_THRESHOLDS,
): () => void {
  const previousTouchAction = element.style.touchAction;
  element.style.touchAction = 'none';

  let activeId: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let startTime = 0;

  const state = (x: number, y: number): DragState => ({
    x,
    y,
    dx: x - lastX,
    dy: y - lastY,
    totalDx: x - startX,
    totalDy: y - startY,
  });

  const onDown = (e: PointerEvent) => {
    if (activeId !== null) return;
    activeId = e.pointerId;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    startTime = e.timeStamp;
    element.setPointerCapture?.(e.pointerId);
    handlers.onDragStart?.(state(e.clientX, e.clientY));
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    handlers.onDrag?.(state(e.clientX, e.clientY));
    lastX = e.clientX;
    lastY = e.clientY;
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    const gesture = classifyGesture(
      e.clientX - startX,
      e.clientY - startY,
      e.timeStamp - startTime,
      thresholds,
    );
    handlers.onDragEnd?.(state(e.clientX, e.clientY), gesture);
    if (gesture.kind === 'tap') handlers.onTap?.(gesture, e.clientX, e.clientY);
    else handlers.onSwipe?.(gesture, e.clientX, e.clientY);
  };

  const onCancel = (e: PointerEvent) => {
    if (e.pointerId === activeId) activeId = null;
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onCancel);

  return () => {
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onCancel);
    element.style.touchAction = previousTouchAction;
  };
}
