/**
 * Every move of a kid as pure keyframes: one `KidFrame` per moment. `kids.ts` puts a frame on the
 * rig. A move gives only the fields it changes (`Partial<KidFrame>`); the rest come from the ready
 * or running pose. Imports nothing, so it runs in tests.
 */
export interface Limb {
  raise: number;
  out: number;
  bend: number;
}

export interface KidFrame {
  /** Body height above standing. */
  lift: number;
  lean: number;
  twist: number;
  roll: number;
  headPitch: number;
  /** Extra turn about the vertical, radians (the whiff spin). */
  yaw: number;
  /** The hitting arm (the one nearer the camera) and the other. */
  hit: Limb;
  off: Limb;
  legA: Limb;
  legB: Limb;
  dizzy: boolean;
}

export type Move = (t: number) => Partial<KidFrame>;

export const SWING_TOTAL = 0.35;
export const SWING_CONTACT = 0.18;
export const SMASH_TOTAL = 0.4;
export const SMASH_CONTACT = 0.2;
export const WHIFF_TOTAL = 0.9;
export const BONK_TOTAL = 0.8;
export const DIVE_TOTAL = 0.7;

const limb = (raise = 0, out = 0, bend = 0): Limb => ({ raise, out, bend });

export function readyFrame(): KidFrame {
  return {
    lift: 0,
    lean: 0.1,
    twist: 0,
    roll: 0,
    headPitch: 0,
    yaw: 0,
    hit: limb(0.5, 0.15, 1.1),
    off: limb(0.3, 0.3, 0.9),
    legA: limb(0.2, 0.05, 0.2),
    legB: limb(-0.15, 0.05, 0.15),
    dizzy: false,
  };
}

