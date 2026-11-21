/**
 * The pure rules of Type Brawl: blocks and moves, the pace of the rings, what a lock-on picks, who
 * attacks next, points, the speed levels' groups and the results line. No DOM, no three.js.
 */
import type { Random } from '../../shared/random';
import { levelOf, multiplier } from '../../shared/typing/course';
import {
  SPEED_ACCURACY,
  levelPassed,
  wpm,
  type TypingProgress,
} from '../../shared/typing/progress';

export type Kind = 'thug' | 'bruiser' | 'boss';
export type MoveClass = 'light' | 'medium' | 'heavy' | 'finisher';
export type MoveId =
  | 'jab'
  | 'cross'
  | 'hook'
  | 'kick'
  | 'elbow'
  | 'uppercut'
  | 'roundhouse'
  | 'flying-kick'
  | 'spin-kick'
  | 'throw';
export const MOVES_BY_CLASS: Record<MoveClass, MoveId[]> = {
  light: ['jab', 'cross'],
  medium: ['hook', 'kick', 'elbow'],
  heavy: ['uppercut', 'roundhouse'],
  finisher: ['flying-kick', 'spin-kick', 'throw'],
};
/** Letters before the closing space, one entry per block; the last block is the finisher. */
export const BLOCKS: Record<Kind, number[]> = { thug: [3], bruiser: [3, 4], boss: [2, 3, 3, 4, 5] };
export const KIND_POINTS: Record<Kind, number> = { thug: 30, bruiser: 60, boss: 300 };
/** On screen at once. */
export const MAX_THUGS = 3;
export const HP_MAX = 100;
/** A wrong key. */
export const HIT_WRONG = 8;
/** A full ring. */
export const HIT_RING = 12;
export const REFILL_SCRAP = 15;
/** Ring seconds per key = seconds per key × slack. */
export const SLACK_START = 3.0;
export const SLACK_PER_STEP = 0.92;
export const SLACK_MIN = 1.5;
/** Seconds added to every ring. */
export const RING_BASE = 1.5;
/** A ring is never shorter than this. */
export const RING_MIN = 4;
/** A new block shows this long before its ring starts. */
export const READ_SECONDS = 0.8;
/** All rings freeze this long after any hit on the hero. */
export const HIT_GRACE = 1.0;
export const WAVE_BONUS = 50;
/** Knock-outs per speed-level group; 3 groups in a row at the goal pass the level (SPEED_STREAK). */
export const SPEED_GROUP = 6;

/** The letters of each block of a kind, the last one being the finisher's. */
export const blockPlan = (kind: Kind): number[] => BLOCKS[kind];

/** The class of move for block `index` of a plan: the last is the finisher, else by its keys. */
export function moveClassOf(plan: readonly number[], index: number): MoveClass {
  if (index >= plan.length - 1) return 'finisher';
  const keys = plan[index];
  return keys <= 2 ? 'light' : keys === 3 ? 'medium' : 'heavy';
}

