/**
 * Small pure helpers for authoring the Mega courses' animations: routes through waypoints with
 * ballistic arcs, the heading of a path, an easing for fast flips and the shared pieces every
 * element is made of. Built on the toolkit in `../anim`; no three.js and no DOM.
 */
import {
  EASE,
  arc,
  clamp01,
  lerp,
  seatOf,
  setFree,
  smooth,
  type Ease,
  type Frame,
  type Pos,
} from '../anim';

/** A point of a ski's path: course-local `d` along the course and `y` up. */
export interface Spot {
  d: number;
  y: number;
}

/**
 * A waypoint: at time `t` the point is (d, y). `peak` makes the way there from the previous
 * waypoint a ballistic arc that tops out at that height; `ease` shapes d (and y, when there is no
 * arc) on the way there and defaults to linear.
 */
export type Stop = readonly [t: number, d: number, y: number, peak?: number, ease?: Ease];

/** A function of time that moves through the waypoints and holds the first and last. */
export function route(stops: readonly Stop[]): (t: number) => Spot {
  const last = stops[stops.length - 1];
  return (t) => {
    if (t <= stops[0][0]) return { d: stops[0][1], y: stops[0][2] };
    for (let i = 1; i < stops.length; i++) {
      const stop = stops[i];
      if (t <= stop[0]) {
        const from = stops[i - 1];
        const span = stop[0] - from[0];
        const u = span > 0 ? (t - from[0]) / span : 1;
        const e = EASE[stop[4] ?? 'l'](u);
        return {
          d: lerp(from[1], stop[1], e),
          y: stop[3] !== undefined ? arc(from[2], stop[2], stop[3], u) : lerp(from[2], stop[2], e),
        };
      }
    }
    return { d: last[1], y: last[2] };
  };
}

/** The slope (rise over run) of a height profile at `d`. */
export const slopeAt = (f: (d: number) => number, d: number): number =>
  (f(d + 0.01) - f(d - 0.01)) / 0.02;

/** The direction a path is heading at time `t` (radians above the +d axis, so + noses up). */
export function heading(path: (t: number) => Spot, t: number, dt = 0.03): number {
  const a = path(t - dt);
  const b = path(t + dt);
  return Math.atan2(b.y - a.y, b.d - a.d);
}

/**
 * Progress of a fast spin: mostly steady, eased at both ends, so the turn rate never goes much
 * above 1.1 times the average. 0 to 1 in, 0 to 1 out.
 */
export const flipEase = (u: number): number => {
  const c = clamp01(u);
  return 0.85 * c + 0.15 * smooth(c);
};

/** Zero at both ends of a leg and `k` times the heading in the middle: a gentle lean in the air. */
export const lean = (u: number, headingNow: number, k = 0.55): number =>
  k * headingNow * Math.sin(Math.PI * clamp01(u));

/** A bump that is 1 at `at` and fades to 0 over `width` seconds either side. */
export const bump = (t: number, at: number, width: number): number =>
  Math.max(0, 1 - Math.abs(t - at) / width);

/** Puts the ski at a path spot with its angles; the rider sits on it unless the def frees him. */
export function placeSki(
  f: Frame,
  at: Spot,
  s: number,
  pitch: number,
  roll: number,
  yaw: number,
  wet: boolean,
): void {
  const k = f.ski;
  k.d = at.d;
  k.y = at.y;
  k.s = s;
  k.pitch = pitch;
  k.roll = roll;
  k.yaw = yaw;
  k.wet = wet;
}

/**
 * The rider leaves the ski at time `t0`: he is free from there, flying along `path` (his hips'
 * route from the seat's position at `t0`) with the given pose and turn. Use `seatAtTime` to find
 * where the seat was; this just frees him.
 */
export function flung(
  f: Frame,
  at: Spot,
  s: number,
  pitch: number,
  roll: number,
  yaw: number,
  pose: Frame['rider']['pose'],
  face: Frame['rider']['face'],
): void {
  setFree(f, at.d, at.y, s, pitch, roll, yaw, pose, face);
}

/** The ski's seat position for a pose of the ski (for a rider who leaves it). */
export function seatSpot(f: Frame, out: Pos = { d: 0, y: 0, s: 0 }): Pos {
  return seatOf(f.ski, out);
}
