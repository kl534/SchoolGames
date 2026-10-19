import { describe, expect, it } from 'vitest';
import { runs } from './helpers/full';
import {
  createTapGate,
  NUDGE_EVERY,
  NUDGE_FIRST,
  TAP_CAPTION,
  TAP_GUARD,
  TAP_SPEECH,
} from '../src/shared/tapgate';

describe('constants', () => {
  it('match the design', () => {
    expect(TAP_GUARD).toBe(0.6);
    expect(NUDGE_FIRST).toBe(6);
    expect(NUDGE_EVERY).toBe(10);
    expect(TAP_CAPTION).toBe('Tap the green answer to go on');
    expect(TAP_SPEECH).toBe('Tap the green answer to go on.');
  });
});

describe('tap', () => {
  it('is idle when not armed', () => {
    const gate = createTapGate();
    expect(gate.armed).toBe(false);
    expect(gate.correctIndex).toBe(-1);
    expect(gate.tap(0)).toBe('idle');
    gate.update(10);
    expect(gate.tap(0)).toBe('idle');
  });

  it('is early for any index inside the guard', () => {
    const gate = createTapGate();
    gate.arm(2);
    expect(gate.tap(2)).toBe('early');
    expect(gate.tap(1)).toBe('early');
    gate.update(0.59);
    expect(gate.tap(2)).toBe('early');
    expect(gate.tap(0)).toBe('early');
    expect(gate.armed).toBe(true);
  });

  it('goes on the right answer after the guard, and disarms', () => {
    const gate = createTapGate();
    gate.arm(2);
    gate.update(0.59);
    gate.update(0.01);
    expect(gate.tap(2)).toBe('go');
    expect(gate.armed).toBe(false);
    expect(gate.correctIndex).toBe(-1);
    expect(gate.tap(2)).toBe('idle');
  });

  it('says nope to a wrong answer after the guard and stays armed', () => {
    const gate = createTapGate();
    gate.arm(2);
    gate.update(TAP_GUARD);
    expect(gate.tap(0)).toBe('nope');
    expect(gate.tap(3)).toBe('nope');
    expect(gate.armed).toBe(true);
    expect(gate.correctIndex).toBe(2);
    expect(gate.tap(2)).toBe('go');
  });

  it('counts game seconds since arm', () => {
    const gate = createTapGate();
    gate.arm(0);
    gate.update(0.25);
    gate.update(0.5);
    expect(gate.sinceArmed).toBeCloseTo(0.75);
  });
});

describe('reminders', () => {
  const armed = () => {
    const gate = createTapGate();
    gate.arm(1);
    return gate;
  };

  it('never come before readFinished', () => {
    const gate = armed();
    for (let i = 0; i < 100; i++) expect(gate.update(1)).toBeNull();
    expect(gate.nudges).toBe(0);
  });

  it('come at 6, 16 and 26 seconds after reading ends', () => {
    const gate = armed();
    gate.readFinished();
    expect(gate.update(5.99)).toBeNull();
    expect(gate.update(0.01)).toBe('nudge');
    expect(gate.nudges).toBe(1);
    expect(gate.update(9.99)).toBeNull();
    expect(gate.update(0.01)).toBe('nudge');
    expect(gate.nudges).toBe(2);
    expect(gate.update(9.99)).toBeNull();
    expect(gate.update(0.01)).toBe('nudge');
    expect(gate.nudges).toBe(3);
  });

  it('come on the same schedule at frame rate', () => {
    const gate = armed();
    gate.readFinished();
    const at: number[] = [];
    for (let frame = 1; frame <= 60 * 30; frame++) {
      if (gate.update(1 / 60) === 'nudge') at.push(Math.round(frame / 60));
    }
    expect(at).toEqual([6, 16, 26]);
  });

  it('give at most one reminder per call', () => {
    const gate = armed();
    gate.readFinished();
    expect(gate.update(100)).toBe('nudge');
    expect(gate.nudges).toBe(1);
    expect(gate.update(0)).toBeNull();
  });

  it('restart after a wrong tap', () => {
    const gate = armed();
    gate.update(1);
    gate.readFinished();
    gate.update(5);
    expect(gate.tap(0)).toBe('nope');
    expect(gate.update(5.99)).toBeNull();
    expect(gate.update(0.01)).toBe('nudge');
  });

  it('are not restarted by a tap inside the guard', () => {
    const gate = armed();
    gate.readFinished();
    gate.update(0.3);
    expect(gate.tap(0)).toBe('early');
    expect(gate.update(5.7)).toBe('nudge');
  });

  it('start over on arm', () => {
    const gate = armed();
    gate.readFinished();
    expect(gate.update(7)).toBe('nudge');
    gate.arm(3);
    expect(gate.correctIndex).toBe(3);
    expect(gate.sinceArmed).toBe(0);
    expect(gate.nudges).toBe(0);
    expect(gate.update(100)).toBeNull();
    gate.readFinished();
    expect(gate.update(6)).toBe('nudge');
    expect(gate.nudges).toBe(1);
  });

  it('stop on disarm', () => {
    const gate = armed();
    gate.readFinished();
    gate.disarm();
    expect(gate.armed).toBe(false);
    expect(gate.update(100)).toBeNull();
    expect(gate.nudges).toBe(0);
  });

  it('count from the first readFinished only', () => {
    const gate = armed();
    gate.readFinished();
    gate.update(5);
    gate.readFinished();
    expect(gate.update(1)).toBe('nudge');
  });

  it('ignore readFinished when not armed', () => {
    const gate = createTapGate();
    gate.readFinished();
    gate.arm(0);
    expect(gate.update(100)).toBeNull();
  });
});

describe('random scripts', () => {
  /** A small seeded generator so a failure can be replayed. */
  const mulberry32 = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  it('keeps the invariants over many random scripts', () => {
    for (let seed = 1; seed <= runs(2000, 300); seed++) {
      const random = mulberry32(seed);
      const gate = createTapGate();
      let goes = 0;
      let nudgesBefore = 0;
      for (let step = 0; step < 60; step++) {
        const action = Math.floor(random() * 6);
        const label = `seed ${seed} step ${step}`;
        if (action === 0) {
          gate.arm(Math.floor(random() * 4));
          goes = 0;
          nudgesBefore = 0;
        } else if (action === 1) {
          const wasArmed = gate.armed;
          const result = gate.update(random() * 3);
          if (!wasArmed) expect(result, label).toBeNull();
        } else if (action === 2 || action === 3) {
          const before = gate.sinceArmed;
          const result = gate.tap(Math.floor(random() * 4));
          if (result === 'go') {
            goes++;
            expect(before, label).toBeGreaterThanOrEqual(TAP_GUARD - 1e-6);
            expect(gate.armed, label).toBe(false);
          }
          expect(goes, label).toBeLessThanOrEqual(1);
        } else if (action === 4) {
          gate.readFinished();
        } else {
          gate.disarm();
          expect(gate.armed, label).toBe(false);
        }
        expect(gate.nudges, label).toBeGreaterThanOrEqual(nudgesBefore);
        nudgesBefore = gate.nudges;
      }
    }
  });
});
