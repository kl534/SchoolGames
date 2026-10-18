import { describe, expect, it } from 'vitest';
import {
  BIKE_COL,
  FOV,
  fitView,
  GROUND_MARGIN,
  MIN_VIEW_W,
  OBSTACLE_MAX_H,
  playBand,
} from '../src/games/crash-course/layout';
import {
  approach,
  approachProgress,
  BASE_POINTS,
  BIKES,
  COIN_TRAIL,
  easeToward,
  ENTRY_SPEED,
  GREAT_RIDING_SPEECH,
  hitPoints,
  loseBike,
  MAX_GAP,
  megaKinds,
  multiplierFor,
  NEW_HIGH_SCORE_SPEECH,
  nextKind,
  nextStreak,
  nitroSpeed,
  NITRO_MAX,
  OBSTACLE_KINDS,
  OUT_OF_BIKES_SPEECH,
  outOfBikes,
  pickVariant,
  RIDE_SPEED,
  SPEED_MAX,
  startsMega,
  trailLength,
  worldSpeedFactor,
  type ObstacleKind,
  type Variant,
} from '../src/games/crash-course/rules';
import { VOICE_LINES } from '../src/games/crash-course/voice';

/** A small deterministic generator for the random-input checks. */
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('scoring', () => {
  it('pays 150 for an instant answer, 100 for the last moment', () => {
    expect(hitPoints(10, 10, 1)).toBe(150);
    expect(hitPoints(0, 10, 1)).toBe(BASE_POINTS);
    expect(hitPoints(5, 10, 1)).toBe(125);
  });

  it('doubles from a streak of 5 and triples from 10', () => {
    expect(hitPoints(10, 10, 4)).toBe(150);
    expect(hitPoints(10, 10, 5)).toBe(300);
    expect(hitPoints(10, 10, 9)).toBe(300);
    expect(hitPoints(10, 10, 10)).toBe(450);
    expect(hitPoints(0, 10, 12)).toBe(300);
  });

  it('treats a missing clock as no time bonus', () => {
    expect(hitPoints(5, 0, 1)).toBe(BASE_POINTS);
    expect(hitPoints(99, 10, 1)).toBe(150);
  });

  it('steps the multiplier at the streak boundaries', () => {
    expect([0, 1, 4].map(multiplierFor)).toEqual([1, 1, 1]);
    expect([5, 9].map(multiplierFor)).toEqual([2, 2]);
    expect([10, 50].map(multiplierFor)).toEqual([3, 3]);
  });

  it('counts the streak up on a hit and resets it on a miss', () => {
    expect(nextStreak(3, true)).toBe(4);
    expect(nextStreak(3, false)).toBe(0);
  });

  it('loses one bike at a time and never goes below zero', () => {
    expect(loseBike(BIKES)).toBe(2);
    expect(loseBike(1)).toBe(0);
    expect(loseBike(0)).toBe(0);
    expect(outOfBikes(1)).toBe(false);
    expect(outOfBikes(0)).toBe(true);
  });

  it('speeds the world up by 5% per obstacle, up to 1.6', () => {
    expect(worldSpeedFactor(0)).toBe(1);
    expect(worldSpeedFactor(4)).toBeCloseTo(1.2);
    expect(worldSpeedFactor(12)).toBeCloseTo(1.6);
    expect(worldSpeedFactor(100)).toBe(SPEED_MAX);
    expect(worldSpeedFactor(-3)).toBe(1);
  });

  it('eases towards a goal without overshooting', () => {
    expect(easeToward(0, 10, 5, 0)).toBe(0);
    const step = easeToward(0, 10, 5, 0.1);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(10);
    expect(easeToward(0, 10, 5, 100)).toBeCloseTo(10);
  });
});

