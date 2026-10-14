import { RETRY_GAP } from './round';
import type { Fact } from './topics';

/** The feed tops itself up when fewer than this many facts are waiting. */
export const MIN_QUEUED = 6;

export interface FactFeed {
  /** The next fact; the feed never runs dry. */
  take(): Fact;
  /** The next `count` facts, without taking them. */
  peek(count: number): Fact[];
  /** Counts a correct answer. */
  recordHit(fact: Fact): void;
  /**
   * Counts a wrong answer and notes the fact as missed. Unless `retry` is false, the fact comes
   * back `RETRY_GAP` targets later.
   */
  recordMiss(fact: Fact, retry?: boolean): void;
  /** Puts facts that were taken but never asked back at the front, in order. */
  returnUnused(facts: readonly Fact[]): void;
  readonly answered: number;
  readonly correct: number;
  /** Distinct facts missed at least once, in the order they were missed. */
  missed(): Fact[];
}

/**
 * An endless queue of facts for a run. It starts from `choose()` and asks for more whenever it
 * runs low, so a run can go on as long as the player does. `choose` is injected (usually
 * `session.chooseFacts`) so the feed can be tested without a session.
 */
export function createFactFeed(choose: () => Fact[], gap: number = RETRY_GAP): FactFeed {
  const queue: Fact[] = [];
  const missed: Fact[] = [];
  let lastTaken: Fact | undefined;
  let answered = 0;
  let correct = 0;

  const refill = () => {
    // Stop if the chooser has nothing to give, rather than spinning forever.
    for (let tries = 0; queue.length < MIN_QUEUED && tries < 3; tries++) queue.push(...choose());
  };

  return {
    take() {
      refill();
      // Never ask the same question twice in a row when there is another to ask.
      if (queue[0] && queue[0] === lastTaken) {
        const other = queue.findIndex((f) => f !== lastTaken);
        if (other > 0) [queue[0], queue[other]] = [queue[other], queue[0]];
      }
      const fact = queue.shift();
      if (!fact) throw new Error('No facts to ask');
      lastTaken = fact;
      return fact;
    },
    peek(count) {
      refill();
      return queue.slice(0, count);
    },
    recordHit() {
      answered++;
      correct++;
    },
    recordMiss(fact, retry = true) {
      answered++;
      if (!missed.some((f) => f.id === fact.id)) missed.push(fact);
      if (!retry) return;
      refill();
      queue.splice(Math.min(gap - 1, queue.length), 0, fact);
    },
    returnUnused(facts) {
      queue.unshift(...facts);
    },
    get answered() {
      return answered;
    },
    get correct() {
      return correct;
    },
    missed: () => [...missed],
  };
}
