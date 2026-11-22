/**
 * The 12 adventure obstacles (beach, snowy forest, desert, space station), 48 moves. The numbers
 * are obstacle-local: x = 0 is the entry line, the floor is y = 0. Each cat path was drawn to fit
 * the prop in `props/adventure.ts`; the shared motions (the wave, the snowball, the dune, the
 * floating boxes, the airlock doors, ...) are exported here so the prop and the cat use the same
 * function. Pits and cracks are flat dark floor, so the cat never goes below y = 0.
 */
import type { ObstacleId } from '../places';
import type { Outcome, Variant } from '../rules';
import {
  EASE,
  TAU,
  clamp01,
  failEnd,
  fall,
  follow,
  runIn,
  type Move,
  type ObstacleMoves,
  type Seg,
} from './toolkit';

type AdventureId = Extract<
  ObstacleId,
  | 'sandcastle'
  | 'crab'
  | 'wave'
  | 'log'
  | 'snowball'
  | 'ice'
  | 'cactus'
  | 'tumbleweed'
  | 'dune'
  | 'boxes'
  | 'lasers'
  | 'airlock'
>;

const smooth = (u: number) => EASE.io(clamp01(u));

// ---------- Shared motions (the props use these too) ----------

/** The sandcastle: how far it has burst (fail 0) and the chunk that falls on the cat (fail 1). */
export const castleBurst = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 0 ? smooth((t - 0.7) / 0.3) : 0;
export const chunkFall = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 1 ? clamp01((t - 0.4) / 0.4) : 0;

/** The crab's claw: how open it is (1 wide open), and the arm flick that throws the cat (fail 1). */
export function clawOpen(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'fail' && variant === 0) return t < 0.88 ? 1 : 1 - smooth((t - 0.88) / 0.07);
  return 0.5 + 0.5 * Math.sin(t * 4.5);
}
export const clawFlick = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 1 ? smooth((t - 0.5) / 0.1) * (1 - smooth((t - 0.8) / 0.3)) : 0;

/** The wave's surface height at x, and how tall the wave is right now (1 = full). */
export const WAVE = { x0: 4.0, x1: 8.6, peak: 2.6 };
export function waveY(x: number): number {
  const p = (x - WAVE.x0) / (WAVE.x1 - WAVE.x0);
  return p <= 0 || p >= 1 ? 0 : WAVE.peak * Math.sin(Math.PI * p) ** 1.3;
}
export function waveScale(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'fail' && variant === 0) return 1 - 0.88 * smooth((t - 0.55) / 0.55);
  if (outcome === 'fail' && variant === 1) {
    return t < 0.9 ? 1 + 0.3 * smooth((t - 0.6) / 0.3) : 1.3 - 1.18 * smooth((t - 1.3) / 0.5);
  }
  return 1 + 0.05 * Math.sin(t * 2.2);
}

/** The log (a round trunk seen end-on): its centre x; it rolls out from under the cat (fail 1). */
export const LOG_R = 0.9;
export const logX = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 1 ? 6 - 3.2 * smooth((t - 0.75) / 0.8) : 6;

/** The snowball's centre x and whether it has burst (gone). */
export const SNOW_R = 1.1;
export function snowX(outcome: Outcome | null, variant: Variant, t: number): number {
  const base = 7.6 - 6 * t;
  if (outcome === 'clear' && variant === 1) {
    if (t < 0.55) return base;
    if (t < 1.1) return 4.3 - (1.4 * (t - 0.55)) / 0.55;
    return 2.9 - 6 * (t - 1.1);
  }
  if (outcome === 'fail' && variant === 0) {
    if (t < 0.55) return base;
    if (t < 0.7) return 4.3 - (0.7 * (t - 0.55)) / 0.15;
    return 3.6 + 7.0 * smooth((t - 0.7) / 1.2);
  }
  return outcome === null ? 7.6 + 0.2 * Math.sin(t * 1.5) : base;
}
export const snowGone = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && ((variant === 1 && t > 0.58) || (variant === 0 && t > 1.9));

/** The ice pond: how cracked it is (0 to 1) and whether the cracked part is open water. */
export function iceState(outcome: Outcome | null, variant: Variant, t: number) {
  if (outcome === 'fail' && variant === 1) {
    return { crack: clamp01((t - 0.45) / 0.3), broken: t > 0.8 };
  }
  return { crack: 0, broken: false };
}

