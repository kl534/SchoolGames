import './tapmarks.css';
import { TAP_CAPTION } from './tapgate';

/** A picture that takes the caption's place above (or below) the green answer. */
export interface TapCard {
  element: HTMLElement;
  /** Called with the room it may use, whenever that changes: size yourself to fit. */
  fit(maxWidth: number, maxHeight: number): void;
}

export interface TapMarks {
  /**
   * Pulses `buttons[correctIndex]`, dims the others, shows the finger and the caption (`problem`, e.g. '5 + 5 = ?', else a tap hint). The pointer
   * keeps off the other buttons and off `avoid` (the banner, the question) when it can. With a
   * `card` the caption is hidden and the card sits there instead, above the answer when there is
   * room, sized to the room.
   */
  show(
    buttons: readonly HTMLElement[],
    correctIndex: number,
    avoid?: readonly HTMLElement[],
    problem?: string,
    card?: TapCard,
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
/** A card keeps this far below the top of the screen, or below the banner above it, plus 6. */
const CARD_TOP = 70;
/** Room above the answer (or below) a card needs to be worth showing there. */
const CARD_MIN_ROOM = 110;
const CARD_MAX_ROOM = 380;
const CARD_MAX_WIDTH = 480;
/** A card slid sideways keeps the finger at least this far inside its edge. */
const CARD_FINGER_INSET = 28;

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
  let card: TapCard | undefined;
  let lastFit = '';
  let shrunk: { key: string; height: number } | undefined;

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
    card?.element.remove();
    card = undefined;
    lastFit = '';
    shrunk = undefined;
    caption.hidden = false;
    pointer.classList.remove('sg-tap-has-card');
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

  const place = (leftPx: string, topPx: string) => {
    if (leftPx !== lastLeft) {
      pointer.style.left = leftPx;
      lastLeft = leftPx;
    }
    if (topPx !== lastTop) {
      pointer.style.top = topPx;
      lastTop = topPx;
    }
  };

  /** Positions the pointer with a card: above the button if there is room, sized to the room. */
  const updateCard = (activeCard: TapCard, button: DOMRect, viewW: number, viewH: number) => {
    const fingerHeight = finger.offsetHeight || 40;
    const width = Math.min(viewW - 2 * EDGE, CARD_MAX_WIDTH);
    const columnLeft = Math.min(
      Math.max(button.left + button.width / 2 - width / 2, EDGE),
      viewW - width - EDGE,
    );
    let topLimit = CARD_TOP;
    for (const node of avoid) {
      const r = node.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.bottom > button.top || r.height >= viewH * 0.6) continue;
      if (r.right <= columnLeft || r.left >= columnLeft + width) continue;
      topLimit = Math.max(topLimit, r.bottom);
    }
    topLimit += 6;
    const roomAbove = button.top - GAP - fingerHeight - topLimit;
    const roomBelow = viewH - EDGE - (button.bottom + GAP + fingerHeight);
    const above = roomAbove >= CARD_MIN_ROOM || roomAbove >= roomBelow;
    const room = above ? roomAbove : roomBelow;
    const maxHeight = Math.round(
      Math.min(Math.max(room, CARD_MIN_ROOM), Math.min(CARD_MAX_ROOM, viewH * 0.6)),
    );
    // A card that had to shrink to clear a banner keeps its size while the room stays the same.
    const key = `${width}x${maxHeight}`;
    const wanted = shrunk && shrunk.key === key ? shrunk.height : maxHeight;
    const fit = `${width}x${wanted}`;
    if (fit !== lastFit) {
      lastFit = fit;
      activeCard.fit(width, wanted);
    }
    const own = pointer.getBoundingClientRect();
    const left = Math.min(
      Math.max(button.left + button.width / 2 - own.width / 2, EDGE),
      Math.max(viewW - own.width - EDGE, EDGE),
    );
    const top = above ? button.top - GAP - own.height : button.bottom + GAP;
    setFinger(!above);
    place(`${Math.round(left)}px`, `${Math.round(top)}px`);

    // Slide the card (not the finger) sideways off the banner and the question.
    const blockers = avoid
      .map((node) => node.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const box = activeCard.element.getBoundingClientRect();
    const cardW = box.width || own.width;
    const cardH = box.height || Math.max(own.height - fingerHeight, 0);
    const cardLeft = left + (own.width - cardW) / 2;
    const cardTop = above ? top : top + own.height - cardH;
    const overlapAt = (dx: number) => {
      let area = 0;
      for (const r of blockers) {
        const w = Math.min(cardLeft + dx + cardW, r.right) - Math.max(cardLeft + dx, r.left);
        const h = Math.min(cardTop + cardH, r.bottom) - Math.max(cardTop, r.top);
        if (w > 0 && h > 0) area += w * h;
      }
      return area;
    };
    // The finger's centre stays this far inside the card at each side.
    const fingerX = left + own.width / 2;
    const lowest = Math.max(EDGE - cardLeft, fingerX + CARD_FINGER_INSET - (cardLeft + cardW));
    const highest = Math.min(
      viewW - EDGE - (cardLeft + cardW),
      fingerX - CARD_FINGER_INSET - cardLeft,
    );
    let shift = 0;
    let least = overlapAt(0);
    if (least > 0) {
      for (let dx = Math.ceil(lowest); dx <= highest; dx += 2) {
        const area = overlapAt(dx);
        if (area < least || (area === least && Math.abs(dx) < Math.abs(shift))) {
          least = area;
          shift = dx;
        }
      }
    }
    activeCard.element.style.translate = shift === 0 ? '' : `${shift}px 0`;
    if (least > 0 && above && wanted > CARD_MIN_ROOM && !shrunk) {
      // No offset clears it: shrink the card from the top, to no less than the minimum.
      const clearTop = Math.max(
        ...blockers
          .filter((r) => r.bottom > cardTop && r.top < cardTop + cardH)
          .map((r) => r.bottom),
      );
      const height = Math.max(Math.round(wanted - (clearTop + 4 - cardTop)), CARD_MIN_ROOM);
      if (height < wanted) {
        shrunk = { key, height };
        update();
      }
    }
  };

  const update = () => {
    if (!correct || pointer.hidden) return;
    const button = correct.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    capPulse(correct, button, viewW, viewH);
    if (card) {
      updateCard(card, button, viewW, viewH);
      return;
    }
    const own = pointer.getBoundingClientRect();
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
    place(`${Math.round(left)}px`, `${Math.round(top)}px`);
  };

  return {
    show(buttons, correctIndex, avoidElements = [], problem, newCard) {
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
      caption.textContent = newCard ? '' : problem || TAP_CAPTION;
      if (newCard) {
        card = newCard;
        caption.hidden = true;
        pointer.classList.add('sg-tap-has-card');
        pointer.insertBefore(newCard.element, finger);
      }
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
