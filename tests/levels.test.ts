import { describe, expect, it } from 'vitest';
import {
  chooseLevelFacts,
  LEVELS,
  levelLabel,
  levelPassed,
  levelsOpen,
  MY_LEVEL_ID,
  needsWork,
  REVIEW_SHARE,
  topicOfFact,
} from '../src/shared/levels';
import {
  emptyProgress,
  isMastered,
  recordAnswer,
  type PlayerProgress,
} from '../src/shared/progress';
import { seededRandom } from '../src/shared/random';
import { TOPICS } from '../src/shared/topics';
import { MATH_TOPICS } from '../src/shared/topics/math';

/** Answers a fact the way a game does: under its own topic, then updates the open levels. */
function answer(progress: PlayerProgress, fact: Parameters<typeof topicOfFact>[0], ok: boolean) {
  recordAnswer(progress, topicOfFact(fact).id, fact.id, ok);
  progress.levelsOpen = levelsOpen(progress);
}

const learn = (progress: PlayerProgress, level: number, times = 3) => {
  for (const { fact } of LEVELS[level - 1].facts) {
    for (let i = 0; i < times; i++) answer(progress, fact, true);
  }
};

describe('LEVELS', () => {
  it('has 12 levels of the expected sizes', () => {
    expect(LEVELS.map((l) => l.facts.length)).toEqual([
      45, 45, 55, 55, 40, 40, 20, 20, 20, 20, 20, 20,
    ]);
    expect(LEVELS[0].title).toBe('Sums to 10');
    expect(LEVELS[11].title).toBe('÷ 8, 9');
  });

  it('holds every math fact exactly once', () => {
    const all = LEVELS.flatMap((l) => l.facts.map(({ topic, fact }) => `${topic.id}/${fact.id}`));
    expect(all).toHaveLength(400);
    expect(new Set(all).size).toBe(400);
    const expected = MATH_TOPICS.flatMap((t) => t.facts.map((f) => `${t.id}/${f.id}`));
    expect(new Set(all)).toEqual(new Set(expected));
  });

  it("reuses the topics' own Fact objects", () => {
    for (const { topic, fact } of LEVELS.flatMap((l) => l.facts)) {
      expect(topic.facts).toContain(fact);
      expect(topicOfFact(fact)).toBe(topic);
    }
  });

  it('puts easy facts first', () => {
    for (const { fact } of LEVELS[0].facts) expect(Number(fact.answer)).toBeLessThanOrEqual(10);
    for (const { fact } of LEVELS[1].facts) expect(fact.visual!.a).toBeLessThanOrEqual(10);
    for (const { fact } of LEVELS[2].facts) expect(Number(fact.answer)).toBeGreaterThan(10);
    for (const { fact } of LEVELS[3].facts) expect(fact.visual!.a).toBeGreaterThan(10);
  });

  it('uses an id that is kebab-case and not a topic', () => {
    expect(MY_LEVEL_ID).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(TOPICS.map((t) => t.id)).not.toContain(MY_LEVEL_ID);
  });
});

describe('levelLabel', () => {
  it('names the level', () => {
    expect(levelLabel(3)).toBe('Level 3 of 12: Sums to 20');
  });
});

describe('levelsOpen', () => {
  it('starts at 1', () => {
    expect(levelsOpen(emptyProgress())).toBe(1);
  });

  it('opens the next level once 80% of the newest one was answered right', () => {
    const progress = emptyProgress();
    const facts = LEVELS[0].facts;
    const need = Math.ceil(facts.length * 0.8);
    for (const { fact } of facts.slice(0, need - 1)) answer(progress, fact, true);
    expect(levelPassed(LEVELS[0], progress.facts)).toBe(false);
    expect(levelsOpen(progress)).toBe(1);
    answer(progress, facts[need - 1].fact, true);
    expect(levelsOpen(progress)).toBe(2);
    expect(progress.levelsOpen).toBe(2);
  });

  it('counts the last answer: a miss after a hit does not count as right', () => {
    const progress = emptyProgress();
    for (const { fact } of LEVELS[0].facts) answer(progress, fact, true);
    expect(levelsOpen(progress)).toBe(2);
    const fresh = emptyProgress();
    for (const { fact } of LEVELS[0].facts) {
      answer(fresh, fact, true);
      answer(fresh, fact, false);
    }
    expect(levelsOpen(fresh)).toBe(1);
  });

  it('can open several levels at once and stops at the first one not passed', () => {
    const progress = emptyProgress();
    learn(progress, 1, 1);
    learn(progress, 2, 1);
    expect(levelsOpen(progress)).toBe(3);
  });

  it('never closes a level, whatever is missed afterwards', () => {
    const progress = emptyProgress();
    learn(progress, 1, 1);
    expect(progress.levelsOpen).toBe(2);
    for (const { fact } of LEVELS[0].facts) answer(progress, fact, false);
    expect(levelPassed(LEVELS[0], progress.facts)).toBe(false);
    expect(levelsOpen(progress)).toBe(2);
  });

  it('stays within 1 and the number of levels', () => {
    expect(levelsOpen({ ...emptyProgress(), levelsOpen: 0 })).toBe(1);
    expect(levelsOpen({ ...emptyProgress(), levelsOpen: 99 })).toBe(12);
  });
});

