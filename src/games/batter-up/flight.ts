/**
 * The ball's paths and the field's measurements, as plain numbers so they are easy to test.
 * Home plate is the origin; the field stretches away along -z, first base is on the +x side.
 */
import type { Hit, Position } from './rules';

export interface Vec {
  x: number;
  y: number;
  z: number;
}

/** The ball's radius, and so its height when it rolls. */
export const BALL_RADIUS = 0.17;
/** Distance between bases, along the base path. */
export const BASE_SIDE = 12;
const HALF_DIAG = BASE_SIDE / Math.SQRT2;
/** Home, first, second and third base; the mound is between home and second. */
export const BASE_SPOTS: readonly Vec[] = [
  { x: 0, y: 0, z: 0 },
  { x: HALF_DIAG, y: 0, z: -HALF_DIAG },
  { x: 0, y: 0, z: -2 * HALF_DIAG },
  { x: -HALF_DIAG, y: 0, z: -HALF_DIAG },
];
export const MOUND: Vec = { x: 0, y: 0, z: -8.2 };
export const MOUND_HEIGHT = 0.45;

/** Where each of the nine fielders normally stands (the pitcher on the rubber, the catcher crouched). */
export const POSITION_SPOTS: Record<Position, Vec> = {
  P: { x: 0, y: 0, z: -8.2 },
  C: { x: 0, y: 0, z: 1.5 },
  '1B': { x: 9.6, y: 0, z: -9.6 },
  '2B': { x: 4.2, y: 0, z: -14.8 },
  SS: { x: -4.6, y: 0, z: -14.2 },
  '3B': { x: -9.8, y: 0, z: -9.8 },
  LF: { x: -14, y: 0, z: -22.5 },
  CF: { x: 0, y: 0, z: -27 },
  RF: { x: 14, y: 0, z: -22.5 },
};

/** Where the pitcher lets go, where the bat meets the ball, and where the catcher's glove is. */
export const RELEASE: Vec = { x: 0, y: 2.2, z: -7.4 };
export const CONTACT: Vec = { x: 0, y: 1.0, z: 0.05 };
export const GLOVE: Vec = { x: 0.04, y: 0.85, z: 1.0 };
/** How fast base runners run, and fielders run after the ball (units per second). */
export const RUN_SPEED = 12;
export const FIELD_SPEED = 9;
/** The ball goes just over the bat when the swing misses. */
export const MISS_POINT: Vec = { x: 0.05, y: CONTACT.y + 0.42, z: CONTACT.z };
/** How high the pitch rises above the straight line between release and the plate. */
export const PITCH_ARC = 0.9;
/** Seconds the ball takes to zip in once an answer is chosen, and from the plate to the glove. */
export const ZIP_TIME = 0.3;
export const GLOVE_TIME = 0.09;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

/**
 * The ball on its slow pitch, `u` of the way through its flight (0 at the pitcher's hand, 1 at
 * the plate).
 */
export function pitchPosition(u: number, out: Vec, start: Vec = RELEASE): Vec {
  const t = clamp01(u);
  out.x = lerp(start.x, CONTACT.x, t);
  out.z = lerp(start.z, CONTACT.z, t);
  out.y = lerp(start.y, CONTACT.y, t) + 4 * PITCH_ARC * t * (1 - t);
  return out;
}

/** A straight dash from `from` to `to`, `s` of the way (0 to 1). */
export function dashPosition(from: Vec, to: Vec, s: number, out: Vec): Vec {
  const t = clamp01(s);
  out.x = lerp(from.x, to.x, t);
  out.y = lerp(from.y, to.y, t);
  out.z = lerp(from.z, to.z, t);
  return out;
}

// ---------- The outfield ----------

/** The outfield wall is the same distance from home at the foul poles, and further in the middle. */
export const WALL_POLE = 34;
export const WALL_CENTRE = 42;
/** The foul lines run out at 45 degrees either side of straight ahead. */
export const FOUL_ANGLE = Math.PI / 4;
export const WALL_HEIGHT = 2.6;

/** Distance from home to the wall at `theta` radians from straight ahead (either side). */
export function wallRadius(theta: number): number {
  const t = clamp01(Math.abs(theta) / FOUL_ANGLE);
  return WALL_POLE + (WALL_CENTRE - WALL_POLE) * (1 - t);
}

/**
 * The scoreboard high above the stands in centre field: its middle and its size. It is high
 * enough that, in the batting view, its face is wholly off the top of the screen on every phone
 * and tablet (only its posts show, among the stands), so it never peeks out from behind the
 * Menu and pause buttons.
 */
