/**
 * The 6 obstacles of the farm (hay, scarecrow, chickens) and the jungle (vine, stones, mud),
 * 24 moves. Numbers are obstacle-local: x = 0 is the entry line, the floor is y = 0. Each cat path
 * was drawn to fit the prop in `props/extra.ts`; the vine's swing is shared with it. The river
 * and the mud are flat floor, so the cat never goes below y = 0.
 */
import type { ObstacleId } from '../places';
import type { Outcome, Variant } from '../rules';
import {
  EASE,
  TAU,
  clamp01,
  failEnd,
  runIn,
  type Move,
  type ObstacleMoves,
  type Seg,
} from './toolkit';

type ExtraId = Extract<ObstacleId, 'hay' | 'scarecrow' | 'chickens' | 'vine' | 'stones' | 'mud'>;

const smooth = (u: number) => EASE.io(clamp01(u));
const mk = (segs: Seg[], events: Move['events']): Move => ({ segs, events });

// ---------- Shared motions (the props use these too) ----------

/** The vine hangs from x = VINE.x, y = VINE.top; its swing angle (radians, forward is positive). */
export const VINE = { x: 6.2, top: 6.0, length: 3.6 };
export function vineSwing(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear') return -0.1 + 0.6 * smooth((t - 0.5) / 0.7);
  if (outcome === 'fail' && variant === 0) return -0.1 + 0.25 * smooth((t - 0.7) / 0.4);
  return 0.18 * Math.sin(t * 2.4);
}
/** The hay bale on top of the stack tips off (fail 1). */
export const hayTip = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 1 ? smooth((t - 0.9) / 0.5) : 0;
/** The scarecrow's arms swing down when the cat hits them (fail 0). */
export const armDrop = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 0 ? smooth((t - 0.8) / 0.4) : 0;
/** The hens scatter once the cat is on them (fail). */
export const henScatter = (outcome: Outcome | null, t: number) =>
  outcome === 'fail' ? smooth((t - 0.8) / 0.6) : 0;

const clearEvents = (wordX: number, landX: number): Move['events'] => [
  [0.35, 'sfx:whoosh', 2.6, 0.4],
  [0.8, 'word', wordX, 3.6],
  [1.2, 'sparkle', wordX, 3.0],
  [1.4, 'dust', landX, 0.1],
];
const failEvents = (x: number, y: number, extra: Move['events'] = []): Move['events'] => [
  [0.6, 'sfx:squeak', x, y],
  [0.85, 'bonk', x, y],
  [1.0, 'stars', x, y + 0.6],
  [1.8, 'sfx:boing', x + 1, 1],
  ...extra,
];

