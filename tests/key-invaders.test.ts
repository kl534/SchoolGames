import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDev } from '../src/games/key-invaders/dev';
import {
  BUNKER_PIXEL,
  BUNKER_X,
  COL_PITCH,
  DROPS_TO_LAND,
  FIELD_BOX,
  FIELD_HALF,
  LAND_Y,
  RECOIL_DROPS,
  STEPS_PER_PASS,
  START_BOTTOM,
  DROP,
  bunkerCellAt,
  bunkerHasCube,
  cameraDistance,
  chipCount,
  extentOf,
  fieldRect,
  invaderBottom,
  invaderX,
  isCorner,
} from '../src/games/key-invaders/layout';
import { labelFontPx, staggerLabels } from '../src/games/key-invaders/labels';
import {
  CHUNK_KEYS,
  COLUMNS,
  NO_AIM,
  ROWS,
  ROW_KINDS,
  SLACK_MIN,
  STEP_MIN,
  WAVE_KEYS,
  aimKey,
  aimWithout,
  emptyStats,
  killPoints,
  lockTarget,
  nextStep,
  planChunk,
  recoil,
  resultsText,
  runWpm,
  speedGroupPasses,
  spkFor,
  stepSeconds,
  streakMultiplier,
  targetText,
  waveBonus,
  waveBudget,
  waveSlack,
  chunkWordsMode,
  ufoSeconds,
  type Kind,
  type March,
} from '../src/games/key-invaders/rules';
import { VOICE_LINES } from '../src/games/key-invaders/voice';
import { seededRandom } from '../src/shared/random';
import { knownChars, levelOf, TYPING_LEVELS } from '../src/shared/typing/course';
import { TYPING_VOICE_LINES } from '../src/shared/typing/lines';
import { runs } from './helpers/full';

describe('parseDev', () => {
  it('has no hooks by default', () => {
    expect(parseDev('')).toEqual({
      level: null,
      start: false,
      lesson: false,
      chunk: null,
      lock: null,
      typed: 0,
      wrong: false,
      spk: null,
      wave: null,
      lives: null,
      drop: null,
      left: null,
      ufo: false,
      freeze: false,
      levelup: false,
      keys: null,
      hooked: false,
    });
  });

  it('reads every hook', () => {
    const dev = parseDev(
      '?level=12&start=1&lesson=1&chunk=ab%20cd&lock=3&typed=2&wrong=1&spk=1.2&wave=4&lives=2&drop=8&left=5&ufo=1&freeze=1&levelup=1&keys=f%20j',
    );
    expect(dev).toEqual({
      level: 12,
      start: true,
      lesson: true,
      chunk: 'ab cd',
      lock: 3,
      typed: 2,
      wrong: true,
      spk: 1.2,
      wave: 4,
      lives: 2,
      drop: 8,
      left: 5,
      ufo: true,
      freeze: true,
      levelup: true,
      keys: 'f j',
      hooked: true,
    });
  });

  it('ignores junk and out of range values', () => {
    const dev = parseDev(
      '?level=41&lock=7&lives=4&drop=24&left=19&wave=0&typed=-1&spk=abc&chunk=%C3%A9&start=yes&freeze=0',
    );
    expect(dev).toMatchObject({
      level: null,
      lock: null,
      lives: null,
      drop: null,
      left: null,
      wave: null,
      typed: 0,
      spk: null,
      chunk: null,
      start: false,
      freeze: false,
    });
    expect(parseDev('?level=2.5').level).toBeNull();
    expect(parseDev('?lock=1').lock).toBe(1);
    expect(parseDev('?lock=6').lock).toBe(6);
    expect(parseDev('?drop=0').drop).toBe(0);
    expect(parseDev('?drop=23').drop).toBe(23);
    expect(parseDev('?left=18').left).toBe(18);
  });

  it('reads keys, at most 12 characters', () => {
    expect(parseDev('?keys=f%20j').keys).toBe('f j');
    expect(parseDev('?keys=abcdefghijklm').keys).toBeNull();
    expect(parseDev('?keys=abcdefghijkl').keys).toBe('abcdefghijkl');
    expect(parseDev('').keys).toBeNull();
    expect(parseDev('?keys=f').hooked).toBe(true);
  });

  it('clamps spk', () => {
    expect(parseDev('?spk=0.01').spk).toBe(0.9);
    expect(parseDev('?spk=99').spk).toBe(2.5);
  });

  it('counts any one hook as a hook, so nothing is saved', () => {
    for (const q of ['level=3', 'start=1', 'chunk=ab', 'lock=2', 'freeze=1', 'ufo=1', 'wave=2']) {
      expect(parseDev(`?${q}`).hooked).toBe(true);
    }
    expect(parseDev('?topic=typing-level').hooked).toBe(false);
  });
});

