import { describe, expect, it } from 'vitest';
import { runs } from './helpers/full';
import {
  chooseLevelFacts,
  getPath,
  LEVELS,
  MATH_PATH,
  myLevelTopic,
  PATHS,
  pathFacts,
  pathForLevelTopic,
  pathOfTopic,
  SOCIAL_STUDIES_LEVEL_ID,
  SOCIAL_STUDIES_PATH,
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
  LEARN_SPACING_MS,
  LEVELS_VERSION,
  OLD_LEVEL_SPOTS,
  recordAnswer,
  type PlayerProgress,
} from '../src/shared/progress';
import { SOCIAL_STUDIES_LEVELS } from '../src/shared/levels-social';
import { seededRandom } from '../src/shared/random';
import { answerOptions, TOPICS, validateTopic } from '../src/shared/topics';
import { DIVISION_REGION, STATE_CAPITALS, stateCapitals } from '../src/shared/topics/capitals';
import { COUNTRIES } from '../src/shared/topics/countries';
import { stateLocations } from '../src/shared/topics/locations';
import { countryLocations } from '../src/shared/topics/world';
import { MATH_TOPICS, missingTwin } from '../src/shared/topics/math';

/** A fake clock: every answer comes 6 hours after the one before, so each right one counts. */
let clock = 0;

/** Answers a fact the way a game does: under its own topic, then updates the open levels. */
function answer(progress: PlayerProgress, fact: Parameters<typeof topicOfFact>[0], ok: boolean) {
  clock += LEARN_SPACING_MS;
  recordAnswer(progress, topicOfFact(fact).id, fact.id, ok, clock);
  progress.levelsOpen = levelsOpen(progress);
}

const learn = (progress: PlayerProgress, level: number, times = 3) => {
  for (const { fact } of LEVELS[level - 1].facts) {
    for (let i = 0; i < times; i++) answer(progress, fact, true);
  }
};

const OLD_TITLES = [
  'Sums to 10',
  'Take-away within 10',
  'Sums to 20',
  'Take-away within 20',
  '× 1, 2, 5, 10',
  '÷ 1, 2, 5, 10',
  '× 3, 4',
  '÷ 3, 4',
  '× 6, 7',
  '÷ 6, 7',
  '× 8, 9',
  '÷ 8, 9',
  'Sums to 24',
  'Take-away within 24',
  'Sums to 28',
  'Take-away within 28',
  'Sums to 32',
  'Take-away within 32',
  '× up to 16: 1, 2, 5, 10',
  '÷ up to 16: 1, 2, 5, 10',
  '× up to 16: 3, 4',
  '÷ up to 16: 3, 4',
  '× up to 16: 6, 7, 8, 9',
  '÷ up to 16: 6, 7, 8, 9',
  '× 11, 12',
  '÷ 11, 12',
  '× 13, 14',
  '÷ 13, 14',
  '× 15, 16',
  '÷ 15, 16',
];

/** The plain levels (the old 30), by title. */
const plainLevels = OLD_TITLES.map((title) => LEVELS.find((l) => l.title === title)!);
const isPlain = (level: (typeof LEVELS)[number]) => OLD_TITLES.includes(level.title);
const twinLevels = LEVELS.filter((l) => !isPlain(l));
const plainOf = (level: (typeof LEVELS)[number]) =>
  plainLevels.find((p) => level.title.startsWith(`${p.title}: `))!;

