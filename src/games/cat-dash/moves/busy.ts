/**
 * The 12 busy obstacles (grocery, library, fish market, construction site), 48 moves. The numbers
 * are obstacle-local: x = 0 is the entry line, the floor is y = 0. Each cat path was drawn to fit
 * the prop in `props/busy.ts`; the shared motions (the cart, the ladder, the barrel, the crane
 * hook, ...) are exported here so the prop and the cat use the same function.
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

type BusyId = Extract<
  ObstacleId,
  | 'cart'
  | 'cereal'
  | 'milk'
  | 'books'
  | 'ladder'
  | 'book-cart'
  | 'crates'
  | 'barrels'
  | 'net'
  | 'girder'
  | 'mixer'
  | 'crane-hook'
>;

const smooth = (u: number) => EASE.io(clamp01(u));

// ---------- Shared motions (the props use these too) ----------

/** The shopping cart's centre x: it rolls right with the cat (clear 0, fail 1) or at it (fail 0). */
export const CART_TOP = 1.5;
export function cartX(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 0) return 6 + 2.4 * smooth((t - 0.55) / 0.6);
  if (outcome === 'fail' && variant === 0) return 6 - 1.4 * smooth((t - 0.25) / 0.35);
  if (outcome === 'fail' && variant === 1) {
    const u = clamp01((t - 0.55) / 0.7);
    return (
      6 +
      1.95 * u * u -
      (t > 1.25 ? 0.25 * Math.sin((t - 1.25) * 12) * (1 - clamp01((t - 1.25) / 0.4)) : 0)
    );
  }
  return 6 + 0.04 * Math.sin(t * 2);
}

/** The cereal tower: a wobble (clear 1) and the topple towards the cat (fail 0). */
export function towerTilt(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 1) {
    const env = Math.sin(Math.PI * clamp01((t - 0.2) / 1.0));
    return 0.1 * env * Math.sin((TAU * t) / 0.5);
  }
  if (outcome === 'fail' && variant === 0) return -1.45 * smooth((t - 0.5) / 0.5) ** 2;
  if (outcome === 'fail' && variant === 1)
    return 0.08 * Math.sin((TAU * t) / 0.45) * clamp01(t / 0.3);
  return 0.03 * Math.sin(t * 2.4);
}
/** The cereal box that falls on the cat's head (fail 1): 0 up on the tower, 1 on the cat. */
export const boxDrop = (t: number) => clamp01((t - 0.45) / 0.4);

/** The milk lid's centre x: the cat surfs on it (clear 1). */
export function lidX(outcome: Outcome | null, variant: Variant, t: number): number {
  return outcome === 'clear' && variant === 1 ? 4.0 + 4.4 * smooth((t - 0.5) / 0.8) : 4.0;
}

/** The library's book stacks: x, height. */
export const STACKS = [
  { x: 4.5, h: 1.2 },
  { x: 5.7, h: 2.2 },
  { x: 6.9, h: 3.0 },
  { x: 8.1, h: 1.8 },
] as const;
/** How far the stacks have fallen over (0 to 1), fail 0. */
export const stackFall = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 0 ? smooth((t - 0.75) / 0.4) : 0;
/** The big book's cover angle (radians; 1.4 open, 0 shut). It claps shut in fail 1. */
export function coverAngle(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'fail' && variant === 1) return 1.4 * (1 - smooth((t - 1.4) / 0.08));
  return 1.4;
}

/** The rolling ladder: its x (base) and how far it has tipped over (radians, top to the right). */
export function ladderX(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 0) return 6 + 2.6 * smooth((t - 0.55) / 0.7);
  if (outcome === 'fail' && variant === 0) return 6 + 3.4 * smooth((t - 0.55) / 0.75);
  return 6;
}
export function ladderTip(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'fail' && variant === 1) return 1.5 * clamp01((t - 0.9) / 0.6) ** 2;
  return 0;
}

/** The book cart's centre x. */
export function bookCartX(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 1) return 6 + 3 * smooth((t - 0.55) / 0.7);
  if (outcome === 'fail' && variant === 0) return 6 + 5.4 * smooth((t - 0.55) / 0.9);
  return 6;
}
/** The books falling on the cat (fail 1): 0 on the cart, 1 on the floor by the cat. */
export const booksDrop = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 1 ? smooth((t - 0.4) / 0.35) : 0;

/** The fish market's crates: the stack falls (fail 0) and the last crate scoots (fail 1). */
export const crateFall = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 0 ? smooth((t - 0.7) / 0.4) : 0;
export function crateX(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'fail' && variant === 1) return 6.9 + 1.5 * smooth((t - 0.7) / 0.8);
  return 6.9;
}
export const crateShake = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 1 && t > 0.7 && t < 1.55 ? Math.sin(t * 38) * 0.07 : 0;

