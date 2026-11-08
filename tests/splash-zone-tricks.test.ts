import { describe, expect, it } from 'vitest';
import { seatOf, surfaceY, swell } from '../src/games/splash-zone/anim';
import {
  TRICK_IDS,
  TRICK_NAMES,
  TRICK_TIER,
  TIER_LAUNCHER,
  type Outcome,
  type TrickId,
} from '../src/games/splash-zone/rules';
import {
  RESPAWN_TIME,
  SLOW_RATE,
  TAU,
  TRICK_SPECS,
  createFrame,
  respawnFrame,
  trickDuration,
  trickEvents,
  trickFrame,
  trickRate,
  trickWord,
  type Frame,
} from '../src/games/splash-zone/tricks';

const OUTCOMES: Outcome[] = ['clear', 'fail'];
const FPS = 60;
const DT = 1 / FPS;

const cases: [TrickId, Outcome][] = TRICK_IDS.flatMap((id) =>
  OUTCOMES.map((outcome): [TrickId, Outcome] => [id, outcome]),
);

/** Total turns the ski makes by the end of a clear, per the design. */
const TURNS: Partial<Record<TrickId, { axis: 'pitch' | 'roll' | 'yaw'; turns: number }>> = {
  backflip: { axis: 'pitch', turns: 1 },
  'double-backflip': { axis: 'pitch', turns: 2 },
  'barrel-roll': { axis: 'roll', turns: 1 },
  corkscrew: { axis: 'roll', turns: 2 },
  helicopter: { axis: 'yaw', turns: 2 },
  'spray-spin': { axis: 'yaw', turns: 1 },
};

/** Tier 3 clears slow down at the top; two wipeouts have a big moment of their own. */
const SLOW_MOMENTS = new Set([
  'double-backflip:clear',
  'submarine:clear',
  'corkscrew:clear',
  'double-backflip:fail',
  'corkscrew:fail',
]);

const CLEAR_SECONDS: [number, number] = [2.0, 5.5];
const FAIL_SECONDS: [number, number] = [2.5, 6.0];

function skiNumbers(f: Frame): number[] {
  const k = f.ski;
  return [k.d, k.y, k.s, k.pitch, k.roll, k.yaw];
}

function riderNumbers(f: Frame): number[] {
  const r = f.rider;
  return [r.d, r.y, r.s, r.pitch, r.roll, r.yaw];
}

const turnsOff = (angle: number) => Math.abs(angle - TAU * Math.round(angle / TAU));

describe('there are 20 animations', () => {
  it('covers every trick and both outcomes', () => {
    expect(TRICK_IDS).toHaveLength(10);
    expect(cases).toHaveLength(20);
  });

  it('names and words', () => {
    for (const id of TRICK_IDS) {
      expect(trickWord(id, 'clear')).toBe(`${TRICK_NAMES[id].toUpperCase()}!`);
      expect(trickWord(id, 'fail')).toMatch(/^[A-Z -]+!$/);
      expect(trickWord(id, 'fail')).not.toBe(trickWord(id, 'clear'));
    }
  });

  it('every trick uses the launcher of its tier', () => {
    for (const id of TRICK_IDS) {
      expect(TRICK_SPECS[id].launcher).toBe(TIER_LAUNCHER[TRICK_TIER[id]]);
    }
  });
});

