import type { Random } from '../random';

/**
 * What kind of sum a math fact is, with its numbers. `blank` is set on missing-number facts: the
 * operand of the shown equation that is the answer.
 */
export type FactVisual =
  | { kind: 'add'; a: number; b: number; blank?: 'a' | 'b' }
  | { kind: 'subtract'; a: number; b: number; blank?: 'a' | 'b' }
  | { kind: 'multiply'; a: number; b: number; blank?: 'a' | 'b' }
  | { kind: 'divide'; a: number; b: number; blank?: 'a' | 'b' };

/** One thing to learn: a prompt with a single correct answer. Answers are text, so words work too. */
export interface Fact {
  /** Unique within its topic and stable across releases; progress is stored under it. */
  id: string;
  /** Shown while playing, e.g. '7 + 8 = ?'. */
  prompt: string;
  /** The correct answer, e.g. '15' or 'said'. */
  answer: string;
  /** The whole fact for the preview and reveals, e.g. '7 + 8 = 15'. */
  statement: string;
  /** Read aloud with the prompt; defaults to `prompt`. */
  spokenPrompt?: string;
  /** Read aloud with the statement; defaults to `statement`. */
  spokenStatement?: string;
  /** Said after a miss when the player picked this wrong answer, before the statement. */
  wrongLines?: Readonly<Record<string, string>>;
  visual?: FactVisual;
}

/** Returns up to `count` plausible wrong answers for a fact. */
export type DistractorFn = (fact: Fact, count: number, random: Random) => string[];

/** A set of facts the player picks before choosing a game. */
export interface Topic {
  /** Lowercase kebab-case; used in URLs and saved progress. */
  id: string;
  title: string;
  /** Menu heading the topic is grouped under, e.g. 'Addition'. */
  subject: string;
  description: string;
  facts: Fact[];
  /** Wrong answers for a fact; defaults to other answers from the same topic. */
  distractors?: DistractorFn;
}
