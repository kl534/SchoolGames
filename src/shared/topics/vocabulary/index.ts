import { shuffle, type Random } from '../../random';
import type { Fact, FactMeaning, Topic } from '../types';
import { GRADE_2 } from './grade-2';
import { GRADE_3 } from './grade-3';
import { GRADE_4 } from './grade-4';
import { GRADE_5 } from './grade-5';
import { GRADE_6 } from './grade-6';
import { GRADE_7 } from './grade-7';
import { GRADE_8 } from './grade-8';
import { GRADE_9 } from './grade-9';
import { GRADE_10 } from './grade-10';
import { GRADE_11 } from './grade-11';
import { GRADE_12 } from './grade-12';
import { GRADE_COLLEGE } from './grade-college';
import { MEANINGS_GRADE_2 } from './meanings-grade-2';
import { MEANINGS_GRADE_3 } from './meanings-grade-3';
import { MEANINGS_GRADE_4 } from './meanings-grade-4';
import { MEANINGS_GRADE_5 } from './meanings-grade-5';
import { MEANINGS_GRADE_6 } from './meanings-grade-6';
import { MEANINGS_GRADE_7 } from './meanings-grade-7';
import { MEANINGS_GRADE_8 } from './meanings-grade-8';
import { MEANINGS_GRADE_9 } from './meanings-grade-9';
import { MEANINGS_GRADE_10 } from './meanings-grade-10';
import { MEANINGS_GRADE_11 } from './meanings-grade-11';
import { MEANINGS_GRADE_12 } from './meanings-grade-12';
import { MEANINGS_GRADE_COLLEGE } from './meanings-grade-college';
import type { PartOfSpeech, VocabRow, WordMeaning } from './types';

export type { PartOfSpeech, VocabRow, WordMeaning } from './types';

export type GradeId =
  '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | 'college';

export interface VocabGrade {
  id: GradeId;
  /** 'Grade 2' … 'Grade 12', 'College'. */
  title: string;
  rows: readonly VocabRow[];
  /** Definitions and example sentences by head word (grades without them show no word card). */
  meanings?: Readonly<Record<string, WordMeaning>>;
}

/** Easiest first. Later milestones append grades here; never reorder (levels follow this order). */
export const VOCAB_GRADES: VocabGrade[] = [
  { id: '2', title: 'Grade 2', rows: GRADE_2, meanings: MEANINGS_GRADE_2 },
  { id: '3', title: 'Grade 3', rows: GRADE_3, meanings: MEANINGS_GRADE_3 },
  { id: '4', title: 'Grade 4', rows: GRADE_4, meanings: MEANINGS_GRADE_4 },
  { id: '5', title: 'Grade 5', rows: GRADE_5, meanings: MEANINGS_GRADE_5 },
  { id: '6', title: 'Grade 6', rows: GRADE_6, meanings: MEANINGS_GRADE_6 },
  { id: '7', title: 'Grade 7', rows: GRADE_7, meanings: MEANINGS_GRADE_7 },
  { id: '8', title: 'Grade 8', rows: GRADE_8, meanings: MEANINGS_GRADE_8 },
  { id: '9', title: 'Grade 9', rows: GRADE_9, meanings: MEANINGS_GRADE_9 },
  { id: '10', title: 'Grade 10', rows: GRADE_10, meanings: MEANINGS_GRADE_10 },
  { id: '11', title: 'Grade 11', rows: GRADE_11, meanings: MEANINGS_GRADE_11 },
  { id: '12', title: 'Grade 12', rows: GRADE_12, meanings: MEANINGS_GRADE_12 },
  { id: 'college', title: 'College', rows: GRADE_COLLEGE, meanings: MEANINGS_GRADE_COLLEGE },
];
export const SETS_PER_GRADE = 6;
export const WORDS_PER_SET = 50;

export type VocabKind = 'synonym' | 'antonym';

const cap = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

export const POS_NAMES: Record<PartOfSpeech, FactMeaning['partOfSpeech']> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adjective',
  adv: 'adverb',
};

/** Splits an example at its *word* span: ['She was ', 'happy', ' to see her best friend.']. */
export function exampleParts(example: string): [before: string, word: string, after: string] {
  const parts = example.split('*');
  if (parts.length !== 3) throw new Error(`Example needs exactly one *word* span: ${example}`);
  return [parts[0], parts[1], parts[2]];
}

