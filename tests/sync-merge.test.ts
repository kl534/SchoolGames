import { describe, expect, it } from 'vitest';
import {
  emptyProgress,
  normalizeProgress,
  type FactStat,
  type PlayerProgress,
} from '../src/shared/progress';
import { mergeProgress } from '../src/shared/sync/merge';
import { runs } from './helpers/full';

const stat = (correct: number, wrong: number, lastSeen: number): FactStat => ({
  correct,
  wrong,
  streak: correct,
  lastSeen,
});
const prog = (extra: Partial<PlayerProgress> = {}): PlayerProgress => ({
  ...emptyProgress(),
  ...extra,
});

describe('mergeProgress', () => {
  it('keeps the stat with the larger lastSeen whole', () => {
    const a = prog({ facts: { t: { f: stat(5, 1, 100) } } });
    const b = prog({ facts: { t: { f: stat(2, 0, 200) } } });
    expect(mergeProgress(a, b).facts.t.f).toEqual(stat(2, 0, 200));
    expect(mergeProgress(b, a).facts.t.f).toEqual(stat(2, 0, 200));
  });

  it('breaks a lastSeen tie by the larger total, then by a', () => {
    const a = prog({ facts: { t: { f: stat(1, 0, 100) } } });
    const b = prog({ facts: { t: { f: stat(3, 1, 100) } } });
    expect(mergeProgress(a, b).facts.t.f.correct).toBe(3);
    expect(mergeProgress(b, a).facts.t.f.correct).toBe(3);
    const c = prog({ facts: { t: { f: stat(2, 0, 100) } } });
    const d = prog({ facts: { t: { f: stat(0, 2, 100) } } });
    expect(mergeProgress(c, d).facts.t.f.correct).toBe(2);
    expect(mergeProgress(d, c).facts.t.f.correct).toBe(0);
  });

  it('keeps a fact that is on one side only', () => {
    const a = prog({ facts: { t: { f: stat(1, 0, 1) } } });
    const b = prog({ facts: { u: { g: stat(1, 0, 1) } } });
    const m = mergeProgress(a, b);
    expect(Object.keys(m.facts).sort()).toEqual(['t', 'u']);
  });

  it('takes the larger best, high score, levels and path levels', () => {
    const a = prog({
      best: { t: { g: 3, h: 1 } },
      highScores: { t: { g: 10 } },
      levelsOpen: 5,
      levelsVersion: 2,
      pathLevelsOpen: { social: 4 },
    });
    const b = prog({
      best: { t: { g: 2 }, u: { g: 1 } },
      highScores: { t: { g: 40 } },
      levelsOpen: 3,
      pathLevelsOpen: { social: 9, other: 1 },
    });
    const m = mergeProgress(a, b);
    expect(m.best).toEqual({ t: { g: 3, h: 1 }, u: { g: 1 } });
    expect(m.highScores).toEqual({ t: { g: 40 } });
    expect(m.levelsOpen).toBe(5);
    expect(m.levelsVersion).toBe(2);
    expect(m.pathLevelsOpen).toEqual({ social: 9, other: 1 });
  });

  it('takes ladders, homePath and recent from the side saved last', () => {
    const a = prog({ ladders: { t: { g: 5 } }, homePath: 'math', recent: ['a'], savedAt: 10 });
    const b = prog({
      ladders: { t: { g: 2 } },
      homePath: 'social',
      recent: ['b', 'a'],
      savedAt: 20,
    });
    const m = mergeProgress(a, b);
    expect(m.recent).toEqual(['b', 'a']);
    expect(mergeProgress(b, a).recent).toEqual(['b', 'a']);
    expect(m.ladders).toEqual({ t: { g: 2 } });
    expect(m.homePath).toBe('social');
    expect(m.savedAt).toBe(20);
    expect(mergeProgress(b, a).ladders).toEqual({ t: { g: 2 } });
  });

  it('falls back to the other side when the newer one lacks the field', () => {
    const a = prog({ ladders: { t: { g: 5 } }, homePath: 'math', recent: ['x'], savedAt: 10 });
    const b = prog({ savedAt: 20 });
    const m = mergeProgress(a, b);
    expect(m.recent).toEqual(['x']);
    expect(m.ladders).toEqual({ t: { g: 5 } });
    expect(m.homePath).toBe('math');
  });

  it('on a savedAt tie takes a', () => {
    const a = prog({ homePath: 'math' });
    const b = prog({ homePath: 'social' });
    expect(mergeProgress(a, b).homePath).toBe('math');
  });

  it('does not change its inputs and shares nothing with them', () => {
    const a = prog({ facts: { t: { f: stat(1, 0, 1) } }, ladders: { t: { g: 1 } }, savedAt: 3 });
    const b = prog({ facts: { t: { f: stat(2, 0, 2) } }, best: { t: { g: 1 } } });
    const snapA = structuredClone(a);
    const snapB = structuredClone(b);
    const m = mergeProgress(a, b);
    m.facts.t.f.correct = 99;
    m.ladders!.t.g = 99;
    expect(a).toEqual(snapA);
    expect(b).toEqual(snapB);
  });
});

