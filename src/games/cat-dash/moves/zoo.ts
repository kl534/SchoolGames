/**
 * The 3 obstacles of the zoo (elephant, giraffe, penguins), 12 moves. Numbers are
 * obstacle-local: x = 0 is the entry line, the floor is y = 0. Each cat path was drawn to fit the
 * prop in `props/zoo.ts`; the motions the props share (the trunk, the neck, the penguins) are
 * exported for it. The ice is flat on the floor, so the cat never goes below y = 0.
 */
import type { ObstacleId } from '../places';
import type { Outcome, Variant } from '../rules';
import {
  EASE,
  TAU,
  clamp01,
  failEnd,
  follow,
  lerp,
  runIn,
  type Move,
  type ObstacleMoves,
  type Seg,
} from './toolkit';

export type ZooId = Extract<ObstacleId, 'elephant' | 'giraffe' | 'penguins'>;

const smooth = (u: number) => EASE.io(clamp01(u));
const mk = (segs: Seg[], events: Move['events']): Move => ({ segs, events });
/** 0 to 1 and back to 0: up from `a` to `b`, down from `c` to `d`. */
const pulse = (t: number, a: number, b: number, c: number, d: number) =>
  smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)));

// ---------- Elephant: the trunk ----------

/** Where the trunk leaves the head, and the size of its six segments. */
export const TRUNK = { x: 4.45, y: 2.35, seg: 0.5, count: 6 };

export interface Point {
  x: number;
  y: number;
}

/**
 * The trunk's joints (count + 1 points) from the head to the tip. Segment `i` points at angle
 * `a0 + bend * i` from straight down, turning towards the cat (towards smaller x).
 */
export function trunkJoints(a0: number, bend: number): Point[] {
  const out: Point[] = [{ x: TRUNK.x, y: TRUNK.y }];
  for (let i = 0; i < TRUNK.count; i++) {
    const a = a0 + bend * i;
    const p = out[i];
    out.push({ x: p.x - Math.sin(a) * TRUNK.seg, y: p.y - Math.cos(a) * TRUNK.seg });
  }
  return out;
}

export interface TrunkCurl {
  a0: number;
  bend: number;
  /** The water spraying from the tip, 0 to 1. */
  spray: number;
}

const HANG = { a0: 0.12, bend: 0.22 };
const RAMP = { a0: 0.5, bend: 0.1 };
const RAISED = { a0: 2.2, bend: 0.15 };
const AIMED = { a0: 2.4, bend: 0.1 };
/** The trunk lowered as a ramp for the cat to climb. */
export const RAMP_JOINTS = trunkJoints(RAMP.a0, RAMP.bend);

export function trunkCurl(outcome: Outcome | null, variant: Variant, t: number): TrunkCurl {
  const mix = (to: { a0: number; bend: number }, k: number, spray = 0): TrunkCurl => ({
    a0: lerp(HANG.a0, to.a0, k),
    bend: lerp(HANG.bend, to.bend, k),
    spray,
  });
  if (outcome === null) {
    return {
      a0: HANG.a0 + 0.05 * Math.sin(t * 1.6),
      bend: HANG.bend + 0.03 * Math.sin(t * 1.6 + 1),
      spray: 0,
    };
  }
  if (outcome === 'clear' && variant === 0) return mix(RAMP, pulse(t, 0.1, 0.5, 1.3, 1.7));
  if (outcome === 'clear') return mix(RAISED, pulse(t, 0.05, 0.4, 1.2, 1.7));
  if (variant === 0) {
    return mix(
      AIMED,
      pulse(t, 0.1, 0.4, 1.6, 2.0),
      smooth((t - 0.45) / 0.1) * (1 - smooth((t - 1.2) / 0.2)),
    );
  }
  // Fail 1: down to the cat, up and over, then a plop.
  const down = pulse(t, 0.0, 0.45, 0.55, 0.65);
  const up = smooth((t - 0.6) / 0.5);
  const drop = smooth((t - 1.1) / 0.2);
  const k = Math.max(down, up * (1 - drop));
  const a = lerp(RAMP.a0, RAISED.a0, up * (1 - drop));
  const b = lerp(RAMP.bend, RAISED.bend, up * (1 - drop));
  return { a0: lerp(HANG.a0, a, k), bend: lerp(HANG.bend, b, k), spray: 0 };
}

/** The tip of the trunk at a given pose. */
export const trunkTip = (c: TrunkCurl): Point => trunkJoints(c.a0, c.bend)[TRUNK.count];

