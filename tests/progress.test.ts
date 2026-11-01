import { describe, expect, it } from 'vitest';
import {
  AVATARS,
  countMastered,
  createProgressStore,
  emptyProgress,
  factWeight,
  isMastered,
  LEARN_SPACING_MS,
  LEVELS_VERSION,
  migrateAboveTenTables,
  migrateMissingNumberLevels,
  migrateRenamedGames,
  OLD_LEVEL_SPOTS,
  recordAnswer,
  recordBest,
  recordLadder,
  recordHighScore,
  timerSecondsFor,
  type FactStat,
  type PlayerProgress,
} from '../src/shared/progress';
import { LEVELS, levelPassed, levelsOpen, topicOfFact, type LevelFact } from '../src/shared/levels';
import { memoryStore } from '../src/shared/storage';

describe('recordAnswer', () => {
  const HOUR = 60 * 60 * 1000;

  it('tracks correct, wrong and streak', () => {
    const p = emptyProgress();
    recordAnswer(p, 't', 'f', true, 1);
    recordAnswer(p, 't', 'f', true, 2);
    expect(p.facts.t.f).toEqual({
      correct: 2,
      wrong: 0,
      streak: 2,
      lastSeen: 2,
      learnStreak: 1,
      learnedAt: 1,
    });
    recordAnswer(p, 't', 'f', false, 3);
    expect(p.facts.t.f).toEqual({ correct: 2, wrong: 1, streak: 0, lastSeen: 3, learnStreak: 0 });
  });

  it('ignores a right retry, but counts a wrong one', () => {
    const p = emptyProgress();
    recordAnswer(p, 't', 'f', false, 1);
    recordAnswer(p, 't', 'f', true, 2, true);
    expect(p.facts.t.f).toEqual({ correct: 0, wrong: 1, streak: 0, lastSeen: 2, learnStreak: 0 });
    recordAnswer(p, 't', 'f', false, 3, true);
    expect(p.facts.t.f).toMatchObject({ correct: 0, wrong: 2, streak: 0, lastSeen: 3 });
  });

  it('learns a fact after 3 right answers in a row, each 6 hours apart', () => {
    const p = emptyProgress();
    recordAnswer(p, 't', 'f', true, 0);
    recordAnswer(p, 't', 'f', true, 5 * HOUR);
    recordAnswer(p, 't', 'f', true, 6 * HOUR);
    expect(p.facts.t.f.learnStreak).toBe(2);
    // Counted from the last right answer that added to the streak, not the last one seen.
    recordAnswer(p, 't', 'f', true, 11 * HOUR);
    expect(isMastered(p.facts.t.f)).toBe(false);
    recordAnswer(p, 't', 'f', true, 12 * HOUR);
    expect(isMastered(p.facts.t.f)).toBe(true);
  });

  it('starts the learning streak over after a miss', () => {
    const p = emptyProgress();
    for (let i = 0; i < 3; i++) recordAnswer(p, 't', 'f', true, i * LEARN_SPACING_MS);
    expect(isMastered(p.facts.t.f)).toBe(true);
    recordAnswer(p, 't', 'f', false, 3 * LEARN_SPACING_MS);
    expect(isMastered(p.facts.t.f)).toBe(false);
    // The first right answer after the miss counts at once, without waiting 6 hours.
    recordAnswer(p, 't', 'f', true, 3 * LEARN_SPACING_MS + 1);
    expect(p.facts.t.f.learnStreak).toBe(1);
  });

  it('never counts as learned from progress saved before the learning streak', () => {
    expect(isMastered({ correct: 9, wrong: 0, streak: 9, lastSeen: 1 })).toBe(false);
  });
});

describe('factWeight', () => {
  it('favours unseen and missed facts over mastered ones', () => {
    const missed = { correct: 1, wrong: 3, streak: 0, lastSeen: 0 };
    const mastered = { correct: 5, wrong: 0, streak: 5, lastSeen: 0 };
    expect(factWeight(missed)).toBeGreaterThan(factWeight(undefined));
    expect(factWeight(undefined)).toBeGreaterThan(factWeight(mastered));
    expect(factWeight(mastered)).toBeGreaterThan(0);
  });
});

