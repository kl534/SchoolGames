/** Pure game rules and motion helpers, kept free of three.js and the DOM so they are easy to test. */
import type { ObstacleId, PlaceId } from './places';

export type Outcome = 'clear' | 'fail';
export type Variant = 0 | 1;

/** What the game says, besides the facts (recorded clips, `npm run voice`). */
export const OUT_OF_LIVES_SPEECH = 'Out of lives!';
export const NEW_HIGH_SCORE_SPEECH = 'New high score!';
export const GREAT_RUNNING_SPEECH = 'Great running!';

/** Lives each run starts with; they are never refilled. */
export const LIVES = 3;
/** Obstacles in one visit to a place: each of its three, twice. */
export const VISIT_LENGTH = 6;
export const BASE_POINTS = 100;
export const TIME_BONUS = 50;
/** The streak at which the multiplier steps up to ×2 and ×3. */
export const STREAK_X2 = 5;
export const STREAK_X3 = 10;
/** Fish treats: points each, how many in a trail, the gap between them and their height. */
export const FISH_POINTS = 25;
export const FISH_TRAIL = [3, 4, 5] as const;
export const FISH_GAP = 1.6;
export const FISH_Y = 2.0;
/** Extra height at the middle of a trail, so it floats on an arc. */
export const FISH_ARC = 0.6;
/** How far ahead (u) of a fish the cat starts to leap for it. */
export const LEAP_REACH = 2.2;
/**
 * The lift of a leap for a fish `dx` ahead of the cat (negative once passed) and `rise` above its
 * chest: a smooth hump that peaks at the fish and is 0 when it is out of reach.
 */
export function leapLift(dx: number, rise: number): number {
  if (Math.abs(dx) >= LEAP_REACH || rise <= 0) return 0;
  const k = Math.cos((Math.PI / 2) * (dx / LEAP_REACH));
  return rise * k * k;
}
/** The trot (u/s), the speed at the obstacle, and the sprint that gets there after an answer. */
export const RUN_SPEED = 5;
export const ENTRY_SPEED = 8;
export const SPRINT_MAX = 40;
export const SPRINT_TIME = 0.9;
/** The furthest the obstacle is when the clock starts, and the least beyond the right screen edge. */
export const MAX_GAP = 60;
export const MIN_GAP_PAST_VIEW = 5;
export const FIRST_PLACE: PlaceId = 'living-room';

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const clamp01 = (n: number) => clamp(n, 0, 1);

/** Score multiplier for a streak of right answers in a row (counting the one being scored). */
export function multiplierFor(streak: number): number {
  if (streak >= STREAK_X3) return 3;
  if (streak >= STREAK_X2) return 2;
  return 1;
}

/** The streak after a right answer (one more) or a miss (back to zero). */
export function nextStreak(streak: number, hit: boolean): number {
  return hit ? streak + 1 : 0;
}

/** 100 points, plus up to 50 for time left on the clock, times the multiplier for the streak. */
export function hitPoints(timeLeft: number, timeTotal: number, streak: number): number {
  const left = timeTotal > 0 ? clamp01(timeLeft / timeTotal) : 0;
  return Math.round((BASE_POINTS + TIME_BONUS * left) * multiplierFor(streak));
}

/** One life lost, never below zero. */
export function loseLife(lives: number): number {
  return Math.max(0, lives - 1);
}

export function outOfLives(lives: number): boolean {
  return lives <= 0;
}

/** The six permutations of three, picked by a number in [0, 1). */
const ORDERS: readonly (readonly number[])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
const orderFor = (r: number) => ORDERS[Math.min(Math.floor(clamp01(r) * 6), 5)];

/**
 * The six obstacles of a visit: a random order of the three, then another, never the same
 * obstacle twice in a row (when the second order starts with the first's last, its first two
 * swap). The first three are variant 0, the last three variant 1. `r1` and `r2` are in [0, 1).
 */
export function visitPlan(
  obstacles: readonly [ObstacleId, ObstacleId, ObstacleId],
  r1: number,
  r2: number,
): { obstacle: ObstacleId; variant: Variant }[] {
  const first = [...orderFor(r1)];
  const second = [...orderFor(r2)];
  if (second[0] === first[2]) [second[0], second[1]] = [second[1], second[0]];
  return [
    ...first.map((i) => ({ obstacle: obstacles[i], variant: 0 as Variant })),
    ...second.map((i) => ({ obstacle: obstacles[i], variant: 1 as Variant })),
  ];
}

/**
 * The next place: random among `available` that are not in `visited` and not `current`; when
 * there is none, among all of `available` except `current` (the caller then resets `visited` to
 * just the new place). With a single place it stays there.
 */
export function nextPlace(
  available: readonly PlaceId[],
  visited: ReadonlySet<PlaceId>,
  current: PlaceId,
  r: number,
): PlaceId {
  const fresh = available.filter((p) => p !== current && !visited.has(p));
  const pool = fresh.length > 0 ? fresh : available.filter((p) => p !== current);
  if (pool.length === 0) return current;
  return pool[Math.min(Math.floor(clamp01(r) * pool.length), pool.length - 1)];
}

export interface Approach {
  /** Distance from the cat to the obstacle's entry line when the clock starts. */
  gap: number;
  /** The trot during the clock: gap / clockSeconds, so the cat arrives as the clock ends. */
  runSpeed: number;
}

/**
 * gap = clamp(RUN_SPEED * clock, min(ahead + MIN_GAP_PAST_VIEW, MAX_GAP), MAX_GAP), where
 * `ahead` is how much of the floor the screen shows in front of the cat. The clock is the fact's
 * timer (at least 1).
 */
export function approach(clockSeconds: number, ahead: number): Approach {
  const clock = Math.max(clockSeconds, 1);
  const gap = clamp(RUN_SPEED * clock, Math.min(ahead + MIN_GAP_PAST_VIEW, MAX_GAP), MAX_GAP);
  return { gap, runSpeed: gap / clock };
}

/** Speed once an answer is chosen: clamp(gap / SPRINT_TIME, ENTRY_SPEED, SPRINT_MAX). */
export function sprintSpeed(gap: number): number {
  return clamp(gap / SPRINT_TIME, ENTRY_SPEED, SPRINT_MAX);
}

/** Fraction of the way along the approach: 0 when the clock starts, 1 on arrival. */
export function approachProgress(clockLeft: number, clockTotal: number): number {
  if (clockTotal <= 0) return 1;
  return clamp01(1 - clockLeft / clockTotal);
}

/** Eases `current` towards `goal`; frame-rate independent for a given `rate` (1/seconds). */
export function easeToward(current: number, goal: number, rate: number, delta: number): number {
  return current + (goal - current) * (1 - Math.exp(-rate * delta));
}

/** Fish in a trail: floor(r * 3) picks FISH_TRAIL[i]. */
export function fishTrailLength(r: number): number {
  return FISH_TRAIL[Math.min(Math.floor(clamp01(r) * FISH_TRAIL.length), FISH_TRAIL.length - 1)];
}