describe('planChunk', () => {
  const kinds: Kind[] = ['octopus', 'crab', 'squid', 'ufo'];
  const seeds = runs(40, 4);

  it('makes chunks of known chars without a stray space, of the right length', () => {
    let wordsInRange = 0;
    let wordsTotal = 0;
    for (const level of TYPING_LEVELS) {
      const known = new Set(knownChars(level.n));
      const words = chunkWordsMode(level.n);
      for (const kind of kinds) {
        const keys = CHUNK_KEYS[kind];
        for (let seed = 1; seed <= seeds; seed++) {
          const chunk = planChunk({
            level: level.n,
            keys,
            random: seededRandom(seed * 31 + level.n),
          });
          const what = `level ${level.n} ${kind} seed ${seed}: "${chunk}"`;
          expect(chunk.length, what).toBeGreaterThan(0);
          for (const c of chunk) expect(known.has(c), what).toBe(true);
          if (kind === 'ufo') {
            expect(chunk, what).toBe(chunk.trim());
            expect(chunk, what).not.toContain('  ');
            if (!words) expect(chunk.length, what).toBe(keys);
          } else {
            expect(chunk, what).not.toContain(' ');
            if (!words) expect(chunk.length, what).toBe(keys);
            else {
              const [low, high] = level.kind === 'speed' ? [2, 8] : [keys, keys + 2];
              wordsTotal++;
              if (chunk.length >= low && chunk.length <= high) wordsInRange++;
            }
          }
        }
      }
    }
    // A word the list can't give in range falls back to the nearest one: rare.
    expect(wordsInRange / wordsTotal).toBeGreaterThanOrEqual(0.97);
  });

  it('avoids the first chars it is told to (95% over the sweep)', () => {
    let ok = 0;
    let total = 0;
    for (const level of TYPING_LEVELS) {
      const known = knownChars(level.n).filter((c) => c !== ' ');
      if (known.length < 4) continue;
      for (const kind of kinds) {
        for (let seed = 1; seed <= seeds; seed++) {
          const random = seededRandom(seed * 17 + level.n * 3);
          const avoid = [0, 1, 2].map(() => known[Math.floor(random() * known.length)]);
          const chunk = planChunk({ level: level.n, keys: CHUNK_KEYS[kind], random, avoid });
          total++;
          if (!avoid.includes(chunk[0])) ok++;
        }
      }
    }
    expect(ok / total).toBeGreaterThanOrEqual(0.95);
  });

  it('adds the space bar with targetText', () => {
    expect(targetText('fj')).toBe('fj ');
  });

  it('uses words from the level with enough of them, and always on a speed level', () => {
    expect(chunkWordsMode(1)).toBe(false);
    expect(chunkWordsMode(29)).toBe(true);
    expect(levelOf(29).kind).toBe('speed');
  });
});

