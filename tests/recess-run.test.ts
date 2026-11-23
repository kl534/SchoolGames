import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDev } from '../src/games/recess-run/dev';
import {
  BACK_MAX,
  BACK_MIN,
  FOV,
  HALF_FIT,
  HALF_FIT_PORTRAIT,
  cameraFor,
  laneX,
} from '../src/games/recess-run/layout';
import {
  ACCEL_SECONDS,
  FACEPLANT_SECONDS,
  GETUP_SECONDS,
  HEAT_SECONDS,
  MAX_SPEED_FACTOR,
  MIN_GAP,
  OUT_GRACE,
  PLACE_POINTS,
  RACE_METRES,
  RACE_SPEED,
  RIVAL_FACTORS,
  RIVAL_NAME_POOL,
  pickRivalNames,
  pickRivals,
  RIVAL_GIRL_NAMES,
  RIVAL_BOY_NAMES,
  STUMBLE_SECONDS,
  STUMBLE_SPEED,
  SURGE,
  accuracy,
  easeSpeed,
  emptyStats,
  goesOn,
  heatOver,
  heatWpm,
  keyPoints,
  liveRate,
  nextRate,
  sustainedWpm,
  easeWpm,
  WPM_WINDOW,
  WPM_MIN_SPAN,
  onMiss,
  ordinal,
  placeOf,
  placePoints,
  resultsText,
  rivalSpeed,
  shuffleLanes,
  speedBlockPasses,
  speedStreak,
  stepStride,
  strideSpeedFactor,
  targetSpeed,
  type RunnerMark,
  type Stride,
} from '../src/games/recess-run/rules';
import { runAmount } from '../src/games/recess-run/runners';
import { VOICE_LINES } from '../src/games/recess-run/voice';
import { multiplier, TYPING_LEVELS } from '../src/shared/typing/course';
import { SPEED_STREAK } from '../src/shared/typing/progress';
import { TYPING_VOICE_LINES } from '../src/shared/typing/lines';
import { runs } from './helpers/full';

describe('parseDev', () => {
  it('has no hooks by default and ignores junk', () => {
    expect(parseDev('')).toMatchObject({
      level: null,
      start: false,
      lesson: false,
      spk: null,
      heat: null,
      block: null,
      typed: 0,
      wrong: false,
      count: null,
      at: null,
      wpm: null,
      freeze: false,
      stumble: false,
      faceplant: false,
      podium: null,
      win: false,
      card: false,
      out: null,
      keys: null,
      levelup: false,
      hooked: false,
    });
    const junk = parseDev(
      '?level=99&heat=0&count=4&podium=4&out=3&at=abc&wpm=-2&typed=x&block=%01&keys=%01&spk=',
    );
    expect(junk).toMatchObject({
      level: null,
      heat: null,
      count: null,
      podium: null,
      out: null,
      at: null,
      wpm: null,
      typed: 0,
      block: null,
      keys: null,
      spk: null,
    });
  });

  it('reads each hook', () => {
    const dev = parseDev(
      '?level=7&start=1&lesson=1&heat=4&block=fj%20fj&typed=3&wrong=1&count=2&at=40&wpm=9' +
        '&freeze=1&stumble=1&faceplant=1&podium=2&win=dance&card=1&levelup=1&keys=fjfj&spk=1',
    );
    expect(dev).toMatchObject({
      level: 7,
      start: true,
      lesson: true,
      heat: 4,
      block: 'fj fj',
      typed: 3,
      wrong: true,
      count: 2,
      at: 40,
      wpm: 9,
      freeze: true,
      stumble: true,
      faceplant: true,
      podium: 2,
      win: true,
      card: true,
      levelup: true,
      keys: 'fjfj',
      spk: 1,
      hooked: true,
    });
    expect(parseDev('?out=6').out).toBe(6);
  });

  it('clamps', () => {
    expect(parseDev('?at=250').at).toBe(100);
    expect(parseDev('?wpm=999').wpm).toBe(200);
    expect(parseDev('?spk=0.01').spk).toBeGreaterThan(0.01);
    expect(parseDev('?keys=abcdefghijklmnopqrstuvwxyz').keys).toHaveLength(12);
  });

  it('counts any hook as hooked, even the shared dance one', () => {
    expect(parseDev('?dance=floss').hooked).toBe(true);
    expect(parseDev('?topic=x').hooked).toBe(false);
  });
});

