/**
 * Blocks of keys to type: letter groups at first, then words, with capitals, numbers and symbols
 * mixed in as their levels open. Pure.
 */
import type { Random } from '../random';
import { freshChars, knownChars, levelOf, SHIFT_LEVEL, skillOf, type SkillId } from './course';
import { WORDS } from './words';

/** Words mode starts once this many list words use only the known letters. */
export const WORDS_FROM = 15;
/** The share of draws taken from the fresh chars. */
export const FRESH_SHARE = 0.5;
/** The longest run of letters without a space in letter groups. */
export const MAX_GROUP = 4;
/** The keys of a test-out block. */
export const TEST_KEYS = 30;

export type BlockTarget = 'wave' | 'kicker' | 'mega-ramp' | 'gate';

/** Keys in a block, by level kind and what the block is for. */
export const BLOCK_KEYS: Record<'keys' | 'speed', Record<BlockTarget, number>> = {
  keys: { wave: 3, kicker: 5, 'mega-ramp': 8, gate: 6 },
  speed: { wave: 8, kicker: 12, 'mega-ramp': 16, gate: 10 },
};

/** The chars a block may use: all it can type, and which of those are new. */
export interface CharSet {
  known: string[];
  fresh: string[];
}

const wordsCache = new Map<string, string[]>();

/** The words whose letters are all in `known` (remembered: every block asks). */
export function wordsIn(known: readonly string[]): string[] {
  const key = known.join('');
  let words = wordsCache.get(key);
  if (!words) {
    const letters = new Set(known);
    words = WORDS.filter((word) => [...word].every((c) => letters.has(c)));
    wordsCache.set(key, words);
  }
  return words;
}

/** The words typeable by level n. */
export function wordsFor(n: number): string[] {
  return wordsIn(knownChars(n));
}

export interface PlanOptions {
  level: number;
  length: number;
  random: Random;
  /** The player's saved first-try history per skill (`TypingProgress.keys`): misses weigh more. */
  history?: Record<SkillId, string>;
  /** Overrides the level's chars (the lesson's mix uses it). */
  chars?: CharSet;
}

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isSymbol = (c: string): boolean => c !== ' ' && !isDigit(c) && !/[a-zA-Z]/.test(c);

function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)];
}

function missRate(history: string | undefined): number {
  if (!history) return 0;
  let misses = 0;
  for (const c of history) if (c === '0') misses++;
  return misses / history.length;
}

function pickWeighted(items: readonly string[], weight: (c: string) => number, random: Random) {
  const total = items.reduce((sum, c) => sum + weight(c), 0);
  let r = random() * total;
  for (const c of items) {
    r -= weight(c);
    if (r < 0) return c;
  }
  return items[items.length - 1];
}

function groupBlock(set: CharSet, o: PlanOptions): string {
  const { length, random } = o;
  const spaceKnown = set.known.includes(' ');
  const weight = (c: string) => 1 + 4 * missRate(o.history?.[skillOf(c)]);
  const stale = set.known.filter((c) => !set.fresh.includes(c));
  const out: string[] = [];
  let run = 0;
  for (let pos = 0; pos < length; pos++) {
    const prev = out[pos - 1];
    const spaceAllowed = spaceKnown && pos > 0 && pos < length - 1 && prev !== ' ';
    // A run that has reached MAX_GROUP needs its space now; one step early when the next
    // position is the last (it can't be a space).
    const forced =
      spaceKnown &&
      pos > 0 &&
      prev !== ' ' &&
      (run >= MAX_GROUP || (pos === length - 2 && run >= MAX_GROUP - 1));
    let char: string;
    if (forced && spaceAllowed) {
      char = ' ';
    } else {
      const allowed = (c: string) =>
        (c !== ' ' || spaceAllowed) && !(out[pos - 1] === c && out[pos - 2] === c);
      const fresh = set.fresh.filter(allowed);
      const others = stale.filter(allowed);
      const known = set.known.filter(allowed);
      if (fresh.length > 0 && (random() < FRESH_SHARE || others.length === 0)) {
        char = pick(fresh, random);
      } else {
        const from = others.length > 0 ? others : known.length > 0 ? known : set.known;
        char = pickWeighted(from, weight, random);
      }
    }
    out.push(char);
    run = char === ' ' ? 0 : run + 1;
  }
  return out.join('');
}

