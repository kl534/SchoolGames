import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { moveEvents } from '../src/games/cat-dash/moves';
import { OBSTACLE_IDS } from '../src/games/cat-dash/places';
import {
  CAT_CLIPS,
  catCallCurves,
  HISS_SECONDS,
  hissSamples,
  MEOW,
  PURR_BREATHS,
  PURR_SECONDS,
  purrSamples,
  sfx,
  YOWL,
} from '../src/shared/audio';

describe('Cat Dash sounds', () => {
  it('has a function in the shared kit for every sfx event of every move', () => {
    const names = new Set<string>();
    for (const id of OBSTACLE_IDS) {
      for (const outcome of ['clear', 'fail'] as const) {
        for (const variant of [0, 1] as const) {
          for (const e of moveEvents(id, outcome, variant)) {
            if (e.type.startsWith('sfx:')) names.add(e.type.slice(4));
          }
        }
      }
    }
    expect(names.size).toBeGreaterThan(5);
    const kit = sfx as Record<string, unknown>;
    for (const name of names) expect(typeof kit[name], `sfx.${name}`).toBe('function');
  });

  it('has the four new cat sounds', () => {
    for (const name of ['meow', 'yowl', 'purr', 'hiss']) {
      expect(typeof (sfx as Record<string, unknown>)[name]).toBe('function');
    }
  });
});

describe('recorded cat sounds', () => {
  it('has every clip in public/sfx/cat and lists it in SOURCES.md', () => {
    const dir = resolve(import.meta.dirname, '../public/sfx/cat');
    const sources = readFileSync(resolve(dir, 'SOURCES.md'), 'utf8');
    for (const files of Object.values(CAT_CLIPS)) {
      for (const file of files) {
        expect(existsSync(resolve(dir, `${file}.mp3`)), file).toBe(true);
        expect(sources).toContain(`${file}.mp3`);
      }
    }
  });
});

describe('cat call curves', () => {
  for (const [name, call] of [
    ['meow', MEOW],
    ['yowl', YOWL],
  ] as const) {
    it(`shapes a ${name} as "mi-a-ow"`, () => {
      const { pitch, mouth, loud } = catCallCurves(call, () => 0.5);
      const n = pitch.length;
      for (const v of [...pitch, ...mouth, ...loud]) expect(Number.isFinite(v)).toBe(true);
      // The mouth starts shut, opens wide near the peak and closes again into the "ow".
      expect(mouth[0]).toBeLessThan(0.05);
      expect(Math.max(...mouth)).toBeGreaterThan(0.95);
      expect(mouth[n - 1]).toBeLessThan(0.25);
      // The pitch rises to near the peak and falls below where it started.
      const top = pitch.indexOf(Math.max(...pitch));
      expect(Math.abs(top / n - call.peakAt)).toBeLessThan(0.15);
      expect(pitch[n - 1]).toBeLessThan(pitch[0]);
      // It fades in and out, never clipping.
      expect(loud[0]).toBeLessThan(0.05);
      expect(loud[n - 1]).toBeLessThan(0.05);
      expect(Math.max(...loud)).toBeLessThanOrEqual(1);
    });
  }
});

describe('purr and hiss samples', () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const rms = (d: Float32Array, from: number, to: number) => {
    let sum = 0;
    for (let i = from; i < to; i++) sum += d[i] * d[i];
    return Math.sqrt(sum / (to - from));
  };

  it('purrs in pulses, louder breathing out than in, with a pause between', () => {
    const rate = 8000;
    const d = purrSamples(rate, random);
    expect(d.length).toBe(Math.ceil(PURR_SECONDS * rate));
    for (const v of d) expect(Math.abs(v)).toBeLessThan(2);
    const [out, inn] = PURR_BREATHS;
    const at = (s: number) => Math.floor(s * rate);
    const outLevel = rms(d, at(out.from + 0.15), at(out.to - 0.15));
    const inLevel = rms(d, at(inn.from + 0.08), at(inn.to - 0.08));
    expect(outLevel).toBeGreaterThan(inLevel);
    expect(rms(d, at(out.to + 0.02), at(inn.from))).toBeLessThan(outLevel / 4);
    // About 26 pulses a second: count the onsets of the 4 ms loudness envelope in the out breath.
    const frame = rate * 0.004;
    let pulses = 0;
    let armed = true;
    for (let i = at(out.from + 0.1); i + frame < at(out.to - 0.1); i += frame) {
      const level = rms(d, i, i + frame);
      if (armed && level > outLevel * 1.3) {
        pulses++;
        armed = false;
      } else if (level < outLevel * 0.6) armed = true;
    }
    // The middle 0.3 s of the out breath holds about 8 pulses.
    expect(pulses).toBeGreaterThan(5);
    expect(pulses).toBeLessThan(11);
  });

  it('hisses with a spit, then fades to nothing', () => {
    const rate = 8000;
    const d = hissSamples(rate, random);
    expect(d.length).toBe(Math.ceil(HISS_SECONDS * rate));
    const spit = rms(d, 0, rate * 0.02);
    const body = rms(d, rate * 0.1, rate * 0.3);
    expect(spit).toBeGreaterThan(body);
    expect(rms(d, d.length - rate * 0.03, d.length)).toBeLessThan(body / 5);
  });
});