describe('the heat and its rivals', () => {
  it('starts at 5 words a minute and adds one a heat', () => {
    expect(heatWpm(1)).toBe(5);
    expect(heatWpm(6)).toBe(10);
    expect(RACE_SPEED * HEAT_SECONDS).toBeCloseTo(RACE_METRES);
  });

  it('has nine sorted rivals with nine different names', () => {
    expect(RIVAL_FACTORS).toHaveLength(9);
    expect([...RIVAL_FACTORS].sort((a, b) => a - b)).toEqual(RIVAL_FACTORS);
    expect(new Set(RIVAL_NAME_POOL).size).toBe(RIVAL_NAME_POOL.length);
    expect(RIVAL_NAME_POOL.length).toBeGreaterThanOrEqual(60);
    const names = pickRivalNames(Math.random);
    expect(names).toHaveLength(9);
    expect(new Set(names).size).toBe(9);
    expect(pickRivalNames(() => 0.1)).not.toEqual(pickRivalNames(() => 0.9));
  });

  it('gives girl figures girl names and boy figures boy names', () => {
    expect(RIVAL_GIRL_NAMES.some((n) => RIVAL_BOY_NAMES.includes(n))).toBe(false);
    for (let i = 0; i < runs(500, 50); i++) {
      const rivals = pickRivals(Math.random);
      expect(new Set(rivals.map((r) => r.name)).size).toBe(9);
      for (const r of rivals) {
        expect((r.girl ? RIVAL_GIRL_NAMES : RIVAL_BOY_NAMES).includes(r.name)).toBe(true);
      }
    }
  });

  it('keeps a rival within its surge', () => {
    for (let i = 0; i < runs(2000, 200); i++) {
      const factor = RIVAL_FACTORS[Math.floor(Math.random() * 9)];
      const speed = rivalSpeed(
        factor,
        Math.random() * 60,
        6 + Math.random() * 4,
        Math.random() * 6.3,
      );
      expect(speed).toBeGreaterThanOrEqual(RACE_SPEED * factor * (1 - SURGE) - 1e-9);
      expect(speed).toBeLessThanOrEqual(RACE_SPEED * factor * (1 + SURGE) + 1e-9);
    }
  });

  it('shuffles the nine other lanes', () => {
    const lanes = shuffleLanes(Math.random);
    expect([...lanes].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10]);
    expect(laneX(5)).toBeCloseTo(-0.55);
  });
});

