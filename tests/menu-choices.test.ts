import { describe, expect, it } from 'vitest';
import {
  RECENT_MAX,
  choiceInfo,
  currentChoice,
  factListSections,
  isChoice,
  masteryLabel,
  masteryText,
  pickerSections,
  readyLabel,
  recentChoices,
  rememberChoice,
} from '../src/menu/choices';
import { demoStepsProgress } from '../src/menu/dev';
import { LEVELS, MATH_PATH, PATHS, levelLabel, levelsOpen } from '../src/shared/levels';
import { memoryStore } from '../src/shared/storage';
import {
  AVATARS,
  LEARN_SPACING_MS,
  countSteps,
  createProgressStore,
  emptyProgress,
  isWaiting,
  learnStep,
  type StepCounts,
} from '../src/shared/progress';
import { TOPICS } from '../src/shared/topics';
import { runs } from './helpers/full';

const stat = (learnStreak: number) => ({
  correct: 3,
  wrong: 0,
  streak: 3,
  lastSeen: 1,
  learnStreak,
});

describe('isChoice', () => {
  it('accepts path level topics and topics only', () => {
    for (const id of ['my-level', 'social-studies-level', 'times-7', 'state-capitals']) {
      expect(isChoice(id)).toBe(true);
    }
    for (const id of ['', null, undefined, 'math', 'nope']) expect(isChoice(id)).toBe(false);
  });
});

describe('currentChoice', () => {
  it('falls back to homePath, then my-level, and skips invalid recent ids', () => {
    expect(currentChoice(emptyProgress())).toBe('my-level');
    expect(currentChoice({ ...emptyProgress(), homePath: 'social-studies' })).toBe(
      'social-studies-level',
    );
    expect(currentChoice({ ...emptyProgress(), recent: ['times-7'] })).toBe('times-7');
    expect(currentChoice({ ...emptyProgress(), recent: ['gone', 'times-7'] })).toBe('times-7');
  });
});

describe('rememberChoice', () => {
  it('seeds recent with the current choice', () => {
    const p = emptyProgress();
    rememberChoice(p, 'times-7');
    expect(p.recent).toEqual(['times-7', 'my-level']);
    expect(p.homePath).toBeUndefined();
  });

  it('puts the id first, removes its duplicate, caps and drops invalid ids', () => {
    const p = { ...emptyProgress(), recent: ['gone', 'times-2', 'times-3', 'times-4'] };
    rememberChoice(p, 'times-4');
    expect(p.recent).toEqual(['times-4', 'times-2', 'times-3']);
    rememberChoice(p, 'times-5');
    rememberChoice(p, 'times-6');
    expect(p.recent).toEqual(['times-6', 'times-5', 'times-4', 'times-2']);
  });

  it('sets homePath for a path id and throws on a non-choice', () => {
    const p = emptyProgress();
    rememberChoice(p, 'social-studies-level');
    expect(p.homePath).toBe('social-studies');
    rememberChoice(p, 'times-7');
    expect(p.homePath).toBe('social-studies');
    expect(() => rememberChoice(p, 'nope')).toThrow();
  });
});

describe('recentChoices', () => {
  it('leaves out the current choice, shows at most 3, newest first', () => {
    const p = { ...emptyProgress(), recent: ['times-1', 'times-2', 'times-3', 'times-4'] };
    expect(recentChoices(p)).toEqual(['times-2', 'times-3', 'times-4']);
    expect(recentChoices(emptyProgress())).toEqual([]);
  });
});

describe('choiceInfo', () => {
  it('describes a path and a topic', () => {
    const p = emptyProgress();
    const path = choiceInfo(p, 'my-level');
    expect(path.title).toBe('My Level · Math');
    expect(path.short).toBe('Math');
    expect(path.subtitle.startsWith('Level 1 of')).toBe(true);
    expect(path.total).toBe(MATH_PATH.topics.reduce((s, t) => s + t.facts.length, 0));
    const t7 = choiceInfo(p, 'times-7');
    expect(t7.title).toBe('7 times table');
    expect(t7.total).toBe(10);
    const ids = TOPICS.find((t) => t.id === 'times-7')!.facts.map((f) => f.id);
    p.facts['times-7'] = Object.fromEntries(ids.slice(0, 3).map((id) => [id, stat(3)]));
    expect(choiceInfo(p, 'times-7').mastered).toBe(3);
    expect(choiceInfo(p, 'my-level').mastered).toBe(3);
  });
});