/** The ears flap (radians, 0 is flat against the head). */
export const earFlap = (outcome: Outcome | null, t: number) =>
  0.35 + 0.3 * Math.sin(t * (outcome === null ? 3 : 9));

// ---------- Giraffe: the neck ----------

/** The neck leaves the shoulder here and has five segments. */
export const NECK = { x: 6.4, y: 3.2, seg: 0.44, count: 5 };
const NECK_LOW = 1.75;
const NECK_UP = 0.3;

/** Neck angle from straight up, turning towards the cat (positive tips the head forward). */
export function neckBend(outcome: Outcome | null, variant: Variant, t: number): number {
  if (outcome === null) return NECK_LOW + 0.08 * Math.sin(t * 1.4);
  if (outcome === 'clear' && variant === 0) {
    return lerp(NECK_LOW, NECK_UP, pulse(t, 0.55, 1.15, 1.7, 2.1));
  }
  if (outcome === 'clear') return NECK_LOW - 0.1 + 0.08 * Math.sin(t * 3);
  if (variant === 0)
    return NECK_LOW + 0.25 * smooth((t - 0.3) / 0.3) * (1 - smooth((t - 1.4) / 0.4));
  // Fail 1: wind up, whack down, rebound.
  const wind = smooth((t - 0.15) / 0.6);
  const whack = smooth((t - 0.85) / 0.15);
  const back = smooth((t - 1.4) / 0.6);
  return lerp(lerp(NECK_LOW, 0.5, wind), 2.35, whack) + (NECK_LOW - 2.35) * back * whack;
}

/** The neck's joints from the shoulder to the head, for a neck angle. */
export function neckJoints(psi: number): Point[] {
  const out: Point[] = [{ x: NECK.x, y: NECK.y }];
  for (let i = 0; i < NECK.count; i++) {
    const a = psi + 0.04 * i;
    const p = out[i];
    out.push({ x: p.x - Math.sin(a) * NECK.seg, y: p.y + Math.cos(a) * NECK.seg });
  }
  return out;
}

/** The head's centre and the way it points (the head nods a little more than the neck). */
export function giraffeHead(psi: number): { x: number; y: number; angle: number } {
  const tip = neckJoints(psi)[NECK.count];
  const angle = psi + 0.6;
  return { x: tip.x - Math.sin(angle) * 0.55, y: tip.y + Math.cos(angle) * 0.55, angle };
}

/** The top of the head, where the cat stands. */
export function headTop(psi: number): Point {
  const h = giraffeHead(psi);
  return { x: h.x + Math.cos(h.angle) * 0.4, y: h.y + Math.sin(h.angle) * 0.4 };
}

/** The tongue (0 to 1) in the lick, fail 0. */
export const tongueOut = (outcome: Outcome | null, variant: Variant, t: number) =>
  outcome === 'fail' && variant === 0 ? pulse(t, 0.55, 0.75, 1.15, 1.35) : 0;

// ---------- Penguins ----------

/** Where the three penguins stand, and the ice they stand on. */
export const PENGUIN_X = [5.0, 7.0, 9.0] as const;
export const ICE = { from: 3.6, to: 10.6 };
/** Their depth: behind the cat. */
export const PENGUIN_Z = -0.45;

export interface PenguinPose {
  x: number;
  z: number;
  /** Lying on the belly, 0 (standing) to 1. */
  lie: number;
  /** Squash when the cat lands on its head (1 is normal). */
  sy: number;
  /** Waddle sway (radians). */
  sway: number;
}

export function penguinPose(
  outcome: Outcome | null,
  variant: Variant,
  t: number,
  i: number,
): PenguinPose {
  const x0 = PENGUIN_X[i];
  const waddle = Math.sin(t * 6 + i * 2.1) * 0.12;
  if (outcome === null) return { x: x0, z: PENGUIN_Z, lie: 0, sy: 1, sway: waddle };
  if (outcome === 'clear' && variant === 0) {
    const lie = pulse(t, 0.15, 0.4, 1.3, 1.6);
    return {
      x: x0 + 2.0 * smooth((t - 0.35) / 0.9),
      z: PENGUIN_Z,
      lie,
      sy: 1,
      sway: waddle * (1 - lie),
    };
  }
  if (outcome === 'clear') {
    const landed = 0.7 + 0.3 * i;
    const dt = t - landed;
    const sy = dt < 0 || dt > 0.3 ? 1 : 1 - 0.22 * Math.sin((dt / 0.3) * Math.PI);
    return { x: x0, z: PENGUIN_Z, lie: 0, sy, sway: waddle };
  }
  if (variant === 0) return { x: x0, z: PENGUIN_Z, lie: 0, sy: 1, sway: waddle * 1.4 };
  const go = smooth((t - 0.3) / 0.9);
  const lie = pulse(t, 0.15, 0.4, 1.6, 1.9);
  return {
    x: x0 - 3.2 * go,
    z: lerp(PENGUIN_Z, -0.1, go),
    lie,
    sy: 1,
    sway: waddle * (1 - lie),
  };
}

