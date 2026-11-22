/**
 * The 12 house obstacles (living room, kitchen, bathroom, bedroom), 48 moves. The numbers are
 * obstacle-local: x = 0 is the entry line, the floor is y = 0. Each cat path was drawn to fit
 * the prop in `props/house.ts`; the shared motions (the shelf tipping, the mop swinging) are
 * exported here so the prop and the cat use the same function.
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

type HouseId = Extract<
  ObstacleId,
  | 'couch'
  | 'bookshelf'
  | 'basket'
  | 'counter'
  | 'mop'
  | 'sink'
  | 'bathtub'
  | 'paper-roll'
  | 'towel'
  | 'bed'
  | 'closet'
  | 'yarn'
>;

const smooth = (u: number) => EASE.io(clamp01(u));

// ---------- Shared motions (the props use these too) ----------

/** The bookshelf tips about its bottom right corner (6, 0): when it starts and how long it takes. */
export const SHELF_TIP = { at: 1.1, dur: 0.7, pivotX: 6, top: 5, edge: -2.4 };
/** Angle (radians, clockwise) the shelf has tipped at time `t` of the fail 1 move. */
export const shelfAngle = (t: number) => (Math.PI / 2) * smooth((t - SHELF_TIP.at) / SHELF_TIP.dur);
/** Where the left edge of the shelf's top has got to as it tips. */
export const shelfTop = (t: number) => {
  const a = shelfAngle(t);
  const { pivotX, top, edge } = SHELF_TIP;
  return {
    x: pivotX + top * Math.sin(a) + edge * Math.cos(a),
    y: -edge * Math.sin(a) + top * Math.cos(a),
  };
};

/** The mop's pivot, its length and its swing: left, to the bottom, to the right, in 2.4 s. */
export const MOP = { x: 5, y: 4.5, len: 3.4, amp: 0.7, period: 2.4 };
export const mopAngle = (t: number) => -MOP.amp * Math.cos((TAU * t) / MOP.period);
export const mopHead = (t: number) => {
  const a = mopAngle(t);
  return { x: MOP.x + MOP.len * Math.sin(a), y: MOP.y - MOP.len * Math.cos(a) };
};

/** The giant paper roll: its centre x. It rolls left; in clear 1 the cat stops it for a moment. */
export const ROLL_R = 1.1;
export function rollX(outcome: Outcome, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 1) {
    if (t < 0.8) return 7.6 - 5 * t;
    if (t < 1.35) return 3.6 + 0.7 * (t - 0.8);
    return 3.99 - 5 * (t - 1.35);
  }
  return 7.6 - 6 * t;
}

/** The towel hangs from (4.6, 3) and is 1.9 long; this is how far it swings, in radians. */
export const TOWEL = { x: 4.6, y: 3, len: 1.9 };
export function towelAngle(outcome: Outcome, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 0) {
    if (t < 0.6) return 0.04 * Math.sin(t * 6);
    return 1.1 * smooth((t - 0.6) / 0.7) * (t < 1.3 ? 1 : Math.max(0, 1 - (t - 1.3) * 1.2));
  }
  if (outcome === 'fail' && variant === 0) return 0.5 * smooth((t - 0.6) / 0.5);
  if (outcome === 'fail' && variant === 1) {
    if (t < 0.6) return 0;
    const fade = t < 1.4 ? 1 : Math.max(0, 1 - (t - 1.4) * 1.5);
    return 0.9 * Math.sin((TAU * (t - 0.6)) / 1.0) * Math.min(1, (t - 0.6) * 4) * fade;
  }
  return 0.04 * Math.sin(t * 6);
}
export const towelEnd = (a: number) => ({
  x: TOWEL.x + TOWEL.len * Math.sin(a),
  y: TOWEL.y - TOWEL.len * Math.cos(a),
});

/** Where the yarn ball's centre is; it rolls away to the right once the cat is on it or tangled. */
export function yarnX(outcome: Outcome, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 0) return t < 0.65 ? 5 : 5 + 4.5 * (t - 0.65);
  if (outcome === 'clear') return 5 + 5.5 * Math.max(0, t - 0.2);
  return 5 + (variant === 0 ? 6 : 5) * Math.max(0, t - 0.2);
}

/** The basket's centre while it tumbles (fail 1). */
export const basketTumbleX = (t: number) => 4.5 + 3.5 * smooth((t - 0.8) / 0.8);