/** The tumbleweed's centre x and whether it has burst. */
export const TUMBLE_R = 1.0;
export function tumbleX(outcome: Outcome | null, variant: Variant, t: number): number {
  const base = 7.6 - 6 * t;
  if (outcome === 'clear' && variant === 1) {
    return t < 0.55 ? base : 4.3 + 5.5 * smooth((t - 0.55) / 0.9);
  }
  if (outcome === 'fail' && variant === 0) {
    return t < 0.55 ? base : 4.3 + 6.5 * smooth((t - 0.55) / 1.3);
  }
  if (outcome === 'fail' && variant === 1) return Math.max(4.3, base);
  return outcome === null ? 7.6 + 0.2 * Math.sin(t * 1.5) : base;
}
export const tumbleGone = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && ((variant === 0 && t > 1.85) || (variant === 1 && t > 1.4));

/** The dune: its height at x (a smooth hump from x = 3.8 to 9.2). */
export const DUNE = { x0: 3.8, x1: 9.2, h: 3.0 };
export function duneY(x: number): number {
  const p = (x - DUNE.x0) / (DUNE.x1 - DUNE.x0);
  return p <= 0 || p >= 1 ? 0 : DUNE.h * Math.sin(Math.PI * p) ** 2;
}
/** The sand that buries the cat (fail 1): how big the mound is (0 to 1). */
export const moundSize = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 1
    ? smooth((t - 1.35) / 0.2) * (1 - smooth((t - 1.9) / 0.2))
    : 0;

/** The space station's floating boxes: their centres (they bob slowly; the first drifts in fail 1). */
export const FLOAT_BOXES = [
  { x: 4.4, y: 2.3 },
  { x: 6.1, y: 3.3 },
  { x: 7.8, y: 2.5 },
] as const;
export function boxCentre(i: number, outcome: Outcome | null, variant: Variant, t: number) {
  const b = FLOAT_BOXES[i];
  const bob = 0.06 * Math.sin(t * 1.3 + i * 2);
  if (outcome === 'fail' && variant === 1 && i === 0) {
    const out = smooth((t - 0.15) / 0.6) * (1 - smooth((t - 0.95) / 0.65));
    return { x: b.x - 0.7 * out, y: b.y - 1.6 * out + bob };
  }
  return { x: b.x, y: b.y + bob };
}
export const boxSpin = (i: number, t: number) => 0.12 * Math.sin(t * 0.9 + i);

/** The laser gate: the beams hang at these x; is beam `i` on? */
export const BEAMS_X = [5.4, 6.2, 7.0] as const;
export function laserOn(i: number, outcome: Outcome | null, variant: Variant, t: number): boolean {
  if (outcome === 'clear' && variant === 0) {
    const pass = 0.7 + i * 0.11;
    return Math.abs(t - pass) >= 0.3;
  }
  if (outcome === 'clear' && variant === 1) return true;
  if (outcome === 'fail' && variant === 0) return t >= 0.5;
  return (t * 0.8 + i * 0.3) % 1 < 0.6;
}

/** The airlock's two doors (they roll up into the ceiling): how open each is (0 shut, 1 open). */
const openShut = (t: number, open: number, close: number) =>
  smooth((t - open) / 0.3) * (1 - smooth((t - close) / 0.3));
export function doorLift(i: 0 | 1, outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === 'clear' && variant === 0)
    return i === 0 ? openShut(t, 0.15, 0.95) : openShut(t, 0.3, 1.1);
  if (outcome === 'clear' && variant === 1)
    return i === 0 ? openShut(t, 0.2, 1.3) : openShut(t, 0.35, 1.45);
  if (outcome === 'fail' && variant === 0) {
    if (i === 0) return openShut(t, 0.15, 0.95);
    return t < 1.2
      ? smooth((t - 0.3) / 0.3) * (1 - smooth((t - 0.85) / 0.1))
      : smooth((t - 1.6) / 0.3);
  }
  if (outcome === 'fail' && variant === 1)
    return i === 0 ? openShut(t, 0.2, 1.8) : openShut(t, 0.3, 1.9);
  return smooth(0.5 + 0.5 * Math.sin((TAU * t) / 3.2 - i * 0.8) * 1.6 - 0.2);
}

const mk = (segs: Seg[], events: Move['events']): Move => ({ segs, events });

/** The wave surf: a straight run along the surface. */
const surfAt = (t: number) => {
  const x = 4.4 + ((t - 0.55) / 0.65) * 3.6;
  return { x, y: waveY(x) * 1.0 + 0.1 };
};
const lerpX = (t0: number, t1: number, x0: number, x1: number) => (t: number) => {
  const x = x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
  return { x, y: duneY(x) };
};