describe('lockTarget', () => {
  const t = (id: string, text: string, bottomY: number, x: number, ufo = false) => ({
    id,
    text,
    bottomY,
    x,
    ufo,
  });

  it('takes the lowest invader first, then the one nearest the cannon', () => {
    const targets = [
      t('high', 'fa ', 9.5, -1),
      t('low-far', 'fb ', 8.2, 4),
      t('low-near', 'fc ', 8.2, 1),
    ];
    expect(lockTarget(targets, 'f', 0)).toBe('low-near');
    expect(lockTarget(targets, 'f', 5)).toBe('low-far');
    expect(lockTarget(targets.slice(0, 1), 'f', 0)).toBe('high');
  });

  it('takes the UFO only when no invader starts with the key', () => {
    const targets = [t('ufo', 'jk ', 12.2, 0, true), t('inv', 'jf ', 9.5, 3)];
    expect(lockTarget(targets, 'j', 0)).toBe('inv');
    expect(lockTarget([targets[0]], 'j', 0)).toBe('ufo');
    expect(lockTarget([targets[1], targets[0]], 'j', 0)).toBe('inv');
  });

  it('is null when no target starts with the key', () => {
    expect(lockTarget([t('a', 'fj ', 8, 0)], 'k', 0)).toBeNull();
    expect(lockTarget([], 'f', 0)).toBeNull();
  });

  it('takes a prefix: only targets starting with all of it', () => {
    const targets = [t('ff', 'ffj ', 8, 0), t('fj', 'fjj ', 9, 0)];
    expect(lockTarget(targets, 'f', 0)).toBe('ff');
    expect(lockTarget(targets, 'fj', 0)).toBe('fj');
    expect(lockTarget(targets, 'fk', 0)).toBeNull();
  });
});

