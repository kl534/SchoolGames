import { describe, expect, it } from 'vitest';
import {
  BLOCK_KEYS,
  FRESH_SHARE,
  MAX_GROUP,
  planBlock,
  TEST_KEYS,
  WORDS_FROM,
  wordsFor,
} from '../src/shared/typing/blocks';
import {
  charsOfSkill,
  freshChars,
  knownChars,
  levelOf,
  multiplier,
  skillOf,
  TOTAL_SKILLS,
  TYPING_LEVELS,
} from '../src/shared/typing/course';
import {
  baseOf,
  fingerOf,
  FINGERS,
  HOME,
  KEYS,
  keyFor,
  needsShift,
  NON_TYPING,
  shiftFor,
  shiftKeyFor,
} from '../src/shared/typing/keyboard-layout';
import {
  ALL_SKILLS,
  HOME_REST_LINE,
  HOME_ROW_LINE,
  lessonLine,
  MIX_LINE,
  multiplierLine,
  NEW_KEYS,
  READY_LINE,
  speedLine,
  TEST_FAIL,
  TEST_PASS,
  TYPING_VOICE_LINES,
  YOUR_TURN,
} from '../src/shared/typing/lines';
import {
  clockFor,
  emptyTyping,
  HISTORY,
  learnedCount,
  levelPassed,
  levelUp,
  nextSpk,
  normalizeTyping,
  openLevel,
  recordPress,
  skillLearned,
  SPK_MAX,
  SPK_MIN,
  TOTAL_LEARNABLE,
  wpm,
} from '../src/shared/typing/progress';
import { seededRandom } from '../src/shared/random';
import { WORDS } from '../src/shared/typing/words';
import { normalizeProgress } from '../src/shared/progress';
import { runs } from './helpers/full';

const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));

