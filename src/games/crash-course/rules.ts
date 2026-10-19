/** Pure game rules and motion helpers, kept free of three.js objects so they are easy to test. */

export type ObstacleKind = 'loop' | 'ramp' | 'ring' | 'crates' | 'bridge' | 'seesaw' | 'coaster';
export const OBSTACLE_KINDS: readonly ObstacleKind[] = [
  'loop',
  'ramp',
  'ring',
  'crates',
  'bridge',
  'seesaw',
  'coaster',
];
export type Outcome = 'clear' | 'crash';
export type Variant = 0 | 1;

/** What the game says, besides the facts (recorded clips, `npm run voice`). */
export const OUT_OF_BIKES_SPEECH = 'Out of bikes!';
export const NEW_HIGH_SCORE_SPEECH = 'New high score!';
export const GREAT_RIDING_SPEECH = 'Great riding!';

/** Bikes the rider starts each run with. */
export const BIKES = 3;
/** Every this-many-th obstacle starts a Mega Stunt of MEGA_PIECES obstacles. */
export const MEGA_EVERY = 8;
/** Questions asked up front, and elements in a Mega course. */
export const MEGA_PIECES = 3;
/** Points for clearing every element of a Mega Stunt. */
export const MEGA_BONUS = 500;
/** Pause after a gate before the next question appears, and after the last gate before the nitro. */
export const GATE_BEAT = 0.5; // s
/** Seconds the "MEGA STUNT!" banner shows. */
export const MEGA_BANNER = 1.5; // s
/** Points for riding through a coin. */
export const COIN_POINTS = 25;
/** Points for a right answer however slow, and the extra for answering instantly. */
export const BASE_POINTS = 100;
export const TIME_BONUS = 50;
/** The score streak at which the multiplier steps up to ×2 and ×3. */
export const STREAK_X2 = 5;
export const STREAK_X3 = 10;

/** How much faster the world gets with each obstacle cleared, and the most it can reach. */
export const SPEED_STEP = 0.05;
export const SPEED_MAX = 1.6;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Score multiplier for a streak of right answers in a row (counting the one being scored). */
export function multiplierFor(streak: number): number {
  if (streak >= STREAK_X3) return 3;
  if (streak >= STREAK_X2) return 2;
  return 1;
}

/** The score streak after a right answer (one more) or a miss (back to zero). */
export function nextStreak(streak: number, hit: boolean): number {
  return hit ? streak + 1 : 0;
}

/**
 * Points for one right answer: 100, plus up to 50 for time left on the clock, times the
 * multiplier for the streak including this answer.
 */
export function hitPoints(timeLeft: number, timeTotal: number, streak: number): number {
  const left = timeTotal > 0 ? clamp01(timeLeft / timeTotal) : 0;
  return Math.round((BASE_POINTS + TIME_BONUS * left) * multiplierFor(streak));
}

/** One bike lost, never below zero. */
export function loseBike(bikes: number): number {
  return Math.max(0, bikes - 1);
}

export function outOfBikes(bikes: number): boolean {
  return bikes <= 0;
}

/** How much faster than the base speed the world goes after this many obstacles are cleared. */
export function worldSpeedFactor(cleared: number): number {
  return Math.min(1 + SPEED_STEP * Math.max(cleared, 0), SPEED_MAX);
}

/** Eases `current` towards `goal`; frame-rate independent for a given `rate` (1/seconds). */
export function easeToward(current: number, goal: number, rate: number, delta: number): number {
  return current + (goal - current) * (1 - Math.exp(-rate * delta));
}

// ---------- Obstacle order ----------

/**
 * The next obstacle: a random kind that is not `previous` (any kind when `previous` is null).
 * `random` (0 <= random < 1) picks among the allowed kinds in OBSTACLE_KINDS order.
 */
export function nextKind(previous: ObstacleKind | null, random: number): ObstacleKind {
  const allowed = OBSTACLE_KINDS.filter((kind) => kind !== previous);
  return allowed[Math.min(Math.floor(clamp01(random) * allowed.length), allowed.length - 1)];
}

/** Obstacles are numbered from 1. The Mega Stunt starts at every MEGA_EVERY-th one: 8, 16, 24... */
export function startsMega(n: number): boolean {
  return n > 0 && n % MEGA_EVERY === 0;
}

// ---------- Mega courses ----------

export type MegaId = 'triple-loop';
/** The Mega courses, in the order `nextMega` picks among them. */
export const MEGA_IDS: readonly MegaId[] = ['triple-loop'];
/** How many questions the player got right before the first miss: 0 to MEGA_PIECES. */
export type Passed = 0 | 1 | 2 | 3;

