import { describe, expect, it } from 'vitest';
import {
  aimThrough,
  lineX,
  MAX_DRIFT,
  thrownAim,
  throwPath,
  type Aim,
} from '../src/games/strike-zone/aim';
import { AIM_LIMIT, HEAD_Z, PIN_IDS, type PinId } from '../src/games/strike-zone/geometry';
import {
  createPhysics,
  FIXED_STEP,
  SETTLE_MIN,
  simulateThrow,
} from '../src/games/strike-zone/physics';

/** Real physics for a whole rack takes a second or so a throw. */
const LONG = 120_000;

const FULL: PinId[] = [...PIN_IDS];

describe('pins', () => {
  it('stand still on their own', { timeout: LONG }, () => {
    const physics = createPhysics();
    physics.rack(FULL);
    for (let i = 0; i < 5 / FIXED_STEP; i++) physics.step(FIXED_STEP, 1);
    expect(physics.standing()).toEqual(FULL);
    for (const id of FULL) {
      const p = physics.pin(id)!;
      expect(p.y).toBeCloseTo(0.15, 3);
    }
  });

  it('are only in the world when they are racked', () => {
    const physics = createPhysics();
    physics.rack([7, 10]);
    expect(physics.standing()).toEqual([7, 10]);
    expect(physics.pin(1)).toBeNull();
    expect(physics.pin(7)).not.toBeNull();
  });
});

describe('the single-pin promise', () => {
  const starts = [-AIM_LIMIT, -0.2, 0, 0.2, AIM_LIMIT];

  it('knocks a lone pin down even when the ball drifts the most', { timeout: LONG }, () => {
    const failures: string[] = [];
    let throws = 0;
    for (const pin of PIN_IDS) {
      for (const startX of starts) {
        const aim = aimThrough(startX, pin);
        for (const side of [-1, 1] as const) {
          const thrown = thrownAim(aim, MAX_DRIFT, side);
          throws++;
          const left = simulateThrow([pin], throwPath(thrown));
          if (left.length) failures.push(`pin ${pin} from ${startX.toFixed(2)} drift ${side}`);
        }
      }
    }
    expect(throws).toBe(100);
    expect(failures).toEqual([]);
  });

  it('knocks it down when the ball goes dead on', { timeout: LONG }, () => {
    const failures: string[] = [];
    let throws = 0;
    for (const pin of PIN_IDS) {
      for (const startX of starts) {
        throws++;
        if (simulateThrow([pin], throwPath(aimThrough(startX, pin))).length) {
          failures.push(`pin ${pin} from ${startX.toFixed(2)}`);
        }
      }
    }
    expect(throws).toBe(50);
    expect(failures).toEqual([]);
  });
});

describe('a full rack', () => {
  it('is knocked over by a ball down the middle', { timeout: LONG }, () => {
    const aims: Aim[] = [];
    for (const startX of [-0.2, 0.1, 0.35]) {
      for (const headX of [0.04, 0.07, 0.1]) aims.push({ startX, headX });
    }
    let strikes = 0;
    for (const aim of aims) {
      const left = simulateThrow(FULL, throwPath(aim));
      const again = simulateThrow(FULL, throwPath(aim));
      expect(again).toEqual(left);
      expect(10 - left.length).toBeGreaterThanOrEqual(3);
      for (const id of left) expect(FULL).toContain(id);
      if (left.length === 0) strikes++;
    }
    console.log(`full rack: ${strikes} strikes in ${aims.length} throws`);
  });
});

describe('a spare ball', () => {
  it('that misses settles early', { timeout: LONG }, () => {
    const physics = createPhysics();
    physics.rack([7]);
    // Down the right edge, far from the 7.
    physics.launch(throwPath({ startX: AIM_LIMIT, headX: AIM_LIMIT }));
    let reachedHead: number | null = null;
    let settledAt: number | null = null;
    for (let i = 0; i < 8 / FIXED_STEP; i++) {
      physics.step(FIXED_STEP, 1);
      if (reachedHead === null && physics.ball().z <= HEAD_Z) reachedHead = physics.time;
      if (physics.settled()) {
        settledAt = physics.time;
        break;
      }
    }
    expect(reachedHead).not.toBeNull();
    expect(settledAt).not.toBeNull();
    expect(physics.standing()).toEqual([7]);
    expect(settledAt! - reachedHead!).toBeLessThanOrEqual(SETTLE_MIN + 0.1);
  });
});

describe('the rails', () => {
  it('put the ball exactly on the aimed line until they end', () => {
    const aim: Aim = { startX: -0.3, headX: 0.12 };
    const physics = createPhysics();
    physics.rack(FULL);
    physics.launch(throwPath(aim));
    let ended = false;
    for (let i = 0; i < 4 / FIXED_STEP && !ended; i++) {
      physics.step(FIXED_STEP, 1);
      const ball = physics.ball();
      if (ball.z <= HEAD_Z + 0.6) {
        expect(Math.abs(ball.x - lineX(aim, ball.z))).toBeLessThan(0.001);
        ended = true;
      } else {
        expect(ball.y).toBeCloseTo(0.108, 5);
        expect(Math.abs(ball.x - lineX(aim, ball.z))).toBeLessThan(1e-6);
      }
    }
    expect(ended).toBe(true);
  });
});
