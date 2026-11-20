/**
 * The keyboard picture: an SVG of the US keyboard that can light a key in its finger's colour,
 * flash it green or red and, with `hands`, show two hands on the home row whose fingers reach
 * for the lit key.
 */
import './typing.css';
import {
  FINGER_COLORS,
  FINGERS,
  fingerColor,
  fingerOf,
  HOME,
  KEYBOARD_HEIGHT,
  KEYBOARD_WIDTH,
  keyById,
  keyCenter,
  KEYS,
  keyFor,
  NON_TYPING,
  reachPhase,
  shiftKeyFor,
  type Finger,
  type KeyDef,
} from './keyboard-layout';

const NS = 'http://www.w3.org/2000/svg';
const SKIN = '#f5c9a5';
const KEY_FILL = '#1e293b';
const GREY_FILL = '#334155';
const LABEL = '#e2e8f0';
const GREY_LABEL = '#94a3b8';
const DARK = '#0f172a';
const RIGHT = '#22c55e';
const WRONG = '#ef4444';
const FINGER_WIDTH = 0.55;
/** A finger's knuckle sits this far below its home key's centre. */
const KNUCKLE_DROP = 1.3;
const HANDS_HEIGHT = 5.9;
const FLASH_MS = 250;

export interface KeyTint {
  fill: string;
  label: string;
  ring?: string;
}

export interface Keyboard {
  /** Put this where the keyboard goes; it fills the width it is given. */
  readonly element: HTMLElement;
  /** Lights the key for `char` in its finger's colour (and the Shift key it needs); null clears. */
  light(char: string | null): void;
  /** Flashes a key green or red for 0.25 s (or until the next flash with `hold`). */
  flash(char: string, kind: 'right' | 'wrong', hold?: boolean): void;
  /** Fades the whole keyboard to a faint outline. */
  setFaint(faint: boolean): void;
  /** Poses the hands `t` seconds into the loop of reaching for `char`; null puts them on the home row. */
  reach(char: string | null, t: number): void;
  /** Makes these keys pulse (and fill in their finger colour); null stops. */
  pulse(chars: string[] | null): void;
  /** Colours keys by id under any light, pulse or flash; null clears. */
  tint(tints: Record<string, KeyTint> | null): void;
  /** Shows or hides the Caps Lock pill. */
  setCaps(on: boolean): void;
  dispose(): void;
}

function svg(tag: string, attrs: Record<string, string | number>, parent?: Element): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

interface Point {
  x: number;
  y: number;
}

const lerp = (a: Point, b: Point, p: number): Point => ({
  x: a.x + (b.x - a.x) * p,
  y: a.y + (b.y - a.y) * p,
});

/** A key by char, or null for a char the keyboard has no key for. */
function safeKey(char: string): KeyDef | null {
  try {
    return keyFor(char);
  } catch {
    return null;
  }
}

interface Limb {
  knuckle: Point;
  rest: Point;
  skin: SVGElement;
  lit: SVGElement;
}

