/**
 * The flight of the ball as pure geometry: a shot is three segments, hand to wall to bounce to the
 * receiver. Plain `{x, y, z}` objects, no three.js. x runs along the court away from the wall, y is
 * up and z points toward the camera.
 */
export interface Vec {
  x: number;
  y: number;
  z: number;
}
export interface Segment {
  from: Vec;
  to: Vec;
  duration: number;
  /** Extra height at the middle of the segment, in metres. */
  arc: number;
}
export interface Shot {
  segments: Segment[];
  duration: number;
}

/** The face of the wall. */
export const WALL_X = -3.0;
export const BALL_R = 0.09;
/** Hand height of a scale-1 kid; multiply by scale. */
export const CONTACT_Y = 1.0;
/** How far along its last segment a ball coming to us stops and waits for the answer. */
export const HOLD_U = 0.6;
/** Seconds of bouncing the ball once before a serve is hit. */
export const SERVE_WINDUP = 0.35;
export const SHOT_TIMES = { normal: [0.45, 0.45, 0.5], smash: [0.22, 0.25, 0.35] };
export const SHOT_ARCS = { normal: [0.3, 0.7, 0.8], smash: [0.05, 0.15, 0.3] };
/** Where a missed ball goes: past everyone and off the right side. */
export const PAST = { x: 4.8, y: BALL_R, duration: 0.7, arc: 0.5 };
/** Seconds a missed ball rolls on after the shot ends. */
export const ROLL_OFF = 0.6;
/** Lowest and highest wall hit of an ordinary shot. */
export const WALL_Y_RANGE = [0.7, 1.8] as const;
/** Wall height of a winner. */
export const WINNER_WALL_Y = 0.45;

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

function segment(from: Vec, to: Vec, duration: number, arc: number): Segment {
  return { from, to, duration, arc };
}

function shotOf(segments: Segment[]): Shot {
  return { segments, duration: segments.reduce((sum, s) => sum + s.duration, 0) };
}

/**
 * A shot from `from` to the wall at height `wallY`, bouncing once on the court on the way to `to`.
 * With `miss` the last segment ends at the `PAST` spot (in the receiver's lane) instead.
 */
export function planShot(
  kind: 'normal' | 'smash',
  from: Vec,
  to: Vec,
  wallY: number,
  miss: boolean,
): Shot {
  const times = SHOT_TIMES[kind];
  const arcs = SHOT_ARCS[kind];
  const wall: Vec = { x: WALL_X + BALL_R, y: wallY, z: (from.z + to.z) / 2 };
  const bounce: Vec = {
    x: lerp(wall.x, to.x, 0.6),
    y: BALL_R,
    z: lerp(wall.z, to.z, 0.6),
  };
  const last = miss
    ? segment(bounce, { x: PAST.x, y: PAST.y, z: to.z }, PAST.duration, PAST.arc)
    : segment(bounce, to, times[2], arcs[2]);
  return shotOf([
    segment(from, wall, times[0], arcs[0]),
    segment(wall, bounce, times[1], arcs[1]),
    last,
  ]);
}

/** A ball let go from `from` that runs on past a kid who missed it, off the right side. */
export function pastShot(from: Vec): Shot {
  return shotOf([segment(from, { x: PAST.x, y: PAST.y, z: from.z }, PAST.duration, PAST.arc)]);
}

/** A ball that hits a head at `head`, then drops and bounces to the ground at `floorX`. */
export function bonkShot(from: Vec, head: Vec, floorX: number): Shot {
  return shotOf([
    segment(from, head, 0.2, 0),
    segment(head, { x: floorX, y: BALL_R, z: head.z + 0.1 }, 0.45, 0.25),
  ]);
}

/** Where the ball is `t` seconds into a shot (clamped to its length). */
export function ballAt(shot: Shot, t: number): Vec {
  let left = Math.min(Math.max(t, 0), shot.duration);
  for (const s of shot.segments) {
    if (left <= s.duration) {
      const u = s.duration > 0 ? left / s.duration : 1;
      if (u >= 1 - 1e-12) return { ...s.to };
      return {
        x: lerp(s.from.x, s.to.x, u),
        y: lerp(s.from.y, s.to.y, u) + s.arc * 4 * u * (1 - u),
        z: lerp(s.from.z, s.to.z, u),
      };
    }
    left -= s.duration;
  }
  return { ...shot.segments[shot.segments.length - 1].to };
}

/** Seconds into the shot when its last segment is `HOLD_U` of the way along. */
export function holdTime(shot: Shot): number {
  const last = shot.segments[shot.segments.length - 1];
  return shot.duration - last.duration + HOLD_U * last.duration;
}

/** The first time the ball is at or past `x` on its way right after the bounce, or null. */
export function timeAtX(shot: Shot, x: number): number | null {
  const start = shot.segments[0].duration + (shot.segments[1]?.duration ?? 0);
  for (let t = start; t <= shot.duration + 1e-9; t += 0.01) {
    if (ballAt(shot, t).x >= x) return t;
  }
  return null;
}

/** Where a kid with home spot `homeX` stands to hit: within a metre of home, on the court. */
export function contactSpot(homeX: number, random: number): number {
  return Math.min(Math.max(homeX + (random * 2 - 1), -2.2), 2.8);
}
