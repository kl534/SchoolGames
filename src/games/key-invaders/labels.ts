/**
 * The DOM over the 3D field: one label of keys under each target (done keys green, the current key
 * yellow), and the pops of text (centre lines and points that rise). The styles are in `index.html`
 * (`ki-label`, `ki-pop`). The pure helpers (`staggerLabels`, `labelFontPx`) are tested.
 */

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP = 4;

/**
 * How far down (px) each box moves so labels side by side do not cover each other: sorted by x,
 * a box that overlaps the previous one (as it ends up) moves down by its height plus 4 px.
 */
export function staggerLabels(boxes: readonly LabelBox[]): number[] {
  const dy = boxes.map(() => 0);
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a].x - boxes[b].x || a - b);
  let prev: LabelBox | null = null;
  for (const i of order) {
    const box = boxes[i];
    if (prev) {
      const overlapX = box.x < prev.x + prev.w && prev.x < box.x + box.w;
      const overlapY = box.y < prev.y + prev.h && prev.y < box.y + box.h;
      if (overlapX && overlapY) dy[i] = box.h + GAP;
    }
    prev = { ...box, y: box.y + dy[i] };
  }
  return dy;
}

/** The label font size (px): the text fits one column pitch (`pitchPx`), between 13 and 22 px. */
export function labelFontPx(pitchPx: number, chars: number): number {
  const fit = Math.round((pitchPx * 0.95) / (chars * 0.62 + 0.8));
  return Math.min(Math.max(fit, 13), 22);
}

const SPACE_GLYPH = '␣';

export interface LabelState {
  /** Keys done. */
  typed: number;
  locked: boolean;
  /** The current key was typed wrong: it flashes red and the label shakes. */
  wrong: boolean;
}

export interface Label {
  readonly element: HTMLElement;
  readonly text: string;
  /** Size in px as laid out (measured when the text or font changes). */
  readonly width: number;
  readonly height: number;
  setState(state: LabelState): void;
  setFont(px: number): void;
  /** Flashes the current key red and shakes for 250 ms (`hold` keeps the red). */
  flashWrong(hold?: boolean): void;
  /** Moves the label so its top-left is at (x, y) px. */
  place(x: number, y: number): void;
  remove(): void;
}

/** Makes one label for `text` (the chunk and its closing space) with a border of `color`. */
export function createLabel(root: HTMLElement, text: string, color: string): Label {
  const element = document.createElement('div');
  element.className = 'ki-label';
  element.style.setProperty('--ki-color', color);
  const chars: HTMLSpanElement[] = [];
  for (const char of text) {
    const span = document.createElement('span');
    span.textContent = char === ' ' ? SPACE_GLYPH : char;
    if (char === ' ') span.className = 'ki-space';
    element.appendChild(span);
    chars.push(span);
  }
  root.appendChild(element);

  let state: LabelState = { typed: 0, locked: false, wrong: false };
  let width = 0;
  let height = 0;
  let wrongTimer: ReturnType<typeof setTimeout> | undefined;
  const measure = () => {
    width = element.offsetWidth;
    height = element.offsetHeight;
  };

  const paint = () => {
    chars.forEach((span, i) => {
      const done = i < state.typed;
      const current = state.locked && i === state.typed;
      span.dataset.state = done ? 'done' : current ? (state.wrong ? 'wrong' : 'current') : 'todo';
    });
    element.dataset.locked = state.locked ? '1' : '';
    element.dataset.wrong = state.wrong ? '1' : '';
  };
  paint();

  return {
    element,
    text,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    setState(next) {
      state = next;
      paint();
    },
    setFont(px) {
      element.style.fontSize = `${px}px`;
      measure();
    },
    flashWrong(hold = false) {
      state = { ...state, wrong: true };
      paint();
      element.classList.remove('ki-shake');
      void element.offsetWidth;
      element.classList.add('ki-shake');
      clearTimeout(wrongTimer);
      if (!hold) {
        wrongTimer = setTimeout(() => {
          state = { ...state, wrong: false };
          paint();
          element.classList.remove('ki-shake');
        }, 250);
      }
    },
    place(x, y) {
      element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    },
    remove() {
      clearTimeout(wrongTimer);
      element.remove();
    },
  };
}

export interface Pops {
  /** A line in the middle of the field (28 px, 1.2 s). */
  centre(text: string, color?: string): void;
  /** Points that rise 30 px from (x, y) in 0.8 s. */
  rise(text: string, x: number, y: number, color?: string): void;
  dispose(): void;
}

/** The pops of text over the scene; each removes itself when its animation ends. */
export function createPops(root: HTMLElement): Pops {
  const layer = document.createElement('div');
  layer.className = 'ki-pops';
  root.appendChild(layer);
  const add = (cls: string, text: string, color: string | undefined, seconds: number) => {
    const node = document.createElement('div');
    node.className = cls;
    node.textContent = text;
    if (color) node.style.color = color;
    layer.appendChild(node);
    setTimeout(() => node.remove(), seconds * 1000 + 100);
    return node;
  };
  return {
    centre(text, color) {
      // Lines already up move on up so two never sit on top of each other.
      for (const old of layer.querySelectorAll<HTMLElement>('.ki-pop-centre')) {
        old.style.marginTop = `${(parseFloat(old.style.marginTop || '0') || 0) - 40}px`;
      }
      add('ki-pop ki-pop-centre', text, color, 1.2);
    },
    rise(text, x, y, color) {
      const node = add('ki-pop ki-pop-score', text, color, 0.8);
      node.style.left = `${x.toFixed(1)}px`;
      node.style.top = `${y.toFixed(1)}px`;
    },
    dispose() {
      layer.remove();
    },
  };
}
