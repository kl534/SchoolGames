/** Pure game rules and motion helpers, kept free of three.js objects so they are easy to test. */

/** What the announcer says when the ship is lost, and for the final score. */
export const SHIP_DESTROYED_SPEECH = 'Ship destroyed!';
export const NEW_HIGH_SCORE_SPEECH = 'New high score!';
export const GREAT_FLYING_SPEECH = 'Great flying!';

/** Shields the ship starts each run with, and the most it can have. */
export const SHIELDS = 3;
/** Every this-many-th target is a boss asteroid. */
export const BOSS_EVERY = 8;
/** Hits (correct answers) it takes to destroy a boss asteroid. */
export const BOSS_HITS = 3;
/** Points for destroying a boss asteroid, on top of its hits. */
export const BOSS_BONUS = 500;
/** Points for flying through a crystal. */
export const CRYSTAL_POINTS = 25;
/** Points for a hit however slow, and the extra for answering instantly. */
export const BASE_POINTS = 100;
export const TIME_BONUS = 50;
/** The score streak at which the multiplier steps up to ×2 and ×3. */
export const STREAK_X2 = 5;
export const STREAK_X3 = 10;

/** How much faster the world gets with each asteroid destroyed, and the most it can reach. */
export const SPEED_STEP = 0.05;
export const SPEED_MAX = 1.6;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** Score multiplier for a streak of hits in a row (counting the hit being scored). */
export function multiplierFor(streak: number): number {
  if (streak >= STREAK_X3) return 3;
  if (streak >= STREAK_X2) return 2;
  return 1;
}

/** The score streak after a hit (one more) or a miss (back to zero). */
export function nextStreak(streak: number, hit: boolean): number {
  return hit ? streak + 1 : 0;
}

/**
 * Points for one hit: 100, plus up to 50 for time left on the clock, times the multiplier for
 * the streak including this hit.
 */
export function hitPoints(timeLeft: number, timeTotal: number, streak: number): number {
  const left = timeTotal > 0 ? clamp01(timeLeft / timeTotal) : 0;
  return Math.round((BASE_POINTS + TIME_BONUS * left) * multiplierFor(streak));
}

/** One shield lost, never below zero. */
export function loseShield(shields: number): number {
  return Math.max(0, shields - 1);
}

export function outOfShields(shields: number): boolean {
  return shields <= 0;
}

/** Targets are numbered from 1; every `BOSS_EVERY`th one is a boss. */
export function isBossTarget(n: number): boolean {
  return n > 0 && n % BOSS_EVERY === 0;
}

/** One clock for the whole boss fight: the time each of its questions would get, added up. */
export function bossClockTotal(seconds: readonly number[]): number {
  return seconds.reduce((sum, s) => sum + s, 0);
}

/**
 * How far along its approach the asteroid is: 0 at the lock distance, 1 at the ship.
 * Linear in the clock, so it arrives just as the time runs out.
 */
export function approachProgress(clockLeft: number, clockTotal: number): number {
  if (clockTotal <= 0) return 1;
  return clamp01(1 - clockLeft / clockTotal);
}

/** Position on the asteroid's path for a progress between `lockZ` and `hitZ`. */
export function approachZ(progress: number, lockZ: number, hitZ: number): number {
  return lockZ + (hitZ - lockZ) * clamp01(progress);
}

/** Slows down towards 1, for an asteroid flying in to its lock distance. */
export const easeOut = (t: number): number => 1 - (1 - clamp01(t)) ** 3;

/** Speeds up from 0, for an asteroid lunging at the ship. */
export const easeIn = (t: number): number => clamp01(t) ** 2;

/** How much faster than the base speed the world streams past after this many asteroids. */
export function worldSpeedFactor(destroyed: number): number {
  return Math.min(1 + SPEED_STEP * Math.max(destroyed, 0), SPEED_MAX);
}

/** Seconds until the next crystal appears. */
export function crystalInterval(roll: number): number {
  return 5 + roll * 5;
}

/** Eases `current` towards `goal`; frame-rate independent for a given `rate` (1/seconds). */
export function easeToward(current: number, goal: number, rate: number, delta: number): number {
  return current + (goal - current) * (1 - Math.exp(-rate * delta));
}

/** Whether two things at (x, y) are within `reach` of each other across the flight box. */
export function within(ax: number, ay: number, bx: number, by: number, reach: number): boolean {
  return (ax - bx) ** 2 + (ay - by) ** 2 <= reach * reach;
}
