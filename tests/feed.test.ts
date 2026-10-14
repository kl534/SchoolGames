import { describe, expect, it } from 'vitest';
import { createFactFeed, MIN_QUEUED } from '../src/shared/feed';
import { seededRandom } from '../src/shared/random';
import { RETRY_GAP } from '../src/shared/round';
import type { Fact } from '../src/shared/topics';

const fact = (id: string): Fact => ({
  id,
  prompt: `${id} = ?`,
  answer: id,
  statement: `${id} = ${id}`,
});

describe('fact feed', () => {
  /** A chooser that hands out ten new facts at a time: f1..f10, then f11..f20, and so on. */
  const counting = () => {
    let next = 1;
    const calls = { n: 0 };
    const choose = () => {
      calls.n++;
      return Array.from({ length: 10 }, () => fact(`f${next++}`));
    };
    return { choose, calls };
  };

  it('starts from the chooser and gives facts in order', () => {
    const { choose } = counting();
    const feed = createFactFeed(choose);
    expect(feed.take().id).toBe('f1');
    expect(feed.take().id).toBe('f2');
    expect(feed.peek(3).map((f) => f.id)).toEqual(['f3', 'f4', 'f5']);
    expect(feed.take().id).toBe('f3');
  });

  it('refills when it runs low, so it never runs dry', () => {
    const { choose, calls } = counting();
    const feed = createFactFeed(choose);
    const ids = Array.from({ length: 35 }, () => feed.take().id);
    expect(ids).toEqual(Array.from({ length: 35 }, (_, i) => `f${i + 1}`));
    expect(calls.n).toBeGreaterThanOrEqual(4);
  });

  it('tops up before it empties', () => {
    const { choose } = counting();
    const feed = createFactFeed(choose);
    for (let i = 0; i < 6; i++) feed.take();
    expect(feed.peek(100).length).toBeGreaterThanOrEqual(MIN_QUEUED);
  });

  it('brings a missed fact back three targets later', () => {
    expect(RETRY_GAP).toBe(3);
    const feed = createFactFeed(counting().choose);
    const first = feed.take();
    feed.recordMiss(first);
    expect(feed.take().id).toBe('f2');
    expect(feed.take().id).toBe('f3');
    expect(feed.take().id).toBe('f1');
    expect(feed.take().id).toBe('f4');
  });

  it('counts answers and correct answers', () => {
    const feed = createFactFeed(counting().choose);
    feed.recordHit(feed.take());
    feed.recordHit(feed.take());
    feed.recordMiss(feed.take());
    expect(feed.answered).toBe(3);
    expect(feed.correct).toBe(2);
  });

  it('lists each missed fact once, in the order it was first missed', () => {
    const feed = createFactFeed(counting().choose);
    const [a, b] = [feed.take(), feed.take()];
    feed.recordMiss(b);
    feed.recordMiss(a);
    feed.recordMiss(b);
    expect(feed.missed().map((f) => f.id)).toEqual(['f2', 'f1']);
    expect(feed.answered).toBe(3);
  });

  it('can note a miss without bringing the fact back', () => {
    const feed = createFactFeed(counting().choose);
    feed.recordMiss(feed.take(), false);
    expect(feed.missed()).toHaveLength(1);
    expect(feed.peek(10).map((f) => f.id)).not.toContain('f1');
  });

  it('puts facts that were never asked back at the front, unrecorded', () => {
    const feed = createFactFeed(counting().choose);
    const boss = [feed.take(), feed.take(), feed.take()];
    feed.recordHit(boss[0]);
    feed.returnUnused(boss.slice(1));
    expect(feed.take().id).toBe('f2');
    expect(feed.take().id).toBe('f3');
    expect(feed.take().id).toBe('f4');
    expect(feed.answered).toBe(1);
    expect(feed.missed()).toEqual([]);
  });

  it('does not ask the same question twice in a row when there is a choice', () => {
    // Re-queueing a miss when only one fact is waiting could put it straight back at the front.
    const feed = createFactFeed(() => [fact('a'), fact('b')], 1);
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const f = feed.take();
      seen.push(f.id);
      feed.recordMiss(f);
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it('works with the random choosers a session gives', () => {
    const random = seededRandom(3);
    const pool = Array.from({ length: 12 }, (_, i) => fact(`p${i}`));
    const feed = createFactFeed(() => [...pool].sort(() => random() - 0.5).slice(0, 10));
    for (let i = 0; i < 100; i++) {
      const f = feed.take();
      if (i % 3 === 0) feed.recordMiss(f);
      else feed.recordHit(f);
    }
    expect(feed.answered).toBe(100);
    expect(feed.correct).toBe(66);
  });

  it('gives up with an error when there are no facts at all', () => {
    expect(() => createFactFeed(() => []).take()).toThrow();
  });
});