describe.each(cases)('%s %s', (id, outcome) => {
  const duration = trickDuration(id, outcome);
  const spec = TRICK_SPECS[id];
  const frames: Frame[] = [];
  for (let t = 0; t <= duration + 1e-9; t += DT)
    frames.push(trickFrame(id, outcome, t, createFrame()));
  frames.push(trickFrame(id, outcome, duration, createFrame()));

  it('lasts as long as the design says', () => {
    const [lo, hi] = outcome === 'clear' ? CLEAR_SECONDS : FAIL_SECONDS;
    expect(duration).toBeGreaterThanOrEqual(lo);
    expect(duration).toBeLessThanOrEqual(hi);
  });

  it('has no NaN anywhere', () => {
    for (const f of frames) {
      for (const n of [...skiNumbers(f), ...riderNumbers(f)]) expect(Number.isFinite(n)).toBe(true);
      for (const dolphin of f.dolphins) {
        expect(Number.isFinite(dolphin.d + dolphin.y + dolphin.s + dolphin.phase)).toBe(true);
      }
    }
  });

  it('starts on the launcher, level, with the rider seated', () => {
    const f = frames[0];
    expect(f.ski.d).toBeCloseTo(0, 9);
    expect(f.ski.y).toBeCloseTo(surfaceY(spec.launcher, 0), 9);
    expect(f.ski.s).toBeCloseTo(0, 9);
    expect(f.ski.pitch).toBeCloseTo(0, 9);
    expect(f.ski.roll).toBeCloseTo(0, 9);
    expect(f.ski.yaw).toBeCloseTo(0, 9);
    expect(f.ski.visible).toBe(true);
    expect(f.rider).toMatchObject({ mode: 'seated', pose: 'ride', face: 'happy' });
    expect(f.dolphins.every((d) => !d.visible)).toBe(true);
  });

  it('never jumps between samples', () => {
    const limit = 60 * DT;
    for (let i = 1; i < frames.length - 1; i++) {
      const a = frames[i - 1];
      const b = frames[i];
      if (a.ski.visible && b.ski.visible) {
        expect(Math.hypot(b.ski.d - a.ski.d, b.ski.y - a.ski.y, b.ski.s - a.ski.s)).toBeLessThan(
          limit,
        );
      }
      if (a.rider.visible && b.rider.visible) {
        expect(
          Math.hypot(b.rider.d - a.rider.d, b.rider.y - a.rider.y, b.rider.s - a.rider.s),
        ).toBeLessThan(limit);
      }
    }
  });

  it('keeps the ski and the rider above the floor, and a seated rider on the seat', () => {
    for (const f of frames) {
      if (f.ski.visible) expect(f.ski.y).toBeGreaterThanOrEqual(spec.floorY - 1e-9);
      if (f.rider.visible) expect(f.rider.y).toBeGreaterThanOrEqual(spec.floorY - 1e-9);
      if (f.rider.mode === 'seated') {
        const seat = seatOf(f.ski);
        expect(f.rider.d).toBeCloseTo(seat.d, 6);
        expect(f.rider.y).toBeCloseTo(seat.y, 6);
        expect(f.rider.s).toBeCloseTo(seat.s, 6);
        expect(f.rider.pitch).toBeCloseTo(f.ski.pitch, 9);
        expect(f.rider.roll).toBeCloseTo(f.ski.roll, 9);
        expect(f.rider.yaw).toBeCloseTo(f.ski.yaw, 9);
      }
    }
  });

  it('only shows the dolphins in the submarine clear', () => {
    const seen = frames.some((f) => f.dolphins.some((d) => d.visible));
    expect(seen).toBe(id === 'submarine' && outcome === 'clear');
  });

  if (outcome === 'clear') {
    it('lands and rides on at its length, level, seated', () => {
      const end = frames[frames.length - 1];
      expect(end.ski.d).toBeCloseTo(spec.length, 6);
      expect(Math.abs(end.ski.y)).toBeLessThanOrEqual(0.3);
      expect(Math.abs(end.ski.s)).toBeLessThanOrEqual(0.05);
      for (const angle of [end.ski.pitch, end.ski.roll, end.ski.yaw]) {
        expect(turnsOff(angle)).toBeLessThan(0.05);
      }
      expect(end.rider.mode).toBe('seated');
      expect(end.rider.pose).toBe('ride');
      expect(end.rider.face).toBe('happy');
    });

    it('turns as often as the table says', () => {
      const end = frames[frames.length - 1];
      const want = TURNS[id];
      for (const axis of ['pitch', 'roll', 'yaw'] as const) {
        const turns = end.ski[axis] / TAU;
        expect(turns).toBeCloseTo(want && want.axis === axis ? want.turns : 0, 1);
      }
    });

    it('never goes backwards', () => {
      for (let i = 1; i < frames.length; i++) {
        expect(frames[i].ski.d).toBeGreaterThanOrEqual(frames[i - 1].ski.d - 1e-9);
      }
    });
  } else {
    it('ends with the rider free, floating and not smiling', () => {
      const end = frames[frames.length - 1];
      expect(end.rider.mode).toBe('free');
      expect(end.rider.pose).toBe('float');
      expect(Math.abs(end.rider.y)).toBeLessThanOrEqual(0.6);
      expect(end.rider.face).not.toBe('happy');
      expect(end.ski.visible).toBe(true);
      expect(Math.abs(end.ski.y)).toBeLessThanOrEqual(0.6);
    });

    it('holds still at the end', () => {
      const a = trickFrame(id, outcome, duration - 0.3, createFrame());
      const b = trickFrame(id, outcome, duration, createFrame());
      expect(Math.abs(a.rider.d - b.rider.d)).toBeLessThan(0.25);
      expect(Math.abs(a.ski.d - b.ski.d)).toBeLessThan(0.25);
    });
  }

  it('has sorted events inside the trick, with what a clear or a fail needs', () => {
    const events = trickEvents(id, outcome);
    expect(events.length).toBeGreaterThan(0);
    for (let i = 0; i < events.length; i++) {
      expect(events[i].at).toBeGreaterThanOrEqual(0);
      expect(events[i].at).toBeLessThanOrEqual(duration);
      if (i > 0) expect(events[i].at).toBeGreaterThanOrEqual(events[i - 1].at);
      for (const n of [events[i].d, events[i].y, events[i].s])
        expect(Number.isFinite(n)).toBe(true);
    }
    const types = new Set(events.map((e) => e.type));
    expect(types.has('word')).toBe(true);
    if (outcome === 'clear') {
      expect(types.has('cheer')).toBe(true);
      expect(types.has('groan')).toBe(false);
    } else {
      expect(types.has('groan')).toBe(true);
      expect(types.has('sfx:splash')).toBe(true);
      expect(types.has('cheer')).toBe(false);
    }
  });

  it('slows down only in tier 3, and never below the slow rate', () => {
    expect(trickRate(id, outcome, 0)).toBe(1);
    expect(trickRate(id, outcome, duration)).toBe(1);
    let lowest = 1;
    for (let t = 0; t <= duration; t += 0.02) {
      const rate = trickRate(id, outcome, t);
      expect(rate).toBeGreaterThanOrEqual(SLOW_RATE - 1e-9);
      expect(rate).toBeLessThanOrEqual(1);
      lowest = Math.min(lowest, rate);
    }
    if (SLOW_MOMENTS.has(`${id}:${outcome}`)) expect(lowest).toBeCloseTo(SLOW_RATE, 6);
    else expect(lowest).toBe(1);
  });
});

