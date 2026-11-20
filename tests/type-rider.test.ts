import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDev } from '../src/games/type-rider/dev';
import {
  accuracy,
  blockKeys,
  blockOutcome,
  blockTarget,
  emptyStats,
  resultsText,
  runWpm,
  speedBlockPasses,
  speedStreak,
} from '../src/games/type-rider/rules';
import { VOICE_LINES } from '../src/games/type-rider/voice';
import { BLOCK_KEYS } from '../src/shared/typing/blocks';
import { TYPING_LEVELS } from '../src/shared/typing/course';
import {
  HOME_REST_LINE,
  HOME_ROW_LINE,
  TYPING_VOICE_LINES,
  YOUR_TURN,
  MIX_LINE,
  READY_LINE,
  NEW_KEYS,
  TEST_PASS,
  TEST_FAIL,
  multiplierLine,
  speedLine,
} from '../src/shared/typing/lines';
import { SPEED_STREAK } from '../src/shared/typing/progress';

describe('parseDev', () => {
  it('has no hooks by default and ignores junk', () => {
    const dev = parseDev('');
    expect(dev).toMatchObject({
      level: null,
      start: false,
      lesson: false,
      block: null,
      typed: 0,
      wrong: false,
      spk: null,
      clock: null,
      levelup: false,
      hooked: false,
      tricks: [],
      mega: false,
    });
    const junk = parseDev('?level=0&typed=-2&spk=abc&clock=-1&block=%C3%A9&start=yes&lesson=0');
    expect(junk).toMatchObject({
      level: null,
      typed: 0,
      spk: null,
      clock: null,
      block: null,
      start: false,
      lesson: false,
    });
    expect(parseDev('?level=41').level).toBeNull();
    expect(parseDev('?level=2.5').level).toBeNull();
  });

  it('reads this game hooks', () => {
    const dev = parseDev(
      '?level=7&start=1&lesson=1&block=rfrj%20ur&typed=2&wrong=1&spk=1.2&clock=30&levelup=1',
    );
    expect(dev).toMatchObject({
      level: 7,
      start: true,
      lesson: true,
      block: 'rfrj ur',
      typed: 2,
      wrong: true,
      spk: 1.2,
      clock: 30,
      levelup: true,
      hooked: true,
    });
  });

  it('clamps spk and keeps the ride hooks', () => {
    expect(parseDev('?spk=0.01').spk).toBe(0.9);
    expect(parseDev('?spk=99').spk).toBe(2.5);
    const dev = parseDev('?skis=1&mega=1&world=lagoon&clock=0.3');
    expect(dev).toMatchObject({ skis: 1, mega: true, world: 'lagoon', clock: 0.3, hooked: true });
  });

  it('counts a ride hook or a typing hook alone as a hook, so nothing is saved', () => {
    for (const q of ['skis=2', 'lab=respawn', 'world=reef', 'level=3', 'start=1', 'block=ab']) {
      expect(parseDev(`?${q}`).hooked).toBe(true);
    }
    expect(parseDev('?topic=typing-level').hooked).toBe(false);
  });
});

describe('blockKeys', () => {
  it('is 3, 5, 8 and 6 keys on a key level', () => {
    expect(blockKeys(1, 'launcher', 1)).toBe(3);
    expect(blockKeys(7, 'launcher', 2)).toBe(5);
    expect(blockKeys(7, 'launcher', 3)).toBe(8);
    expect(blockKeys(7, 'gate', 1)).toBe(6);
  });

  it('is 8, 12, 16 and 10 keys on a speed level', () => {
    expect(blockKeys(29, 'launcher', 1)).toBe(8);
    expect(blockKeys(35, 'launcher', 2)).toBe(12);
    expect(blockKeys(40, 'launcher', 3)).toBe(16);
    expect(blockKeys(40, 'gate', 2)).toBe(10);
  });

  it('is the course table for every level, target and tier', () => {
    for (const level of TYPING_LEVELS) {
      for (const tier of [1, 2, 3] as const) {
        expect(blockKeys(level.n, 'launcher', tier)).toBe(
          BLOCK_KEYS[level.kind][blockTarget('launcher', tier)],
        );
        // The tier does not matter at a gate.
        expect(blockKeys(level.n, 'gate', tier)).toBe(BLOCK_KEYS[level.kind].gate);
      }
    }
  });

  it('maps tiers to the wave, the kicker and the mega ramp', () => {
    expect(blockTarget('launcher', 1)).toBe('wave');
    expect(blockTarget('launcher', 2)).toBe('kicker');
    expect(blockTarget('launcher', 3)).toBe('mega-ramp');
    expect(blockTarget('gate', 3)).toBe('gate');
  });
});