describe('obstacle order', () => {
  it('can pick every kind when nothing came before', () => {
    const seen = new Set<ObstacleKind>();
    for (let i = 0; i < 700; i++) seen.add(nextKind(null, i / 700));
    expect([...seen].sort()).toEqual([...OBSTACLE_KINDS].sort());
  });

  it('never repeats the previous kind', () => {
    for (const kind of OBSTACLE_KINDS) {
      const seen = new Set<ObstacleKind>();
      for (let i = 0; i < 600; i++) {
        const next = nextKind(kind, i / 600);
        expect(next).not.toBe(kind);
        expect(OBSTACLE_KINDS).toContain(next);
        seen.add(next);
      }
      expect(seen.size).toBe(OBSTACLE_KINDS.length - 1);
    }
  });

  it('picks by index among the allowed kinds, in order', () => {
    expect(nextKind(null, 0)).toBe('loop');
    expect(nextKind('loop', 0)).toBe('ramp');
    expect(nextKind('loop', 0.999)).toBe('coaster');
    expect(nextKind('coaster', 0.999)).toBe('seesaw');
  });

  it('never repeats over 1000 random pairs', () => {
    const random = lcg(7);
    for (let i = 0; i < 1000; i++) {
      const first = nextKind(null, random());
      expect(nextKind(first, random())).not.toBe(first);
    }
  });

  it('starts a Mega Stunt at 8, 16, 24 and nowhere else', () => {
    for (let n = 0; n <= 7; n++) expect(startsMega(n)).toBe(false);
    for (const n of [8, 16, 24]) expect(startsMega(n)).toBe(true);
    for (const n of [9, 15, 17, 23]) expect(startsMega(n)).toBe(false);
  });

  it('gives a Mega Stunt three different kinds, none the previous one', () => {
    const random = lcg(11);
    for (let i = 0; i < 1000; i++) {
      const previous = i % 8 === 7 ? null : OBSTACLE_KINDS[i % 7];
      const kinds = megaKinds(previous, [random(), random(), random()]);
      expect(kinds).toHaveLength(3);
      expect(new Set(kinds).size).toBe(3);
      expect(kinds[0]).not.toBe(previous);
      for (const kind of kinds) {
        expect(OBSTACLE_KINDS).toContain(kind);
        expect(kind).not.toBe(previous);
      }
    }
  });

  it('picks the first variant at random, then alternates', () => {
    expect(pickVariant(undefined, 0.2)).toBe(0);
    expect(pickVariant(undefined, 0.7)).toBe(1);
    for (const r of [0, 0.3, 0.5, 0.99]) {
      expect(pickVariant(0, r)).toBe(1);
      expect(pickVariant(1, r)).toBe(0);
    }
    let last: Variant | undefined;
    for (let i = 0; i < 10; i++) {
      const next = pickVariant(last, 0.4);
      expect(next).not.toBe(last);
      last = next;
    }
  });
});

describe('the approach', () => {
  it('puts the obstacle past the edge of the screen and no further than MAX_GAP', () => {
    for (const clock of [5, 10, 15]) {
      for (const cleared of [0, 5, 20]) {
        for (let ahead = 5; ahead <= 25; ahead += 1.5) {
          const { gap, rideSpeed } = approach(cleared, clock, ahead);
          if (ahead + 6 > MAX_GAP) expect(gap).toBe(MAX_GAP);
          else expect(gap).toBeGreaterThanOrEqual(ahead + 6);
          expect(gap).toBeLessThanOrEqual(MAX_GAP);
          expect(rideSpeed * clock).toBeCloseTo(gap, 9);
        }
      }
    }
  });

  it('rides at the world speed for short clocks and a small screen', () => {
    for (const cleared of [0, 5, 20]) {
      const gap = approach(cleared, 5, 5).gap;
      expect(gap).toBeCloseTo(RIDE_SPEED * worldSpeedFactor(cleared) * 5, 9);
    }
  });

  it('caps the gap on a long clock, riding slower so it arrives as the clock ends', () => {
    const { gap, rideSpeed } = approach(20, 15, 12);
    expect(gap).toBe(MAX_GAP);
    expect(rideSpeed).toBeCloseTo(MAX_GAP / 15, 9);
  });

  it('never divides by a clock shorter than a second', () => {
    const { gap, rideSpeed } = approach(0, 0, 10);
    expect(Number.isFinite(gap)).toBe(true);
    expect(rideSpeed).toBeCloseTo(gap, 9);
  });

  it('holds the invariant over random inputs', () => {
    const random = lcg(3);
    for (let i = 0; i < 1000; i++) {
      const clock = 1 + random() * 14;
      const { gap, rideSpeed } = approach(Math.floor(random() * 30), clock, 4 + random() * 30);
      expect(rideSpeed * clock).toBeCloseTo(gap, 9);
    }
  });

  it('nitro speed grows with the gap between the entry speed and the maximum', () => {
    expect(nitroSpeed(0)).toBe(ENTRY_SPEED);
    expect(nitroSpeed(9)).toBe(ENTRY_SPEED);
    expect(nitroSpeed(40.5)).toBe(NITRO_MAX);
    expect(nitroSpeed(70)).toBe(NITRO_MAX);
    let last = 0;
    for (let gap = 0; gap <= 70; gap += 1) {
      const speed = nitroSpeed(gap);
      expect(speed).toBeGreaterThanOrEqual(ENTRY_SPEED);
      expect(speed).toBeLessThanOrEqual(NITRO_MAX);
      expect(speed).toBeGreaterThanOrEqual(last);
      last = speed;
    }
  });

  it('measures progress from the start of the clock to the arrival', () => {
    expect(approachProgress(10, 10)).toBe(0);
    expect(approachProgress(0, 10)).toBe(1);
    expect(approachProgress(2.5, 10)).toBeCloseTo(0.75);
    expect(approachProgress(-1, 10)).toBe(1);
    expect(approachProgress(20, 10)).toBe(0);
    expect(approachProgress(5, 0)).toBe(1);
  });
});

