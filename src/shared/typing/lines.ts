/**
 * The lesson's lines. Only the finger explanations (`HOME_ROW_LINE`, `HOME_REST_LINE` and the
 * `lessonLine` of each skill) are spoken. Every other line is on-screen text and must never be
 * passed to `speak()`. Pure; no DOM.
 *
 * Kokoro reads a lone "A" in the middle of a sentence as "uh", but a letter at the end of a
 * sentence as its name, so every letter name ends its sentence.
 */
import { TYPING_LEVELS, type SkillId } from './course';
import { baseOf, fingerOf, needsShift, shiftFor, type Finger } from './keyboard-layout';

export const HOME_ROW_LINE = 'Put your pointer fingers on F and J. Feel the little bumps.';
export const HOME_REST_LINE =
  'Rest your other fingers on the keys next to them, and your thumbs on the space bar.';
export const YOUR_TURN = 'Your turn!';
export const MIX_LINE = 'Now mix it up!';
export const READY_LINE = "You're ready! Let's ride!";
/** The prompt on the picker and the lesson's ready card: the space bar starts the game. */
export const SPACE_LINE = 'Press the space bar to ride!';
export const NEW_KEYS = 'New keys!';
export const TEST_PASS = 'You tested out!';
export const TEST_FAIL = 'Not yet. Keep practicing!';

export const multiplierLine = (n: number): string => `Level ${n} scores ${n * n} times the points!`;
export const speedLine = (wpm: number): string => `Speed level! Type ${wpm} words a minute.`;

const FINGER_NAME: Record<Exclude<Finger, 'th'>, string> = {
  lp: 'Left pinky',
  lr: 'Left ring finger',
  lm: 'Left middle finger',
  li: 'Left pointer finger',
  ri: 'Right pointer finger',
  rm: 'Right middle finger',
  rr: 'Right ring finger',
  rp: 'Right pinky',
};

const SYMBOL_NAME: Record<string, string> = {
  ';': 'the semicolon',
  ',': 'the comma',
  '.': 'the period',
  '/': 'the slash',
  "'": 'the apostrophe',
  '"': 'the quote mark',
  '?': 'the question mark',
  '!': 'the exclamation mark',
  '@': 'the at sign',
  '#': 'the number sign',
  $: 'the dollar sign',
  '%': 'the percent sign',
  '^': 'the caret',
  '&': 'the and sign',
  '*': 'the star',
  '(': 'the left bracket',
  ')': 'the right bracket',
  '[': 'the left square bracket',
  ']': 'the right square bracket',
  '{': 'the left curly bracket',
  '}': 'the right curly bracket',
  '-': 'the dash',
  '=': 'the equals sign',
  _: 'the underscore',
  '+': 'the plus sign',
  ':': 'the colon',
  '<': 'the less than sign',
  '>': 'the greater than sign',
  '\\': 'the backslash',
  '|': 'the straight bar',
  '`': 'the backtick',
  '~': 'the tilde',
};

/** How a key is named in a sentence: a letter is its capital, a digit itself, a symbol its name. */
export function keyName(char: string): string {
  if (char >= 'a' && char <= 'z') return char.toUpperCase();
  if (char >= '0' && char <= '9') return char;
  return SYMBOL_NAME[char];
}

const HOME_KEYS = 'asdfjkl;';

function move(char: string): string {
  if (HOME_KEYS.includes(char)) return 'Press';
  if ("gh'".includes(char)) return 'Reach over to';
  if (char === '\\') return 'Reach way over to';
  if ('56-=`'.includes(char)) return 'Reach way up and over to';
  if ('12347890'.includes(char)) return 'Reach way up to';
  if ('ty[]'.includes(char)) return 'Reach up and over to';
  if ('qweruiop'.includes(char)) return 'Reach up to';
  if ('bn'.includes(char)) return 'Reach down and over to';
  return 'Reach down to';
}

/** The explanation spoken for a skill. */
export function lessonLine(skill: SkillId): string {
  if (skill === ' ') return 'Thumb. Tap the space bar.';
  if (skill === 'shift-right') return 'For a left hand capital, hold Shift with your right pinky.';
  if (skill === 'shift-left') return 'For a right hand capital, hold Shift with your left pinky.';
  if (needsShift(skill)) {
    return `Hold Shift with your ${shiftFor(skill)} pinky. Then press ${keyName(baseOf(skill))} for ${keyName(skill)}.`;
  }
  const finger = fingerOf(skill) as Exclude<Finger, 'th'>;
  return `${FINGER_NAME[finger]}. ${move(skill)} ${keyName(skill)}.`;
}

/** Every skill of the 28 key levels, in course order. */
export const ALL_SKILLS: SkillId[] = TYPING_LEVELS.flatMap((level) => level.skills);

/** The lines the lesson speaks, and nothing else; `npm run voice` records them. */
export const TYPING_VOICE_LINES: string[] = [
  HOME_ROW_LINE,
  HOME_REST_LINE,
  ...ALL_SKILLS.map(lessonLine),
];