describe('timerSecondsFor', () => {
  const withStreak = (streak: number) => ({ correct: streak, wrong: 0, streak, lastSeen: 0 });

  it('gives 15, 10 then 5 seconds as the streak grows', () => {
    expect(timerSecondsFor(undefined)).toBe(15);
    expect(timerSecondsFor(withStreak(0))).toBe(15);
    expect(timerSecondsFor(withStreak(1))).toBe(10);
    expect(timerSecondsFor(withStreak(2))).toBe(5);
    expect(timerSecondsFor(withStreak(5))).toBe(5);
  });

  it('goes back to 15 seconds after a miss', () => {
    const p = emptyProgress();
    for (let i = 0; i < 4; i++) recordAnswer(p, 't', 'f', true);
    expect(timerSecondsFor(p.facts.t.f)).toBe(5);
    recordAnswer(p, 't', 'f', false);
    expect(timerSecondsFor(p.facts.t.f)).toBe(15);
  });
});

describe('recordBest', () => {
  it('only stores improvements', () => {
    const p = emptyProgress();
    expect(recordBest(p, 't', 'g', 1)).toBe(true);
    expect(recordBest(p, 't', 'g', 1)).toBe(false);
    expect(recordBest(p, 't', 'g', 0)).toBe(false);
    expect(recordBest(p, 't', 'g', 3)).toBe(true);
    expect(p.best.t.g).toBe(3);
  });

  it('counts a first round with zero stars', () => {
    expect(recordBest(emptyProgress(), 't', 'g', 0)).toBe(true);
  });
});

describe('recordHighScore', () => {
  it('only stores scores above zero that beat the previous one', () => {
    const p = emptyProgress();
    expect(recordHighScore(p, 't', 'g', 0)).toBe(false);
    expect(p.highScores).toEqual({});
    expect(recordHighScore(p, 't', 'g', 400)).toBe(true);
    expect(recordHighScore(p, 't', 'g', 400)).toBe(false);
    expect(recordHighScore(p, 't', 'g', 150)).toBe(false);
    expect(recordHighScore(p, 't', 'g', 2400)).toBe(true);
    expect(p.highScores.t.g).toBe(2400);
  });

  it('keeps topics and games apart, and leaves stars alone', () => {
    const p = emptyProgress();
    recordHighScore(p, 't1', 'g', 100);
    recordHighScore(p, 't2', 'g', 200);
    recordHighScore(p, 't1', 'h', 300);
    expect(p.highScores).toEqual({ t1: { g: 100, h: 300 }, t2: { g: 200 } });
    expect(p.best).toEqual({});
  });
});

describe('countMastered', () => {
  it('counts facts with 3 spaced right answers in a row', () => {
    const p = emptyProgress();
    const at = (i: number) => i * LEARN_SPACING_MS;
    for (let i = 0; i < 3; i++) recordAnswer(p, 't', 'a', true, at(i));
    // Right three times, but too close together.
    for (let i = 0; i < 3; i++) recordAnswer(p, 't', 'b', true, i);
    // A miss in the middle breaks the streak.
    recordAnswer(p, 't', 'c', true, at(0));
    recordAnswer(p, 't', 'c', false, at(1));
    recordAnswer(p, 't', 'c', true, at(2));
    recordAnswer(p, 't', 'c', true, at(3));
    // A miss before is fine.
    recordAnswer(p, 't', 'd', false, at(0));
    for (let i = 1; i <= 3; i++) recordAnswer(p, 't', 'd', true, at(i));
    expect(countMastered(p, 't', ['a', 'b', 'c', 'd', 'e'])).toBe(2);
  });
});

