import './tapmarks.css';
import { TAP_CAPTION } from './tapgate';

export interface TapMarks {
  /**
   * Pulses `buttons[correctIndex]`, dims the others, shows the finger and the caption (`problem`, e.g. '5 + 5 = ?', else a tap hint). The pointer
   * keeps off the other buttons and off `avoid` (the banner, the question) when it can.
   */
  show(
    buttons: readonly HTMLElement[],
    correctIndex: number,
    avoid?: readonly HTMLElement[],
    problem?: string,
  ): void;
  /** A dim answer was tapped: it shakes, the green one pulses harder for ~1 s. */
  nope(index: number): void;
  /** A reminder is due: the pulse grows one step (up to 3 steps). */
  nudge(step: number): void;
  /** Call every frame while shown: keeps the finger and caption on the (maybe moving) button. */
  update(): void;
  /** Removes every mark this module added and hides the finger and caption. */
  clear(): void;
  dispose(): void;
}

const MAX_STEP = 3;
const NOPE_MS = 300;
const HINT_MS = 1000;
/** Gap between the pointer and the button it points at. */
const GAP = 6;
/** The pointer stays this far inside the screen sideways. */
const EDGE = 8;
/** The pulsing button keeps this far inside the screen at its biggest. */
const PULSE_MARGIN = 4;

/** Do two rectangles share any area (a hair of overlap is ignored)? */
function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
  );
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const MARK_CLASSES = [
  'sg-tap-correct',
  'sg-tap-dim',
  'sg-tap-nope',
  'sg-tap-hint',
  ...Array.from({ length: MAX_STEP }, (_, i) => `sg-tap-step-${i + 1}`),
];