describe('aimKey', () => {
  const t = (id: string, text: string, bottomY: number, x: number, ufo = false) => ({
    id,
    text,
    bottomY,
    x,
    ufo,
  });
  const right = (step: ReturnType<typeof aimKey>) => {
    if (step.kind !== 'right') throw new Error(`expected right, got ${step.kind}`);
    return step;
  };

  it('narrows as you type (the owner case)', () => {
    const targets = [t('a', 'ffj ', 8, 0), t('b', 'fjj ', 9, 0)];
    const s1 = right(aimKey(NO_AIM, targets, 'f', 0));
    expect(s1.aim).toEqual({ candidates: ['a', 'b'], primary: 'a', typed: 'f' });
    expect(s1.dropped).toEqual([]);
    const s2 = right(aimKey(s1.aim, targets, 'j', 0));
    expect(s2.aim).toEqual({ candidates: ['b'], primary: 'b', typed: 'fj' });
    expect(s2.dropped).toEqual(['a']);
    const s3 = right(aimKey(s2.aim, targets, 'j', 0));
    expect(aimKey(s3.aim, targets, ' ', 0)).toEqual({ kind: 'kill', id: 'b', others: [] });
  });

  it('narrows the other way', () => {
    const targets = [t('a', 'ffj ', 8, 0), t('b', 'fjj ', 9, 0)];
    const s1 = right(aimKey(NO_AIM, targets, 'f', 0));
    const s2 = right(aimKey(s1.aim, targets, 'f', 0));
    expect(s2.aim.primary).toBe('a');
    expect(s2.aim.candidates).toEqual(['a']);
    expect(s2.dropped).toEqual(['b']);
  });

  it('is a stray key when nothing is locked and nothing fits', () => {
    expect(aimKey(NO_AIM, [t('a', 'fj ', 8, 0)], 'k', 0)).toEqual({ kind: 'stray' });
  });

  it('is wrong, with the aim unchanged, when no candidate fits', () => {
    const targets = [t('a', 'ffj ', 8, 0), t('b', 'fjj ', 9, 0)];
    const s1 = right(aimKey(NO_AIM, targets, 'f', 0));
    const step = aimKey(s1.aim, targets, 'k', 0);
    expect(step).toEqual({
      kind: 'wrong',
      aim: { candidates: ['a', 'b'], primary: 'a', typed: 'f' },
    });
  });

  it('blows up the primary of two with the same keys; the other goes back to untyped', () => {
    const targets = [t('a', 'fj ', 8, 0), t('b', 'fj ', 9, 0)];
    let aim = right(aimKey(NO_AIM, targets, 'f', 0)).aim;
    aim = right(aimKey(aim, targets, 'j', 0)).aim;
    expect(aimKey(aim, targets, ' ', 0)).toEqual({ kind: 'kill', id: 'a', others: ['b'] });
  });

  it('keeps the primary while it is a candidate, even if the cannon moves', () => {
    const targets = [t('a', 'fjj ', 9, 0), t('b', 'fjf ', 9, 4)];
    const s1 = right(aimKey(NO_AIM, targets, 'f', 0));
    expect(s1.aim.primary).toBe('a');
    const s2 = right(aimKey(s1.aim, targets, 'j', 4));
    expect(s2.aim.primary).toBe('a');
  });

  it('treats the UFO as a candidate, primary only when no invader is', () => {
    const targets = [t('inv', 'fj ', 9, 0), t('ufo', 'fj jf ', 12, 0, true)];
    const s1 = right(aimKey(NO_AIM, targets, 'f', 0));
    expect(s1.aim).toEqual({ candidates: ['inv', 'ufo'], primary: 'inv', typed: 'f' });
    const s2 = right(aimKey(s1.aim, targets, 'j', 0));
    expect(aimKey(s2.aim, targets, ' ', 0)).toEqual({ kind: 'kill', id: 'inv', others: ['ufo'] });
    expect(right(aimKey(NO_AIM, [targets[1]], 'f', 0)).aim.primary).toBe('ufo');
  });

  it('ignores candidate ids that are not targets any more', () => {
    const targets = [t('a', 'fj ', 8, 0)];
    const aim = { candidates: ['gone', 'a'], primary: 'gone', typed: 'f' };
    const step = right(aimKey(aim, targets, 'j', 0));
    expect(step.aim).toEqual({ candidates: ['a'], primary: 'a', typed: 'fj' });
    expect(step.dropped).toEqual(['gone']);
  });

  it('never leaves the player stuck: typing any target text always ends in a kill of that text', () => {
    const rand = (n: number) => Math.floor(Math.random() * n);
    for (let run = 0; run < runs(3000, 400); run++) {
      const count = 2 + rand(5);
      const targets = Array.from({ length: count }, (_, i) => {
        const len = 2 + rand(3);
        let text = '';
        for (let k = 0; k < len; k++) text += 'fj'[rand(2)];
        return t(`t${i}`, `${text} `, 8 + rand(3), rand(6));
      });
      const picked = targets[rand(count)];
      let aim = NO_AIM;
      for (let k = 0; k < picked.text.length; k++) {
        const step = aimKey(aim, targets, picked.text[k], rand(6));
        if (k < picked.text.length - 1) {
          expect(step.kind).toBe('right');
          if (step.kind === 'right') aim = step.aim;
        } else {
          expect(step.kind).toBe('kill');
          if (step.kind === 'kill') {
            expect(targets.find((x) => x.id === step.id)?.text).toBe(picked.text);
          }
        }
      }
    }
  });
});

describe('aimWithout', () => {
  const t = (id: string, text: string, bottomY: number, x: number) => ({
    id,
    text,
    bottomY,
    x,
    ufo: false,
  });
  const targets = [t('a', 'ffj ', 8, 0), t('b', 'ffk ', 9, 0)];
  const aim = { candidates: ['a', 'b'], primary: 'a', typed: 'ff' };

  it('re-picks the primary among the rest', () => {
    expect(aimWithout(aim, 'a', targets, 0)).toEqual({
      candidates: ['b'],
      primary: 'b',
      typed: 'ff',
    });
  });

  it('keeps the primary when another one goes', () => {
    expect(aimWithout(aim, 'b', targets, 0).primary).toBe('a');
  });

  it('is NO_AIM when the last candidate goes', () => {
    expect(aimWithout({ candidates: ['a'], primary: 'a', typed: 'f' }, 'a', targets, 0)).toEqual(
      NO_AIM,
    );
  });

  it('returns the aim unchanged for a non-candidate', () => {
    expect(aimWithout(aim, 'zzz', targets, 0)).toBe(aim);
  });
});

