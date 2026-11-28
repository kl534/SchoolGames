/**
 * The visual ground height. The play area is flat (so `surfaceAt` and the ball are untouched); the
 * rough rises into mounds away from the line, bunkers are dished and ponds sit below their banks.
 * Pure: no DOM, no three.js.
 */
import { centreX, HOLES, type Ellipse, type Hole } from './course';

/** Yards off centreX(h, z) that stay flat (the ball is clamped at ROUGH_HALF = 60). */
export const FLAT_HALF = 62;
/** Full mound height is reached here. */
export const RISE_TO = 110;
/** Tallest mound, yards. */
export const MOUND_MAX = 4;
/** Depth of a bunker at its middle, yards. */
export const BUNKER_DEPTH = 0.3;
/** The water surface sits this far below grade; the banks slope over `SHORE` yards. */
export const POND_DEPTH = 0.25;
export const SHORE = 1.4;

/** A seeded 0..1 per lattice point. */
function hash(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise, 0..1, with one lattice cell `wavelength` yards across. */
function valueNoise(x: number, z: number, wavelength: number, seed: number): number {
  const fx = x / wavelength;
  const fz = z / wavelength;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const sx = u * u * (3 - 2 * u);
  const sz = v * v * (3 - 2 * v);
  const a = hash(i, j, seed) + (hash(i + 1, j, seed) - hash(i, j, seed)) * sx;
  const b = hash(i, j + 1, seed) + (hash(i + 1, j + 1, seed) - hash(i, j + 1, seed)) * sx;
  return a + (b - a) * sz;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** The seed of a hole's mounds: its place in the course (any distinct number would do). */
export function holeSeed(h: Hole): number {
  const i = HOLES.indexOf(h);
  return i >= 0 ? i + 1 : Math.round(h.length * 13 + h.bend * 101 + 3);
}

/** Off-line distance for the mounds: grows behind the tee and past the green so those end flat. */
function offLine(h: Hole, x: number, z: number): number {
  let d = Math.abs(x - centreX(h, z));
  if (z < 0) d = Math.max(d, -z - 30);
  else if (z > h.length) d = Math.max(d, z - h.length - 45);
  return d;
}

/** The mounds alone (0 inside FLAT_HALF), 0..MOUND_MAX. */
export function moundY(h: Hole, x: number, z: number): number {
  const r = smoothstep(FLAT_HALF, RISE_TO, offLine(h, x, z));
  if (r <= 0) return 0;
  const seed = holeSeed(h);
  const m =
    0.25 + 0.75 * (0.65 * valueNoise(x, z, 70, seed) + 0.35 * valueNoise(x, z, 25, seed + 50));
  return r * MOUND_MAX * m;
}

/** Normalised radius of (x, z) in an ellipse: below 1 is inside. */
export function ellipseQ(e: Ellipse, x: number, z: number): number {
  return Math.hypot((x - e.x) / e.rx, (z - e.z) / e.rz);
}

/** About how many yards (x, z) is outside the ellipse's edge (0 inside): (q - 1) over the slope of q. */
export function outsideBy(e: Ellipse, x: number, z: number): number {
  const q = ellipseQ(e, x, z);
  if (q <= 1) return 0;
  const dx = (x - e.x) / (e.rx * e.rx);
  const dz = (z - e.z) / (e.rz * e.rz);
  return ((q - 1) * q) / Math.hypot(dx, dz);
}

/** The height of the ground at (x, z): 0 in play, mounds in the rough, dished bunkers and ponds. */
export function groundY(h: Hole, x: number, z: number): number {
  let y = moundY(h, x, z);
  for (const hz of h.hazards) {
    if (hz.kind === 'sand') {
      const q = ellipseQ(hz.at, x, z);
      if (q < 1) y = Math.min(y, -BUNKER_DEPTH * (1 - q * q));
    } else {
      const out = outsideBy(hz.at, x, z);
      if (ellipseQ(hz.at, x, z) < 1) y = Math.min(y, -POND_DEPTH);
      else if (out < SHORE) y = Math.min(y, -POND_DEPTH * (1 - out / SHORE));
    }
  }
  return y;
}
