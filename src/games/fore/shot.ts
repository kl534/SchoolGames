/** Clubs, the planned shot, how well it was struck and where the ball ends. Pure. */
import { centreX, ROUGH_HALF, surfaceAt, type Hole, type Surface } from './course';

export interface Club {
  id: string;
  name: string;
  carry: number;
  apex: number;
}

export const CLUBS: readonly Club[] = [
  { id: 'driver', name: 'Driver', carry: 240, apex: 0.22 },
  { id: 'iron3', name: '3-iron', carry: 190, apex: 0.25 },
  { id: 'iron5', name: '5-iron', carry: 160, apex: 0.28 },
  { id: 'iron7', name: '7-iron', carry: 130, apex: 0.32 },
  { id: 'wedge', name: 'Wedge', carry: 95, apex: 0.4 },
  { id: 'sand', name: 'Sand wedge', carry: 50, apex: 0.45 },
  { id: 'putter', name: 'Putter', carry: 0, apex: 0 },
];

const byId = (id: string): Club => CLUBS.find((c) => c.id === id)!;
export const PUTTER = byId('putter');

/** Where the ball sits. */
export type Lie = 'tee' | Surface;

/** A ball in the rough flies this share of the club's carry. */
export const LIE_FACTOR = 0.8;
/** At this distance or less (off the green) the sand wedge chips to exactly the pin. */
export const CHIP_MAX = 30;
export const CHIP_MIN = 10;

/**
 * The club for a lie and a distance to the pin. Green: the putter. Sand: the sand wedge.
 * Otherwise the full club whose carry is closest to the distance (the shorter on a tie). Close in,
 * the carry is cut to the distance: a chip (30 yd or less) with the sand wedge, a pitch (under a
 * full wedge) with the wedge, so a short shot never flies far past the green.
 */
export function clubFor(lie: Lie, distToPin: number): Club {
  if (lie === 'green') return PUTTER;
  const sandWedge = byId('sand');
  if (distToPin <= CHIP_MAX) return { ...sandWedge, carry: Math.max(distToPin, CHIP_MIN) };
  if (lie === 'sand') return sandWedge;
  let best = CLUBS[0];
  for (const c of CLUBS) {
    if (c.id === 'putter' || c.id === 'sand') continue;
    const d = Math.abs(c.carry - distToPin);
    const bestD = Math.abs(best.carry - distToPin);
    if (d < bestD || (d === bestD && c.carry < best.carry)) best = c;
  }
  if (best.id === 'wedge' && distToPin < best.carry) return { ...best, carry: distToPin };
  return best;
}

export interface Plan {
  club: Club;
  /** Aim angle from the line to the pin, degrees, clamped to +-AIM_MAX. */
  aimDeg: number;
  from: { x: number; z: number };
  /** Yards the club will fly (after the lie factor and chip scaling). */
  carry: number;
  /** Flight direction, radians from +z towards +x. */
  dir: number;
  /** Where a perfect shot lands: the aim plus the wind (or the slope for a putt). */
  landing: { x: number; z: number };
}

export const AIM_MAX = 35;
export const AIM_STEP = 1;

const RAD = Math.PI / 180;

export function planShot(h: Hole, from: { x: number; z: number }, lie: Lie, aimDeg: number): Plan {
  const dist = Math.hypot(h.pin.x - from.x, h.pin.z - from.z);
  const c = clubFor(lie, dist);
  const aim = Math.min(Math.max(aimDeg, -AIM_MAX), AIM_MAX);
  const base = Math.atan2(h.pin.x - from.x, h.pin.z - from.z);
  const dir = base + aim * RAD;
  const putt = c.id === 'putter';
  const nominal = byId(c.id).carry === c.carry;
  const carry = putt ? Math.max(dist, 1) : c.carry * (lie === 'rough' && nominal ? LIE_FACTOR : 1);
  const drift = putt ? (h.slope * carry) / 10 : (h.wind * carry) / 100;
  return {
    club: c,
    aimDeg: aim,
    from: { ...from },
    carry,
    dir,
    landing: { x: from.x + carry * Math.sin(dir) + drift, z: from.z + carry * Math.cos(dir) },
  };
}

export type Quality = 'perfect' | 'wobbly' | 'duff';

export interface Outcome {
  quality: Quality;
  /** Where the ball finishes (before hazard handling). */
  end: { x: number; z: number };
  /** Hook/slice side for the animation. */
  side: -1 | 1;
}

/** A right answer faster than this (seconds of the clock) flies exactly to the ring. */
export const PERFECT_UNDER = 1;
/** Wobbly: the sideways error is MAX_SIDE * carry when the whole clock was used. */
export const MAX_SIDE = 0.08;
/** Duff: the ball travels this share of the carry. */
export const DUFF_FRACTION = 0.35;
/** Duff: degrees off line. */
export const DUFF_ANGLE = 22;

export const isPutt = (plan: Plan): boolean => plan.club.id === 'putter';

