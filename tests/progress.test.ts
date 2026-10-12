import { describe, expect, it } from 'vitest';
import {
  AVATARS,
  countMastered,
  createProgressStore,
  emptyProgress,
  factWeight,
  recordAnswer,
  recordBest,
} from '../src/shared/progress';
import { memoryStore } from '../src/shared/storage';

describe('recordAnswer', () => {
  it('tracks correct, wrong and streak', () => {
    const p = emptyProgress();
    recordAnswer(p, 't', 'f', true, 1);
    recordAnswer(p, 't', 'f', true, 2);
    expect(p.facts.t.f).toEqual({ correct: 2, wrong: 0, streak: 2, lastSeen: 2 });
    recordAnswer(p, 't', 'f', false, 3);
    expect(p.facts.t.f).toEqual({ correct: 2, wrong: 1, streak: 0, lastSeen: 3 });
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

describe('countMastered', () => {
  it('counts facts never missed, or right twice in a row since the last miss', () => {
    const p = emptyProgress();
    recordAnswer(p, 't', 'a', true);
    recordAnswer(p, 't', 'b', false);
    recordAnswer(p, 't', 'b', true);
    recordAnswer(p, 't', 'c', false);
    recordAnswer(p, 't', 'c', true);
    recordAnswer(p, 't', 'c', true);
    expect(countMastered(p, 't', ['a', 'b', 'c', 'd'])).toBe(2);
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

    const progress = emptyProgress();
    recordAnswer(progress, 't', 'f', true);
    store.save(ava.id, progress);
    expect(store.load(ava.id)).toEqual(progress);

    store.removePlayer(ava.id);
    expect(store.listPlayers()).toEqual([]);
    expect(store.currentPlayer()).toBeNull();
    expect(store.load(ava.id)).toEqual(emptyProgress());
  });

  it('keeps players separate', () => {
    const store = createProgressStore(memoryStore());
    const a = store.addPlayer('A', AVATARS[0]);
    const b = store.addPlayer('B', AVATARS[1]);
    const progress = emptyProgress();
    recordAnswer(progress, 't', 'f', false);
    store.save(a.id, progress);
    expect(store.load(b.id)).toEqual(emptyProgress());
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