describe('the course', () => {
  it('has 40 levels: 28 of keys and 12 of speed', () => {
    expect(TYPING_LEVELS).toHaveLength(40);
    expect(TYPING_LEVELS.filter((l) => l.kind === 'keys')).toHaveLength(28);
    const speed = TYPING_LEVELS.filter((l) => l.kind === 'speed');
    expect(speed.map((l) => l.wpm)).toEqual([10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(speed.map((l) => l.title)).toContain('20 wpm');
    TYPING_LEVELS.forEach((l, i) => expect(l.n).toBe(i + 1));
  });

  it('opens with f j and the space bar, then pairs', () => {
    expect(levelOf(1).skills).toEqual(['f', 'j', ' ']);
    expect(levelOf(1).title).toBe('f j');
    expect(levelOf(2).skills).toEqual(['d', 'k']);
    expect(levelOf(16).title).toBe('Shift');
    expect(levelOf(28).skills).toEqual(['\\', '|', '`', '~']);
    expect(Math.max(...TYPING_LEVELS.map((l) => l.skills.length))).toBeLessThanOrEqual(5);
  });

  it('makes every printable ASCII char typeable by level 28, each char skill in one level', () => {
    expect([...knownChars(28)].sort()).toEqual([...ASCII].sort());
    const skills = TYPING_LEVELS.flatMap((l) => l.skills);
    expect(new Set(skills).size).toBe(skills.length);
    const charSkills = skills.filter((s) => s.length === 1);
    expect(charSkills).toHaveLength(69);
    expect(TOTAL_SKILLS).toBe(71);
    expect(knownChars(40)).toHaveLength(95);
    expect(freshChars(40)).toEqual([]);
  });

  it('knows capitals from level 16', () => {
    expect(knownChars(15).some((c) => c >= 'A' && c <= 'Z')).toBe(false);
    expect(knownChars(16)).toContain('Q');
    expect(freshChars(16)).toHaveLength(26);
    expect(freshChars(7)).toEqual(['r', 'u']);
  });

  it('puts a capital on the Shift of the other hand', () => {
    expect(skillOf('F')).toBe('shift-right');
    expect(skillOf('J')).toBe('shift-left');
    expect(skillOf('f')).toBe('f');
    expect(skillOf('!')).toBe('!');
    expect(charsOfSkill('shift-left')).toContain('J');
    expect(charsOfSkill('shift-left')).not.toContain('F');
    expect(charsOfSkill('!')).toEqual(['!']);
  });

  it('multiplies by the level squared', () => {
    expect(multiplier(1)).toBe(1);
    expect(multiplier(7)).toBe(49);
    expect(multiplier(40)).toBe(1600);
  });
});

describe('fingers and the keyboard', () => {
  it('gives every printable char a finger and a key', () => {
    for (const c of ASCII) {
      expect(fingerOf(c)).toBeTruthy();
      expect(keyFor(c).id).toBe(c === ' ' ? 'space' : baseOf(c));
    }
  });

  it('uses the standard finger map', () => {
    expect(fingerOf('f')).toBe('li');
    expect(fingerOf('g')).toBe('li');
    expect(fingerOf('h')).toBe('ri');
    expect(fingerOf('r')).toBe('li');
    expect(fingerOf('9')).toBe('rr');
    expect(fingerOf('p')).toBe('rp');
    expect(fingerOf('/')).toBe('rp');
    expect(fingerOf('`')).toBe('lp');
    expect(fingerOf(' ')).toBe('th');
    expect(fingerOf('R')).toBe('li');
    expect(fingerOf('?')).toBe('rp');
    for (const finger of FINGERS) expect(fingerOf(HOME[finger])).toBe(finger);
  });

  it('lights the opposite Shift for a shifted char', () => {
    expect(needsShift('F')).toBe(true);
    expect(needsShift('f')).toBe(false);
    expect(shiftFor('F')).toBe('right');
    expect(shiftFor('J')).toBe('left');
    expect(shiftFor('!')).toBe('right');
    expect(shiftFor('"')).toBe('left');
    expect(shiftFor(':')).toBe('left');
    expect(shiftKeyFor('F')?.id).toBe('shift-right');
    expect(shiftKeyFor('f')).toBeNull();
    for (const c of ASCII.filter(needsShift)) {
      expect(shiftKeyFor(c)?.id).toBe(`shift-${shiftFor(c)}`);
    }
  });

  it('maps shifted symbols to their base key', () => {
    const base: Record<string, string> = {
      '!': '1',
      '"': "'",
      '?': '/',
      ':': ';',
      '<': ',',
      '>': '.',
      '{': '[',
      '}': ']',
      '|': '\\',
      '~': '`',
      _: '-',
      '+': '=',
      '@': '2',
      ')': '0',
    };
    for (const [shifted, key] of Object.entries(base)) expect(baseOf(shifted)).toBe(key);
  });

  it('lays out four full rows of 15 units and a space row, without overlaps', () => {
    for (let y = 0; y < 4; y++) {
      const row = KEYS.filter((k) => k.y === y).sort((a, b) => a.x - b.x);
      expect(row[0].x).toBe(0);
      row.forEach((k, i) => {
        if (i > 0) expect(k.x).toBeCloseTo(row[i - 1].x + row[i - 1].w, 5);
      });
      const last = row[row.length - 1];
      expect(last.x + last.w).toBeCloseTo(15, 5);
    }
    const bottom = KEYS.filter((k) => k.y === 4).sort((a, b) => a.x - b.x);
    bottom.forEach((k, i) => {
      if (i > 0) expect(k.x).toBeCloseTo(bottom[i - 1].x + bottom[i - 1].w, 5);
    });
    const space = KEYS.find((k) => k.id === 'space')!;
    expect(space.x).toBe(3.75);
    expect(space.w).toBe(6.25);
    expect(new Set(KEYS.map((k) => k.id)).size).toBe(KEYS.length);
  });

  it('draws Tab, Caps, Enter and Backspace as non-typing keys', () => {
    for (const id of ['tab', 'caps', 'enter', 'backspace']) expect(NON_TYPING.has(id)).toBe(true);
    for (const c of ASCII) expect(NON_TYPING.has(keyFor(c).id)).toBe(false);
  });
});

describe('spoken lines', () => {
  it('writes each finger line as the table says', () => {
    expect(lessonLine(' ')).toBe('Thumb. Tap the space bar.');
    expect(lessonLine('f')).toBe('Left pointer finger. Press F.');
    expect(lessonLine('j')).toBe('Right pointer finger. Press J.');
    expect(lessonLine(';')).toBe('Right pinky. Press the semicolon.');
    expect(lessonLine('g')).toBe('Left pointer finger. Reach over to G.');
    expect(lessonLine("'")).toBe('Right pinky. Reach over to the apostrophe.');
    expect(lessonLine('e')).toBe('Left middle finger. Reach up to E.');
    expect(lessonLine('t')).toBe('Left pointer finger. Reach up and over to T.');
    expect(lessonLine('[')).toBe('Right pinky. Reach up and over to the left square bracket.');
    expect(lessonLine('z')).toBe('Left pinky. Reach down to Z.');
    expect(lessonLine('b')).toBe('Left pointer finger. Reach down and over to B.');
    expect(lessonLine('4')).toBe('Left pointer finger. Reach way up to 4.');
    expect(lessonLine('5')).toBe('Left pointer finger. Reach way up and over to 5.');
    expect(lessonLine('-')).toBe('Right pinky. Reach way up and over to the dash.');
    expect(lessonLine('`')).toBe('Left pinky. Reach way up and over to the backtick.');
    expect(lessonLine('\\')).toBe('Right pinky. Reach way over to the backslash.');
    expect(lessonLine('?')).toBe(
      'Hold Shift with your left pinky. Then press the slash for the question mark.',
    );
    expect(lessonLine('!')).toBe(
      'Hold Shift with your right pinky. Then press 1 for the exclamation mark.',
    );
    expect(lessonLine('shift-right')).toBe(
      'For a left hand capital, hold Shift with your right pinky.',
    );
    expect(lessonLine('shift-left')).toBe(
      'For a right hand capital, hold Shift with your left pinky.',
    );
  });

  it('ends a letter line on the letter and never has a lone A in the middle', () => {
    for (const skill of ALL_SKILLS) {
      const line = lessonLine(skill);
      if (/^[a-z]$/.test(skill)) expect(line).toMatch(/[A-Z]\.$/);
      expect(line).not.toMatch(/ A /);
    }
  });

  it('has 71 distinct lesson lines', () => {
    expect(ALL_SKILLS).toHaveLength(71);
    expect(new Set(ALL_SKILLS.map(lessonLine)).size).toBe(71);
  });

  it('speaks only the finger explanations', () => {
    expect(new Set(TYPING_VOICE_LINES).size).toBe(TYPING_VOICE_LINES.length);
    expect(TYPING_VOICE_LINES).toHaveLength(73);
    expect(TYPING_VOICE_LINES).toContain(HOME_ROW_LINE);
    expect(TYPING_VOICE_LINES).toContain(HOME_REST_LINE);
    for (const skill of ALL_SKILLS) expect(TYPING_VOICE_LINES).toContain(lessonLine(skill));
    // Everything else is on-screen text only.
    const silent = [YOUR_TURN, MIX_LINE, READY_LINE, NEW_KEYS, TEST_PASS, TEST_FAIL];
    for (let n = 2; n <= 40; n++) silent.push(multiplierLine(n));
    for (const wpm of [10, 20, 100]) silent.push(speedLine(wpm));
    for (const line of silent) expect(TYPING_VOICE_LINES).not.toContain(line);
  });

  it('words the fixed lines', () => {
    expect(multiplierLine(7)).toBe('Level 7 scores 49 times the points!');
    expect(speedLine(30)).toBe('Speed level! Type 30 words a minute.');
  });
});

describe('words', () => {
  it('has 300 or more unique lowercase words of 2 to 7 letters', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(300);
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const word of WORDS) expect(word).toMatch(/^[a-z]{2,7}$/);
    for (const word of 'as is if he she has had said like side fish dish kids lake hide'.split(
      ' ',
    )) {
      expect(WORDS).toContain(word);
    }
  });

  it('starts words mode at level 6', () => {
    expect(wordsFor(5).length).toBeLessThan(WORDS_FROM);
    expect(wordsFor(6).length).toBeGreaterThanOrEqual(WORDS_FROM);
    for (const word of wordsFor(6)) expect(word).toMatch(/^[fjdkslaghei]+$/);
  });
});