describe('points', () => {
  it('multiplies at 5, 10 and 20 perfect kills in a row', () => {
    expect([0, 1, 4].map(streakMultiplier)).toEqual([1, 1, 1]);
    expect([5, 9].map(streakMultiplier)).toEqual([2, 2]);
    expect([10, 19].map(streakMultiplier)).toEqual([3, 3]);
    expect([20, 99].map(streakMultiplier)).toEqual([4, 4]);
  });

  it('scores a kill and a wave on level 7 (×49)', () => {
    expect(killPoints('octopus', 1, 7)).toBe(10 * 49);
    expect(killPoints('squid', 5, 7)).toBe(30 * 2 * 49);
    expect(killPoints('ufo', 10, 7)).toBe(100 * 3 * 49);
    expect(killPoints('crab', 20, 7)).toBe(20 * 4 * 49);
    expect(waveBonus(3, 7)).toBe(50 * 3 * 49);
  });
});

describe('pace', () => {
  it('gives 3.2 times the typing time at wave 1, 8% less each wave, never below 2.2', () => {
    expect(waveSlack(1)).toBeCloseTo(3.2, 10);
    expect(waveSlack(2)).toBeCloseTo(2.944, 10);
    expect(waveSlack(3)).toBeLessThan(waveSlack(2));
    for (let wave = 1; wave < 60; wave++) expect(waveSlack(wave)).toBeGreaterThanOrEqual(SLACK_MIN);
    expect(waveSlack(60)).toBe(SLACK_MIN);
    expect(waveBudget(1, 1)).toBeCloseTo(WAVE_KEYS * 3.2, 10);
  });

  it('steps slower on a bigger budget, faster as the formation thins, never below the minimum', () => {
    expect(stepSeconds(60, 18)).toBeGreaterThan(stepSeconds(30, 18));
    expect(stepSeconds(60, 18)).toBeGreaterThan(stepSeconds(60, 9));
    expect(stepSeconds(60, 9)).toBeGreaterThan(stepSeconds(60, 1));
    expect(stepSeconds(60, 1) / stepSeconds(60, 18)).toBeCloseTo(1 / (1 + (0.25 * 17) / 18), 6);
    expect(stepSeconds(0.001, 18)).toBe(STEP_MIN);
    expect(stepSeconds(0.001, 1)).toBe(STEP_MIN);
  });

  it('is the goal speed on a speed level, the saved one otherwise', () => {
    expect(spkFor(31, 1.7)).toBeCloseTo(12 / 20, 10);
    expect(levelOf(31).wpm).toBe(20);
    expect(spkFor(7, 1.7)).toBe(1.7);
  });

  it('keeps the UFO on the lane for at least 6 seconds', () => {
    expect(ufoSeconds(0.3)).toBe(6);
    expect(ufoSeconds(1)).toBe(18);
  });
});

