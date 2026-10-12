import { describe, expect, it } from 'vitest';
import { seededRandom, shuffle, weightedSample } from '../src/shared/random';
import { chooseRoundFacts, createRound, starsFor } from '../src/shared/round';
import type { Fact } from '../src/shared/topics';

const fact = (id: string): Fact => ({ id, prompt: `${id}?`, answer: id, statement: id });
const facts = 'abcdefghijklmnop'.split('').map(fact);

describe('random helpers', () => {
  it('shuffle keeps every item', () => {
    expect(shuffle([1, 2, 3, 4], seededRandom(1)).sort()).toEqual([1, 2, 3, 4]);
  });

  it('weightedSample returns distinct items and never picks zero weights while others remain', () => {
    const picked = weightedSample([1, 2, 3, 4], (n) => (n === 4 ? 0 : 1), 3, seededRandom(3));
    expect(new Set(picked).size).toBe(3);
    expect(picked).not.toContain(4);
  });
});

describe('chooseRoundFacts', () => {
  it('picks distinct facts when the topic is big enough', () => {
    const chosen = chooseRoundFacts(facts, {}, 10, seededRandom(1));
    expect(chosen).toHaveLength(10);
    expect(new Set(chosen.map((f) => f.id)).size).toBe(10);
  });

  it('repeats facts to fill a round from a small topic', () => {
    const chosen = chooseRoundFacts(facts.slice(0, 3), {}, 10, seededRandom(1));
    expect(chosen).toHaveLength(10);
  });

  it('prefers facts that are often missed', () => {
    const stats = {
      a: { correct: 0, wrong: 10, streak: 0, lastSeen: 0 },
      ...Object.fromEntries(
        facts.slice(1).map((f) => [f.id, { correct: 10, wrong: 0, streak: 10, lastSeen: 0 }]),
      ),
    };
    let hits = 0;
    for (let seed = 0; seed < 50; seed++) {
      if (chooseRoundFacts(facts, stats, 3, seededRandom(seed)).some((f) => f.id === 'a')) hits++;
    }
    expect(hits).toBeGreaterThan(45);
  });
});

describe('createRound', () => {
  it('counts correct answers and finishes after the queue', () => {
    const round = createRound(facts.slice(0, 3));
    round.record(true);
    round.record(true);
    round.record(true);
    expect(round.done).toBe(true);
    expect(round.correct).toBe(3);
    expect(round.current()).toBeUndefined();
  });

  it('brings a missed fact back a few turns later without making the round longer', () => {
    const round = createRound(facts.slice(0, 10), 3);
    expect(round.current()?.id).toBe('a');
    round.record(false);
    const order = [];
    while (!round.done) {
      order.push(round.current()?.id);
      round.record(true);
    }
    expect(order).toEqual(['b', 'c', 'a', 'd', 'e', 'f', 'g', 'h', 'i']);
    expect(round.length).toBe(10);
    expect(round.missed().map((f) => f.id)).toEqual(['a']);
    expect(round.results).toEqual([false, true, true, true, true, true, true, true, true, true]);
  });

  it('retries a fact missed near the end on the last turn', () => {
    const round = createRound(facts.slice(0, 4), 3);
    round.record(true);
    round.record(true);
    round.record(false); // 'c' on turn 3 of 4
    expect(round.current()?.id).toBe('c');
  });

  it('does not retry after the final turn', () => {
    const round = createRound(facts.slice(0, 2), 3);
    round.record(true);
    round.record(false);
    expect(round.done).toBe(true);
  });
});

describe('starsFor', () => {
  it.each([
    [10, 10, 3],
    [9, 10, 3],
    [8, 10, 2],
    [7, 10, 2],
    [5, 10, 1],
    [4, 10, 0],
    [0, 0, 0],
  ])('%d of %d is %d stars', (correct, total, stars) => {
    expect(starsFor(correct, total)).toBe(stars);
  });
});
