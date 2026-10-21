/** The rink's numbers and a little vector maths. Pure: no three.js and no DOM. */

/** The two teams: we attack +x. */
export type Side = 'us' | 'them';

export interface Vec {
  x: number;
  y: number;
  z: number;
}

/**
 * Units are metres, y is up. +x is their end (we attack towards +x), z runs across the rink and
 * the camera sits behind our attack, looking along +x.
 */
export const RINK_LENGTH = 60;
export const RINK_WIDTH = 26;
export const CORNER_R = 8.5;
export const GOAL_LINE_X = 26.6;
export const BLUE_LINE_X = 7.6;
export const CENTRE_LINE_X = 0;
export const GOAL_W = 1.83;
export const GOAL_H = 1.22;
export const GOAL_DEPTH = 1.0;
export const CREASE_R = 1.8;
/** Faceoff dots: the centre dot, and the four end-zone dots at (+-20, +-6.7). */
export const END_DOT_X = 20;
export const END_DOT_Z = 6.7;
export const ZONE_X = { 'our-end': -17, neutral: 0, 'their-end': 17 } as const;
/** The real puck is 0.038 m by 0.025 m; it is drawn 1.6 times bigger so it reads on a phone. */
export const PUCK_R = 0.038;
export const PUCK_H = 0.025;
export const PUCK_DRAW = 1.6;

export const vec = (x = 0, y = 0, z = 0): Vec => ({ x, y, z });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const lerpVec = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const distXZ = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

/** The horizontal unit vector from `from` to `to` (or +x if they coincide). */
export function dirXZ(from: Vec, to: Vec): Vec {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  return d < 1e-9 ? { x: 1, y: 0, z: 0 } : { x: dx / d, y: 0, z: dz / d };
}

/** `u` turned 90 degrees to the right, as seen from above with +x pointing away from us. */
export const rightOf = (u: Vec): Vec => ({ x: -u.z, y: 0, z: u.x });

export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** The x of the goal line a side shoots at: we shoot at +x, they shoot at -x. */
export const goalLineX = (scorer: 'us' | 'them') => (scorer === 'us' ? GOAL_LINE_X : -GOAL_LINE_X);

/** Whether a point is inside the net a side scores in (between the posts, under the bar). */
export function inNet(p: Vec, scorer: 'us' | 'them'): boolean {
  const sign = scorer === 'us' ? 1 : -1;
  const depth = (p.x - goalLineX(scorer)) * sign;
  return depth > 0 && depth < GOAL_DEPTH && Math.abs(p.z) < GOAL_W / 2 && p.y < GOAL_H;
}