describe('mergeProgress properties', () => {
  let seed = 1;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const int = (n: number) => Math.floor(rnd() * n);
  const pick = <T>(xs: T[]) => xs[int(xs.length)];
  const randomProgress = (): PlayerProgress => {
    const p = emptyProgress();
    for (const t of ['t1', 't2', 't3']) {
      if (rnd() < 0.3) continue;
      p.facts[t] = {};
      for (const f of ['a', 'b', 'c', 'd']) {
        if (rnd() < 0.4) continue;
        p.facts[t][f] = stat(int(9), int(4), 1 + int(1_000_000));
      }
      if (rnd() < 0.5) (p.best[t] ??= {})[pick(['g1', 'g2'])] = int(4);
      if (rnd() < 0.5) (p.highScores[t] ??= {})[pick(['g1', 'g2'])] = int(500);
    }
    if (rnd() < 0.6) p.levelsOpen = 1 + int(30);
    if (rnd() < 0.5) p.levelsVersion = 1 + int(2);
    if (rnd() < 0.5) p.pathLevelsOpen = { social: 1 + int(9) };
    if (rnd() < 0.5) p.ladders = { t1: { g1: int(10) } };
    if (rnd() < 0.5) p.homePath = pick(['math', 'social']);
    if (rnd() < 0.7) p.savedAt = 1 + int(1_000_000);
    return normalizeProgress(p);
  };

  const iterations = runs(2000, 200);

  it('is idempotent', () => {
    for (let i = 0; i < iterations; i++) {
      const x = randomProgress();
      expect(mergeProgress(x, x)).toEqual(x);
    }
  });

  it('is commutative apart from exact fact ties', () => {
    for (let i = 0; i < iterations; i++) {
      const a = randomProgress();
      const b = randomProgress();
      // Distinct savedAt so the fields settled by it have a clear winner.
      a.savedAt = 2 * i + 1;
      b.savedAt = 2 * i + 2;
      const ab = mergeProgress(a, b);
      const ba = mergeProgress(b, a);
      expect(Object.keys(ab.facts).sort()).toEqual(Object.keys(ba.facts).sort());
      expect({ ...ab, facts: {} }).toEqual({ ...ba, facts: {} });
      for (const t of Object.keys(ab.facts)) {
        for (const f of Object.keys(ab.facts[t])) {
          const l = a.facts[t]?.[f];
          const r = b.facts[t]?.[f];
          if (l && r && l.lastSeen === r.lastSeen && l.correct + l.wrong === r.correct + r.wrong) {
            continue;
          }
          expect(ab.facts[t][f]).toEqual(ba.facts[t][f]);
        }
      }
    }
  });

  it('never lowers best, high scores or open levels, and loses no fact', () => {
    for (let i = 0; i < iterations; i++) {
      const a = randomProgress();
      const b = randomProgress();
      const m = mergeProgress(a, b);
      for (const side of [a, b]) {
        for (const key of ['best', 'highScores'] as const) {
          for (const [t, games] of Object.entries(side[key])) {
            for (const [g, v] of Object.entries(games)) {
              expect(m[key][t][g]).toBeGreaterThanOrEqual(v);
            }
          }
        }
        expect(m.levelsOpen ?? 0).toBeGreaterThanOrEqual(side.levelsOpen ?? 0);
        for (const [t, facts] of Object.entries(side.facts)) {
          for (const f of Object.keys(facts)) expect(m.facts[t][f]).toBeDefined();
        }
      }
    }
  });
});