export function createTapMarks(container: HTMLElement = document.body): TapMarks {
  const pointer = document.createElement('div');
  pointer.className = 'sg-tap-pointer';
  pointer.hidden = true;
  pointer.style.pointerEvents = 'none';
  const caption = document.createElement('div');
  caption.className = 'sg-tap-caption';
  caption.setAttribute('role', 'status');
  caption.setAttribute('aria-live', 'polite');
  const finger = document.createElement('div');
  finger.className = 'sg-tap-finger';
  finger.setAttribute('aria-hidden', 'true');
  pointer.append(caption, finger);
  container.appendChild(pointer);

  /** Every button we touched, with the `aria-disabled` it had before (null: none). */
  let touched: { button: HTMLElement; ariaDisabled: string | null }[] = [];
  let correct: HTMLElement | undefined;
  let avoid: readonly HTMLElement[] = [];
  let lastCap = '';
  let nopeTimer: ReturnType<typeof setTimeout> | undefined;
  let nopeButton: HTMLElement | undefined;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  let shownBelow: boolean | undefined;
  let lastLeft = '';
  let lastTop = '';

  const setFinger = (below: boolean) => {
    if (shownBelow === below) return;
    shownBelow = below;
    pointer.classList.toggle('sg-tap-below', below);
    finger.textContent = below ? '👆' : '👇';
  };

  /** Restarts a class's CSS animation, so a second tap shakes again. */
  const retrigger = (node: HTMLElement, name: string) => {
    node.classList.remove(name);
    void node.offsetWidth;
    node.classList.add(name);
  };

  const clearTimers = () => {
    clearTimeout(nopeTimer);
    clearTimeout(hintTimer);
    nopeTimer = undefined;
    hintTimer = undefined;
  };

  const clear = () => {
    clearTimers();
    for (const { button, ariaDisabled } of touched) {
      button.classList.remove(...MARK_CLASSES);
      if (ariaDisabled === null) button.removeAttribute('aria-disabled');
      else button.setAttribute('aria-disabled', ariaDisabled);
    }
    correct?.style.removeProperty('--sg-tap-cap');
    touched = [];
    correct = undefined;
    avoid = [];
    lastCap = '';
    pointer.hidden = true;
  };

  /** The biggest the pulse may grow before the button would leave the screen. */
  const capPulse = (target: HTMLElement, rect: DOMRect, viewW: number, viewH: number) => {
    // Layout size, which the pulse (a transform) does not change; the pulse grows around the centre.
    const w = target.offsetWidth;
    const h = target.offsetHeight;
    if (!w || !h) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const room = Math.min(
      ((Math.min(cx, viewW - cx) - PULSE_MARGIN) * 2) / w,
      ((Math.min(cy, viewH - cy) - PULSE_MARGIN) * 2) / h,
    );
    const cap = Math.max(1, room).toFixed(3);
    if (cap === lastCap) return;
    lastCap = cap;
    target.style.setProperty('--sg-tap-cap', cap);
  };

  const update = () => {
    if (!correct || pointer.hidden) return;
    const button = correct.getBoundingClientRect();
    const own = pointer.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    capPulse(correct, button, viewW, viewH);
    const left = Math.min(
      Math.max(button.left + button.width / 2 - own.width / 2, EDGE),
      Math.max(viewW - own.width - EDGE, EDGE),
    );
    const above = button.top - GAP - own.height;
    const below = button.bottom + GAP;
    const blockers = [...touched.map((t) => t.button).filter((b) => b !== correct), ...avoid]
      .map((node) => node.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const isClear = (top: number) =>
      !blockers.some((b) =>
        overlaps({ left, top, right: left + own.width, bottom: top + own.height }, b),
      );
    // Too high means it would run into the top bar and the question.
    const tooHigh = above < Math.max(120, viewH * 0.15);
    const fitsBelow = below + own.height <= viewH;
    // Above the button if that is clear; else below it if that is clear; else, with both blocked,
    // above, unless that runs into the top bar and there is room below.
    const useBelow =
      !tooHigh && isClear(above)
        ? false
        : fitsBelow && isClear(below)
          ? true
          : tooHigh && fitsBelow;
    const top = useBelow ? below : above;
    setFinger(useBelow);
    const leftPx = `${Math.round(left)}px`;
    const topPx = `${Math.round(top)}px`;
    if (leftPx !== lastLeft) {
      pointer.style.left = leftPx;
      lastLeft = leftPx;
    }
    if (topPx !== lastTop) {
      pointer.style.top = topPx;
      lastTop = topPx;
    }
  };

  return {
    show(buttons, correctIndex, avoidElements = [], problem) {
      clear();
      avoid = avoidElements;
      touched = buttons.map((button) => ({
        button,
        ariaDisabled: button.getAttribute('aria-disabled'),
      }));
      correct = buttons[correctIndex];
      for (const { button } of touched) {
        if (button === correct) {
          button.classList.add('sg-tap-correct');
          button.removeAttribute('aria-disabled');
        } else {
          button.classList.add('sg-tap-dim');
          button.setAttribute('aria-disabled', 'true');
        }
      }
      caption.textContent = problem || TAP_CAPTION;
      pointer.hidden = false;
      shownBelow = undefined;
      update();
    },
    nope(index) {
      const button = touched[index]?.button;
      if (!button || button === correct) return;
      nopeButton?.classList.remove('sg-tap-nope');
      nopeButton = button;
      retrigger(button, 'sg-tap-nope');
      clearTimeout(nopeTimer);
      nopeTimer = setTimeout(() => button.classList.remove('sg-tap-nope'), NOPE_MS);
      if (correct) {
        const target = correct;
        target.classList.add('sg-tap-hint');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => target.classList.remove('sg-tap-hint'), HINT_MS);
      }
    },
    nudge(step) {
      if (!correct) return;
      const level = Math.min(Math.max(Math.round(step), 1), MAX_STEP);
      for (let i = 1; i <= MAX_STEP; i++) correct.classList.remove(`sg-tap-step-${i}`);
      correct.classList.add(`sg-tap-step-${level}`);
    },
    update,
    clear,
    dispose() {
      clear();
      pointer.remove();
    },
  };
}