export const BOARD = {
  x: 0,
  y: 42,
  z: -(WALL_CENTRE + 22),
  width: 20,
  height: 10,
};
/** Where the fireworks go off, above the scoreboard. */
export const FIREWORKS_CENTRE: Vec = { x: 0, y: 53, z: -(WALL_CENTRE + 12) };
/** How far from where it goes off a firework's sparks reach (world units). */
export const BURST_RADIUS = 13;

/** A spot `radius` from home at `theta` radians from centre field, positive towards right field. */
export function fieldPoint(theta: number, radius: number, y = 0): Vec {
  return { x: Math.sin(theta) * radius, y, z: -Math.cos(theta) * radius };
}

/** Angle from straight ahead of a spot on the field, positive towards right field. */
export function fieldAngle(p: Vec): number {
  return Math.atan2(p.x, -p.z);
}

/** The fielders that should run for a ball, nearest first. */
export function pickChasers<T extends { x: number; z: number }>(
  fielders: readonly T[],
  target: Vec,
  count: number,
): T[] {
  const dist = (f: T) => Math.hypot(f.x - target.x, f.z - target.z);
  return [...fielders].sort((a, b) => dist(a) - dist(b)).slice(0, Math.max(count, 0));
}

/** How many outfielders go after each kind of hit. */
export const CHASERS: Record<Hit, number> = { single: 1, double: 2, triple: 2, homer: 1 };

// ---------- The base paths ----------

/** Length of the run from home round to home. */
export const LAP = 4 * BASE_SIDE;

/**
 * A spot on the base paths: `distance` is how far round from home the runner has gone, in world
 * units (0 at home, `BASE_SIDE` at first, and so on; 4 * BASE_SIDE is back at home).
 */
export function basePathPoint(distance: number, out: Vec): Vec {
  const d = Math.min(Math.max(distance, 0), LAP);
  const leg = Math.min(Math.floor(d / BASE_SIDE), 3);
  const a = BASE_SPOTS[leg];
  const b = BASE_SPOTS[(leg + 1) % 4];
  return dashPosition(a, b, (d - leg * BASE_SIDE) / BASE_SIDE, out);
}

// ---------- Plays in the field, seen from the mound ----------

/** First base, where an infielder throws to. */
export const FIRST_BASE: Vec = BASE_SPOTS[1];

/** A straight dash is a path with no `lift`; this one rises `lift` above the line in the middle. */
export function arcPosition(from: Vec, to: Vec, s: number, lift: number, out: Vec): Vec {
  const t = clamp01(s);
  dashPosition(from, to, t, out);
  out.y += 4 * lift * t * (1 - t);
  return out;
}

/**
 * A ball that rolls from `from` to `to` in hops that die away, `s` of the way (0 to 1). It stays
 * at the height of a rolling ball at the start and the end.
 */
export function groundBallPosition(from: Vec, to: Vec, s: number, out: Vec): Vec {
  const t = clamp01(s);
  dashPosition(from, to, t, out);
  out.y = BALL_RADIUS + 0.7 * (1 - t) * Math.abs(Math.sin(t * Math.PI * 3));
  return out;
}

export type InfielderId = 'SS' | '2B' | '3B';

/**
 * The infield plays are kept in front of the mound, in the narrow strip the camera behind the
 * pitcher can see: where a pop fly comes down and where a grounder is fielded.
 */
export const INFIELD_PLAYS: Record<InfielderId, { pop: Vec; ground: Vec }> = {
  SS: { pop: { x: -1.5, y: 0, z: -5.2 }, ground: { x: -2.1, y: 0, z: -4.4 } },
  '2B': { pop: { x: 1.7, y: 0, z: -5.4 }, ground: { x: 2.3, y: 0, z: -4.6 } },
  '3B': { pop: { x: -2.1, y: 0, z: -4.6 }, ground: { x: -1.6, y: 0, z: -3.2 } },
};

/** How high a pop fly climbs above the line from the bat to where it comes down. */
export const POP_FLY_LIFT = 6.5;
/** Seconds a pop fly hangs in the air, and a grounder takes to reach the infielder (who is there first). */
export const POP_FLY_TIME = 1.3;
export const GROUND_BALL_TIME = 0.8;
/** How fast an infielder runs to a pop fly or a grounder. */
export const INFIELD_SPEED = 14;
/** Seconds the throw to first takes. */
export const THROW_TIME = 0.5;