/**
 * The next Mega course: a random one that is not `previous` (any when `previous` is null);
 * index floor(random * allowed.length) among the allowed ids in MEGA_IDS order. With a single
 * course it is always that course.
 */
export function nextMega(previous: MegaId | null, random: number): MegaId {
  const others = MEGA_IDS.filter((id) => id !== previous);
  const allowed = others.length > 0 ? others : MEGA_IDS;
  return allowed[Math.min(Math.floor(clamp01(random) * allowed.length), allowed.length - 1)];
}

/**
 * Three distinct kinds for a Mega Stunt, none equal to `previous`. Picks the first kind like
 * `nextKind`, then the second from the kinds not yet used (and not `previous`), then the third
 * the same way.
 */
export function megaKinds(
  previous: ObstacleKind | null,
  randoms: readonly [number, number, number],
): ObstacleKind[] {
  const chosen: ObstacleKind[] = [];
  for (const random of randoms) {
    const allowed = OBSTACLE_KINDS.filter((kind) => kind !== previous && !chosen.includes(kind));
    chosen.push(
      allowed[Math.min(Math.floor(clamp01(random) * allowed.length), allowed.length - 1)],
    );
  }
  return chosen;
}

/**
 * Which trick or crash plays: the first time `random` picks (< 0.5 gives 0, else 1); after
 * that, the other one, so the same one never plays twice in a row.
 */
export function pickVariant(last: Variant | undefined, random: number): Variant {
  if (last === undefined) return random < 0.5 ? 0 : 1;
  return last === 0 ? 1 : 0;
}

// ---------- The approach ----------

export const RIDE_SPEED = 6; // u/s at the start, before the speed factor
export const ENTRY_SPEED = 10; // u/s the bike has when it reaches an obstacle
export const NITRO_MAX = 45; // u/s
export const NITRO_TIME = 0.9; // s: the nitro aims to cover the rest of the gap in this long
export const MAX_GAP = 70; // u: the furthest the obstacle is when the clock starts
export const MIN_GAP_PAST_VIEW = 6; // u: the obstacle is at least this far beyond the right screen edge

export interface Approach {
  /** Distance from the bike to the obstacle's entry line when the clock starts. */
  gap: number;
  /** Speed the bike rides during the clock: gap / clockSeconds, so it arrives as the clock ends. */
  rideSpeed: number;
}

/**
 * gap = clamp(speed * clockSeconds, ahead + MIN_GAP_PAST_VIEW, MAX_GAP), where `speed` is
 * RIDE_SPEED * worldSpeedFactor(cleared) and `ahead` is how far the screen shows in front of the
 * bike. If `ahead + MIN_GAP_PAST_VIEW` would exceed MAX_GAP, the gap is MAX_GAP.
 * rideSpeed = gap / clockSeconds. clockSeconds is the fact's timer (at least 1).
 */
export function approach(cleared: number, clockSeconds: number, ahead: number): Approach {
  const clock = Math.max(clockSeconds, 1);
  const speed = RIDE_SPEED * worldSpeedFactor(cleared);
  const gap = clamp(speed * clock, Math.min(ahead + MIN_GAP_PAST_VIEW, MAX_GAP), MAX_GAP);
  return { gap, rideSpeed: gap / clock };
}

/**
 * Speed once an answer is chosen, from the distance still to go: clamp(gap / NITRO_TIME,
 * ENTRY_SPEED, NITRO_MAX). So the last few units are ridden at ENTRY_SPEED and a long gap is
 * crossed in about 1.6 s at most.
 */
export function nitroSpeed(gap: number): number {
  return clamp(gap / NITRO_TIME, ENTRY_SPEED, NITRO_MAX);
}

/** Fraction of the way along the approach: 0 when the clock starts, 1 when the bike arrives. */
export function approachProgress(clockLeft: number, clockTotal: number): number {
  if (clockTotal <= 0) return 1;
  return clamp01(1 - clockLeft / clockTotal);
}

// ---------- Coins ----------

/** Distance between coins in a trail. */
export const COIN_GAP = 2.2;
/** Coins per trail. */
export const COIN_TRAIL = [3, 4, 5] as const;
/** Coins float at this height above the road (the rider's chest), in the rider's reach. */
export const COIN_Y = 1.3;

/** Trail count: floor(random * 3) picks COIN_TRAIL[i]. Trails are placed from the right screen edge. */
export function trailLength(random: number): number {
  return COIN_TRAIL[
    Math.min(Math.floor(clamp01(random) * COIN_TRAIL.length), COIN_TRAIL.length - 1)
  ];
}
