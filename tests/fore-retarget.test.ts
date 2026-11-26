import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { restOffset, twoBoneIK } from '../src/games/fore/retarget';
import { runs } from './helpers/full';

/** A seeded stream of numbers in -1..1, so the tests do not use Math.random. */
function stream(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0x100000000) * 2 - 1;
  };
}

/** Where the end lands after applying the two deltas to a limb. */
function solved(root: Vector3, mid: Vector3, end: Vector3, target: Vector3, pole: Vector3) {
  const [dRoot, dMid] = twoBoneIK(root, mid, end, target, pole);
  const mid1 = mid.clone().sub(root).applyQuaternion(dRoot).add(root);
  const end1 = end.clone().sub(root).applyQuaternion(dRoot).add(root);
  const end2 = end1.sub(mid1).applyQuaternion(dMid).add(mid1);
  return { mid: mid1, end: end2 };
}

describe('twoBoneIK', () => {
  const root = new Vector3(0, 0, 0);
  const mid = new Vector3(0.4, 0, 0);
  const end = new Vector3(0.7, 0, 0);

  it('puts the end on a reachable target and keeps the bone lengths', () => {
    const next = stream(7);
    for (let i = 0; i < runs(400, 60); i++) {
      const dir = new Vector3(next(), next(), next()).normalize();
      const target = dir.multiplyScalar(0.12 + 0.55 * Math.abs(next()));
      const pole = new Vector3(next(), next(), next());
      const out = solved(root, mid, end, target, pole);
      expect(out.end.distanceTo(target)).toBeLessThan(1e-4);
      expect(out.mid.distanceTo(root)).toBeCloseTo(0.4, 4);
      expect(out.end.distanceTo(out.mid)).toBeCloseTo(0.3, 4);
    }
  });

  it('bends the middle joint towards the pole', () => {
    const target = new Vector3(0.1, -0.5, 0.2);
    for (const pole of [new Vector3(0, 0, 1), new Vector3(0, 0, -1), new Vector3(1, 0, 0)]) {
      const out = solved(root, mid, end, target, pole.clone().multiplyScalar(2));
      const axis = target.clone().normalize();
      const side = pole.clone().addScaledVector(axis, -pole.dot(axis));
      expect(out.mid.clone().addScaledVector(axis, -out.mid.dot(axis)).dot(side)).toBeGreaterThan(
        0,
      );
    }
  });

  it('clamps an unreachable target to a straight limb pointing at it', () => {
    const target = new Vector3(0, 3, 0);
    const out = solved(root, mid, end, target, new Vector3(0, 0, 1));
    expect(out.end.distanceTo(new Vector3(0, 0.7, 0))).toBeLessThan(1e-3);
    expect(out.mid.distanceTo(new Vector3(0, 0.4, 0))).toBeLessThan(1e-3);
  });

  it('leaves a limb that is already there where it is', () => {
    const out = solved(root, mid, end, end.clone(), new Vector3(0, 1, 0));
    expect(out.end.distanceTo(end)).toBeLessThan(1e-4);
  });
});

describe('restOffset', () => {
  it('round-trips: rest times offset is the bone rest', () => {
    const next = stream(3);
    for (let i = 0; i < runs(200, 30); i++) {
      const rig = new Quaternion(next(), next(), next(), next() + 2).normalize();
      const bone = new Quaternion(next(), next(), next(), next() + 2).normalize();
      const back = rig.clone().multiply(restOffset(rig, bone));
      expect(back.angleTo(bone)).toBeLessThan(1e-6);
    }
  });
});