/** The barrels: the third one's x, how far it has tipped (0 up, 1 lying) and its roll. */
export function barrelPose(outcome: Outcome | null, variant: Variant, t: number) {
  if (outcome === 'clear' && variant === 1) {
    const x = 7.0 + 2.6 * smooth((t - 0.9) / 0.7);
    return { x, tip: 0, roll: -(x - 7.0) / 0.6 };
  }
  if (outcome === 'fail' && variant === 1) {
    const x = 7.0 + 3.4 * smooth((t - 1.05) / 0.8);
    return { x, tip: smooth((t - 0.85) / 0.2), roll: -(x - 7.0) / 0.6 };
  }
  return { x: 7.0, tip: 0, roll: 0 };
}

/** The net's bag lifts the cat (fail 0) and the big fish flops (fail 1). */
export const bagUp = (t: number) => smooth((t - 0.95) / 0.25) * (1 - smooth((t - 1.7) / 0.3));
export const fishDrop = (t: number) => clamp01((t - 0.45) / 0.3);

/** The construction girder: its seesaw angle (fail 1). */
export const BEAM = { x: 6, y: 1.5, half: 1.9 };
export function beamAngle(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'fail' && variant === 1) {
    if (t < 1.1) return -0.42 * smooth((t - 0.8) / 0.3);
    return -0.42 + 0.52 * smooth((t - 1.1) / 0.25);
  }
  return 0;
}
/** Where the beam is at x for angle a (the cat rides on it). */
export const beamY = (x: number, a: number) => BEAM.y + (x - BEAM.x) * Math.sin(a);

/** The cement mixer's drum spin (radians) and the cement poured out of its spout (fail 0). */
export function drumSpin(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'fail' && variant === 1) return t * 3 + 6 * smooth((t - 0.9) / 0.5);
  return t * 3;
}
export const pourAmount = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 0 ? Math.sin(Math.PI * clamp01((t - 0.45) / 0.35)) : 0;

/** The crane hook: the point the cable ends at. The cable hangs from `HOOK_PIVOT`. */
export const HOOK_PIVOT = { x: 6, y: 5.2 };
export const HOOK_LEN = 3.7;
/** How far below its point the cat hangs when it holds the hook. */
export const HANG_DY = 1.4;
const hookAt = (a: number) => ({
  x: HOOK_PIVOT.x + HOOK_LEN * Math.sin(a),
  y: HOOK_PIVOT.y - HOOK_LEN * Math.cos(a),
});
const mix = (a: { x: number; y: number }, b: { x: number; y: number }, u: number) => ({
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
});
export function hookPos(outcome: Outcome | null, variant: Variant, t: number) {
  if (outcome === 'clear' && variant === 0) {
    const a = t < 0.55 ? -0.5 : -0.5 + 1.4 * smooth((t - 0.55) / 0.7);
    return hookAt(a * (1 - smooth((t - 1.35) / 0.5)) + 0.0);
  }
  if (outcome === 'clear' && variant === 1) return hookAt(0.5 * Math.sin((TAU * (t - 0.95)) / 2));
  if (outcome === 'fail' && variant === 0) {
    const low = hookAt(0);
    const grab = { x: 4.9, y: 1.7 };
    const up = { x: 7.4, y: 4.4 };
    if (t < 0.4) return low;
    if (t < 0.8) return mix(low, grab, smooth((t - 0.4) / 0.35));
    if (t < 1.5) return mix(grab, up, smooth((t - 0.8) / 0.65));
    return mix(up, low, smooth((t - 1.8) / 0.5));
  }
  if (outcome === 'fail' && variant === 1) {
    const a =
      t < 0.25
        ? 0.9
        : t < 0.85
          ? 0.9 - 1.4 * smooth((t - 0.25) / 0.6)
          : -0.5 + 0.5 * smooth((t - 0.85) / 0.55) * 1.0;
    const damp = t < 1.4 ? 1 : Math.exp(-(t - 1.4) * 1.5);
    return hookAt(t < 1.4 ? a : 0.25 * Math.sin((TAU * (t - 1.4)) / 1.2) * damp);
  }
  return hookAt(0.45 * Math.sin((TAU * t) / 2));
}

const mk = (segs: Seg[], events: Move['events']): Move => ({ segs, events });

/** The cat on the crane hook. */
const onHook = (t: number, outcome: Outcome, variant: Variant) => {
  const h = hookPos(outcome, variant, t);
  return { x: h.x - 0.1, y: Math.max(0, h.y - HANG_DY) };
};