export function createKeyboard(o: { hands: boolean }): Keyboard {
  const root = document.createElement('div');
  root.className = 'tk';
  const canvas = svg('svg', {
    viewBox: `0 0 ${KEYBOARD_WIDTH} ${o.hands ? HANDS_HEIGHT : KEYBOARD_HEIGHT}`,
    class: 'tk-svg',
    'aria-hidden': 'true',
  });
  root.appendChild(canvas);
  const pill = document.createElement('div');
  pill.className = 'tk-caps';
  pill.textContent = 'Caps Lock is on';
  pill.hidden = true;
  root.appendChild(pill);

  // Key caps, then the hands over them, then the labels over the hands.
  const rects = new Map<string, SVGElement>();
  const labels = new Map<string, SVGElement[]>();
  const capLayer = svg('g', {}, canvas);
  for (const key of KEYS) {
    const grey = NON_TYPING.has(key.id);
    rects.set(
      key.id,
      svg(
        'rect',
        {
          x: key.x + 0.05,
          y: key.y + 0.05,
          width: key.w - 0.1,
          height: 0.9,
          rx: 0.14,
          fill: grey ? GREY_FILL : KEY_FILL,
        },
        capLayer,
      ),
    );
  }

  const limbs = new Map<string, Limb>();
  if (o.hands) {
    const skinLayer = svg('g', { opacity: 0.55 }, canvas);
    const palm = (x: number, w: number) =>
      svg('rect', { x, y: 3.75, width: w, height: 1.9, rx: 0.7, fill: SKIN }, skinLayer);
    palm(1.8, 3.9);
    palm(7.8, 3.9);
    const litLayer = svg('g', {}, canvas);
    const limb = (id: string, knuckle: Point, rest: Point): void => {
      const attrs = { 'stroke-width': FINGER_WIDTH, 'stroke-linecap': 'round', fill: 'none' };
      const skin = svg('line', { ...attrs, stroke: SKIN }, skinLayer);
      const lit = svg('line', { ...attrs, stroke: SKIN, 'stroke-opacity': 0.9 }, litLayer);
      lit.setAttribute('visibility', 'hidden');
      limbs.set(id, { knuckle, rest, skin, lit });
    };
    for (const finger of FINGERS) {
      const home = keyCenter(keyById(HOME[finger]));
      limb(finger, { x: home.x, y: home.y + KNUCKLE_DROP }, home);
    }
    limb('thL', { x: 5.1, y: 5.2 }, { x: 6.35, y: 4.55 });
    limb('thR', { x: 8.65, y: 5.2 }, { x: 7.4, y: 4.55 });
  }

  const labelLayer = svg('g', { 'pointer-events': 'none', 'text-anchor': 'middle' }, canvas);
  for (const key of KEYS) {
    const grey = NON_TYPING.has(key.id);
    const made: SVGElement[] = [];
    const text = (content: string, x: number, y: number, size: number, anchor?: string) => {
      const node = svg(
        'text',
        {
          x,
          y,
          'font-size': size,
          'font-family': 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          'font-weight': 600,
          fill: grey ? GREY_LABEL : LABEL,
          ...(anchor ? { 'text-anchor': anchor } : {}),
        },
        labelLayer,
      );
      node.textContent = content;
      made.push(node);
    };
    if (key.shiftLabel) {
      text(key.shiftLabel, key.x + 0.16, key.y + 0.36, 0.34, 'start');
      text(key.label, key.x + key.w / 2, key.y + 0.8, 0.44);
    } else if (key.label) {
      const isShift = key.id.startsWith('shift');
      const long = key.label.length > 1;
      text(key.label, key.x + key.w / 2, key.y + (long ? 0.62 : 0.67), long ? 0.34 : 0.5);
      if (isShift) made[0].setAttribute('font-size', '0.38');
    }
    labels.set(key.id, made);
  }

  // The little bumps on F and J.
  for (const id of ['f', 'j']) {
    const key = keyById(id);
    svg(
      'rect',
      { x: key.x + 0.35, y: key.y + 0.86, width: 0.3, height: 0.05, rx: 0.025, fill: GREY_LABEL },
      canvas,
    );
  }

  // ---------- State ----------
  let lit = new Map<string, string>();
  let pulseIds = new Map<string, string>();
  const flashes = new Map<string, 'right' | 'wrong'>();
  const flashTimers = new Set<ReturnType<typeof setTimeout>>();
  let tints: Record<string, KeyTint> = {};
  let pressed: string | null = null;
  let disposed = false;

  function paint(id: string): void {
    const rect = rects.get(id)!;
    const grey = NON_TYPING.has(id);
    const flash = flashes.get(id);
    const color = flash ? (flash === 'right' ? RIGHT : WRONG) : (lit.get(id) ?? pulseIds.get(id));
    const tint = color ? undefined : tints[id];
    rect.setAttribute('fill', color ?? tint?.fill ?? (grey ? GREY_FILL : KEY_FILL));
    if (id === pressed) {
      rect.setAttribute('stroke', '#ffffff');
      rect.setAttribute('stroke-width', '0.1');
    } else if (tint?.ring) {
      rect.setAttribute('stroke', tint.ring);
      rect.setAttribute('stroke-width', '0.12');
    } else {
      rect.removeAttribute('stroke');
      rect.removeAttribute('stroke-width');
    }
    rect.classList.toggle('tk-pulse', pulseIds.has(id));
    for (const node of labels.get(id) ?? []) {
      const labelColor = color ? DARK : (tint?.label ?? (grey ? GREY_LABEL : LABEL));
      node.setAttribute('fill', labelColor);
      node.setAttribute('font-weight', labelColor === DARK ? '800' : '600');
    }
  }
  const paintAll = () => rects.forEach((_, id) => paint(id));

  function colorsFor(char: string): Map<string, string> {
    const map = new Map<string, string>();
    const key = safeKey(char);
    if (!key) return map;
    map.set(key.id, fingerColor(fingerOf(char)));
    const shift = shiftKeyFor(char);
    if (shift) map.set(shift.id, FINGER_COLORS.pinky);
    return map;
  }

  function setLimb(id: string, tip: Point, color: string | null): void {
    const l = limbs.get(id)!;
    for (const line of [l.skin, l.lit]) {
      line.setAttribute('x1', String(l.knuckle.x));
      line.setAttribute('y1', String(l.knuckle.y));
      line.setAttribute('x2', String(tip.x));
      line.setAttribute('y2', String(tip.y));
    }
    if (color) {
      l.lit.setAttribute('stroke', color);
      l.lit.setAttribute('visibility', 'visible');
    } else {
      l.lit.setAttribute('visibility', 'hidden');
    }
  }

  const keyboard: Keyboard = {
    element: root,
    light(char) {
      lit = char === null ? new Map() : colorsFor(char);
      paintAll();
    },
    flash(char, kind, hold = false) {
      const key = safeKey(char);
      if (!key) return;
      flashes.set(key.id, kind);
      paint(key.id);
      if (hold) return;
      const timer = setTimeout(() => {
        flashTimers.delete(timer);
        if (flashes.get(key.id) === kind) flashes.delete(key.id);
        if (!disposed) paint(key.id);
      }, FLASH_MS);
      flashTimers.add(timer);
    },
    setFaint(faint) {
      root.classList.toggle('tk-faint', faint);
    },
    reach(char, t) {
      const before = pressed;
      pressed = null;
      if (limbs.size > 0) {
        for (const id of limbs.keys()) setLimb(id, limbs.get(id)!.rest, null);
        const key = char === null ? null : safeKey(char);
        if (char !== null && key) {
          const phase = reachPhase(char, t);
          const finger: Finger = fingerOf(char);
          const id = finger === 'th' ? 'thR' : finger;
          const target = keyCenter(key);
          setLimb(id, lerp(limbs.get(id)!.rest, target, phase.out), fingerColor(finger));
          const shift = shiftKeyFor(char);
          if (shift) {
            const pinky = shift.id === 'shift-left' ? 'lp' : 'rp';
            setLimb(
              pinky,
              lerp(limbs.get(pinky)!.rest, keyCenter(shift), phase.shift),
              phase.shift > 0 ? FINGER_COLORS.pinky : null,
            );
          }
          if (phase.pressed) pressed = key.id;
        }
      } else if (char !== null) {
        const key = safeKey(char);
        if (key && reachPhase(char, t).pressed) pressed = key.id;
      }
      if (before !== pressed) {
        if (before) paint(before);
        if (pressed) paint(pressed);
      }
    },
    pulse(chars) {
      const before = [...pulseIds.keys()];
      pulseIds = new Map();
      for (const char of chars ?? []) {
        for (const [id, color] of colorsFor(char)) {
          pulseIds.set(id, color);
        }
      }
      for (const id of new Set([...before, ...pulseIds.keys()])) paint(id);
    },
    tint(next) {
      tints = next ?? {};
      paintAll();
    },
    setCaps(on) {
      pill.hidden = !on;
    },
    dispose() {
      disposed = true;
      flashTimers.forEach(clearTimeout);
      flashTimers.clear();
      root.remove();
    },
  };
  return keyboard;
}
