/**
 * What the typing progress page shows: each key's step on every open level, the keys of passed
 * levels that slipped, the bar's counts and the colour state of each key of the keyboard. Pure.
 */
import { LEVEL_COUNT, levelOf, TYPING_LEVELS, type SkillId } from './course';
import { KEYS, keyFor } from './keyboard-layout';
import { skillLearned, TOTAL_LEARNABLE, learnedCount, type TypingProgress } from './progress';
import type { StepCounts } from '../progress';

/** Right presses (of the last HISTORY) from which an open-level key is Almost. */
export const ALMOST_RIGHT = 12;
/** Wrong presses (of the last HISTORY) from which a passed key is flagged for practice. */
export const SLIP_WRONG = 3;

/** New, Started, Almost, Learned. */
export type KeyStep = 0 | 1 | 2 | 3;

export interface SkillReport {
  skill: SkillId;
  /** 'f', 'space', 'Left Shift', 'Right Shift', ';' … (see skillLabel). */
  label: string;
  step: KeyStep;
  /** '1's in the saved history (at most HISTORY). */
  right: number;
  /** Length of the saved history. */
  presses: number;
  /** On a passed level, with presses - right >= SLIP_WRONG. Always false on the open level. */
  practice: boolean;
}

export interface LevelReport {
  n: number;
  kind: 'keys' | 'speed';
  /** `Level 6 of 40: e i` */
  heading: string;
  /** Key levels: one per skill of the level, in course order. Speed levels: []. */
  skills: SkillReport[];
  /** Speed levels only. */
  wpm?: number;
  /** n < tp.open. */
  passed: boolean;
}

export type KeyState = 'learned' | 'practice' | 'almost' | 'started' | 'new' | 'locked';

export function skillLabel(skill: SkillId): string {
  if (skill === ' ') return 'space';
  if (skill === 'shift-left') return 'Left Shift';
  if (skill === 'shift-right') return 'Right Shift';
  return skill;
}

export function skillReport(tp: TypingProgress, skill: SkillId, n: number): SkillReport {
  const h = tp.keys[skill] ?? '';
  const right = [...h].filter((c) => c === '1').length;
  const presses = h.length;
  let step: KeyStep = 0;
  let practice = false;
  if (n < tp.open) {
    step = 3;
    practice = presses - right >= SLIP_WRONG;
  } else if (skillLearned(tp, skill)) step = 3;
  else if (right >= ALMOST_RIGHT) step = 2;
  else if (presses > 0) step = 1;
  return { skill, label: skillLabel(skill), step, right, presses, practice };
}

/** The open levels, newest first. */
export function typingReport(tp: TypingProgress): LevelReport[] {
  const out: LevelReport[] = [];
  const open = Math.min(Math.max(tp.open, 1), LEVEL_COUNT);
  for (let n = open; n >= 1; n--) {
    const level = levelOf(n);
    out.push({
      n,
      kind: level.kind,
      heading: `Level ${n} of ${LEVEL_COUNT}: ${level.title}`,
      skills: level.skills.map((skill) => skillReport(tp, skill, n)),
      ...(level.kind === 'speed' ? { wpm: level.wpm } : {}),
      passed: n < tp.open,
    });
  }
  return out;
}

/** Practice skills over all passed levels. */
export function practiceCount(tp: TypingProgress): number {
  let count = 0;
  for (const level of typingReport(tp)) {
    count += level.skills.filter((s) => s.practice).length;
  }
  return count;
}

/** [new, started, almost, learned, 0] over every skill and speed level. */
export function typingSteps(tp: TypingProgress): StepCounts {
  const learned = learnedCount(tp);
  let almost = 0;
  let started = 0;
  const open = levelOf(Math.min(Math.max(tp.open, 1), LEVEL_COUNT));
  for (const skill of open.skills) {
    const { step } = skillReport(tp, skill, open.n);
    if (step === 2) almost++;
    else if (step === 1) started++;
  }
  return [TOTAL_LEARNABLE - learned - almost - started, started, almost, learned, 0];
}

const ORDER: KeyState[] = ['new', 'started', 'almost', 'practice', 'learned'];

/** The colour state of each key that carries a skill, by key id. */
export function keyStates(tp: TypingProgress): Record<string, KeyState> {
  const open = Math.min(Math.max(tp.open, 1), LEVEL_COUNT);
  const all = new Set(KEYS.map((key) => key.id));
  const weakest = new Map<string, number>();
  const ids = new Set<string>();
  for (const level of TYPING_LEVELS) {
    for (const skill of level.skills) {
      const id = skill.length === 1 || skill === ' ' ? keyFor(skill).id : skill;
      if (!all.has(id)) continue;
      ids.add(id);
      if (level.n > open) continue;
      const r = skillReport(tp, skill, level.n);
      const state: KeyState =
        r.step === 3
          ? r.practice
            ? 'practice'
            : 'learned'
          : (['new', 'started', 'almost'] as const)[r.step];
      const rank = ORDER.indexOf(state);
      const before = weakest.get(id);
      if (before === undefined || rank < before) weakest.set(id, rank);
    }
  }
  const out: Record<string, KeyState> = {};
  for (const id of ids) {
    const rank = weakest.get(id);
    out[id] = rank === undefined ? 'locked' : ORDER[rank];
  }
  return out;
}
