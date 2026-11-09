/** Dev-only demo progress for the menu (`?demo=steps`). Pure: no DOM. */
import { LEVELS } from '../shared/levels';
import {
  LEARN_SPACING_MS,
  LEVELS_VERSION,
  SOCIAL_LEVELS_VERSION,
  emptyProgress,
  type FactStat,
  type LearnStep,
  type PlayerProgress,
} from '../shared/progress';

const HOUR = 60 * 60 * 1000;

/** A stat at a step; `ago` is how long before `now` the last counted answer was. */
function stepStat(step: LearnStep, now: number, ago: number): FactStat {
  return {
    correct: step + 1,
    wrong: 0,
    streak: step + 1,
    lastSeen: now - ago,
    learnStreak: step,
    learnedAt: now - ago,
  };
}

/** Times-7 facts: [fact id, step, hours since the last counted answer]; null hours: no stats. */
const TIMES_7: [string, LearnStep, number | null][] = [
  ['1x7', 3, 30],
  ['2x7', 3, 30],
  ['3x7', 3, 30],
  ['4x7', 2, 2],
  ['8x7', 2, 8],
  ['6x7', 1, 1],
  ['7x7', 1, 1],
  ['9x7', 1, 7],
  ['5x7', 0, null],
  ['10x7', 0, null],
];

/**
 * Progress for the demo: the player is practicing the 7 times table with a fact at every step (one
 * Almost and two Started still inside their wait), and My Level · Math has three levels open whose
 * facts are at steps 0 to 3 in turn, every other one waiting.
 */
export function demoStepsProgress(now: number): PlayerProgress {
  const progress = emptyProgress();
  progress.recent = ['times-7'];
  progress.facts['times-7'] = {};
  for (const [id, step, hours] of TIMES_7) {
    if (hours !== null) progress.facts['times-7'][id] = stepStat(step, now, hours * HOUR);
  }

  // Current version numbers, so the load does not move the saved level to a new spot.
  progress.levelsVersion = LEVELS_VERSION;
  progress.socialLevelsVersion = SOCIAL_LEVELS_VERSION;
  progress.levelsOpen = 3;
  const seen = new Set<unknown>();
  let i = 0;
  for (const level of LEVELS.slice(0, 3)) {
    for (const { topic, fact } of level.facts) {
      if (seen.has(fact)) continue;
      seen.add(fact);
      const step = (i % 4) as LearnStep;
      // Of the facts at each step, every other one is waiting (just answered); the rest are ready.
      const waiting = Math.floor(i / 4) % 2 === 0;
      if (step > 0) {
        const ago = step === 3 ? 20 * HOUR : waiting ? HOUR : LEARN_SPACING_MS + 2 * HOUR;
        (progress.facts[topic.id] ??= {})[fact.id] = stepStat(step, now, ago);
      }
      i++;
    }
  }
  return progress;
}
