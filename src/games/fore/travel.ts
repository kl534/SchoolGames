/**
 * How the ball gets to where it rests: a shot flies, touches down short of the ring, hops and
 * rolls the rest of the way, slowing as the ground drags at it; a putt rolls and slows to a stop.
 * The ball still finishes exactly where `finishShot` says, so scoring does not change. Pure.
 */
import { BALL_R, flightPoint, flightSeconds } from './ball';
import type { Surface } from './course';
import { DUFF_FRACTION, isPutt, pathAt, type Outcome, type Plan } from './shot';

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

/** The share of its flight that a club's ball runs on after it lands: low irons run, wedges stop. */
const ROLL_SHARE: Record<string, number> = {
  driver: 0.1,
  iron3: 0.08,
  iron5: 0.065,
  iron7: 0.05,
  wedge: 0.03,
  sand: 0.01,
  putter: 0,
};
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
/** What the ground does to the run and to the hop: fast fairway, grabbing rough, dead sand. */
const SURFACE_ROLL: Record<Surface, number> = {
  fairway: 1,
  green: 0.8,
  rough: 0.3,
  sand: 0.05,
  water: 0,
  tree: 0,
};
const SURFACE_HOP: Record<Surface, number> = {
  fairway: 1,
  green: 0.7,
  rough: 0.25,
  sand: 0,
  water: 0,
  tree: 0,
};

/** A duff skips along the ground, so it runs on further for what it flew. */
const DUFF_ROLL = 1.5;
/** A roll shorter than this (yards) is not worth drawing. */
const MIN_ROLL = 0.5;
/** The run never takes more than this share of the shot's distance. */
const MAX_ROLL_SHARE = 0.3;
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
 * The travel of a shot that ends on `surface` (null when the ball does not run on: it splashed
 * or hit a tree). `outcome.end` is where the ball comes to rest.
 */
export function createTravel(plan: Plan, outcome: Outcome, surface: Surface | null): Travel {
  const flight = flightSeconds(plan, outcome);
  const { from } = plan;
  const { end } = outcome;
  const dist = Math.hypot(end.x - from.x, end.z - from.z);

  if (isPutt(plan)) {
    // Friction slows a putt evenly, so it is quickest off the face and stops dead on the spot.
    return {
      seconds: flight,
      airSeconds: 0,
      roll: dist,
      at(t) {
        const u = Math.min(Math.max(t / flight, 0), 1);
        const s = 1 - (1 - u) * (1 - u);
        return { x: from.x + (end.x - from.x) * s, y: BALL_R, z: from.z + (end.z - from.z) * s };
      },
    };
  }

  const duff = outcome.quality === 'duff';
  const flightCarry = duff ? DUFF_FRACTION * plan.carry : plan.carry;
  const id = plan.club.id;
  const run = surface
    ? flightCarry * (ROLL_SHARE[id] ?? 0) * SURFACE_ROLL[surface] * (duff ? DUFF_ROLL : 1)
    : 0;
  const roll = Math.min(run, dist * MAX_ROLL_SHARE);
  const straight = (): Travel => ({
    seconds: flight,
    airSeconds: flight,
    roll: 0,
    at: (t) => flightPoint(plan, outcome, Math.min(Math.max(t / flight, 0), 1)),
  });
  if (!surface || roll < MIN_ROLL) return straight();

  // The way the ball is going as it comes down (a hook or slice bends in late).
  const a = pathAt(plan, outcome, 0.97);
  const b = pathAt(plan, outcome, 1);
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < 1e-9) return straight();
  const dx = (b.x - a.x) / len;
  const dz = (b.z - a.z) / len;

  // The same flight, landing `roll` yards short of the rest point.
  const shortPlan: Plan = {
    ...plan,
    carry: duff ? (flightCarry - roll) / DUFF_FRACTION : plan.carry - roll,
    landing: { x: plan.landing.x - dx * roll, z: plan.landing.z - dz * roll },
  };
  const shortOutcome: Outcome = {
    ...outcome,
    end: { x: end.x - dx * roll, z: end.z - dz * roll },
  };
  const down = shortOutcome.end;

  // Slows evenly from touchdown speed `v0` to a stop after `rollTime` seconds.
  const groundSpeed = Math.hypot(down.x - from.x, down.z - from.z) / flight;
  const v0 = Math.max(KEEP_SPEED * groundSpeed, (2 * roll) / MAX_ROLL_SECONDS);
  const rollTime = (2 * roll) / v0;

  // Each hop is lower and shorter than the last, and none outlasts most of the run.
  const apex = plan.club.apex * flightCarry * (duff ? 0.5 : 1);
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
        return flightPoint(shortPlan, shortOutcome, Math.min(Math.max(t / flight, 0), 1));
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
      return { x: down.x + dx * s, y: BALL_R + h, z: down.z + dz * s };
    },
  };
}