describe('pickerSections', () => {
  const sections = pickerSections();
  it('orders the subjects and builds the tile groups', () => {
    expect(sections.map((s) => s.subject)).toEqual([
      'Addition',
      'Subtraction',
      'Multiplication',
      'Division',
      'Social Studies',
    ]);
    expect(sections.map((s) => s.anchor)).toEqual([
      'addition',
      'subtraction',
      'multiplication',
      'division',
      'social-studies',
    ]);
    const [add, , mul, div] = sections;
    expect(add.tiles).toBeUndefined();
    expect(mul.tiles?.label).toBe('Times tables');
    expect(mul.tiles?.tiles.map((t) => t.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(mul.rows.some((t) => /^times-\d+$/.test(t.id))).toBe(false);
    expect(div.tiles?.label).toBe('Divide by');
    expect(div.tiles?.tiles.map((t) => t.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(div.rows.some((t) => /^divide-by-\d+$/.test(t.id))).toBe(false);
  });
  it('lists every topic exactly once', () => {
    const ids = sections.flatMap((s) => [
      ...(s.tiles?.tiles.map((t) => t.topic.id) ?? []),
      ...s.rows.map((t) => t.id),
    ]);
    expect([...ids].sort()).toEqual(TOPICS.map((t) => t.id).sort());
  });
});

describe('remembering random choices', () => {
  it('keeps recent unique and short, and the last choice current', () => {
    const all = [...PATHS.map((p) => p.levelTopicId), ...TOPICS.map((t) => t.id)];
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let run = 0; run < runs(200, 30); run++) {
      const p = emptyProgress();
      for (let i = 0, n = 1 + Math.floor(rnd() * 12); i < n; i++) {
        const last = all[Math.floor(rnd() * all.length)];
        rememberChoice(p, last);
        expect(new Set(p.recent).size).toBe(p.recent!.length);
        expect(p.recent!.length).toBeLessThanOrEqual(RECENT_MAX);
        expect(currentChoice(p)).toBe(last);
        expect(recentChoices(p)).not.toContain(last);
      }
    }
  });
});

describe('masteryText and masteryLabel', () => {
  it('says only the learned count when nothing else moved', () => {
    expect(masteryText([40, 0, 0, 0], 40)).toBe('0 / 40 learned');
    expect(masteryText([0, 0, 0, 12], 12)).toBe('12 / 12 learned');
    expect(masteryLabel('7 times table', [10, 0, 0, 0], 10)).toBe('7 times table, 0 of 10 learned');
  });

  it('adds almost and started when above zero', () => {
    const steps: StepCounts = [25, 8, 5, 12];
    expect(masteryText(steps, 50)).toBe('12 / 50 learned · 5 almost · 8 started');
    expect(masteryText([30, 0, 5, 5], 40)).toBe('5 / 40 learned · 5 almost');
    expect(masteryText([30, 5, 0, 5], 40)).toBe('5 / 40 learned · 5 started');
    expect(masteryLabel('7 times table', [4, 3, 2, 1], 10)).toBe(
      '7 times table, 1 of 10 learned, 2 almost, 3 started',
    );
    expect(masteryLabel('7 times table', [4, 0, 2, 4], 10)).toBe(
      '7 times table, 4 of 10 learned, 2 almost',
    );
  });
});

describe('readyLabel', () => {
  const now = new Date(2026, 10, 8, 18, 0).getTime();

  it('shows just the time on the same day', () => {
    expect(readyLabel(new Date(2026, 10, 8, 21, 40).getTime(), now)).toBe('🕒 9:40 pm');
    expect(readyLabel(new Date(2026, 10, 8, 18, 5).getTime(), now)).toBe('🕒 6:05 pm');
  });

  it('adds tomorrow on a later local day', () => {
    expect(readyLabel(new Date(2026, 10, 9, 1, 15).getTime(), now)).toBe('🕒 tomorrow 1:15 am');
  });
});

describe('choiceInfo steps', () => {
  const NOW = new Date(2026, 10, 8, 12, 0).getTime();

  it('counts a topic by step', () => {
    const info = choiceInfo(demoStepsProgress(NOW), 'times-7');
    expect(info.steps).toEqual([2, 3, 2, 3]);
    expect(info.mastered).toBe(info.steps[3]);
    expect(info.steps.reduce((a, b) => a + b, 0)).toBe(info.total);
  });

  it('sums the steps of every topic of a path', () => {
    const progress = demoStepsProgress(NOW);
    const info = choiceInfo(progress, 'my-level');
    const sum = MATH_PATH.topics.reduce<StepCounts>(
      (acc, t) => {
        const c = countSteps(
          progress,
          t.id,
          t.facts.map((f) => f.id),
        );
        return [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2], acc[3] + c[3]];
      },
      [0, 0, 0, 0],
    );
    expect(info.steps).toEqual(sum);
    expect(info.mastered).toBe(sum[3]);
    expect(info.steps.reduce((a, b) => a + b, 0)).toBe(info.total);
  });
});

describe('factListSections', () => {
  const NOW = new Date(2026, 10, 8, 12, 0).getTime();

  it('groups a topic by step: Learned, Almost, Started, New, in topic order', () => {
    const sections = factListSections(demoStepsProgress(NOW), 'times-7', NOW);
    expect(sections.map((s) => s.heading)).toEqual(['Learned', 'Almost', 'Started', 'New']);
    expect(sections.map((s) => s.step)).toEqual([3, 2, 1, 0]);
    const ids = (i: number) => sections[i].items.map((x) => x.fact.id);
    expect(ids(0)).toEqual(['1x7', '2x7', '3x7']);
    expect(ids(1)).toEqual(['4x7', '8x7']);
    expect(ids(2)).toEqual(['6x7', '7x7', '9x7']);
    expect(ids(3)).toEqual(['5x7', '10x7']);
  });

  it('leaves empty groups out', () => {
    const progress = emptyProgress();
    expect(factListSections(progress, 'times-7', NOW).map((s) => s.heading)).toEqual(['New']);
  });

  it('gives readyAt only while a fact is waiting', () => {
    const progress = demoStepsProgress(NOW);
    const items = factListSections(progress, 'times-7', NOW).flatMap((s) => s.items);
    const at = (id: string) => items.find((i) => i.fact.id === id)!.readyAt;
    expect(at('4x7')).toBe(NOW - 2 * 3_600_000 + LEARN_SPACING_MS);
    expect(at('6x7')).not.toBeNull();
    expect(at('7x7')).not.toBeNull();
    expect(at('8x7')).toBeNull();
    expect(at('9x7')).toBeNull();
    expect(at('1x7')).toBeNull();
    expect(at('5x7')).toBeNull();
    // Later, the same facts are ready.
    const later = factListSections(progress, 'times-7', NOW + LEARN_SPACING_MS)
      .flatMap((s) => s.items)
      .filter((i) => i.readyAt !== null);
    expect(later).toEqual([]);
  });

  it('lists My Level newest level first, open levels only, no fact twice', () => {
    const progress = demoStepsProgress(NOW);
    const sections = factListSections(progress, 'my-level', NOW);
    expect(sections.map((s) => s.heading)).toEqual([
      levelLabel(3, MATH_PATH),
      levelLabel(2, MATH_PATH),
      levelLabel(1, MATH_PATH),
    ]);
    expect(sections.every((s) => s.step === undefined)).toBe(true);
    const facts = sections.flatMap((s) => s.items.map((i) => i.fact));
    expect(new Set(facts).size).toBe(facts.length);
    const open = new Set(LEVELS.slice(0, 3).flatMap((l) => l.facts.map((lf) => lf.fact)));
    expect(facts.every((f) => open.has(f))).toBe(true);
    // Each fact is under the earliest level that has it.
    const level1 = new Set(LEVELS[0].facts.map((lf) => lf.fact));
    expect(sections[2].items.every((i) => level1.has(i.fact))).toBe(true);
  });

  it('lists a level only up to the levels that are open', () => {
    expect(factListSections(emptyProgress(), 'my-level', NOW)).toHaveLength(1);
  });
});

describe('demoStepsProgress', () => {
  const NOW = new Date(2026, 10, 8, 12, 0).getTime();
  const progress = demoStepsProgress(NOW);

  it('has a times-7 fact at every step, some of them waiting', () => {
    const stats = progress.facts['times-7'];
    const steps = new Set(
      TOPICS.find((t) => t.id === 'times-7')!.facts.map((f) => learnStep(stats[f.id])),
    );
    expect(steps).toEqual(new Set([0, 1, 2, 3]));
    expect(isWaiting(stats['4x7'], NOW)).toBe(true);
    expect(isWaiting(stats['6x7'], NOW)).toBe(true);
    expect(isWaiting(stats['7x7'], NOW)).toBe(true);
    expect(isWaiting(stats['8x7'], NOW)).toBe(false);
    expect(isWaiting(stats['9x7'], NOW)).toBe(false);
    expect(progress.recent).toEqual(['times-7']);
  });

  it('opens three My Level levels with facts at every step', () => {
    expect(progress.levelsOpen).toBe(3);
    expect(levelsOpen(progress)).toBe(3);
    // A saved copy loads back with the same open levels (no old-save migration).
    const store = createProgressStore(memoryStore());
    const player = store.addPlayer('Demo', AVATARS[0]);
    store.save(player.id, progress);
    expect(levelsOpen(store.load(player.id))).toBe(3);
    const all = LEVELS.slice(0, 3).flatMap((l) => l.facts);
    const steps = new Set(
      all.map(({ topic, fact }) => learnStep(progress.facts[topic.id]?.[fact.id])),
    );
    expect(steps).toEqual(new Set([0, 1, 2, 3]));
    const waiting = all.filter(({ topic, fact }) =>
      isWaiting(progress.facts[topic.id]?.[fact.id], NOW),
    );
    expect(waiting.length).toBeGreaterThan(0);
  });
});