describe('the march', () => {
  const fullXs = (offsetX: number) =>
    Array.from({ length: COLUMNS }, (_, c) => invaderX(c, offsetX));

  it('never passes the field edge, turns with a drop and takes 8 steps a pass (±1)', () => {
    let m: March = { offsetX: 0, drops: 0, dir: 1 };
    const turns: number[] = [];
    for (let step = 0; step < 200; step++) {
      const extent = extentOf(fullXs(m.offsetX))!;
      const next = nextStep(m, extent);
      if (next.drops !== m.drops) {
        expect(next.dir).toBe(-m.dir);
        expect(next.offsetX).toBe(m.offsetX);
        turns.push(step);
      } else {
        expect(next.dir).toBe(m.dir);
      }
      m = next;
      const e = extentOf(fullXs(m.offsetX))!;
      expect(e.right).toBeLessThanOrEqual(FIELD_HALF + 1e-9);
      expect(e.left).toBeGreaterThanOrEqual(-FIELD_HALF - 1e-9);
    }
    // Between two turns: STEPS_PER_PASS steps and the drop.
    for (let i = 2; i < turns.length; i++) {
      expect(Math.abs(turns[i] - turns[i - 1] - (STEPS_PER_PASS + 1))).toBeLessThanOrEqual(1);
    }
  });

  it('stays in the field for any thinned formation too', () => {
    const random = seededRandom(5);
    for (let n = 0; n < 40; n++) {
      const cols = Array.from({ length: COLUMNS }, (_, c) => c).filter(() => random() < 0.5);
      if (cols.length === 0) continue;
      let m: March = { offsetX: 0, drops: 0, dir: 1 };
      for (let step = 0; step < 150; step++) {
        const extent = extentOf(cols.map((c) => invaderX(c, m.offsetX)))!;
        m = nextStep(m, extent);
        const e = extentOf(cols.map((c) => invaderX(c, m.offsetX)))!;
        expect(e.right).toBeLessThanOrEqual(FIELD_HALF + 1e-9);
        expect(e.left).toBeGreaterThanOrEqual(-FIELD_HALF - 1e-9);
      }
    }
  });

  it('steps back up by the recoil and never below 0', () => {
    expect(recoil({ offsetX: 1, drops: 9, dir: -1 })).toEqual({
      offsetX: 1,
      drops: 9 - RECOIL_DROPS,
      dir: -1,
    });
    expect(recoil({ offsetX: 0, drops: 2, dir: 1 }).drops).toBe(0);
    expect(recoil({ offsetX: 0, drops: 0, dir: 1 }).drops).toBe(0);
  });

  it('lands the bottom row after DROPS_TO_LAND drops', () => {
    expect(DROPS_TO_LAND).toBeCloseTo((START_BOTTOM - LAND_Y) / DROP, 10);
    expect(invaderBottom(0, DROPS_TO_LAND)).toBeCloseTo(LAND_Y, 10);
    expect(invaderX(0, 0)).toBeCloseTo(-4.5, 10);
    expect(invaderX(5, 0) - invaderX(4, 0)).toBeCloseTo(COL_PITCH, 10);
  });
});

/** Plays a wave with a perfect player: one key every `spk` seconds, lowest target first. */
function simulateWave(spk: number, wave: number): { cleared: boolean; time: number } {
  const budget = waveBudget(spk, wave);
  const alive = Array.from({ length: ROWS * COLUMNS }, (_, i) => ({
    row: Math.floor(i / COLUMNS),
    col: i % COLUMNS,
    live: true,
  }));
  // The lowest first: the bottom row left to right, then the next row, then the top.
  const order = [...alive];
  const keysOf = (row: number) => CHUNK_KEYS[ROW_KINDS[row]] + 1;
  let march: March = { offsetX: 0, drops: 0, dir: 1 };
  let time = 0;
  let stepClock = 0;
  let typed = 0;
  let current = 0;
  const dt = 0.002;
  while (current < order.length) {
    time += dt;
    stepClock += dt;
    const left = alive.filter((i) => i.live);
    const every = stepSeconds(budget, left.length);
    while (stepClock >= every) {
      stepClock -= every;
      const extent = extentOf(left.map((i) => invaderX(i.col, march.offsetX)))!;
      march = nextStep(march, extent);
      const lowest = Math.min(...left.map((i) => invaderBottom(i.row, march.drops)));
      if (lowest <= LAND_Y + 1e-6) return { cleared: false, time };
    }
    // The key typed at multiples of spk.
    while (typed < Math.floor(time / spk + 1e-9) && current < order.length) {
      typed++;
      const target = order[current];
      const done = typed - order.slice(0, current).reduce((n, i) => n + keysOf(i.row), 0);
      if (done >= keysOf(target.row)) {
        target.live = false;
        current++;
      }
    }
  }
  return { cleared: true, time };
}

describe('pace invariant', () => {
  it('lets a perfect player clear any wave before the formation lands', () => {
    for (const spk of [0.3, 1.0, 2.0]) {
      for (let wave = 1; wave <= 15; wave++) {
        const result = simulateWave(spk, wave);
        expect(result.cleared, `spk ${spk} wave ${wave} at ${result.time.toFixed(1)}s`).toBe(true);
        expect(result.time).toBeCloseTo(WAVE_KEYS * spk, 0);
      }
    }
  });
});

