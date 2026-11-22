/**
 * The 12 town obstacles (backyard, park, street, rooftops), 48 moves. The numbers are
 * obstacle-local: x = 0 is the entry line, the floor is y = 0. Each cat path was drawn to fit
 * the prop in `props/town.ts`; the shared motions (the swing, the lily pad, the skateboard)
 * are exported here so the prop and the cat use the same function.
 */
import type { ObstacleId } from '../places';
import type { Outcome, Variant } from '../rules';
import {
  EASE,
  TAU,
  clamp01,
  failEnd,
  follow,
  runIn,
  type Move,
  type ObstacleMoves,
  type Seg,
} from './toolkit';

type TownId = Extract<
  ObstacleId,
  | 'fence'
  | 'sprinkler'
  | 'flowers'
  | 'slide'
  | 'pond'
  | 'swings'
  | 'mailbox'
  | 'trash-can'
  | 'hopscotch'
  | 'chimney'
  | 'roof-gap'
  | 'clothesline'
>;

const smooth = (u: number) => EASE.io(clamp01(u));

// ---------- Shared motions (the props use these too) ----------

/** The swing set: the near seat hangs from (x, y) on a chain `len` long; the far seat idles. */
export const SWING = { x: 5.3, y: 4.2, len: 3.0, farX: 6.9 };
/** The angle (radians, positive swings right) of the near seat. */
export function swingAngle(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 0) {
    return t < 0.55 ? 0 : -0.9 * Math.sin((TAU * (t - 0.55)) / 1.2);
  }
  if (outcome === 'fail' && variant === 0) return -0.27 + 0.75 * Math.sin((TAU * (t - 0.7)) / 1.6);
  return 0.5 * Math.sin((TAU * t) / 1.6);
}
/** Where the near seat is at angle `a`. */
export const swingSeat = (a: number) => ({
  x: SWING.x + SWING.len * Math.sin(a),
  y: SWING.y - SWING.len * Math.cos(a),
});
/** The far seat always swings by itself. */
export const farSwingAngle = (t: number) => 0.45 * Math.sin((TAU * t) / 1.9 + 1);

/** The lily pad's centre x: it drifts to the right while the cat rides it (clear 1). */
export function padX(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 1) return 6.4 + 2.0 * smooth((t - 0.9) / 0.6);
  return 6.4 + 0.05 * Math.sin(t * 2);
}

/** The duck of pond fail 1: how far it has come up out of the water (0 to 1), and its tip. */
export const duckUp = (t: number) => smooth((t - 0.5) / 0.25) * (1 - smooth((t - 1.75) / 0.25));
export const duckTip = (t: number) => 0.9 * smooth((t - 1.2) / 0.3);

/** The street's rolling bin: its centre x (it rolls left; clear 1 the cat stops it a moment). */
export const CAN_R = 0.9;
export function canX(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 1) {
    if (t < 0.55) return 7.6 - 5.5 * t;
    if (t < 1.3) return 4.575 - 1.2 * (t - 0.55);
    return 3.675 - 5.5 * (t - 1.3);
  }
  return 7.6 - 6 * t;
}

/** The skateboard of hopscotch fail 1: it rolls slowly, then the cat's weight speeds it up. */
export function skateX(t: number): number {
  if (t < 0.55) return 3.2 + 2.2 * t;
  const d = t - 0.55;
  return 4.41 + 3 * d + 2 * d * d;
}
export const SKATE_Y = 0.22;

/** The mailbox flag: how far up it has popped (0 down, 1 up) in fail 0. */
export const flagUp = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 0 ? smooth((t - 0.7) / 0.08) : 0;

/** The chimney's smoke puff: its size (0 to 1) in fail 1. */
export const puffSize = (t: number) => smooth((t - 0.55) / 0.2) * (1 - smooth((t - 1.2) / 0.4));

/** The roof gap's awning (fail 0): how squashed it is, and the antenna bend (clear 1). */
export const awningSquash = (t: number) => Math.sin(Math.PI * clamp01((t - 1.0) / 0.3));
export const antennaBend = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'clear' && variant === 1 ? -0.35 * Math.sin(Math.PI * clamp01((t - 0.55) / 0.8)) : 0;

/** The clothesline: where the sock hangs, and when the line snaps (fail 1). */
export const SNAP_AT = 1.0;
export const snapAngle = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 1 ? 1.2 * smooth((t - SNAP_AT) / 0.25) : 0;

