/**
 * The pure rules of Typo Troopers: the chunks of keys, what a lock-on picks, points, the pace of the
 * march, the march itself, the speed levels' groups and the results line. No DOM, no three.js.
 */
import { chunkWordsMode, planChunk, targetText } from '../../shared/typing/chunks';
import { levelOf, multiplier } from '../../shared/typing/course';
import { SPEED_ACCURACY, wpm } from '../../shared/typing/progress';
import { DROPS_TO_LAND, FIELD_HALF, RECOIL_DROPS, STEP_X, STEPS_PER_PASS } from './layout';

/** Re-exported from the shared chunk planner. */
export { chunkWordsMode, planChunk, targetText };
export type { ChunkOptions } from '../../shared/typing/chunks';

export type Kind = 'octopus' | 'crab' | 'squid' | 'ufo';
/** Row 0 is the bottom. */
export const ROW_KINDS: Kind[] = ['octopus', 'crab', 'squid'];
export const COLUMNS = 6;
export const ROWS = 3;
/** Letters before the ␣. */
export const CHUNK_KEYS: Record<Kind, number> = { octopus: 2, crab: 3, squid: 4, ufo: 8 };
export const BASE_POINTS: Record<Kind, number> = { octopus: 10, crab: 20, squid: 30, ufo: 100 };
/** Keys a wave is planned with: 6 × (3 + 4 + 5). */
export const WAVE_KEYS = 72;
export const CANNONS = 3;
export const SLACK_START = 3.2;
export const SLACK_PER_WAVE = 0.92;
export const SLACK_MIN = 2.2;
/** The march is up to this much faster with one invader left (×1 with all 18). */
export const THIN = 0.25;
export const STEP_MIN = 0.12; // s
/** Kills per speed-level group; 3 groups in a row at the goal pass the level (SPEED_STREAK). */
export const SPEED_GROUP = 10;
export const WAVE_BONUS = 50;
export const UFO_AT_ALIVE = 12; // the UFO flies when alive first drops to ≤ 12
export const UFO_MIN_SECONDS = 6;

export interface LockCandidate {
  id: string;
  text: string;
  bottomY: number;
  x: number;
  ufo: boolean;
}

/**
 * The target to aim at among those whose text starts with `typed`: an invader before the UFO,
 * then the lowest, then the one nearest the cannon. Null when none starts with it.
 */
export function lockTarget(
  targets: readonly LockCandidate[],
  typed: string,
  cannonX: number,
): string | null {
  let best: LockCandidate | null = null;
  for (const t of targets) {
    if (!t.text.startsWith(typed)) continue;
    if (best === null) {
      best = t;
      continue;
    }
    if (t.ufo !== best.ufo) {
      if (!t.ufo) best = t;
      continue;
    }
    if (t.bottomY !== best.bottomY) {
      if (t.bottomY < best.bottomY) best = t;
      continue;
    }
    if (Math.abs(t.x - cannonX) < Math.abs(best.x - cannonX)) best = t;
  }
  return best ? best.id : null;
}

/** What is locked: the ids still in play (empty = nothing locked), the one aimed at, the keys typed. */
export interface Aim {
  candidates: string[];
  primary: string | null;
  typed: string;
}

export const NO_AIM: Aim = { candidates: [], primary: null, typed: '' };

export type AimStep =
  /** Nothing was locked and no target starts with the key: buzz only, no mistake recorded. */
  | { kind: 'stray' }
  /** The key fits no candidate: a mistake at position `aim.typed.length`; the aim is unchanged. */
  | { kind: 'wrong'; aim: Aim }
  /** The key fits: the new aim, and the ids that dropped out (they go back to untyped). */
  | { kind: 'right'; aim: Aim; dropped: string[] }
  /** A candidate's whole text is typed: `id` dies; `others` are the rest (back to untyped). */
  | { kind: 'kill'; id: string; others: string[] };

/** One key against the aim: every target that starts with what is typed stays in play. */
export function aimKey(
  aim: Aim,
  targets: readonly LockCandidate[],
  char: string,
  cannonX: number,
): AimStep {
  const next = aim.typed + char;
  const pool =
    aim.candidates.length === 0 ? targets : targets.filter((t) => aim.candidates.includes(t.id));
  const fit = pool.filter((t) => t.text.startsWith(next));
  if (fit.length === 0)
    return aim.candidates.length === 0 ? { kind: 'stray' } : { kind: 'wrong', aim };
  const done = fit.filter((t) => t.text.length === next.length);
  if (done.length > 0) {
    const id =
      aim.primary !== null && done.some((t) => t.id === aim.primary)
        ? aim.primary
        : (lockTarget(done, next, cannonX) as string);
    const others = [...new Set([...aim.candidates, ...fit.map((t) => t.id)])].filter(
      (x) => x !== id,
    );
    return { kind: 'kill', id, others };
  }
  const ids = fit.map((t) => t.id);
  const primary =
    aim.primary !== null && ids.includes(aim.primary)
      ? aim.primary
      : lockTarget(fit, next, cannonX);
  return {
    kind: 'right',
    aim: { candidates: ids, primary, typed: next },
    dropped: aim.candidates.filter((x) => !ids.includes(x)),
  };
}

