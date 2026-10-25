import { describe, expect, it } from 'vitest';
import { BALL_R, flightPoint, flightSeconds } from '../src/games/fore/ball';
import { HOLES, type Surface } from '../src/games/fore/course';
import { planShot, resolveShot } from '../src/games/fore/shot';
import { createTravel } from '../src/games/fore/travel';
import { runs } from './helpers/full';

const hole = HOLES[0];
const tee = { x: 0, z: 0 };
const perfect = (aim = 0) => {
  const plan = planShot(hole, tee, 'tee', aim);
  return { plan, outcome: resolveShot(plan, true, 0.5, 6, 1) };
};
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe('the ball travelling to where it rests', () => {
  it('starts at the ball and comes to rest exactly where the shot ends', () => {
    for (const surface of ['fairway', 'green', 'rough', 'sand'] as Surface[]) {
      const { plan, outcome } = perfect();
      const travel = createTravel(plan, outcome, surface);
      expect(travel.at(0).x).toBeCloseTo(plan.from.x, 6);
      expect(travel.at(0).z).toBeCloseTo(plan.from.z, 6);
      const end = travel.at(travel.seconds + 1);
      expect(end.x).toBeCloseTo(outcome.end.x, 6);
      expect(end.z).toBeCloseTo(outcome.end.z, 6);
      expect(end.y).toBeCloseTo(BALL_R, 9);
    }
  });

  it('lands short of the rest point and runs on, more on a fairway than in the rough', () => {
    const { plan, outcome } = perfect();
    const fairway = createTravel(plan, outcome, 'fairway');
    const rough = createTravel(plan, outcome, 'rough');
    expect(fairway.roll).toBeGreaterThan(rough.roll);
    expect(rough.roll).toBeGreaterThan(0.5);
    const touchdown = fairway.at(fairway.airSeconds);
    expect(dist(touchdown, outcome.end)).toBeCloseTo(fairway.roll, 6);
    expect(touchdown.y).toBeCloseTo(BALL_R, 6);
  });

  it('runs on further after a low driver than after a high wedge', () => {
    const driver = perfect();
    const wedge = planShot(hole, { x: 0, z: 245 }, 'fairway', 0);
    const wedgeOutcome = resolveShot(wedge, true, 0.5, 6, 1);
    expect(wedge.club.id).not.toBe(driver.plan.club.id);
    expect(createTravel(driver.plan, driver.outcome, 'fairway').roll).toBeGreaterThan(
      createTravel(wedge, wedgeOutcome, 'fairway').roll,
    );
  });

  it('barely runs on in sand', () => {
    const { plan, outcome } = perfect();
    const sand = createTravel(plan, outcome, 'sand');
    expect(sand.roll).toBeLessThan(0.2 * createTravel(plan, outcome, 'fairway').roll);
  });

  it('does not run on when it splashes or hits a tree, and flies as before', () => {
    const { plan, outcome } = perfect();
    const travel = createTravel(plan, outcome, null);
    expect(travel.roll).toBe(0);
    expect(travel.seconds).toBeCloseTo(flightSeconds(plan, outcome), 9);
    for (const u of [0, 0.3, 0.7, 1]) {
      expect(travel.at(u * travel.seconds)).toEqual(flightPoint(plan, outcome, u));
    }
  });

  it('slows evenly on the ground, never reverses and hops lower each time', () => {
    const { plan, outcome } = perfect();
    const travel = createTravel(plan, outcome, 'fairway');
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
      expect(dist(p, outcome.end)).toBeLessThanOrEqual(dist(prev, outcome.end) + 1e-9);
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

  it('keeps the ball above the ground and on the way to the rest point for any shot', () => {
    const surfaces: Surface[] = ['fairway', 'green', 'rough', 'sand'];
    for (let i = 0; i < runs(300, 60); i++) {
      const h = HOLES[i % HOLES.length];
      const from = { x: (Math.random() - 0.5) * 20, z: Math.random() * 150 };
      const plan = planShot(h, from, 'fairway', (Math.random() - 0.5) * 20);
      const outcome = resolveShot(
        plan,
        Math.random() < 0.7,
        Math.random() * 6,
        6,
        Math.random() < 0.5 ? -1 : 1,
      );
      const travel = createTravel(plan, outcome, surfaces[i % surfaces.length]);
      expect(travel.seconds).toBeGreaterThan(0);
      expect(travel.seconds).toBeLessThan(6);
      for (let k = 0; k <= 50; k++) {
        const p = travel.at((travel.seconds * k) / 50);
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
        expect(p.y).toBeGreaterThanOrEqual(BALL_R - 1e-9);
      }
      const end = travel.at(travel.seconds);
      expect(end.x).toBeCloseTo(outcome.end.x, 5);
      expect(end.z).toBeCloseTo(outcome.end.z, 5);
    }
  });

  it('rolls a putt out, slowing evenly to a stop on the spot', () => {
    const green = planShot(hole, { x: hole.pin.x + 6, z: hole.pin.z - 6 }, 'green', 0);
    expect(green.club.id).toBe('putter');
    const outcome = resolveShot(green, true, 0.5, 6, 1);
    const travel = createTravel(green, outcome, 'green');
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
    expect(prev.x).toBeCloseTo(outcome.end.x, 9);
    expect(prev.z).toBeCloseTo(outcome.end.z, 9);
    expect(lastStep).toBeLessThan(0.05);
  });
});
