/**
 * Small pure helpers for authoring the Mega courses' animations: routes through waypoints with
 * ballistic arcs, the heading of a path and an easing for fast flips. Built on the helpers in
 * stunts.ts; no three.js and no DOM.
 */
import { arc, EASE, lerp, smooth, type Ease, type Pos } from '../stunts';

/**
 * A waypoint: at time `t` the point is (x, y). `peak` makes the way there from the previous
 * waypoint a ballistic arc that tops out at that height; `ease` shapes x (and y, when there is no
 * arc) on the way there and defaults to linear.
 */
export type Stop = readonly [t: number, x: number, y: number, peak?: number, ease?: Ease];

/** A function of time that moves through the waypoints and holds the first and last. */
export function route(stops: readonly Stop[]): (t: number) => Pos {
  const last = stops[stops.length - 1];
  return (t) => {
    if (t <= stops[0][0]) return { x: stops[0][1], y: stops[0][2] };
    for (let i = 1; i < stops.length; i++) {
      const stop = stops[i];
      if (t <= stop[0]) {
        const from = stops[i - 1];
        const span = stop[0] - from[0];
        const u = span > 0 ? (t - from[0]) / span : 1;
        const e = EASE[stop[4] ?? 'l'](u);
        return {
          x: lerp(from[1], stop[1], e),
          y: stop[3] !== undefined ? arc(from[2], stop[2], stop[3], u) : lerp(from[2], stop[2], e),
        };
      }
    }
    return { x: last[1], y: last[2] };
  };
}

/** The direction a path is heading at time `t` (radians above the +x axis). */
export function heading(path: (t: number) => Pos, t: number, dt = 0.03): number {
  const a = path(t - dt);
  const b = path(t + dt);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * Progress of a fast spin: mostly steady, eased at both ends, so the turn rate never goes much
 * above 1.1 times the average. 0 to 1 in, 0 to 1 out.
 */
export const flipEase = (u: number): number => {
  const c = Math.min(Math.max(u, 0), 1);
  return 0.85 * c + 0.15 * smooth(c);
};

/** Zero at both ends of a leg and `k` times the heading in the middle: a gentle lean in the air. */
export const lean = (u: number, headingNow: number, k = 0.55): number =>
  k * headingNow * Math.sin(Math.PI * Math.min(Math.max(u, 0), 1));

/** A bump that is 1 at `at` and fades to 0 over `width` seconds either side. */
export const bump = (t: number, at: number, width: number): number =>
  Math.max(0, 1 - Math.abs(t - at) / width);

/** Rolling without slipping: the angle a wheel of radius `r` has turned after moving `dx`. */
export const rolled = (dx: number, r: number): number => dx / r;