/** The aim without `id`: re-picks the primary if it was `id`; NO_AIM if no candidate is left. */
export function aimWithout(
  aim: Aim,
  id: string,
  targets: readonly LockCandidate[],
  cannonX: number,
): Aim {
  if (!aim.candidates.includes(id)) return aim;
  const candidates = aim.candidates.filter((x) => x !== id);
  if (candidates.length === 0) return NO_AIM;
  const primary =
    aim.primary !== id
      ? aim.primary
      : lockTarget(
          targets.filter((t) => candidates.includes(t.id)),
          aim.typed,
          cannonX,
        );
  return { candidates, primary, typed: aim.typed };
}

/** The streak's points multiplier, with the streak counted after the kill: ×2 from 5, ×3 from 10, ×4 from 20. */
export function streakMultiplier(streak: number): number {
  return streak >= 20 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
}

/** Points for a kill: the kind's points × streak multiplier × level multiplier. */
export function killPoints(kind: Kind, streak: number, level: number): number {
  return BASE_POINTS[kind] * streakMultiplier(streak) * multiplier(level);
}

/** The bonus for clearing wave `wave`. */
export const waveBonus = (wave: number, level: number): number =>
  WAVE_BONUS * wave * multiplier(level);

/** Seconds per key the wave is planned with: on a speed level the goal's, else the player's own. */
export function spkFor(level: number, spk: number): number {
  const goal = levelOf(level).wpm;
  return levelOf(level).kind === 'speed' && goal ? 12 / goal : spk;
}

/** How many times the time to type the whole wave the march gives: 3.2 at wave 1, 8% less each wave, never below 2.2. */
export function waveSlack(wave: number): number {
  return Math.max(SLACK_MIN, SLACK_START * SLACK_PER_WAVE ** (wave - 1));
}

/** Seconds the march takes to reach the bunkers in wave `wave` at `spkEff` seconds per key. */
export const waveBudget = (spkEff: number, wave: number): number =>
  WAVE_KEYS * spkEff * waveSlack(wave);

/**
 * Seconds between march steps: the budget spread over the steps to the bunkers (kept on budget on
 * average although the march speeds up by up to `THIN` as the formation thins out), never below
 * `STEP_MIN`.
 */
export function stepSeconds(budget: number, alive: number, total = ROWS * COLUMNS): number {
  const base = (budget * (1 + THIN / 2)) / (DROPS_TO_LAND * (STEPS_PER_PASS + 1));
  return Math.max(STEP_MIN, base / (1 + THIN * (1 - alive / total)));
}

/** Seconds the UFO takes to cross the lane. */
export const ufoSeconds = (spkEff: number): number =>
  Math.max(UFO_MIN_SECONDS, (CHUNK_KEYS.ufo + 1) * spkEff * 2);

/** Where the formation is: sideways offset, drops so far and the direction of travel. */
export interface March {
  offsetX: number;
  drops: number;
  dir: 1 | -1;
}

/** One step of the march: sideways, or a drop and a turn when the next step would pass the field's edge. */
export function nextStep(m: March, extent: { left: number; right: number }): March {
  const edge = m.dir === 1 ? extent.right + STEP_X : -(extent.left - STEP_X);
  if (edge > FIELD_HALF + 1e-9) {
    return { offsetX: m.offsetX, drops: m.drops + 1, dir: m.dir === 1 ? -1 : 1 };
  }
  return { ...m, offsetX: m.offsetX + m.dir * STEP_X };
}

/** The march steps back up after a lost cannon, never above its start. */
export const recoil = (m: March): March => ({ ...m, drops: Math.max(0, m.drops - RECOIL_DROPS) });

/** One group of `SPEED_GROUP` kills on a speed level. */
export interface Group {
  keys: number;
  mistakes: number;
  /** Active game time (marching, never paused) from the group's first key to its last kill's space. */
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
  /** Keys typed (positions finished) and how many were right first time. */
  keys: number;
  right: number;
  /** Keys and active seconds of the kills finished: the words a minute. */
  fastKeys: number;
  fastSeconds: number;
}

export const emptyStats = (): RunStats => ({ keys: 0, right: 0, fastKeys: 0, fastSeconds: 0 });

/** The words a minute of a run, 0 when no kill was finished. */
export function runWpm(stats: RunStats): number {
  return stats.fastSeconds > 0 ? wpm(stats.fastKeys, stats.fastSeconds) : 0;
}

/** 'Wave 4 · 28 words a minute · 94% right · Level 8 opened!'; parts with nothing to say are left out (the wave never is). */
export function resultsText(stats: RunStats, wave: number, opened: readonly number[]): string {
  const parts: string[] = [`Wave ${wave}`];
  const speed = Math.round(runWpm(stats));
  if (speed > 0) parts.push(`${speed} words a minute`);
  if (stats.keys > 0) parts.push(`${Math.round((100 * stats.right) / stats.keys)}% right`);
  if (opened.length === 1) parts.push(`Level ${opened[0]} opened!`);
  else if (opened.length > 1) {
    parts.push(`Levels ${opened[0]} to ${opened[opened.length - 1]} opened!`);
  }
  return parts.join(' · ');
}
