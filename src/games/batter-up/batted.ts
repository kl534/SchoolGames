/**
 * Paths of a batted ball, for every kind of hit and of out, as plain numbers so they are easy to
 * test. Each path is a chain of arcs and low hops from the bat, written as waypoints.
 */
import {
  BALL_RADIUS,
  CONTACT,
  fieldAngle,
  fieldPoint,
  FOUL_ANGLE,
  wallRadius,
  WALL_HEIGHT,
  type Vec,
} from './flight';
import { zoneOf, type FieldZone, type HitKind, type OutKind } from './rules';

export type BattedKind = HitKind | OutKind;

export interface BattedBall {
  kind: BattedKind;
  /** The angle of the ball's first touch from straight away, + towards right (radians). */
  theta: number;
  zone: FieldZone;
  /** Ball position `t` seconds after contact (t from 0 to `end`). */
  position(t: number, out: Vec): Vec;
  /** Seconds the path lasts; after it the ball sits at `rest` until someone picks it up. */
  end: number;
  rest: Vec;
  /** When and where it first touches the ground (or the wall, or is caught in the air). */
  firstTouch: { t: number; p: Vec; what: 'ground' | 'wall' | 'stands' | 'air-catch' };
  overWall: boolean;
  /** Seconds the ball is still in the air (for fireworks and runners holding up). */
  airTime: number;
}

/**
 * Random numbers (each from 0 up to 1) that shape a path. `side` picks left or right (below one
 * half is left) and, for kinds with a few places to go, which one; `a` and `b` vary the angle
 * and the distance a little so no two hits are the same.
 */