/** A run or walk cycle at `phase` radians; `amount` is 0 standing and 1 flat out. */
export function runFrame(phase: number, amount: number): Partial<KidFrame> {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  return {
    lift: Math.abs(c) * 0.05 * amount,
    lean: 0.1 + 0.15 * amount,
    legA: limb(s * amount, 0.05, (0.15 + Math.max(0, -s) * 1.2) * amount),
    legB: limb(-s * amount, 0.05, (0.15 + Math.max(0, s) * 1.2) * amount),
    hit: limb(-s * 0.8 * amount + 0.2, 0.1, 1.2 * amount),
    off: limb(s * 0.8 * amount + 0.2, 0.1, 1.2 * amount),
  };
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** A value moving through `[time, value]` points, eased between them, flat outside. */
function track(t: number, points: readonly (readonly [number, number])[]): number {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return points[points.length - 1][1];
}

/** A downward slap: hand up at shoulder height, then sweeping down and forward at 0.18 s. */
export const swing: Move = (t) => ({
  hit: limb(
    track(t, [
      [0, 0.5],
      [0.08, 1.7],
      [0.18, 0.9],
      [0.26, 0.4],
      [0.35, 0.5],
    ]),
    track(t, [
      [0, 0.15],
      [0.08, 0.3],
      [0.35, 0.15],
    ]),
    track(t, [
      [0, 1.1],
      [0.08, 1.2],
      [0.18, 0.2],
      [0.35, 1.1],
    ]),
  ),
  twist: track(t, [
    [0, 0],
    [0.08, -0.25],
    [0.18, 0.3],
    [0.35, 0],
  ]),
  lean: track(t, [
    [0, 0.1],
    [0.08, 0.0],
    [0.18, 0.45],
    [0.35, 0.1],
  ]),
});

/** A hard downward slap from overhead: arm up and back, then down at 0.2 s with the body folding in. */
export const smash: Move = (t) => ({
  hit: limb(
    track(t, [
      [0, 0.5],
      [0.12, 2.9],
      [0.2, 0.7],
      [0.28, 0.3],
      [0.4, 0.5],
    ]),
    track(t, [
      [0, 0.15],
      [0.12, 0.3],
      [0.4, 0.15],
    ]),
    track(t, [
      [0, 1.1],
      [0.12, 0.6],
      [0.2, 0.1],
      [0.4, 1.1],
    ]),
  ),
  off: limb(
    track(t, [
      [0, 0.3],
      [0.12, 1.6],
      [0.3, 0.4],
      [0.4, 0.3],
    ]),
    0.3,
    0.6,
  ),
  lean: track(t, [
    [0, 0.1],
    [0.12, -0.25],
    [0.2, 0.65],
    [0.4, 0.1],
  ]),
  headPitch: track(t, [
    [0, 0],
    [0.12, 0.3],
    [0.4, 0],
  ]),
  lift: track(t, [
    [0, 0],
    [0.12, 0.12],
    [0.22, 0],
  ]),
});

/** A miss: swings 0.25 s late, then spins right round, ending a little dizzy. */
export const whiffSpin: Move = (t) => {
  const s = swing(Math.max(t - 0.25, 0));
  return {
    ...s,
    yaw:
      Math.PI *
      2 *
      track(t, [
        [0.4, 0],
        [0.85, 1],
      ]),
    lift: Math.sin(clamp01((t - 0.4) / 0.45) * Math.PI) * 0.08,
    dizzy: t > 0.7,
  };
};

/** The ball hits the head: rocks back, hands up, stars. */
export const bonk: Move = (t) => ({
  headPitch: track(t, [
    [0, 0],
    [0.1, 0.5],
    [0.8, 0],
  ]),
  lean: track(t, [
    [0, 0.1],
    [0.12, -0.4],
    [0.4, -0.15],
    [0.8, 0.1],
  ]),
  roll: Math.sin(t * 16) * 0.12 * (1 - clamp01(t / BONK_TOTAL)),
  hit: limb(
    track(t, [
      [0, 0.5],
      [0.15, 2.4],
      [0.7, 2.2],
      [0.8, 0.5],
    ]),
    0.3,
    2.0,
  ),
  off: limb(
    track(t, [
      [0, 0.3],
      [0.15, 2.4],
      [0.7, 2.2],
      [0.8, 0.3],
    ]),
    0.3,
    2.0,
  ),
  dizzy: t > 0.15,
});

/** The rival dives sideways (toward the camera) for a ball that is gone. */
export const dive: Move = (t) => ({
  roll: track(t, [
    [0, 0],
    [0.25, 1.35],
    [0.5, 1.35],
    [0.7, 0],
  ]),
  lift: track(t, [
    [0, 0],
    [0.15, 0.12],
    [0.3, -0.25],
    [0.5, -0.25],
    [0.7, 0],
  ]),
  hit: limb(
    track(t, [
      [0, 0.5],
      [0.2, 1.5],
      [0.7, 0.5],
    ]),
    0.4,
    0.2,
  ),
  off: limb(
    track(t, [
      [0, 0.3],
      [0.2, 1.4],
      [0.7, 0.3],
    ]),
    0.6,
    0.2,
  ),
});

/** Arms up and bouncing, a loop. */
export const cheer: Move = (t) => ({
  lift: Math.abs(Math.sin(t * 10)) * 0.14,
  headPitch: 0.2,
  hit: limb(2.8, 0.3, 0.2),
  off: limb(2.8, 0.3, 0.2),
});

/** A wiggling victory dance, a loop. */
export const dance: Move = (t) => ({
  twist: Math.sin(t * 9) * 0.5,
  roll: Math.sin(t * 9) * 0.1,
  lift: Math.abs(Math.sin(t * 4.5)) * 0.07,
  hit: limb(1.5 + Math.sin(t * 7) * 0.7, 0.3, 0.4),
  off: limb(1.0 + Math.sin(t * 7 + 2) * 0.5, 0.6, 0.6),
  legA: limb(Math.sin(t * 9) * 0.5, 0.1, 0.35),
  legB: limb(-Math.sin(t * 9) * 0.5, 0.1, 0.35),
});

/** The watching kids slump. */
export const slump: Move = () => ({
  lean: 0.3,
  headPitch: -0.45,
  hit: limb(0.1, 0.1, 0.2),
  off: limb(0.1, 0.1, 0.2),
});