describe('createProgressStore', () => {
  it('adds, selects and removes players with their progress', () => {
    const store = createProgressStore(memoryStore());
    expect(store.currentPlayer()).toBeNull();
    const ava = store.addPlayer('  Ava  ', AVATARS[2]);
    expect(ava).toMatchObject({ name: 'Ava', avatar: AVATARS[2] });
    store.setCurrentPlayer(ava.id);
    expect(store.currentPlayer()).toEqual(ava);

    const progress = { ...emptyProgress(), levelsVersion: LEVELS_VERSION };
    recordAnswer(progress, 't', 'f', true);
    store.save(ava.id, progress);
    expect(store.load(ava.id)).toEqual(progress);

    store.removePlayer(ava.id);
    expect(store.listPlayers()).toEqual([]);
    expect(store.currentPlayer()).toBeNull();
    expect(store.load(ava.id)).toEqual({ ...emptyProgress(), levelsVersion: LEVELS_VERSION });
  });

  it('loads progress saved before high scores existed', () => {
    const raw = memoryStore();
    const store = createProgressStore(raw);
    const old = {
      facts: { t: { f: { correct: 1, wrong: 0, streak: 1, lastSeen: 5 } } },
      best: { t: { g: 2 } },
    };
    raw.setItem('sg:progress:p1', JSON.stringify(old));
    const loaded = store.load('p1');
    expect(loaded.highScores).toEqual({});
    expect(loaded.facts).toEqual(old.facts);
    expect(loaded.best).toEqual(old.best);
    recordHighScore(loaded, 't', 'g', 90);
    store.save('p1', loaded);
    expect(store.load('p1').highScores).toEqual({ t: { g: 90 } });
  });

  it('keeps ladders when they are saved, and loads progress that has none', () => {
    const raw = memoryStore();
    const store = createProgressStore(raw);
    raw.setItem('sg:progress:p1', JSON.stringify({ facts: {}, best: {}, highScores: {} }));
    const loaded = store.load('p1');
    expect(loaded.ladders).toBeUndefined();
    recordLadder(loaded, 't', 'g', 3);
    recordLadder(loaded, 't', 'g', 2);
    expect(loaded.ladders).toEqual({ t: { g: 2 } });
    store.save('p1', loaded);
    expect(store.load('p1').ladders).toEqual({ t: { g: 2 } });
    raw.setItem('sg:progress:p2', JSON.stringify({ ladders: 7 }));
    expect(store.load('p2').ladders).toBeUndefined();
  });

  it('loads progress saved before My Level, and keeps levelsOpen once it is saved', () => {
    const raw = memoryStore();
    const store = createProgressStore(raw);
    raw.setItem('sg:progress:p1', JSON.stringify({ facts: {}, best: {}, highScores: {} }));
    const loaded = store.load('p1');
    expect(loaded.levelsOpen).toBeUndefined();
    loaded.levelsOpen = 3;
    store.save('p1', loaded);
    expect(store.load('p1').levelsOpen).toBe(3);
  });

  it('keeps pathLevelsOpen and homePath, and drops values of the wrong type', () => {
    const raw = memoryStore();
    const store = createProgressStore(raw);
    raw.setItem(
      'sg:progress:p1',
      JSON.stringify({ pathLevelsOpen: { 'social-studies': 3 }, homePath: 'social-studies' }),
    );
    const loaded = store.load('p1');
    expect(loaded.pathLevelsOpen).toEqual({ 'social-studies': 3 });
    expect(loaded.homePath).toBe('social-studies');
    raw.setItem('sg:progress:p2', JSON.stringify({ pathLevelsOpen: 5, homePath: 7 }));
    const bad = store.load('p2');
    expect(bad.pathLevelsOpen).toBeUndefined();
    expect(bad.homePath).toBeUndefined();
  });

  it('keeps recent, drops a non-array, non-string entries and anything past 4', () => {
    const raw = memoryStore();
    const store = createProgressStore(raw);
    raw.setItem('sg:progress:p1', JSON.stringify({ recent: ['times-7', 3, null, 'my-level'] }));
    expect(store.load('p1').recent).toEqual(['times-7', 'my-level']);
    raw.setItem('sg:progress:p2', JSON.stringify({ recent: 'times-7' }));
    expect(store.load('p2').recent).toBeUndefined();
    raw.setItem('sg:progress:p3', JSON.stringify({ recent: ['a', 'b', 'c', 'd', 'e', 'f'] }));
    expect(store.load('p3').recent).toEqual(['a', 'b', 'c', 'd']);
    const p = store.load('p4');
    p.recent = ['times-7', 'my-level'];
    store.save('p4', p);
    expect(store.load('p4').recent).toEqual(['times-7', 'my-level']);
  });

  it('keeps players separate', () => {
    const store = createProgressStore(memoryStore());
    const a = store.addPlayer('A', AVATARS[0]);
    const b = store.addPlayer('B', AVATARS[1]);
    const progress = emptyProgress();
    recordAnswer(progress, 't', 'f', false);
    store.save(a.id, progress);
    expect(store.load(b.id)).toEqual({ ...emptyProgress(), levelsVersion: LEVELS_VERSION });
  });

  it('rejects blank names, trims long ones and falls back to a known avatar', () => {
    const store = createProgressStore(memoryStore());
    expect(() => store.addPlayer('   ', AVATARS[0])).toThrow();
    const p = store.addPlayer('x'.repeat(50), 'not-an-avatar');
    expect(p.name).toHaveLength(20);
    expect(p.avatar).toBe(AVATARS[0]);
  });

  it('survives corrupt stored data', () => {
    const raw = memoryStore();
    raw.setItem('sg:players', '{not json');
    const store = createProgressStore(raw);
    expect(store.listPlayers()).toEqual([]);
  });
});

