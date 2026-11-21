/**
 * The keys of one chunk (a block of letters or a word, closing space added by `targetText`), shared by the
 * typing games that put a block of keys over a target (Typo Troopers, Type Brawl). No DOM, no three.js.
 */
import type { Random } from '../random';
import { planBlock, wordsFor, WORDS_FROM } from './blocks';
import { freshChars, knownChars, levelOf, type SkillId } from './course';

/** A chunk of this many keys (the UFO's) plans a longer, phrase-like block. */
export const ufoKeys = 8;

/** Tries at a first char that no other target on screen starts with. */
const AVOID_TRIES = 6;
const WORD_TRIES = 8;

const without = (chars: string[], char: string): string[] => chars.filter((c) => c !== char);

/** Words mode (whole words as chunks): a speed level, or a level with enough words to type. Planning blocks uses the same test. */
export function chunkWordsMode(level: number): boolean {
  return levelOf(level).kind === 'speed' || wordsFor(level).length >= WORDS_FROM;
}

export interface ChunkOptions {
  level: number;
  /** Letters before the ␣ (`CHUNK_KEYS`); the UFO's 8 plans a longer, phrase-like chunk. */
  keys: number;
  random: Random;
  /** The player's saved first-try history per skill: misses weigh more. */
  history?: Record<SkillId, string>;
  /** First chars of the other targets: the chunk tries not to start with one of them. */
  avoid?: readonly string[];
}

/**
 * The keys of one invader's chunk, without its closing ␣. Letters mode: `keys` letters. Words mode:
 * one word near `keys` long (2 to 8 on a speed level). The UFO (`keys` 8) gets a block of 8 that may
 * hold inner spaces. The first char tries not to be one of `avoid`.
 */
export function planChunk(o: ChunkOptions): string {
  const { level, keys, random, history } = o;
  const avoid = o.avoid ?? [];
  const free = (text: string) => text.length > 0 && !avoid.includes(text[0]);

  if (keys >= ufoKeys) {
    let text = '';
    for (let i = 0; i < AVOID_TRIES; i++) {
      text = planBlock({ level, length: ufoKeys, random, history }).trim();
      if (free(text)) break;
    }
    return text;
  }

  if (!chunkWordsMode(level)) {
    const chars = {
      known: without(knownChars(level), ' '),
      fresh: without(freshChars(level), ' '),
    };
    let text = '';
    for (let i = 0; i < AVOID_TRIES; i++) {
      text = planBlock({ level, length: keys, random, history, chars });
      if (free(text)) break;
    }
    return text;
  }

  const speed = levelOf(level).kind === 'speed';
  const low = speed ? 2 : keys;
  const high = speed ? 8 : keys + 2;
  const inRange: string[] = [];
  let nearest = '';
  for (let i = 0; i < WORD_TRIES; i++) {
    const tokens = planBlock({ level, length: 24, random, history })
      .split(' ')
      .filter((t) => t.length > 0);
    for (const token of tokens) {
      if (Math.abs(token.length - keys) < Math.abs(nearest.length - keys) || nearest === '') {
        nearest = token;
      }
    }
    const fits = tokens.filter((t) => t.length >= low && t.length <= high);
    inRange.push(...fits);
    const wanted = fits.filter(free);
    if (wanted.length > 0) return wanted[Math.floor(random() * wanted.length)];
  }
  if (inRange.length > 0) return inRange[Math.floor(random() * inRange.length)];
  return nearest;
}

/** What is typed for a chunk: the chunk and its closing space bar. */
export const targetText = (chunk: string): string => chunk + ' ';