describe('the lifeguard respawn', () => {
  it('puts the rider seated on the new ski when it is done', () => {
    const f = respawnFrame(RESPAWN_TIME, undefined, 12, 5, 2);
    expect(f.rider.mode).toBe('seated');
    expect(f.ski.d).toBeCloseTo(12, 6);
    expect(f.ski.s).toBeCloseTo(0, 6);
    const seat = seatOf({ ...createFrame().ski, d: f.ski.d, s: f.ski.s, y: f.ski.y });
    expect(f.rider.d).toBeCloseTo(seat.d, 6);
    expect(f.rider.y).toBeCloseTo(seat.y, 6);
    expect(f.rider.s).toBeCloseTo(seat.s, 6);
    expect(f.rider.face).toBe('happy');
  });

  it('brings the boat in from behind and to the right, then away to the left', () => {
    const start = respawnFrame(0, undefined, 0, -5, 2);
    expect(start.boat.d).toBeLessThan(-25);
    expect(start.boat.s).toBeGreaterThan(5);
    expect(start.rider.mode).toBe('free');
    expect(start.rider.pose).toBe('float');
    const later = respawnFrame(RESPAWN_TIME + 1, undefined, 0, -5, 2);
    expect(later.boat.s).toBeLessThan(start.boat.s);
    expect(later.boat.s).toBeLessThan(0);
    let last = 1;
    for (let t = 0; t < 4; t += 0.05) {
      const frame = respawnFrame(t, undefined, 0, -5, 2);
      expect(frame.boat.opacity).toBeLessThanOrEqual(last + 1e-9);
      last = frame.boat.opacity;
      expect(Number.isFinite(frame.boat.d + frame.boat.s + frame.rider.y + frame.ski.d)).toBe(true);
    }
    expect(respawnFrame(6, undefined, 0, -5, 2).boat.visible).toBe(false);
  });

  it('sinks the old ski out of sight', () => {
    expect(respawnFrame(0).sink).toBe(0);
    expect(respawnFrame(RESPAWN_TIME).sink).toBeCloseTo(-2, 6);
  });

  it('never makes the rider jump between samples', () => {
    let prev = respawnFrame(0, undefined, 0, -5, 2);
    for (let t = DT; t <= RESPAWN_TIME; t += DT) {
      const f = respawnFrame(t, undefined, 0, -5, 2);
      expect(
        Math.hypot(f.rider.d - prev.rider.d, f.rider.y - prev.rider.y, f.rider.s - prev.rider.s),
      ).toBeLessThan(60 * DT);
      prev = { ...f, rider: { ...f.rider } };
    }
  });
});

describe('the chop of the water', () => {
  it('is small and moves', () => {
    for (let x = -50; x <= 50; x += 7) {
      for (let z = -50; z <= 50; z += 9) {
        expect(Math.abs(swell(x, z, 3))).toBeLessThanOrEqual(0.14 + 1e-9);
      }
    }
    expect(swell(1, 2, 0)).not.toBeCloseTo(swell(1, 2, 1), 4);
  });
});
