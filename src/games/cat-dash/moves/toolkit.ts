/**
 * The pieces every cat move is made of. A move is a list of segments: each one runs for `d`
 * seconds to an end position (obstacle-local x and y; the floor is y = 0 and x = 0 is the entry
 * line), in one pose. Pure data and maths, no three.js and no DOM.
 */

export type CatPose =
  | 'run'
  | 'trot'
  | 'crouch'
  | 'leap'
  | 'land'
  | 'slide'
  | 'balance'
  | 'climb'
  | 'hang'
  | 'swing'
  | 'splat'
  | 'dizzy'
  | 'curl'
  | 'surf'
  | 'sit'
  | 'shake'
  | 'flail';
export type CatFace = 'happy' | 'wide' | 'dizzy' | 'squint' | 'sneeze';
export type Coat =
  | 'none'
  | 'flour'
  | 'foam'
  | 'wet'
  | 'dust'
  | 'mud'
  | 'sand'
  | 'chalk'
  | 'soot'
  | 'milk'
  | 'cement'
  | 'snow'
  | 'puff';
/** A prop stuck on the head. */
export type Hat =
  | 'none'
  | 'cushion'
  | 'sock'
  | 'duck'
  | 'sweater'
  | 'lid'
  | 'banana'
  | 'sheet'
  | 'box'
  | 'bucket'
  | 'seaweed'
  | 'block'
  | 'crown';

export interface CatFrame {
  /** Obstacle-local position of the cat's base (where its feet are when it stands). */
  x: number;
  y: number;
  /** Radians, positive noses up; whole turns are fine. */
  rot: number;
  /** Depth offset: 0 on the floor, negative is away from the camera. */
  z: number;
  /** Squash and stretch along the body and up. */
  sx: number;
  sy: number;
  pose: CatPose;
  face: CatFace;
  coat: Coat;
  hat: Hat;
  visible: boolean;
}

export type MoveEventType =
  | 'dust'
  | 'splash'
  | 'stars'
  | 'poof'
  | 'bubbles'
  | 'feathers'
  | 'sparkle'
  | 'word'
  | 'bonk'
  | `sfx:${string}`;

export interface MoveEvent {
  /** Seconds into the move. */
  at: number;
  type: MoveEventType;
  /** Obstacle-local position of the effect. */
  x: number;
  y: number;
  color?: number;
}

export const TAU = Math.PI * 2;

export type Ease = 'l' | 'i' | 'o' | 'io';
export const EASE: Record<Ease, (u: number) => number> = {
  l: (u) => u,
  i: (u) => u * u,
  o: (u) => 1 - (1 - u) ** 3,
  io: (u) => u * u * (3 - 2 * u),
};
export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * A ballistic hop: height at progress `u` (0 to 1) from `from` to `to` that tops out at exactly
 * `peak` (raised to the higher end if it is lower).
 */
export function arc(from: number, to: number, peak: number, u: number): number {
  const top = Math.max(peak, from, to) + 1e-9;
  const up = Math.sqrt(top - from) / (Math.sqrt(top - from) + Math.sqrt(top - to));
  const k = (top - from) / (up * up);
  return top - k * (clamp01(u) - up) ** 2;
}

/** Height of something thrown up at `vy` from `y0` under gravity `g`, `t` seconds later. */
export const fall = (y0: number, vy: number, g: number, t: number): number =>
  y0 + vy * t - 0.5 * g * t * t;

export interface SegOpts {
  /** The highest point of a hop between the ends. */
  peak?: number;
  /** Extra turn during the segment, radians (positive noses up, negative somersaults forward). */
  spin?: number;
  face?: CatFace;
  coat?: Coat;
  hat?: Hat;
  /** Depth at the end of the segment. */
  z?: number;
  /** Squash at the end (default 1). */
  sx?: number;
  sy?: number;
  visible?: boolean;
  ease?: Ease;
}

export type Seg = readonly [d: number, x: number, y: number, pose: CatPose, o?: SegOpts];
export type Ev = readonly [at: number, type: MoveEventType, x: number, y: number, color?: number];

export interface Move {
  segs: readonly Seg[];
  events: readonly Ev[];
}

export interface MoveSpec {
  /** x of the far side: a move ends here, running. */
  length: number;
  /** The tallest point of the obstacle above the floor. */
  height: number;
  /** The lowest the cat may go (0 unless it falls into something). */
  floorY: number;
}

/** The four moves of an obstacle and its two comic words (one per clear). */
export interface ObstacleMoves {
  spec: MoveSpec;
  words: readonly [string, string];
  clear: readonly [Move, Move];
  fail: readonly [Move, Move];
}

// ---------- Authoring helpers ----------

/** The run-in every move starts with: the cat is at x = 0 on the floor, running. */
export const runIn = (d = 0.25, x = 2.2): Seg => [d, x, 0, 'run'];

/**
 * The end of every fail: scramble past to the far side, shake the coat or hat off, then run on.
 * The coat and the hat are gone at the very end.
 */
export function failEnd(length: number, scramble = 0.35, shake = 0.3): Seg[] {
  return [
    [scramble, length, 0, 'run'],
    [shake, length, 0, 'shake'],
    [0.05, length, 0, 'run', { coat: 'none', hat: 'none', face: 'happy' }],
  ];
}

/**
 * Segments that follow a moving point: `n` equal steps from `t0` to `t1`, each ending where
 * `at(t)` says. `opts.spin` is the whole turn over all steps; the other options apply to the first.
 */
export function follow(
  t0: number,
  t1: number,
  n: number,
  at: (t: number) => { x: number; y: number },
  pose: CatPose,
  opts: SegOpts = {},
): Seg[] {
  const out: Seg[] = [];
  const d = (t1 - t0) / n;
  const spin = (opts.spin ?? 0) / n;
  for (let i = 1; i <= n; i++) {
    const p = at(t0 + d * i);
    out.push([
      d,
      p.x,
      p.y,
      pose,
      i === 1 ? { ...opts, spin } : { spin, z: opts.z, sx: opts.sx, sy: opts.sy },
    ]);
  }
  return out;
}

/** Total time of a list of segments. */
export const total = (segs: readonly Seg[]): number => segs.reduce((s, seg) => s + seg[0], 0);