describe('the player speed', () => {
  it('converges to 1 / gap over equal gaps and is never negative', () => {
    let rate = 0;
    for (let i = 0; i < 60; i++) rate = nextRate(rate, 0.4);
    expect(rate).toBeCloseTo(2.5, 3);
    let slow = 2;
    for (let i = 0; i < 60; i++) slow = nextRate(slow, 3);
    expect(slow).toBeCloseTo(1 / 3, 3);
    for (let i = 0; i < runs(500, 50); i++) {
      expect(nextRate(Math.random() * 10, Math.random() * 5)).toBeGreaterThanOrEqual(0);
    }
  });

  it('counts a gap shorter than MIN_GAP as MIN_GAP', () => {
    expect(nextRate(0, 0.001)).toBeCloseTo(1 / MIN_GAP);
    expect(nextRate(3, 0)).toBe(nextRate(3, MIN_GAP));
  });

  it('keeps the live rate within the usual gap and lets it fall as 1 / sinceLast after', () => {
    expect(liveRate(2, 0.3)).toBe(2);
    expect(liveRate(2, 0.5)).toBe(2);
    expect(liveRate(2, 1)).toBeCloseTo(1);
    expect(liveRate(2, 4)).toBeCloseTo(0.25);
    expect(liveRate(0, 10)).toBe(0);
  });

  it('runs at the heat pace when typing at it, capped, and stands at 0', () => {
    for (const heat of [1, 5, 20]) {
      expect(targetSpeed(heatWpm(heat) / 12, heat)).toBeCloseTo(RACE_SPEED);
      expect(targetSpeed(100, heat)).toBeCloseTo(RACE_SPEED * MAX_SPEED_FACTOR);
      expect(targetSpeed(0, heat)).toBe(0);
    }
  });

  it('finishes 100 m close to HEAT_SECONDS / f when typing evenly at f times the heat pace', () => {
    for (let n = 0; n < runs(120, 20); n++) {
      const heat = 1 + Math.floor(Math.random() * 40);
      const f = 0.8 + Math.random() * 1.2;
      const kps = (heatWpm(heat) * f) / 12;
      const dt = 1 / 60;
      let rate = 0;
      let lastKey = 0;
      let nextKey = 1 / kps;
      let speed = 0;
      let metres = 0;
      let t = 0;
      while (metres < RACE_METRES && t < 300) {
        t += dt;
        if (t >= nextKey) {
          rate = nextRate(rate, t - lastKey);
          lastKey = t;
          nextKey += 1 / kps;
        }
        const live = liveRate(rate, t - lastKey);
        speed = easeSpeed(speed, targetSpeed(live, heat), dt);
        metres += speed * dt;
      }
      const expected = HEAT_SECONDS / f;
      expect(Math.abs(t - expected) / expected, `heat ${heat} f ${f}`).toBeLessThan(0.1);
    }
  });

  it('eases to the target', () => {
    expect(easeSpeed(0, 2, ACCEL_SECONDS)).toBe(2);
    expect(easeSpeed(0, 2, ACCEL_SECONDS / 2)).toBe(1);
  });

  it('swings the limbs with the speed and not at a standstill', () => {
    expect(runAmount(0)).toBe(0);
    expect(runAmount(RACE_SPEED * 3)).toBe(1);
    expect(runAmount(RACE_SPEED)).toBeCloseTo(1);
    expect(runAmount(0.01)).toBeLessThan(0.1);
  });
});

describe('mistakes', () => {
  it('stumbles on the first four misses and falls on the fifth', () => {
    let stride: Stride = { kind: 'run' };
    for (let n = 1; n <= 4; n++) {
      stride = onMiss(stride, n);
      expect(stride).toEqual({ kind: 'stumble', t: 0 });
    }
    expect(onMiss(stride, 5)).toEqual({ kind: 'down', t: 0 });
    expect(onMiss({ kind: 'stumble', t: 0.3 }, 2)).toEqual({ kind: 'stumble', t: 0 });
  });

  it('ends a stumble after 0.5 s and a face-plant after 2 s', () => {
    let stride: Stride = { kind: 'stumble', t: 0 };
    stride = stepStride(stride, STUMBLE_SECONDS - 0.01);
    expect(stride.kind).toBe('stumble');
    expect(stepStride(stride, 0.02)).toEqual({ kind: 'run' });
    let down: Stride = { kind: 'down', t: 0 };
    down = stepStride(down, FACEPLANT_SECONDS - 0.01);
    expect(down.kind).toBe('down');
    expect(stepStride(down, 0.02)).toEqual({ kind: 'run' });
    expect(stepStride({ kind: 'run' }, 1)).toEqual({ kind: 'run' });
    expect(GETUP_SECONDS).toBeLessThan(FACEPLANT_SECONDS);
  });

  it('slows a stumble and stops a face-plant', () => {
    expect(strideSpeedFactor({ kind: 'run' })).toBe(1);
    expect(strideSpeedFactor({ kind: 'stumble', t: 0 })).toBe(STUMBLE_SPEED);
    expect(strideSpeedFactor({ kind: 'down', t: 0 })).toBe(0);
  });
});

