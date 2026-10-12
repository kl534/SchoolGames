import { shuffle, type Random } from '../random';
import type { Fact, FactVisual, Topic } from './types';

type Operation = FactVisual['kind'];

const SYMBOL: Record<Operation, string> = { add: '+', subtract: '−', multiply: '×' };
const WORD: Record<Operation, string> = { add: 'plus', subtract: 'minus', multiply: 'times' };
const ID_SYMBOL: Record<Operation, string> = { add: '+', subtract: '-', multiply: 'x' };

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

function compute(kind: Operation, a: number, b: number): number {
  if (kind === 'add') return a + b;
  if (kind === 'subtract') return a - b;
  return a * b;
}

export function mathFact(kind: Operation, a: number, b: number): Fact {
  const answer = compute(kind, a, b);
  const shown = `${a} ${SYMBOL[kind]} ${b}`;
  const spoken = `${a} ${WORD[kind]} ${b}`;
  return {
    id: `${a}${ID_SYMBOL[kind]}${b}`,
    prompt: `${shown} = ?`,
    answer: String(answer),
    statement: `${shown} = ${answer}`,
    spokenPrompt: `What is ${spoken}?`,
    spokenStatement: `${spoken} equals ${answer}`,
    visual: { kind, a, b },
  };
}

/**
 * Picks `count` wrong numbers, preferring `candidates` (likely mistakes) and
 * falling back to numbers next to the answer. Never returns values below `min`.
 */
export function numericDistractors(
  answer: number,
  candidates: number[],
  count: number,
  random: Random,
  min = 0,
): string[] {
  const valid = candidates.filter((n) => Number.isInteger(n) && n >= min && n !== answer);
  const picked = shuffle([...new Set(valid)], random).slice(0, count);
  for (let k = 1; picked.length < count; k++) {
    for (const n of [answer + k, answer - k]) {
      if (picked.length < count && n >= min && !picked.includes(n)) picked.push(n);
    }
  }
  return picked.map(String);
}

/** Near misses and mixed-up operations make wrong answers that look plausible. */
function mathDistractors(fact: Fact, count: number, random: Random): string[] {
  const answer = Number(fact.answer);
  if (!fact.visual) return numericDistractors(answer, [], count, random);
  const { kind, a, b } = fact.visual;
  const near = [answer - 1, answer + 1, answer - 2, answer + 2];
  const candidates =
    kind === 'add'
      ? [...near, Math.abs(a - b)]
      : kind === 'subtract'
        ? [...near, a + b]
        : [answer - a, answer + a, answer - b, answer + b, a + b, ...near.slice(0, 2)];
  // Every answer in these topics is at least 1, so 0 would be an obvious wrong choice.
  return numericDistractors(answer, candidates, count, random, 1);
}

const addition: Topic = {
  id: 'addition-1-10',
  title: 'Addition 1–10',
  subject: 'Addition',
  description: 'Add two numbers from 1 to 10.',
  facts: range(1, 10).flatMap((a) => range(1, 10).map((b) => mathFact('add', a, b))),
  distractors: mathDistractors,
};

const subtraction: Topic = {
  id: 'subtraction-1-10',
  title: 'Subtraction 1–10',
  subject: 'Subtraction',
  description: 'Take away 1 to 10 from numbers up to 20.',
  facts: range(1, 10).flatMap((b) => range(1, 10).map((c) => mathFact('subtract', b + c, b))),
  distractors: mathDistractors,
};

const timesTables: Topic[] = range(1, 10).map((table) => ({
  id: `times-${table}`,
  title: `${table} times table`,
  subject: 'Multiplication',
  description: `1 × ${table} up to 10 × ${table}.`,
  facts: range(1, 10).map((n) => mathFact('multiply', n, table)),
  distractors: mathDistractors,
}));

export const MATH_TOPICS: Topic[] = [addition, subtraction, ...timesTables];