describe('needsWork', () => {
  it('is true for new, unlearned and missed-again facts', () => {
    const progress = emptyProgress();
    const [{ fact }] = LEVELS[0].facts;
    expect(needsWork(undefined)).toBe(true);
    for (let i = 0; i < 3; i++) answer(progress, fact, true);
    const stat = progress.facts[topicOfFact(fact).id][fact.id];
    expect(isMastered(stat)).toBe(true);
    expect(needsWork(stat)).toBe(false);
    answer(progress, fact, false);
    expect(isMastered(stat)).toBe(true);
    expect(needsWork(stat)).toBe(true);
  });
});

describe('chooseLevelFacts', () => {
  it('only uses level 1 for a new player', () => {
    const level1 = new Set(LEVELS[0].facts.map((lf) => lf.fact));
    const random = seededRandom(5);
    for (let i = 0; i < 20; i++) {
      const facts = chooseLevelFacts(emptyProgress(), 10, random);
      expect(facts).toHaveLength(10);
      for (const fact of facts) expect(level1.has(fact)).toBe(true);
    }
  });

  it('draws from every open level', () => {
    const progress = emptyProgress();
    learn(progress, 1, 1);
    const seen = new Set<string>();
    const random = seededRandom(9);
    for (let i = 0; i < 60; i++) {
      for (const fact of chooseLevelFacts(progress, 10, random)) {
        seen.add(LEVELS.findIndex((l) => l.facts.some((lf) => lf.fact === fact)) + 1 + '');
      }
    }
    expect(seen).toEqual(new Set(['1', '2']));
  });

  it('brings learned facts back about one time in ten', () => {
    const progress = emptyProgress();
    // Level 1 learned (3 correct each), level 2 open and untouched.
    learn(progress, 1);
    const learned = new Set(LEVELS[0].facts.map((lf) => lf.fact));
    const random = seededRandom(3);
    let reviews = 0;
    let total = 0;
    for (let i = 0; i < 400; i++) {
      for (const fact of chooseLevelFacts(progress, 10, random)) {
        total++;
        if (learned.has(fact)) reviews++;
      }
    }
    expect(reviews / total).toBeGreaterThan(REVIEW_SHARE * 0.7);
    expect(reviews / total).toBeLessThan(REVIEW_SHARE * 1.4);
  });

  it('returns a missed learned fact to the practice pool', () => {
    const progress = emptyProgress();
    for (let level = 1; level <= LEVELS.length; level++) learn(progress, level);
    const missed = LEVELS[3].facts[0].fact;
    answer(progress, missed, false);
    // It is the only fact needing work, so it fills the work slots (about 90% of them).
    const random = seededRandom(11);
    let picks = 0;
    for (let i = 0; i < 100; i++) {
      picks += chooseLevelFacts(progress, 10, random).filter((f) => f === missed).length;
    }
    expect(picks).toBeGreaterThan(700);
    expect(picks).toBeLessThan(1000);
  });

  it('still returns the full count when everything is learned', () => {
    const progress = emptyProgress();
    for (let level = 1; level <= LEVELS.length; level++) learn(progress, level);
    expect(levelsOpen(progress)).toBe(12);
    expect(chooseLevelFacts(progress, 10, seededRandom(2))).toHaveLength(10);
    expect(chooseLevelFacts(progress, 25, seededRandom(2))).toHaveLength(25);
  });

  it('is fully learnable in one long run without a miss', () => {
    const progress = emptyProgress();
    const random = seededRandom(42);
    const learned = () =>
      MATH_TOPICS.flatMap((t) => t.facts.map((f) => progress.facts[t.id]?.[f.id]));
    let answered = 0;
    while (!learned().every((stat) => isMastered(stat))) {
      for (const fact of chooseLevelFacts(progress, 10, random)) {
        answer(progress, fact, true);
        answered++;
      }
      expect(answered).toBeLessThan(5000);
    }
    expect(levelsOpen(progress)).toBe(12);
    expect(progress.levelsOpen).toBe(12);
  });
});
