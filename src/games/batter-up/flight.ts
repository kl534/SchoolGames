/**
 * The ball's paths and the field's measurements, as plain numbers so they are easy to test.
 * Home plate is the origin; the field stretches away along -z, first base is on the +x side.
 */
import type { Hit } from './rules';

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

/** Where the pitcher lets go, where the bat meets the ball, and where the catcher's glove is. */
export const RELEASE: Vec = { x: 0, y: 2.2, z: -7.4 };
export const CONTACT: Vec = { x: 0, y: 1.0, z: 0.05 };
export const GLOVE: Vec = { x: 0.04, y: 0.85, z: 1.0 };
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

const deg = (d: number) => (d * Math.PI) / 180;

export interface HitPlan {
  hit: Hit;
  /** -1 down the left field line, 1 to right. */
  side: -1 | 1;
  /** Seconds in the air, and in all (rolling included). */
  airTime: number;
  duration: number;
  /** Where the ball first comes down, and where it ends up. */
  landing: Vec;
  stop: Vec;
  /** How far above the straight line from bat to landing spot the ball climbs. */
  lift: number;
  /** The ball leaves the park. */
  overWall: boolean;
  /** Writes the ball's position `t` seconds after contact. */
  position(t: number, out: Vec): Vec;
}

interface Spec {
  /** Angle from straight ahead (degrees) and distance to the landing spot. */
  angle: [number, number];
  radius: [number, number];
  /** Where it ends, as an angle and the distance short of the wall. */
  stopAngle: [number, number];
  lift: [number, number];
  air: number;
  roll: number;
}

const SPECS: Record<Hit, Spec> = {
  // A line drive or a hop into shallow left or right-centre.
  single: {
    angle: [8, 26],
    radius: [20, 23],
    stopAngle: [12, 30],
    lift: [1.4, 3],
    air: 0.8,
    roll: 1.1,
  },
  // In the gap between the outfielders, rolling on to the wall.
  double: {
    angle: [15, 24],
    radius: [30, 32],
    stopAngle: [20, 27],
    lift: [6, 8],
    air: 1.5,
    roll: 1.4,
  },
  // A deep drive down the line, into the corner.
  triple: {
    angle: [35, 40],
    radius: [30, 31.5],
    stopAngle: [42.5, 44],
    lift: [9, 11],
    air: 1.9,
    roll: 1.3,
  },
  // Out of the park.
  homer: {
    angle: [4, 22],
    radius: [47, 50],
    stopAngle: [4, 22],
    lift: [19, 22],
    air: 2.7,
    roll: 0,
  },
};

const mix = (range: [number, number], roll: number) => lerp(range[0], range[1], clamp01(roll));

/**
 * The path of a hit. `side` picks left or right field; `roll1` and `roll2` (0 to 1, usually
 * random) vary the angle and distance a little so no two hits are the same.
 */
export function planHit(hit: Hit, side: -1 | 1, roll1 = 0.5, roll2 = 0.5): HitPlan {
  const spec = SPECS[hit];
  const theta = side * deg(mix(spec.angle, roll1));
  const landing = fieldPoint(theta, mix(spec.radius, roll2), hit === 'homer' ? 4 : BALL_RADIUS);
  const overWall = hit === 'homer';
  const stopTheta = side * deg(mix(spec.stopAngle, roll1));
  const stop = overWall
    ? landing
    : fieldPoint(
        stopTheta,
        hit === 'single'
          ? mix(spec.radius, roll2) + 5
          : Math.min(wallRadius(stopTheta) - 1.2, mix(spec.radius, roll2) + 6),
        BALL_RADIUS,
      );
  const lift = mix(spec.lift, roll2);
  const airTime = spec.air;
  const duration = airTime + (overWall ? 0.4 : spec.roll);
  const roll = Math.max(spec.roll, 0.01);

  const position = (t: number, out: Vec): Vec => {
    if (t <= airTime) {
      const s = clamp01(t / airTime);
      out.x = lerp(CONTACT.x, landing.x, s);
      out.z = lerp(CONTACT.z, landing.z, s);
      out.y = lerp(CONTACT.y, landing.y, s) + 4 * lift * s * (1 - s);
      return out;
    }
    if (overWall) return dashPosition(landing, landing, 0, out);
    // On the ground: two hops that die away while the ball slows to a stop.
    const g = t - airTime;
    const p = 1 - (1 - clamp01(g / roll)) ** 3;
    out.x = lerp(landing.x, stop.x, p);
    out.z = lerp(landing.z, stop.z, p);
    out.y = BALL_RADIUS + 0.55 * Math.exp(-4.5 * g) * Math.abs(Math.sin((g * Math.PI) / 0.34));
    return out;
  };

  return { hit, side, airTime, duration, landing, stop, lift, overWall, position };
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