/** The wardrobe door angle (radians, opening towards the camera). */
export function closetDoor(outcome: Outcome, variant: Variant, t: number): number {
  const loop = 0.65 * (1 - Math.cos((TAU * t) / 2.8));
  if (outcome === 'clear' && variant === 0) {
    return 1.35 * smooth((t - 0.1) / 0.4) * (1 - smooth((t - 1.3) / 0.4));
  }
  if (outcome === 'fail' && variant === 0)
    return 1.5 * smooth((t - 0.45) / 0.3) * (1 - smooth((t - 1.4) / 0.4));
  if (outcome === 'fail' && variant === 1) {
    return 1.35 * smooth((t - 0.1) / 0.4) * (1 - smooth((t - 1.6) / 0.4));
  }
  return loop;
}

const mk = (segs: Seg[], events: Move['events']): Move => ({ segs, events });

export const HOUSE_MOVES: Record<HouseId, ObstacleMoves> = {
  // ---------- Living room ----------
  couch: {
    spec: { length: 12, height: 3.3, floorY: 0 },
    words: ['BOING!', 'TIPTOE!'],
    clear: [
      mk(
        [
          runIn(),
          [0.28, 4.8, 0.9, 'leap', { peak: 1.8 }],
          [0.12, 5.1, 0.8, 'land', { sy: 0.8 }],
          [0.75, 10.4, 0, 'leap', { peak: 3.9, spin: -TAU }],
          [0.3, 12, 0, 'run'],
        ],
        [
          [0.53, 'sfx:boing', 5, 1],
          [0.55, 'dust', 5, 0.9],
          [0.95, 'word', 7, 3],
          [1.4, 'dust', 10.4, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 3.6, 1.9, 'leap', { peak: 2.9, z: -0.5 }],
          [0.85, 8.6, 1.9, 'balance', { z: -0.5 }],
          [0.35, 10.4, 0, 'leap', { peak: 2.6, z: 0 }],
          [0.3, 12, 0, 'run'],
        ],
        [
          [0.6, 'sparkle', 4, 2],
          [0.9, 'word', 6.5, 3.2],
          [1.55, 'dust', 10.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.35, 4.8, 0.9, 'leap', { peak: 1.8 }],
          [0.35, 5.4, 0.15, 'splat', { sy: 0.6, face: 'wide' }],
          [0.4, 5.4, 0.25, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.4, 6.4, 2.4, 'leap', { peak: 2.8, hat: 'cushion', face: 'wide' }],
          [0.4, 9.8, 0, 'flail', { peak: 2.4 }],
          ...failEnd(12, 0.3, 0.3),
        ],
        [
          [0.7, 'sfx:squeak', 5.4, 0.9],
          [0.85, 'bonk', 5.4, 1.2],
          [0.9, 'stars', 5.4, 1.6],
          [1.5, 'sfx:boing', 6, 1],
          [2.1, 'dust', 9.8, 0.1],
          [2.65, 'poof', 11.8, 1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.4, 0.9, 'leap', { peak: 1.6 }],
          [0.55, 8.6, 1.3, 'leap', { peak: 4.4, spin: Math.PI, face: 'wide' }],
          [0.35, 8.9, 1.3, 'dizzy', { face: 'dizzy' }],
          [0.3, 9.9, 0, 'flail', { spin: Math.PI }],
          [0.35, 10.0, 0, 'splat', { sx: 1.25, sy: 0.5 }],
          ...failEnd(12, 0.35, 0.3),
        ],
        [
          [0.6, 'sfx:boing', 4.4, 1],
          [1.15, 'bonk', 8.7, 1.8],
          [1.2, 'stars', 8.9, 2.4],
          [1.75, 'sfx:splat', 10, 0.2],
          [1.75, 'dust', 10, 0.1],
        ],
      ),
    ],
  },
  bookshelf: {
    spec: { length: 13, height: 5, floorY: 0 },
    words: ['HOP HOP!', 'FLIP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.22, 3.9, 1.2, 'leap', { peak: 1.9 }],
          [0.2, 4.7, 2.5, 'leap', { peak: 3.2 }],
          [0.2, 5.5, 3.8, 'leap', { peak: 4.5 }],
          [0.2, 6.0, 5.0, 'leap', { peak: 5.7 }],
          [0.7, 10.0, 0, 'leap', { peak: 5.9 }],
          [0.35, 13, 0, 'run'],
        ],
        [
          [0.9, 'word', 6, 5.6],
          [1.6, 'dust', 10, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 3.1, 0.2, 'leap'],
          [0.55, 3.2, 4.6, 'climb'],
          [0.2, 3.7, 5.0, 'leap', { peak: 5.4 }],
          [0.7, 9.5, 0, 'leap', { peak: 5.9, spin: TAU }],
          [0.35, 13, 0, 'run'],
        ],
        [
          [0.9, 'sfx:whoosh', 3.5, 3],
          [1.25, 'word', 6, 5.6],
          [2.0, 'dust', 9.5, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.2, 3.9, 1.2, 'leap', { peak: 1.9 }],
          [0.2, 4.7, 2.5, 'leap', { peak: 3.2 }],
          [0.35, 5.6, 0, 'flail', { peak: 3.4, face: 'wide' }],
          [0.35, 5.8, 0, 'splat', { visible: false }],
          [0.3, 7.2, 0.9, 'leap', { peak: 2.2, visible: true, face: 'dizzy' }],
          [0.3, 8.6, 0, 'land'],
          ...failEnd(13, 0.4, 0.3),
        ],
        [
          [0.6, 'sfx:thud', 5, 3],
          [0.9, 'bonk', 5.8, 1],
          [0.95, 'dust', 5.8, 0.2],
          [1.4, 'stars', 7.2, 1.8],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 3.1, 0.2, 'leap'],
          [0.35, 3.2, 4.6, 'climb'],
          [0.2, 3.6, 5.0, 'leap', { peak: 5.4 }],
          [0.15, 3.6, 5.0, 'balance'],
          ...follow(SHELF_TIP.at, SHELF_TIP.at + SHELF_TIP.dur, 5, shelfTop, 'flail', {
            face: 'wide',
          }),
          [0.25, 11.0, 2.4, 'splat', { sx: 1.2, sy: 0.5 }],
          [0.2, 11.0, 2.4, 'dizzy', { face: 'dizzy' }],
          ...failEnd(13, 0.35, 0.3),
        ],
        [
          [1.1, 'sfx:wobble', 4, 5],
          [1.8, 'bonk', 11, 2.6],
          [1.8, 'sfx:thud', 10, 0.5],
          [1.8, 'dust', 10, 0.2],
          [1.9, 'stars', 11, 3],
        ],
      ),
    ],
  },
  basket: {
    spec: { length: 10, height: 2.3, floorY: 0 },
    words: ['WHOOSH!', 'SPRING!'],
    clear: [
      mk(
        [
          runIn(),
          [0.2, 2.6, 0, 'crouch'],
          [0.75, 7.8, 0, 'leap', { peak: 2.8 }],
          [0.35, 10, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 4.5, 2],
          [0.75, 'word', 5.2, 3.2],
          [1.2, 'dust', 7.8, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.2, 2.7, 0, 'crouch'],
          [0.35, 4.5, 1.3, 'leap', { peak: 2.2 }],
          [0.1, 4.5, 1.2, 'land', { sy: 0.85 }],
          [0.55, 8.4, 0, 'leap', { peak: 3.4, spin: -TAU }],
          [0.3, 10, 0, 'run'],
        ],
        [
          [0.8, 'sfx:boing', 4.5, 1.3],
          [1.1, 'word', 6.2, 3.4],
          [1.5, 'dust', 8.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.2, 2.7, 0, 'crouch'],
          [0.35, 4.5, 0.3, 'leap', { peak: 1.9, face: 'wide' }],
          [0.5, 4.5, 0.2, 'splat', { sy: 0.7 }],
          [0.35, 5.5, 1.9, 'leap', { peak: 2.5, hat: 'sock', sy: 1 }],
          [0.4, 7.0, 0, 'flail', { peak: 2.5 }],
          ...failEnd(10, 0.3, 0.3),
        ],
        [
          [0.8, 'bonk', 4.5, 1],
          [0.8, 'sfx:squeak', 4.5, 1],
          [1.3, 'sfx:boing', 5, 1.5],
          [1.7, 'dust', 7, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.2, 2.7, 0, 'crouch'],
          [0.35, 4.5, 0.5, 'leap', { peak: 1.7, face: 'wide' }],
          ...follow(0.8, 1.6, 4, (t) => ({ x: basketTumbleX(t), y: 0.55 }), 'curl', {
            spin: -TAU * 2,
          }),
          [0.35, 8.8, 0, 'dizzy', { face: 'dizzy', spin: 0 }],
          ...failEnd(10, 0.25, 0.3),
        ],
        [
          [0.8, 'bonk', 4.5, 1],
          [0.85, 'sfx:whoosh', 5, 1],
          [1.6, 'stars', 8.8, 1.6],
          [1.65, 'sfx:thud', 8.5, 0.2],
        ],
      ),
    ],
  },
  // ---------- Kitchen ----------
  counter: {
    spec: { length: 12, height: 2.3, floorY: 0 },
    words: ['POUNCE!', 'ZOOM!'],
    clear: [
      mk(
        [
          runIn(0.25, 1.8),
          [0.4, 3.9, 1.6, 'leap', { peak: 2.5 }],
          [0.55, 7.9, 1.6, 'run'],
          [0.4, 10.2, 0, 'leap', { peak: 2.4 }],
          [0.3, 12, 0, 'run'],
        ],
        [
          [0.9, 'word', 6, 3],
          [1.6, 'dust', 10.2, 0.1],
        ],
      ),
      mk(
        [
          runIn(0.25, 1.8),
          [0.3, 2.6, 0.8, 'leap', { peak: 1.4 }],
          [0.3, 4.0, 1.6, 'leap', { peak: 2.4 }],
          [0.35, 7.0, 1.6, 'run'],
          [0.6, 10.4, 0, 'leap', { peak: 3.4, spin: -TAU }],
          [0.25, 12, 0, 'run'],
        ],
        [
          [1.2, 'word', 8, 4.2],
          [1.8, 'dust', 10.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(0.25, 1.8),
          [0.4, 3.9, 1.6, 'leap', { peak: 2.5 }],
          [0.3, 5.4, 1.6, 'run'],
          [0.5, 8.6, 1.6, 'slide', { face: 'wide' }],
          [0.3, 9.4, 0.8, 'flail', { peak: 1.8 }],
          [0.35, 9.4, 0.8, 'dizzy', { face: 'dizzy' }],
          ...failEnd(12, 0.35, 0.3),
        ],
        [
          [0.97, 'sfx:squeak', 5.6, 1.8],
          [1.7, 'bonk', 9.4, 1.6],
          [1.75, 'sfx:crash', 9.4, 0.8],
          [1.8, 'stars', 9.4, 2],
        ],
      ),
      mk(
        [
          runIn(0.25, 1.8),
          [0.4, 3.9, 1.6, 'leap', { peak: 2.5 }],
          [0.45, 6.0, 1.6, 'run'],
          [0.3, 6.4, 1.6, 'sit', { coat: 'flour', face: 'wide' }],
          [0.4, 6.6, 1.6, 'sit', { face: 'sneeze' }],
          [0.4, 9.2, 0, 'leap', { peak: 2.3, face: 'happy' }],
          ...failEnd(12, 0.3, 0.3),
        ],
        [
          [1.1, 'sfx:thud', 6.2, 2],
          [1.15, 'bonk', 6.4, 2.4],
          [1.15, 'poof', 6.4, 2.2, 0xffffff],
          [1.65, 'sfx:squeak', 6.6, 2.4],
          [2.5, 'poof', 12, 1, 0xffffff],
        ],
      ),
    ],
  },
  mop: {
    spec: { length: 11, height: 4.5, floorY: 0 },
    words: ['HOP!', 'SLIDE!'],
    clear: [
      mk(
        [
          runIn(),
          [0.15, 2.7, 0, 'crouch'],
          [0.65, 7.2, 0, 'leap', { peak: 2.6 }],
          [0.5, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 4, 1],
          [0.8, 'word', 5, 3.4],
          [1.05, 'dust', 7.2, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.2, 2.9, 0, 'crouch'],
          [0.75, 7.8, 0, 'slide'],
          [0.3, 9.4, 0, 'run'],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:splash', 3.3, 0.1],
          [0.7, 'word', 5.4, 2],
          [0.7, 'splash', 5, 0.2],
          [1.1, 'splash', 7.4, 0.2],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.35, 4.9, 0, 'run'],
          ...follow(
            0.6,
            1.25,
            6,
            (t) => {
              const h = mopHead(t);
              return { x: h.x, y: h.y - 0.45 };
            },
            'flail',
            { spin: -TAU * 1.5, face: 'wide' },
          ),
          [0.4, 9.6, 0, 'flail', { peak: 2.4, spin: -TAU * 0.5 }],
          [0.3, 9.6, 0, 'dizzy', { face: 'dizzy' }],
          ...failEnd(11, 0.3, 0.3),
        ],
        [
          [0.62, 'sfx:squeak', 4.9, 1],
          [1.25, 'bonk', 7.2, 1.6],
          [1.65, 'sfx:splat', 9.6, 0.2],
          [1.75, 'stars', 9.6, 1.6],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.2, 0, 'run'],
          [0.5, 5.2, 0.1, 'flail', { face: 'wide' }],
          [0.3, 5.6, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.4, 5.7, 0, 'dizzy', { face: 'dizzy', sx: 1, sy: 1 }],
          [0.6, 11, 0, 'run', { face: 'happy' }],
          [0.3, 11, 0, 'shake'],
          [0.05, 11, 0, 'run'],
        ],
        [
          [0.65, 'sfx:squeak', 4.4, 0.5],
          [1.15, 'bonk', 5.6, 0.8],
          [1.15, 'sfx:splat', 5.6, 0],
          [1.15, 'splash', 5.6, 0.1],
          [1.5, 'stars', 5.7, 1.6],
        ],
      ),
    ],
  },
  sink: {
    spec: { length: 12, height: 2.6, floorY: 0 },
    words: ['LEAP!', 'TIPTOE!'],
    clear: [
      mk(
        [
          runIn(0.25, 1.8),
          [0.3, 3.0, 1.0, 'leap', { peak: 1.7 }],
          [0.15, 3.8, 1.0, 'run'],
          [0.55, 8.2, 1.0, 'leap', { peak: 2.4 }],
          [0.3, 9.0, 1.0, 'run'],
          [0.35, 10.6, 0, 'leap', { peak: 1.8 }],
          [0.25, 12, 0, 'run'],
        ],
        [
          [0.9, 'word', 6, 3.2],
          [1.0, 'bubbles', 6, 0.7],
          [1.9, 'dust', 10.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(0.25, 1.8),
          [0.55, 5.4, 2.4, 'leap', { peak: 3.6 }],
          [0.55, 7.6, 2.4, 'balance'],
          [0.3, 8.6, 1.0, 'leap', { peak: 2.8 }],
          [0.3, 10.6, 0, 'leap', { peak: 1.8 }],
          [0.2, 12, 0, 'run'],
        ],
        [
          [0.8, 'sparkle', 5.4, 2.6],
          [1.0, 'word', 6.4, 3.8],
          [1.2, 'bubbles', 6, 0.7],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(0.25, 1.8),
          [0.3, 3.0, 1.0, 'leap', { peak: 1.7 }],
          [0.45, 6.0, 0.1, 'leap', { peak: 2.0, face: 'wide' }],
          [0.4, 6.0, 0.2, 'splat', { coat: 'foam', sy: 0.8 }],
          [0.2, 6.1, 0.3, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.4, 8.6, 1.0, 'leap', { peak: 2.2 }],
          [0.35, 10.4, 0, 'leap', { peak: 1.9 }],
          ...failEnd(12, 0.2, 0.3),
        ],
        [
          [1.0, 'splash', 6, 0.7],
          [1.0, 'sfx:splash', 6, 0.7],
          [1.0, 'bonk', 6, 1.2],
          [1.1, 'bubbles', 6, 0.9],
          [1.4, 'stars', 6.1, 1.6],
        ],
      ),
      mk(
        [
          runIn(0.25, 1.8),
          [0.3, 3.0, 1.0, 'leap', { peak: 1.7 }],
          [0.45, 6.0, 2.0, 'leap', { peak: 2.6 }],
          [0.3, 6.6, 0.6, 'flail', { coat: 'wet', face: 'wide' }],
          [0.35, 6.8, 0.3, 'dizzy', { face: 'dizzy' }],
          [0.4, 8.8, 1.0, 'leap', { peak: 1.9 }],
          ...failEnd(12, 0.35, 0.3),
        ],
        [
          [0.75, 'sfx:splash', 5.4, 1.5],
          [1.0, 'bonk', 6, 2],
          [1.0, 'splash', 6.3, 0.9],
          [1.4, 'stars', 6.8, 1.6],
        ],
      ),
    ],
  },
  // ---------- Bathroom ----------
  bathtub: {
    spec: { length: 12, height: 2.3, floorY: 0 },
    words: ['BALANCE!', 'WHOOSH!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 3.9, 1.2, 'leap', { peak: 2.0, z: 0.6 }],
          [0.8, 8.1, 1.2, 'balance', { z: 0.6 }],
          [0.35, 10.3, 0, 'leap', { peak: 2.0, z: 0 }],
          [0.25, 12, 0, 'run'],
        ],
        [
          [0.9, 'word', 6, 3],
          [0.9, 'sparkle', 6, 1.8],
          [1.7, 'dust', 10.3, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.2, 2.8, 0, 'crouch'],
          [0.8, 9.4, 0, 'leap', { peak: 3.4 }],
          [0.3, 12, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 4, 2],
          [0.85, 'word', 6, 3.8],
          [1.2, 'dust', 9.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 3.9, 1.2, 'leap', { peak: 2.0, z: 0.6 }],
          [0.2, 5.2, 1.2, 'balance', { z: 0.6 }],
          [0.35, 6.0, 0.8, 'flail', { z: 0, peak: 1.9, face: 'wide' }],
          [0.5, 6.2, 0.8, 'dizzy', { hat: 'duck', face: 'dizzy' }],
          [0.4, 8.4, 1.2, 'leap', { peak: 2.1 }],
          [0.35, 10.3, 0, 'leap', { peak: 1.5 }],
          ...failEnd(12, 0.25, 0.3),
        ],
        [
          [1.0, 'splash', 6, 1],
          [1.0, 'sfx:splash', 6, 1],
          [1.05, 'bonk', 6, 1.4],
          [1.1, 'bubbles', 6, 1],
          [1.4, 'stars', 6.2, 1.8],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 3.9, 1.2, 'leap', { peak: 2.0, z: 0.6 }],
          [0.15, 4.7, 1.2, 'balance', { z: 0.6 }],
          [0.3, 5.2, 0.95, 'flail', { z: 0, face: 'wide' }],
          [0.5, 8.2, 0.95, 'slide'],
          [0.3, 9.8, 0, 'flail', { peak: 1.5 }],
          [0.3, 10.0, 0, 'splat', { sx: 1.25, sy: 0.5 }],
          ...failEnd(12, 0.3, 0.3),
        ],
        [
          [0.95, 'sfx:squeak', 5, 1.2],
          [1.0, 'splash', 5.4, 1],
          [1.45, 'bonk', 8.4, 1.6],
          [1.8, 'sfx:splat', 10, 0.1],
          [1.8, 'dust', 10, 0.1],
        ],
      ),
    ],
  },
  'paper-roll': {
    spec: { length: 12, height: 3.4, floorY: 0 },
    words: ['HOP!', 'ROLL!'],
    clear: [
      mk(
        [
          runIn(),
          [0.15, 2.6, 0, 'crouch'],
          [0.7, 6.4, 0, 'leap', { peak: 3.4 }],
          [0.6, 12, 0, 'run'],
        ],
        [
          [0.75, 'word', 4.5, 4],
          [1.1, 'dust', 6.4, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.55, 3.6, 2.2, 'leap', { peak: 3.2 }],
          [0.55, 4.0, 2.2, 'run'],
          [0.45, 8.6, 0, 'leap', { peak: 3.4 }],
          [0.35, 12, 0, 'run'],
        ],
        [
          [0.8, 'sfx:squeak', 3.6, 2.2],
          [1.05, 'word', 4.2, 3.8],
          [1.8, 'dust', 8.6, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 3.7, 0, 'run'],
          [0.35, 3.9, 0, 'splat', { coat: 'flour', sx: 1.35, sy: 0.35, face: 'wide' }],
          [0.5, 4.2, 0.1, 'flail', { sx: 1, sy: 1, face: 'dizzy' }],
          [0.35, 4.3, 0, 'sit'],
          [0.8, 12, 0, 'run', { face: 'happy' }],
          [0.3, 12, 0, 'shake'],
          [0.05, 12, 0, 'run', { coat: 'none', hat: 'none' }],
        ],
        [
          [0.55, 'bonk', 3.9, 1],
          [0.55, 'sfx:thud', 3.9, 0.2],
          [0.6, 'poof', 3.9, 0.6, 0xffffff],
          [1.2, 'stars', 4.2, 1.6],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.0, 0, 'run'],
          [0.9, 4.8, 0.5, 'curl', { spin: -TAU * 3, coat: 'flour', face: 'dizzy' }],
          [0.35, 4.9, 0, 'dizzy', { spin: 0, face: 'dizzy' }],
          [0.8, 12, 0, 'run', { face: 'happy' }],
          [0.3, 12, 0, 'shake'],
          [0.05, 12, 0, 'run', { coat: 'none', hat: 'none' }],
        ],
        [
          [0.55, 'sfx:whoosh', 4, 1],
          [0.6, 'bonk', 4.4, 1.4],
          [1.4, 'stars', 4.9, 1.6],
        ],
      ),
    ],
  },
  towel: {
    spec: { length: 12, height: 4.4, floorY: 0 },
    words: ['SWING!', 'SPIN!'],
    clear: [
      mk(
        [
          runIn(),
          [0.35, 4.6, 0.2, 'leap', { peak: 1.6 }],
          ...follow(
            0.6,
            1.3,
            5,
            (t) => {
              const e = towelEnd(towelAngle('clear', 0, t));
              return { x: e.x, y: e.y - 0.9 };
            },
            'swing',
          ),
          [0.55, 9.6, 0, 'leap', { peak: 3.2 }],
          [0.3, 12, 0, 'run'],
        ],
        [
          [0.6, 'sfx:squeak', 4.6, 1.2],
          [1.2, 'word', 6.5, 3.6],
          [1.3, 'sfx:whoosh', 7, 1.5],
          [1.7, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 2.8, 0, 'crouch'],
          [0.8, 8.8, 0, 'leap', { peak: 4.3, spin: -TAU }],
          [0.3, 12, 0, 'run', { spin: 0 }],
        ],
        [
          [0.6, 'sfx:whoosh', 4, 3],
          [0.8, 'word', 6, 5],
          [1.2, 'dust', 8.8, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.35, 4.6, 0.2, 'leap', { peak: 1.6 }],
          ...follow(
            0.6,
            1.1,
            3,
            (t) => {
              const e = towelEnd(towelAngle('fail', 0, t));
              return { x: e.x, y: e.y - 0.9 };
            },
            'swing',
          ),
          [0.3, 5.2, 0, 'flail', { coat: 'flour', face: 'wide' }],
          [0.3, 5.3, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.2, 5.4, 0, 'dizzy', { face: 'dizzy', sx: 1, sy: 1 }],
          ...failEnd(12, 0.6, 0.3),
        ],
        [
          [0.6, 'sfx:squeak', 4.6, 1.2],
          [1.4, 'bonk', 5.2, 0.8],
          [1.4, 'splash', 5.2, 0.1],
          [1.4, 'sfx:splash', 5.2, 0.1],
          [1.8, 'stars', 5.4, 1.6],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.6, 0.2, 'leap', { peak: 1.6 }],
          ...follow(
            0.6,
            1.4,
            6,
            (t) => {
              const e = towelEnd(towelAngle('fail', 1, t));
              return { x: e.x, y: Math.max(e.y - 0.9, 0) };
            },
            'swing',
          ),
          [0.3, 6.0, 0, 'flail', { coat: 'wet', face: 'wide' }],
          [0.3, 6.1, 0, 'dizzy', { face: 'dizzy' }],
          ...failEnd(12, 0.6, 0.3),
        ],
        [
          [0.6, 'sfx:squeak', 4.6, 1.2],
          [1.7, 'bonk', 6, 0.8],
          [1.7, 'splash', 6, 0.1],
          [1.7, 'sfx:splash', 6, 0.1],
          [2.0, 'stars', 6.1, 1.6],
        ],
      ),
    ],
  },
  // ---------- Bedroom ----------
  bed: {
    spec: { length: 13, height: 4.8, floorY: 0 },
    words: ['BOING!', 'ZOOM!'],
    clear: [
      mk(
        [
          runIn(),
          [0.28, 3.9, 1.1, 'leap', { peak: 1.9 }],
          [0.27, 4.8, 1.1, 'leap', { peak: 2.8 }],
          [0.27, 5.7, 1.1, 'leap', { peak: 3.4 }],
          [0.27, 6.6, 1.1, 'leap', { peak: 4.0 }],
          [0.55, 10.8, 0, 'leap', { peak: 4.8, spin: -TAU }],
          [0.25, 13, 0, 'run'],
        ],
        [
          [0.53, 'sfx:boing', 3.9, 1.2],
          [0.8, 'sfx:boing', 4.8, 1.2],
          [1.07, 'sfx:boing', 5.7, 1.2],
          [1.34, 'sfx:boing', 6.6, 1.2],
          [1.3, 'word', 6.5, 5.4],
          [1.9, 'dust', 10.8, 0.1],
        ],
      ),
      mk(
        [runIn(), [0.15, 2.8, 0, 'crouch'], [0.85, 9.6, 0, 'slide'], [0.4, 13, 0, 'run']],
        [
          [0.45, 'sfx:whoosh', 3, 0.5],
          [0.8, 'word', 6, 2],
          [0.8, 'dust', 6, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.25, 3.9, 1.1, 'leap', { peak: 1.9 }],
          [0.27, 5.2, 1.1, 'leap', { peak: 3.2 }],
          [0.35, 7.8, 1.5, 'flail', { peak: 4.0, face: 'wide' }],
          [0.35, 8.0, 1.5, 'splat', { visible: false }],
          [0.3, 8.4, 2.2, 'leap', { peak: 2.8, visible: true, face: 'dizzy' }],
          [0.4, 11.0, 0, 'flail', { peak: 2.6 }],
          ...failEnd(13, 0.25, 0.3),
        ],
        [
          [0.5, 'sfx:boing', 3.9, 1.2],
          [0.77, 'sfx:boing', 5.2, 1.2],
          [1.12, 'bonk', 7.8, 1.8],
          [1.12, 'feathers', 7.8, 1.6],
          [1.12, 'sfx:thud', 7.8, 1.5],
          [1.8, 'feathers', 8.4, 2],
          [1.9, 'stars', 8.4, 2.8],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 2.8, 0, 'crouch'],
          [0.4, 5.2, 0, 'slide'],
          [0.5, 8.6, 0, 'slide', { coat: 'dust', face: 'sneeze' }],
          [0.3, 9.8, 0, 'sit'],
          [0.4, 10.0, 0, 'sit', { face: 'sneeze' }],
          ...failEnd(13, 0.4, 0.3),
        ],
        [
          [0.5, 'sfx:whoosh', 3, 0.5],
          [0.85, 'poof', 5.6, 0.4, 0xb8b3ad],
          [1.35, 'bonk', 9.4, 1],
          [1.35, 'poof', 9.4, 0.6, 0xb8b3ad],
          [1.8, 'sfx:squeak', 10, 1],
          [2.7, 'poof', 13, 1, 0xb8b3ad],
        ],
      ),
    ],
  },
  closet: {
    spec: { length: 12, height: 3.8, floorY: 0 },
    words: ['DASH!', 'CLIMB!'],
    clear: [
      mk(
        [
          runIn(),
          [0.25, 4.2, 0, 'run', { z: -0.2 }],
          [0.55, 7.6, 0, 'run', { z: -0.2 }],
          [0.15, 8.4, 0, 'run', { z: 0 }],
          [0.35, 12, 0, 'run'],
        ],
        [
          [0.2, 'sfx:squeak', 4.2, 1.5],
          [0.9, 'word', 6, 3.2],
        ],
      ),
      mk(
        [
          runIn(),
          [0.15, 3.6, 0.4, 'leap', { peak: 0.8 }],
          [0.4, 3.7, 3.4, 'climb'],
          [0.15, 4.5, 3.6, 'leap', { peak: 3.9 }],
          [0.45, 7.2, 3.6, 'run'],
          [0.4, 9.8, 0, 'leap', { peak: 4.4 }],
          [0.25, 12, 0, 'run'],
        ],
        [
          [0.6, 'sfx:whoosh', 3.7, 2],
          [1.1, 'word', 5.4, 4.6],
          [1.8, 'dust', 9.8, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 3.6, 0, 'run', { z: 0.6 }],
          [0.25, 2.6, 0.5, 'flail', { peak: 1.0, face: 'wide' }],
          [0.35, 2.6, 0, 'dizzy', { face: 'dizzy' }],
          ...failEnd(12, 0.9, 0.3),
        ],
        [
          [0.5, 'sfx:thud', 4.6, 1],
          [0.58, 'bonk', 3.2, 1.2],
          [0.6, 'stars', 2.8, 1.6],
        ],
      ),
      mk(
        [
          runIn(),
          [0.25, 4.4, 0, 'run', { z: -0.2 }],
          [0.4, 5.8, 0, 'run', { z: -0.2 }],
          [0.4, 6.0, 0, 'splat', { z: -0.2, face: 'dizzy', visible: false }],
          [0.35, 7.6, 0, 'dizzy', { z: 0, visible: true, hat: 'sweater' }],
          ...failEnd(12, 0.4, 0.3),
        ],
        [
          [0.9, 'sfx:thud', 6, 1],
          [0.95, 'bonk', 6, 1.4],
          [0.95, 'dust', 6, 0.3],
          [1.7, 'stars', 7.6, 1.6],
          [2.35, 'poof', 12, 1, 0x5b7fd6],
        ],
      ),
    ],
  },
  yarn: {
    spec: { length: 12, height: 3, floorY: 0 },
    words: ['POUNCE!', 'LEAP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.4, 5.0, 1.8, 'leap', { peak: 2.9 }],
          [0.65, 7.9, 1.8, 'balance'],
          [0.4, 9.6, 0, 'leap', { peak: 3.0 }],
          [0.3, 12, 0, 'run'],
        ],
        [
          [0.65, 'sfx:squeak', 5, 1.8],
          [0.9, 'word', 6.6, 3.6],
          [1.7, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.2, 2.8, 0, 'crouch'],
          [0.6, 7.4, 0, 'leap', { peak: 2.4 }],
          [0.45, 12, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 4, 1],
          [0.8, 'word', 5.6, 3.4],
          [1.1, 'dust', 7.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 3.7, 0, 'run'],
          [0.8, 8.0, 0.45, 'curl', { spin: -TAU * 3, coat: 'flour', face: 'wide' }],
          [0.3, 8.2, 0, 'dizzy', { spin: 0, face: 'dizzy' }],
          ...failEnd(12, 0.5, 0.3),
        ],
        [
          [0.5, 'sfx:whoosh', 3.5, 1],
          [0.6, 'bonk', 3.9, 1],
          [1.4, 'stars', 8.2, 1.6],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 5.0, 0, 'run'],
          [0.3, 6.3, 0.35, 'flail', { peak: 0.9, face: 'wide' }],
          [0.3, 7.0, 0, 'splat', { sx: 1.2, sy: 0.55 }],
          [0.4, 7.1, 0, 'dizzy', { face: 'dizzy', sx: 1, sy: 1 }],
          ...failEnd(12, 0.5, 0.3),
        ],
        [
          [0.6, 'sfx:squeak', 5, 0.4],
          [1.2, 'bonk', 7, 0.8],
          [1.2, 'sfx:splat', 7, 0],
          [1.6, 'stars', 7.1, 1.6],
        ],
      ),
    ],
  },
};
