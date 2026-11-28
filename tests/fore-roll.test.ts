import { describe, expect, it } from 'vitest';
import { BALL_R, flightPoint, flightSeconds } from '../src/games/fore/ball';
import { HOLES } from '../src/games/fore/course';
import {
  finishShot,
  planShot,
  resolveShot,
  type Lie,
  type Outcome,
  type Plan,
  type Result,
  type XZ,
} from '../src/games/fore/shot';
import { createTravel } from '../src/games/fore/travel';
import { runs } from './helpers/full';

const hole = HOLES[0];
const dist = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);

/** A perfect shot from `from` to the spot `want`, finished the way the game finishes it. */
function shot(want: XZ, from: XZ = { x: 0, z: 0 }, lie: Lie = 'tee', h = hole) {
  const plan = planShot(h, from, lie, want);
  const outcome: Outcome = { quality: 'perfect', land: plan.landing };
  const result = finishShot(h, plan, outcome);
  return { plan, outcome, result, travel: createTravel(plan, outcome, result, h.pin) };
}
const restOf = (r: Result, pin: XZ): XZ =>
  r.kind === 'holed' ? pin : r.kind === 'water' ? r.splash : r.at;

describe('the ball travelling to where it rests', () => {
  it('starts at the ball, touches down at the landing spot and ends exactly on the rest point', () => {
    const cases = [
      shot({ x: 0, z: 240 }), // a driver on the fairway
      shot({ x: 0, z: 300 }, { x: 0, z: 245 }, 'fairway'), // a wedge onto grass
      shot({ x: 45, z: 150 }), // into the rough
      shot({ x: 0, z: hole.length }, { x: 0, z: hole.length - 60 }, 'fairway'), // at the pin
    ];
    for (const { plan, outcome, result, travel } of cases) {
      expect(travel.at(0).x).toBeCloseTo(plan.from.x, 6);
      expect(travel.at(0).z).toBeCloseTo(plan.from.z, 6);
      const down = travel.at(travel.airSeconds);
      expect(down.x).toBeCloseTo(outcome.land.x, 6);
      expect(down.z).toBeCloseTo(outcome.land.z, 6);
      expect(down.y).toBeCloseTo(BALL_R, 6);
      const end = travel.at(travel.seconds + 1);
      const rest = restOf(result, hole.pin);
      expect(end.x).toBeCloseTo(rest.x, 6);
      expect(end.z).toBeCloseTo(rest.z, 6);
      expect(end.y).toBeCloseTo(BALL_R, 9);
    }
  });

  it('runs on from where it lands, more after a driver on the fairway than after a wedge', () => {
    const driver = shot({ x: 0, z: 240 });
    const wedge = shot({ x: 0, z: 300 }, { x: 0, z: 245 }, 'fairway');
    expect(driver.plan.club.id).toBe('driver');
    expect(wedge.plan.club.id).not.toBe('driver');
    expect(driver.travel.roll).toBeCloseTo(24, 6);
    expect(driver.travel.roll).toBeGreaterThan(wedge.travel.roll);
    expect(
      dist(driver.travel.at(driver.travel.airSeconds), restOf(driver.result, hole.pin)),
    ).toBeCloseTo(driver.travel.roll, 6);
  });

  it('does not run on in sand, and a splash is just the flight', () => {
    const sand = HOLES[1];
    const inSand = shot({ x: -10, z: 128 }, { x: 0, z: 0 }, 'tee', sand);
    expect(inSand.result).toMatchObject({ kind: 'rest', surface: 'sand' });
    expect(inSand.travel.roll).toBeCloseTo(0, 6);
    const pond = HOLES[4];
    const wet = shot({ x: -14, z: 200 }, { x: 0, z: 0 }, 'tee', pond);
    expect(wet.result.kind).toBe('water');
    expect(wet.travel.roll).toBe(0);
    expect(wet.travel.seconds).toBeCloseTo(flightSeconds(wet.plan, wet.outcome), 9);
    for (const u of [0, 0.3, 0.7, 1]) {
      expect(wet.travel.at(u * wet.travel.seconds)).toEqual(flightPoint(wet.plan, wet.outcome, u));
    }
  });

  it('slows evenly on the ground, never reverses and hops lower each time', () => {
    const { result, travel } = shot({ x: 0, z: 240 });
    const rest = restOf(result, hole.pin);
    const span = travel.seconds - travel.airSeconds;
    expect(span).toBeGreaterThan(0.2);
    const n = 200;
    let along = 0;
    let lastStep = Infinity;
    let prev = travel.at(travel.airSeconds);
    const peaks: number[] = [];
    let peak = 0;
    for (let i = 1; i <= n; i++) {
      const p = travel.at(travel.airSeconds + (span * i) / n);
      const step = dist(p, prev);
      expect(step).toBeLessThanOrEqual(lastStep + 1e-9);
      // Moving on towards the rest point: the distance left only falls.
      expect(dist(p, rest)).toBeLessThanOrEqual(dist(prev, rest) + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(BALL_R - 1e-9);
      if (p.y > BALL_R + 1e-6) peak = Math.max(peak, p.y - BALL_R);
      else if (peak > 0) {
        peaks.push(peak);
        peak = 0;
      }
      along += step;
      lastStep = step;
      prev = p;
    }
    expect(along).toBeCloseTo(travel.roll, 3);
    expect(peaks.length).toBeGreaterThan(0);
    for (let i = 1; i < peaks.length; i++) expect(peaks[i]).toBeLessThan(peaks[i - 1]);
  });

  it('a holed ball runs to the pin itself', () => {
    // The ball lands short of the cup and its roll carries it in.
    const aim = { x: 0, z: hole.length - 60 * 0.03 * 0.8 };
    const { result, travel } = shot(aim, { x: 0, z: hole.length - 60 }, 'fairway');
    expect(result.kind).toBe('holed');
    const end = travel.at(travel.seconds);
    expect(end.x).toBeCloseTo(hole.pin.x, 6);
    expect(end.z).toBeCloseTo(hole.pin.z, 6);
  });

  it('keeps the ball above the ground and ends on the rest point for any shot', () => {
    for (let i = 0; i < runs(300, 60); i++) {
      const h = HOLES[i % HOLES.length];
      const from = { x: (Math.random() - 0.5) * 20, z: Math.random() * 150 };
      const lie: Lie = i % 3 === 0 ? 'rough' : 'fairway';
      const want = { x: from.x + (Math.random() - 0.5) * 200, z: from.z + Math.random() * 250 };
      const plan: Plan = planShot(h, from, lie, want);
      const outcome = resolveShot(
        plan,
        Math.random() < 0.7,
        Math.random() * 6,
        6,
        Math.random() * 2 * Math.PI,
        Math.random(),
      );
      const result = finishShot(h, plan, outcome);
      if (result.kind === 'rest' && result.tree !== undefined) continue;
      const travel = createTravel(plan, { ...outcome, land: result.land }, result, h.pin);
      expect(travel.seconds).toBeGreaterThan(0);
      expect(travel.seconds).toBeLessThan(8);
      for (let k = 0; k <= 50; k++) {
        const p = travel.at((travel.seconds * k) / 50);
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
        expect(p.y).toBeGreaterThanOrEqual(BALL_R - 1e-9);
      }
      const end = travel.at(travel.seconds);
      const rest = restOf(result, h.pin);
      expect(end.x).toBeCloseTo(rest.x, 5);
      expect(end.z).toBeCloseTo(rest.z, 5);
    }
  });

  it('rolls a putt out to its spot, slowing evenly to a stop', () => {
    const at = { x: hole.pin.x + 6, z: hole.pin.z - 6 };
    const spot = { x: hole.pin.x + 2, z: hole.pin.z - 2 };
    const { plan, result, travel } = shot(spot, at, 'green');
    expect(plan.club.id).toBe('putter');
    expect(result).toMatchObject({ kind: 'rest', at: spot });
    let prev = travel.at(0);
    let lastStep = Infinity;
    for (let i = 1; i <= 40; i++) {
      const p = travel.at((travel.seconds * i) / 40);
      const step = dist(p, prev);
      expect(step).toBeLessThanOrEqual(lastStep + 1e-9);
      expect(p.y).toBe(BALL_R);
      lastStep = step;
      prev = p;
    }
    expect(prev.x).toBeCloseTo(spot.x, 9);
    expect(prev.z).toBeCloseTo(spot.z, 9);
    expect(lastStep).toBeLessThan(0.05);
  });
});

describe('a duff travelling', () => {
  it('skips low, hops once a little, slows evenly and rests where it lands', () => {
    const plan = planShot(hole, { x: 0, z: 0 }, 'tee', { x: 0, z: 150 });
    const outcome = resolveShot(plan, false, 4, 10, Math.PI, 1);
    expect(outcome.quality).toBe('duff');
    const result = finishShot(hole, plan, outcome);
    if (result.kind !== 'rest') throw new Error('a duff on the tee rests');
    const travel = createTravel(plan, { ...outcome, land: result.land }, result, hole.pin);
    expect(travel.seconds).toBeCloseTo(flightSeconds(plan, outcome), 9);
    expect(travel.seconds).toBeCloseTo(0.5 + 10 / 12, 9);
    let top = 0;
    let prev = travel.at(0);
    let lastStep = Infinity;
    for (let i = 1; i <= 80; i++) {
      const p = travel.at((travel.seconds * i) / 80);
      top = Math.max(top, p.y - BALL_R);
      const step = dist(p, prev);
      expect(step).toBeLessThanOrEqual(lastStep + 1e-9);
      lastStep = step;
      prev = p;
    }
    expect(top).toBeCloseTo(0.35, 2);
    expect(prev.x).toBeCloseTo(result.at.x, 9);
    expect(prev.z).toBeCloseTo(result.at.z, 9);
    expect(prev.y).toBe(BALL_R);
    // After the skip there is one small hop of 0.08 yd and nothing else.
    const late = Array.from({ length: 60 }, (_, i) =>
      travel.at(travel.seconds * (0.4 + (0.6 * i) / 59)),
    );
    expect(Math.max(...late.map((p) => p.y - BALL_R))).toBeLessThanOrEqual(0.08 + 1e-9);
  });
});