describe('migrateAboveTenTables', () => {
  const stat = (): FactStat => ({ correct: 3, wrong: 0, streak: 3, lastSeen: 1 });
  const withFacts = (facts: PlayerProgress['facts']): PlayerProgress => ({
    ...emptyProgress(),
    facts,
  });

  it('copies the times facts with a number over 10 and leaves the others', () => {
    const p = withFacts({
      'times-7': { '3x7': stat(), '12x7': stat(), '7x7': stat() },
      'times-12': { '5x12': stat() },
    });
    expect(migrateAboveTenTables(p)).toBe(true);
    expect(Object.keys(p.facts['multiplication-11-16']).sort()).toEqual(['12x7', '5x12']);
    expect(Object.keys(p.facts['times-7']).sort()).toEqual(['12x7', '3x7', '7x7']);
    expect(p.facts['times-12']['5x12']).toEqual(stat());
    // A copy, not the same object.
    p.facts['multiplication-11-16']['12x7'].correct = 9;
    expect(p.facts['times-7']['12x7'].correct).toBe(3);
  });

  it('copies the divide facts with a quotient or divisor over 10', () => {
    const p = withFacts({
      'divide-by-13': { '130/13': stat() },
      'divide-by-5': { '60/5': stat(), '50/5': stat() },
    });
    expect(migrateAboveTenTables(p)).toBe(true);
    expect(Object.keys(p.facts['division-11-16']).sort()).toEqual(['130/13', '60/5']);
    expect(p.facts['multiplication-11-16']).toBeUndefined();
    expect(p.facts['divide-by-5']['60/5']).toEqual(stat());
  });

  it('skips ids that do not parse or do not match their topic', () => {
    const p = withFacts({
      'times-7': { weird: stat(), '3x4': stat() },
      'divide-by-3': { '10/3': stat() },
    });
    expect(migrateAboveTenTables(p)).toBe(false);
    expect(p.facts['multiplication-11-16']).toBeUndefined();
    expect(p.facts['division-11-16']).toBeUndefined();
  });

  it('never overwrites what the new topic has, and a second run changes nothing', () => {
    const mine: FactStat = { correct: 1, wrong: 2, streak: 0, lastSeen: 9 };
    const p = withFacts({
      'times-7': { '12x7': stat(), '14x7': stat() },
      'multiplication-11-16': { '12x7': mine },
    });
    expect(migrateAboveTenTables(p)).toBe(true);
    expect(p.facts['multiplication-11-16']['12x7']).toEqual(mine);
    expect(p.facts['multiplication-11-16']['14x7']).toEqual(stat());
    const after = structuredClone(p);
    expect(migrateAboveTenTables(p)).toBe(false);
    expect(p).toEqual(after);
  });

  it('carries the highest stars and high scores of the tables 11 to 16', () => {
    const p = emptyProgress();
    p.best = {
      'times-12': { g: 2, h: 1 },
      'times-14': { g: 3 },
      'times-3': { g: 2 },
      'divide-by-13': { g: 1 },
      'divide-by-16': { g: 2 },
    };
    p.highScores = {
      'times-11': { g: 500 },
      'times-16': { g: 900 },
      'times-5': { g: 700 },
      'divide-by-15': { g: 40 },
    };
    expect(migrateAboveTenTables(p)).toBe(true);
    expect(p.best['multiplication-11-16']).toEqual({ g: 3, h: 1 });
    expect(p.best['division-11-16']).toEqual({ g: 2 });
    expect(p.best['times-3']).toEqual({ g: 2 });
    expect(p.best['times-12']).toEqual({ g: 2, h: 1 });
    expect(p.highScores['multiplication-11-16']).toEqual({ g: 900 });
    expect(p.highScores['division-11-16']).toEqual({ g: 40 });
    expect(p.highScores['times-5']).toEqual({ g: 700 });
  });

  it('keeps a higher value the new topic already has', () => {
    const p = emptyProgress();
    p.best = { 'times-12': { g: 2 }, 'multiplication-11-16': { g: 3 } };
    p.highScores = { 'divide-by-12': { g: 10 }, 'division-11-16': { g: 20 } };
    expect(migrateAboveTenTables(p)).toBe(false);
    expect(p.best['multiplication-11-16']).toEqual({ g: 3 });
    expect(p.highScores['division-11-16']).toEqual({ g: 20 });
  });

  it('leaves levelsOpen, My Level, addition data and empty progress alone', () => {
    const empty = emptyProgress();
    expect(migrateAboveTenTables(empty)).toBe(false);
    expect(empty).toEqual(emptyProgress());

    const p = withFacts({ 'addition-11-16': { '3+12': stat() }, 'times-12': { '5x12': stat() } });
    p.levelsOpen = 25;
    p.best['my-level'] = { g: 3 };
    p.highScores['my-level'] = { g: 80 };
    migrateAboveTenTables(p);
    expect(p.levelsOpen).toBe(25);
    expect(p.best['my-level']).toEqual({ g: 3 });
    expect(p.highScores['my-level']).toEqual({ g: 80 });
    expect(p.facts['addition-11-16']).toEqual({ '3+12': stat() });
    expect(Object.keys(p.facts).sort()).toEqual([
      'addition-11-16',
      'multiplication-11-16',
      'times-12',
    ]);
  });

  it('is applied when the store loads a player', () => {
    const raw = memoryStore();
    const store = createProgressStore(raw);
    const old = withFacts({ 'times-12': { '5x12': stat() }, 'divide-by-13': { '130/13': stat() } });
    old.best = { 'times-12': { g: 3 } };
    old.levelsOpen = 25;
    raw.setItem('sg:progress:p1', JSON.stringify(old));
    const loaded = store.load('p1');
    expect(loaded.facts['multiplication-11-16']['5x12']).toEqual(stat());
    expect(loaded.facts['division-11-16']['130/13']).toEqual(stat());
    expect(loaded.best['multiplication-11-16']).toEqual({ g: 3 });
    expect(loaded.facts['times-12']['5x12']).toEqual(stat());
    // Old level 25 (x 11, 12) is level 73 now.
    expect(loaded.levelsOpen).toBe(73);
  });

  describe('with the real levels', () => {
    /** The topic id a fact was saved under before the 11 to 16 cards. */
    const oldTopicId = ({ topic, fact }: LevelFact) => {
      const visual = fact.visual!;
      if (visual.kind === 'multiply') return `times-${visual.b}`;
      if (visual.kind === 'divide') return `divide-by-${visual.b}`;
      return topic.id;
    };
    /** The 30 levels there were before the missing-number ones. */
    const plainLevels = OLD_LEVEL_SPOTS.map((spot) => LEVELS[spot - 1]);
    const oldProgress = (levels: number) => {
      const p = emptyProgress();
      for (const lf of plainLevels.slice(0, levels).flatMap((l) => l.facts)) {
        for (let i = 0; i < 3; i++) {
          recordAnswer(p, oldTopicId(lf), lf.fact.id, true, i * LEARN_SPACING_MS);
        }
      }
      return p;
    };
    const loadOld = (old: PlayerProgress) => {
      const raw = memoryStore();
      raw.setItem('sg:progress:p1', JSON.stringify(old));
      return createProgressStore(raw).load('p1');
    };

    it('keeps every level open and every fact learned', () => {
      const old = oldProgress(30);
      old.levelsOpen = 30;
      const loaded = loadOld(old);
      expect(loaded.levelsOpen).toBe(82);
      expect(levelsOpen(loaded)).toBeGreaterThanOrEqual(82);
      for (const lf of plainLevels.flatMap((l) => l.facts)) {
        expect(isMastered(loaded.facts[topicOfFact(lf.fact).id]?.[lf.fact.id])).toBe(true);
      }
    });

    it('keeps the player at old level 19 (now 55) after answering the first 24 old levels', () => {
      const old = oldProgress(24);
      old.levelsOpen = 19;
      const loaded = loadOld(old);
      expect(loaded.levelsOpen).toBeGreaterThanOrEqual(55);
      expect(levelPassed(LEVELS[54], loaded.facts)).toBe(true);
      expect(levelsOpen(loaded)).toBeGreaterThanOrEqual(55);
    });
  });
});