// ---------- Moves ----------

const clearEvents = (wordX: number, wordY: number, landX: number): Move['events'] => [
  [0.35, 'sfx:whoosh', 2.6, 0.4],
  [0.8, 'word', wordX, wordY],
  [1.2, 'sparkle', wordX, wordY - 0.6],
  [1.4, 'dust', landX, 0.1],
];
const failEvents = (x: number, y: number, extra: Move['events'] = []): Move['events'] => [
  [0.6, 'sfx:squeak', x, y],
  ...extra,
];

// The paths the cat follows are computed from the same motions the props use.
const HEAD_LOW = headTop(NECK_LOW);
const neckSlide = (t0: number, t1: number, n: number): Seg[] =>
  follow(
    t0,
    t1,
    n,
    (t) => {
      // From the head down the neck to the shoulder, then along the back to the rump.
      const u = (t - t0) / (t1 - t0);
      const nj = neckJoints(NECK_UP);
      const path: Point[] = [
        headTop(NECK_UP),
        nj[4],
        nj[2],
        { x: NECK.x + 0.1, y: NECK.y + 0.55 },
        { x: 7.4, y: 3.75 },
        { x: 8.5, y: 3.6 },
      ];
      const f = u * (path.length - 1);
      const k = Math.min(Math.floor(f), path.length - 2);
      return {
        x: lerp(path[k].x, path[k + 1].x, f - k),
        y: lerp(path[k].y, path[k + 1].y, f - k) + 0.1,
      };
    },
    'slide',
  );