describe('LEVELS', () => {
  it('has 90 levels of the expected sizes', () => {
    expect(LEVELS).toHaveLength(90);
    const old = [
      45, 45, 55, 55, 40, 40, 20, 20, 20, 20, 20, 20, 44, 44, 52, 52, 60, 60, 24, 24, 12, 12, 24,
      24, 32, 32, 32, 32, 32, 32,
    ];
    // Each section: its plain pair, the middle twins of the pair, then the first twins of all.
    const section = (sizes: number[], pairs: number) => {
      const plainAndMiddle = Array.from({ length: pairs }, (_, p) => {
        const pair = sizes.slice(p * 2, p * 2 + 2);
        return [...pair, ...pair];
      }).flat();
      return [...plainAndMiddle, ...sizes];
    };
    expect(LEVELS.map((l) => l.facts.length)).toEqual([
      ...section(old.slice(0, 4), 2),
      ...section(old.slice(4, 12), 4),
      ...section(old.slice(12, 18), 3),
      ...section(old.slice(18, 24), 3),
      ...section(old.slice(24, 30), 3),
    ]);
  });

  it('names the levels', () => {
    const title = (n: number) => LEVELS[n - 1].title;
    expect(title(1)).toBe('Sums to 10');
    expect(title(3)).toBe('Sums to 10: 4 + ? = 9');
    expect(title(9)).toBe('Sums to 10: ? + 5 = 9');
    expect(title(13)).toBe('× 1, 2, 5, 10');
    expect(title(29)).toBe('× 1, 2, 5, 10: ? × 5 = 30');
    expect(title(37)).toBe('Sums to 24');
    expect(title(49)).toBe('Sums to 24: ? + 12 = 21');
    expect(title(55)).toBe('× up to 16: 1, 2, 5, 10');
    expect(title(67)).toBe('× up to 16: 1, 2, 5, 10: ? × 5 = 60');
    expect(title(73)).toBe('× 11, 12');
    expect(title(85)).toBe('× 11, 12: ? × 12 = 84');
    expect(title(90)).toBe('÷ 15, 16: ? ÷ 15 = 6');
  });

  it('holds every math fact exactly once', () => {
    const all = LEVELS.flatMap((l) => l.facts.map(({ topic, fact }) => `${topic.id}/${fact.id}`));
    expect(all).toHaveLength(3072);
    expect(new Set(all).size).toBe(3072);
    const expected = MATH_TOPICS.flatMap((t) => t.facts.map((f) => `${t.id}/${f.id}`));
    expect(new Set(all)).toEqual(new Set(expected));
  });

  it('keeps the 30 plain levels, with their old titles, in the same order', () => {
    expect(plainLevels.every(Boolean)).toBe(true);
    expect(LEVELS.filter(isPlain).map((l) => l.title)).toEqual(OLD_TITLES);
    expect(LEVELS.filter(isPlain)).toHaveLength(30);
  });

  it('keeps old level numbers where OLD_LEVEL_SPOTS says', () => {
    expect(OLD_LEVEL_SPOTS).toHaveLength(30);
    OLD_LEVEL_SPOTS.forEach((spot, i) => expect(LEVELS[spot - 1].title).toBe(OLD_TITLES[i]));
  });

  it('keeps tables up to 10, then times up to 16, then the tables 11 to 16 in the plain levels', () => {
    for (const { fact } of plainLevels.slice(4, 12).flatMap((l) => l.facts)) {
      const times = fact.visual!.kind === 'divide' ? Number(fact.answer) : fact.visual!.a;
      expect(times).toBeLessThanOrEqual(10);
    }
    for (const { fact } of plainLevels.slice(18, 24).flatMap((l) => l.facts)) {
      const times = fact.visual!.kind === 'divide' ? Number(fact.answer) : fact.visual!.a;
      expect(times).toBeGreaterThan(10);
    }
  });

  it('keeps what each plain level holds, in the same order', () => {
    const range = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const str = (kind: string, a: number, b: number) => `${kind},${a},${b}`;
    const times = (t: number, ns: number[]) => ns.map((n) => str('multiply', n, t));
    const divide = (t: number, ns: number[]) => ns.map((n) => str('divide', n * t, t));
    // Each group of tables gives a times level, then a divide level.
    const levelsOf = (groups: number[][], ns: number[]) =>
      groups.flatMap((g) => [g.flatMap((t) => times(t, ns)), g.flatMap((t) => divide(t, ns))]);
    const actual = (from: number, to: number) =>
      plainLevels
        .slice(from, to)
        .map((l) =>
          l.facts.map(({ fact }) => str(fact.visual!.kind, fact.visual!.a, fact.visual!.b)),
        );
    // Plain levels 5 to 12: tables up to x 10; 19 to 24: x 11 to x 16; 25 to 30: tables 11 to 16.
    expect(actual(4, 12)).toEqual(
      levelsOf(
        [
          [1, 2, 5, 10],
          [3, 4],
          [6, 7],
          [8, 9],
        ],
        range(1, 10),
      ),
    );
    expect(actual(18, 24)).toEqual(
      levelsOf(
        [
          [1, 2, 5, 10],
          [3, 4],
          [6, 7, 8, 9],
        ],
        range(11, 16),
      ),
    );
    expect(actual(24, 30)).toEqual(
      levelsOf(
        [
          [11, 12],
          [13, 14],
          [15, 16],
        ],
        range(1, 16),
      ),
    );
  });

  it('reads the table facts from the topics that hold them', () => {
    plainLevels.slice(4, 12).forEach((level, i) => {
      const prefix = i % 2 === 0 ? 'times-' : 'divide-by-';
      for (const { fact } of level.facts) {
        expect(topicOfFact(fact).id).toBe(`${prefix}${fact.visual!.b}`);
      }
    });
    plainLevels.slice(18).forEach((level, i) => {
      const id = i % 2 === 0 ? 'multiplication-11-16' : 'division-11-16';
      for (const { fact } of level.facts) expect(topicOfFact(fact).id).toBe(id);
    });
  });

  it('puts the bigger sums and take-aways after the tables up to 10 and before the 11s', () => {
    const biggest = (fact: Parameters<typeof topicOfFact>[0]) => {
      const { kind, a, b } = fact.visual!;
      return kind === 'subtract' ? Math.max(b, a - b) : Math.max(a, b);
    };
    const ranges = [
      [11, 12],
      [13, 14],
      [15, 16],
    ];
    plainLevels.slice(12, 18).forEach((level, i) => {
      const [from, to] = ranges[Math.floor(i / 2)];
      for (const { fact } of level.facts) {
        expect(['add', 'subtract']).toContain(fact.visual!.kind);
        expect(biggest(fact)).toBeGreaterThanOrEqual(from);
        expect(biggest(fact)).toBeLessThanOrEqual(to);
      }
    });
    for (const level of [...plainLevels.slice(4, 12), ...plainLevels.slice(18)]) {
      for (const { fact } of level.facts) {
        expect(['add', 'subtract']).not.toContain(fact.visual!.kind);
      }
    }
  });

  it('alternates addition and subtraction in the new levels', () => {
    plainLevels.slice(12, 18).forEach((level, i) => {
      const kind = i % 2 === 0 ? 'add' : 'subtract';
      for (const { fact } of level.facts) expect(fact.visual!.kind).toBe(kind);
    });
  });

  it("reuses the topics' own Fact objects", () => {
    for (const { topic, fact } of LEVELS.flatMap((l) => l.facts)) {
      expect(topic.facts).toContain(fact);
      expect(topicOfFact(fact)).toBe(topic);
    }
  });

  it('puts easy facts first', () => {
    for (const { fact } of plainLevels[0].facts)
      expect(Number(fact.answer)).toBeLessThanOrEqual(10);
    for (const { fact } of plainLevels[1].facts) expect(fact.visual!.a).toBeLessThanOrEqual(10);
    for (const { fact } of plainLevels[2].facts) expect(Number(fact.answer)).toBeGreaterThan(10);
    for (const { fact } of plainLevels[3].facts) expect(fact.visual!.a).toBeGreaterThan(10);
  });

  it('makes every twin level from the plain level its title starts with', () => {
    expect(twinLevels).toHaveLength(60);
    for (const level of twinLevels) {
      const plain = plainOf(level);
      expect(plain, level.title).toBeDefined();
      const shape = level.title.slice(plain.title.length + 2);
      const blank = level.facts[0].fact.visual!.blank;
      expect(['a', 'b']).toContain(blank);
      expect(level.facts.map((lf) => lf.fact.visual!.blank)).toEqual(level.facts.map(() => blank));
      expect(level.facts.map(({ fact }) => fact.prompt)).toContain(shape);
      expect(level.facts).toEqual(
        plain.facts.map(({ fact }) => missingTwin(fact, blank === 'b' ? 'middle' : 'first')),
      );
    }
    expect(twinLevels.filter((l) => l.facts[0].fact.visual!.blank === 'b')).toHaveLength(30);
  });

  it("puts a section's first-blank twins after all its middle twins and plain levels", () => {
    // Sections end at these level numbers (1-based).
    const sections = [12, 36, 54, 72, 90];
    let from = 0;
    for (const end of sections) {
      const section = LEVELS.slice(from, end);
      const firstAt = section.findIndex((l) => l.facts[0].fact.visual!.blank === 'a');
      expect(firstAt).toBeGreaterThan(0);
      for (const level of section.slice(0, firstAt)) {
        expect(level.facts[0].fact.visual!.blank).not.toBe('a');
      }
      for (const level of section.slice(firstAt)) {
        expect(level.facts[0].fact.visual!.blank).toBe('a');
      }
      from = end;
    }
  });

  it('uses an id that is kebab-case and not a topic', () => {
    expect(MY_LEVEL_ID).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(TOPICS.map((t) => t.id)).not.toContain(MY_LEVEL_ID);
  });
});

