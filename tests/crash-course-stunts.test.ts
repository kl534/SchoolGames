import { describe, expect, it } from 'vitest';
import { OBSTACLE_MAX_H } from '../src/games/crash-course/layout';
import {
  OBSTACLE_KINDS,
  type ObstacleKind,
  type Outcome,
  type Variant,
} from '../src/games/crash-course/rules';
import {
  arc,
  BIKE_Y,
  createFrame,
  crateAt,
  plankAt,
  SPECS,
  stuntDuration,
  stuntEvents,
  stuntFrame,
  stuntWord,
  TAU,
  track,
  type Frame,
} from '../src/games/crash-course/stunts';

const OUTCOMES: Outcome[] = ['clear', 'crash'];
const VARIANTS: Variant[] = [0, 1];

const cases: [ObstacleKind, Outcome, Variant][] = OBSTACLE_KINDS.flatMap((kind) =>
  OUTCOMES.flatMap((outcome) =>
    VARIANTS.map((variant): [ObstacleKind, Outcome, Variant] => [kind, outcome, variant]),
  ),
);

const FPS = 60;

function numbers(f: Frame): number[] {
  return [
    f.bike.x,
    f.bike.y,
    f.bike.pitch,
    f.bike.roll,
    f.bike.z,
    f.bike.squash,
    f.rider.x,
    f.rider.y,
    f.rider.rot,
  ];
}

const near = (a: number, b: number, tolerance = 0.02) => Math.abs(a - b) <= tolerance;

describe('there are 40 stunts', () => {
  it('covers every kind, outcome and variant', () => {
    expect(cases).toHaveLength(OBSTACLE_KINDS.length * 4);
    expect(OBSTACLE_KINDS).toHaveLength(10);
  });
});