export const ZOO_MOVES: Record<ZooId, ObstacleMoves> = {
  // ---------- Elephant ----------
  elephant: {
    spec: { length: 12, height: 3.8, floorY: 0 },
    words: ['TRUNK RIDE!', 'SLIDE!'],
    clear: [
      // Up the trunk, along its back and a hop off the tail end.
      mk(
        [
          runIn(),
          [0.2, RAMP_JOINTS[6].x, RAMP_JOINTS[6].y + 0.2, 'leap', { peak: 1.0 }],
          [0.12, RAMP_JOINTS[4].x, RAMP_JOINTS[4].y + 0.2, 'climb'],
          [0.12, RAMP_JOINTS[2].x, RAMP_JOINTS[2].y + 0.2, 'climb'],
          [0.12, 4.9, 3.7, 'climb'],
          [0.4, 8.4, 3.6, 'run'],
          [0.4, 10.4, 0, 'leap', { peak: 4.4, spin: -TAU }],
          [0.2, 12, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.8, 'word', 6.4, 4.8],
          [1.1, 'sparkle', 6.4, 4.0],
          [1.6, 'sfx:horn', 7, 3.6],
          [1.75, 'dust', 10.4, 0.1],
        ],
      ),
      // The trunk goes up to trumpet; the cat slides under the belly between the legs.
      mk(
        [
          runIn(),
          [0.15, 3.3, 0, 'crouch'],
          [0.8, 9.6, 0, 'slide', { sy: 0.7 }],
          [0.3, 10.9, 0, 'leap', { peak: 0.9 }],
          [0.2, 12, 0, 'run'],
        ],
        [
          [0.1, 'sfx:horn', 3.0, 4.6],
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.9, 'word', 6.4, 3.2],
          [1.2, 'sparkle', 6.4, 2.4],
          [1.6, 'dust', 10.9, 0.1],
        ],
      ),
    ],
    fail: [
      // Sprayed by the trunk.
      mk(
        [
          runIn(),
          [0.3, 3.2, 0, 'run', { face: 'wide' }],
          [0.35, 2.6, 0.7, 'flail', { coat: 'wet', face: 'wide', spin: TAU }],
          [0.3, 2.8, 0, 'splat', { sx: 1.3, sy: 0.5, face: 'squint' }],
          [0.4, 5.6, 0, 'run', { face: 'squint' }],
          [0.45, 9.4, 0, 'slide', { sy: 0.7 }],
          ...failEnd(12),
        ],
        [
          [0.35, 'sfx:horn', 3.0, 2.4],
          [0.7, 'sfx:splash', 3.0, 1.2],
          [1.1, 'bonk', 2.8, 0.9],
          [0.7, 'splash', 3.0, 1.2, 0x8ad4f2],
          [1.0, 'bubbles', 2.8, 0.6, 0x8ad4f2],
          [1.1, 'sfx:squeak', 2.8, 0.8],
          [2.1, 'sfx:boing', 9, 1],
        ],
      ),
      // The trunk wraps round the cat, lifts it up and plops it down.
      mk(
        [
          runIn(),
          [0.3, RAMP_JOINTS[6].x + 0.1, RAMP_JOINTS[6].y + 0.1, 'run', { face: 'wide' }],
          ...follow(
            0.55,
            1.05,
            5,
            (t) => {
              const tip = trunkTip(trunkCurl('fail', 1, t));
              return { x: tip.x, y: Math.max(0, tip.y - 0.55) };
            },
            'hang',
            { face: 'wide' },
          ),
          [0.25, 3.0, 0, 'splat', { sx: 1.4, sy: 0.4, face: 'dizzy' }],
          [0.3, 3.0, 0, 'dizzy', { face: 'dizzy' }],
          [0.45, 9.8, 0, 'leap', { peak: 4.4 }],
          ...failEnd(12, 0.3, 0.25),
        ],
        [
          [0.3, 'sfx:horn', 3.0, 1.0],
          [0.7, 'sfx:squeak', 3.0, 3.0],
          [1.3, 'sfx:thud', 3.0, 0.3],
          [1.3, 'bonk', 3.0, 0.8],
          [1.45, 'stars', 3.0, 1.4],
          [1.5, 'dust', 3.0, 0.1],
          [2.1, 'sfx:boing', 9, 1],
        ],
      ),
    ],
  },

  // ---------- Giraffe ----------
  giraffe: {
    spec: { length: 12, height: 5.2, floorY: 0 },
    words: ['WHEEE!', 'LEAP!'],
    clear: [
      // Hop on the lowered head, ride the neck up, slide down the neck and the back.
      mk(
        [
          runIn(),
          [0.1, 2.8, 0, 'crouch'],
          [0.3, HEAD_LOW.x, HEAD_LOW.y, 'leap', { peak: 3.6 }],
          ...follow(0.65, 1.15, 4, (t) => headTop(neckBend('clear', 0, t)), 'climb'),
          ...neckSlide(1.15, 1.6, 4),
          [0.4, 10.4, 0, 'leap', { peak: 4.6, spin: -TAU }],
          [0.15, 12, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.7, 'sfx:boing', 3.8, 3],
          [0.9, 'word', 5.4, 5.8],
          [1.2, 'sparkle', 5.8, 5.2],
          [2.0, 'dust', 10.4, 0.1],
        ],
      ),
      // A long leap through the gap between the front legs and the back legs.
      mk(
        [
          runIn(),
          [0.15, 3.0, 0, 'crouch'],
          [0.3, 5.2, 0, 'leap', { peak: 0.9 }],
          [0.5, 9.4, 0, 'leap', { peak: 1.1, spin: -TAU }],
          [0.35, 12, 0, 'run'],
        ],
        clearEvents(7.4, 3.6, 9.4),
      ),
    ],
    fail: [
      // A big pink lick: the fur sticks up.
      mk(
        [
          runIn(),
          [0.4, 3.4, 0, 'run', { face: 'wide' }],
          [0.3, 3.5, 0, 'splat', { coat: 'puff', face: 'squint', sx: 1.2, sy: 0.7 }],
          [0.35, 3.5, 0, 'dizzy', { face: 'dizzy' }],
          [0.5, 9.6, 0, 'leap', { peak: 1.0 }],
          ...failEnd(12),
        ],
        failEvents(3.5, 1.2, [
          [0.65, 'sfx:splat', 3.4, 0.9],
          [0.75, 'bonk', 3.5, 1.2],
          [0.85, 'poof', 3.5, 1.2],
          [1.1, 'sfx:boing', 3.5, 1],
        ]),
      ),
      // The neck swings round and bonks the cat.
      mk(
        [
          runIn(),
          [0.45, 4.4, 0, 'run', { face: 'wide' }],
          [0.3, 4.6, 0, 'run', { face: 'wide' }],
          [0.2, 4.6, 0, 'splat', { sx: 1.4, sy: 0.4, face: 'dizzy' }],
          [0.4, 4.6, 0, 'dizzy', { face: 'dizzy' }],
          [0.5, 9.6, 0, 'leap', { peak: 1.2 }],
          ...failEnd(12),
        ],
        [
          [0.7, 'sfx:whoosh', 5, 3],
          [1.0, 'sfx:thud', 4.7, 1.0],
          [1.0, 'bonk', 4.6, 1.0],
          [1.15, 'stars', 4.6, 1.6],
          [2.1, 'sfx:boing', 9, 1],
        ],
      ),
    ],
  },

  // ---------- Penguins ----------
  penguins: {
    spec: { length: 12, height: 1.8, floorY: 0 },
    words: ['SLIDE!', 'HOP HOP!'],
    clear: [
      // A belly-slide along the ice with them.
      mk(
        [
          runIn(),
          [0.1, 3.6, 0, 'crouch'],
          [0.95, 10.4, 0, 'slide', { ease: 'o' }],
          [0.3, 12, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.5, 'sfx:squeak', 5, 1],
          [0.8, 'word', 7, 2.8],
          [1.1, 'sparkle', 7, 2.2],
          [1.4, 'dust', 10.4, 0.1],
        ],
      ),
      // Hop over their heads, one by one.
      mk(
        [
          runIn(),
          [0.15, 3.4, 0, 'crouch'],
          [0.3, 5.0, 1.5, 'leap', { peak: 2.6 }],
          [0.3, 7.0, 1.5, 'leap', { peak: 2.6 }],
          [0.3, 9.0, 1.5, 'leap', { peak: 2.6 }],
          [0.4, 11.0, 0, 'leap', { peak: 2.2 }],
          [0.2, 12, 0, 'run'],
        ],
        [
          [0.35, 'sfx:whoosh', 2.6, 0.4],
          [0.7, 'sfx:squeak', 5, 1.8],
          [1.0, 'sfx:squeak', 7, 1.8],
          [1.0, 'word', 7, 3.6],
          [1.3, 'sparkle', 9, 2.6],
          [1.9, 'dust', 11, 0.1],
        ],
      ),
    ],
    fail: [
      // Slips on the ice, spins and goes splat.
      mk(
        [
          runIn(),
          [0.3, 4.2, 0, 'run', { face: 'wide' }],
          [0.5, 6.6, 0.3, 'flail', { spin: TAU * 2, face: 'wide' }],
          [0.3, 8.2, 0, 'splat', { sx: 1.4, sy: 0.4, face: 'dizzy' }],
          [0.35, 8.2, 0, 'dizzy', { face: 'dizzy' }],
          [0.35, 10.4, 0, 'leap', { peak: 1.3 }],
          ...failEnd(12),
        ],
        [
          [0.6, 'sfx:squeak', 5, 0.8],
          [1.05, 'sfx:splat', 8.2, 0.6],
          [1.05, 'bonk', 8.2, 0.8],
          [1.2, 'stars', 8.2, 1.4],
          [1.3, 'dust', 8.2, 0.1],
          [2.3, 'sfx:boing', 11, 1],
        ],
      ),
      // Bowled over by the sliding penguins; pops up with a fish on its head.
      mk(
        [
          runIn(),
          [0.45, 4.2, 0, 'run', { face: 'wide' }],
          [0.45, 2.8, 1.8, 'flail', { spin: -TAU, face: 'wide' }],
          [0.35, 3.4, 0, 'splat', { sx: 1.4, sy: 0.4, face: 'dizzy', hat: 'fish' }],
          [0.2, 3.4, 0, 'dizzy', { face: 'dizzy' }],
          [0.3, 9.8, 0, 'leap', { peak: 1.8 }],
          ...failEnd(12, 0.45, 0.3),
        ],
        [
          [0.5, 'sfx:squeak', 4.2, 1],
          [0.8, 'sfx:squeak', 4.0, 1],
          [1.2, 'sfx:splat', 3.4, 0.6],
          [1.2, 'bonk', 3.4, 0.8],
          [1.4, 'stars', 3.4, 1.4],
          [2.2, 'sfx:boing', 9, 1],
        ],
      ),
    ],
  },
};
