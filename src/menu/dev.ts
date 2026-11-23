/** Dev-only demo progress for the menu (`?demo=steps`). Pure: no DOM. */
import { LEVELS } from '../shared/levels';
import { TYPING_LEVELS } from '../shared/typing/course';
import { TYPING_LEVEL_ID, type TypingProgress, emptyTyping } from '../shared/typing/progress';
import {
  LEVELS_VERSION,
  SOCIAL_LEVELS_VERSION,
  VOCAB_LEVELS_VERSION,
  SOLID_REVIEWS,
  emptyProgress,
  type FactStat,
  type LearnStep,
  type PlayerProgress,
} from '../shared/progress';

const HOUR = 60 * 60 * 1000;

/** A stat at a step; `ago` is how long before `now` the last counted answer was. */
function stepStat(step: LearnStep, now: number, ago: number): FactStat {
  const stat: FactStat = {
    correct: step + 1,
    wrong: 0,
    streak: step + 1,
    lastSeen: now - ago,
    learnStreak: Math.min(step, 3),
    learnedAt: now - ago,
  };
  if (step >= 3) stat.reviews = step === 4 ? SOLID_REVIEWS : 0;
  return stat;
}

/** Times-7 facts: [fact id, step, hours since the last counted answer]; null hours: no stats. */
const TIMES_7: [string, LearnStep, number | null][] = [
  ['1x7', 4, 30],
  ['2x7', 4, 30],
  ['3x7', 3, 7],
  ['4x7', 3, 1],
  ['6x7', 3, 7],
  ['8x7', 2, 2],
  ['7x7', 1, 1],
  ['9x7', 1, 7],
  ['5x7', 0, null],
  ['10x7', 0, null],
];

/** My Level demo facts take these steps in turn (two New in six, so no next level opens). */
const DEMO_STEPS: LearnStep[] = [0, 1, 2, 3, 4, 0];

/**
 * Progress for the demo: the player is practicing the 7 times table with a fact at every step (three
 * Learned, two of them due for review), and My Level · Math has three levels open whose facts are
 * at steps 0 to 4 in turn (`DEMO_STEPS`), the Learned ones alternating due (7 hours ago) and not yet due (1 hour).
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
  progress.vocabLevelsVersion = VOCAB_LEVELS_VERSION;
  progress.levelsOpen = 3;
  const seen = new Set<unknown>();
  let i = 0;
  for (const level of LEVELS.slice(0, 3)) {
    for (const { topic, fact } of level.facts) {
      if (seen.has(fact)) continue;
      seen.add(fact);
      const step = DEMO_STEPS[i % DEMO_STEPS.length];
      if (step > 0) {
        const due = Math.floor(i / DEMO_STEPS.length) % 2 === 0;
        const ago = step === 3 ? (due ? 7 * HOUR : HOUR) : 30 * HOUR;
        (progress.facts[topic.id] ??= {})[fact.id] = stepStat(step, now, ago);
      }
      i++;
    }
  }
  return progress;
}

/**
 * Demo typing progress (`?demo=typing`, `?demo=typing-speed`). 'keys': level 8 open, two passed
 * keys slipped (d, ;), g and h tested out, t almost and y started. 'speed': level 31 open, every
 * key learned except Left Shift, which slipped.
 */
export function demoTypingProgress(kind: 'keys' | 'speed'): PlayerProgress {
  const progress = emptyProgress();
  progress.recent = [TYPING_LEVEL_ID];
  const open = kind === 'keys' ? 8 : 31;
  const typing: TypingProgress = {
    ...emptyTyping(),
    open,
    level: open,
    spk: kind === 'keys' ? 1.2 : 0.9,
    bestWpm: kind === 'keys' ? 14.6 : 23.4,
    lessons: Array.from({ length: open }, (_, i) => i + 1),
  };
  const good = '1'.repeat(20);
  if (kind === 'keys') {
    for (const level of TYPING_LEVELS.filter((l) => l.n < 8)) {
      for (const skill of level.skills) typing.keys[skill] = good;
    }
    delete typing.keys.g;
    delete typing.keys.h;
    typing.keys.d = '1'.repeat(17) + '000';
    typing.keys[';'] = '00101' + '1'.repeat(15);
    typing.keys.t = '1'.repeat(13);
    typing.keys.y = '1010';
  } else {
    for (const level of TYPING_LEVELS) {
      for (const skill of level.skills) typing.keys[skill] = good;
    }
    typing.keys['shift-left'] = '1'.repeat(15) + '00000';
  }
  progress.typing = typing;
  return progress;
}
