/**
 * How the ball gets to where it rests: a shot flies to where it touches down, hops and rolls on
 * to the rest point, slowing as the ground drags at it; a putt rolls and slows to a stop. The
 * ball still finishes exactly where `finishShot` says, so scoring does not change. Pure.
 */
import { BALL_R, flightPoint, flightSeconds } from './ball';
import type { Surface } from './course';
import {
  DUFF_APEX,
  DUFF_SKIP,
  isPutt,
  type Outcome,
  type Plan,
  type Result,
  type XZ,
} from './shot';

export interface Travel {
  /** From the club meeting the ball to it coming to rest, seconds. */
  seconds: number;
  /** The first part of that, in the air before the first touchdown, seconds. */
  airSeconds: number;
  /** Yards from the first touchdown to where the ball rests. */
  roll: number;
  /** The ball's centre `t` seconds after it was struck (any t past `seconds` is the rest point). */
  at(t: number): { x: number; y: number; z: number };
}

/** How high the first hop is, as a share of the flight's top: spin keeps wedge shots low. */
const HOP_SHARE: Record<string, number> = {
  driver: 0.04,
  iron3: 0.035,
  iron5: 0.03,
  iron7: 0.025,
  wedge: 0.012,
  sand: 0,
  putter: 0,
};
const SURFACE_HOP: Record<Surface, number> = {
  fairway: 1,
  green: 0.7,
  rough: 0.25,
  sand: 0,
  water: 0,
  tree: 0,
};

/** Share of the flight's ground speed the ball keeps when it touches down. */
const KEEP_SPEED = 0.3;
/** The longest a run takes, seconds. */
const MAX_ROLL_SECONDS = 1.2;
/** Hop gravity (yd/s²; a lively cartoon pull), the share of speed a hop keeps, and the top height. */
const HOP_GRAVITY = 30;
const BOUNCE = 0.55;
const MAX_HOP = 1.5;
/** Hops lower than this (yards) are not drawn. */
const MIN_HOP = 0.03;

export type Spot = { x: number; y: number; z: number };

/**
 * The travel of a struck shot: the flight to where it touches down (`result.land`), then a run in a
 * straight line to the rest point with hops that get lower and an even slowdown. A holed ball runs
 * to the pin, a splash runs to the splash point, a ball that hit a tree stops where it hit. A putt
 * just rolls, slowing evenly, to where it stops. `ground` is the ground's height under a point;
 * it is added to the ball's height (a ball in a bunker rests below grade).
 */
export function createTravel(
  plan: Plan,
  outcome: Outcome,
  result: Result,
  pin: XZ,
  ground: (x: number, z: number) => number = () => 0,
): Travel {
  const travel = flatTravel(plan, outcome, result, pin);
  return {
    ...travel,
    at(t) {
      const p = travel.at(t);
      return { ...p, y: p.y + ground(p.x, p.z) };
    },
  };
}

function flatTravel(plan: Plan, outcome: Outcome, result: Result, pin: XZ): Travel {
  const { from } = plan;
  const { land } = outcome;
  const end = result.kind === 'holed' ? pin : result.kind === 'water' ? result.splash : result.at;
  const surface: Surface =
    result.kind === 'holed' ? 'green' : result.kind === 'rest' ? result.surface : 'water';

  if (isPutt(plan)) {
    // Friction slows a putt evenly, so it is quickest off the face and stops dead on the spot.
    const flight = flightSeconds(plan, { ...outcome, land: end });
    return {
      seconds: flight,
      airSeconds: 0,
      roll: Math.hypot(end.x - from.x, end.z - from.z),
      at(t) {
        const u = Math.min(Math.max(t / flight, 0), 1);
        const s = 1 - (1 - u) * (1 - u);
        return { x: from.x + (end.x - from.x) * s, y: BALL_R, z: from.z + (end.z - from.z) * s };
      },
    };
  }

  if (outcome.quality === 'duff') return duffTravel(plan, end);

  const flight = flightSeconds(plan, outcome);
  const roll = Math.hypot(end.x - land.x, end.z - land.z);
  const straight = (): Travel => ({
    seconds: flight,
    airSeconds: flight,
    roll: 0,
    at: (t) => flightPoint(plan, outcome, Math.min(Math.max(t / flight, 0), 1)),
  });
  if (roll < 1e-6) return straight();
  const dx = (end.x - land.x) / roll;
  const dz = (end.z - land.z) / roll;

  // Slows evenly from touchdown speed `v0` to a stop after `rollTime` seconds.
  const groundSpeed = Math.hypot(land.x - from.x, land.z - from.z) / flight;
  const v0 = Math.max(KEEP_SPEED * groundSpeed, (2 * roll) / MAX_ROLL_SECONDS);
  const rollTime = (2 * roll) / v0;

  // Each hop is lower and shorter than the last, and none outlasts most of the run.
  const id = plan.club.id;
  const apex = plan.club.apex * plan.carry;
  const first = Math.min(apex * (HOP_SHARE[id] ?? 0) * SURFACE_HOP[surface], MAX_HOP);
  const hops: { start: number; seconds: number; height: number }[] = [];
  if (first >= MIN_HOP) {
    let start = 0;
    for (let k = 0; k < 6; k++) {
      const height = first * BOUNCE ** (2 * k);
      const seconds = 2 * Math.sqrt((2 * first) / HOP_GRAVITY) * BOUNCE ** k;
      if (height < MIN_HOP || start + seconds > rollTime * 0.75) break;
      hops.push({ start, seconds, height });
      start += seconds;
    }
  }

  return {
    seconds: flight + rollTime,
    airSeconds: flight,
    roll,
    at(t) {
      if (t <= flight) {
        return flightPoint(plan, outcome, Math.min(Math.max(t / flight, 0), 1));
      }
      const tau = Math.min(t - flight, rollTime);
      const s = v0 * tau - (v0 / rollTime) * ((tau * tau) / 2);
      let h = 0;
      for (const hop of hops) {
        if (tau >= hop.start && tau < hop.start + hop.seconds) {
          const x = (tau - hop.start) / hop.seconds;
          h = hop.height * 4 * x * (1 - x);
        }
      }
      return { x: land.x + dx * s, y: BALL_R + h, z: land.z + dz * s };
    },
  };
}

/** The one small hop a duff takes after its skip, yards, and where it is (share of the way). */
export const DUFF_HOP = 0.08;
const HOP_FROM = DUFF_SKIP + 0.05;
const HOP_TO = DUFF_SKIP + 0.3;

/** A topped ball: a low skip, one small hop, then it slows evenly to rest at `end`. */
function duffTravel(plan: Plan, end: XZ): Travel {
  const { from } = plan;
  const d = Math.hypot(end.x - from.x, end.z - from.z);
  const seconds = 0.5 + d / 12;
  return {
    seconds,
    airSeconds: seconds * DUFF_SKIP,
    roll: 0,
    at(t) {
      const u = Math.min(Math.max(t / seconds, 0), 1);
      const s = 1 - (1 - u) * (1 - u); // quickest off the club, dead still at the end
      let h = 0;
      if (s < DUFF_SKIP) {
        const v = s / DUFF_SKIP;
        h = 4 * DUFF_APEX * v * (1 - v);
      } else if (s > HOP_FROM && s < HOP_TO) {
        const v = (s - HOP_FROM) / (HOP_TO - HOP_FROM);
        h = 4 * DUFF_HOP * v * (1 - v);
      }
      return { x: from.x + (end.x - from.x) * s, y: BALL_R + h, z: from.z + (end.z - from.z) * s };
    },
  };
}
