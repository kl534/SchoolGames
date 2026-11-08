/** Pure game rules and motion helpers, kept free of three.js objects so they are easy to test. */

export type TrickId =
  | 'wave-hop'
  | 'spray-spin'
  | 'superman'
  | 'tail-stand' // tier 1
  | 'backflip'
  | 'barrel-roll'
  | 'helicopter' // tier 2
  | 'double-backflip'
  | 'submarine'
  | 'corkscrew'; // tier 3

/** In tier order: the order `nextTrick` picks among them. */
export const TRICK_IDS: readonly TrickId[] = [
  'wave-hop',
  'spray-spin',
  'superman',
  'tail-stand',
  'backflip',
  'barrel-roll',
  'helicopter',
  'double-backflip',
  'submarine',
  'corkscrew',
];

export type Tier = 1 | 2 | 3;

export const TRICK_TIER: Record<TrickId, Tier> = {
  'wave-hop': 1,
  'spray-spin': 1,
  superman: 1,
  'tail-stand': 1,
  backflip: 2,
  'barrel-roll': 2,
  helicopter: 2,
  'double-backflip': 3,
  submarine: 3,
  corkscrew: 3,
};

export const TRICK_NAMES: Record<TrickId, string> = {
  'wave-hop': 'Wave Hop',
  'spray-spin': 'Spray Spin',
  superman: 'Superman',
  'tail-stand': 'Tail Stand',
  backflip: 'Backflip',
  'barrel-roll': 'Barrel Roll',
  helicopter: 'Helicopter',
  'double-backflip': 'Double Backflip',
  submarine: 'Submarine',
  corkscrew: 'Corkscrew 720',
};

export type LauncherKind = 'wave' | 'kicker' | 'mega-ramp';

export const TIER_LAUNCHER: Record<Tier, LauncherKind> = {
  1: 'wave',
  2: 'kicker',
  3: 'mega-ramp',
};

export type Outcome = 'clear' | 'fail';

/** What the game says, besides the facts (recorded clips, `npm run voice`). */
export const OUT_OF_SKIS_SPEECH = 'Out of jet skis!';
export const NEW_HIGH_SCORE_SPEECH = 'New high score!';
export const GREAT_RIDING_SPEECH = 'Great riding!';

/** Jet skis the rider starts the run with. */
export const SKIS = 3;
/** The streak (right answers in a row) at which tricks step up to tier 2 and tier 3. */
export const TIER2_FROM = 3;
export const TIER3_FROM = 6;
/** Points for a right answer however slow, and the extra for answering instantly. */
export const BASE_POINTS = 100;
export const TIME_BONUS = 50;
/** Points for riding through a coin. */
export const COIN_POINTS = 25;
/** How much faster the world gets with each trick landed, and the most it can reach. */
export const SPEED_STEP = 0.05;
export const SPEED_MAX = 1.6;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** The tier of the trick for a question asked with this streak (right answers in a row before it). */
export function tierFor(streak: number): Tier {
  if (streak >= TIER3_FROM) return 3;
  if (streak >= TIER2_FROM) return 2;
  return 1;
}

/**
 * A random trick of `tier` that is not `previous` (any of the tier when `previous` is null or from
 * another tier): index floor(random * allowed.length) among the allowed ones in TRICK_IDS order.
 */
export function nextTrick(tier: Tier, previous: TrickId | null, random: number): TrickId {
  const allowed = TRICK_IDS.filter((id) => TRICK_TIER[id] === tier && id !== previous);
  return allowed[Math.min(Math.floor(clamp01(random) * allowed.length), allowed.length - 1)];
}

/**
 * Points for one right answer: 100, plus up to 50 for time left on the clock, times the tier
 * (1, 2 or 3). A timeTotal of 0 or less counts as no time left.
 */
export function hitPoints(timeLeft: number, timeTotal: number, tier: Tier): number {
  const left = timeTotal > 0 ? clamp01(timeLeft / timeTotal) : 0;
  return Math.round((BASE_POINTS + TIME_BONUS * left) * tier);
}