describe('places', () => {
  const mark = (metres: number, finishedAt: number | null = null): RunnerMark => ({
    metres,
    finishedAt,
  });

  it('puts a finish time ahead of distance, and ties to the player', () => {
    expect(placeOf(mark(50), [mark(60), mark(40)])).toBe(2);
    expect(placeOf(mark(50), [mark(100, 40), mark(40)])).toBe(2);
    expect(placeOf(mark(100, 45), [mark(100, 44), mark(100, 46)])).toBe(2);
    expect(placeOf(mark(100, 45), [mark(100, 45)])).toBe(1);
    expect(placeOf(mark(50), [mark(50)])).toBe(1);
  });

  it('is 1 ahead of all and 10 behind all', () => {
    const rivals = Array.from({ length: 9 }, (_, i) => mark(10 + i));
    expect(placeOf(mark(99), rivals)).toBe(1);
    expect(placeOf(mark(0), rivals)).toBe(10);
    expect(
      placeOf(
        mark(0),
        rivals.map((r) => mark(100, r.metres)),
      ),
    ).toBe(10);
  });

  it('ends a heat when the player finishes or 3 rivals are home and the grace has passed', () => {
    const rivals = [mark(100, 40), mark(100, 41), mark(100, 42), mark(80), mark(70)];
    expect(heatOver(mark(100, 50), [], 50)).toBe(true);
    expect(heatOver(mark(60), rivals, 42 + OUT_GRACE - 0.1)).toBe(false);
    expect(heatOver(mark(60), rivals, 42 + OUT_GRACE)).toBe(true);
    expect(heatOver(mark(60), rivals.slice(0, 2), 100)).toBe(false);
    // The third finish is the third earliest, whatever the order of the list.
    expect(heatOver(mark(60), [mark(100, 42), mark(100, 40), mark(100, 41)], 45)).toBe(true);
  });

  it('writes ordinals and who goes on', () => {
    expect([1, 2, 3, 4, 5, 10].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '5th', '10th']);
    expect([11, 12, 13, 21, 22].map(ordinal)).toEqual(['11th', '12th', '13th', '21st', '22nd']);
    expect([1, 2, 3, 4, 10].map(goesOn)).toEqual([true, true, true, false, false]);
  });

  it('scores places by heat and level, and keys by level', () => {
    expect(placePoints(1, 1, 1)).toBe(PLACE_POINTS[0]);
    expect(placePoints(2, 3, 4)).toBe(200 * 3 * multiplier(4));
    expect(placePoints(3, 2, 2)).toBe(100 * 2 * 4);
    expect(placePoints(4, 2, 2)).toBe(0);
    expect(keyPoints(5)).toBe(25);
  });
});

describe('the speed streak', () => {
  const fast = { keys: 10, mistakes: 0, seconds: 5 }; // 24 wpm
  const slow = { keys: 10, mistakes: 0, seconds: 8 }; // 15 wpm
  const sloppy = { keys: 10, mistakes: 2, seconds: 5 };

  it('passes a block at the goal speed with at least 90% right', () => {
    expect(TYPING_LEVELS[30].wpm).toBe(20);
    expect(speedBlockPasses(31, fast)).toBe(true);
    expect(speedBlockPasses(31, { keys: 10, mistakes: 1, seconds: 5 })).toBe(true);
    expect(speedBlockPasses(31, slow)).toBe(false);
    expect(speedBlockPasses(31, sloppy)).toBe(false);
    expect(speedBlockPasses(7, fast)).toBe(false);
    expect(speedBlockPasses(31, { keys: 10, mistakes: 0, seconds: 0 })).toBe(false);
  });

  it('counts blocks in a row and starts over', () => {
    let streak = 0;
    streak = speedStreak(streak, 31, fast);
    streak = speedStreak(streak, 31, fast);
    expect(streak).toBe(2);
    expect(speedStreak(streak, 31, slow)).toBe(0);
    expect(speedStreak(streak, 31, null)).toBe(0);
    expect(speedStreak(streak, 31, fast)).toBe(SPEED_STREAK);
    expect(accuracy({ keys: 10, mistakes: 1 })).toBeCloseTo(0.9);
  });
});

describe('resultsText', () => {
  it('reads like the design', () => {
    const stats = {
      keys: 100,
      right: 92,
      heats: 4,
      medals: [2, 1, 0] as [number, number, number],
      bestWpm: 14,
    };
    expect(resultsText(stats, 5, [6])).toBe(
      'You came 5th in heat 4 · 2 🥇 1 🥈 · Top speed 14 words a minute · 92% right · Level 6 opened!',
    );
  });

  it('leaves out the parts with nothing to say and lists only medals won', () => {
    const stats = {
      keys: 20,
      right: 20,
      heats: 1,
      medals: [0, 0, 3] as [number, number, number],
      bestWpm: 0,
    };
    expect(resultsText(stats, 6, [8, 9, 10])).toBe(
      'You came 6th in heat 1 · 3 🥉 · 100% right · Levels 8 to 10 opened!',
    );
    expect(resultsText(emptyStats(), 0, [])).toBe('');
  });
});

