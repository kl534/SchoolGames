import { describe, expect, it } from 'vitest';
import {
  RECENT_MAX,
  choiceInfo,
  currentChoice,
  isChoice,
  pickerSections,
  recentChoices,
  rememberChoice,
} from '../src/menu/choices';
import { MATH_PATH, PATHS } from '../src/shared/levels';
import { emptyProgress } from '../src/shared/progress';
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