export const BUSY_MOVES: Record<BusyId, ObstacleMoves> = {
  // ---------- Grocery ----------
  cart: {
    spec: { length: 11, height: 2.6, floorY: 0 },
    words: ['WHOOSH!', 'LEAP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 5.2, 1.5, 'leap', { peak: 2.6 }],
          ...follow(0.55, 1.15, 3, (t) => ({ x: cartX('clear', 0, t) - 0.8, y: 1.5 }), 'sit'),
          [0.35, 10.0, 0, 'leap', { peak: 2.6 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.45, 'sfx:boing', 5.2, 1.5],
          [0.9, 'word', 6.5, 3],
          [1.1, 'sfx:whoosh', 7.5, 1.5],
          [1.5, 'dust', 10, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.8, 9.6, 0, 'leap', { peak: 3.4, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'word', 6, 3.5],
          [1.2, 'sparkle', 6, 2],
          [1.4, 'dust', 9.6, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 2.85, 0, 'run', { face: 'wide' }],
          [0.3, 2.2, 0, 'flail', { spin: TAU, face: 'dizzy' }],
          [0.35, 2.2, 0, 'dizzy'],
          [0.4, 4.6, 1.7, 'leap', { peak: 2.7, face: 'wide' }],
          [0.4, 7.8, 0, 'leap', { peak: 2.6 }],
          ...failEnd(11),
        ],
        [
          [0.6, 'sfx:bump', 3.2, 0.8],
          [0.6, 'bonk', 3.2, 0.9],
          [0.7, 'stars', 2.6, 1.5],
          [0.7, 'sfx:squeak', 2.6, 1.2],
          [2.0, 'dust', 7.8, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 5.6, 1.5, 'leap', { peak: 2.6 }],
          ...follow(0.55, 1.25, 4, (t) => ({ x: cartX('fail', 1, t) - 0.4, y: 1.5 }), 'sit', {
            face: 'wide',
          }),
          [0.4, 9.9, 0, 'flail', { peak: 3.0, spin: TAU }],
          [0.3, 9.9, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.9, 'sfx:whoosh', 6.5, 0.5],
          [1.25, 'sfx:crash', 8.8, 1.2],
          [1.25, 'bonk', 8.8, 1.2],
          [1.7, 'sfx:splat', 9.9, 0.2],
          [1.8, 'stars', 9.9, 1.2],
        ],
      ),
    ],
  },
  cereal: {
    spec: { length: 11, height: 4.2, floorY: 0 },
    words: ['CLIMB!', 'SNEAK!'],
    clear: [
      mk(
        [
          runIn(),
          [0.45, 4.7, 3.9, 'climb'],
          [0.2, 5.6, 4.2, 'run'],
          [0.55, 9.8, 0, 'leap', { peak: 5.1, spin: -TAU }],
          [0.4, 11, 0, 'run'],
        ],
        [
          [0.5, 'dust', 4.7, 2],
          [0.95, 'word', 6, 5],
          [1.4, 'dust', 9.8, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 3.0, 0, 'crouch'],
          [0.7, 8.2, 0, 'slide', { sy: 0.7 }],
          [0.5, 11, 0, 'run'],
        ],
        [
          [0.3, 'sfx:wobble', 5.6, 3],
          [0.7, 'word', 5.6, 2.2],
          [1.2, 'sparkle', 8.2, 0.6],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 3.9, 0, 'crouch', { face: 'wide' }],
          [0.35, 4.0, 0, 'splat', { visible: false, face: 'dizzy' }],
          [0.6, 4.0, 0, 'splat', { visible: false }],
          [0.3, 4.3, 0.6, 'leap', { peak: 1.2, visible: true }],
          ...failEnd(11),
        ],
        [
          [0.6, 'sfx:crash', 4.5, 2],
          [0.8, 'bonk', 4.2, 1.2],
          [0.9, 'poof', 4.2, 0.6, 0xe8c27a],
          [1.5, 'stars', 4.3, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.6, 0, 'run', { face: 'wide' }],
          [0.25, 4.9, 0, 'run', { face: 'wide' }],
          [0.45, 6.2, 0, 'dizzy', { hat: 'box', face: 'dizzy' }],
          [0.5, 8.0, 0, 'run', { face: 'squint' }],
          ...failEnd(11),
        ],
        [
          [0.5, 'sfx:wobble', 5.6, 3.8],
          [0.85, 'sfx:thud', 4.9, 1.2],
          [0.85, 'bonk', 4.9, 1.3],
          [0.95, 'stars', 4.9, 1.8],
          [1.7, 'sfx:squeak', 7, 1],
        ],
      ),
    ],
  },
  milk: {
    spec: { length: 11, height: 1.2, floorY: 0 },
    words: ['SPLASH!', 'SURF!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.8, 9.8, 0, 'leap', { peak: 2.2, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'word', 6, 3],
          [1.3, 'splash', 9.8, 0.2],
        ],
      ),
      mk(
        [
          runIn(),
          [0.25, 3.9, 0.12, 'leap', { peak: 0.7 }],
          ...follow(0.5, 1.3, 4, (t) => ({ x: lidX('clear', 1, t) - 0.1, y: 0.12 }), 'surf'),
          [0.3, 9.8, 0, 'leap', { peak: 0.8 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'splash', 4, 0.2],
          [0.8, 'word', 6, 1.8],
          [1.0, 'sfx:slideWhistle', 6, 0.3],
          [1.6, 'splash', 9.8, 0.2],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.2, 0, 'run'],
          [0.7, 7.6, 0.3, 'flail', { spin: TAU * 2, face: 'wide' }],
          [0.3, 7.9, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.4, 8.0, 0, 'dizzy', { sy: 1 }],
          ...failEnd(11),
        ],
        [
          [0.55, 'sfx:slideWhistle', 4.2, 0.5],
          [0.9, 'splash', 5.5, 0.3],
          [1.25, 'sfx:splat', 7.9, 0.2],
          [1.25, 'bonk', 7.9, 1],
          [1.4, 'stars', 8, 1.5],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.2, 0, 'run'],
          [0.3, 4.6, 0, 'crouch'],
          [0.5, 5.0, 0, 'sit', { coat: 'milk', face: 'happy' }],
          [0.4, 6.5, 0, 'run', { face: 'wide' }],
          [0.2, 8.0, 0, 'run'],
          ...failEnd(11),
        ],
        [
          [0.6, 'sfx:splash', 4.6, 0.3],
          [0.85, 'bonk', 5.0, 1.1],
          [0.9, 'poof', 5.0, 0.7, 0xfdfdf5],
          [1.1, 'stars', 5.0, 1.6],
          [1.65, 'sfx:squeak', 6.5, 1],
        ],
      ),
    ],
  },

  // ---------- Library ----------
  books: {
    spec: { length: 11, height: 3.0, floorY: 0 },
    words: ['HOP HOP!', 'SPINES!'],
    clear: [
      mk(
        [
          runIn(),
          [0.25, 4.5, 1.2, 'leap', { peak: 2.0 }],
          [0.2, 5.7, 2.2, 'leap', { peak: 2.9 }],
          [0.2, 6.9, 3.0, 'leap', { peak: 3.7 }],
          [0.45, 9.6, 0, 'leap', { peak: 4.0, spin: -TAU }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:boing', 4.5, 1.2],
          [0.7, 'sfx:boing', 5.7, 2.2],
          [1.05, 'word', 7.5, 4.2],
          [1.55, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.4, 6.9, 3.0, 'leap', { peak: 4.0 }],
          [0.25, 8.1, 1.8, 'leap', { peak: 3.3 }],
          [0.45, 9.8, 0, 'leap', { peak: 2.6, spin: -TAU }],
          [0.4, 11, 0, 'run'],
        ],
        [
          [0.65, 'sfx:boing', 6.9, 3.0],
          [0.9, 'word', 7.5, 4.2],
          [1.2, 'sparkle', 8.1, 2],
          [1.5, 'dust', 9.8, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.5, 1.2, 'leap', { peak: 2.0 }],
          [0.2, 5.7, 2.2, 'leap', { peak: 2.9 }],
          [0.45, 6.4, 0, 'flail', { spin: TAU, face: 'wide' }],
          [0.35, 6.5, 0, 'splat', { sx: 1.3, sy: 0.45, face: 'dizzy' }],
          [0.3, 6.6, 0, 'dizzy', { sy: 1 }],
          [0.3, 8.0, 0, 'run'],
          ...failEnd(11),
        ],
        [
          [0.9, 'sfx:crash', 6.2, 1.8],
          [1.2, 'sfx:thud', 6.5, 0.2],
          [1.2, 'bonk', 6.5, 1],
          [1.35, 'poof', 6.5, 0.5, 0xd8c8a8],
          [1.5, 'stars', 6.5, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.5, 1.2, 'leap', { peak: 2.0 }],
          [0.35, 5.7, 2.2, 'leap', { peak: 2.9 }],
          [0.45, 10.4, 0, 'leap', { peak: 2.9 }],
          [0.4, 10.4, 0, 'flail', { face: 'wide' }],
          [0.35, 10.4, 0.4, 'leap', { peak: 0.9, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [1.45, 'sfx:slap', 9.5, 0.4],
          [1.45, 'bonk', 10.4, 0.9],
          [1.5, 'sfx:squeak', 10.4, 0.8],
          [1.6, 'stars', 10.4, 1.4],
        ],
      ),
    ],
  },
  ladder: {
    spec: { length: 11, height: 4.0, floorY: 0 },
    words: ['RIDE!', 'CLIMB!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 5.5, 1.9, 'leap', { peak: 2.7 }],
          ...follow(0.55, 1.25, 3, (t) => ({ x: ladderX('clear', 0, t) - 0.5, y: 1.9 }), 'hang'),
          [0.4, 10.3, 0, 'leap', { peak: 2.6, spin: -TAU }],
          [0.2, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:squeak', 5.5, 1.9],
          [0.8, 'sfx:whoosh', 6.5, 0.4],
          [1.0, 'word', 7.2, 3.4],
          [1.6, 'dust', 10.3, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.5, 5.4, 3.8, 'climb'],
          [0.15, 5.9, 4.0, 'run'],
          [0.55, 9.6, 0, 'leap', { peak: 4.6, spin: -TAU }],
          [0.4, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:squeak', 5.4, 2],
          [0.95, 'word', 6.5, 5],
          [1.45, 'dust', 9.6, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 5.5, 2.2, 'leap', { peak: 3.0 }],
          ...follow(0.55, 1.3, 3, (t) => ({ x: ladderX('fail', 0, t) - 0.5, y: 1.9 }), 'hang', {
            face: 'wide',
          }),
          [0.3, 8.9, 0, 'flail', { spin: TAU }],
          [0.3, 9.0, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.7, 'sfx:whoosh', 7, 0.3],
          [1.0, 'sfx:squeak', 8, 2.5],
          [1.6, 'sfx:thud', 9, 0.2],
          [1.6, 'bonk', 9, 1],
          [1.75, 'stars', 9, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 5.75, 1.6, 'leap', { peak: 2.4 }],
          [0.35, 5.75, 2.5, 'climb'],
          ...follow(
            0.9,
            1.5,
            4,
            (t) => {
              const a = ladderTip('fail', 1, t);
              return { x: 6 + 2.7 * Math.sin(a) - 0.2, y: Math.max(0, 2.7 * Math.cos(a) - 0.2) };
            },
            'climb',
            { face: 'wide' },
          ),
          [0.35, 9.0, 0, 'flail', { peak: 1.0, spin: TAU }],
          [0.3, 9.1, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.95, 'sfx:wobble', 6, 3],
          [1.5, 'sfx:crash', 8.5, 0.3],
          [1.85, 'sfx:thud', 9, 0.2],
          [1.85, 'bonk', 9, 1],
          [2.0, 'stars', 9.1, 1.4],
        ],
      ),
    ],
  },
  'book-cart': {
    spec: { length: 11, height: 2.6, floorY: 0 },
    words: ['HOP!', 'ROLL!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.8, 9.6, 0, 'leap', { peak: 3.5, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'word', 6, 3.8],
          [1.2, 'sparkle', 6, 2.6],
          [1.4, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 5.6, 2.2, 'leap', { peak: 3.1 }],
          ...follow(0.55, 1.25, 3, (t) => ({ x: bookCartX('clear', 1, t) - 0.3, y: 2.2 }), 'sit'),
          [0.4, 10.4, 0, 'leap', { peak: 3.2 }],
          [0.25, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:boing', 5.6, 2.2],
          [0.8, 'sfx:whoosh', 6.5, 0.4],
          [1.0, 'word', 7.5, 3.6],
          [1.55, 'dust', 10.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 5.6, 2.2, 'leap', { peak: 3.1 }],
          ...follow(0.55, 1.45, 4, (t) => ({ x: bookCartX('fail', 0, t) - 0.4, y: 2.2 }), 'sit', {
            face: 'wide',
          }),
          [0.4, 11, 0, 'flail', { spin: TAU }],
          [0.3, 11, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.7, 'sfx:whoosh', 6.5, 0.4],
          [1.0, 'sfx:squeak', 8, 2.4],
          [1.85, 'sfx:thud', 11, 0.2],
          [1.85, 'bonk', 11, 1],
          [2.0, 'stars', 11, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.3, 0, 'run', { face: 'wide' }],
          [0.35, 4.4, 0, 'splat', { coat: 'dust', sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.45, 4.5, 0, 'dizzy', { sy: 1 }],
          [0.6, 9.0, 0, 'leap', { peak: 3.4, face: 'wide' }],
          ...failEnd(11),
        ],
        [
          [0.55, 'sfx:wobble', 5.4, 2.6],
          [0.8, 'sfx:thud', 4.4, 1.2],
          [0.95, 'bonk', 4.4, 0.9],
          [1.0, 'poof', 4.4, 0.6, 0xb8b3ad],
          [1.3, 'stars', 4.5, 1.4],
        ],
      ),
    ],
  },

  // ---------- Fish market ----------
  crates: {
    spec: { length: 11, height: 2.4, floorY: 0 },
    words: ['HOP HOP!', 'LEAP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.25, 4.5, 1.2, 'leap', { peak: 2.0 }],
          [0.2, 5.7, 2.4, 'leap', { peak: 3.2 }],
          [0.2, 6.9, 1.2, 'leap', { peak: 2.9 }],
          [0.4, 9.6, 0, 'leap', { peak: 2.2 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:thud', 4.5, 1.2],
          [0.7, 'sfx:thud', 5.7, 2.4],
          [0.95, 'word', 7.2, 3.6],
          [1.45, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 3.0, 0, 'crouch'],
          [0.9, 9.7, 0, 'leap', { peak: 3.4, spin: -TAU }],
          [0.4, 11, 0, 'run'],
        ],
        [
          [0.4, 'sfx:whoosh', 3, 0.4],
          [0.9, 'word', 6.2, 3.6],
          [1.2, 'sparkle', 6.2, 2.4],
          [1.6, 'dust', 9.7, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.25, 4.5, 1.2, 'leap', { peak: 2.0 }],
          [0.2, 5.7, 2.4, 'leap', { peak: 3.2 }],
          [0.5, 6.2, 0, 'flail', { spin: TAU, face: 'wide' }],
          [0.3, 6.3, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.4, 6.4, 0, 'dizzy', { sy: 1 }],
          [0.2, 8.0, 0, 'run'],
          ...failEnd(11),
        ],
        [
          [0.85, 'sfx:crash', 6, 2.2],
          [1.2, 'sfx:thud', 6.3, 0.2],
          [1.2, 'bonk', 6.3, 1],
          [1.3, 'poof', 6.3, 0.5, 0xc9a77a],
          [1.5, 'stars', 6.4, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 6.9, 1.2, 'leap', { peak: 2.4 }],
          [0.1, 6.9, 0, 'crouch', { visible: false }],
          ...follow(0.7, 1.5, 4, (t) => ({ x: crateX('fail', 1, t), y: 0 }), 'crouch'),
          [0.3, 8.6, 1.2, 'leap', { peak: 2.0, visible: true, face: 'dizzy' }],
          [0.3, 8.9, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          ...failEnd(11),
        ],
        [
          [0.65, 'sfx:thud', 6.9, 1.2],
          [0.7, 'bonk', 6.9, 1.4],
          [1.1, 'sfx:wobble', 7.5, 1.4],
          [1.5, 'poof', 8.4, 1.2, 0xc9a77a],
          [1.85, 'stars', 8.9, 1.2],
        ],
      ),
    ],
  },
  barrels: {
    spec: { length: 11, height: 1.8, floorY: 0 },
    words: ['HOP HOP!', 'ROLL!'],
    clear: [
      mk(
        [
          runIn(),
          [0.25, 4.6, 1.5, 'leap', { peak: 2.3 }],
          [0.2, 5.8, 1.5, 'leap', { peak: 2.3 }],
          [0.2, 7.0, 1.5, 'leap', { peak: 2.3 }],
          [0.4, 9.4, 0, 'leap', { peak: 2.5 }],
          [0.35, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:thud', 4.6, 1.5],
          [0.7, 'sfx:thud', 5.8, 1.5],
          [0.95, 'word', 7.2, 3],
          [1.3, 'dust', 9.4, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.25, 4.6, 1.5, 'leap', { peak: 2.3 }],
          [0.2, 5.8, 1.5, 'leap', { peak: 2.3 }],
          [0.2, 7.0, 1.5, 'leap', { peak: 2.3 }],
          ...follow(0.9, 1.6, 4, (t) => ({ x: barrelPose('clear', 1, t).x, y: 1.5 }), 'run'),
          [0.25, 10.6, 0, 'leap', { peak: 2.5 }],
          [0.15, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:thud', 4.6, 1.5],
          [1.0, 'sfx:whoosh', 7.5, 1.5],
          [1.2, 'word', 8.4, 3],
          [1.85, 'dust', 10.6, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.6, 1.5, 'leap', { peak: 2.3 }],
          [0.5, 5.8, 1.0, 'crouch', { visible: false }],
          [0.4, 6.3, 1.5, 'leap', { peak: 2.8, visible: true, face: 'happy' }],
          [0.4, 8.2, 0, 'leap', { peak: 2.6 }],
          ...failEnd(11),
        ],
        [
          [0.55, 'sfx:splash', 5.8, 1.2],
          [0.6, 'bonk', 5.8, 1.5],
          [0.6, 'splash', 5.8, 1.4],
          [1.05, 'sfx:squeak', 6.3, 1.8],
          [1.15, 'stars', 6.3, 2.3],
          [1.9, 'dust', 8.2, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.45, 7.0, 1.5, 'leap', { peak: 3.0 }],
          [0.35, 7.0, 1.4, 'balance', { face: 'wide' }],
          ...follow(1.05, 1.85, 4, (t) => ({ x: barrelPose('fail', 1, t).x, y: 1.3 }), 'flail'),
          [0.3, 10.6, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.85, 'sfx:wobble', 7, 1.5],
          [1.1, 'sfx:whoosh', 8, 1],
          [2.15, 'sfx:thud', 10.6, 0.2],
          [2.15, 'bonk', 10.6, 1],
          [2.3, 'stars', 10.6, 1.4],
        ],
      ),
    ],
  },
  net: {
    spec: { length: 11, height: 3.4, floorY: 0 },
    words: ['SLIDE!', 'CLIMB!'],
    clear: [
      mk(
        [
          runIn(),
          [0.25, 4.0, 0, 'crouch'],
          [0.55, 8.0, 0, 'slide', { sy: 0.6 }],
          [0.3, 9.6, 0, 'leap', { peak: 0.9 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 4, 0.4],
          [0.8, 'word', 6, 2.6],
          [1.15, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.45, 5.0, 3.0, 'climb'],
          [0.25, 6.0, 3.4, 'balance'],
          [0.5, 9.8, 0, 'leap', { peak: 4.2, spin: -TAU }],
          [0.4, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:squeak', 5, 1.5],
          [0.95, 'word', 6.5, 4.4],
          [1.45, 'dust', 9.8, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.4, 0, 'run'],
          [0.4, 5.8, 0, 'slide', { sy: 0.7, face: 'wide' }],
          [0.25, 6.0, 1.4, 'hang'],
          [0.5, 6.1, 1.4, 'flail'],
          [0.3, 6.4, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.2, 8.0, 0, 'run'],
          ...failEnd(11),
        ],
        [
          [0.9, 'sfx:squeak', 5.9, 0.8],
          [1.2, 'sfx:wobble', 6, 1.6],
          [2.0, 'sfx:thud', 6.4, 0.2],
          [2.0, 'bonk', 6.4, 1],
          [2.1, 'stars', 6.4, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.8, 0, 'run', { face: 'wide' }],
          [0.45, 5.0, 0, 'splat', { sx: 1.4, sy: 0.3 }],
          [0.5, 5.0, 0, 'splat', { sx: 1.4, sy: 0.3 }],
          [0.3, 5.1, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.3, 8.0, 0, 'run', { face: 'squint' }],
          ...failEnd(11),
        ],
        [
          [0.5, 'sfx:whoosh', 5, 4],
          [0.75, 'sfx:slap', 5, 1],
          [0.75, 'bonk', 5, 1.2],
          [1.0, 'sfx:wobble', 5.4, 1.2],
          [1.45, 'stars', 5.1, 1.5],
        ],
      ),
    ],
  },

  // ---------- Construction site ----------
  girder: {
    spec: { length: 11, height: 1.8, floorY: 0 },
    words: ['BALANCE!', 'BOING!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 4.2, 1.5, 'leap', { peak: 2.2 }],
          [0.65, 7.8, 1.5, 'balance'],
          [0.4, 9.6, 0, 'leap', { peak: 2.4 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:thud', 4.2, 1.5],
          [0.9, 'word', 6, 3.2],
          [1.5, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.2, 1.5, 'leap', { peak: 2.2 }],
          [0.2, 5.6, 1.5, 'run'],
          [0.55, 6.1, 1.5, 'leap', { peak: 3.0, spin: -TAU }],
          [0.4, 9.8, 0, 'leap', { peak: 2.4 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:thud', 4.2, 1.5],
          [0.85, 'sfx:boing', 6, 1.6],
          [1.1, 'word', 6.2, 3.1],
          [1.7, 'dust', 9.8, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.2, 1.5, 'leap', { peak: 2.2 }],
          [0.5, 5.8, 1.5, 'balance', { face: 'wide' }],
          [0.45, 6.2, 0.6, 'flail', { spin: TAU }],
          [0.3, 6.2, 0.6, 'dizzy', { face: 'dizzy' }],
          [0.35, 8.6, 0, 'leap', { peak: 1.8 }],
          ...failEnd(11),
        ],
        [
          [0.7, 'sfx:wobble', 5.4, 1.8],
          [1.2, 'sfx:thud', 6.2, 0.7],
          [1.3, 'bonk', 6.2, 1.2],
          [1.45, 'stars', 6.2, 1.7],
          [1.9, 'dust', 8.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.2, 1.5, 'leap', { peak: 2.2 }],
          [0.25, 6.0, 1.5, 'balance'],
          [0.3, 7.5, beamY(7.5, -0.42), 'slide', { face: 'wide' }],
          [0.35, 9.4, 0, 'flail', { peak: 3.0, spin: TAU }],
          [0.3, 9.5, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.85, 'sfx:wobble', 6, 1.5],
          [1.1, 'sfx:boing', 8, 1],
          [1.75, 'sfx:thud', 9.5, 0.2],
          [1.75, 'bonk', 9.5, 1],
          [1.9, 'stars', 9.5, 1.4],
        ],
      ),
    ],
  },
  mixer: {
    spec: { length: 11, height: 2.8, floorY: 0 },
    words: ['HOP!', 'RUN RUN!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.8, 9.6, 0, 'leap', { peak: 3.9, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'word', 6, 4.2],
          [1.2, 'sparkle', 6, 3],
          [1.4, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 5.4, 2.8, 'leap', { peak: 3.6 }],
          [0.6, 5.6, 2.8, 'run'],
          [0.4, 9.8, 0, 'leap', { peak: 3.4 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.55, 'sfx:thud', 5.4, 2.8],
          [0.9, 'word', 6, 4],
          [1.0, 'sfx:whoosh', 5.8, 2.8],
          [1.65, 'dust', 9.8, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.2, 0, 'run', { face: 'wide' }],
          [0.2, 4.4, 0, 'splat', { coat: 'cement', face: 'squint', sx: 1.2, sy: 0.6 }],
          [0.8, 4.4, 0, 'sit', { face: 'squint', sy: 1 }],
          [0.55, 9.0, 0, 'leap', { peak: 3.4, face: 'wide' }],
          ...failEnd(11),
        ],
        [
          [0.45, 'sfx:splat', 4.4, 0.6],
          [0.55, 'bonk', 4.4, 1],
          [1.0, 'sfx:squeak', 4.4, 1.2],
          [1.55, 'poof', 4.4, 0.6, 0x9a9a9a],
          [1.55, 'sfx:crash', 4.4, 0.6],
          [1.7, 'stars', 6, 3.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 5.4, 2.8, 'leap', { peak: 3.6 }],
          [0.5, 5.5, 2.8, 'run', { face: 'wide' }],
          [0.55, 9.0, 0, 'flail', { peak: 3.9, spin: TAU }],
          [0.3, 9.1, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.55, 'sfx:thud', 5.4, 2.8],
          [0.9, 'sfx:whoosh', 5.5, 2.8],
          [1.15, 'sfx:whoosh', 6, 3],
          [1.6, 'sfx:thud', 9.1, 0.2],
          [1.6, 'bonk', 9.1, 1],
          [1.75, 'stars', 9.1, 1.4],
        ],
      ),
    ],
  },
  'crane-hook': {
    spec: { length: 11, height: 3.4, floorY: 0 },
    words: ['SWING!', 'DUCK!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 4.0, 0.5, 'leap', { peak: 1.2 }],
          ...follow(0.55, 1.25, 4, (t) => onHook(t, 'clear', 0), 'hang'),
          [0.4, 10.4, 0, 'leap', { peak: 2.6, spin: -TAU }],
          [0.25, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:squeak', 4.1, 0.8],
          [0.9, 'sfx:whoosh', 7, 2],
          [1.1, 'word', 8, 3.6],
          [1.65, 'dust', 10.4, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.6, 0, 'crouch'],
          [0.8, 7.8, 0, 'slide', { sy: 0.6 }],
          [0.3, 9.4, 0, 'leap', { peak: 0.8 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.55, 'sfx:whoosh', 5, 1.4],
          [0.9, 'word', 6, 2.6],
          [1.3, 'sfx:wobble', 6, 1.4],
          [1.6, 'dust', 9.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.35, 4.3, 0, 'run', { face: 'wide' }],
          ...follow(0.6, 1.45, 4, (t) => onHook(t, 'fail', 0), 'hang', { face: 'wide' }),
          [0.35, 7.6, 0, 'flail', { spin: TAU }],
          [0.3, 7.8, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.7, 'sfx:squeak', 4.8, 1.2],
          [1.1, 'sfx:wobble', 6, 3],
          [1.8, 'sfx:thud', 7.7, 0.2],
          [1.8, 'bonk', 7.7, 1],
          [1.95, 'stars', 7.8, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.4, 3.5, 0, 'run', { face: 'wide' }],
          [0.2, 3.5, 0, 'crouch'],
          [0.35, 2.6, 0, 'flail', { spin: -TAU, sy: 0.8 }],
          [0.35, 2.6, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.5, 7.0, 0, 'slide', { sy: 0.6 }],
          ...failEnd(11),
        ],
        [
          [0.85, 'sfx:crash', 4.2, 1.3],
          [0.85, 'bonk', 3.6, 1.2],
          [0.95, 'stars', 3.2, 1.6],
          [1.4, 'sfx:wobble', 2.6, 1],
        ],
      ),
    ],
  },
};