/** A random move of the class, never `last` when the class has more than one. */
export function pickMove(cls: MoveClass, last: MoveId | null, random: Random): MoveId {
  const all = MOVES_BY_CLASS[cls];
  const pool = all.length > 1 ? all.filter((m) => m !== last) : all;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/** How many thugs scrap `scrap` (from 1) has in total: 3, 4, 5, then 6. */
export const scrapSize = (scrap: number): number => Math.min(2 + scrap, 6);

/** The kinds in a scrap; from scrap 3 each is a bruiser with probability 1/3. */
export function scrapKinds(scrap: number, random: Random): Kind[] {
  const out: Kind[] = [];
  for (let i = 0; i < scrapSize(scrap); i++) {
    out.push(scrap >= 3 && random() < 1 / 3 ? 'bruiser' : 'thug');
  }
  return out;
}

/** Seconds per key the rings are planned with: on a speed level the goal's, else the player's own. */
export function spkFor(level: number, spk: number): number {
  const goal = levelOf(level).wpm;
  return levelOf(level).kind === 'speed' && goal ? 12 / goal : spk;
}

/** The level counts as mastered: a speed level, an older level, or one whose keys are learned. */
export function mastered(typing: TypingProgress, level: number): boolean {
  return levelOf(level).kind === 'speed' || level < typing.open || levelPassed(typing, level);
}

/** Ring seconds per key: 3.0 at 0 steps, 8% less each step, never below 1.5. */
export const slackFor = (rampSteps: number): number =>
  Math.max(SLACK_MIN, SLACK_START * SLACK_PER_STEP ** rampSteps);

/** Seconds a ring takes for a block of `keys` letters (and its space) at `spkEff` seconds per key. */
export const ringSeconds = (keys: number, spkEff: number, slack: number): number =>
  Math.max(RING_MIN, (keys + 1) * spkEff * slack + RING_BASE);

/** The streak's points multiplier, counted after the knock-out: ×2 from 5, ×3 from 10, ×4 from 20. */
export const streakMultiplier = (streak: number): number =>
  streak >= 20 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1;

/** Points for a knock-out: the kind's points × streak multiplier × level multiplier. */
export const killPoints = (kind: Kind, streak: number, level: number): number =>
  KIND_POINTS[kind] * streakMultiplier(streak) * multiplier(level);

/** Points for a block that lands (no streak). */
export const blockPoints = (keys: number, level: number): number => 10 * keys * multiplier(level);

/** The bonus for clearing scrap `scrap`. */
export const scrapBonus = (scrap: number, level: number): number =>
  WAVE_BONUS * scrap * multiplier(level);

export interface Candidate {
  id: string;
  /** The block showing (keys and closing space). */
  text: string;
  /** World x. */
  x: number;
  engaged: boolean;
}

/** The thug a first key locks onto: engaged, text starts with `char`, nearest to the hero, then lowest id. */
export function lockThug(cands: readonly Candidate[], char: string, heroX: number): string | null {
  let best: Candidate | null = null;
  for (const c of cands) {
    if (!c.engaged || c.text[0] !== char) continue;
    if (best === null) {
      best = c;
      continue;
    }
    const d = Math.abs(c.x - heroX);
    const bd = Math.abs(best.x - heroX);
    if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && c.id < best.id)) best = c;
  }
  return best ? best.id : null;
}

/** The engaged thug that attacks: the lowest `turn`, ties by id. */
export function attackerOf(
  thugs: readonly { id: string; turn: number; engaged: boolean }[],
): string | null {
  let best: { id: string; turn: number } | null = null;
  for (const t of thugs) {
    if (!t.engaged) continue;
    if (best === null || t.turn < best.turn || (t.turn === best.turn && t.id < best.id)) best = t;
  }
  return best ? best.id : null;
}

export const hitHero = (hp: number, amount: number): number => Math.max(0, hp - amount);
export const refill = (hp: number, amount: number): number => Math.min(HP_MAX, hp + amount);

/** One group of `SPEED_GROUP` knock-outs on a speed level. */
export interface Group {
  keys: number;
  mistakes: number;
  /** Active game seconds of the group's blocks, each from its first key to its space. */
  seconds: number;
}

/** The share of keys right first time, 1 for an empty group. */
export function accuracy(group: Pick<Group, 'keys' | 'mistakes'>): number {
  return group.keys > 0 ? (group.keys - group.mistakes) / group.keys : 1;
}

/** A speed level's group counts when it reaches the goal words a minute with at least 90% right. */
export function speedGroupPasses(level: number, g: Group): boolean {
  const goal = levelOf(level).wpm;
  if (goal === undefined || g.seconds <= 0) return false;
  return wpm(g.keys, g.seconds) >= goal && accuracy(g) >= SPEED_ACCURACY;
}

/** What a run typed, for the results. */
export interface RunStats {
  keys: number;
  right: number;
  fastKeys: number;
  fastSeconds: number;
  knockouts: number;
}

export const emptyStats = (): RunStats => ({
  keys: 0,
  right: 0,
  fastKeys: 0,
  fastSeconds: 0,
  knockouts: 0,
});

/** The words a minute of a run, 0 when no block was finished. */
export function runWpm(stats: RunStats): number {
  return stats.fastSeconds > 0 ? wpm(stats.fastKeys, stats.fastSeconds) : 0;
}

/** 'Fight 4 · 11 knock-outs · 28 words a minute · 94% right · Level 8 opened!'; empty parts are left out. */
export function resultsText(stats: RunStats, scrap: number, opened: readonly number[]): string {
  const parts: string[] = [`Fight ${scrap}`];
  if (stats.knockouts > 0) {
    parts.push(`${stats.knockouts} knock-out${stats.knockouts === 1 ? '' : 's'}`);
  }
  const speed = Math.round(runWpm(stats));
  if (speed > 0) parts.push(`${speed} words a minute`);
  if (stats.keys > 0) parts.push(`${Math.round((100 * stats.right) / stats.keys)}% right`);
  if (opened.length === 1) parts.push(`Level ${opened[0]} opened!`);
  else if (opened.length > 1) {
    parts.push(`Levels ${opened[0]} to ${opened[opened.length - 1]} opened!`);
  }
  return parts.join(' · ');
}