describe('migrateRenamedGames', () => {
  it('copies the old golf id to fore, keeps the better value and is repeatable', () => {
    const p = emptyProgress();
    p.best['times-7'] = { 'fairway-golf': 2 };
    p.highScores['times-7'] = { 'fairway-golf': 95, fore: 90 };
    p.highScores['times-8'] = { 'fairway-golf': 80, fore: 99 };
    expect(migrateRenamedGames(p)).toBe(true);
    expect(p.best['times-7'].fore).toBe(2);
    expect(p.highScores['times-7'].fore).toBe(95);
    expect(p.highScores['times-8'].fore).toBe(99);
    expect(p.highScores['times-7']['fairway-golf']).toBe(95);
    expect(migrateRenamedGames(p)).toBe(false);
  });
});

describe('migrateMissingNumberLevels', () => {
  const at = (levelsOpen?: number, levelsVersion?: number): PlayerProgress => ({
    ...emptyProgress(),
    levelsOpen,
    levelsVersion,
  });

  it('maps the old level to the same plain level in the new order', () => {
    for (const [from, to] of [
      [9, 21],
      [1, 1],
      [30, 82],
      [0, 1],
      [99, 82],
    ]) {
      const p = at(from);
      expect(migrateMissingNumberLevels(p)).toBe(true);
      expect(p.levelsOpen).toBe(to);
      expect(p.levelsVersion).toBe(LEVELS_VERSION);
    }
  });

  it('leaves current progress alone and is idempotent', () => {
    const current = at(15, LEVELS_VERSION);
    expect(migrateMissingNumberLevels(current)).toBe(false);
    expect(current.levelsOpen).toBe(15);
    const p = at(9);
    migrateMissingNumberLevels(p);
    expect(migrateMissingNumberLevels(p)).toBe(false);
    expect(p.levelsOpen).toBe(21);
  });

  it('stamps the version when levelsOpen is absent', () => {
    const p = at(undefined);
    expect(migrateMissingNumberLevels(p)).toBe(false);
    expect(p.levelsOpen).toBeUndefined();
    expect(p.levelsVersion).toBe(LEVELS_VERSION);
  });

  it('is applied by load, once', () => {
    const raw = memoryStore();
    const store = createProgressStore(raw);
    raw.setItem('sg:progress:p1', JSON.stringify({ facts: {}, best: {}, levelsOpen: 12 }));
    const loaded = store.load('p1');
    expect(loaded.levelsOpen).toBe(26);
    store.save('p1', loaded);
    expect(store.load('p1').levelsOpen).toBe(26);
    const fresh = store.load('new');
    expect(fresh.levelsVersion).toBe(LEVELS_VERSION);
    fresh.levelsOpen = 3;
    store.save('new', fresh);
    expect(store.load('new').levelsOpen).toBe(3);
  });
});