const VOWELS = 'aeiou';

/** True when `span` is `word` or a regular form of it (s, es, d, ed, ing, er, est, ly, y to i, doubled consonant). */
export function isFormOf(span: string, word: string): boolean {
  const s = span.toLowerCase();
  const w = word.toLowerCase();
  if (s === w) return true;
  const last = w.slice(-1);
  const bases = [w];
  if (last === 'e') bases.push(w.slice(0, -1));
  if (last === 'y' && !VOWELS.includes(w.slice(-2, -1))) bases.push(w.slice(0, -1) + 'i');
  if (
    w.length >= 2 &&
    !VOWELS.includes(last) &&
    'wxy'.indexOf(last) < 0 &&
    VOWELS.includes(w.slice(-2, -1))
  ) {
    bases.push(w + last);
  }
  const endings = ['s', 'es', 'd', 'ed', 'ing', 'er', 'est', 'ly', 'ies', 'ied', 'ier', 'iest'];
  return bases.some(
    (base) => s.startsWith(base) && endings.includes(s.slice(base.length)) && s !== base,
  );
}

function buildFact(row: VocabRow, kind: VocabKind, meaning?: WordMeaning): Fact {
  const [word, , synonyms, antonyms] = row;
  const syn = kind === 'synonym';
  const answer = syn ? synonyms[0] : antonyms[0];
  const noun = syn ? 'synonym' : 'antonym';
  const article = syn ? 'a' : 'an';
  const statementOf = (a: string, k: VocabKind): string =>
    `${cap(a)} is ${k === 'synonym' ? 'a synonym' : 'an antonym'} of ${word}.`;
  const hasBoth = synonyms.length > 0 && antonyms.length > 0;
  const trap = syn ? antonyms[0] : synonyms[0];
  return {
    id: `${syn ? 'syn' : 'ant'}-${word}`,
    prompt: `${cap(noun)} of ${word.toUpperCase()}`,
    answer,
    statement: statementOf(answer, kind),
    spokenPrompt: `What is ${article} ${noun} of ${word}?`,
    ...(meaning
      ? {
          meaning: {
            word,
            partOfSpeech: POS_NAMES[row[1]],
            definition: meaning[0],
            example: meaning[1],
            relation: syn ? ('Synonym' as const) : ('Antonym' as const),
          },
        }
      : {}),
    ...(hasBoth ? { wrongLines: { [trap]: statementOf(trap, syn ? 'antonym' : 'synonym') } } : {}),
  };
}

export function synonymFact(row: VocabRow, meaning?: WordMeaning): Fact {
  return buildFact(row, 'synonym', meaning);
}

/** Undefined when the row has no antonyms. */
export function antonymFact(row: VocabRow, meaning?: WordMeaning): Fact | undefined {
  return row[3].length > 0 ? buildFact(row, 'antonym', meaning) : undefined;
}

// ---- Word relations ----

const groupsOf = new Map<string, VocabRow[]>(); // word -> rows whose group contains it
const antonymOf = new Map<string, VocabRow[]>(); // word -> rows whose antonyms contain it
const push = (map: Map<string, VocabRow[]>, key: string, row: VocabRow): void => {
  const list = map.get(key);
  if (list) list.push(row);
  else map.set(key, [row]);
};
for (const grade of VOCAB_GRADES) {
  for (const row of grade.rows) {
    for (const w of new Set([row[0], ...row[2]])) push(groupsOf, w, row);
    for (const w of row[3]) push(antonymOf, w, row);
  }
}

const nearCache = new Map<string, Set<string>>();
function near(w: string): Set<string> {
  let result = nearCache.get(w);
  if (!result) {
    result = new Set([w]);
    for (const row of groupsOf.get(w) ?? []) {
      result.add(row[0]);
      for (const s of row[2]) result.add(s);
    }
    nearCache.set(w, result);
  }
  return result;
}

function near2(w: string): Set<string> {
  const result = new Set<string>();
  for (const x of near(w)) for (const y of near(x)) result.add(y);
  return result;
}

function opposites(w: string): Set<string> {
  const result = new Set<string>();
  for (const row of groupsOf.get(w) ?? []) for (const a of row[3]) result.add(a);
  for (const row of antonymOf.get(w) ?? []) {
    result.add(row[0]);
    for (const s of row[2]) result.add(s);
  }
  return result;
}

