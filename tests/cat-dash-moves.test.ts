import { describe, expect, it } from 'vitest';
import {
  MOVE_SPECS,
  MOVE_WORDS,
  createFrame,
  moveDuration,
  moveEvents,
  moveFrame,
  TAU,
} from '../src/games/cat-dash/moves';
import { OBSTACLE_IDS } from '../src/games/cat-dash/places';
import { PROP_BUILDERS } from '../src/games/cat-dash/props/pool';
import { sfx } from '../src/shared/audio';

const OUTCOMES = ['clear', 'fail'] as const;
const VARIANTS = [0, 1] as const;

describe('cat moves', () => {
  it('has 48 obstacles with a spec, two words and a prop builder each', () => {
    expect(OBSTACLE_IDS.length).toBe(48);
    for (const id of OBSTACLE_IDS) {
      expect(MOVE_SPECS[id], id).toBeDefined();
      expect(MOVE_WORDS[id], id).toHaveLength(2);
      expect(typeof PROP_BUILDERS[id], `prop builder for ${id}`).toBe('function');
    }
  });

  for (const id of OBSTACLE_IDS) {
    for (const outcome of OUTCOMES) {
      for (const variant of VARIANTS) {
        it(`${id} ${outcome} ${variant} starts running, ends running on the far side`, () => {
          const spec = MOVE_SPECS[id];
          const duration = moveDuration(id, outcome, variant);
          const [min, max] = outcome === 'clear' ? [1.4, 2.2] : [2.2, 3.0];
          expect(duration).toBeGreaterThanOrEqual(min - 1e-6);
          expect(duration).toBeLessThanOrEqual(max + 1e-6);

          const f = createFrame();
          moveFrame(id, outcome, variant, 0, f);
          expect(f.x).toBeCloseTo(0, 5);
          expect(f.y).toBeCloseTo(0, 5);
          expect(f.pose).toBe('run');

          for (let t = 0; t <= duration + 1e-9; t += 1 / 60) {
            moveFrame(id, outcome, variant, t, f);
            for (const key of ['x', 'y', 'rot', 'z', 'sx', 'sy'] as const) {
              expect(Number.isFinite(f[key]), `${key} at ${t}`).toBe(true);
            }
            expect(f.y, `y at ${t}`).toBeGreaterThanOrEqual(spec.floorY - 1e-6);
            expect(f.y, `y at ${t}`).toBeLessThanOrEqual(spec.height + 1.2);
          }

          moveFrame(id, outcome, variant, duration, f);
          expect(Math.abs(f.x - spec.length)).toBeLessThanOrEqual(0.2);
          expect(f.y).toBeCloseTo(0, 5);
          expect(f.pose).toBe('run');
          expect(f.coat).toBe('none');
          expect(f.hat).toBe('none');
          expect(f.visible).toBe(true);
          const turns = f.rot / TAU;
          expect(Math.abs(turns - Math.round(turns))).toBeLessThan(1e-6);
        });

        it(`${id} ${outcome} ${variant} has sound events that exist`, () => {
          const duration = moveDuration(id, outcome, variant);
          const events = moveEvents(id, outcome, variant);
          const kit = sfx as Record<string, unknown>;
          for (const e of events) {
            expect(e.at).toBeGreaterThanOrEqual(0);
            expect(e.at).toBeLessThanOrEqual(duration);
            if (e.type.startsWith('sfx:')) {
              expect(typeof kit[e.type.slice(4)], e.type).toBe('function');
            }
          }
          expect(events.some((e) => e.type === 'word')).toBe(outcome === 'clear');
          expect(events.some((e) => e.type === 'bonk')).toBe(outcome === 'fail');
        });
      }
    }
  }
});