export interface Rolls {
  side: number;
  a: number;
  b: number;
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const mix = (range: readonly [number, number], roll: number) =>
  lerp(range[0], range[1], clamp01(roll));
const deg = (d: number) => (d * Math.PI) / 180;

/** A point on the way: where the ball is at `t` seconds, and how far it arcs getting there. */
interface Way {
  p: Vec;
  t: number;
  /** How far above the straight line from the last point the ball climbs in the middle. */
  lift: number;
  /** Slows towards the end, as a rolling ball does. */
  ease?: boolean;
}

const ground = (theta: number, radius: number): Vec => fieldPoint(theta, radius, BALL_RADIUS);

/** The side a roll picks: below one half is left (-1). */
const sideOf = (roll: number): -1 | 1 => (roll < 0.5 ? -1 : 1);

/** Hops that die away from `from`, ending at `to` at `t` seconds, over `count` bounces. */
function hops(from: Vec, to: Vec, t0: number, t1: number, firstLift: number, count: number): Way[] {
  const ways: Way[] = [];
  for (let i = 1; i <= count; i++) {
    const s = i / count;
    // Each hop covers a little less than its share of the time, and the last one slows to rest.
    ways.push({
      p: { x: lerp(from.x, to.x, s), y: BALL_RADIUS, z: lerp(from.z, to.z, s) },
      t: lerp(t0, t1, s),
      lift: firstLift * 0.55 ** (i - 1),
      ease: i === count,
    });
  }
  return ways;
}

function build(
  kind: BattedKind,
  ways: Way[],
  options: {
    touch: 'ground' | 'wall' | 'stands' | 'air-catch';
    /** The index of the waypoint where the ball first touches something. */
    touchAt: number;
    overWall?: boolean;
  },
): BattedBall {
  const touch = ways[options.touchAt];
  const last = ways[ways.length - 1];
  const rest = { ...last.p };
  const end = last.t;
  const position = (t: number, out: Vec): Vec => {
    if (t <= 0) {
      out.x = CONTACT.x;
      out.y = CONTACT.y;
      out.z = CONTACT.z;
      return out;
    }
    if (t >= end) {
      out.x = rest.x;
      out.y = rest.y;
      out.z = rest.z;
      return out;
    }
    let from: Vec = CONTACT;
    let t0 = 0;
    for (const way of ways) {
      if (t <= way.t) {
        let s = clamp01((t - t0) / Math.max(way.t - t0, 1e-6));
        if (way.ease) s = 1 - (1 - s) ** 2;
        const u = clamp01((t - t0) / Math.max(way.t - t0, 1e-6));
        out.x = lerp(from.x, way.p.x, s);
        out.z = lerp(from.z, way.p.z, s);
        // The height follows time, not the eased distance, so a slowing ball still hops.
        out.y = lerp(from.y, way.p.y, u) + 4 * way.lift * u * (1 - u);
        return out;
      }
      from = way.p;
      t0 = way.t;
    }
    return out;
  };
  const theta = fieldAngle(touch.p);
  return {
    kind,
    theta,
    zone: zoneOf(theta),
    position,
    end,
    rest,
    firstTouch: { t: touch.t, p: { ...touch.p }, what: options.touch },
    overWall: options.overWall ?? false,
    airTime: touch.t,
  };
}

/** The ball clears the wall at height `y` at least: the lift an arc to `landing` needs for it. */
function liftForClearance(landing: Vec, y: number): number {
  const radius = Math.hypot(landing.x, landing.z);
  const s = clamp01(wallRadius(fieldAngle(landing)) / radius);
  const base = CONTACT.y + (landing.y - CONTACT.y) * s;
  return Math.max((y - base) / (4 * s * (1 - s)), 0);
}

/** A ball that leaves the park: it lands in the stands `beyond` units past the wall. */
function homer(
  kind: HitKind,
  theta: number,
  beyond: number,
  seconds: number,
  lift: number,
  clearance: number,
  exact: boolean,
): BattedBall {
  const landing = fieldPoint(theta, wallRadius(theta) + beyond, exact ? 1.5 : 3);
  const needed = liftForClearance(landing, clearance);
  const height = exact ? needed : Math.max(lift, needed);
  return build(kind, [{ p: landing, t: seconds, lift: height }, hold(landing, seconds + 0.4)], {
    touch: 'stands',
    touchAt: 0,
    overWall: true,
  });
}

/** Stay where you are until `t`. */
function hold(p: Vec, t: number): Way {
  return { p: { ...p }, t, lift: 0 };
}

/** A spot `r` out along the angle `theta`, on the ground. */
const toward = (theta: number, r: number) => ground(theta, r);

/**
 * A fixed set of spots for the fielders an out is hit to, for when the caller does not say where
 * they really stand. Matches the normal positions.
 */
const DEFAULT_FIELDER_AT: Record<string, Vec> = {
  pop: fieldPoint(0.15, 13),
  fly: fieldPoint(0.1, 27),
  liner: fieldPoint(0.1, 13),
  diving: fieldPoint(0.1, 27),
  ground: fieldPoint(0.1, 13),
};

/** The spot, nudged into fair ground when it is on or near the foul line (a ball is not hit foul). */
function inward(p: Vec): Vec {
  const limit = deg(41);
  const theta = fieldAngle(p);
  if (Math.abs(theta) <= limit) return p;
  return { ...fieldPoint(Math.sign(theta) * limit, Math.hypot(p.x, p.z), p.y) };
}

/** Offsets on a plane: `a` and `b` (0 to 1) as sideways and forwards, `size` units at most. */
const around = (spot: Vec, a: number, b: number, size: number): Vec => ({
  x: spot.x + (clamp01(a) * 2 - 1) * size,
  y: 0,
  z: spot.z + (clamp01(b) * 2 - 1) * size,
});

/**
 * The path of a ball in play. `kind` is the kind of hit, or the kind of out when we pitch;
 * `fielderAt` is where the fielder it is hit to really stands (the out paths aim at him).
 */
export function planBatted(kind: BattedKind, rolls: Rolls, fielderAt?: Vec): BattedBall {
  const { side, a, b } = rolls;
  const s = sideOf(side);
  switch (kind) {
    case 'single-liner': {
      const theta = s * deg(mix([0, 30], a));
      const r = mix([18, 22], b);
      const bounce = ground(theta, r);
      const from = bounce;
      const end = toward(theta, r + 5);
      return build(
        kind,
        [{ p: bounce, t: 0.75, lift: mix([1.2, 2.2], b) }, ...hops(from, end, 0.75, 1.85, 0.5, 2)],
        { touch: 'ground', touchAt: 0 },
      );
    }
    case 'single-grounder': {
      const hole = side < 0.4 ? -30 : side < 0.6 ? 0 : 30;
      const theta = deg(hole + (a * 2 - 1) * 3);
      const stop = mix([26, 28], b);
      const pts: [number, number, number, number][] = [
        // radius, time, lift, ...
        [3.5, 0.2, 0.7, 0],
        [8, 0.45, 0.55, 0],
        [14, 0.7, 0.35, 0],
        [19, 1.1, 0.2, 0],
        [stop, 1.9, 0.1, 1],
      ];
      return build(
        kind,
        pts.map(([r, t, lift, ease]) => ({ p: ground(theta, r), t, lift, ease: ease === 1 })),
        { touch: 'ground', touchAt: 0 },
      );
    }
    case 'single-bloop': {
      const theta = deg((side * 2 - 1) * 35);
      const r = mix([17, 20], b);
      const land = ground(theta, r);
      return build(
        kind,
        [
          { p: land, t: 1.35, lift: mix([4.5, 5.5], a) },
          ...hops(land, toward(theta, r + 4), 1.35, 2.05, 0.5, 2),
        ],
        { touch: 'ground', touchAt: 0 },
      );
    }
    case 'single-chopper': {
      const theta = deg(side < 0.35 ? -35 : side < 0.6 ? -15 : side < 0.75 ? 0 : 15);
      const down = mix([9, 11], b);
      const rest = side >= 0.6 && side < 0.75 ? 13 : down + 3;
      return build(
        kind,
        [
          { p: ground(theta, 1.5), t: 0.1, lift: 0.3 },
          { p: ground(theta, down), t: 0.8, lift: mix([4.5, 5], a) },
          ...hops(ground(theta, down), toward(theta, rest), 0.8, 1.3, 0.6, 2),
        ],
        { touch: 'ground', touchAt: 0 },
      );
    }
    case 'double-gap': {
      const theta = s * deg(mix([15, 24], a));
      const land = ground(theta, mix([30, 32], b));
      const restTheta = theta * 1.12;
      const rest = ground(restTheta, wallRadius(restTheta) - 1.2);
      return build(
        kind,
        [{ p: land, t: 1.5, lift: mix([6, 8], b) }, ...hops(land, rest, 1.5, 2.9, 0.6, 2)],
        { touch: 'ground', touchAt: 0 },
      );
    }
    case 'double-line': {
      const theta = s * deg(mix([38, 42], a));
      const land = ground(theta, mix([26, 29], b));
      const restTheta = s * deg(43);
      const rest = ground(restTheta, wallRadius(restTheta) - 1);
      return build(
        kind,
        [{ p: land, t: 1.3, lift: mix([4, 5.5], b) }, ...hops(land, rest, 1.3, 2.6, 0.6, 2)],
        { touch: 'ground', touchAt: 0 },
      );
    }
    case 'double-wall': {
      const theta = s * deg(mix([0, 30], a));
      const wall = wallRadius(theta);
      const hit = fieldPoint(theta, wall, mix([1.4, 2.2], b));
      const back = ground(theta, wall - mix([5, 7], b));
      const rest = ground(theta, wall - mix([6, 8], b));
      return build(
        kind,
        [
          { p: hit, t: 1.7, lift: 3.5 },
          { p: back, t: 2.3, lift: 1.2 },
          { p: rest, t: 2.7, lift: 0.15, ease: true },
        ],
        { touch: 'wall', touchAt: 0 },
      );
    }
    case 'triple-corner': {
      // Mostly to the right, as that is where the long way round is.
      const ts = side < 0.4 ? -1 : 1;
      const theta = ts * deg(mix([36, 41], a));
      const land = ground(theta, mix([30, 31.5], b));
      const corner = ts * deg(43);
      const rattle = ts * deg(44);
      return build(
        kind,
        [
          { p: land, t: 1.9, lift: mix([9, 11], b) },
          { p: ground(corner, wallRadius(corner) - 0.8), t: 2.7, lift: 0.6 },
          { p: ground(rattle, wallRadius(rattle) - 0.8), t: 3.2, lift: 0.3, ease: true },
        ],
        { touch: 'ground', touchAt: 0 },
      );
    }
    case 'triple-gap': {
      const theta = s * deg(mix([4, 14], a));
      const land = ground(theta, mix([36, 38], b));
      const rest = ground(theta, wallRadius(theta) - 1);
      return build(
        kind,
        [{ p: land, t: 2.1, lift: mix([11, 12], b) }, ...hops(land, rest, 2.1, 3.1, 0.6, 2)],
        { touch: 'ground', touchAt: 0 },
      );
    }
    case 'homer-liner':
      return homer(
        kind,
        s * deg(mix([5, 35], a)),
        mix([2, 4], b),
        1.5,
        mix([6, 7], b),
        WALL_HEIGHT + 0.4,
        false,
      );
    case 'homer-moonshot':
      return homer(
        kind,
        s * deg(mix([0, 25], a)),
        mix([8, 10], b),
        2.8,
        mix([16, 18], b),
        WALL_HEIGHT + 3,
        false,
      );
    case 'homer-scraper':
      return homer(
        kind,
        s * deg(mix([10, 35], a)),
        mix([3, 5], b),
        1.9,
        mix([9, 10], b),
        WALL_HEIGHT + mix([0.9, 1.2], b),
        true,
      );
    case 'pop': {
      const spot = fielderAt ?? DEFAULT_FIELDER_AT.pop;
      const catchAt = inward({ ...around(spot, a, b, 2.1), y: 1.8 });
      return build(kind, [{ p: catchAt, t: 2, lift: mix([9, 11], b) }], {
        touch: 'air-catch',
        touchAt: 0,
      });
    }
    case 'foul-pop': {
      const catchAt: Vec = {
        x: s * mix([3, 6], a),
        y: 1.6,
        z: mix([1, 3.5], b),
      };
      return build(kind, [{ p: catchAt, t: 2.1, lift: 10 }], { touch: 'air-catch', touchAt: 0 });
    }
    case 'fly': {
      const spot = fielderAt ?? DEFAULT_FIELDER_AT.fly;
      const near = around(spot, a, b, 4.2);
      // Stay out where the outfielders play.
      const limit = deg(40);
      const theta = Math.min(Math.max(fieldAngle(near), -limit), limit);
      const r = Math.min(Math.max(Math.hypot(near.x, near.z), 26), 33);
      const catchAt = fieldPoint(theta, r, 2);
      return build(kind, [{ p: catchAt, t: 2.4, lift: mix([12, 14], b) }], {
        touch: 'air-catch',
        touchAt: 0,
      });
    }
    case 'liner': {
      const spot = fielderAt ?? DEFAULT_FIELDER_AT.liner;
      const catchAt = inward({ x: spot.x, y: mix([1.6, 2.4], a), z: spot.z });
      return build(kind, [{ p: catchAt, t: 0.35, lift: 0.3 }], { touch: 'air-catch', touchAt: 0 });
    }
    case 'diving': {
      const spot = fielderAt ?? DEFAULT_FIELDER_AT.diving;
      const theta0 = fieldAngle(spot);
      const r = mix([20, 24], b);
      // Four to five units to one side of where the outfielder was.
      // Corner outfielders dive towards the middle, never out into foul ground.
      const dir = Math.abs(theta0) > 0.3 ? -Math.sign(theta0) : s;
      const theta = theta0 + (dir * mix([4, 5], a)) / r;
      const catchAt = fieldPoint(theta, r, 0.3);
      return build(kind, [{ p: catchAt, t: 0.9, lift: 0.4 }], { touch: 'air-catch', touchAt: 0 });
    }
    case 'ground':
    case 'double-play':
    case 'force-second': {
      const spot = fielderAt ?? DEFAULT_FIELDER_AT.ground;
      const isPitcher = Math.hypot(spot.x, spot.z + 8.2) < 1.5;
      const total = isPitcher
        ? 0.35
        : kind === 'double-play'
          ? mix([0.55, 0.65], a)
          : mix([0.55, 0.8], a);
      // Forehand or backhand: a little to one side of where he stands.
      const aim = inward({
        x: spot.x + sideOf(side) * mix([0, 3], b) * (isPitcher ? 0.3 : 1),
        y: BALL_RADIUS,
        z: spot.z,
      });
      const at = (f: number): Vec => ({
        x: lerp(CONTACT.x, aim.x, f),
        y: BALL_RADIUS,
        z: lerp(CONTACT.z, aim.z, f),
      });
      return build(
        kind,
        [
          { p: at(0.12), t: total * 0.15, lift: 0.8 },
          { p: at(0.4), t: total * 0.4, lift: 0.6 },
          { p: at(0.7), t: total * 0.7, lift: 0.35 },
          { p: aim, t: total, lift: 0.15 },
        ],
        { touch: 'ground', touchAt: 0 },
      );
    }
  }
}

/** Whether a point is in fair ground (inside the foul lines and the wall). */
export function isFair(p: Vec): boolean {
  // Right at the plate the ball has only just been hit.
  if (Math.hypot(p.x, p.z) < 1.5) return true;
  return Math.abs(fieldAngle(p)) <= FOUL_ANGLE + 1e-9 && p.z < 0;
}