describe('coins', () => {
  it('lays trails of 3, 4 or 5', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(trailLength(i / 300));
    expect([...seen].sort()).toEqual([...COIN_TRAIL].sort());
    expect(trailLength(0)).toBe(3);
    expect(trailLength(0.5)).toBe(4);
    expect(trailLength(0.999)).toBe(5);
  });
});

describe('layout', () => {
  const sizes: [number, number][] = [
    [390, 844],
    [844, 390],
    [1024, 768],
    [1366, 1024],
    [360, 640],
    [768, 1024],
    [1920, 1080],
  ];

  it.each(sizes)('fits the stunts and the road between the HUD at %i x %i', (w, h) => {
    const band = playBand(w, h);
    const fit = fitView(w, h);
    expect(band.bottom).toBeGreaterThan(band.top);
    expect(fit.groundRow).toBeGreaterThan(band.top);
    expect(fit.groundRow).toBeLessThan(band.bottom);
    expect(fit.groundRow - OBSTACLE_MAX_H * fit.ppu).toBeGreaterThanOrEqual(band.top - 1);
    expect(fit.groundRow + GROUND_MARGIN * fit.ppu).toBeLessThanOrEqual(band.bottom + 1);
    expect(fit.viewW).toBeGreaterThanOrEqual(MIN_VIEW_W - 1e-9);
    expect(fit.ahead).toBeCloseTo(fit.viewW * (1 - BIKE_COL), 12);
    for (const value of Object.values(fit)) expect(Number.isFinite(value)).toBe(true);
  });

  it('keeps the camera consistent with the road row', () => {
    for (const [w, h] of sizes) {
      const fit = fitView(w, h);
      // A point on the road, seen through the narrow lens, lands on the road's row.
      const tan = Math.tan((FOV * Math.PI) / 360);
      const rowAtRoad = h / 2 + (fit.camY / fit.distance / tan) * (h / 2);
      expect(rowAtRoad).toBeCloseTo(fit.groundRow, 6);
      expect(fit.viewH).toBeCloseTo(h / fit.ppu, 9);
    }
  });

  it('matches the numbers in the design for the main sizes', () => {
    const portrait = fitView(390, 844);
    expect(portrait.ppu).toBeCloseTo(32.5, 1);
    expect(portrait.viewW).toBeCloseTo(12, 6);
    expect(portrait.groundRow).toBeCloseTo(563, 0);
    const landscape = fitView(844, 390);
    expect(landscape.ppu).toBeCloseTo(25.6, 1);
    expect(landscape.groundRow).toBeCloseTo(280.4, 0);
    expect(playBand(844, 390)).toEqual({ top: 96, bottom: 306 });
    expect(playBand(390, 844)).toEqual({ top: 250, bottom: 674 });
    expect(playBand(1024, 768)).toEqual({ top: 118, bottom: 668 });
  });
});

describe('voice', () => {
  it('lists the three lines the game speaks', () => {
    expect(VOICE_LINES).toEqual([OUT_OF_BIKES_SPEECH, NEW_HIGH_SCORE_SPEECH, GREAT_RIDING_SPEECH]);
    expect(VOICE_LINES.length).toBeGreaterThan(0);
    for (const line of VOICE_LINES) expect(line.trim().length).toBeGreaterThan(0);
  });
});
