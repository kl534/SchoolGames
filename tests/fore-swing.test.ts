import { Box3, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { runs } from './helpers/full';
import { BALL_R } from '../src/games/fore/ball';
import { createCaddie } from '../src/games/fore/caddie';
import { createGolfer, REACH } from '../src/games/fore/golfer';
import { HOLES } from '../src/games/fore/course';
import { CUP_VISUAL_R, buildHole } from '../src/games/fore/hole';
import { neutralPose } from '../src/games/fore/person';
import { CLUBS, CUP_R, holedOutcome } from '../src/games/fore/shot';
import { SWING_TIMING, swingFrame, swingKind, timingFor, type SwingKind } from '../src/games/fore/swing';

const RAD = Math.PI / 180;
const club = (id: string, carry?: number) => {
  const c = CLUBS.find((k) => k.id === id)!;
  return { id, carry: carry ?? c.carry };
};
const kindOf = (id: string, carry?: number) => swingKind(club(id, carry));
const CASES: [string, number | undefined][] = [
  ['driver', undefined],
  ['iron7', undefined],
  ['wedge', undefined],
  ['sand', 30],
  ['putter', undefined],
];

function setup(id: string, carry?: number, dir = 0) {
  const g = createGolfer();
  g.setClub(club(id, carry));
  g.stand({ x: 0, z: 0 }, dir, id);
  const head = g.root.getObjectByName('clubHead')!;
  const grip = g.root.getObjectByName('grip')!;
  const at = (move: 'address' | 'swing' | 'follow', t: number) => {
    g.play(move, t, 1);
    g.root.updateMatrixWorld(true);
  };
  return { g, head, grip, at };
}
const world = (o: { getWorldPosition(v: Vector3): Vector3 }) => o.getWorldPosition(new Vector3());

describe('handedness', () => {
  it('stands side-on with the target on his left, reach from the ball', () => {
    const count = runs(13, 3);
    for (let i = 0; i < count; i++) {
      const dir = -0.6 + (1.2 * i) / (count - 1);
      for (const c of CLUBS) {
        const { g } = setup(c.id, undefined, dir);
        g.root.updateMatrixWorld(true);
        const forward = new Vector3(0, 0, 1).applyQuaternion(g.root.quaternion);
        const left = new Vector3(0, 1, 0).cross(forward);
        expect(left.dot(new Vector3(Math.sin(dir), 0, Math.cos(dir)))).toBeGreaterThan(0.99);
        const toBall = new Vector3(0, 0, 0).sub(g.root.position);
        expect(toBall.dot(forward)).toBeCloseTo(REACH[c.id], 1);
        expect(Math.abs(toBall.length() - REACH[c.id])).toBeLessThan(0.05);
      }
    }
  });
});

describe('sizes', () => {
  it('golfer 2 yd, caddie 1.9 yd, true-size ball, cup and flag', () => {
    const g = createGolfer();
    g.person.apply(neutralPose());
    g.person.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(g.person.root);
    expect(box.max.y - box.min.y).toBeGreaterThan(1.95);
    expect(box.max.y - box.min.y).toBeLessThan(2.05);
    const c = createCaddie();
    c.person.apply(neutralPose());
    c.person.root.updateMatrixWorld(true);
    const cb = new Box3().setFromObject(c.person.root);
    expect(cb.max.y - cb.min.y).toBeGreaterThan(1.85);
    expect(cb.max.y - cb.min.y).toBeLessThan(1.95);
    expect(BALL_R).toBe(0.047);
    expect(CUP_VISUAL_R).toBe(0.06);
    expect(CUP_VISUAL_R).toBeLessThan(CUP_R / 10);
    const hole = buildHole(HOLES[0]);
    hole.object.updateMatrixWorld(true);
    const cup = hole.object.getObjectByName('cup')!;
    expect(Math.abs(cup.scale.x)).toBeCloseTo(CUP_VISUAL_R);
    const pole = new Box3().setFromObject(
      hole.object.children.find((o) => o.position.y === 1.2 && o.name === '')!,
    );
    expect(pole.max.y - pole.min.y).toBeCloseTo(2.4);
    hole.dispose();
  });
});

describe('the grip', () => {
  it('keeps both hands on the shaft, left above right', () => {
    for (const [id, carry] of CASES) {
      const { g, head, grip, at } = setup(id, carry);
      const kind = kindOf(id, carry);
      const seconds = SWING_TIMING[kind].seconds;
      for (let i = 0; i <= 120; i++) {
        at('swing', (i / 120) * seconds);
        const a = world(grip);
        const b = world(head);
        const line = b.clone().sub(a);
        const len = line.length();
        line.normalize();
        const L = g.person.handWorld('L', new Vector3());
        const R = g.person.handWorld('R', new Vector3());
        for (const h of [L, R]) {
          const rel = h.clone().sub(a);
          const off = rel.clone().sub(line.clone().multiplyScalar(rel.dot(line))).length();
          expect(off).toBeLessThan(0.05);
          expect(rel.dot(line)).toBeLessThan(len);
        }
        expect(L.clone().sub(a).dot(line)).toBeLessThan(R.clone().sub(a).dot(line));
        const apart = L.distanceTo(R);
        expect(apart).toBeGreaterThan(0.06);
        expect(apart).toBeLessThan(0.14);
      }
    }
  });
});

describe('address and impact', () => {
  it('rests the head just behind the ball on the ground', () => {
    for (const [id, carry] of CASES) {
      const { head, at } = setup(id, carry, 0.3);
      at('address', 0);
      const h = world(head);
      const ball = new Vector3(0, BALL_R, 0);
      expect(h.distanceTo(ball)).toBeLessThan(0.1);
      expect(h.y).toBeLessThan(0.06);
      expect(ball.clone().sub(h).dot(new Vector3(Math.sin(0.3), 0, Math.cos(0.3)))).toBeGreaterThan(0);
    }
  });

  it('meets the ball at impact with the head at its fastest', () => {
    for (const id of ['driver', 'iron7', 'wedge', 'putter']) {
      const carry = undefined;
      const { head, at } = setup(id, carry);
      const kind = kindOf(id, carry);
      const { impact } = timingFor(club(id, carry));
      at('swing', impact);
      const h = world(head);
      expect(h.distanceTo(new Vector3(0, BALL_R, 0))).toBeLessThan(0.15);
      expect(h.y).toBeLessThan(0.15);
      let best = 0;
      let bestT = 0;
      const step = 1 / 120;
      for (let t = 0; t < SWING_TIMING[kind].seconds - step; t += step) {
        at('swing', t);
        const a = world(head);
        at('swing', t + step);
        const speed = a.distanceTo(world(head)) / step;
        if (speed > best) {
          best = speed;
          bestT = t;
        }
      }
      expect(Math.abs(bestT - impact)).toBeLessThan(0.1);
    }
  });
});

describe('the full swing', () => {
  it('turns about 90 degrees at the top with the head still', () => {
    const { g, head, at } = setup('driver');
    const yaw = () => {
      const q = g.person.torso.getWorldQuaternion(new Quaternion());
      const f = new Vector3(0, 0, 1).applyQuaternion(q);
      return Math.atan2(f.x, f.z);
    };
    at('address', 0);
    const start = yaw();
    const headStart = world(g.person.head);
    at('swing', 0.5);
    const frame = swingFrame('full', 0.5);
    expect(frame.shoulders).toBeGreaterThanOrEqual(80);
    expect(frame.hips).toBeGreaterThan(35);
    expect(frame.hips).toBeLessThan(55);
    expect(Math.abs(yaw() - start) / RAD).toBeGreaterThan(80);
    expect(world(head).y).toBeGreaterThan(1.4);
    expect(world(g.person.head).distanceTo(headStart)).toBeLessThan(0.1);
    // His chest faces away from the target (dot with dir 0 is below zero).
    const chest = new Vector3(0, 0, 1).applyQuaternion(
      g.person.torso.getWorldQuaternion(new Quaternion()),
    );
    expect(chest.z).toBeLessThan(0);
  });

  it('finishes facing the target on the lead foot, and follow holds it', () => {
    const { head, at } = setup('driver');
    const end = SWING_TIMING.full.seconds;
    const frame = swingFrame('full', end);
    expect(-frame.shoulders).toBeGreaterThanOrEqual(80);
    expect(-frame.hips).toBeGreaterThanOrEqual(75);
    expect(frame.slide).toBeGreaterThanOrEqual(0.1);
    expect(frame.trailHeel).toBeGreaterThanOrEqual(0.7);
    at('swing', end);
    expect(world(head).y).toBeGreaterThan(1.2);
    const a = world(head);
    at('follow', 0);
    expect(world(head).distanceTo(a)).toBeLessThan(0.05);
  });
});

describe('smoothness and timing', () => {
  it('moves no angle faster than 0.2 rad a frame, and rests at both ends', () => {
    for (const kind of ['full', 'half', 'putt'] as SwingKind[]) {
      const { seconds } = SWING_TIMING[kind];
      let prev = swingFrame(kind, 0);
      expect(prev.hips + prev.shoulders + prev.arms + prev.cock).toBeCloseTo(0, 6);
      for (let t = 1 / 60; t <= seconds + 1e-9; t += 1 / 60) {
        const f = swingFrame(kind, t);
        for (const k of ['hips', 'shoulders', 'arms', 'cock'] as const) {
          expect(Math.abs(f[k] - prev[k]) * RAD).toBeLessThan(0.2);
        }
        prev = f;
      }
      expect(swingFrame(kind, seconds + 1)).toEqual(prev);
    }
  });

  it('picks the swing by club, and a holed shot flies to the pin', () => {
    expect(swingKind(club('putter'))).toBe('putt');
    expect(swingKind(club('sand', 30))).toBe('half');
    expect(swingKind(club('wedge', 95))).toBe('full');
    expect(swingKind(club('driver'))).toBe('full');
    const o = { quality: 'wobbly' as const, end: { x: 1, z: 2 }, side: 1 as const };
    expect(holedOutcome(o, { x: 5, z: 6 })).toEqual({ ...o, end: { x: 5, z: 6 } });
  });
});
