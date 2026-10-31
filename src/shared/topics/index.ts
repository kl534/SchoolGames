import { shuffle, type Random } from '../random';
import { stateCapitals } from './capitals';
import { MATH_TOPICS } from './math';
import type { Fact, Topic } from './types';

export type { DistractorFn, Fact, FactVisual, Topic } from './types';

/** Every topic, in menu order. Add new topic lists here. */
export const TOPICS: Topic[] = [...MATH_TOPICS, stateCapitals];

export function getTopic(
  id: string | null | undefined,
  topics: Topic[] = TOPICS,
): Topic | undefined {
  return topics.find((t) => t.id === id);
}

/** Groups topics under their subject, keeping first-seen order. */
export function groupBySubject(topics: Topic[] = TOPICS): { subject: string; topics: Topic[] }[] {
  const groups = new Map<string, Topic[]>();
  for (const topic of topics) {
    groups.set(topic.subject, [...(groups.get(topic.subject) ?? []), topic]);
  }
  return [...groups].map(([subject, list]) => ({ subject, topics: list }));
}

/** Wrong answers taken from the rest of the topic; works for any kind of answer. */
export function defaultDistractors(
  topic: Topic,
  fact: Fact,
  count: number,
  random: Random,
): string[] {
  const others = new Set(topic.facts.map((f) => f.answer).filter((a) => a !== fact.answer));
  return shuffle([...others], random).slice(0, count);
}

/** What is read aloud to ask the fact. */
export const promptSpeech = (fact: Fact): string => fact.spokenPrompt ?? fact.prompt;
/** What is read aloud to tell the whole fact (after a miss, in the preview). */
export const statementSpeech = (fact: Fact): string => fact.spokenStatement ?? fact.statement;

/**
 * What is read after a miss: the line for the wrong answer picked (if the fact has one), then the
 * statement.
 */
export function missSpeech(fact: Fact, chosen?: string): string[] {
  const line =
    chosen !== undefined && fact.wrongLines && Object.hasOwn(fact.wrongLines, chosen)
      ? fact.wrongLines[chosen]
      : undefined;
  return line ? [line, statementSpeech(fact)] : [statementSpeech(fact)];
}

/**
 * The correct answer plus up to `count - 1` distinct wrong ones, shuffled.
 * May return fewer than `count` when the topic has too few distinct answers.
 */
export function answerOptions(
  topic: Topic,
  fact: Fact,
  count: number,
  random: Random = Math.random,
): string[] {
  const wanted = count - 1;
  const wrong = new Set(
    (topic.distractors?.(fact, wanted, random) ?? []).filter((a) => a !== fact.answer),
  );
  for (const extra of defaultDistractors(topic, fact, wanted, random)) {
    if (wrong.size >= wanted) break;
    wrong.add(extra);
  }
  return shuffle([fact.answer, ...[...wrong].slice(0, wanted)], random);
}

export interface ListItem {
  prompt: string;
  answer: string;
  /** Defaults to `answer`; must be unique within the list. */
  id?: string;
  /** Defaults to `prompt` and `answer` joined with ' → '. */
  statement?: string;
  spokenPrompt?: string;
  spokenStatement?: string;
}

/**
 * Builds a topic from plain prompt/answer pairs, e.g. sight words or vocabulary.
 * Wrong answers come from the other items in the list.
 */
export function listTopic(meta: Omit<Topic, 'facts' | 'distractors'>, items: ListItem[]): Topic {
  return {
    ...meta,
    facts: items.map((item) => ({
      id: item.id ?? item.answer,
      prompt: item.prompt,
      answer: item.answer,
      statement: item.statement ?? `${item.prompt} → ${item.answer}`,
      spokenPrompt: item.spokenPrompt,
      spokenStatement: item.spokenStatement,
    })),
  };
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Returns a list of problems; empty means the topic is usable by games. */
export function validateTopic(topic: Topic): string[] {
  const errors: string[] = [];
  if (!ID_PATTERN.test(topic.id)) errors.push(`${topic.id}: id must be lowercase kebab-case`);
  for (const key of ['title', 'subject', 'description'] as const) {
    if (!topic[key]?.trim()) errors.push(`${topic.id}: ${key} must be non-empty`);
  }
  if (topic.facts.length === 0) errors.push(`${topic.id}: needs at least one fact`);
  const ids = new Set<string>();
  for (const fact of topic.facts) {
    if (ids.has(fact.id)) errors.push(`${topic.id}: duplicate fact id ${fact.id}`);
    ids.add(fact.id);
    if (!fact.prompt.trim() || !fact.answer.trim() || !fact.statement.trim()) {
      errors.push(`${topic.id}: fact ${fact.id} needs a prompt, answer and statement`);
    }
  }
  if (new Set(topic.facts.map((f) => f.answer)).size < 2 && !topic.distractors) {
    errors.push(`${topic.id}: needs at least two different answers or a distractors function`);
  }
  return errors;
}