describe('levelLabel', () => {
  it('names the level', () => {
    expect(levelLabel(5)).toBe('Level 5 of 90: Sums to 20');
    expect(levelLabel(4)).toBe('Level 4 of 90: Take-away within 10: 9 − ? = 4');
    expect(levelLabel(37)).toBe('Level 37 of 90: Sums to 24');
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
    expect(levelsOpen({ ...emptyProgress(), levelsOpen: 99 })).toBe(90);
  });

  it('opens Sums to 24 for a player who finished levels 1 to 36', () => {
    const progress = emptyProgress();
    for (let level = 1; level <= 36; level++) learn(progress, level);
    expect(levelsOpen({ ...progress, levelsOpen: 36 })).toBe(37);
    expect(levelsOpen({ ...progress, levelsOpen: 5 })).toBe(37);
    expect(LEVELS[36].title).toBe('Sums to 24');
  });

  it('reads a saved level of 15 as it is (a current save is not moved)', () => {
    expect(levelsOpen({ ...emptyProgress(), levelsOpen: 15, levelsVersion: LEVELS_VERSION })).toBe(
      15,
    );
    expect(LEVELS[14].title).toBe('× 1, 2, 5, 10: 5 × ? = 30');
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
    expect(isMastered(stat)).toBe(false);
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
    expect(levelsOpen(progress)).toBe(90);
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
      expect(answered).toBeLessThan(40000);
    }
    expect(levelsOpen(progress)).toBe(90);
    expect(progress.levelsOpen).toBe(90);
  });
});

