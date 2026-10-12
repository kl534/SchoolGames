import { factWeight, type FactStat } from './progress';
import { shuffle, weightedSample, type Random } from './random';
import type { Fact } from './topics';

export const KICKS_PER_ROUND = 10;
/** A missed fact comes back this many turns later. */
export const RETRY_GAP = 3;

/**
 * Picks the facts for a round, favouring ones the player hasn't seen or often
 * misses. Small topics repeat facts so the round is always `count` long.
 */
export function chooseRoundFacts(
  facts: readonly Fact[],
  stats: Record<string, FactStat> = {},
  count: number = KICKS_PER_ROUND,
  random: Random = Math.random,
): Fact[] {
  const weight = (fact: Fact) => factWeight(stats[fact.id]);
  const chosen: Fact[] = [];
  while (chosen.length < count && facts.length > 0) {
    chosen.push(...weightedSample(facts, weight, count - chosen.length, random));
  }
  return shuffle(chosen, random);
}

/** Stars for a finished round. */
export function starsFor(correct: number, total: number): number {
  const ratio = total > 0 ? correct / total : 0;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.5) return 1;
  return 0;
}

export interface Round {
  /** Total turns in the round. */
  readonly length: number;
  /** Turns already answered. */
  readonly played: number;
  readonly correct: number;
  readonly done: boolean;
  /** Result of each answered turn, in order. */
  readonly results: readonly boolean[];
  /** The fact for the current turn, or undefined when done. */
  current(): Fact | undefined;
  /** Records the current turn. A miss schedules the same fact again a few turns later. */
  record(correct: boolean): void;
  /** Distinct facts missed at least once, in the order they were missed. */
  missed(): Fact[];
}

export function createRound(queue: readonly Fact[], gap: number = RETRY_GAP): Round {
  const turns = [...queue];
  const length = turns.length;
  const results: boolean[] = [];
  const missed: Fact[] = [];

  return {
    length,
    get played() {
      return results.length;
    },
    get correct() {
      return results.filter(Boolean).length;
    },
    get done() {
      return results.length >= length;
    },
    results,
    current: () => (results.length < length ? turns[results.length] : undefined),
    record(correct) {
      const index = results.length;
      const fact = turns[index];
      if (!fact) return;
      results.push(correct);
      if (correct) return;
      if (!missed.includes(fact)) missed.push(fact);
      const retryAt = Math.min(index + gap, length - 1);
      if (retryAt > index) {
        turns.splice(retryAt, 0, fact);
        turns.length = length;
      }
    },
    missed: () => [...missed],
  };
}
