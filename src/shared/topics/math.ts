import { shuffle, type Random } from '../random';
import type { Fact, FactVisual, Topic } from './types';

type Operation = FactVisual['kind'];

const SYMBOL: Record<Operation, string> = { add: '+', subtract: '−', multiply: '×', divide: '÷' };
const WORD: Record<Operation, string> = {
  add: 'plus',
  subtract: 'minus',
  multiply: 'times',
  divide: 'divided by',
};
const ID_SYMBOL: Record<Operation, string> = {
  add: '+',
  subtract: '-',
  multiply: 'x',
  divide: '/',
};

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

function compute(kind: Operation, a: number, b: number): number {
  if (kind === 'add') return a + b;
  if (kind === 'subtract') return a - b;
  if (kind === 'divide') return a / b;
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
    spokenPrompt: `${spoken}.`,
    spokenStatement: `${spoken} equals ${answer}.`,
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
        : kind === 'divide'
          ? [b, a - b, a + b, ...near]
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

/** Addition and subtraction numbers run up to this; the first two topics stop at 10. */
export const MAX_ADDEND = 16;
/** The first addition and subtraction topics use numbers up to this. */
const BASE_ADDEND = 10;

/** Pairs (a, b) from 1 to MAX_ADDEND where at least one number is above BASE_ADDEND. */
const bigPairs = range(1, MAX_ADDEND).flatMap((a) =>
  range(1, MAX_ADDEND)
    .filter((b) => Math.max(a, b) > BASE_ADDEND)
    .map((b) => [a, b] as const),
);

const bigAddition: Topic = {
  id: 'addition-11-16',
  title: 'Addition 11–16',
  subject: 'Addition',
  description: 'Add two numbers from 1 to 16 where one is over 10.',
  facts: bigPairs.map(([a, b]) => mathFact('add', a, b)),
  distractors: mathDistractors,
};

const bigSubtraction: Topic = {
  id: 'subtraction-11-16',
  title: 'Subtraction 11–16',
  subject: 'Subtraction',
  description:
    'Take away 1 to 16 from numbers up to 32 (the answer or the number taken away is over 10).',
  facts: bigPairs.map(([b, c]) => mathFact('subtract', b + c, b)),
  distractors: mathDistractors,
};

/** Tables run from 1 to this number, and each table has this many facts. */
export const MAX_TABLE = 16;
/** Tables up to this number stay one card each; the rest of the facts have their own card. */
export const BASE_TABLE = 10;

// Each card holds one table up to × 10: 1 × n up to 10 × n.
const timesTables: Topic[] = range(1, BASE_TABLE).map((table) => ({
  id: `times-${table}`,
  title: `${table} times table`,
  subject: 'Multiplication',
  description: `1 × ${table} up to ${BASE_TABLE} × ${table}.`,
  facts: range(1, BASE_TABLE).map((n) => mathFact('multiply', n, table)),
  distractors: mathDistractors,
}));

// Each table is the times table run backwards: 1 × n up to 10 × n, divided by n.
const divisionTables: Topic[] = range(1, BASE_TABLE).map((divisor) => ({
  id: `divide-by-${divisor}`,
  title: `Divide by ${divisor}`,
  subject: 'Division',
  description: `${divisor} ÷ ${divisor} up to ${divisor * BASE_TABLE} ÷ ${divisor}.`,
  facts: range(1, BASE_TABLE).map((n) => mathFact('divide', n * divisor, divisor)),
  distractors: mathDistractors,
}));

/** Pairs (n, table) from 1 to MAX_TABLE where at least one number is above BASE_TABLE, table by table. */
const bigTablePairs = range(1, MAX_TABLE).flatMap((table) =>
  range(1, MAX_TABLE)
    .filter((n) => Math.max(n, table) > BASE_TABLE)
    .map((n) => [n, table] as const),
);

const bigMultiplication: Topic = {
  id: 'multiplication-11-16',
  title: 'Multiplication 11–16',
  subject: 'Multiplication',
  description: 'Times tables with a number from 11 to 16, like 12 × 7 and 15 × 14.',
  facts: bigTablePairs.map(([n, table]) => mathFact('multiply', n, table)),
  distractors: mathDistractors,
};

const bigDivision: Topic = {
  id: 'division-11-16',
  title: 'Division 11–16',
  subject: 'Division',
  description: 'Dividing with a number from 11 to 16, like 84 ÷ 7 and 210 ÷ 14.',
  facts: bigTablePairs.map(([n, divisor]) => mathFact('divide', n * divisor, divisor)),
  distractors: mathDistractors,
};

export const MATH_TOPICS: Topic[] = [
  addition,
  bigAddition,
  subtraction,
  bigSubtraction,
  ...timesTables,
  bigMultiplication,
  ...divisionTables,
  bigDivision,
];