const mk = (segs: Seg[], events: Move['events']): Move => ({ segs, events });

export const TOWN_MOVES: Record<TownId, ObstacleMoves> = {
  // ---------- Backyard ----------
  fence: {
    spec: { length: 11, height: 3, floorY: 0 },
    words: ['HOP!', 'VAULT!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 4.0, 3.0, 'leap', { peak: 3.7 }],
          [0.7, 7.6, 3.0, 'run'],
          [0.4, 10.2, 0, 'leap', { peak: 3.9 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'dust', 4, 3.1],
          [0.9, 'word', 6, 4],
          [1.6, 'dust', 10.2, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.2, 3.1, 'leap', { peak: 3.9 }],
          [0.12, 4.6, 3.1, 'land', { sy: 0.85 }],
          [0.55, 9.4, 0, 'leap', { peak: 4.0, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 4.4, 3.1],
          [0.8, 'word', 6.5, 4.2],
          [1.2, 'dust', 9.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.35, 3.9, 2.4, 'leap', { peak: 3.0 }],
          [0.5, 3.95, 0.1, 'slide', { face: 'wide' }],
          [0.25, 3.95, 0.05, 'splat', { sx: 1.3, sy: 0.45 }],
          [0.35, 3.95, 0.1, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.45, 9.0, 0, 'leap', { peak: 3.9, face: 'wide' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.65, 'sfx:squeak', 3.9, 1.5],
          [1.1, 'sfx:splat', 3.95, 0.2],
          [1.1, 'bonk', 3.95, 0.8],
          [1.3, 'stars', 3.95, 1.4],
          [2.15, 'dust', 9, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.2, 3.0, 'leap', { peak: 3.7 }],
          [0.4, 6.4, 3.0, 'run'],
          [0.3, 7.6, 2.0, 'hang', { face: 'wide' }],
          [0.5, 7.6, 1.7, 'hang'],
          [0.25, 8.4, 0, 'flail'],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [1.0, 'sfx:squeak', 7.6, 2.4],
          [1.5, 'sfx:wobble', 7.6, 1.8],
          [2.05, 'sfx:thud', 8.4, 0.2],
          [2.05, 'bonk', 8.4, 1],
          [2.1, 'stars', 8.4, 1.4],
        ],
      ),
    ],
  },
  sprinkler: {
    spec: { length: 11, height: 3, floorY: 0 },
    words: ['DODGE!', 'SLIDE!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 3.6, 0, 'leap', { peak: 1.8 }],
          [0.1, 3.9, 0, 'land', { sy: 0.85 }],
          [0.5, 7.6, 0, 'leap', { peak: 3.1, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.65, 'sfx:boing', 3.9, 0.2],
          [0.9, 'word', 5.6, 3.6],
          [1.15, 'sparkle', 7.6, 0.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.25, 3.7, 0, 'crouch'],
          [0.55, 7.7, 0, 'slide', { sy: 0.7 }],
          [0.3, 9.4, 0, 'leap', { peak: 0.9 }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.55, 'sfx:whoosh', 3.7, 0.4],
          [0.8, 'word', 5.7, 2.3],
          [1.1, 'splash', 7.5, 0.3],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.35, 4.8, 1.3, 'leap', { peak: 2.2 }],
          [0.3, 5.1, 0, 'splat', { coat: 'wet', face: 'squint', sx: 1.2, sy: 0.6 }],
          [0.4, 5.1, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.55, 9.2, 0, 'leap', { peak: 2.4, face: 'wide' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.6, 'sfx:splash', 5.1, 0.6],
          [0.6, 'splash', 5.1, 0.6],
          [0.6, 'bonk', 5.1, 1.1],
          [1.0, 'stars', 5.1, 1.6],
          [2.2, 'sfx:wobble', 9.2, 0.6],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.9, 1.4, 'leap', { peak: 2.0 }],
          [0.6, 5.6, 2.2, 'flail', { spin: TAU * 2, coat: 'wet', face: 'wide' }],
          [0.3, 5.9, 0, 'splat', { sx: 1.25, sy: 0.5, face: 'dizzy' }],
          [0.3, 5.9, 0.1, 'dizzy', { sy: 1 }],
          [0.45, 9.0, 0, 'leap', { peak: 2.0 }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.55, 'sfx:whoosh', 4.9, 1.4],
          [0.8, 'splash', 5.4, 2],
          [1.15, 'sfx:splat', 5.9, 0.2],
          [1.15, 'bonk', 5.9, 1],
          [1.3, 'stars', 5.9, 1.5],
        ],
      ),
    ],
  },
  flowers: {
    spec: { length: 11, height: 1.4, floorY: 0 },
    words: ['LEAP!', 'HOP HOP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.5, 0, 'crouch'],
          [0.75, 9.8, 0, 'leap', { peak: 2.5, spin: -TAU }],
          [0.35, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.5, 0.4],
          [0.8, 'word', 6, 3.2],
          [1.2, 'sparkle', 6, 1.6],
          [1.45, 'dust', 9.8, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.25, 4.4, 0.35, 'leap', { peak: 1.0 }],
          [0.2, 5.6, 0.35, 'leap', { peak: 1.0 }],
          [0.2, 6.8, 0.35, 'leap', { peak: 1.0 }],
          [0.2, 8.0, 0.35, 'leap', { peak: 1.0 }],
          [0.35, 10.6, 0, 'leap', { peak: 1.4 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'dust', 4.4, 0.4],
          [0.7, 'dust', 5.6, 0.4],
          [0.9, 'word', 6.4, 2.4],
          [1.1, 'dust', 8, 0.4],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.6, 1.0, 'leap', { peak: 1.9 }],
          [0.3, 5.2, 0, 'splat', { coat: 'mud', sx: 1.3, sy: 0.5, face: 'wide' }],
          [0.5, 5.5, 0, 'sit', { face: 'dizzy', sy: 1 }],
          [0.4, 9.0, 0, 'leap', { peak: 1.9, face: 'happy' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.85, 'sfx:splat', 5.2, 0.2],
          [0.85, 'bonk', 5.2, 0.9],
          [0.9, 'poof', 5.2, 0.6, 0x6b4a2b],
          [1.3, 'stars', 5.5, 1.3],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 5.0, 0, 'run'],
          [0.5, 5.2, 0, 'sit', { face: 'sneeze' }],
          [0.25, 5.2, 0.5, 'leap', { peak: 1.4, face: 'sneeze' }],
          [0.4, 6.5, 0, 'run', { face: 'wide' }],
          [0.35, 9.0, 0, 'run'],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.6, 'sfx:squeak', 5, 0.8],
          [0.9, 'poof', 5.2, 0.9, 0xf2d34a],
          [0.95, 'bonk', 5.2, 1.2],
          [1.1, 'stars', 5.2, 1.6],
          [1.75, 'sfx:wobble', 7, 1],
        ],
      ),
    ],
  },

  // ---------- Park ----------
  slide: {
    spec: { length: 12, height: 3.6, floorY: 0 },
    words: ['WHEE!', 'ZOOM!'],
    clear: [
      mk(
        [
          runIn(),
          [0.5, 3.7, 3.4, 'climb'],
          [0.2, 4.7, 3.4, 'run'],
          [0.65, 9.0, 0.3, 'slide'],
          [0.3, 10.6, 0, 'leap', { peak: 0.9 }],
          [0.25, 12, 0, 'run'],
        ],
        [
          [0.9, 'sfx:squeak', 4.7, 3.5],
          [1.1, 'word', 6.5, 3.8],
          [1.3, 'sfx:whoosh', 7, 1.4],
          [1.8, 'dust', 10.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.45, 3.8, 3.4, 'climb'],
          [0.6, 9.4, 0, 'leap', { peak: 4.5, spin: -TAU }],
          [0.4, 12, 0, 'run'],
        ],
        [
          [0.5, 'sfx:squeak', 3.8, 2],
          [0.9, 'word', 6.5, 5],
          [1.3, 'dust', 9.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.4, 3.7, 3.4, 'climb'],
          [0.15, 4.7, 3.4, 'run'],
          [0.45, 7.2, 1.7, 'slide', { z: 0.9, face: 'wide' }],
          [0.3, 8.2, 0, 'flail', { spin: TAU }],
          [0.25, 8.6, 0, 'splat', { sx: 1.3, sy: 0.5, z: 0 }],
          [0.25, 8.8, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          ...failEnd(12, 0.35, 0.3),
        ],
        [
          [0.8, 'sfx:squeak', 5, 3],
          [1.15, 'sfx:whoosh', 7.2, 1.7],
          [1.45, 'sfx:splat', 8.6, 0.2],
          [1.45, 'bonk', 8.6, 0.9],
          [1.6, 'stars', 8.7, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.4, 3.7, 3.4, 'climb'],
          [0.1, 4.6, 3.4, 'run'],
          [0.35, 9.0, 0.4, 'slide'],
          [0.45, 10.6, 0, 'flail', { peak: 2.8, spin: -TAU }],
          [0.25, 10.6, 0, 'splat', { coat: 'sand', sx: 1.3, sy: 0.5 }],
          [0.3, 10.7, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          ...failEnd(12, 0.35, 0.3),
        ],
        [
          [0.9, 'sfx:whoosh', 6.5, 1.8],
          [1.5, 'sfx:thud', 10.6, 0.2],
          [1.5, 'poof', 10.6, 0.5, 0xe6cf93],
          [1.5, 'bonk', 10.6, 0.9],
          [1.7, 'stars', 10.7, 1.4],
        ],
      ),
    ],
  },
  pond: {
    spec: { length: 11, height: 1.6, floorY: 0 },
    words: ['HOP!', 'FLOAT!'],
    clear: [
      mk(
        [
          runIn(),
          [0.25, 4.4, 0.35, 'leap', { peak: 1.1 }],
          [0.2, 5.6, 0.35, 'leap', { peak: 1.1 }],
          [0.2, 6.8, 0.35, 'leap', { peak: 1.1 }],
          [0.55, 9.6, 0, 'leap', { peak: 1.6 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'splash', 4.4, 0.2],
          [0.7, 'splash', 5.6, 0.2],
          [0.95, 'word', 6.4, 2.3],
          [1.4, 'splash', 9.4, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.4, 0.35, 'leap', { peak: 1.1 }],
          [0.35, 6.4, 0.2, 'leap', { peak: 1.0 }],
          ...follow(0.9, 1.5, 3, (t) => ({ x: padX('clear', 1, t), y: 0.2 }), 'balance'),
          [0.35, 10.2, 0, 'leap', { peak: 1.4 }],
          [0.25, 11, 0, 'run'],
        ],
        [
          [0.55, 'splash', 4.4, 0.2],
          [0.9, 'sfx:squeak', 6.4, 0.3],
          [1.1, 'word', 7.2, 2.3],
          [1.5, 'sparkle', 8.4, 0.4],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.4, 0.35, 'leap', { peak: 1.1 }],
          [0.25, 5.2, 0, 'splat', { coat: 'wet', sx: 1.2, sy: 0.5, face: 'wide' }],
          [0.5, 6.6, 0, 'flail', { face: 'squint', sy: 1 }],
          [0.5, 9.6, 0, 'leap', { peak: 1.8, face: 'happy' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.8, 'sfx:splash', 5.2, 0.3],
          [0.8, 'splash', 5.2, 0.4],
          [0.8, 'bonk', 5.2, 0.9],
          [1.2, 'bubbles', 6, 0.5],
          [1.4, 'stars', 6.6, 1.3],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.4, 0.35, 'leap', { peak: 1.1 }],
          [0.3, 5.6, 1.1, 'leap', { peak: 1.8 }],
          [0.3, 5.7, 1.1, 'balance', { face: 'wide' }],
          [0.5, 7.4, 0.1, 'flail', { peak: 2.6, spin: TAU }],
          [0.3, 7.6, 0, 'splat', { coat: 'wet', sx: 1.3, sy: 0.5 }],
          [0.3, 7.6, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.65, 'sfx:squeak', 5.6, 0.8],
          [0.85, 'poof', 5.6, 0.9],
          [1.4, 'sfx:wobble', 5.7, 1.4],
          [1.85, 'sfx:splash', 7.6, 0.3],
          [1.85, 'splash', 7.6, 0.4],
          [1.85, 'bonk', 7.6, 0.9],
          [2.05, 'stars', 7.6, 1.3],
        ],
      ),
    ],
  },
  swings: {
    spec: { length: 11, height: 4.3, floorY: 0 },
    words: ['SWING!', 'DUCK!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 5.3, 1.2, 'leap', { peak: 2.2 }],
          ...follow(0.55, 1.45, 6, (t) => swingSeat(swingAngle('clear', 0, t)), 'swing'),
          [0.35, 9.6, 0, 'leap', { peak: 3.4 }],
          [0.25, 11, 0, 'run'],
        ],
        [
          [0.55, 'sfx:squeak', 5.3, 1.3],
          [0.85, 'sfx:whoosh', 4, 2],
          [1.1, 'word', 6.5, 4.8],
          [1.8, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.25, 3.9, 0, 'crouch'],
          [0.8, 7.7, 0, 'slide', { sy: 0.75 }],
          [0.35, 10.0, 0, 'leap', { peak: 0.9 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.6, 'sfx:whoosh', 4, 0.4],
          [0.9, 'word', 5.8, 2.6],
          [1.4, 'dust', 8, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.5, 1.3, 'leap', { peak: 1.9 }],
          [0.15, 4.4, 1.3, 'leap', { face: 'wide' }],
          [0.4, 3.4, 0, 'flail', { spin: TAU, face: 'dizzy' }],
          [0.3, 3.4, 0, 'dizzy', { face: 'dizzy' }],
          [0.5, 9.0, 0, 'run', { face: 'happy' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.7, 'sfx:thud', 4.4, 1.3],
          [0.7, 'bonk', 4.4, 1.5],
          [0.8, 'stars', 4.2, 1.9],
          [1.1, 'sfx:squeak', 3.4, 0.4],
          [1.5, 'stars', 3.4, 1.3],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 5.3, 3.3, 'leap', { peak: 3.6 }],
          ...follow(
            0.55,
            1.35,
            6,
            (t) => {
              const phi = (TAU * (t - 0.55)) / 0.8;
              return { x: 5.3 + 0.9 * Math.sin(phi), y: 4.2 - 0.9 * Math.cos(phi) };
            },
            'hang',
            { spin: -TAU, face: 'wide' },
          ),
          [0.4, 6.4, 0, 'flail', { peak: 3.4 }],
          [0.3, 6.4, 0, 'dizzy', { face: 'dizzy' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.55, 'sfx:squeak', 5.3, 3.4],
          [0.9, 'sfx:wobble', 5.3, 4],
          [1.35, 'stars', 5.3, 3.6],
          [1.75, 'sfx:thud', 6.4, 0.2],
          [1.75, 'bonk', 6.4, 1],
          [1.9, 'stars', 6.4, 1.5],
        ],
      ),
    ],
  },

  // ---------- Street ----------
  mailbox: {
    spec: { length: 11, height: 2.7, floorY: 0 },
    words: ['HOP!', 'VAULT!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 4.8, 2.7, 'leap', { peak: 3.4 }],
          [0.15, 5.5, 2.7, 'land', { sy: 0.85 }],
          [0.45, 9.2, 0, 'leap', { peak: 3.5 }],
          [0.35, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:bump', 4.8, 2.7],
          [0.95, 'word', 6.5, 3.8],
          [1.3, 'dust', 9.2, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.4, 2.0, 'leap', { peak: 3.0 }],
          [0.1, 5.5, 2.8, 'land', { sy: 0.9 }],
          [0.55, 9.4, 0, 'leap', { peak: 3.7, spin: -TAU }],
          [0.4, 11, 0, 'run'],
        ],
        [
          [0.6, 'sfx:bump', 5.5, 2.8],
          [0.95, 'word', 7, 3.9],
          [1.2, 'dust', 9.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.8, 2.7, 'leap', { peak: 3.4 }],
          [0.2, 5.4, 2.7, 'land'],
          [0.45, 3.9, 0, 'flail', { peak: 3.7, spin: TAU, face: 'wide' }],
          [0.25, 3.9, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.35, 3.9, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.4, 8.8, 0, 'leap', { peak: 3.4, face: 'happy' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.7, 'sfx:boing', 6.3, 2.4],
          [0.8, 'bonk', 5.4, 3.3],
          [0.85, 'stars', 5.4, 3.8],
          [1.45, 'sfx:splat', 3.9, 0.2],
          [1.5, 'dust', 3.9, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.5, 1.7, 'leap', { peak: 2.2 }],
          [0.2, 4.9, 1.9, 'curl', { sx: 0.55, sy: 0.55, face: 'wide' }],
          [0.25, 4.9, 1.9, 'flail', { spin: 0.4, sx: 0.55, sy: 0.55 }],
          [0.25, 4.9, 1.9, 'flail', { spin: -0.8 }],
          [0.25, 4.9, 1.9, 'flail', { spin: 0.4 }],
          [0.3, 3.8, 0, 'flail', { peak: 2.4, spin: -TAU, sx: 1, sy: 1 }],
          [0.15, 3.8, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.3, 7.0, 0, 'run', { face: 'dizzy' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.55, 'sfx:squeak', 4.7, 1.9],
          [0.8, 'sfx:wobble', 4.9, 2.3],
          [1.3, 'sfx:wobble', 4.9, 2.3],
          [1.5, 'poof', 4.9, 1.9],
          [1.8, 'sfx:thud', 3.8, 0.2],
          [1.8, 'bonk', 3.8, 0.9],
          [1.95, 'stars', 3.8, 1.4],
        ],
      ),
    ],
  },
  'trash-can': {
    spec: { length: 12, height: 2, floorY: 0 },
    words: ['HOP!', 'ROLL!'],
    clear: [
      mk(
        [
          runIn(),
          [0.2, 2.8, 0, 'crouch'],
          [0.65, 7.0, 0, 'leap', { peak: 3.1 }],
          [0.6, 12, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 3, 0.4],
          [0.75, 'word', 4.6, 3.6],
          [1.1, 'dust', 7, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.575, 1.85, 'leap', { peak: 2.8 }],
          ...follow(0.55, 1.3, 4, (t) => ({ x: canX('clear', 1, t), y: 1.85 }), 'balance'),
          [0.4, 8.4, 0, 'leap', { peak: 3.1 }],
          [0.35, 12, 0, 'run'],
        ],
        [
          [0.6, 'sfx:bump', 4.6, 1.8],
          [1.05, 'word', 4.2, 3.3],
          [1.7, 'dust', 8.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 3.7, 0, 'run'],
          [0.35, 3.9, 0, 'splat', { hat: 'lid', sx: 1.35, sy: 0.35, face: 'wide' }],
          [0.5, 4.2, 0.1, 'flail', { sx: 1, sy: 1, face: 'dizzy' }],
          [0.35, 4.3, 0, 'sit'],
          ...failEnd(12, 0.8, 0.3),
        ],
        [
          [0.55, 'bonk', 3.9, 1],
          [0.55, 'sfx:bump', 3.9, 0.2],
          [0.6, 'poof', 3.9, 0.6, 0x9aa5ad],
          [1.2, 'stars', 4.2, 1.6],
        ],
      ),
      mk(
        [
          runIn(),
          [0.2, 2.8, 0, 'crouch'],
          [0.65, 7.0, 0, 'leap', { peak: 3.1 }],
          [0.25, 8.2, 0, 'run'],
          [0.35, 9.0, 1.8, 'flail', { peak: 2.6, spin: -TAU, face: 'wide', hat: 'banana' }],
          [0.25, 9.1, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.25, 9.1, 0.05, 'dizzy', { face: 'dizzy', sy: 1 }],
          ...failEnd(12, 0.35, 0.3),
        ],
        [
          [0.5, 'sfx:whoosh', 3, 0.4],
          [1.35, 'sfx:squeak', 8.2, 0.3],
          [1.7, 'sfx:splat', 9.1, 0.2],
          [1.7, 'bonk', 9.1, 0.9],
          [1.9, 'stars', 9.1, 1.4],
        ],
      ),
    ],
  },
  hopscotch: {
    spec: { length: 11, height: 1.6, floorY: 0 },
    words: ['HOP HOP!', 'ROLL!'],
    clear: [
      mk(
        [
          runIn(),
          ...[3.5, 4.5, 5.5, 6.5, 7.5, 8.5].map((x): Seg => [0.2, x, 0, 'leap', { peak: 0.7 }]),
          [0.3, 10, 0, 'leap', { peak: 0.8 }],
          [0.25, 11, 0, 'run'],
        ],
        [
          [0.45, 'dust', 3.5, 0.05],
          [0.85, 'dust', 5.5, 0.05],
          [1.0, 'word', 6.5, 2.2],
          [1.25, 'dust', 8.5, 0.05],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 3.0, 0, 'crouch'],
          [0.9, 9.0, 0, 'curl', { spin: -TAU * 3 }],
          [0.25, 10, 0, 'leap', { peak: 0.8 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 3.2, 0.4],
          [0.8, 'dust', 4.5, 0.1],
          [1.0, 'word', 6, 2],
          [1.2, 'dust', 8, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.4, 4.6, 0, 'run'],
          [0.3, 5.0, 0, 'splat', { coat: 'chalk', sx: 1.3, sy: 0.5, face: 'wide' }],
          [0.4, 5.2, 0, 'sit', { face: 'sneeze', sy: 1 }],
          [0.5, 8.0, 0, 'run', { face: 'happy' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.65, 'sfx:thud', 5, 0.2],
          [0.7, 'bonk', 5, 0.9],
          [0.7, 'poof', 5, 0.6, 0xffffff],
          [1.25, 'poof', 5.2, 0.9, 0xffffff],
          [1.3, 'stars', 5.2, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.4, SKATE_Y, 'leap', { peak: 1.0 }],
          [0.2, skateX(0.75), SKATE_Y, 'balance', { face: 'wide', spin: 0.25 }],
          [0.2, skateX(0.95), SKATE_Y, 'balance', { spin: -0.5 }],
          [0.2, skateX(1.15), SKATE_Y, 'balance', { spin: 0.5 }],
          [0.25, skateX(1.4), SKATE_Y, 'balance', { spin: -0.25 }],
          [0.3, 8.9, 0, 'flail', { peak: 1.9, spin: TAU, face: 'dizzy' }],
          [0.25, 9.1, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.25, 9.2, 0, 'dizzy', { sy: 1 }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.55, 'sfx:squeak', 4.4, 0.3],
          [0.9, 'sfx:wobble', 6, 0.5],
          [1.4, 'sfx:wobble', 8, 0.5],
          [1.85, 'sfx:splat', 9.1, 0.2],
          [1.85, 'bonk', 9.1, 0.9],
          [2.0, 'stars', 9.1, 1.4],
        ],
      ),
    ],
  },

  // ---------- Rooftops ----------
  chimney: {
    spec: { length: 11, height: 4.5, floorY: 0 },
    words: ['CLIMB!', 'FLIP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.5, 4.5, 4.55, 'climb'],
          [0.25, 6.0, 4.55, 'run'],
          [0.55, 9.6, 0, 'leap', { peak: 5.4 }],
          [0.25, 11, 0, 'run'],
        ],
        [
          [0.6, 'sfx:squeak', 4.5, 2.5],
          [0.95, 'word', 5.6, 5.6],
          [1.7, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.45, 4.5, 4.55, 'climb'],
          [0.6, 9.0, 0, 'leap', { peak: 5.4, spin: -TAU }],
          [0.35, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:squeak', 4.5, 2.5],
          [0.8, 'word', 6, 5.6],
          [1.4, 'dust', 9, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.4, 4.5, 4.55, 'climb'],
          [0.2, 5.6, 4.55, 'run'],
          [0.15, 5.6, 3.4, 'flail', { visible: false }],
          [0.4, 5.6, 3.4, 'flail', { visible: false }],
          [0.3, 5.8, 4.6, 'leap', { peak: 5.5, visible: true, coat: 'soot', face: 'wide' }],
          [0.35, 8.4, 0, 'flail', { face: 'dizzy' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.85, 'sfx:thud', 5.6, 4],
          [1.1, 'poof', 5.6, 3.6, 0x2a2a2e],
          [1.6, 'poof', 5.8, 4.8, 0x2a2a2e],
          [1.6, 'bonk', 5.8, 5],
          [1.7, 'stars', 5.8, 5.4],
          [2.0, 'sfx:thud', 8.4, 0.2],
        ],
      ),
      mk(
        [
          runIn(),
          [0.45, 4.5, 4.55, 'climb'],
          [0.45, 2.8, 3.0, 'flail', { spin: TAU, face: 'wide' }],
          [0.35, 2.6, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.3, 2.6, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.45, 9.0, 0, 'leap', { peak: 5.3, face: 'happy' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [0.65, 'sfx:whoosh', 5.6, 5],
          [0.75, 'poof', 5.4, 5.2, 0xdddddd],
          [0.75, 'bonk', 4.6, 4.8],
          [1.2, 'sfx:thud', 2.6, 0.2],
          [1.25, 'stars', 2.6, 1.3],
        ],
      ),
    ],
  },
  'roof-gap': {
    spec: { length: 12, height: 3.6, floorY: 0 },
    words: ['LEAP!', 'SWING!'],
    clear: [
      mk(
        [
          runIn(),
          [0.15, 3.3, 0, 'crouch'],
          [0.75, 8.0, 1.6, 'leap', { peak: 3.6 }],
          [0.35, 9.4, 1.6, 'run'],
          [0.3, 10.6, 0, 'leap', { peak: 2.6 }],
          [0.25, 12, 0, 'run'],
        ],
        [
          [0.45, 'sfx:whoosh', 3.4, 0.5],
          [0.95, 'word', 6, 4.4],
          [1.15, 'dust', 8, 1.7],
          [1.8, 'dust', 10.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.2, 3.4, 'leap', { peak: 3.9 }],
          [0.2, 4.4, 3.3, 'swing'],
          [0.65, 8.0, 1.6, 'swing', { peak: 4.4 }],
          [0.2, 9.4, 1.6, 'run'],
          [0.3, 10.6, 0, 'leap', { peak: 2.6 }],
          [0.25, 12, 0, 'run'],
        ],
        [
          [0.55, 'sfx:bump', 4.2, 3.4],
          [0.75, 'sfx:wobble', 4.3, 3.5],
          [1.1, 'word', 6.2, 4.6],
          [1.4, 'dust', 8, 1.7],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.15, 3.3, 0, 'crouch'],
          [0.7, 5.8, 0.2, 'leap', { peak: 3.0, face: 'wide' }],
          [0.15, 5.8, 0.2, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.55, 8.4, 1.6, 'leap', { peak: 3.4, face: 'wide' }],
          [0.3, 10.4, 0, 'leap', { peak: 2.4, face: 'happy' }],
          ...failEnd(12, 0.35, 0.3),
        ],
        [
          [0.45, 'sfx:whoosh', 3.4, 0.5],
          [1.1, 'sfx:boing', 5.8, 0.3],
          [1.1, 'bonk', 5.8, 0.9],
          [1.25, 'stars', 5.8, 1.4],
          [1.8, 'dust', 8.4, 1.7],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 3.3, 0, 'crouch'],
          [0.6, 7.4, 0.7, 'leap', { peak: 2.8, face: 'wide' }],
          [0.5, 7.4, 0.7, 'hang', { face: 'wide' }],
          [0.4, 8.0, 1.6, 'climb', { face: 'happy' }],
          [0.3, 10.4, 0, 'leap', { peak: 2.4 }],
          ...failEnd(12, 0.35, 0.3),
        ],
        [
          [0.45, 'sfx:whoosh', 3.4, 0.5],
          [1.0, 'sfx:squeak', 7.4, 1],
          [1.0, 'bonk', 7.4, 1.4],
          [1.2, 'sfx:wobble', 7.4, 1.4],
          [1.4, 'stars', 7.4, 2],
        ],
      ),
    ],
  },
  clothesline: {
    spec: { length: 11, height: 3.5, floorY: 0 },
    words: ['TIPTOE!', 'ZIP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.35, 4.0, 3.4, 'leap', { peak: 4.0 }],
          [0.8, 7.8, 3.4, 'balance'],
          [0.4, 10.0, 0, 'leap', { peak: 3.9 }],
          [0.25, 11, 0, 'run'],
        ],
        [
          [0.6, 'sparkle', 4, 3.5],
          [0.95, 'word', 6, 4.5],
          [1.7, 'dust', 10, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.2, 2.5, 'leap', { peak: 3.4 }],
          [0.8, 7.8, 2.5, 'hang'],
          [0.4, 10.0, 0, 'leap', { peak: 2.9 }],
          [0.25, 11, 0, 'run'],
        ],
        [
          [0.6, 'sfx:squeak', 4.2, 2.8],
          [0.8, 'sfx:whoosh', 6, 2.6],
          [0.95, 'word', 6, 4.2],
          [1.7, 'dust', 10, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.35, 4.0, 3.4, 'leap', { peak: 4.0 }],
          [0.5, 6.0, 3.4, 'balance'],
          [0.35, 6.2, 2.2, 'hang', { face: 'wide' }],
          [0.5, 6.2, 2.0, 'hang'],
          [0.25, 7.4, 0, 'flail'],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [1.1, 'sfx:squeak', 6.2, 2.8],
          [1.5, 'sfx:wobble', 6.2, 2.4],
          [2.05, 'sfx:thud', 7.4, 0.2],
          [2.05, 'bonk', 7.4, 1],
          [2.15, 'stars', 7.4, 1.5],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.0, 3.4, 'leap', { peak: 4.0 }],
          [0.4, 5.4, 3.4, 'balance'],
          [0.4, 5.8, 0, 'flail', { hat: 'sheet', face: 'wide' }],
          [0.3, 5.8, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.5, 8.0, 0, 'run', { face: 'happy' }],
          ...failEnd(11, 0.35, 0.3),
        ],
        [
          [1.0, 'sfx:wobble', 5.4, 3.5],
          [1.0, 'poof', 5.4, 3.4, 0xffffff],
          [1.7, 'sfx:thud', 5.8, 0.2],
          [1.7, 'bonk', 5.8, 1],
          [1.85, 'stars', 5.8, 1.5],
        ],
      ),
    ],
  },
};
