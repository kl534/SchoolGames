/**
 * The pure rules of Type Rider: how many keys a block has, how a block finished, the speed
 * levels' streak and the results line. No DOM, no three.js.
 */
import type { Tier } from '../../shared/jetski/rules';
import { BLOCK_KEYS, type BlockTarget } from '../../shared/typing/blocks';
import { levelOf } from '../../shared/typing/course';
import { SPEED_ACCURACY, wpm } from '../../shared/typing/progress';

/** What a block is for: a gate in a Mega Stunt, or a launcher by its tier (wave, kicker, mega ramp). */
export function blockTarget(target: 'launcher' | 'gate', tier: Tier): BlockTarget {
  if (target === 'gate') return 'gate';
  return tier === 1 ? 'wave' : tier === 2 ? 'kicker' : 'mega-ramp';
}

/** Keys in the block for a turn on level `n`. */
export function blockKeys(level: number, target: 'launcher' | 'gate', tier: Tier): number {
  return BLOCK_KEYS[levelOf(level).kind][blockTarget(target, tier)];
}

/** A block with no mistakes is Perfect (it builds the streak); any mistake lands the trick but resets it. */
export function blockOutcome(mistakes: number): 'perfect' | 'mistakes' {
  return mistakes === 0 ? 'perfect' : 'mistakes';
}

/** One finished block: how many keys, how many were wrong first time, and the seconds from first key to last. */
export interface BlockResult {
  keys: number;
  mistakes: number;
  seconds: number;
}

/** The share of keys right first time, 1 for an empty block. */
export function accuracy(result: Pick<BlockResult, 'keys' | 'mistakes'>): number {
  return result.keys > 0 ? (result.keys - result.mistakes) / result.keys : 1;
}

/** A speed level's block counts when it reaches the goal words a minute with at least 90% right. */
export function speedBlockPasses(level: number, result: BlockResult): boolean {
  const goal = levelOf(level).wpm;
  if (goal === undefined || result.seconds <= 0) return false;
  return wpm(result.keys, result.seconds) >= goal && accuracy(result) >= SPEED_ACCURACY;
}

/** The streak of passing blocks in a row on a speed level after one more block; a time-out is `null`. */
export function speedStreak(streak: number, level: number, result: BlockResult | null): number {
  return result && speedBlockPasses(level, result) ? streak + 1 : 0;
}

/** What a run typed, for the results. */
export interface RunStats {
  /** Keys typed (positions finished) and how many were right first time. */
  keys: number;
  right: number;
  /** Keys and seconds of the blocks finished in time: the words a minute. */
  fastKeys: number;
  fastSeconds: number;
}

export const emptyStats = (): RunStats => ({ keys: 0, right: 0, fastKeys: 0, fastSeconds: 0 });

/** The words a minute of a run, 0 when no block was finished. */
export function runWpm(stats: RunStats): number {
  return stats.fastSeconds > 0 ? wpm(stats.fastKeys, stats.fastSeconds) : 0;
}

/** '28 words a minute · 94% right · Level 8 opened!'; parts with nothing to say are left out. */
export function resultsText(stats: RunStats, opened: readonly number[]): string {
  const parts: string[] = [];
  const speed = Math.round(runWpm(stats));
  if (speed > 0) parts.push(`${speed} words a minute`);
  if (stats.keys > 0) parts.push(`${Math.round((100 * stats.right) / stats.keys)}% right`);
  if (opened.length === 1) parts.push(`Level ${opened[0]} opened!`);
  else if (opened.length > 1) {
    parts.push(`Levels ${opened[0]} to ${opened[opened.length - 1]} opened!`);
  }
  return parts.join(' · ');
}
