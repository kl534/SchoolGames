import { shuffle, type Random } from '../../random';
import type { Fact, Topic } from '../types';
import { GRADE_2 } from './grade-2';
import { GRADE_3 } from './grade-3';
import { GRADE_4 } from './grade-4';
import { GRADE_5 } from './grade-5';
import { GRADE_6 } from './grade-6';
import { GRADE_7 } from './grade-7';
import { GRADE_8 } from './grade-8';
import { GRADE_9 } from './grade-9';
import { GRADE_10 } from './grade-10';
import type { VocabRow } from './types';

export type { PartOfSpeech, VocabRow } from './types';

export type GradeId =
  '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | 'college';

export interface VocabGrade {
  id: GradeId;
  /** 'Grade 2' … 'Grade 12', 'College'. */
  title: string;
  rows: readonly VocabRow[];
}

/** Easiest first. Later milestones append grades here; never reorder (levels follow this order). */
export const VOCAB_GRADES: VocabGrade[] = [
  { id: '2', title: 'Grade 2', rows: GRADE_2 },
  { id: '3', title: 'Grade 3', rows: GRADE_3 },
  { id: '4', title: 'Grade 4', rows: GRADE_4 },
  { id: '5', title: 'Grade 5', rows: GRADE_5 },
  { id: '6', title: 'Grade 6', rows: GRADE_6 },
  { id: '7', title: 'Grade 7', rows: GRADE_7 },
  { id: '8', title: 'Grade 8', rows: GRADE_8 },
  { id: '9', title: 'Grade 9', rows: GRADE_9 },
  { id: '10', title: 'Grade 10', rows: GRADE_10 },
];
export const SETS_PER_GRADE = 6;
export const WORDS_PER_SET = 50;

export type VocabKind = 'synonym' | 'antonym';

const cap = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

function buildFact(row: VocabRow, kind: VocabKind): Fact {
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
    ...(hasBoth ? { wrongLines: { [trap]: statementOf(trap, syn ? 'antonym' : 'synonym') } } : {}),
  };
}

export function synonymFact(row: VocabRow): Fact {
  return buildFact(row, 'synonym');
}

/** Undefined when the row has no antonyms. */
export function antonymFact(row: VocabRow): Fact | undefined {
  return row[3].length > 0 ? buildFact(row, 'antonym') : undefined;
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
    facts: grade.rows.map(synonymFact),
    distractors: vocabDistractors,
  };
}

export function antonymTopic(grade: VocabGrade): Topic {
  return {
    id: grade.id === 'college' ? 'antonyms-college' : `antonyms-grade-${grade.id}`,
    title: `${grade.title} antonyms`,
    subject: 'Antonyms',
    description: 'Pick the word that means the opposite.',
    facts: grade.rows.flatMap((row) => antonymFact(row) ?? []),
    distractors: vocabDistractors,
  };
}

export const SYNONYM_TOPICS: Topic[] = VOCAB_GRADES.map(synonymTopic);
export const ANTONYM_TOPICS: Topic[] = VOCAB_GRADES.map(antonymTopic);
/** Synonyms first, then antonyms: the picker shows the subjects in this order. */
export const VOCABULARY_TOPICS: Topic[] = [...SYNONYM_TOPICS, ...ANTONYM_TOPICS];