export function resolveShot(
  plan: Plan,
  right: boolean,
  used: number,
  clock: number,
  sideRoll: -1 | 1,
): Outcome {
  const { from, carry, dir } = plan;
  if (!right) {
    if (isPutt(plan)) {
      const d = 0.4 * carry;
      return {
        quality: 'duff',
        end: { x: from.x + d * Math.sin(dir) + sideRoll * 1.5, z: from.z + d * Math.cos(dir) },
        side: sideRoll,
      };
    }
    const angle = dir + sideRoll * DUFF_ANGLE * RAD;
    const d = DUFF_FRACTION * carry;
    return {
      quality: 'duff',
      end: { x: from.x + d * Math.sin(angle), z: from.z + d * Math.cos(angle) },
      side: sideRoll,
    };
  }
  if (used < PERFECT_UNDER) return { quality: 'perfect', end: { ...plan.landing }, side: sideRoll };
  const share = Math.min(1, (used - PERFECT_UNDER) / Math.max(clock - PERFECT_UNDER, 1e-3));
  const err = MAX_SIDE * carry * share;
  return {
    quality: 'wobbly',
    end: { x: plan.landing.x + sideRoll * err, z: plan.landing.z },
    side: sideRoll,
  };
}

export type Result =
  | { kind: 'holed' }
  | {
      kind: 'rest';
      at: { x: number; z: number };
      surface: Surface;
      /** Set when the ball hit a tree: how far along its flight (0 to 1) it dropped. */
      tree?: number;
    }
  | { kind: 'water'; splash: { x: number; z: number }; drop: { x: number; z: number } };

/** A putt or shot ending this close to the pin is holed (a generous "gimme"). */
export const CUP_R = 1.2;

/**
 * The outcome for drawing a holed shot: the ball flies to the pin itself (the cup is drawn true size,
 * much smaller than the generous CUP_R that counts), keeping the quality and side.
 */
export function holedOutcome(outcome: Outcome, pin: { x: number; z: number }): Outcome {
  return { ...outcome, end: { x: pin.x, z: pin.z } };
}

/** Keeps a ball inside the rough wall and not far behind the tee. */
export function clampEnd(h: Hole, p: { x: number; z: number }): { x: number; z: number } {
  const c = centreX(h, p.z);
  return {
    x: Math.min(Math.max(p.x, c - ROUGH_HALF), c + ROUGH_HALF),
    z: Math.max(p.z, -10),
  };
}

/** A tree is this tall, yards: a ball flying lower than this through its circle is stopped. */
export const TREE_HEIGHT = 12;

/**
 * Where the ball is `t` (0 to 1) along its flight: a straight run from the tee to the ring with a
 * parabola for height (`h`, above the ground). A hook or slice bends in late, so the ball starts on
 * line. A putt rolls straight.
 */
export function pathAt(
  plan: Plan,
  outcome: Outcome,
  t: number,
): { x: number; h: number; z: number } {
  const { from } = plan;
  const u = Math.min(Math.max(t, 0), 1);
  if (isPutt(plan)) {
    return {
      x: from.x + (outcome.end.x - from.x) * u,
      h: 0,
      z: from.z + (outcome.end.z - from.z) * u,
    };
  }
  const duff = outcome.quality === 'duff';
  const aimedAt = duff ? outcome.end : plan.landing;
  const bend = { x: outcome.end.x - aimedAt.x, z: outcome.end.z - aimedAt.z };
  const carry = duff ? DUFF_FRACTION * plan.carry : plan.carry;
  return {
    x: from.x + (aimedAt.x - from.x) * u + bend.x * u * u,
    h: 4 * plan.club.apex * carry * u * (1 - u) * (duff ? 0.5 : 1),
    z: from.z + (aimedAt.z - from.z) * u + bend.z * u * u,
  };
}

/**
 * Walks the flight in 1 yd steps and returns the first point where the ball is inside a tree's
 * circle lower than TREE_HEIGHT, or null. A putt never hits a tree, and a tree the ball already
 * stands in (after a previous hit) is ignored.
 */
export function treeHit(
  h: Hole,
  plan: Plan,
  outcome: Outcome,
): { t: number; at: { x: number; z: number } } | null {
  if (isPutt(plan) || h.trees.length === 0) return null;
  const trees = h.trees.filter((tr) => Math.hypot(plan.from.x - tr.x, plan.from.z - tr.z) > tr.r);
  const dist = Math.hypot(outcome.end.x - plan.from.x, outcome.end.z - plan.from.z);
  const steps = Math.max(Math.ceil(dist), 1);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = pathAt(plan, outcome, t);
    if (p.h >= TREE_HEIGHT) continue;
    if (trees.some((tr) => Math.hypot(p.x - tr.x, p.z - tr.z) <= tr.r)) {
      return { t, at: { x: p.x, z: p.z } };
    }
  }
  return null;
}

export function finishShot(h: Hole, plan: Plan, outcome: Outcome): Result {
  const end = clampEnd(h, outcome.end);
  if (Math.hypot(end.x - h.pin.x, end.z - h.pin.z) <= CUP_R) return { kind: 'holed' };
  const hit = treeHit(h, plan, { ...outcome, end });
  if (hit) return { kind: 'rest', at: hit.at, surface: 'rough', tree: hit.t };
  const surface = surfaceAt(h, end.x, end.z);
  if (surface !== 'water') return { kind: 'rest', at: end, surface };
  // The drop: step back towards where the shot was played from until the ground is dry.
  const dx = plan.from.x - end.x;
  const dz = plan.from.z - end.z;
  const len = Math.hypot(dx, dz);
  let drop = { ...plan.from };
  if (len > 0) {
    for (let i = 1; i <= 200; i++) {
      const step = Math.min(i * 2, len);
      const p = { x: end.x + (dx / len) * step, z: end.z + (dz / len) * step };
      if (surfaceAt(h, p.x, p.z) !== 'water') {
        drop = p;
        break;
      }
      if (step >= len) break;
    }
  }
  return { kind: 'water', splash: end, drop };
}