describe('blockOutcome', () => {
  it('is perfect with no mistakes and mistakes otherwise', () => {
    expect(blockOutcome(0)).toBe('perfect');
    expect(blockOutcome(1)).toBe('mistakes');
    expect(blockOutcome(5)).toBe('mistakes');
  });
});

describe('the speed streak', () => {
  // Level 31 is 20 wpm: 20 words of five keys a minute.
  const fast = { keys: 10, mistakes: 0, seconds: 5 }; // 24 wpm
  const slow = { keys: 10, mistakes: 0, seconds: 8 }; // 15 wpm
  const sloppy = { keys: 10, mistakes: 2, seconds: 5 }; // 24 wpm, 80% right

  it('passes a block at the goal speed with at least 90% right', () => {
    expect(TYPING_LEVELS[30].wpm).toBe(20);
    expect(speedBlockPasses(31, fast)).toBe(true);
    expect(speedBlockPasses(31, { keys: 10, mistakes: 1, seconds: 5 })).toBe(true);
    expect(speedBlockPasses(31, slow)).toBe(false);
    expect(speedBlockPasses(31, sloppy)).toBe(false);
    expect(speedBlockPasses(31, { keys: 10, mistakes: 0, seconds: 6 })).toBe(true);
    expect(speedBlockPasses(31, { keys: 10, mistakes: 0, seconds: 6.01 })).toBe(false);
  });

  it('never passes on a key level or with no time', () => {
    expect(speedBlockPasses(7, fast)).toBe(false);
    expect(speedBlockPasses(31, { keys: 10, mistakes: 0, seconds: 0 })).toBe(false);
  });

  it('counts blocks in a row and starts over on a slow block, a sloppy one or a time-out', () => {
    let streak = 0;
    streak = speedStreak(streak, 31, fast);
    streak = speedStreak(streak, 31, fast);
    expect(streak).toBe(2);
    expect(speedStreak(streak, 31, slow)).toBe(0);
    expect(speedStreak(streak, 31, sloppy)).toBe(0);
    expect(speedStreak(streak, 31, null)).toBe(0);
    streak = speedStreak(streak, 31, fast);
    expect(streak).toBe(SPEED_STREAK);
  });

  it('measures accuracy', () => {
    expect(accuracy({ keys: 10, mistakes: 1 })).toBeCloseTo(0.9);
    expect(accuracy({ keys: 0, mistakes: 0 })).toBe(1);
  });
});

describe('resultsText', () => {
  it('reads like the design: words a minute, percent right and the level opened', () => {
    const stats = { keys: 100, right: 94, fastKeys: 70, fastSeconds: 30 };
    expect(runWpm(stats)).toBeCloseTo(28);
    expect(resultsText(stats, [8])).toBe('28 words a minute · 94% right · Level 8 opened!');
  });

  it('names several opened levels and leaves out what it has nothing to say about', () => {
    const stats = { keys: 20, right: 20, fastKeys: 0, fastSeconds: 0 };
    expect(resultsText(stats, [8, 9, 10])).toBe('100% right · Levels 8 to 10 opened!');
    expect(resultsText(stats, [])).toBe('100% right');
    expect(resultsText(emptyStats(), [])).toBe('');
    expect(runWpm(emptyStats())).toBe(0);
  });
});

describe('voice', () => {
  it('speaks only the lesson lines', () => {
    expect(VOICE_LINES).toEqual(TYPING_VOICE_LINES);
    expect(VOICE_LINES).toContain(HOME_ROW_LINE);
    expect(VOICE_LINES).toContain(HOME_REST_LINE);
    expect(VOICE_LINES).toHaveLength(2 + 71);
    expect(new Set(VOICE_LINES).size).toBe(VOICE_LINES.length);
  });

  it('does not record the on-screen lines', () => {
    const silent = [
      YOUR_TURN,
      MIX_LINE,
      READY_LINE,
      NEW_KEYS,
      TEST_PASS,
      TEST_FAIL,
      speedLine(30),
      multiplierLine(7),
      'Perfect!',
      'Level 8 opened!',
      'Ride again 🌊',
    ];
    for (const line of silent) expect(VOICE_LINES).not.toContain(line);
  });

  it('calls speak() nowhere in the game: only the lesson gets the speaker', () => {
    const dir = resolve(import.meta.dirname, '../src/games/type-rider');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files).toContain('main.ts');
    for (const file of files) {
      const source = readFileSync(resolve(dir, file), 'utf8');
      expect(source, file).not.toMatch(/\bspeak\(/);
    }
    const main = readFileSync(resolve(dir, 'main.ts'), 'utf8');
    // The speaker goes to the lesson (a key lesson is the one thing that reads aloud).
    expect(main.match(/\bspeak\b/g)?.length).toBe(2); // the import and the lesson option
    expect(main).toMatch(/showKeyLesson\(\{[^}]*\bspeak\b/s);
  });
});
