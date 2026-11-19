/**
 * Fingers and the keyboard picture's geometry. Pure. US QWERTY, ANSI layout, 15 units wide.
 */

export type Finger = 'lp' | 'lr' | 'lm' | 'li' | 'ri' | 'rm' | 'rr' | 'rp' | 'th';

const FINGER_KEYS: Record<Finger, string> = {
  lp: '`1qaz',
  lr: '2wsx',
  lm: '3edc',
  li: '45rtfgvb',
  ri: '67yuhjnm',
  rm: '8ik,',
  rr: '9ol.',
  rp: "0-=p[]\\;'/",
  th: ' ',
};

const FINGER_OF = new Map<string, Finger>();
for (const [finger, keys] of Object.entries(FINGER_KEYS)) {
  for (const key of keys) FINGER_OF.set(key, finger as Finger);
}

/** The home key each finger rests on. */
export const HOME: Record<Finger, string> = {
  lp: 'a',
  lr: 's',
  lm: 'd',
  li: 'f',
  ri: 'j',
  rm: 'k',
  rr: 'l',
  rp: ';',
  th: ' ',
};

/** The eight fingers (no thumb), left to right. */
export const FINGERS: Finger[] = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp'];

export const FINGER_COLORS = {
  pinky: '#a855f7',
  ring: '#3b82f6',
  middle: '#22c55e',
  pointer: '#f97316',
  thumb: '#94a3b8',
};

/** The colour a finger lights its key in (the same on both hands). */
export function fingerColor(finger: Finger): string {
  switch (finger) {
    case 'lp':
    case 'rp':
      return FINGER_COLORS.pinky;
    case 'lr':
    case 'rr':
      return FINGER_COLORS.ring;
    case 'lm':
    case 'rm':
      return FINGER_COLORS.middle;
    case 'li':
    case 'ri':
      return FINGER_COLORS.pointer;
    default:
      return FINGER_COLORS.thumb;
  }
}

export const isLeftFinger = (finger: Finger): boolean =>
  finger === 'lp' || finger === 'lr' || finger === 'lm' || finger === 'li';

const SHIFTED: Record<string, string> = {
  '!': '1',
  '@': '2',
  '#': '3',
  $: '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
  ')': '0',
  _: '-',
  '+': '=',
  '{': '[',
  '}': ']',
  '|': '\\',
  ':': ';',
  '"': "'",
  '<': ',',
  '>': '.',
  '?': '/',
  '~': '`',
};

/** The unshifted key a char is typed on: `!` is `1`, `R` is `r`; anything else is itself. */
export function baseOf(char: string): string {
  if (Object.hasOwn(SHIFTED, char)) return SHIFTED[char];
  if (char >= 'A' && char <= 'Z') return char.toLowerCase();
  return char;
}

/** True for a capital letter or a shifted symbol. */
export function needsShift(char: string): boolean {
  return baseOf(char) !== char;
}

/** The finger that presses the char's key (the Shift finger is not counted). */
export function fingerOf(char: string): Finger {
  const finger = FINGER_OF.get(baseOf(char));
  if (!finger) throw new Error(`No finger for ${JSON.stringify(char)}`);
  return finger;
}

/** The Shift to hold: the one opposite the base key's hand. */
export function shiftFor(char: string): 'left' | 'right' {
  return isLeftFinger(fingerOf(char)) ? 'right' : 'left';
}

export interface KeyDef {
  /** The base char (`a`, `1`, `;`), `space`, `shift-left`/`shift-right`, or a grey key's name. */
  id: string;
  label: string;
  /** What Shift types on it, drawn small top-left (symbol and number keys only). */
  shiftLabel?: string;
  x: number;
  y: number;
  w: number;
}

/** Keys that are drawn grey and never lit. */
export const NON_TYPING = new Set([
  'backspace',
  'tab',
  'caps',
  'enter',
  'ctrl-left',
  'win-left',
  'alt-left',
  'alt-right',
  'win-right',
  'menu',
  'ctrl-right',
]);

export const KEYBOARD_WIDTH = 15;
export const KEYBOARD_HEIGHT = 5;

const SHIFT_LABELS = new Map(Object.entries(SHIFTED).map(([shifted, base]) => [base, shifted]));

function build(): KeyDef[] {
  const keys: KeyDef[] = [];
  const typing = (base: string, x: number, y: number, w = 1): void => {
    const letter = base >= 'a' && base <= 'z';
    keys.push({
      id: base,
      label: letter ? base.toUpperCase() : base,
      shiftLabel: letter ? undefined : SHIFT_LABELS.get(base),
      x,
      y,
      w,
    });
  };
  const run = (chars: string, x: number, y: number): void => {
    for (const char of chars) typing(char, x++, y);
  };
  const grey = (id: string, label: string, x: number, y: number, w: number): void => {
    keys.push({ id, label, x, y, w });
  };

  run('`1234567890-=', 0, 0);
  grey('backspace', '⌫', 13, 0, 2);
  grey('tab', 'Tab', 0, 1, 1.5);
  run('qwertyuiop[]', 1.5, 1);
  typing('\\', 13.5, 1, 1.5);
  grey('caps', 'Caps', 0, 2, 1.75);
  run("asdfghjkl;'", 1.75, 2);
  grey('enter', 'Enter', 12.75, 2, 2.25);
  keys.push({ id: 'shift-left', label: 'Shift', x: 0, y: 3, w: 2.25 });
  run('zxcvbnm,./', 2.25, 3);
  keys.push({ id: 'shift-right', label: 'Shift', x: 12.25, y: 3, w: 2.75 });
  grey('ctrl-left', 'Ctrl', 0, 4, 1.25);
  grey('win-left', '', 1.25, 4, 1.25);
  grey('alt-left', 'Alt', 2.5, 4, 1.25);
  keys.push({ id: 'space', label: '', x: 3.75, y: 4, w: 6.25 });
  grey('alt-right', 'Alt', 10, 4, 1.25);
  grey('win-right', '', 11.25, 4, 1.25);
  grey('menu', '', 12.5, 4, 1.25);
  grey('ctrl-right', 'Ctrl', 13.75, 4, 1.25);
  return keys;
}

export const KEYS: KeyDef[] = build();

const BY_ID = new Map(KEYS.map((key) => [key.id, key]));

export function keyById(id: string): KeyDef {
  const key = BY_ID.get(id);
  if (!key) throw new Error(`No key ${id}`);
  return key;
}

/** The key a char is typed on (a shifted char gives its base key). */
export function keyFor(char: string): KeyDef {
  return keyById(char === ' ' ? 'space' : baseOf(char));
}

/** The Shift key to hold for a char, or null when it needs none. */
export function shiftKeyFor(char: string): KeyDef | null {
  return needsShift(char) ? keyById(`shift-${shiftFor(char)}`) : null;
}

export const keyCenter = (key: KeyDef): { x: number; y: number } => ({
  x: key.x + key.w / 2,
  y: key.y + 0.5,
});
