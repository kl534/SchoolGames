import { describe, expect, it } from 'vitest';
import { runs } from './helpers/full';
import { resetFrame, seatOf, surfaceY, swell } from '../src/games/splash-zone/anim';
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
  'sugar-spin': { axis: 'yaw', turns: 1 },
  'cotton-candy-cloud': { axis: 'yaw', turns: 1 },
  'tail-whip': { axis: 'yaw', turns: 1 },
  'egg-hatch': { axis: 'pitch', turns: 1 },
};

/** Tier 3 clears slow down at the top; two wipeouts have a big moment of their own. */
const SLOW_MOMENTS = new Set([
  'double-backflip:clear',
  'submarine:clear',
  'corkscrew:clear',
  'cotton-candy-cloud:clear',
  'egg-hatch:clear',
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

describe('there are 28 animations', () => {
  it('covers every trick and both outcomes', () => {
    expect(TRICK_IDS).toHaveLength(14);
    expect(cases).toHaveLength(28);
  });

  it('names and words', () => {
    for (const id of TRICK_IDS) {
      // Cotton Candy Cloud shouts a shorter word than its name.
      const clear =
        id === 'cotton-candy-cloud' ? 'COTTON CLOUD!' : `${TRICK_NAMES[id].toUpperCase()}!`;
      expect(trickWord(id, 'clear')).toBe(clear);
      if (id === 'tail-whip') expect(trickWord(id, 'fail')).toBe('WHIFF!');
      if (id === 'egg-hatch') expect(trickWord(id, 'fail')).toBe('CRACKED UP!');
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
    expect(f.cloud.visible).toBe(false);
    expect(f.tail.visible).toBe(false);
    expect(f.egg.visible).toBe(false);
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

  it('only shows the cloud in Cotton Candy Cloud, which ends without it', () => {
    const shown = frames.filter((f) => f.cloud.visible);
    if (id !== 'cotton-candy-cloud') {
      expect(shown).toHaveLength(0);
      return;
    }
    expect(shown.length).toBeGreaterThan(10);
    expect(frames[frames.length - 1].cloud.visible).toBe(false);
    const scales = frames.map((f) => f.cloud.scale);
    expect(Math.max(...scales)).toBeCloseTo(1, 6);
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(0);
    // Up to full size, then down to nothing: one rise and one fall.
    const top = scales.indexOf(1);
    for (let i = 1; i <= top; i++) expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1] - 1e-9);
    const last = scales.lastIndexOf(1);
    for (let i = last + 1; i < scales.length; i++) {
      expect(scales[i]).toBeLessThanOrEqual(scales[i - 1] + 1e-9);
    }
    for (const f of shown) {
      expect(f.ski.y).toBeGreaterThanOrEqual(spec.floorY);
      expect(Number.isFinite(f.cloud.d + f.cloud.y + f.cloud.s + f.cloud.scale)).toBe(true);
    }
  });

  it('only shows the tail in Tail Whip, which ends without it', () => {
    const shown = frames.filter((f) => f.tail.visible);
    if (id !== 'tail-whip') {
      expect(shown).toHaveLength(0);
      return;
    }
    expect(shown.length).toBeGreaterThan(10);
    expect(frames[frames.length - 1].tail.visible).toBe(false);
    for (const f of frames) {
      expect(f.tail.rise).toBeGreaterThanOrEqual(0);
      expect(f.tail.rise).toBeLessThanOrEqual(1);
      expect(Math.abs(f.tail.swing)).toBeLessThanOrEqual(1);
      expect(Number.isFinite(f.tail.d + f.tail.y + f.tail.s)).toBe(true);
    }
  });

  it('only shows the egg in Egg Hatch, which ends without it', () => {
    const shown = frames.filter((f) => f.egg.visible);
    if (id !== 'egg-hatch') {
      expect(shown).toHaveLength(0);
      return;
    }
    expect(shown.length).toBeGreaterThan(10);
    expect(frames[frames.length - 1].egg.visible).toBe(false);
    for (const f of frames) {
      for (const n of [f.egg.scale, f.egg.crack, f.egg.hatch, f.egg.shut]) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
    for (const f of shown) {
      expect(f.ski.y).toBeGreaterThanOrEqual(spec.floorY);
      expect(Number.isFinite(f.egg.d + f.egg.y + f.egg.s)).toBe(true);
    }
    if (outcome === 'fail') expect(Math.max(...frames.map((f) => f.egg.shut))).toBeCloseTo(1, 6);
    else expect(Math.max(...frames.map((f) => f.egg.hatch))).toBeCloseTo(1, 6);
  });

  if (id === 'tail-whip') {
    it('spins a full yaw on a clear and flips over sideways on a fail', () => {
      const end = frames[frames.length - 1].ski;
      if (outcome === 'clear') expect(Math.abs(end.yaw - TAU)).toBeLessThan(0.05);
      else expect(Math.abs(end.roll - Math.PI)).toBeLessThan(0.2);
    });
  }

  if (id === 'sugar-spin') {
    it('spins a full turn on a clear and lands sideways on a fail', () => {
      const yaw = frames[frames.length - 1].ski.yaw;
      if (outcome === 'clear') expect(Math.abs(yaw - TAU)).toBeLessThan(0.05);
      else expect(Math.abs(yaw - Math.PI / 2)).toBeLessThan(0.2);
    });
  }

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

describe('the cloud frame', () => {
  it('starts and resets invisible', () => {
    const f = createFrame();
    expect(f.cloud).toEqual({ d: 0, y: -5, s: 0, scale: 0, visible: false });
    f.cloud.visible = true;
    f.cloud.scale = 1;
    f.cloud.d = 20;
    resetFrame(f);
    expect(f.cloud).toEqual({ d: 0, y: -5, s: 0, scale: 0, visible: false });
  });
});

describe('the tail and egg frames', () => {
  it('start and reset invisible', () => {
    const f = createFrame();
    const tail = { d: 0, y: -5, s: 0, rise: 0, swing: 0, visible: false };
    const egg = { d: 0, y: -5, s: 0, scale: 0, crack: 0, hatch: 0, shut: 0, visible: false };
    expect(f.tail).toEqual(tail);
    expect(f.egg).toEqual(egg);
    f.tail.visible = f.egg.visible = true;
    f.tail.rise = f.egg.scale = f.egg.shut = 1;
    f.tail.d = f.egg.d = 20;
    resetFrame(f);
    expect(f.tail).toEqual(tail);
    expect(f.egg).toEqual(egg);
  });
});

describe('random times in every animation', () => {
  it('always give finite frames', () => {
    let seed = 12345;
    const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const n = runs(400, 100);
    for (const [id, outcome] of cases) {
      const duration = trickDuration(id, outcome);
      for (let i = 0; i < n; i++) {
        const f = trickFrame(id, outcome, random() * duration * 1.1, createFrame());
        for (const v of [...skiNumbers(f), ...riderNumbers(f)])
          expect(Number.isFinite(v)).toBe(true);
        expect(Number.isFinite(f.cloud.d + f.cloud.y + f.cloud.scale)).toBe(true);
        expect(Number.isFinite(f.tail.d + f.tail.y + f.tail.rise + f.tail.swing)).toBe(true);
        expect(Number.isFinite(f.egg.d + f.egg.y + f.egg.scale + f.egg.crack + f.egg.hatch)).toBe(
          true,
        );
      }
    }
  });
});