describe('planBlock', () => {
  const lengths = [
    ...new Set([
      ...Object.values(BLOCK_KEYS.keys),
      ...Object.values(BLOCK_KEYS.speed),
      TEST_KEYS,
      1,
      2,
      4,
    ]),
  ];

  it('only uses known chars, with no stray spaces, and the right length', () => {
    const random = seededRandom(11);
    for (let n = 1; n <= 40; n++) {
      const known = new Set(knownChars(n));
      const words = wordsFor(n).length >= WORDS_FROM || levelOf(n).kind === 'speed';
      for (const length of lengths) {
        if (length < 3 && words) continue;
        for (let i = 0; i < runs(25, 6); i++) {
          const text = planBlock({ level: n, length, random });
          expect(text.length).toBeGreaterThan(0);
          for (const c of text) expect(known.has(c)).toBe(true);
          expect(text).not.toMatch(/^ | $| {2}/);
          if (words) {
            expect(text.length).toBeGreaterThanOrEqual(length - 1);
            expect(text.length).toBeLessThanOrEqual(length + 3);
          } else {
            expect(text).toHaveLength(length);
            expect(text).not.toMatch(/(.)\1\1/);
            for (const group of text.split(' ')) {
              expect(group.length).toBeLessThanOrEqual(MAX_GROUP);
            }
          }
        }
      }
    }
  }, 60_000);

  it('draws about half of a group block from the new keys', () => {
    const random = seededRandom(5);
    for (const level of [3, 5]) {
      const fresh = new Set(freshChars(level));
      let hits = 0;
      let total = 0;
      for (let i = 0; i < 400; i++) {
        for (const c of planBlock({ level, length: 8, random })) {
          total++;
          if (fresh.has(c)) hits++;
        }
      }
      expect(hits / total).toBeGreaterThan(0.35);
      expect(hits / total).toBeLessThan(0.65);
    }
    expect(FRESH_SHARE).toBe(0.5);
  });

  it('puts a space in a fifth of the first level blocks', () => {
    const random = seededRandom(3);
    let spaced = 0;
    for (let i = 0; i < 400; i++) {
      if (planBlock({ level: 1, length: 5, random }).includes(' ')) spaced++;
    }
    expect(spaced / 400).toBeGreaterThanOrEqual(0.2);
  });

  it('asks for missed keys more often', () => {
    const random = seededRandom(9);
    const history = { d: '0000000000', k: '1111111111' };
    let d = 0;
    let k = 0;
    // Level 4: d and k are old keys, drawn by their weight.
    for (let i = 0; i < 400; i++) {
      for (const c of planBlock({ level: 4, length: 8, random, history })) {
        if (c === 'd') d++;
        if (c === 'k') k++;
      }
    }
    expect(d).toBeGreaterThan(k * 2);
  });

  it('puts capitals, numbers and symbols into words as their levels open', () => {
    const random = seededRandom(21);
    const text = (level: number) =>
      Array.from({ length: 200 }, () => planBlock({ level, length: 12, random })).join(' ');
    expect(text(15)).not.toMatch(/[A-Z0-9]/);
    expect(text(16)).toMatch(/[A-Z]/);
    expect(text(17)).toMatch(/[?"']/);
    expect(text(18)).toMatch(/[47]/);
    expect(text(18)).not.toMatch(/[1235689]/);
    expect(text(23)).toMatch(/[!@#$%]/);
    expect(text(25)).toMatch(/[-=_+]/);
    expect(text(26)).toMatch(/[[\]{}]/);
    expect(text(35)).toMatch(/[A-Z]/);
  });

  it('can be told which chars to use', () => {
    const random = seededRandom(2);
    for (let i = 0; i < 50; i++) {
      const text = planBlock({
        level: 1,
        length: 10,
        random,
        chars: { known: ['f', 'j'], fresh: ['j'] },
      });
      expect(text).toMatch(/^[fj]{10}$/);
    }
  });
});

describe('key stats', () => {
  it('keeps the last 20 presses of a skill, under its Shift skill for a capital', () => {
    const tp = emptyTyping();
    for (let i = 0; i < 30; i++) recordPress(tp, 'f', i % 2 === 0);
    expect(tp.keys.f).toHaveLength(HISTORY);
    expect(tp.keys.f.endsWith('10')).toBe(true);
    recordPress(tp, 'F', false);
    expect(tp.keys['shift-right']).toBe('0');
    expect(tp.keys.F).toBeUndefined();
  });

  it('learns a key at 18 right in the last 20, not 17', () => {
    const tp = emptyTyping();
    tp.keys.f = '1'.repeat(17) + '000';
    expect(skillLearned(tp, 'f')).toBe(false);
    tp.keys.f = '1'.repeat(18) + '00';
    expect(skillLearned(tp, 'f')).toBe(true);
    tp.keys.f = '0'.repeat(10) + '1'.repeat(10);
    expect(skillLearned(tp, 'f')).toBe(false);
    expect(skillLearned(tp, 'j')).toBe(false);
  });

  it('passes a key level when every new skill is learned', () => {
    const tp = emptyTyping();
    expect(levelPassed(tp, 2)).toBe(false);
    tp.keys.d = '1'.repeat(20);
    expect(levelPassed(tp, 2)).toBe(false);
    tp.keys.k = '1'.repeat(19) + '0';
    expect(levelPassed(tp, 2)).toBe(true);
    expect(levelPassed(tp, 29)).toBe(false);
  });

  it('opens a level and never closes one', () => {
    const tp = emptyTyping();
    openLevel(tp, 5);
    openLevel(tp, 3);
    expect(tp.open).toBe(5);
    openLevel(tp, 99);
    expect(tp.open).toBe(40);
  });

  it('slows the clock a little when a level opens by passing', () => {
    const tp = emptyTyping();
    tp.spk = 1;
    expect(levelUp(tp)).toBe(2);
    expect(tp.spk).toBeCloseTo(1.25, 5);
    tp.spk = 2.4;
    levelUp(tp);
    expect(tp.spk).toBe(SPK_MAX);
    tp.open = 40;
    expect(levelUp(tp)).toBeNull();
  });

  it('counts skills learned for the menu', () => {
    const tp = emptyTyping();
    expect(learnedCount(tp)).toBe(0);
    tp.keys.f = '1'.repeat(20);
    expect(learnedCount(tp)).toBe(1);
    tp.open = 3;
    expect(learnedCount(tp)).toBe(3 + 2);
    tp.open = 29;
    expect(learnedCount(tp)).toBe(71);
    tp.open = 40;
    expect(learnedCount(tp)).toBe(71 + 11);
    expect(TOTAL_LEARNABLE).toBe(83);
  });

  it('moves seconds per key and keeps it in range', () => {
    expect(nextSpk(2, 'perfect')).toBeCloseTo(1.9, 5);
    expect(nextSpk(2, 'timeout')).toBeCloseTo(2.2, 5);
    expect(nextSpk(2, 'mistakes')).toBe(2);
    expect(nextSpk(0.26, 'perfect')).toBe(SPK_MIN);
    expect(nextSpk(2.4, 'timeout')).toBe(SPK_MAX);
  });

  it('works out the clock and the speed', () => {
    expect(clockFor(1, 5, 2)).toBeCloseTo(11.5, 5);
    expect(clockFor(3, 3, 1)).toBeCloseTo(4.5, 5);
    // 20 wpm is 100 keys a minute: 12 / 20 = 0.6 s a key.
    expect(clockFor(31, 10, 2)).toBeCloseTo(10 * 0.6 + 0.5, 5);
    expect(wpm(50, 60)).toBe(10);
    expect(wpm(30, 30)).toBe(12);
  });
});

describe('normalizeTyping', () => {
  it('fills in a default', () => {
    expect(normalizeTyping(undefined)).toEqual(emptyTyping());
    expect(normalizeTyping('junk')).toEqual({
      open: 1,
      level: 1,
      lessons: [],
      keys: {},
      spk: 2,
      bestWpm: 0,
    });
  });

  it('clamps numbers and drops junk', () => {
    const tp = normalizeTyping({
      open: 99,
      level: -4,
      lessons: [3, 3, 1, 'x', 50, 0, 2.5],
      keys: { f: '1101', j: 'abc', d: 5, k: '1'.repeat(30) },
      spk: 9,
      bestWpm: 'fast',
    });
    expect(tp.open).toBe(40);
    expect(tp.level).toBe(1);
    expect(tp.lessons).toEqual([1, 3]);
    expect(tp.keys).toEqual({ f: '1101', k: '1'.repeat(20) });
    expect(tp.spk).toBe(SPK_MAX);
    expect(tp.bestWpm).toBe(0);
    expect(normalizeTyping({ spk: 0 }).spk).toBe(SPK_MIN);
  });

  it('is kept by normalizeProgress', () => {
    const progress = normalizeProgress({ typing: { open: 4, level: 2 } as never });
    expect(progress.typing?.open).toBe(4);
    expect(progress.typing?.spk).toBe(2);
    expect(normalizeProgress({}).typing).toBeUndefined();
  });
});