interface Token {
  text: string;
  /** What follows the token: a space, or a symbol that takes the space's place. */
  after: string;
}

const AFTER = '.,;:!?\'"%';
const BEFORE = '$#@';
const WRAP: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
const WRAP_CLOSE = ')]}>';
const CONNECT = '-=_+*&^\\|`~/';

function decorate(token: Token, symbol: string, known: ReadonlySet<string>): Token {
  if (AFTER.includes(symbol)) return { ...token, text: token.text + symbol };
  if (BEFORE.includes(symbol)) return { ...token, text: symbol + token.text };
  if (CONNECT.includes(symbol)) return { ...token, after: symbol };
  const open = WRAP_CLOSE.includes(symbol)
    ? Object.keys(WRAP).find((k) => WRAP[k] === symbol)!
    : symbol;
  const close = WRAP[open];
  if (known.has(open) && known.has(close)) {
    return { ...token, text: open + token.text + close };
  }
  return WRAP_CLOSE.includes(symbol)
    ? { ...token, text: token.text + symbol }
    : { ...token, text: symbol + token.text };
}

function wordsBlock(set: CharSet, o: PlanOptions): string {
  const { level, length, random } = o;
  const speed = levelOf(level).kind === 'speed';
  const known = new Set(set.known);
  const pool = wordsIn(set.known);
  const freshWords =
    set.fresh.length > 0 ? pool.filter((w) => [...w].some((c) => set.fresh.includes(c))) : [];
  const digits = set.known.filter(isDigit);
  const freshDigits = set.fresh.filter(isDigit);
  const symbols = set.known.filter(isSymbol);
  const freshSymbols = set.fresh.filter(isSymbol);
  const canCapital = (word: string) => known.has(word[0].toUpperCase());
  const pCapital = speed ? 0.15 : level === SHIFT_LEVEL ? 0.5 : level > SHIFT_LEVEL ? 0.3 : 0;
  const pNumber = speed ? 0.1 : level >= 18 ? 0.3 : 0;
  const pSymbol = speed ? 0.1 : level >= 17 ? 0.25 : 0;

  const digit = () =>
    freshDigits.length > 0 && random() < FRESH_SHARE
      ? pick(freshDigits, random)
      : pick(digits, random);

  const token = (): Token => {
    let text: string;
    if (digits.length > 0 && random() < pNumber) {
      text = Array.from({ length: 1 + Math.floor(random() * 3) }, digit).join('');
    } else {
      text = pick(freshWords.length > 0 && random() < FRESH_SHARE ? freshWords : pool, random);
      if (random() < pCapital && canCapital(text)) text = text[0].toUpperCase() + text.slice(1);
    }
    let result: Token = { text, after: ' ' };
    if (symbols.length > 0 && random() < pSymbol) {
      const symbol =
        freshSymbols.length > 0 && random() < 0.5
          ? pick(freshSymbols, random)
          : pick(symbols, random);
      result = decorate(result, symbol, known);
    }
    return result;
  };

  const build = (): string => {
    const tokens: Token[] = [];
    let text = '';
    while (text.length < length - 1) {
      const next = token();
      tokens.push(next);
      text = tokens.map((t, i) => t.text + (i < tokens.length - 1 ? t.after : '')).join('');
    }
    return text;
  };

  let text = build();
  for (let tries = 1; tries < 20 && text.length > length + 3; tries++) text = build();
  return text;
}

/** One block of keys to type: `length` chars in letter groups, about that many in words. */
export function planBlock(o: PlanOptions): string {
  const set = o.chars ?? { known: knownChars(o.level), fresh: freshChars(o.level) };
  const wordsMode = levelOf(o.level).kind === 'speed' || wordsIn(set.known).length >= WORDS_FROM;
  return wordsMode ? wordsBlock(set, o) : groupBlock(set, o);
}
