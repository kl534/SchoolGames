/**
 * What a player has learned on the keyboard: the last 20 first-try results per skill, the open
 * level, the clock's seconds per key. Pure.
 */
import {
  LEVEL_COUNT,
  levelOf,
  skillOf,
  SPEED_WPM,
  TOTAL_SKILLS,
  TYPING_LEVELS,
  type SkillId,
} from './course';

/** The stars and high score key, and the menu choice id, of the Typing path. */
export const TYPING_LEVEL_ID = 'typing-level';

export interface TypingProgress {
  /** The highest open level, 1 to 40; it never goes down. */
  open: number;
  /** The last level picked. */
  level: number;
  /** Levels whose lesson has finished. */
  lessons: number[];
  /** The last (up to) 20 first-try results of each skill, `1` right and `0` wrong, newest last. */
  keys: Record<SkillId, string>;
  /** Seconds per key on the key levels' clock. */
  spk: number;
  bestWpm: number;
}

export const HISTORY = 20;
export const LEARN_RIGHT = 18;
export const SPK_START = 2.0;
export const SPK_MIN = 0.25;
export const SPK_MAX = 2.5;
export const SPK_PERFECT = 0.95;
export const SPK_TIMEOUT = 1.1;
/** Seconds added to a block's clock: key levels, speed levels. */
export const CLOCK_SLACK = 1.5;
export const CLOCK_SLACK_SPEED = 0.5;
/** Speed levels: blocks in a row at the goal speed, and the share of keys right, to pass. */
export const SPEED_STREAK = 3;
export const SPEED_ACCURACY = 0.9;
/** The share of a test-out block that must be right first time. */
export const TEST_PASS_SHARE = 0.9;
/** The clock's seconds per key grow by this when a level opens by passing. */
export const SPK_LEVEL_UP = 1.25;

export function emptyTyping(): TypingProgress {
  return { open: 1, level: 1, lessons: [], keys: {}, spk: SPK_START, bestWpm: 0 };
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high);

const isInt = (value: unknown): value is number => Number.isInteger(value);

/** Turns whatever was saved into a complete `TypingProgress`: clamps numbers, drops junk. */
export function normalizeTyping(data: unknown): TypingProgress {
  const out = emptyTyping();
  if (!data || typeof data !== 'object') return out;
  const d = data as Record<string, unknown>;
  if (isInt(d.open)) out.open = clamp(d.open, 1, LEVEL_COUNT);
  if (isInt(d.level)) out.level = clamp(d.level, 1, LEVEL_COUNT);
  if (Array.isArray(d.lessons)) {
    out.lessons = [
      ...new Set(d.lessons.filter(isInt).filter((n) => n >= 1 && n <= LEVEL_COUNT)),
    ].sort((a, b) => a - b);
  }
  if (d.keys && typeof d.keys === 'object') {
    for (const [skill, history] of Object.entries(d.keys)) {
      if (typeof history === 'string' && /^[01]+$/.test(history)) {
        out.keys[skill] = history.slice(-HISTORY);
      }
    }
  }
  if (typeof d.spk === 'number' && Number.isFinite(d.spk)) out.spk = clamp(d.spk, SPK_MIN, SPK_MAX);
  if (typeof d.bestWpm === 'number' && Number.isFinite(d.bestWpm)) {
    out.bestWpm = Math.max(0, d.bestWpm);
  }
  return out;
}

/** Saves a press of `char` (a capital counts for its Shift skill): right first time or not. */
export function recordPress(tp: TypingProgress, char: string, right: boolean): void {
  const skill = skillOf(char);
  tp.keys[skill] = ((tp.keys[skill] ?? '') + (right ? '1' : '0')).slice(-HISTORY);
}

/** The share of a skill's saved presses that were wrong, 0 when it has none. */
export function missRate(tp: TypingProgress, skill: SkillId): number {
  const history = tp.keys[skill];
  if (!history) return 0;
  return [...history].filter((c) => c === '0').length / history.length;
}

/** Learned: at least `LEARN_RIGHT` of the last `HISTORY` presses were right first time. */
export function skillLearned(tp: TypingProgress, skill: SkillId): boolean {
  const history = tp.keys[skill];
  if (!history) return false;
  return [...history].filter((c) => c === '1').length >= LEARN_RIGHT;
}

/** A key level passes when all its new skills are learned; a speed level never does from stats. */
export function levelPassed(tp: TypingProgress, n: number): boolean {
  const level = levelOf(n);
  return level.kind === 'keys' && level.skills.every((skill) => skillLearned(tp, skill));
}

/** Skills learned for the menu: those of the levels before the open one, the open one's learned ones, and the speed levels passed. */
export function learnedCount(tp: TypingProgress): number {
  let count = 0;
  for (const level of TYPING_LEVELS) {
    if (level.n < tp.open) {
      count += level.kind === 'speed' ? 1 : level.skills.length;
    } else if (level.n === tp.open) {
      count += level.skills.filter((skill) => skillLearned(tp, skill)).length;
    }
  }
  return count;
}

/** Every skill and speed level together, what `learnedCount` counts up to. */
export const TOTAL_LEARNABLE = TOTAL_SKILLS + SPEED_WPM.length;

/** The seconds per key after a block: 5% faster for a perfect one, 10% slower for a time-out. */
export function nextSpk(spk: number, result: 'perfect' | 'mistakes' | 'timeout'): number {
  const next =
    result === 'perfect' ? spk * SPK_PERFECT : result === 'timeout' ? spk * SPK_TIMEOUT : spk;
  return clamp(next, SPK_MIN, SPK_MAX);
}

/** Seconds on the clock for a block of `keys` keys on level n. */
export function clockFor(n: number, keys: number, spk: number): number {
  const level = levelOf(n);
  if (level.kind === 'speed') return keys * (12 / level.wpm!) + CLOCK_SLACK_SPEED;
  return keys * spk + CLOCK_SLACK;
}

/** Words a minute: five keys make a word. */
export function wpm(keys: number, seconds: number): number {
  return keys / 5 / (seconds / 60);
}

/** Opens level n (and none above it); an open level stays open. */
export function openLevel(tp: TypingProgress, n: number): void {
  tp.open = Math.max(tp.open, clamp(n, 1, LEVEL_COUNT));
}

/** Opens the next level by passing: the clock gets a little slower for the new keys. Returns the new level, or null at the last. */
export function levelUp(tp: TypingProgress): number | null {
  if (tp.open >= LEVEL_COUNT) return null;
  tp.open++;
  tp.spk = Math.min(tp.spk * SPK_LEVEL_UP, SPK_MAX);
  return tp.open;
}
