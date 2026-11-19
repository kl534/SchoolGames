/**
 * The typing course: 40 levels (28 of keys, two at a time, then 12 of speed) and what each one
 * can type. Pure.
 */
import { fingerOf, isLeftFinger } from './keyboard-layout';

/** A char (`f`, ` `, `!`) or `shift-left` / `shift-right`. */
export type SkillId = string;

export interface TypingLevel {
  /** 1-based. */
  n: number;
  kind: 'keys' | 'speed';
  /** `f j`, `Shift`, `20 wpm`. */
  title: string;
  /** New skills (none for speed). */
  skills: SkillId[];
  /** Speed levels only. */
  wpm?: number;
}

/** The new skills of levels 1 to 28. */
const KEY_SETS: string[][] = [
  ['f', 'j', ' '],
  ['d', 'k'],
  ['s', 'l'],
  ['a', ';'],
  ['g', 'h'],
  ['e', 'i'],
  ['r', 'u'],
  ['t', 'y'],
  ['w', 'o'],
  ['q', 'p'],
  ['v', 'm'],
  ['c', ','],
  ['x', '.'],
  ['z', '/'],
  ['b', 'n'],
  ['shift-right', 'shift-left'],
  ["'", '?', '"'],
  ['4', '7'],
  ['3', '8'],
  ['2', '9'],
  ['1', '0'],
  ['5', '6'],
  ['!', '@', '#', '$', '%'],
  ['^', '&', '*', '(', ')'],
  ['-', '=', '_', '+'],
  ['[', ']', '{', '}'],
  [':', '<', '>'],
  ['\\', '|', '`', '~'],
];

export const SPEED_WPM = [10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];
export const KEY_LEVELS = KEY_SETS.length;

export const TYPING_LEVELS: TypingLevel[] = [
  ...KEY_SETS.map((skills, i): TypingLevel => {
    const title = skills[0].startsWith('shift')
      ? 'Shift'
      : skills.filter((s) => s !== ' ').join(' ');
    return { n: i + 1, kind: 'keys', title, skills };
  }),
  ...SPEED_WPM.map((wpm, i): TypingLevel => ({
    n: KEY_LEVELS + i + 1,
    kind: 'speed',
    title: `${wpm} wpm`,
    skills: [],
    wpm,
  })),
];

export const LEVEL_COUNT = TYPING_LEVELS.length;
/** The level that adds Shift, and from which capitals are typeable. */
export const SHIFT_LEVEL = 16;
/** Skills in the 28 key levels. */
export const TOTAL_SKILLS = KEY_SETS.reduce((sum, set) => sum + set.length, 0);

export function levelOf(n: number): TypingLevel {
  const level = TYPING_LEVELS[n - 1];
  if (!level) throw new Error(`No typing level ${n}`);
  return level;
}

/** Points are multiplied by this on level n, so a low level can't chase a high-level score. */
export const multiplier = (n: number): number => n * n;

/** The skill a char belongs to: a capital is a Shift skill (the Shift of the other hand), else itself. */
export function skillOf(char: string): SkillId {
  if (char >= 'A' && char <= 'Z') {
    return isLeftFinger(fingerOf(char)) ? 'shift-right' : 'shift-left';
  }
  return char;
}

const ALL_CHARS: string[] = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));
const UPPER = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const isChar = (skill: SkillId): boolean => skill.length === 1;

/** Every char typeable by level n: the char skills of levels up to n and, from 16, the capitals. For speed levels, all 95. */
export function knownChars(n: number): string[] {
  const cached = KNOWN.get(n);
  if (cached) return [...cached];
  const chars = computeKnown(n);
  KNOWN.set(n, chars);
  return [...chars];
}

const KNOWN = new Map<number, string[]>();

function computeKnown(n: number): string[] {
  if (levelOf(n).kind === 'speed') return [...ALL_CHARS];
  const chars = TYPING_LEVELS.slice(0, n).flatMap((l) => l.skills.filter(isChar));
  if (n >= SHIFT_LEVEL) {
    const known = new Set(chars);
    chars.push(...UPPER.filter((c) => known.has(c.toLowerCase())));
  }
  return chars;
}

/** The chars of level n's own skills: the capitals for level 16, none for speed. */
export function freshChars(n: number): string[] {
  const level = levelOf(n);
  if (level.kind === 'speed') return [];
  if (n === SHIFT_LEVEL) return UPPER.filter((c) => knownChars(n).includes(c));
  return level.skills.filter(isChar);
}

/** The chars one skill covers: itself, or for a Shift skill the capitals of that hand's keys. */
export function charsOfSkill(skill: SkillId): string[] {
  return isChar(skill) ? [skill] : UPPER.filter((c) => skillOf(c) === skill);
}