describe('cameraFor', () => {
  it('stays between the back limits for every shape of screen', () => {
    for (let aspect = 0.4; aspect <= 2.4; aspect += 0.05) {
      const { back, height } = cameraFor(aspect);
      expect(back).toBeGreaterThanOrEqual(BACK_MIN);
      expect(back).toBeLessThanOrEqual(BACK_MAX);
      expect(height).toBeCloseTo(back * 0.55);
    }
  });

  it('fits all ten lanes in landscape and lanes 2 to 9 in portrait', () => {
    const half = (aspect: number) =>
      cameraFor(aspect).back * Math.tan((FOV * Math.PI) / 360) * aspect;
    for (const aspect of [1, 1.33, 1.78]) expect(half(aspect)).toBeCloseTo(HALF_FIT, 5);
    for (const aspect of [0.6, 0.75, 0.9]) expect(half(aspect)).toBeCloseTo(HALF_FIT_PORTRAIT, 5);
    // A very thin phone is held at the furthest the camera goes, a little short of the fit.
    expect(cameraFor(0.46).back).toBe(BACK_MAX);
  });
});

describe('voice', () => {
  it('speaks only the lesson lines', () => {
    expect(VOICE_LINES).toEqual(TYPING_VOICE_LINES);
  });

  it('calls speak() nowhere but to hand it to the lesson', () => {
    const dir = resolve(import.meta.dirname, '../src/games/recess-run');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files).toContain('main.ts');
    for (const file of files) {
      const source = readFileSync(resolve(dir, file), 'utf8');
      expect(source, file).not.toMatch(/\bspeak\(/);
    }
    const main = readFileSync(resolve(dir, 'main.ts'), 'utf8');
    expect(main.match(/\bspeak\b/g)?.length).toBe(2);
    expect(main).toMatch(/showKeyLesson\(\{[^}]*\bspeak\b/s);
  });
});

describe('the sustained words a minute on the HUD', () => {
  /** Right keys every `gap` s from `start` to `end`. */
  const keys = (gap: number, start: number, end: number): number[] => {
    const out: number[] = [];
    for (let at = start; at <= end + 1e-9; at += gap) out.push(at);
    return out;
  };

  it('is 0 before the first right key', () => {
    expect(sustainedWpm([], null, 5)).toBe(0);
  });

  it('matches steady typing once the window is full, whatever the speed', () => {
    for (const kps of [0.4, 1, 2.5, 6]) {
      const times = keys(1 / kps, 1, 30);
      expect(sustainedWpm(times, 1, 30)).toBeCloseTo(kps * 12, 0);
    }
  });

  it('holds steady between keys, unlike the key-to-key rate', () => {
    // Uneven typing: quick pairs, then a long gap, averaging 1 key a second.
    const times: number[] = [];
    for (let at = 1; at < 40; at += 2) times.push(at, at + 0.2);
    const seen: number[] = [];
    for (let now = 20; now < 40; now += 0.05) seen.push(sustainedWpm(times, 1, now));
    expect(Math.max(...seen) - Math.min(...seen)).toBeLessThan(3);
    for (const w of seen) expect(w).toBeGreaterThan(9);
  });

  it('falls when the player stops and reaches 0 after a whole window', () => {
    const times = keys(0.5, 1, 20);
    const typing = sustainedWpm(times, 1, 20);
    expect(sustainedWpm(times, 1, 25)).toBeLessThan(typing * 0.6);
    expect(sustainedWpm(times, 1, 20 + WPM_WINDOW + 0.1)).toBe(0);
  });

  it('counts the first seconds over at least WPM_MIN_SPAN', () => {
    expect(sustainedWpm([1], 1, 1)).toBeCloseTo(1 / 5 / (WPM_MIN_SPAN / 60));
  });

  it('eases the shown number towards the sustained one without overshooting', () => {
    for (let i = 0; i < runs(200, 40); i++) {
      const shown = Math.random() * 60;
      const target = Math.random() * 60;
      const next = easeWpm(shown, target, Math.random() * 0.2);
      expect(Math.abs(target - next)).toBeLessThanOrEqual(Math.abs(target - shown) + 1e-9);
    }
    expect(easeWpm(3, 20, 5)).toBe(20);
  });
});
