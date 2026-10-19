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

/**
 * A monotone cubic through the knots (Fritsch-Carlson PCHIP): passes through every knot and never
 * overshoots between them. `xs` must increase; outside the range it holds the end values.
 */
export function pchip(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  const n = xs.length;
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i]);
    d.push((ys[i + 1] - ys[i]) / h[i]);
  }
  const m: number[] = new Array<number>(n).fill(0);
  if (n === 2) {
    m[0] = m[1] = d[0];
  } else {
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] > 0) {
        const w1 = 2 * h[i] + h[i - 1];
        const w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    const end = (h0: number, h1: number, d0: number, d1: number) => {
      let s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
      if (Math.sign(s) !== Math.sign(d0)) s = 0;
      else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(s) > 3 * Math.abs(d0)) s = 3 * d0;
      return s;
    };
    m[0] = end(h[0], h[1], d[0], d[1]);
    m[n - 1] = end(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  }
  return (x) => {
    if (!(x > xs[0])) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h[i] * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h[i] * m[i + 1]
    );
  };
}