describe('speed groups', () => {
  it('pass at the goal words a minute with 90% right', () => {
    // 10 kills of ~4.5 keys: 45 keys at 20 wpm needs 27 seconds.
    expect(speedGroupPasses(31, { keys: 45, mistakes: 0, seconds: 27 })).toBe(true);
    expect(speedGroupPasses(31, { keys: 45, mistakes: 0, seconds: 28 })).toBe(false);
    expect(speedGroupPasses(31, { keys: 50, mistakes: 5, seconds: 20 })).toBe(true);
    expect(speedGroupPasses(31, { keys: 50, mistakes: 6, seconds: 20 })).toBe(false);
    expect(speedGroupPasses(31, { keys: 45, mistakes: 0, seconds: 0 })).toBe(false);
    expect(speedGroupPasses(7, { keys: 45, mistakes: 0, seconds: 1 })).toBe(false);
  });
});

describe('resultsText', () => {
  it('puts the wave first, always', () => {
    expect(resultsText(emptyStats(), 1, [])).toBe('Wave 1');
    expect(resultsText({ keys: 100, right: 94, fastKeys: 140, fastSeconds: 60 }, 4, [8])).toBe(
      'Wave 4 · 28 words a minute · 94% right · Level 8 opened!',
    );
    expect(resultsText({ keys: 10, right: 10, fastKeys: 0, fastSeconds: 0 }, 2, [3, 4, 5])).toBe(
      'Wave 2 · 100% right · Levels 3 to 5 opened!',
    );
    expect(runWpm({ keys: 0, right: 0, fastKeys: 10, fastSeconds: 0 })).toBe(0);
  });
});

describe('fieldRect', () => {
  const keyboardFor = (w: number, h: number) => {
    const corner = isCorner({ w, h });
    const width = corner ? Math.min(0.4 * w, 0.8 * h, 620) : Math.min(0.94 * w, 620, 0.8 * h);
    return { w: width, h: width / 3, corner };
  };

  it.each([
    [390, 844],
    [844, 390],
    [1024, 768],
    [1366, 1024],
  ])('fits %i x %i inside the screen, under the HUD and clear of the keyboard', (w, h) => {
    const kb = keyboardFor(w, h);
    const r = fieldRect({ w, h }, kb);
    expect(r.x).toBeGreaterThanOrEqual(12);
    expect(r.y).toBeGreaterThanOrEqual(w >= 700 ? 72 : 112);
    expect(r.x + r.w).toBeLessThanOrEqual(w);
    expect(r.y + r.h).toBeLessThanOrEqual(h);
    if (kb.corner) {
      // Beside the keyboard strip, which sits in the bottom-right corner.
      expect(r.x + r.w).toBeLessThanOrEqual(w - kb.w - 24 + 1e-9);
    } else {
      // Above it (the strip sits 12 px up from the bottom).
      expect(r.y + r.h).toBeLessThanOrEqual(h - kb.h - 12);
    }
  });

  it('is the corner layout on a wide, low screen only', () => {
    expect(isCorner({ w: 844, h: 390 })).toBe(true);
    expect(isCorner({ w: 1024, h: 768 })).toBe(false);
    expect(isCorner({ w: 390, h: 844 })).toBe(false);
    expect(fieldRect({ w: 844, h: 390 }, { w: 300, h: 100, corner: true }).h).toBe(390 - 72 - 12);
  });

  it('keeps 16 px gutters on a narrow screen and adds the safe area on top', () => {
    const r = fieldRect({ w: 390, h: 844 }, { w: 366, h: 122, corner: false }, 20);
    expect(r.x).toBe(16);
    expect(r.w).toBe(390 - 32);
    expect(r.y).toBe(132);
  });

  it('draws a readable field: enough pixels per unit for the tall field (invaders start 12 units above the bunkers)', () => {
    for (const [w, h, minPx] of [
      [390, 844, 20],
      [844, 390, 13],
      [1024, 768, 20],
      [1366, 1024, 30],
    ]) {
      const r = fieldRect({ w, h }, keyboardFor(w, h));
      const d = cameraDistance(FIELD_BOX, r.w / r.h);
      expect(d).toBeGreaterThan(0);
      // Pixels per unit at the field's centre.
      const perUnit = r.h / 2 / (d * Math.tan((35 * Math.PI) / 360));
      expect(perUnit, `${w}x${h}`).toBeGreaterThan(minPx);
    }
  });
});