export const ADVENTURE_MOVES: Record<AdventureId, ObstacleMoves> = {
  // ---------- Beach ----------
  sandcastle: {
    spec: { length: 11, height: 3.2, floorY: 0 },
    words: ['LEAP!', 'FLIP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.85, 9.6, 0, 'leap', { peak: 4.3, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'word', 6, 4.4],
          [1.2, 'sparkle', 6, 3.4],
          [1.45, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.4, 4.6, 2.0, 'climb'],
          [0.2, 5.6, 3.2, 'leap', { peak: 3.8 }],
          [0.6, 9.4, 0, 'leap', { peak: 4.2, spin: -TAU }],
          [0.4, 11, 0, 'run'],
        ],
        [
          [0.5, 'dust', 4.6, 1.5],
          [0.9, 'word', 6.5, 4.4],
          [1.4, 'dust', 9.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.2, 0, 'run', { face: 'wide' }],
          [0.3, 5.9, 0, 'run', { face: 'wide' }],
          [0.4, 7.6, 0.4, 'leap', { peak: 1.2, hat: 'bucket', face: 'dizzy' }],
          [0.4, 8.4, 0, 'dizzy'],
          ...failEnd(11),
        ],
        [
          [0.75, 'sfx:crash', 6, 1.5],
          [0.8, 'poof', 6, 1.2, 0xe6cf93],
          [0.85, 'bonk', 6.4, 1.1],
          [1.0, 'stars', 7, 1.6],
          [1.65, 'sfx:squeak', 8.4, 1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.2, 0, 'run', { face: 'wide' }],
          [0.3, 4.3, 0, 'splat', { coat: 'sand', sx: 1.3, sy: 0.5 }],
          [0.45, 4.4, 0, 'sit', { face: 'sneeze', sy: 1 }],
          [0.55, 8.6, 0, 'leap', { peak: 4.0 }],
          ...failEnd(11),
        ],
        [
          [0.6, 'sfx:thud', 4.3, 1],
          [0.8, 'sfx:splat', 4.3, 0.2],
          [0.8, 'bonk', 4.3, 1],
          [0.9, 'poof', 4.3, 0.6, 0xe6cf93],
          [1.2, 'stars', 4.4, 1.4],
        ],
      ),
    ],
  },
  crab: {
    spec: { length: 11, height: 3.4, floorY: 0 },
    words: ['JUMP!', 'SLIDE!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.85, 9.8, 0, 'leap', { peak: 4.4, spin: -TAU }],
          [0.4, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'word', 6.5, 4.5],
          [1.2, 'sparkle', 6.5, 3.6],
          [1.4, 'dust', 9.8, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.25, 4.0, 0, 'crouch'],
          [0.6, 8.2, 0, 'slide', { sy: 0.7 }],
          [0.3, 9.6, 0, 'leap', { peak: 0.9 }],
          [0.35, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 4, 0.4],
          [0.85, 'word', 6.4, 2.6],
          [1.2, 'sfx:squeak', 8, 3],
          [1.45, 'dust', 9.6, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.25, 4.0, 0, 'crouch'],
          [0.4, 6.2, 0, 'slide', { sy: 0.7 }],
          [0.3, 6.3, 3.6, 'leap', { peak: 4.2, spin: -TAU, face: 'wide' }],
          [0.45, 7.6, 0, 'flail', { spin: TAU }],
          [0.3, 7.8, 0, 'dizzy', { face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.9, 'sfx:squeak', 6.2, 0.6],
          [0.9, 'bonk', 6.2, 1],
          [1.0, 'stars', 6.3, 2],
          [1.5, 'sfx:thud', 7.6, 0.2],
          [1.5, 'dust', 7.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.4, 0, 'run', { face: 'wide' }],
          [0.35, 5.4, 3.5, 'flail', { spin: TAU }],
          [0.45, 8.0, 0, 'flail', { spin: TAU }],
          [0.3, 8.1, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.4, 8.1, 0, 'dizzy', { sy: 1 }],
          ...failEnd(11),
        ],
        [
          [0.55, 'sfx:slap', 5, 1],
          [0.6, 'bonk', 5, 1.4],
          [0.7, 'sfx:whoosh', 5.4, 3],
          [1.35, 'sfx:splat', 8, 0.2],
          [1.5, 'stars', 8.1, 1.4],
        ],
      ),
    ],
  },
  wave: {
    spec: { length: 11, height: 2.8, floorY: 0 },
    words: ['SURF!', 'JUMP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 4.4, waveY(4.4) + 0.1, 'leap', { peak: 1.6 }],
          ...follow(0.55, 1.2, 4, surfAt, 'surf'),
          [0.45, 10.0, 0, 'leap', { peak: 3.0, spin: -TAU }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'splash', 4.4, 0.6],
          [0.7, 'sfx:slideWhistle', 5, 1],
          [1.0, 'word', 6.5, 4],
          [1.25, 'sfx:whoosh', 8, 2],
          [1.7, 'splash', 10, 0.3],
        ],
      ),
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.8, 9.6, 0, 'leap', { peak: 3.9, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'word', 6.3, 4.2],
          [1.2, 'sparkle', 6.3, 3.4],
          [1.4, 'splash', 9.6, 0.2],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.3, 0, 'run', { face: 'wide' }],
          [0.4, 2.8, 0.8, 'flail', { spin: TAU, coat: 'wet' }],
          [0.35, 2.8, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.4, 2.8, 0, 'dizzy', { sy: 1 }],
          [0.45, 8.6, 0, 'run', { face: 'wide' }],
          ...failEnd(11),
        ],
        [
          [0.6, 'sfx:splash', 4.4, 1],
          [0.6, 'splash', 4.4, 1.2],
          [0.65, 'bonk', 4.2, 1.2],
          [0.9, 'stars', 3.2, 1.6],
          [1.3, 'sfx:splat', 2.8, 0.2],
          [1.75, 'sfx:wobble', 6, 1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.5, 6.3, 3.0, 'leap', { peak: 3.8 }],
          [0.35, 7.5, 0, 'flail', { hat: 'seaweed', face: 'wide', spin: TAU }],
          [0.3, 7.6, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.4, 7.7, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.25, 9.0, 0, 'run'],
          ...failEnd(11),
        ],
        [
          [0.5, 'sfx:whoosh', 6.6, 3],
          [0.85, 'sfx:slap', 6.4, 3],
          [0.9, 'bonk', 6.4, 3],
          [1.2, 'sfx:splat', 7.6, 0.2],
          [1.3, 'splash', 7.6, 0.3],
          [1.5, 'stars', 7.7, 1.4],
        ],
      ),
    ],
  },

  // ---------- Snowy forest ----------
  log: {
    spec: { length: 11, height: 2.2, floorY: 0 },
    words: ['HOP!', 'TIPTOE!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.7, 9.2, 0, 'leap', { peak: 3.3 }],
          [0.5, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.7, 'word', 6, 3.4],
          [1.1, 'dust', 9.2, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 5.8, 1.8, 'leap', { peak: 2.7 }],
          [0.4, 6.2, 1.8, 'run'],
          [0.45, 9.2, 0, 'leap', { peak: 2.8 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:thud', 5.8, 1.8],
          [0.8, 'word', 6.2, 3],
          [1.45, 'dust', 9.2, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.4, 0, 'run'],
          [0.35, 5.2, 1.2, 'leap', { peak: 1.9, face: 'wide' }],
          [0.55, 8.2, 0, 'flail', { peak: 2.4, spin: -TAU }],
          [0.35, 8.3, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.35, 8.4, 0, 'dizzy', { sy: 1 }],
          ...failEnd(11),
        ],
        [
          [0.7, 'sfx:squeak', 5.2, 1.4],
          [1.45, 'sfx:splat', 8.3, 0.2],
          [1.45, 'bonk', 8.3, 1],
          [1.6, 'poof', 8.3, 0.4, 0xffffff],
          [1.7, 'stars', 8.4, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 6.0, 1.8, 'leap', { peak: 2.8 }],
          [0.15, 6.0, 1.8, 'balance'],
          [0.7, 6.0, 1.8, 'run', { face: 'wide' }],
          [0.35, 6.4, 0, 'flail', { spin: TAU }],
          [0.3, 6.5, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.6, 'sfx:thud', 6, 1.8],
          [0.9, 'sfx:roll', 5, 0.9],
          [1.2, 'sfx:wobble', 6, 2],
          [1.95, 'sfx:splat', 6.5, 0.2],
          [1.95, 'bonk', 6.5, 1],
          [2.1, 'stars', 6.5, 1.4],
        ],
      ),
    ],
  },
  snowball: {
    spec: { length: 11, height: 2.2, floorY: 0 },
    words: ['HOP!', 'ROLL!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.75, 7.6, 0, 'leap', { peak: 3.3, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.7, 'word', 5.5, 3.6],
          [1.15, 'sparkle', 7.6, 0.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.4, 2.2, 'leap', { peak: 3.0 }],
          ...follow(0.55, 1.1, 3, (t) => ({ x: snowX('clear', 1, t) + 0.1, y: 2.2 }), 'run'),
          [0.35, 6.6, 0, 'leap', { peak: 3.0 }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:thud', 4.4, 2.2],
          [0.8, 'word', 4, 3.6],
          [0.85, 'sfx:roll', 3.8, 1.2],
          [1.4, 'dust', 6.6, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 3.0, 0, 'run', { face: 'wide' }],
          [0.15, 3.3, 1.1, 'curl', { sx: 0.6, sy: 0.6, z: 1.0, face: 'wide' }],
          ...follow(0.7, 1.9, 5, (t) => ({ x: snowX('fail', 0, t), y: 1.1 }), 'curl', {
            sx: 0.6,
            sy: 0.6,
            z: 1.0,
          }),
          [0.25, 10.8, 0, 'leap', { peak: 1.5, sx: 1, sy: 1, z: 0, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.6, 'sfx:thud', 3.4, 1],
          [0.65, 'bonk', 3.4, 1.2],
          [1.0, 'sfx:roll', 6, 1],
          [1.9, 'poof', 10.5, 1, 0xffffff],
          [1.95, 'sfx:squeak', 10.8, 1.2],
          [2.0, 'stars', 10.8, 1.5],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 3.0, 0, 'run', { face: 'wide' }],
          [0.25, 3.3, 0, 'splat', { coat: 'snow', sx: 1.3, sy: 0.5 }],
          [0.5, 3.4, 0, 'sit', { face: 'squint', sy: 1 }],
          [0.5, 8.0, 0, 'run', { face: 'squint' }],
          ...failEnd(11),
        ],
        [
          [0.58, 'sfx:crash', 3.4, 1],
          [0.6, 'poof', 3.4, 1, 0xffffff],
          [0.65, 'bonk', 3.4, 1.1],
          [0.9, 'stars', 3.4, 1.6],
          [1.4, 'sfx:wobble', 4, 1],
        ],
      ),
    ],
  },
  ice: {
    spec: { length: 11, height: 1.0, floorY: 0 },
    words: ['SKATE!', 'LEAP!'],
    clear: [
      mk(
        [
          runIn(),
          [0.9, 8.4, 0, 'balance'],
          [0.35, 10.0, 0, 'leap', { peak: 0.7 }],
          [0.25, 11, 0, 'run'],
        ],
        [
          [0.4, 'sfx:slideWhistle', 4, 0.4],
          [0.8, 'word', 6, 2],
          [1.1, 'sparkle', 8, 0.4],
          [1.3, 'dust', 10, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.8, 9.0, 0, 'leap', { peak: 2.0, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.7, 'word', 6, 2.8],
          [1.15, 'sparkle', 9, 0.4],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.2, 0, 'run'],
          [0.5, 5.8, 0, 'flail', { peak: 1.3, spin: TAU }],
          [0.5, 7.4, 0, 'flail', { peak: 1.3, spin: TAU, face: 'dizzy' }],
          [0.3, 7.6, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.25, 8.4, 0, 'dizzy', { sy: 1 }],
          ...failEnd(11),
        ],
        [
          [0.6, 'sfx:squeak', 4.5, 0.8],
          [0.8, 'sfx:slideWhistle', 5, 1],
          [1.7, 'sfx:splat', 7.6, 0.2],
          [1.7, 'bonk', 7.6, 1],
          [1.85, 'stars', 7.7, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.8, 0, 'run', { face: 'wide' }],
          [0.3, 5.9, 0, 'splat', { coat: 'wet', sx: 1.3, sy: 0.5 }],
          [0.5, 6.0, 0, 'sit', { face: 'squint', sy: 1 }],
          [0.4, 8.6, 0, 'leap', { peak: 1.6 }],
          ...failEnd(11),
        ],
        [
          [0.65, 'sfx:crash', 5.9, 0.4],
          [0.85, 'sfx:splash', 5.9, 0.4],
          [0.85, 'splash', 5.9, 0.4],
          [0.9, 'bonk', 5.9, 1],
          [1.1, 'stars', 6, 1.5],
          [1.8, 'sfx:wobble', 8, 1],
        ],
      ),
    ],
  },

  // ---------- Desert ----------
  cactus: {
    spec: { length: 11, height: 3.4, floorY: 0 },
    words: ['LEAP!', 'SLIDE!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.85, 9.6, 0, 'leap', { peak: 4.4, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'word', 6, 4.5],
          [1.2, 'sparkle', 6, 3.6],
          [1.45, 'dust', 9.6, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.25, 3.8, 0, 'crouch'],
          [0.5, 7.4, 0, 'slide', { sy: 0.6 }],
          [0.3, 9.4, 0, 'leap', { peak: 1.4 }],
          [0.35, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 3.8, 0.4],
          [0.8, 'word', 5.8, 2.4],
          [1.3, 'dust', 9.4, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.5, 8.4, 0.9, 'leap', { peak: 3.2 }],
          [0.25, 8.4, 0.9, 'splat', { sx: 1.2, sy: 0.6, face: 'wide' }],
          [0.4, 8.8, 3.8, 'leap', { peak: 4.5, spin: TAU, face: 'wide' }],
          [0.4, 9.4, 0, 'flail'],
          [0.3, 9.5, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.7, 'sfx:squeak', 8.4, 1],
          [0.8, 'bonk', 8.4, 1.2],
          [0.95, 'sfx:squeak', 8.6, 2],
          [1.0, 'stars', 8.8, 2.4],
          [1.7, 'sfx:thud', 9.5, 0.2],
          [1.75, 'poof', 9.5, 0.4, 0xe6cf93],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.4, 0, 'run', { face: 'wide' }],
          [0.5, 4.7, 0.3, 'climb', { coat: 'puff', face: 'wide' }],
          [0.4, 4.7, 0.3, 'dizzy', { face: 'dizzy' }],
          [0.55, 9.0, 0, 'leap', { peak: 3.0, face: 'wide' }],
          ...failEnd(11),
        ],
        [
          [0.6, 'sfx:squeak', 4.5, 0.8],
          [0.8, 'bonk', 4.7, 1],
          [0.85, 'sfx:hiss', 4.7, 1],
          [1.2, 'stars', 4.7, 1.5],
          [1.65, 'sfx:boing', 6, 2],
        ],
      ),
    ],
  },
  tumbleweed: {
    spec: { length: 11, height: 2.2, floorY: 0 },
    words: ['HOP!', 'ROLL!'],
    clear: [
      mk(
        [
          runIn(),
          [0.1, 2.6, 0, 'crouch'],
          [0.75, 7.6, 0, 'leap', { peak: 3.0, spin: -TAU }],
          [0.45, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.7, 'word', 5.5, 3.4],
          [1.15, 'sparkle', 7.6, 0.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.3, 0.2, 'leap', { peak: 1.2 }],
          ...follow(0.55, 1.45, 4, (t) => ({ x: tumbleX('clear', 1, t), y: 0.1 }), 'run'),
          [0.3, 10.6, 0, 'leap', { peak: 0.9 }],
          [0.2, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:whoosh', 4.3, 0.8],
          [0.9, 'word', 6.5, 2.4],
          [1.0, 'sfx:roll', 7, 0.4],
          [1.75, 'dust', 10.6, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.3, 0.3, 'run', { face: 'wide' }],
          ...follow(0.55, 1.85, 5, (t) => ({ x: tumbleX('fail', 0, t), y: 0.7 }), 'flail', {
            spin: TAU * 2,
            face: 'dizzy',
          }),
          [0.25, 10.9, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          ...failEnd(11),
        ],
        [
          [0.55, 'sfx:wobble', 4.3, 1],
          [0.6, 'bonk', 4.3, 1.1],
          [1.0, 'sfx:roll', 6, 1],
          [1.85, 'poof', 10.8, 1, 0x9a7a4a],
          [2.0, 'stars', 10.9, 1.4],
        ],
      ),
      mk(
        [
          runIn(),
          [0.3, 4.2, 0, 'run', { face: 'wide' }],
          [0.5, 4.4, 0.3, 'flail', { face: 'wide', spin: TAU }],
          [0.4, 4.5, 0, 'splat', { coat: 'dust', sx: 1.3, sy: 0.5 }],
          [0.3, 4.6, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.3, 8.0, 0, 'run', { face: 'squint' }],
          ...failEnd(11),
        ],
        [
          [0.55, 'sfx:wobble', 4.3, 1],
          [0.6, 'bonk', 4.3, 1.1],
          [1.0, 'sfx:squeak', 4.4, 1.2],
          [1.4, 'poof', 4.4, 1, 0x9a7a4a],
          [1.5, 'stars', 4.5, 1.4],
        ],
      ),
    ],
  },
  dune: {
    spec: { length: 11, height: 3.0, floorY: 0 },
    words: ['SURF!', 'JUMP!'],
    clear: [
      mk(
        [
          runIn(),
          ...follow(0.25, 1.0, 3, lerpX(0.25, 1.0, 2.2, 6.5), 'run'),
          ...follow(1.0, 1.7, 4, lerpX(1.0, 1.7, 6.5, 9.2), 'surf'),
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.9, 'sfx:whoosh', 6.5, 3.2],
          [1.2, 'word', 7.4, 3.2],
          [1.5, 'sparkle', 8.6, 1],
          [1.8, 'dust', 10, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          ...follow(0.25, 0.85, 3, lerpX(0.25, 0.85, 2.2, 6.5), 'run'),
          [0.7, 10.2, 0, 'leap', { peak: 4.0, spin: -TAU }],
          [0.35, 11, 0, 'run'],
        ],
        [
          [0.9, 'sfx:boing', 6.5, 3.1],
          [1.2, 'word', 8, 4.2],
          [1.55, 'dust', 10.2, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          ...follow(0.25, 0.75, 3, lerpX(0.25, 0.75, 2.2, 5.6), 'run', { face: 'wide' }),
          ...follow(0.75, 1.15, 3, lerpX(0.75, 1.15, 5.6, 3.6), 'flail', { spin: TAU }),
          [0.25, 3.6, 0, 'dizzy', { face: 'dizzy' }],
          [0.7, 10.2, 0, 'leap', { peak: 4.0, spin: -TAU, face: 'wide' }],
          ...failEnd(11),
        ],
        [
          [0.8, 'sfx:squeak', 5.6, 2.4],
          [1.0, 'sfx:slideWhistle', 4.6, 1.2],
          [1.15, 'sfx:thud', 3.6, 0.2],
          [1.15, 'bonk', 3.6, 1],
          [1.3, 'stars', 3.6, 1.4],
          [2.05, 'dust', 10.2, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          ...follow(0.25, 0.7, 3, lerpX(0.25, 0.7, 2.2, 6.5), 'run'),
          ...follow(0.7, 1.15, 3, lerpX(0.7, 1.15, 6.5, 8.4), 'surf', { face: 'wide' }),
          [0.25, 8.6, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.4, 8.6, 0, 'splat', { visible: false }],
          [0.25, 8.9, 0.6, 'leap', { peak: 1.4, visible: true, face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.9, 'sfx:whoosh', 6.5, 3.2],
          [1.2, 'sfx:crash', 8.5, 0.3],
          [1.25, 'bonk', 8.5, 1],
          [1.4, 'poof', 8.6, 0.8, 0xe6cf93],
          [1.8, 'poof', 8.8, 0.6, 0xe6cf93],
          [1.95, 'stars', 8.9, 1.4],
        ],
      ),
    ],
  },

  // ---------- Space station ----------
  boxes: {
    spec: { length: 11, height: 3.8, floorY: 0 },
    words: ['BOING!', 'FLOAT!'],
    clear: [
      mk(
        [
          runIn(),
          [0.35, 4.4, 2.8, 'leap', { peak: 3.8 }],
          [0.3, 6.1, 3.8, 'leap', { peak: 4.6 }],
          [0.3, 7.8, 3.0, 'leap', { peak: 4.2 }],
          [0.5, 10.2, 0, 'leap', { peak: 3.8, spin: -TAU }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:boing', 4.4, 2.8],
          [0.8, 'sfx:boing', 6.1, 3.8],
          [1.0, 'word', 7, 5],
          [1.3, 'sfx:boing', 7.8, 3],
          [1.8, 'dust', 10.2, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.9, 8.2, 0.2, 'leap', { peak: 0.5, spin: -TAU }],
          [0.4, 9.8, 0, 'leap', { peak: 0.6 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.4, 'sfx:slideWhistle', 4, 0.8],
          [0.8, 'word', 6, 1.8],
          [1.0, 'sparkle', 6, 0.8],
          [1.55, 'dust', 9.8, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.55, 5.4, 3.4, 'leap', { peak: 4.1, spin: -TAU, face: 'wide' }],
          [0.9, 3.2, 0, 'flail', { peak: 4.3, spin: TAU }],
          [0.35, 7.6, 0, 'run', { face: 'dizzy' }],
          ...failEnd(11),
        ],
        [
          [0.5, 'sfx:slideWhistle', 4, 1.6],
          [0.8, 'sfx:bump', 5.9, 3.4],
          [0.8, 'bonk', 5.9, 3.4],
          [0.9, 'stars', 5.6, 4.2],
          [1.6, 'sfx:squeak', 3.8, 3],
          [1.7, 'sfx:thud', 3.2, 0.2],
        ],
      ),
      mk(
        [
          runIn(),
          [0.25, 2.9, 0, 'run', { face: 'wide' }],
          [0.25, 2.9, 0, 'trot', { face: 'wide' }],
          [0.4, 2.2, 1.0, 'flail', { peak: 1.4, spin: TAU, face: 'dizzy' }],
          [0.5, 2.3, 0, 'dizzy'],
          [0.5, 8.0, 0, 'run', { face: 'squint' }],
          ...failEnd(11),
        ],
        [
          [0.3, 'sfx:slideWhistle', 3.8, 1.6],
          [0.75, 'sfx:bump', 3.4, 1],
          [0.75, 'bonk', 3.4, 1.1],
          [0.9, 'stars', 3, 1.6],
          [1.5, 'sfx:wobble', 2.4, 1],
        ],
      ),
    ],
  },
  lasers: {
    spec: { length: 11, height: 3.6, floorY: 0 },
    words: ['TIMING!', 'LIMBO!'],
    clear: [
      mk(
        [runIn(), [0.9, 8.6, 0, 'leap', { peak: 2.2, spin: -TAU }], [0.5, 11, 0, 'run']],
        [
          [0.5, 'sfx:whoosh', 3.5, 1.6],
          [1.0, 'word', 6.5, 3.4],
          [1.2, 'sparkle', 7, 2],
          [1.55, 'dust', 10, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.25, 4.2, 0, 'crouch'],
          [0.6, 8.0, 0, 'slide', { sy: 0.6 }],
          [0.3, 9.6, 0, 'leap', { peak: 0.8 }],
          [0.35, 11, 0, 'run'],
        ],
        [
          [0.5, 'sfx:laser', 5.4, 2],
          [0.85, 'word', 6.2, 2.6],
          [1.3, 'dust', 9.6, 0.1],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.4, 5.4, 2.0, 'leap', { peak: 2.6 }],
          [0.3, 5.6, 0, 'flail', { coat: 'puff', face: 'wide', spin: TAU }],
          [0.3, 5.7, 0, 'splat', { sx: 1.3, sy: 0.5 }],
          [0.35, 5.8, 0, 'dizzy', { face: 'dizzy', sy: 1 }],
          [0.55, 8.4, 0, 'slide', { sy: 0.6 }],
          ...failEnd(11),
        ],
        [
          [0.5, 'sfx:laser', 5.4, 2],
          [0.65, 'sfx:zap', 5.4, 2],
          [0.65, 'sfx:hiss', 5.5, 2],
          [0.65, 'bonk', 5.5, 2],
          [0.8, 'stars', 5.6, 2.4],
          [1.25, 'sfx:thud', 5.7, 0.2],
        ],
      ),
      mk(
        [
          runIn(),
          [0.4, 5.0, 0, 'run', { z: -1.0 }],
          [0.4, 7.4, 0, 'run', { z: -2.4 }],
          [0.3, 7.5, 0.3, 'splat', { sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.4, 7.6, 0, 'dizzy', { sy: 1 }],
          [0.35, 9.0, 0, 'run', { z: 0, face: 'squint' }],
          ...failEnd(11),
        ],
        [
          [0.3, 'sfx:squeak', 3.5, 0.8],
          [1.05, 'sfx:thud', 7.5, 0.6],
          [1.05, 'bonk', 7.5, 1],
          [1.2, 'stars', 7.5, 1.6],
          [1.7, 'sfx:wobble', 7.6, 1],
        ],
      ),
    ],
  },
  airlock: {
    spec: { length: 11, height: 3.8, floorY: 0 },
    words: ['DASH!', 'FLOAT!'],
    clear: [
      mk(
        [
          runIn(),
          [0.3, 4.4, 0, 'run'],
          [0.7, 8.6, 0, 'run', { sx: 1.15 }],
          [0.45, 11, 0, 'run', { sx: 1 }],
        ],
        [
          [0.3, 'sfx:whoosh', 4, 0.5],
          [0.6, 'sfx:whoosh', 5.3, 1],
          [0.95, 'word', 7, 2.6],
          [1.3, 'dust', 9, 0.1],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.4, 1.0, 'leap'],
          [0.6, 8.0, 1.2, 'leap'],
          [0.4, 10.0, 0, 'leap', { peak: 0.5 }],
          [0.3, 11, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 3.5, 0.8],
          [0.8, 'word', 6.5, 2.8],
          [1.0, 'bubbles', 6.5, 1.4],
          [1.5, 'bubbles', 10, 0.8],
        ],
      ),
    ],
    fail: [
      mk(
        [
          runIn(),
          [0.3, 4.4, 0, 'run'],
          [0.35, 7.7, 0, 'run', { face: 'wide' }],
          [0.7, 7.7, 0, 'flail', { face: 'wide' }],
          [0.3, 8.0, 0.5, 'leap', { peak: 1.0 }],
          [0.25, 8.8, 0, 'run'],
          ...failEnd(11),
        ],
        [
          [0.3, 'sfx:whoosh', 4, 0.5],
          [0.9, 'sfx:slap', 7.1, 1],
          [0.9, 'bonk', 7.2, 1],
          [1.0, 'sfx:squeak', 7.5, 1],
          [1.3, 'stars', 7.7, 1.6],
          [1.7, 'sfx:boing', 8, 0.8],
        ],
      ),
      mk(
        [
          runIn(),
          [0.35, 4.4, 0, 'run', { face: 'wide' }],
          [0.6, 8.0, 1.6, 'flail', { spin: TAU * 2, face: 'wide' }],
          [0.3, 9.0, 1.0, 'flail', { z: -0.2 }],
          [0.3, 9.2, 0.9, 'splat', { z: -0.2, sx: 1.3, sy: 0.5, face: 'dizzy' }],
          [0.35, 10.4, 0, 'leap', { peak: 1.5, z: 0, sx: 1, sy: 1 }],
          ...failEnd(11),
        ],
        [
          [0.5, 'sfx:whoosh', 5, 1],
          [0.9, 'sfx:whoosh', 7, 1.6],
          [1.5, 'sfx:crash', 9.2, 0.9],
          [1.5, 'bonk', 9.2, 1.2],
          [1.7, 'stars', 9.2, 1.8],
          [1.95, 'sfx:squeak', 10, 1.2],
        ],
      ),
    ],
  },
};

void fall;
