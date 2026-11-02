import { describe, expect, it } from 'vitest';
import {
  DANCE_PERIOD,
  DANCES,
  pickDance,
  writeDance,
  yawToward,
  type DanceId,
  type DanceLimb,
  type DancePose,
} from '../src/shared/dances';
import { devDance } from '../src/shared/dances/dev';
import { runs } from './helpers/full';

const limb = (): DanceLimb => ({ raise: 9, out: 9, bend: 9 });
const blank = (v = 0): DancePose => ({
  lift: v,
  lean: v,
  twist: v,
  headPitch: v,
  headYaw: v,
  roll: v,
  armL: { raise: v, out: v, bend: v },
  armR: { raise: v, out: v, bend: v },
  legL: { raise: v, out: v, bend: v },
  legR: { raise: v, out: v, bend: v },
});
const at = (id: DanceId, t: number): DancePose => {
  const pose = blank(9);
  writeDance(pose, id, t);
  return pose;
};
const numbers = (p: DancePose): number[] => [
  p.lift,
  p.lean,
  p.twist,
  p.headPitch,
  p.headYaw,
  p.roll,
  ...[p.armL, p.armR, p.legL, p.legR].flatMap((l) => [l.raise, l.out, l.bend]),
];
const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

describe('dances', () => {
  it('has ten distinct dances with a period each', () => {
    expect(DANCES).toHaveLength(10);
    expect(new Set(DANCES).size).toBe(10);
    for (const id of DANCES) expect(DANCE_PERIOD[id]).toBeGreaterThan(0);
  });

  it('stays finite and inside the rig limits for 12 seconds', () => {
    const step = runs(0.01, 0.05);
    for (const id of DANCES) {
      for (let t = 0; t <= 12; t += step) {
        const p = at(id, t);
        for (const v of numbers(p)) expect(Number.isFinite(v)).toBe(true);
        for (const a of [p.armL, p.armR]) {
          expect(inRange(a.raise, -1.2, 3.2), `${id} arm raise ${a.raise}`).toBe(true);
          expect(inRange(a.out, -1, 1.6), `${id} arm out ${a.out}`).toBe(true);
          expect(inRange(a.bend, 0, 2.6), `${id} arm bend ${a.bend}`).toBe(true);
        }
        for (const l of [p.legL, p.legR]) {
          expect(inRange(l.raise, -0.6, 1.6), `${id} leg raise ${l.raise}`).toBe(true);
          expect(inRange(l.out, -0.4, 0.6), `${id} leg out ${l.out}`).toBe(true);
          expect(inRange(l.bend, 0, 2.4), `${id} leg bend ${l.bend}`).toBe(true);
        }
        expect(Math.abs(p.lift)).toBeLessThanOrEqual(0.15);
        expect(Math.abs(p.twist)).toBeLessThanOrEqual(0.8);
        expect(Math.abs(p.roll)).toBeLessThanOrEqual(0.3);
        expect(Math.abs(p.lean)).toBeLessThanOrEqual(0.4);
        expect(Math.abs(p.headPitch)).toBeLessThanOrEqual(0.6);
        expect(Math.abs(p.headYaw)).toBeLessThanOrEqual(0.7);
      }
    }
  });

  it('loops every period', () => {
    for (const id of DANCES) {
      for (let i = 0; i < 50; i++) {
        const t = Math.random() * 6;
        const a = numbers(at(id, t));
        const b = numbers(at(id, t + DANCE_PERIOD[id]));
        a.forEach((v, k) => expect(v).toBeCloseTo(b[k], 6));
      }
    }
  });

  it('moves: some limb changes by more than 0.3 over a period', () => {
    for (const id of DANCES) {
      const lo: number[] = Array(12).fill(Infinity);
      const hi: number[] = Array(12).fill(-Infinity);
      for (let i = 0; i < 200; i++) {
        const p = at(id, (i / 200) * DANCE_PERIOD[id]);
        [p.armL, p.armR, p.legL, p.legR]
          .flatMap((l) => [l.raise, l.out, l.bend])
          .forEach((v, k) => {
            lo[k] = Math.min(lo[k], v);
            hi[k] = Math.max(hi[k], v);
          });
      }
      expect(Math.max(...hi.map((h, k) => h - lo[k])), id).toBeGreaterThan(0.3);
    }
  });

  it('every pair of dances differs by more than 0.5 somewhere in 2 s', () => {
    for (let i = 0; i < DANCES.length; i++) {
      for (let j = i + 1; j < DANCES.length; j++) {
        let best = 0;
        for (let s = 0; s < 20; s++) {
          const a = numbers(at(DANCES[i], s * 0.1));
          const b = numbers(at(DANCES[j], s * 0.1));
          best = Math.max(best, a.reduce((sum, v, k) => sum + Math.abs(v - b[k]), 0));
        }
        expect(best, `${DANCES[i]} vs ${DANCES[j]}`).toBeGreaterThan(0.5);
      }
    }
  });

  it('overwrites every field', () => {
    for (const id of DANCES) {
      const pose = blank(9);
      pose.armL = limb();
      writeDance(pose, id, 0.3);
      expect(numbers(pose)).not.toContain(9);
    }
  });

  it('floss: the arms swing together, front one way and behind the other', () => {
    const period = DANCE_PERIOD.floss;
    let front = false;
    let behind = false;
    for (let i = 0; i < 100; i++) {
      const t = (i / 100) * period;
      const p = at('floss', t);
      if (Math.sin((2 * Math.PI * t) / period) > 0.5) expect(p.armL.out).toBeGreaterThan(p.armR.out);
      expect(Math.sign(p.armL.raise) * Math.sign(p.armR.raise)).toBeGreaterThanOrEqual(0);
      if (p.armL.raise > 0.1) front = true;
      if (p.armL.raise < -0.1) behind = true;
    }
    expect(front && behind).toBe(true);
  });

  it('dab: the two dabs are mirror images', () => {
    const a = at('dab', 0.3 * DANCE_PERIOD.dab);
    const b = at('dab', 0.8 * DANCE_PERIOD.dab);
    expect(a.armL).toEqual(b.armR);
    expect(a.armR).toEqual(b.armL);
    expect(a.headYaw).toBeCloseTo(-b.headYaw, 9);
    expect(a.twist).toBeCloseTo(-b.twist, 9);
  });

  it('picks every dance and nothing else', () => {
    const picked = DANCES.map((_, i) => pickDance(() => i / 10 + 0.05));
    expect(picked).toEqual([...DANCES]);
    expect(DANCES).toContain(pickDance());
    expect(pickDance(() => 0.999999)).toBe('twist');
  });

  it('reads ?dance= in a dev build', () => {
    expect(devDance('?dance=floss')).toBe('floss');
    expect(devDance('?dance=moonwalk')).toBeNull();
    expect(devDance('')).toBeNull();
  });

  it('turns to face a point', () => {
    expect(yawToward({ x: 0, z: 0 }, { x: 0, z: 5 })).toBe(0);
    expect(yawToward({ x: 0, z: 0 }, { x: 5, z: 0 })).toBeCloseTo(Math.PI / 2, 9);
  });
});
