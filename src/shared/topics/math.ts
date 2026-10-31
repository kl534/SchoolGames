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

export type Blank = 'middle' | 'first';

/**
 * The missing-number twin of a plain math fact: `6 + ? = 12` (middle) or `? + 6 = 12` (first).
 * `visual` holds the shown equation's operands, with `blank` naming the one that is the answer.
 * The statement is always a plain fact somewhere else, so its voice clip already exists.
 */
export function missingFact(plain: Fact, blank: Blank): Fact {
  const v = plain.visual;
  if (!v) throw new Error(`Fact ${plain.id} is not a plain math fact`);
  const { kind, a, b } = v;
  const r = Number(plain.answer);
  const sym = SYMBOL[kind];
  const idSym = ID_SYMBOL[kind];
  const word = WORD[kind];
  const first = blank === 'first';
  // The shown equation's x, y and result, the number to find, and which operand it is.
  let shown: { x: number; y: number; z: number };
  let answer: number;
  let visual: { a: number; b: number };
  if (first) {
    shown = { x: a, y: b, z: r };
    answer = a;
    visual = { a, b };
  } else if (kind === 'multiply') {
    shown = { x: b, y: a, z: r };
    answer = a;
    visual = { a: b, b: a };
  } else if (kind === 'divide') {
    shown = { x: a, y: r, z: b };
    answer = r;
    visual = { a, b: r };
  } else {
    shown = { x: a, y: b, z: r };
    answer = b;
    visual = { a, b };
  }
  const { x, y, z } = shown;
  let prompt: string;
  let id: string;
  let spokenPrompt: string;
  if (first) {
    prompt = `? ${sym} ${b} = ${r}`;
    id = `_${idSym}${b}=${r}`;
    spokenPrompt = `What ${word} ${b} equals ${r}?`;
  } else if (kind === 'multiply') {
    prompt = `${b} ${sym} ? = ${r}`;
    id = `${b}${idSym}_=${r}`;
    spokenPrompt = `${b} ${word} what equals ${r}?`;
  } else if (kind === 'divide') {
    prompt = `${a} ${sym} ? = ${b}`;
    id = `${a}${idSym}_=${b}`;
    spokenPrompt = `${a} ${word} what equals ${b}?`;
  } else {
    prompt = `${a} ${sym} ? = ${r}`;
    id = `${a}${idSym}_=${r}`;
    spokenPrompt = `${a} ${word} what equals ${r}?`;
  }
  return {
    id,
    prompt,
    answer: String(answer),
    statement: `${x} ${sym} ${y} = ${z}`,
    spokenPrompt,
    spokenStatement: `${x} ${word} ${y} equals ${z}.`,
    visual: { kind, ...visual, blank: first ? 'a' : 'b' },
  };
}

/** Wrong answers for a missing-number fact: the usual slips for finding that number. */
export function missingDistractors(fact: Fact, count: number, random: Random): string[] {
  const x = Number(fact.answer);
  if (!fact.visual) return numericDistractors(x, [], count, random, 1);
  const { kind, a, b, blank } = fact.visual;
  const near = [x - 1, x + 1, x - 2, x + 2];
  const r = compute(kind, a, b);
  const o = blank === 'a' ? b : a;
  let candidates: number[];
  if (kind === 'add') candidates = [r, r + o];
  else if (kind === 'subtract')
    candidates = blank === 'a' ? [Math.abs(r - o), r, o] : [r, a + r, a];
  else if (kind === 'multiply') candidates = [r - o, o, r];
  else candidates = blank === 'a' ? [x - o, x + o, r, o] : [a - r, r, a];
  return numericDistractors(x, [...candidates, ...near], count, random, 1);
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

const twinsOf = new Map<Fact, { middle: Fact; first: Fact }>();
const topicOfTwin = new Map<Fact, Topic>();

/** A topic of every plain fact's two missing-number twins: all middle blanks, then all first. */
function missingTopic(
  id: string,
  subject: string,
  title: string,
  description: string,
  sources: Topic[],
): Topic {
  const plain = sources.flatMap((t) => t.facts);
  const pairs = plain.map((fact) => ({
    fact,
    middle: missingFact(fact, 'middle'),
    first: missingFact(fact, 'first'),
  }));
  const topic: Topic = {
    id,
    title,
    subject,
    description,
    facts: [...pairs.map((p) => p.middle), ...pairs.map((p) => p.first)],
    distractors: missingDistractors,
  };
  for (const { fact, middle, first } of pairs) {
    twinsOf.set(fact, { middle, first });
    topicOfTwin.set(middle, topic);
    topicOfTwin.set(first, topic);
  }
  return topic;
}

const TITLE_1_10 = 'Missing numbers 1–10';
const TITLE_11_16 = 'Missing numbers 11–16';
const addMissing10 = missingTopic(
  'addition-missing-1-10',
  'Addition',
  TITLE_1_10,
  'Find the missing number, like 6 + ? = 12 and ? + 4 = 9.',
  [addition],
);
const addMissing16 = missingTopic(
  'addition-missing-11-16',
  'Addition',
  TITLE_11_16,
  'Like 9 + ? = 21 and ? + 13 = 19.',
  [bigAddition],
);
const subMissing10 = missingTopic(
  'subtraction-missing-1-10',
  'Subtraction',
  TITLE_1_10,
  'Like 12 − ? = 6 and ? − 5 = 4.',
  [subtraction],
);
const subMissing16 = missingTopic(
  'subtraction-missing-11-16',
  'Subtraction',
  TITLE_11_16,
  'Like 21 − ? = 12 and ? − 6 = 13.',
  [bigSubtraction],
);
const mulMissing10 = missingTopic(
  'multiplication-missing-1-10',
  'Multiplication',
  TITLE_1_10,
  'Like 4 × ? = 28 and ? × 6 = 48.',
  timesTables,
);
const mulMissing16 = missingTopic(
  'multiplication-missing-11-16',
  'Multiplication',
  TITLE_11_16,
  'Like 5 × ? = 60 and ? × 12 = 84.',
  [bigMultiplication],
);
const divMissing10 = missingTopic(
  'division-missing-1-10',
  'Division',
  TITLE_1_10,
  'Like 28 ÷ ? = 4 and ? ÷ 6 = 8.',
  divisionTables,
);
const divMissing16 = missingTopic(
  'division-missing-11-16',
  'Division',
  TITLE_11_16,
  'Like 60 ÷ ? = 5 and ? ÷ 12 = 7.',
  [bigDivision],
);

/** The missing-number twin of a plain math fact, and the topic it is in. Same Fact object. */
export function missingTwin(plain: Fact, blank: Blank): { topic: Topic; fact: Fact } {
  const twins = twinsOf.get(plain);
  if (!twins) throw new Error(`Fact ${plain.id} is not a plain math fact`);
  const fact = blank === 'middle' ? twins.middle : twins.first;
  return { topic: topicOfTwin.get(fact) as Topic, fact };
}

export const MATH_TOPICS: Topic[] = [
  addition,
  bigAddition,
  addMissing10,
  addMissing16,
  subtraction,
  bigSubtraction,
  subMissing10,
  subMissing16,
  ...timesTables,
  bigMultiplication,
  mulMissing10,
  mulMissing16,
  ...divisionTables,
  bigDivision,
  divMissing10,
  divMissing16,
];
