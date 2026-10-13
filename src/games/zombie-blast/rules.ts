/** Pure game rules and motion helpers, kept free of three.js objects so they are easy to test. */

/** Brains (lives) the player starts each round with. */
export const BRAINS = 3;

/** One brain lost, never below zero. */
export function loseBrain(brains: number): number {
  return Math.max(0, brains - 1);
}

export function outOfBrains(brains: number): boolean {
  return brains <= 0;
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/**
 * How far along their walk the zombies are: 0 at the start line, 1 at the barricade.
 * Linear in the clock, so they arrive just as the time runs out.
 */
export function zombieProgress(clockLeft: number, clockTotal: number): number {
  if (clockTotal <= 0) return 1;
  return clamp01(1 - clockLeft / clockTotal);
}

/** Position on the zombies' path for a progress between `startZ` and `endZ`. */
export function approachZ(progress: number, startZ: number, endZ: number): number {
  return startZ + (endZ - startZ) * clamp01(progress);
}

/** Slows down towards 1, for zombies shuffling out of the mist and stopping at the line. */
export const easeOut = (t: number): number => 1 - (1 - clamp01(t)) ** 3;

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** How high the bomb arcs above the straight line between throw and target. */
export function arcHeightFor(distance: number): number {
  return 1.1 + Math.min(distance, 14) * 0.07;
}

/**
 * Where a lobbed bomb is `t` seconds into a flight of `duration` seconds: a parabola from
 * `from` to `to` that peaks `arc` above the straight line, so it starts and ends exactly there.
 */
export function bombPosition(
  from: Point3,
  to: Point3,
  t: number,
  duration: number,
  arc: number,
): Point3 {
  const s = duration > 0 ? clamp01(t / duration) : 1;
  return {
    x: from.x + (to.x - from.x) * s,
    y: from.y + (to.y - from.y) * s + 4 * arc * s * (1 - s),
    z: from.z + (to.z - from.z) * s,
  };
}

/** Gravity pulling smashed fence planks down, in world units per second squared. */
export const FENCE_GRAVITY = 9.8;

/** Indices of the plank centres `xs` within `reach` of `x`: the planks a zombie in that lane smashes. */
export function planksInReach(xs: readonly number[], x: number, reach: number): number[] {
  const hit: number[] = [];
  xs.forEach((plankX, i) => {
    if (Math.abs(plankX - x) <= reach) hit.push(i);
  });
  return hit;
}

/** Seconds a body launched from height `y` with upward speed `vy` takes to drop to `floor`. */
export function fallTime(y: number, vy: number, floor: number, gravity = FENCE_GRAVITY): number {
  const height = Math.max(y - floor, 0);
  return (vy + Math.sqrt(vy * vy + 2 * gravity * height)) / gravity;
}

/**
 * Where a smashed plank is `t` seconds after it left the fence: a ballistic arc from `from` with
 * `velocity`, which stops where it first reaches the `floor` instead of sinking into it.
 */
export function plankFlight(
  from: Point3,
  velocity: Point3,
  t: number,
  floor: number,
  gravity = FENCE_GRAVITY,
  out: Point3 = { x: 0, y: 0, z: 0 },
): Point3 {
  const s = Math.min(Math.max(t, 0), fallTime(from.y, velocity.y, floor, gravity));
  out.x = from.x + velocity.x * s;
  out.y = Math.max(floor, from.y + velocity.y * s - 0.5 * gravity * s * s);
  out.z = from.z + velocity.z * s;
  return out;
}

/** Eases to 1 with a little overshoot on the way, for fence pieces popping back into place. */
export function easeOutBack(t: number, overshoot = 1.70158): number {
  const u = clamp01(t) - 1;
  return 1 + (overshoot + 1) * u ** 3 + overshoot * u ** 2;
}

/** The same angle wrapped into -π..π, so blending back to zero never takes the long way round. */
export function wrapAngle(angle: number): number {
  const turn = Math.PI * 2;
  return angle - Math.round(angle / turn) * turn;
}
