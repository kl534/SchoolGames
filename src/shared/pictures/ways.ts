import { deviceStore, readJson, writeJson, type KeyValueStore } from '../storage';
import type { FactVisual } from '../topics';

export type Way =
  | 'add-join'
  | 'add-line'
  | 'add-make-ten'
  | 'sub-take-away'
  | 'sub-line'
  | 'sub-cross-out'
  | 'sub-gap'
  | 'mul-groups'
  | 'mul-line'
  | 'mul-array'
  | 'mul-add-up'
  | 'mul-split'
  | 'div-groups'
  | 'div-share'
  | 'div-line'
  | 'div-rows';

/** The ways of each operation, in rotation order. M1: multiply and divide are []. */
export const WAYS: Record<FactVisual['kind'], readonly Way[]> = {
  add: ['add-join', 'add-line', 'add-make-ten'],
  subtract: ['sub-take-away', 'sub-line', 'sub-cross-out', 'sub-gap'],
  multiply: [],
  divide: [],
};

/** Critters in one loose picture. */
export const MAX_ITEMS = 60;
/** Groups, plates, rows or added terms. */
export const MAX_GROUPS = 10;
/** Cells in an array (rows and columns at most 10 each). */
export const MAX_GRID = 100;

/** Which operation a way belongs to. */
export const WAY_KIND: Record<Way, FactVisual['kind']> = {
  'add-join': 'add',
  'add-line': 'add',
  'add-make-ten': 'add',
  'sub-take-away': 'subtract',
  'sub-line': 'subtract',
  'sub-cross-out': 'subtract',
  'sub-gap': 'subtract',
  'mul-groups': 'multiply',
  'mul-line': 'multiply',
  'mul-array': 'multiply',
  'mul-add-up': 'multiply',
  'mul-split': 'multiply',
  'div-groups': 'divide',
  'div-share': 'divide',
  'div-line': 'divide',
  'div-rows': 'divide',
};

/** Can this way picture this fact without being too crowded? (The way must be the fact's own.) */
export function canUse(visual: FactVisual, way: Way): boolean {
  if (WAY_KIND[way] !== visual.kind) return false;
  const { a, b } = visual;
  switch (way) {
    case 'add-join':
    case 'add-line':
    case 'sub-take-away':
    case 'sub-line':
    case 'sub-cross-out':
    case 'mul-line':
    case 'div-line':
      return true;
    case 'add-make-ten':
      return a % 10 !== 0 && b > 10 - (a % 10);
    case 'sub-gap':
      return a <= 20;
    case 'mul-groups':
      return a <= MAX_GROUPS && a * b <= MAX_ITEMS;
    case 'mul-array':
      return a <= MAX_GROUPS && b <= MAX_GROUPS;
    case 'mul-add-up':
      return a <= MAX_GROUPS;
    case 'mul-split':
      return Math.max(a, b) > 10;
    case 'div-groups':
      return a <= MAX_ITEMS && a / b <= MAX_GROUPS;
    case 'div-share':
      return b <= MAX_GROUPS && a <= MAX_ITEMS;
    case 'div-rows':
      return a <= MAX_GRID && b <= MAX_GROUPS && a / b <= MAX_GROUPS;
  }
}

/** First usable way at or after `turn % WAYS[kind].length`; null when none. */
export function pickWay(visual: FactVisual, turn: number): { way: Way; nextTurn: number } | null {
  const ways = WAYS[visual.kind];
  if (ways.length === 0) return null;
  const start = Number.isInteger(turn) && turn > 0 ? turn % ways.length : 0;
  for (let i = 0; i < ways.length; i++) {
    const index = (start + i) % ways.length;
    if (canUse(visual, ways[index])) return { way: ways[index], nextTurn: index + 1 };
  }
  return null;
}

/** Where the device remembers which way each operation shows next (not per player). */
export const TURNS_KEY = 'sg:picture-turns';

type Turns = Partial<Record<FactVisual['kind'], number>>;

export function readTurn(kind: FactVisual['kind'], store: KeyValueStore = deviceStore()): number {
  const turns = readJson<Turns | null>(store, TURNS_KEY, null);
  const turn = turns?.[kind];
  return typeof turn === 'number' && Number.isInteger(turn) && turn >= 0 ? turn : 0;
}

export function saveTurn(
  kind: FactVisual['kind'],
  turn: number,
  store: KeyValueStore = deviceStore(),
): void {
  const turns = readJson<Turns | null>(store, TURNS_KEY, null);
  writeJson(store, TURNS_KEY, {
    ...(turns && typeof turns === 'object' ? turns : {}),
    [kind]: turn,
  });
}