describe('Social Studies path', () => {
  const path = SOCIAL_STUDIES_PATH;
  const key = path.id;
  const regionOf = (fact: (typeof stateCapitals.facts)[number]) =>
    DIVISION_REGION[STATE_CAPITALS[stateCapitals.facts.indexOf(fact)].division];

  /** Answers a social studies fact the way a game does. */
  const answerSocial = (progress: PlayerProgress, fact: (typeof stateCapitals.facts)[number]) => {
    clock += LEARN_SPACING_MS;
    recordAnswer(progress, stateCapitals.id, fact.id, true, clock);
  };

  it('has 17 levels: 5 of capitals, 5 of finding the state, then 7 of finding the country', () => {
    expect(SOCIAL_STUDIES_LEVELS.map((l) => l.title)).toEqual([
      'The Northeast',
      'The Midwest',
      'The South',
      'The West',
      'All 50 states',
      'Find the Northeast',
      'Find the Midwest',
      'Find the South',
      'Find the West',
      'Find all 50 states',
      'Find North America',
      'Find South America',
      'Find Europe',
      'Find Africa',
      'Find Asia',
      'Find Oceania',
      'Find all the countries',
    ]);
    expect(SOCIAL_STUDIES_LEVELS.map((l) => l.facts.length)).toEqual([
      9, 12, 16, 13, 50, 9, 12, 16, 13, 50, 10, 10, 14, 10, 12, 4, 60,
    ]);
  });

  it('puts every state of Find the state in exactly one region level, then all 50 in order', () => {
    const regions = ['northeast', 'midwest', 'south', 'west'];
    const all = SOCIAL_STUDIES_LEVELS.slice(5, 9).flatMap((l) => l.facts.map((f) => f.fact));
    expect(new Set(all)).toEqual(new Set(stateLocations.facts));
    expect(new Set(all).size).toBe(50);
    SOCIAL_STUDIES_LEVELS.slice(5, 9).forEach((level, i) => {
      for (const { fact, topic } of level.facts) {
        expect(topic).toBe(stateLocations);
        const row = STATE_CAPITALS[stateLocations.facts.indexOf(fact)];
        expect(DIVISION_REGION[row.division]).toBe(regions[i]);
      }
    });
    SOCIAL_STUDIES_LEVELS[9].facts.forEach((lf, i) => {
      expect(lf.topic).toBe(stateLocations);
      expect(lf.fact).toBe(stateLocations.facts[i]);
    });
  });

  it('puts every country in exactly one continent level, then all 60 in order', () => {
    const continents = ['north-america', 'south-america', 'europe', 'africa', 'asia', 'oceania'];
    const all = SOCIAL_STUDIES_LEVELS.slice(10, 16).flatMap((l) => l.facts.map((f) => f.fact));
    expect(new Set(all)).toEqual(new Set(countryLocations.facts));
    expect(all.length).toBe(60);
    SOCIAL_STUDIES_LEVELS.slice(10, 16).forEach((level, i) => {
      for (const { fact, topic } of level.facts) {
        expect(topic).toBe(countryLocations);
        expect(COUNTRIES[countryLocations.facts.indexOf(fact)].continent).toBe(continents[i]);
      }
    });
    SOCIAL_STUDIES_LEVELS[16].facts.forEach((lf, i) => {
      expect(lf.topic).toBe(countryLocations);
      expect(lf.fact).toBe(countryLocations.facts[i]);
    });
  });

  it('puts every state in exactly one region level, in its own region', () => {
    const regions = ['northeast', 'midwest', 'south', 'west'];
    const all = SOCIAL_STUDIES_LEVELS.slice(0, 4).flatMap((l) => l.facts.map((f) => f.fact));
    expect(all.length).toBe(stateCapitals.facts.length);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(stateCapitals.facts));
    SOCIAL_STUDIES_LEVELS.slice(0, 4).forEach((level, i) => {
      for (const { fact, topic } of level.facts) {
        expect(topic).toBe(stateCapitals);
        expect(stateCapitals.facts).toContain(fact);
        expect(regionOf(fact)).toBe(regions[i]);
      }
    });
    const last = SOCIAL_STUDIES_LEVELS[4].facts;
    last.forEach((lf, i) => expect(lf.fact).toBe(stateCapitals.facts[i]));
  });

  it('has sound paths', () => {
    expect(new Set(PATHS.map((p) => p.id)).size).toBe(PATHS.length);
    const ids = PATHS.map((p) => p.levelTopicId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(TOPICS.some((t) => t.id === id)).toBe(false);
    }
    for (const topic of TOPICS) {
      expect(PATHS.filter((p) => p.topics.includes(topic)).length).toBe(1);
    }
    for (const p of PATHS) {
      for (const level of p.levels) {
        for (const lf of level.facts) expect(p.topics).toContain(lf.topic);
      }
    }
  });

  it('looks paths up', () => {
    expect(getPath('math')).toBe(MATH_PATH);
    expect(getPath('social-studies')).toBe(path);
    expect(getPath('nope')).toBeUndefined();
    expect(getPath(null)).toBeUndefined();
    expect(pathForLevelTopic(MY_LEVEL_ID)).toBe(MATH_PATH);
    expect(pathForLevelTopic(SOCIAL_STUDIES_LEVEL_ID)).toBe(path);
    expect(pathForLevelTopic('state-capitals')).toBeUndefined();
    expect(pathForLevelTopic(undefined)).toBeUndefined();
    expect(pathOfTopic('state-capitals')).toBe(path);
    expect(pathOfTopic('addition-1-10')).toBe(MATH_PATH);
    expect(pathOfTopic('nope')).toBeUndefined();
  });

  it('lists each path fact once', () => {
    const facts = pathFacts(path).map((lf) => lf.fact);
    expect(facts.length).toBe(160);
    expect(new Set(facts).size).toBe(160);
    expect(pathFacts(MATH_PATH).length).toBe(LEVELS.reduce((n, l) => n + l.facts.length, 0));
  });

  it('labels a level', () => {
    expect(levelLabel(2, path)).toBe('Level 2 of 17: The Midwest');
  });

  it('opens level 2 at 80% of the Northeast', () => {
    const northeast = SOCIAL_STUDIES_LEVELS[0].facts;
    const p = emptyProgress();
    expect(levelsOpen(p, path)).toBe(1);
    northeast.slice(0, 7).forEach((lf) => answerSocial(p, lf.fact));
    expect(levelsOpen(p, path)).toBe(1);
    answerSocial(p, northeast[7].fact);
    expect(levelsOpen(p, path)).toBe(2);
  });

  it('never goes above 17, is sticky, and is separate from math', () => {
    const p = emptyProgress();
    for (const { fact } of SOCIAL_STUDIES_LEVELS[4].facts) answerSocial(p, fact);
    expect(levelsOpen(p, path)).toBe(6);
    for (const { fact } of SOCIAL_STUDIES_LEVELS[9].facts) {
      clock += LEARN_SPACING_MS;
      recordAnswer(p, stateLocations.id, fact.id, true, clock);
    }
    expect(levelsOpen(p, path)).toBe(11);
    for (const { fact } of SOCIAL_STUDIES_LEVELS[16].facts) {
      clock += LEARN_SPACING_MS;
      recordAnswer(p, countryLocations.id, fact.id, true, clock);
    }
    expect(levelsOpen(p, path)).toBe(17);
    expect(levelsOpen(p)).toBe(1);

    const q = emptyProgress();
    q.pathLevelsOpen = { [key]: 3 };
    expect(levelsOpen(q, path)).toBe(3);
    expect(levelsOpen(q)).toBe(1);
    q.pathLevelsOpen = { [key]: 99 };
    expect(levelsOpen(q, path)).toBe(17);

    const m = emptyProgress();
    m.levelsOpen = 7;
    expect(levelsOpen(m, path)).toBe(1);
    expect(levelsOpen(m)).toBe(7);
  });

  it('gives a new player only Northeast facts', () => {
    const northeast = new Set(SOCIAL_STUDIES_LEVELS[0].facts.map((l) => l.fact));
    for (let seed = 1; seed <= runs(50, 10); seed++) {
      const facts = chooseLevelFacts(emptyProgress(), 10, seededRandom(seed), path);
      expect(facts.length).toBe(10);
      for (const f of facts) expect(northeast.has(f)).toBe(true);
    }
  });

  it('draws every state with all levels open, none far too often', () => {
    const p = emptyProgress();
    p.pathLevelsOpen = { [key]: 17 };
    const counts = new Map<unknown, number>();
    const rng = seededRandom(7);
    const draws = runs(600, 200);
    for (let i = 0; i < draws; i++) {
      for (const f of chooseLevelFacts(p, 10, rng, path)) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    expect(counts.size).toBe(160);
    const average = (draws * 10) / 160;
    for (const n of counts.values()) expect(n).toBeLessThan(average * 3);
  });

  it('makes a topic with distinct capital options', () => {
    const topic = myLevelTopic(() => 'x', path);
    expect(topic.id).toBe(SOCIAL_STUDIES_LEVEL_ID);
    expect(topic.facts.length).toBe(160);
    expect(new Set(topic.facts).size).toBe(160);
    expect(validateTopic(topic)).toEqual([]);
    for (const fact of topic.facts) {
      const options = answerOptions(topic, fact, 4, seededRandom(3));
      expect(options.length).toBe(4);
      expect(new Set(options).size).toBe(4);
      expect(options).toContain(fact.answer);
    }
  });

  it('gives four state names for a location fact', () => {
    const topic = myLevelTopic(() => 'x', path);
    const names = new Set(STATE_CAPITALS.map((row) => row.state));
    for (const fact of stateLocations.facts) {
      const options = answerOptions(topic, fact, 4, seededRandom(5));
      expect(options.length).toBe(4);
      for (const option of options) expect(names.has(option)).toBe(true);
    }
  });

  it('knows the real topic of a capital fact', () => {
    expect(topicOfFact(stateCapitals.facts[0])).toBe(stateCapitals);
  });
});