export const EXTRA_MOVES: Record<ExtraId, ObstacleMoves> = {
  // ---------- Farm ----------
  hay: {
    spec: { length: 11, height: 3.2, floorY: 0 },
    words: ['LEAP!', 'CLIMB!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.85, 9.6, 0, 'leap', { peak: 4.0, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        clearEvents(6, 9.6),
      ),
      mk(
        [
          runIn(),
          [0.25, 3.6, 0, 'crouch'],
          [0.3, 5.0, 1.2, 'leap', { peak: 2.0 }],
          [0.25, 6.2, 2.4, 'leap', { peak: 3.2 }],
          [0.45, 9.2, 0, 'leap', { peak: 3.4 }],
          [0.3, 11, 0, 'run'],
        ],
        clearEvents(6.2, 9.2),
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.45, 4.4, 0, 'run', { face: 'wide' }],
          [0.25, 4.6, 0, 'splat', { sx: 1.3, sy: 0.6, face: 'wide' }],
          [0.5, 4.6, 0, 'dizzy', { face: 'dizzy' }],
          [0.6, 8.4, 0, 'leap', { peak: 3.0 }],
          ...failEnd(11),
        ],
        failEvents(4.6, 1, [[0.9, 'dust', 4.8, 0.2]]),
      ),
      mk(
        [
          runIn(),
          [0.35, 3.8, 0, 'crouch'],
          [0.4, 5.8, 2.4, 'leap', { peak: 3.4 }],
          [0.3, 5.8, 2.4, 'flail', { face: 'wide' }],
          [0.4, 7.8, 0, 'leap', { peak: 3.2, spin: TAU, face: 'wide' }],
          [0.3, 7.8, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        failEvents(7.8, 0.6, [[1.0, 'sfx:thud', 6, 2]]),
      ),
    ],
  },
  scarecrow: {
    spec: { length: 11, height: 4.0, floorY: 0 },
    words: ['LEAP!', 'DUCK!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.9, 9.8, 0, 'leap', { peak: 4.8, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        clearEvents(6, 9.8),
      ),
      mk(
        [
          runIn(),
          [0.25, 3.6, 0, 'crouch'],
          [0.5, 7.6, 0, 'slide', { sy: 0.6 }],
          [0.3, 9.4, 0, 'leap', { peak: 1.2 }],
          [0.35, 11, 0, 'run'],
        ],
        clearEvents(5.8, 9.4),
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.5, 5.2, 2.2, 'leap', { peak: 2.6 }],
          [0.25, 5.2, 2.2, 'splat', { sx: 1.2, sy: 0.6, face: 'wide' }],
          [0.4, 5.6, 3.6, 'leap', { peak: 4.4, spin: TAU, face: 'wide' }],
          [0.4, 7.0, 0, 'flail'],
          [0.3, 7.2, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        failEvents(5.2, 2.2, [[1.3, 'feathers', 6, 2.6, 0xe8c34a]]),
      ),
      mk(
        [
          runIn(),
          [0.35, 4.6, 0, 'run', { face: 'wide' }],
          [0.4, 5.6, 0, 'slide', { sy: 0.6, face: 'wide' }],
          [0.4, 6.0, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.3, 6.0, 0, 'dizzy', { face: 'dizzy' }],
          [0.45, 9.0, 0, 'leap', { peak: 2.2, face: 'wide' }],
          ...failEnd(11),
        ],
        failEvents(5.8, 0.8),
      ),
    ],
  },
  chickens: {
    spec: { length: 11, height: 1.4, floorY: 0 },
    words: ['HOP!', 'SKIP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 3.0, 0, 'crouch'],
          [0.75, 8.8, 0, 'leap', { peak: 2.4, spin: -TAU }],
          [0.4, 11, 0, 'run'],
        ],
        clearEvents(6, 8.8),
      ),
      mk(
        [
          runIn(),
          [0.15, 3.4, 0, 'crouch'],
          [0.35, 5.0, 0, 'leap', { peak: 2.1 }],
          [0.3, 6.9, 0, 'leap', { peak: 2.1 }],
          [0.3, 8.8, 0, 'leap', { peak: 2.1 }],
          [0.35, 11, 0, 'run'],
        ],
        clearEvents(6.9, 8.8),
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.4, 4.0, 0, 'run', { face: 'wide' }],
          [0.3, 4.9, 0.4, 'flail', { face: 'wide' }],
          [0.4, 5.2, 0.1, 'splat', { sx: 1.2, sy: 0.6, face: 'dizzy' }],
          [0.4, 6.0, 0, 'dizzy', { face: 'dizzy' }],
          [0.4, 8.6, 0, 'leap', { peak: 1.6 }],
          ...failEnd(11),
        ],
        failEvents(5, 0.8, [[1.0, 'feathers', 5.2, 0.8, 0xffffff]]),
      ),
      mk(
        [
          runIn(),
          [0.35, 4.4, 0, 'run', { face: 'wide' }],
          [0.6, 7.4, 1.6, 'flail', { spin: TAU * 2, face: 'wide' }],
          [0.3, 8.4, 1.0, 'flail', { z: -0.2 }],
          [0.3, 8.6, 0.9, 'splat', { z: -0.2, sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.35, 10.4, 0, 'leap', { peak: 1.5, z: 0, sx: 1, sy: 1 }],
          ...failEnd(11),
        ],
        [
          [0.5, 'sfx:whoosh', 5, 1],
          [0.9, 'feathers', 6.5, 1.2, 0xffffff],
          [1.5, 'sfx:crash', 8.6, 0.9],
          [1.5, 'bonk', 8.6, 1.2],
          [1.7, 'stars', 8.6, 1.8],
          [1.95, 'sfx:squeak', 10, 1.2],
        ],
      ),
    ],
  },

  // ---------- Jungle ----------
  vine: {
    spec: { length: 11, height: 5.0, floorY: 0 },
    words: ['SWING!', 'TARZAN!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.8, 0, 'crouch'],
          [0.5, 6.0, 2.4, 'leap', { peak: 3.2 }],
          [0.35, 6.2, 2.2, 'climb'],
          [0.5, 9.6, 0, 'leap', { peak: 3.6 }],
          [0.35, 11, 0, 'run'],
        ],
        clearEvents(6.2, 9.6),
      ),
      mk(
        [
          runIn(),
          [0.15, 3.2, 0, 'crouch'],
          [0.45, 6.2, 2.2, 'leap', { peak: 3.0 }],
          [0.4, 7.4, 3.2, 'leap', { peak: 3.8 }],
          [0.5, 9.8, 0, 'leap', { peak: 4.4, spin: -TAU }],
          [0.35, 11, 0, 'run'],
        ],
        clearEvents(7, 9.8),
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.45, 5.8, 2.4, 'leap', { peak: 3.0 }],
          [0.3, 6.0, 2.2, 'climb', { face: 'wide' }],
          [0.35, 6.2, 0, 'flail'],
          [0.4, 6.4, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.45, 10.0, 0, 'leap', { peak: 2.4 }],
          ...failEnd(11),
        ],
        failEvents(6.2, 0.8, [[0.95, 'sfx:thud', 6.2, 0.2]]),
      ),
      mk(
        [
          runIn(),
          [0.45, 6.6, 2.8, 'leap', { peak: 3.4 }],
          [0.4, 7.6, 2.2, 'flail', { spin: TAU, face: 'wide' }],
          [0.35, 7.8, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.3, 8.6, 0, 'dizzy', { face: 'dizzy' }],
          [0.4, 9.8, 0, 'leap', { peak: 1.6 }],
          ...failEnd(11),
        ],
        failEvents(7.6, 1.2),
      ),
    ],
  },
  stones: {
    spec: { length: 11, height: 1.6, floorY: 0 },
    words: ['HOP!', 'SKIP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 3.0, 0, 'crouch'],
          [0.3, 4.6, 0.3, 'leap', { peak: 1.4 }],
          [0.3, 6.4, 0.3, 'leap', { peak: 1.4 }],
          [0.3, 8.2, 0.3, 'leap', { peak: 1.4 }],
          [0.4, 10.0, 0, 'leap', { peak: 1.2 }],
          [0.3, 11, 0, 'run'],
        ],
        clearEvents(6.4, 10),
      ),
      mk(
        [
          runIn(),
          [0.2, 3.4, 0, 'crouch'],
          [0.35, 4.6, 0.3, 'leap', { peak: 1.6, spin: -TAU }],
          [0.3, 6.4, 0.3, 'leap', { peak: 1.2 }],
          [0.3, 8.2, 0.3, 'leap', { peak: 1.6, spin: -TAU }],
          [0.35, 10.0, 0, 'leap', { peak: 1.2 }],
          [0.3, 11, 0, 'run'],
        ],
        clearEvents(6.4, 10),
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.6, 0.3, 'leap', { peak: 1.4 }],
          [0.35, 6.4, 0.3, 'flail', { face: 'wide' }],
          [0.35, 6.7, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.3, 7.2, 0, 'dizzy', { face: 'dizzy' }],
          [0.45, 9.4, 0, 'leap', { peak: 1.4 }],
          ...failEnd(11),
        ],
        failEvents(6.6, 0.8, [[0.9, 'splash', 6.6, 0.2, 0x8ad4f2]]),
      ),
      mk(
        [
          runIn(),
          [0.2, 3.4, 0, 'crouch'],
          [0.45, 4.1, 0, 'leap', { peak: 1.8 }],
          [0.35, 4.1, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.4, 4.1, 0, 'dizzy', { face: 'dizzy' }],
          [0.5, 9.4, 0, 'leap', { peak: 1.5 }],
          ...failEnd(11),
        ],
        failEvents(4.1, 0.8, [[0.95, 'splash', 4.1, 0.2, 0x8ad4f2]]),
      ),
    ],
  },
  mud: {
    spec: { length: 11, height: 2.4, floorY: 0 },
    words: ['LEAP!', 'FLIP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 3.0, 0, 'crouch'],
          [0.7, 9.0, 0, 'leap', { peak: 2.6, spin: -TAU }],
          [0.5, 11, 0, 'run'],
        ],
        clearEvents(6, 9),
      ),
      mk(
        [
          runIn(),
          [0.15, 3.2, 0, 'crouch'],
          [0.45, 5.4, 2.4, 'leap', { peak: 2.8 }],
          [0.45, 9.4, 0, 'leap', { peak: 3.2, spin: -TAU }],
          [0.35, 11, 0, 'run'],
        ],
        clearEvents(5.4, 9.4),
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.55, 6.2, 0, 'leap', { peak: 2.2 }],
          [0.3, 6.2, 0, 'splat', { sx: 1.4, sy: 0.5, face: 'dizzy' }],
          [0.5, 6.2, 0, 'dizzy', { face: 'dizzy' }],
          [0.4, 9.6, 0, 'leap', { peak: 1.2 }],
          ...failEnd(11),
        ],
        failEvents(6.2, 0.8, [[0.9, 'bubbles', 6.2, 0.4, 0x7a5230]]),
      ),
      mk(
        [
          runIn(),
          [0.35, 5.0, 0, 'run', { face: 'wide' }],
          [0.45, 5.8, 0, 'flail', { face: 'wide' }],
          [0.35, 6.2, 0, 'splat', { sx: 1.4, sy: 0.5, face: 'dizzy' }],
          [0.35, 6.2, 0, 'dizzy', { face: 'dizzy' }],
          [0.45, 9.4, 0, 'leap', { peak: 2.4 }],
          ...failEnd(11),
        ],
        failEvents(6.0, 0.8, [[0.8, 'bubbles', 5.8, 0.4, 0x7a5230]]),
      ),
    ],
  },
};