describe('camera and grid', () => {
  it('moves back for a narrower view', () => {
    expect(cameraDistance(FIELD_BOX, 0.5)).toBeGreaterThan(cameraDistance(FIELD_BOX, 2));
  });

  it('finds bunker cubes and gaps', () => {
    expect(bunkerHasCube(0, 0)).toBe(false);
    expect(bunkerHasCube(6, 0)).toBe(true);
    expect(bunkerHasCube(6, 9)).toBe(false);
    expect(bunkerHasCube(1, 9)).toBe(true);
    const x = BUNKER_X[1] - 7 * BUNKER_PIXEL + 0.01;
    const cell = bunkerCellAt(x, 2.19)!;
    expect(cell).toEqual({ bunker: 1, col: 0, row: 0 });
    expect(bunkerCellAt(0, 2.5)).toBeNull();
    expect(bunkerCellAt(0, 0.5)).toBeNull();
    expect(bunkerCellAt(-3, 1.5)).toBeNull();
  });

  it('chips 60% of the cubes by the last key before the blast', () => {
    expect(chipCount(60, 0, 4)).toBe(0);
    expect(chipCount(60, 3, 4)).toBe(27);
    expect(chipCount(60, 4, 4)).toBe(36);
  });
});

describe('labels', () => {
  it('moves a label that overlaps its left neighbour down', () => {
    const boxes = [
      { x: 0, y: 100, w: 50, h: 20 },
      { x: 30, y: 100, w: 50, h: 20 },
      { x: 60, y: 100, w: 50, h: 20 },
      { x: 200, y: 100, w: 50, h: 20 },
    ];
    expect(staggerLabels(boxes)).toEqual([0, 24, 0, 0]);
  });

  it('does not depend on the order of the boxes', () => {
    const boxes = [
      { x: 30, y: 100, w: 50, h: 20 },
      { x: 0, y: 100, w: 50, h: 20 },
    ];
    expect(staggerLabels(boxes)).toEqual([24, 0]);
    expect(staggerLabels([])).toEqual([]);
  });

  it('sizes the font to the column pitch between 13 and 22 px', () => {
    expect(labelFontPx(10, 5)).toBe(13);
    expect(labelFontPx(1000, 3)).toBe(22);
    expect(labelFontPx(60, 3)).toBeGreaterThanOrEqual(13);
    expect(labelFontPx(60, 3)).toBeLessThanOrEqual(22);
    expect(labelFontPx(60, 3)).toBeGreaterThan(labelFontPx(60, 5) - 1);
  });
});

describe('voice', () => {
  it('speaks only the lesson lines', () => {
    expect(VOICE_LINES).toEqual(TYPING_VOICE_LINES);
    expect(VOICE_LINES).not.toContain("You're ready! Let's blast!");
    expect(VOICE_LINES).not.toContain('Press the space bar to play!');
  });

  it('calls speak() nowhere in the game: only the lesson gets the speaker', () => {
    const dir = resolve(import.meta.dirname, '../src/games/key-invaders');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files).toContain('main.ts');
    for (const file of files) {
      const source = readFileSync(resolve(dir, file), 'utf8');
      expect(source, file).not.toMatch(/\bspeak\(/);
    }
    const main = readFileSync(resolve(dir, 'main.ts'), 'utf8');
    expect(main.match(/\bspeak\b/g)?.length).toBe(2); // the import and the lesson option
    expect(main).toMatch(/showKeyLesson\(\{[^}]*\bspeak\b/s);
  });
});