function oppositesNear(w: string): Set<string> {
  const result = new Set<string>();
  for (const x of near(w)) for (const o of opposites(x)) result.add(o);
  return result;
}

interface FactInfo {
  row: VocabRow;
  grade: VocabGrade;
  kind: VocabKind;
}
const infoById = new Map<string, FactInfo>();
for (const grade of VOCAB_GRADES) {
  for (const row of grade.rows) {
    infoById.set(`syn-${row[0]}`, { row, grade, kind: 'synonym' });
    if (row[3].length > 0) infoById.set(`ant-${row[0]}`, { row, grade, kind: 'antonym' });
  }
}

const bannedCache = new Map<string, Set<string>>();
function bannedFor(id: string, info: FactInfo): Set<string> {
  let banned = bannedCache.get(id);
  if (!banned) {
    const { row, kind } = info;
    const answer = kind === 'synonym' ? row[2][0] : row[3][0];
    banned = near2(answer);
    if (kind === 'synonym') {
      for (const w of near2(row[0])) banned.add(w);
    } else {
      banned.add(row[0]);
      for (const w of oppositesNear(row[0])) banned.add(w);
    }
    bannedCache.set(id, banned);
  }
  return banned;
}

/** The distinct answers of a grade's rows, optionally only those of one part of speech. */
function poolOf(grade: VocabGrade, pos?: string): string[] {
  const out = new Set<string>();
  for (const row of grade.rows) {
    if (pos && row[1] !== pos) continue;
    out.add(row[2][0]);
    if (row[3].length > 0) out.add(row[3][0]);
  }
  return [...out];
}

const poolCache = new Map<string, string[]>();
function pool(grade: VocabGrade, pos?: string): string[] {
  const key = `${grade.id}/${pos ?? ''}`;
  let list = poolCache.get(key);
  if (!list) {
    list = poolOf(grade, pos);
    poolCache.set(key, list);
  }
  return list;
}

/** Wrong answers for a vocab fact: the trap, then the same-grade same-pos pool, shuffled. */
export function vocabDistractors(fact: Fact, count: number, random: Random): string[] {
  const info = infoById.get(fact.id);
  if (!info) return [];
  const banned = bannedFor(fact.id, info);
  const { row, grade, kind } = info;
  const out: string[] = [];
  const seen = new Set<string>([fact.answer]);
  const add = (word: string | undefined): void => {
    if (word === undefined || out.length >= count) return;
    if (seen.has(word) || banned.has(word)) return;
    seen.add(word);
    out.push(word);
  };
  add(kind === 'synonym' ? row[3][0] : row[2][0]);
  for (const w of shuffle(pool(grade, row[1]), random)) add(w);
  const others = VOCAB_GRADES.filter((g) => g !== grade).flatMap((g) => pool(g, row[1]));
  for (const w of shuffle(others, random)) add(w);
  for (const w of shuffle(pool(grade), random)) add(w);
  return out;
}

export function synonymTopic(grade: VocabGrade): Topic {
  return {
    id: grade.id === 'college' ? 'synonyms-college' : `synonyms-grade-${grade.id}`,
    title: `${grade.title} synonyms`,
    subject: 'Synonyms',
    description: 'Pick the word that means the same.',
    facts: grade.rows.map((row) => synonymFact(row, grade.meanings?.[row[0]])),
    distractors: vocabDistractors,
  };
}

export function antonymTopic(grade: VocabGrade): Topic {
  return {
    id: grade.id === 'college' ? 'antonyms-college' : `antonyms-grade-${grade.id}`,
    title: `${grade.title} antonyms`,
    subject: 'Antonyms',
    description: 'Pick the word that means the opposite.',
    facts: grade.rows.flatMap((row) => antonymFact(row, grade.meanings?.[row[0]]) ?? []),
    distractors: vocabDistractors,
  };
}

export const SYNONYM_TOPICS: Topic[] = VOCAB_GRADES.map(synonymTopic);
export const ANTONYM_TOPICS: Topic[] = VOCAB_GRADES.map(antonymTopic);
/** Synonyms first, then antonyms: the picker shows the subjects in this order. */
export const VOCABULARY_TOPICS: Topic[] = [...SYNONYM_TOPICS, ...ANTONYM_TOPICS];