describe.each(cases)('%s %s %i', (kind, outcome, variant) => {
  const duration = stuntDuration(kind, outcome, variant);
  const frame = (t: number) => stuntFrame(kind, outcome, variant, t);
  const spec = SPECS[kind];

  it('lasts between 1.5 and 4 seconds', () => {
    expect(duration).toBeGreaterThanOrEqual(1.5);
    expect(duration).toBeLessThanOrEqual(4.0);
  });

  it('starts as the arrival pose', () => {
    const f = frame(0);
    expect(f.bike.x).toBeCloseTo(0, 9);
    expect(f.bike.y).toBeCloseTo(BIKE_Y, 9);
    expect(f.bike.pitch).toBeCloseTo(0, 9);
    expect(f.bike.roll).toBeCloseTo(0, 9);
    expect(f.bike.z).toBeCloseTo(0, 9);
    expect(f.bike.squash).toBe(1);
    expect(f.bike.grounded).toBe(true);
    expect(f.rider).toMatchObject({ mode: 'seated', pose: 'ride', face: 'happy' });
  });

  if (outcome === 'clear') {
    it('ends riding on the road at the end of the obstacle', () => {
      const f = frame(duration);
      expect(f.bike.x).toBe(spec.length);
      expect(f.bike.y).toBe(BIKE_Y);
      expect(Math.abs(Math.round(f.bike.pitch / TAU) * TAU - f.bike.pitch)).toBeLessThan(1e-6);
      expect(Math.abs(Math.round(f.bike.roll / TAU) * TAU - f.bike.roll)).toBeLessThan(1e-6);
      expect(f.bike.squash).toBe(1);
      expect(f.bike.grounded).toBe(true);
      expect(f.rider).toMatchObject({ mode: 'seated', pose: 'ride', face: 'happy' });
    });

    it('is already settled shortly before the end', () => {
      // The stunt is its own animation; the authored last frames agree with the snapped end.
      const before = frame(duration - 1e-3);
      expect(near(before.bike.x, spec.length, 0.05)).toBe(true);
      expect(near(before.bike.y, BIKE_Y, 0.01)).toBe(true);
      expect(near(before.bike.squash, 1, 0.02)).toBe(true);
    });
  } else {
    it('comes to rest: nothing moves in the last second', () => {
      const a = numbers(frame(duration - 1));
      const b = numbers(frame(duration));
      const labels = ['x', 'y', 'pitch', 'roll', 'z', 'squash', 'rider x', 'rider y', 'rider rot'];
      a.forEach((value, i) => {
        // Compare the turn modulo a full circle: a bike lying where it landed has not moved.
        const delta = Math.abs(value - b[i]);
        const isAngle = i === 2 || i === 3 || i === 8;
        const wrapped = isAngle ? Math.min(delta % TAU, TAU - (delta % TAU)) : delta;
        expect(wrapped, labels[i]).toBeLessThanOrEqual(0.02);
      });
    });
  }

  it('is smooth, finite and never sinks through the floor', () => {
    let last = frame(0);
    for (let t = 1 / FPS; t <= duration + 1e-9; t += 1 / FPS) {
      const f = frame(t);
      for (const n of numbers(f)) expect(Number.isFinite(n)).toBe(true);
      if (outcome === 'clear') expect(f.bike.y).toBeGreaterThanOrEqual(BIKE_Y - 0.05);
      else expect(f.bike.y).toBeGreaterThanOrEqual(spec.floorY + 0.2 - 1e-6);
      expect(
        Math.hypot(f.bike.x - last.bike.x, f.bike.y - last.bike.y),
        `bike at ${t}`,
      ).toBeLessThan(1.2);
      expect(Math.abs(f.bike.pitch - last.bike.pitch), `pitch at ${t}`).toBeLessThan(0.35);
      expect(Math.abs(f.bike.roll - last.bike.roll), `roll at ${t}`).toBeLessThan(0.35);
      if (f.rider.mode === 'free') {
        // The rider's feet (the hips are above them) stay above the floor.
        expect(f.rider.y).toBeGreaterThanOrEqual(spec.floorY - 0.05);
        if (last.rider.mode === 'free') {
          expect(
            Math.hypot(f.rider.x - last.rider.x, f.rider.y - last.rider.y),
            `rider at ${t}`,
          ).toBeLessThan(1.2);
          expect(Math.abs(f.rider.rot - last.rider.rot), `rider turn at ${t}`).toBeLessThan(0.35);
        }
      }
      last = f;
    }
  });

  it('is deterministic', () => {
    for (const t of [0, 0.37, duration / 2, duration - 0.1, duration]) {
      expect(frame(t)).toEqual(frame(t));
    }
  });

  it('clamps time to the stunt and copes with any input', () => {
    expect(frame(-5)).toEqual(frame(0));
    expect(frame(duration + 5)).toEqual(frame(duration));
    for (const t of [-1, duration + 1, 0.123, Number.NaN]) {
      for (const n of numbers(frame(t))) expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('fires sorted events inside the stunt, with one word and the right crowd call', () => {
    const events = stuntEvents(kind, outcome, variant);
    for (let i = 1; i < events.length; i++)
      expect(events[i].at).toBeGreaterThanOrEqual(events[i - 1].at);
    for (const e of events) {
      expect(e.at).toBeGreaterThanOrEqual(0);
      expect(e.at).toBeLessThanOrEqual(duration);
      expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
    }
    expect(events.filter((e) => e.type === 'word')).toHaveLength(1);
    expect(events.some((e) => e.type === 'cheer')).toBe(outcome === 'clear');
    expect(events.some((e) => e.type === 'groan')).toBe(outcome === 'crash');
  });

  it('has a comic word that ends with an exclamation mark', () => {
    const word = stuntWord(kind, outcome, variant);
    expect(word.length).toBeGreaterThan(0);
    expect(word.endsWith('!')).toBe(true);
  });
});

describe.each(
  OBSTACLE_KINDS.flatMap((kind) =>
    OUTCOMES.map((outcome): [ObstacleKind, Outcome] => [kind, outcome]),
  ),
)('%s %s variants', (kind, outcome) => {
  it('look clearly different in the middle', () => {
    const half = Math.min(stuntDuration(kind, outcome, 0), stuntDuration(kind, outcome, 1)) / 2;
    const a = stuntFrame(kind, outcome, 0, half);
    const b = stuntFrame(kind, outcome, 1, half);
    const diffs = [
      Math.abs(a.bike.x - b.bike.x),
      Math.abs(a.bike.y - b.bike.y),
      Math.abs(a.bike.pitch - b.bike.pitch),
      Math.abs(a.bike.roll - b.bike.roll),
      Math.abs(a.rider.x - b.rider.x),
      Math.abs(a.rider.y - b.rider.y),
      a.rider.pose === b.rider.pose ? 0 : 1,
    ];
    expect(Math.max(...diffs)).toBeGreaterThan(0.05);
  });

  it('have different comic words', () => {
    expect(stuntWord(kind, outcome, 0)).not.toBe(stuntWord(kind, outcome, 1));
  });
});

describe('SPECS', () => {
  it.each(OBSTACLE_KINDS)('describes %s', (kind) => {
    expect(SPECS[kind].kind).toBe(kind);
    expect(SPECS[kind].length).toBeGreaterThan(0);
    expect(SPECS[kind].floorY).toBeLessThanOrEqual(0);
    expect(SPECS[kind].height).toBeLessThanOrEqual(OBSTACLE_MAX_H);
  });

  it('puts the pits only under the shark pool and the canyon', () => {
    expect(OBSTACLE_KINDS.filter((kind) => SPECS[kind].floorY < 0).sort()).toEqual([
      'bridge',
      'ramp',
    ]);
  });
});

describe('helpers', () => {
  it('interpolates keys with easing and holds the ends', () => {
    const f = track([
      [1, 10],
      [2, 20, 'l'],
      [3, 20],
    ]);
    expect(f(0)).toBe(10);
    expect(f(1.5)).toBeCloseTo(15, 9);
    expect(f(2.5)).toBe(20);
    expect(f(9)).toBe(20);
  });

  it('draws a hop that peaks at the height asked for', () => {
    let top = -Infinity;
    for (let u = 0; u <= 1; u += 1e-4) top = Math.max(top, arc(1, 0.5, 4, u));
    expect(top).toBeCloseTo(4, 3);
    expect(arc(1, 0.5, 4, 0)).toBeCloseTo(1, 9);
    expect(arc(1, 0.5, 4, 1)).toBeCloseTo(0.5, 9);
  });

  it('creates a fresh frame in the arrival pose', () => {
    const f = createFrame();
    expect(f.bike.y).toBe(BIKE_Y);
    expect(f.rider.pose).toBe('ride');
  });
});

describe('props', () => {
  it('keeps every crate and plank finite and above the floor', () => {
    for (const outcome of OUTCOMES) {
      for (const variant of VARIANTS) {
        for (let t = 0; t <= 4; t += 0.05) {
          for (let i = 0; i < 9; i++) {
            const c = crateAt(outcome, variant, i, t);
            expect([c.x, c.y, c.rot].every(Number.isFinite)).toBe(true);
            if (c.visible) expect(c.y).toBeGreaterThanOrEqual(0.5 - 1e-6);
          }
          for (let i = 0; i < 12; i++) {
            const p = plankAt(outcome, variant, i, t);
            expect([p.x, p.y, p.rot].every(Number.isFinite)).toBe(true);
            expect(p.y).toBeGreaterThanOrEqual(-5 - 1e-6);
          }
        }
      }
    }
  });
});
