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