/** How many of the tier meter's three waves are filled: none until the first right answer. */
export function meterFill(streak: number): 0 | Tier {
  return streak <= 0 ? 0 : tierFor(streak);
}

/** The streak after a right answer (one more) or a miss (back to zero). */
export function nextStreak(streak: number, hit: boolean): number {
  return hit ? streak + 1 : 0;
}

/** One jet ski lost, never below zero. */
export function loseSki(skis: number): number {
  return Math.max(0, skis - 1);
}

export function outOfSkis(skis: number): boolean {
  return skis <= 0;
}

/** How much faster than the base speed the world goes after this many tricks are landed. */
export function worldSpeedFactor(landed: number): number {
  return Math.min(1 + SPEED_STEP * Math.max(landed, 0), SPEED_MAX);
}

/** Eases `current` towards `goal`; frame-rate independent for a given `rate` (1/seconds). */
export function easeToward(current: number, goal: number, rate: number, delta: number): number {
  return current + (goal - current) * (1 - Math.exp(-rate * delta));
}

// ---------- The approach ----------

export const RIDE_SPEED = 9; // u/s before the speed factor
export const ENTRY_SPEED = 12; // u/s at the launcher's entry line; every trick starts at this speed
export const TURBO_MAX = 50; // u/s
export const TURBO_TIME = 0.9; // s: the turbo aims to cover the rest of the gap in this long
export const MIN_GAP = 30; // u: the launcher is at least this far when the clock starts
export const MAX_GAP = 90; // u

export interface Approach {
  /** Distance from the ski to the launcher's entry line when the clock starts. */
  gap: number;
  /** Speed the ski rides during the clock: gap / clock, so it arrives as the clock ends. */
  rideSpeed: number;
}

/**
 * gap = clamp(RIDE_SPEED * worldSpeedFactor(landed) * clock, MIN_GAP, MAX_GAP) with clock the
 * fact's timer (at least 1 s); rideSpeed = gap / clock.
 */
export function approach(landed: number, clockSeconds: number): Approach {
  const clock = Math.max(clockSeconds, 1);
  const gap = clamp(RIDE_SPEED * worldSpeedFactor(landed) * clock, MIN_GAP, MAX_GAP);
  return { gap, rideSpeed: gap / clock };
}

/**
 * Speed once an answer is chosen, from the distance still to go: clamp(gap / TURBO_TIME,
 * ENTRY_SPEED, TURBO_MAX). The last few units are ridden at ENTRY_SPEED.
 */
export function turboSpeed(gap: number): number {
  return clamp(gap / TURBO_TIME, ENTRY_SPEED, TURBO_MAX);
}

/** Fraction of the way along the approach: 0 when the clock starts, 1 when the ski arrives. */
export function approachProgress(clockLeft: number, clockTotal: number): number {
  if (clockTotal <= 0) return 1;
  return clamp01(1 - clockLeft / clockTotal);
}

// ---------- Coins ----------

/** Distance between coins in a trail, and the trail lengths. */
export const COIN_GAP = 3;
export const COIN_TRAIL = [4, 5, 6] as const;
/** Coins float this high above the water. */
export const COIN_Y = 1.2;
/** The side-to-side reach of a coin trail's S. */
export const COIN_SWAY = 2.2;
/** Trails only spawn while more than this much gap is left. */
export const TRAIL_MIN_GAP = 20;

/** Trail length: floor(random * 3) picks COIN_TRAIL[i]. */
export function trailLength(random: number): number {
  return COIN_TRAIL[
    Math.min(Math.floor(clamp01(random) * COIN_TRAIL.length), COIN_TRAIL.length - 1)
  ];
}

/** Side offset of coin `i` of `n` on a gentle S: 0 at both ends, `sign` is 1 or -1. */
export function coinSide(i: number, n: number, sign: number): number {
  if (n <= 1) return 0;
  return sign * COIN_SWAY * Math.sin((Math.PI * i) / (n - 1));
}