describe('account players', () => {
  const signedIn = () => {
    const kv = memoryStore();
    kv.setItem('sg:sync:account', JSON.stringify({ email: 'a@b.co', token: 't' }));
    return { kv, store: createProgressStore(kv) };
  };

  it('stamps savedAt and queues account players on save, but not plain ones', () => {
    const store = createProgressStore(memoryStore());
    const plain = store.addPlayer('Plain', AVATARS[0]);
    const joined = store.addPlayer('Joined', AVATARS[1]);
    store.markAccount([joined.id]);
    store.clearPending(store.takeDirty(), []);

    const p = emptyProgress();
    store.save(plain.id, p);
    expect(store.load(plain.id).savedAt).toBeUndefined();
    expect(store.pending().dirty).toEqual([]);

    store.save(joined.id, p);
    store.save(joined.id, p);
    expect(typeof store.load(joined.id).savedAt).toBe('number');
    expect(store.pending().dirty).toEqual([joined.id]);
  });

  it('saveSynced neither stamps nor queues', () => {
    const { store } = signedIn();
    const player = store.addPlayer('Ana', AVATARS[0]);
    store.clearPending([player.id], []);
    store.saveSynced(player.id, { ...emptyProgress(), savedAt: 5 });
    expect(store.load(player.id).savedAt).toBe(5);
    expect(store.pending().dirty).toEqual([]);
  });

  it('queues a tombstone only for an account player', () => {
    const { kv, store } = signedIn();
    const cloud = store.addPlayer('Cloud', AVATARS[0]);
    expect(cloud.account).toBe(true);
    store.releaseAccount(false);
    kv.removeItem('sg:sync:account');
    const local = store.addPlayer('Local', AVATARS[0]);
    store.removePlayer(local.id);
    expect(store.pending()).toEqual({ dirty: [], removed: [] });
  });

  it('removePlayer on an account player moves it from dirty to removed', () => {
    const { store } = signedIn();
    const p = store.addPlayer('Cloud', AVATARS[0]);
    expect(store.pending().dirty).toEqual([p.id]);
    store.removePlayer(p.id);
    expect(store.pending()).toEqual({ dirty: [], removed: [p.id] });
  });

  it('a player added while signed in joins the account, one added signed out does not', () => {
    const { store } = signedIn();
    const p = store.addPlayer('New', AVATARS[2]);
    expect(store.listPlayers()[0]).toEqual({ ...p, account: true });
    expect(store.pending().dirty).toEqual([p.id]);
    const plain = createProgressStore(memoryStore()).addPlayer('New', AVATARS[2]);
    expect(plain.account).toBeUndefined();
  });

  it('markAccount flags everyone with all', () => {
    const store = createProgressStore(memoryStore());
    const a = store.addPlayer('A', AVATARS[0]);
    const b = store.addPlayer('B', AVATARS[0]);
    store.markAccount('all');
    expect(store.listPlayers().every((p) => p.account)).toBe(true);
    expect(store.pending().dirty).toEqual([a.id, b.id]);
  });

  it('upsertAccountPlayers adds missing players only and keeps current', () => {
    const store = createProgressStore(memoryStore());
    const mine = store.addPlayer('Mine', AVATARS[0]);
    store.setCurrentPlayer(mine.id);
    store.upsertAccountPlayers([
      { id: mine.id, name: 'Other name', avatar: AVATARS[1] },
      { id: 'zzzz1', name: 'Remote', avatar: AVATARS[3] },
    ]);
    const list = store.listPlayers();
    expect(list.map((p) => p.name)).toEqual(['Mine', 'Remote']);
    expect(list[1].account).toBe(true);
    expect(store.currentPlayer()?.id).toBe(mine.id);
  });

  describe('releaseAccount', () => {
    const setup = () => {
      const store = createProgressStore(memoryStore());
      const local = store.addPlayer('Local', AVATARS[0]);
      const cloud = store.addPlayer('Cloud', AVATARS[1]);
      store.markAccount([cloud.id]);
      store.save(cloud.id, emptyProgress());
      store.save(local.id, emptyProgress());
      store.setCurrentPlayer(cloud.id);
      return { store, local, cloud };
    };

    it('keeps the players as local-only', () => {
      const { store, cloud } = setup();
      store.releaseAccount(false);
      expect(store.listPlayers().map((p) => p.name)).toEqual(['Local', 'Cloud']);
      expect(store.listPlayers().some((p) => 'account' in p)).toBe(false);
      expect(store.pending()).toEqual({ dirty: [], removed: [] });
      expect(store.currentPlayer()?.id).toBe(cloud.id);
    });

    it('removes account players and their progress, and clears current', () => {
      const { store, local } = setup();
      store.releaseAccount(true);
      expect(store.listPlayers().map((p) => p.id)).toEqual([local.id]);
      expect(store.currentPlayer()).toBeNull();
      expect(store.pending()).toEqual({ dirty: [], removed: [] });
    });
  });

  it('loads old saves unchanged and keeps savedAt', () => {
    const kv = memoryStore();
    kv.setItem(
      'sg:progress:x',
      JSON.stringify({ facts: {}, best: {}, highScores: {}, savedAt: 9 }),
    );
    const store = createProgressStore(kv);
    expect(store.load('x')).toMatchObject({ facts: {}, best: {}, highScores: {}, savedAt: 9 });
    expect(store.load('missing').savedAt).toBeUndefined();
  });

  it('clearPending leaves ids it was not given', () => {
    const { store } = signedIn();
    const a = store.addPlayer('A', AVATARS[0]);
    const b = store.addPlayer('B', AVATARS[0]);
    store.clearPending([a.id], []);
    expect(store.pending().dirty).toEqual([b.id]);
  });
});
