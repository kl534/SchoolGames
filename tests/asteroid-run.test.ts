import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BOSS_RADIUS, createAsteroid, NORMAL_RADIUS } from '../src/games/asteroid-run/asteroid';
import { createEffects } from '../src/games/asteroid-run/effects';
import { createFactFeed, MIN_QUEUED } from '../src/games/asteroid-run/feed';
import {
  BOSS_LOCK_Z,
  cameraGoal,
  clampToBox,
  dragScale,
  fitView,
  LOCK_Z,
  lookGoal,
  playBand,
  SHIP_HALF_SPAN,
  SHIP_Z,
  TARGET_SPAWN_Z,
  viewShift,
} from '../src/games/asteroid-run/layout';
import { createObstacles } from '../src/games/asteroid-run/obstacles';
import { crackGeometry, fbm3, noise3, rockGeometry } from '../src/games/asteroid-run/rocks';
import {
  approachProgress,
  approachZ,
  BOSS_BONUS,
  BOSS_EVERY,
  BOSS_HITS,
  bossClockTotal,
  crystalInterval,
  CRYSTAL_POINTS,
  easeIn,
  easeOut,
  easeToward,
  hazardInterval,
  hitPoints,
  isBossTarget,
  loseShield,
  multiplierFor,
  nextStreak,
  outOfShields,
  restoreShield,
  SHIELDS,
  SPEED_MAX,
  within,
  worldSpeedFactor,
} from '../src/games/asteroid-run/rules';
import { createShip } from '../src/games/asteroid-run/ship';
import { seededRandom } from '../src/shared/random';
import { RETRY_GAP } from '../src/shared/round';
import type { Fact } from '../src/shared/topics';

/** From a small phone in portrait to a laptop in landscape. */
const SCREENS: [number, number][] = [
  [360, 640],
  [390, 844],
  [412, 915],
  [844, 390],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1366, 768],
];

const fact = (id: string): Fact => ({
  id,
  prompt: `${id} = ?`,
  answer: id,
  statement: `${id} = ${id}`,
});

describe('scoring', () => {
  it('steps the multiplier up at streaks of five and ten', () => {
    expect([0, 1, 4].map(multiplierFor)).toEqual([1, 1, 1]);
    expect([5, 9].map(multiplierFor)).toEqual([2, 2]);
    expect([10, 11, 40].map(multiplierFor)).toEqual([3, 3, 3]);
  });

  it('gives 100, plus up to 50 for time left, rounded', () => {
    expect(hitPoints(0, 10, 1)).toBe(100);
    expect(hitPoints(10, 10, 1)).toBe(150);
    expect(hitPoints(5, 10, 1)).toBe(125);
    expect(hitPoints(1, 15, 1)).toBe(103);
    expect(hitPoints(7, 15, 1)).toBe(123);
  });

  it('multiplies by the streak including the hit being scored', () => {
    expect(hitPoints(10, 10, 4)).toBe(150);
    expect(hitPoints(10, 10, 5)).toBe(300);
    expect(hitPoints(5, 10, 10)).toBe(375);
  });

  it('rounds after multiplying', () => {
    expect(hitPoints(1, 15, 5)).toBe(Math.round((100 + 50 / 15) * 2));
  });

  it('copes with a clock that is empty or overrun', () => {
    expect(hitPoints(5, 0, 1)).toBe(100);
    expect(hitPoints(-3, 10, 1)).toBe(100);
    expect(hitPoints(99, 10, 1)).toBe(150);
  });

  it('counts hits and starts again after a miss or bump', () => {
    let streak = 0;
    for (let i = 0; i < 6; i++) streak = nextStreak(streak, true);
    expect(streak).toBe(6);
    expect(multiplierFor(streak)).toBe(2);
    streak = nextStreak(streak, false);
    expect(streak).toBe(0);
    expect(multiplierFor(streak)).toBe(1);
  });

  it('has flat bonuses for a boss and a crystal', () => {
    expect(BOSS_BONUS).toBe(500);
    expect(CRYSTAL_POINTS).toBe(25);
  });
});

describe('shields', () => {
  it('starts with three and loses one at a time, never going below zero', () => {
    expect(SHIELDS).toBe(3);
    let shields: number = SHIELDS;
    const seen = [shields];
    for (let i = 0; i < 4; i++) seen.push((shields = loseShield(shields)));
    expect(seen).toEqual([3, 2, 1, 0, 0]);
  });

  it('is out of shields at zero only', () => {
    expect([3, 2, 1, 0].map(outOfShields)).toEqual([false, false, false, true]);
  });

  it('wins one back, never above the full set', () => {
    expect(restoreShield(1)).toBe(2);
    expect(restoreShield(2)).toBe(3);
    expect(restoreShield(3)).toBe(3);
    expect(restoreShield(0)).toBe(1);
  });
});

describe('boss asteroids', () => {
  it('come every eighth target', () => {
    expect(BOSS_EVERY).toBe(8);
    expect(BOSS_HITS).toBe(3);
    const bosses = Array.from({ length: 33 }, (_, i) => i).filter(isBossTarget);
    expect(bosses).toEqual([8, 16, 24, 32]);
  });

  it('are never target zero or a negative number', () => {
    expect(isBossTarget(0)).toBe(false);
    expect(isBossTarget(-8)).toBe(false);
  });

  it('get one clock that adds up the time each question would have had', () => {
    expect(bossClockTotal([15, 15, 15])).toBe(45);
    expect(bossClockTotal([15, 10, 5])).toBe(30);
    expect(bossClockTotal([5, 5, 5])).toBe(15);
    expect(bossClockTotal([])).toBe(0);
  });
});

describe('approach', () => {
  it('runs from the lock distance to the ship as the clock runs down', () => {
    expect(approachProgress(5, 5)).toBe(0);
    expect(approachProgress(2.5, 5)).toBeCloseTo(0.5);
    expect(approachProgress(0, 5)).toBe(1);
  });

  it('is linear, whatever the length of the clock', () => {
    for (const total of [5, 10, 15, 45]) {
      expect(approachProgress(total * 0.75, total)).toBeCloseTo(0.25);
    }
  });

  it('stays within 0 to 1 and copes with an empty clock', () => {
    expect(approachProgress(-1, 5)).toBe(1);
    expect(approachProgress(9, 5)).toBe(0);
    expect(approachProgress(0, 0)).toBe(1);
  });

  it('puts the asteroid on the ship exactly when the clock hits zero', () => {
    const hitZ = -(NORMAL_RADIUS + 1.1);
    expect(approachZ(approachProgress(5, 5), LOCK_Z, hitZ)).toBe(LOCK_Z);
    expect(approachZ(approachProgress(0, 5), LOCK_Z, hitZ)).toBeCloseTo(hitZ);
    expect(approachZ(approachProgress(2.5, 5), LOCK_Z, hitZ)).toBeCloseTo((LOCK_Z + hitZ) / 2);
  });

  it('holds still while the clock is paused', () => {
    // A boss clock stops during each question's reading: same clock, same place.
    const z = (left: number) => approachZ(approachProgress(left, 30), BOSS_LOCK_Z, -7.6);
    expect(z(20)).toBe(z(20));
    expect(z(20)).toBeGreaterThan(BOSS_LOCK_Z);
    expect(z(10)).toBeGreaterThan(z(20));
  });

  it('flies in and lunges with an ease', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
    expect(easeIn(0.5)).toBeLessThan(0.5);
    expect(easeIn(2)).toBe(1);
  });

  it('spawns a target far beyond where it locks on, with the boss locking on further out', () => {
    expect(TARGET_SPAWN_Z).toBeLessThan(BOSS_LOCK_Z);
    expect(BOSS_LOCK_Z).toBeLessThan(LOCK_Z);
    expect(BOSS_RADIUS).toBeGreaterThan(NORMAL_RADIUS * 1.5);
  });
});

describe('world speed', () => {
  it('rises a little with each asteroid and stops at 1.6 times', () => {
    expect(worldSpeedFactor(0)).toBe(1);
    expect(worldSpeedFactor(1)).toBeGreaterThan(1);
    expect(worldSpeedFactor(2)).toBeGreaterThan(worldSpeedFactor(1));
    expect(worldSpeedFactor(500)).toBe(SPEED_MAX);
    expect(SPEED_MAX).toBeCloseTo(1.6);
    expect(worldSpeedFactor(-3)).toBe(1);
  });
});

describe('hazards and crystals', () => {
  it('are sparse while a question is open and denser between questions', () => {
    for (const roll of [0, 0.5, 0.99]) {
      expect(hazardInterval(true, roll)).toBeGreaterThan(hazardInterval(false, roll));
    }
    expect(hazardInterval(true, 0)).toBeGreaterThanOrEqual(3);
    expect(hazardInterval(false, 0.99)).toBeLessThan(2);
  });

  it('keep the same spacing when the world speeds up', () => {
    expect(hazardInterval(false, 0.5, 1.6)).toBeCloseTo(hazardInterval(false, 0.5) / 1.6);
  });

  it('bring crystals now and then', () => {
    expect(crystalInterval(0)).toBe(5);
    expect(crystalInterval(1)).toBe(10);
  });

  it('are touched when within reach across the flight box', () => {
    expect(within(0, 0, 0.5, 0.5, 1)).toBe(true);
    expect(within(0, 0, 1, 1, 1)).toBe(false);
    expect(within(2, 2, 2, 2, 0)).toBe(true);
  });
});

describe('easing towards a goal', () => {
  it('moves part of the way and never overshoots', () => {
    const next = easeToward(0, 10, 7, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(10);
    expect(easeToward(0, 10, 7, 100)).toBeCloseTo(10);
    expect(easeToward(5, 5, 7, 0.1)).toBe(5);
  });

  it('gets there at the same pace whatever the frame rate', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = easeToward(a, 10, 7, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = easeToward(b, 10, 7, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('fact feed', () => {
  /** A chooser that hands out ten new facts at a time: f1..f10, then f11..f20, and so on. */
  const counting = () => {
    let next = 1;
    const calls = { n: 0 };
    const choose = () => {
      calls.n++;
      return Array.from({ length: 10 }, () => fact(`f${next++}`));
    };
    return { choose, calls };
  };

  it('starts from the chooser and gives facts in order', () => {
    const { choose } = counting();
    const feed = createFactFeed(choose);
    expect(feed.take().id).toBe('f1');
    expect(feed.take().id).toBe('f2');
    expect(feed.peek(3).map((f) => f.id)).toEqual(['f3', 'f4', 'f5']);
    expect(feed.take().id).toBe('f3');
  });

  it('refills when it runs low, so it never runs dry', () => {
    const { choose, calls } = counting();
    const feed = createFactFeed(choose);
    const ids = Array.from({ length: 35 }, () => feed.take().id);
    expect(ids).toEqual(Array.from({ length: 35 }, (_, i) => `f${i + 1}`));
    expect(calls.n).toBeGreaterThanOrEqual(4);
  });

  it('tops up before it empties', () => {
    const { choose } = counting();
    const feed = createFactFeed(choose);
    for (let i = 0; i < 6; i++) feed.take();
    expect(feed.peek(100).length).toBeGreaterThanOrEqual(MIN_QUEUED);
  });

  it('brings a missed fact back three targets later', () => {
    expect(RETRY_GAP).toBe(3);
    const feed = createFactFeed(counting().choose);
    const first = feed.take();
    feed.recordMiss(first);
    expect(feed.take().id).toBe('f2');
    expect(feed.take().id).toBe('f3');
    expect(feed.take().id).toBe('f1');
    expect(feed.take().id).toBe('f4');
  });

  it('counts answers and correct answers', () => {
    const feed = createFactFeed(counting().choose);
    feed.recordHit(feed.take());
    feed.recordHit(feed.take());
    feed.recordMiss(feed.take());
    expect(feed.answered).toBe(3);
    expect(feed.correct).toBe(2);
  });

  it('lists each missed fact once, in the order it was first missed', () => {
    const feed = createFactFeed(counting().choose);
    const [a, b] = [feed.take(), feed.take()];
    feed.recordMiss(b);
    feed.recordMiss(a);
    feed.recordMiss(b);
    expect(feed.missed().map((f) => f.id)).toEqual(['f2', 'f1']);
    expect(feed.answered).toBe(3);
  });

  it('can note a miss without bringing the fact back', () => {
    const feed = createFactFeed(counting().choose);
    feed.recordMiss(feed.take(), false);
    expect(feed.missed()).toHaveLength(1);
    expect(feed.peek(10).map((f) => f.id)).not.toContain('f1');
  });

  it('puts facts that were never asked back at the front, unrecorded', () => {
    const feed = createFactFeed(counting().choose);
    const boss = [feed.take(), feed.take(), feed.take()];
    feed.recordHit(boss[0]);
    feed.returnUnused(boss.slice(1));
    expect(feed.take().id).toBe('f2');
    expect(feed.take().id).toBe('f3');
    expect(feed.take().id).toBe('f4');
    expect(feed.answered).toBe(1);
    expect(feed.missed()).toEqual([]);
  });

  it('does not ask the same question twice in a row when there is a choice', () => {
    // Re-queueing a miss when only one fact is waiting could put it straight back at the front.
    const feed = createFactFeed(() => [fact('a'), fact('b')], 1);
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const f = feed.take();
      seen.push(f.id);
      feed.recordMiss(f);
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it('works with the random choosers a session gives', () => {
    const random = seededRandom(3);
    const pool = Array.from({ length: 12 }, (_, i) => fact(`p${i}`));
    const feed = createFactFeed(() => [...pool].sort(() => random() - 0.5).slice(0, 10));
    for (let i = 0; i < 100; i++) {
      const f = feed.take();
      if (i % 3 === 0) feed.recordMiss(f);
      else feed.recordHit(f);
    }
    expect(feed.answered).toBe(100);
    expect(feed.correct).toBe(66);
  });

  it('gives up with an error when there are no facts at all', () => {
    expect(() => createFactFeed(() => []).take()).toThrow();
  });
});

describe('flight box', () => {
  it('is wider on wide screens and narrower, but taller, in portrait', () => {
    const portrait = fitView(390 / 844);
    const landscape = fitView(844 / 390);
    expect(landscape.halfW).toBeGreaterThan(portrait.halfW);
    expect(portrait.halfH).toBeGreaterThan(landscape.halfH);
    expect(portrait.fov).toBeGreaterThan(landscape.fov);
  });

  it('has sane sizes for any aspect ratio, even a silly one', () => {
    for (const aspect of [0, 0.1, 0.46, 0.75, 1, 1.33, 1.78, 2.2, 10]) {
      const fit = fitView(aspect);
      expect(fit.halfW).toBeGreaterThanOrEqual(1.5);
      expect(fit.halfW).toBeLessThanOrEqual(5.4);
      expect(fit.halfH).toBeGreaterThan(1.5);
      expect(fit.fov).toBeGreaterThan(40);
      expect(fit.fov).toBeLessThanOrEqual(88);
    }
  });

  it('clamps the ship to the box', () => {
    const fit = fitView(1);
    expect(clampToBox({ x: 99, y: -99 }, fit)).toEqual({ x: fit.halfW, y: -fit.halfH });
    expect(clampToBox({ x: -99, y: 99 }, fit)).toEqual({ x: -fit.halfW, y: fit.halfH });
    expect(clampToBox({ x: 0.2, y: -0.3 }, fit)).toEqual({ x: 0.2, y: -0.3 });
  });

  it('clamps the box for several aspect ratios', () => {
    for (const aspect of [0.46, 0.75, 1.33, 1.78]) {
      const fit = fitView(aspect);
      const p = clampToBox({ x: 1000, y: 1000 }, fit);
      expect(p).toEqual({ x: fit.halfW, y: fit.halfH });
    }
  });

  it('turns a drag across most of the screen into a trip across the whole box', () => {
    for (const [w, h] of SCREENS) {
      const fit = fitView(w / h);
      const scale = dragScale(w, h, fit);
      // 70% of the screen's width carries the ship from one side of the box to the other.
      expect(scale.x * w * 0.7).toBeCloseTo(2 * fit.halfW);
      expect(scale.y * h * 0.7).toBeCloseTo(2 * fit.halfH);
    }
  });

  it('moves the ship the same distance for the same finger travel, on any screen size', () => {
    const fit = fitView(1);
    const small = dragScale(300, 300, fit);
    const big = dragScale(600, 600, fit);
    expect(small.x).toBeCloseTo(big.x * 2);
  });

  it('does not divide by zero before the screen is measured', () => {
    const scale = dragScale(0, 0, fitView(1));
    expect(Number.isFinite(scale.x)).toBe(true);
    expect(Number.isFinite(scale.y)).toBe(true);
  });
});

/** The game's camera for a screen of this size, with the ship at (x, y) and the camera caught up. */
function cameraFor(width: number, height: number, x = 0, y = 0, lagX = 0, lagY = 0) {
  const fit = fitView(width / height);
  const camera = new PerspectiveCamera(fit.fov, width / height, 0.3, 900);
  camera.setViewOffset(width, height, 0, viewShift(width, height, fit), width, height);
  camera.position.copy(cameraGoal(x - lagX, y - lagY, 7.2, new Vector3()));
  camera.lookAt(lookGoal(x - lagX, y - lagY, new Vector3()));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return { camera, fit };
}

function toScreen(camera: PerspectiveCamera, width: number, height: number, p: Vector3) {
  const q = p.clone().project(camera);
  return { x: ((q.x + 1) / 2) * width, y: ((1 - q.y) / 2) * height };
}

/** Ship positions at the middle, edges and corners of the box. */
const corners = (fit: { halfW: number; halfH: number }) =>
  [-1, 0, 1].flatMap((sx) => [-1, 0, 1].map((sy) => ({ x: sx * fit.halfW, y: sy * fit.halfH })));

describe('chase camera', () => {
  for (const [w, h] of SCREENS) {
    describe(`${w}x${h}`, () => {
      const band = playBand(w, h);

      it('keeps the whole ship on screen anywhere in the flight box, camera lagging or not', () => {
        const fit = fitView(w / h);
        for (const lag of [0, 0.5]) {
          for (const c of corners(fit)) {
            const { camera } = cameraFor(w, h, c.x, c.y, lag * fit.halfW * Math.sign(c.x), 0);
            for (const dx of [-SHIP_HALF_SPAN, 0, SHIP_HALF_SPAN]) {
              const p = toScreen(camera, w, h, new Vector3(c.x + dx, c.y, SHIP_Z));
              expect(p.x).toBeGreaterThan(0);
              expect(p.x).toBeLessThan(w);
              expect(p.y).toBeGreaterThan(0);
              expect(p.y).toBeLessThan(h);
            }
          }
        }
      });

      it('keeps the target asteroid inside the view all the way in, from lock-on to impact', () => {
        const fit = fitView(w / h);
        for (const [radius, lockZ] of [
          [NORMAL_RADIUS, LOCK_Z],
          [BOSS_RADIUS, BOSS_LOCK_Z],
        ] as const) {
          const hitZ = -(radius + 1.1);
          for (const c of corners(fit)) {
            const { camera } = cameraFor(w, h, c.x, c.y);
            for (let k = 0; k <= 10; k++) {
              const z = approachZ(k / 10, lockZ, hitZ);
              // The target is on the ship's x and y, or a little behind it when it lags.
              for (const lag of [0, 0.4]) {
                const target = new Vector3(c.x * (1 - lag), c.y * (1 - lag), z);
                const p = toScreen(camera, w, h, target);
                expect(p.x).toBeGreaterThan(30);
                expect(p.x).toBeLessThan(w - 30);
                expect(p.y).toBeGreaterThan(30);
                expect(p.y).toBeLessThan(h - 30);
              }
            }
          }
        }
      });

      it('shows the target at lock-on clear of the question at the top', () => {
        const fit = fitView(w / h);
        for (const c of corners(fit)) {
          const { camera } = cameraFor(w, h, c.x, c.y);
          const p = toScreen(camera, w, h, new Vector3(c.x, c.y, LOCK_Z));
          expect(p.y).toBeGreaterThan(band.top - 10);
        }
      });

      it('keeps the ship above the answers along the bottom, even at the bottom of the box', () => {
        // Phones this small are tight; a little of the exhaust is allowed to tuck under.
        const slack = h < 700 ? 40 : 0;
        const fit = fitView(w / h);
        for (const c of corners(fit)) {
          const { camera } = cameraFor(w, h, c.x, c.y);
          const p = toScreen(camera, w, h, new Vector3(c.x, c.y, SHIP_Z));
          expect(p.y).toBeLessThan(band.bottom + slack);
        }
      });

      it('keeps the ship below the question at the top, even at the top of the box', () => {
        const fit = fitView(w / h);
        for (const c of corners(fit)) {
          const { camera } = cameraFor(w, h, c.x, c.y);
          const p = toScreen(camera, w, h, new Vector3(c.x, c.y, SHIP_Z));
          expect(p.y).toBeGreaterThan(band.top);
        }
      });
    });
  }

  it('slides the picture up on a short screen and leaves a tall one alone', () => {
    expect(viewShift(844, 390, fitView(844 / 390))).toBeGreaterThan(0);
    expect(viewShift(768, 1024, fitView(768 / 1024))).toBe(0);
    for (const [w, h] of SCREENS) expect(viewShift(w, h, fitView(w / h))).toBeGreaterThanOrEqual(0);
  });

  it('follows the ship by half, so it can drift on screen, and looks ahead of it', () => {
    const rest = cameraGoal(0, 0, 7.2, new Vector3());
    const right = cameraGoal(4, 2, 7.2, new Vector3());
    expect(right.x).toBeCloseTo(rest.x + 2);
    expect(right.y).toBeCloseTo(rest.y + 1);
    expect(rest.z).toBeGreaterThan(SHIP_Z);
    expect(rest.y).toBeGreaterThan(0);
    expect(lookGoal(0, 0, new Vector3()).z).toBeLessThan(-10);
    expect(cameraGoal(0, 0, 16, new Vector3()).z).toBeGreaterThan(rest.z);
  });
});

describe('rocks', () => {
  it('has smooth noise that is the same every time', () => {
    expect(noise3(1.3, 2.7, 3.1)).toBe(noise3(1.3, 2.7, 3.1));
    for (let i = 0; i < 200; i++) {
      const n = noise3(i * 0.37, i * 0.11, i * 0.73);
      expect(n).toBeGreaterThanOrEqual(-1);
      expect(n).toBeLessThanOrEqual(1);
      expect(Math.abs(fbm3(i * 0.37, i * 0.11, i * 0.73))).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(noise3(0.5, 0.5, 0.5) - noise3(0.501, 0.5, 0.5))).toBeLessThan(0.01);
  });

  it('makes lumpy rocks near the size asked for, different for each seed', () => {
    const a = rockGeometry({ radius: 2, detail: 1, roughness: 0.3, seed: 1 });
    const b = rockGeometry({ radius: 2, detail: 1, roughness: 0.3, seed: 2 });
    for (const rock of [a, b]) {
      rock.computeBoundingSphere();
      expect(rock.boundingSphere!.radius).toBeGreaterThan(1.2);
      expect(rock.boundingSphere!.radius).toBeLessThan(3.2);
    }
    expect(Array.from(a.attributes.position.array)).not.toEqual(
      Array.from(b.attributes.position.array),
    );
  });

  it('keeps the faces of a rock joined: a corner shared by faces moves the same way', () => {
    const rock = rockGeometry({ radius: 1, detail: 2, roughness: 0.4, seed: 5 });
    const seen = new Map<string, number>();
    const position = rock.attributes.position;
    for (let i = 0; i < position.count; i++) {
      // Corners that started in the same place must still be in the same place.
      const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    // Every corner of an icosphere is shared by at least three faces (five or six, in fact).
    expect([...seen.values()].every((n) => n >= 3)).toBe(true);
  });

  it('picks out a thin band of faces for the glowing cracks', () => {
    const rock = rockGeometry({ radius: 3, detail: 3, roughness: 0.24, seed: 4 });
    const cracks = crackGeometry(rock, 8, 0.17, 0.04);
    const faces = rock.attributes.position.count / 3;
    const crackFaces = cracks.attributes.position.count / 3;
    expect(crackFaces).toBeGreaterThan(faces * 0.04);
    expect(crackFaces).toBeLessThan(faces * 0.6);
  });
});

describe('ship', () => {
  it('has wing-tip lasers either side of the middle, out in front of the tail', () => {
    const ship = createShip();
    ship.object.position.set(1, 0.5, 0);
    ship.object.updateMatrixWorld(true);
    const left = ship.muzzle(0, new Vector3());
    const right = ship.muzzle(1, new Vector3());
    expect(left.x).toBeLessThan(1 - SHIP_HALF_SPAN * 0.8);
    expect(right.x).toBeGreaterThan(1 + SHIP_HALF_SPAN * 0.8);
    expect(left.y).toBeCloseTo(0.5, 0);
    expect(left.z).toBeLessThan(0.5);
  });

  it('banks with the ship: the tips follow the tilt', () => {
    const ship = createShip();
    ship.object.rotation.z = 0.5;
    ship.object.updateMatrixWorld(true);
    const left = ship.muzzle(0, new Vector3());
    const right = ship.muzzle(1, new Vector3());
    // Positive roll lifts the right wing.
    expect(right.y).toBeGreaterThan(left.y);
  });

  it('can be hidden when it blows up and brought back', () => {
    const ship = createShip();
    ship.setVisible(false);
    ship.update(0.016, 0, 1, 28);
    expect(ship.trail.visible).toBe(false);
    ship.setVisible(true);
    expect(ship.trail.visible).toBe(true);
  });

  it('leaves exhaust puffs that fade away on their own', () => {
    const ship = createShip();
    for (let i = 0; i < 20; i++) ship.update(0.03, i * 0.03, 1, 28);
    const showing = () => ship.trail.children.filter((c) => c.visible).length;
    expect(showing()).toBeGreaterThan(0);
    const before = showing();
    ship.setVisible(false);
    ship.setVisible(true);
    for (let i = 0; i < 60; i++) ship.update(0.03, 1 + i * 0.03, 1, 28);
    // New puffs keep coming but the pool never grows past its size.
    expect(ship.trail.children.length).toBe(24);
    expect(showing()).toBeLessThanOrEqual(24);
    expect(before).toBeLessThanOrEqual(24);
  });

  it('lights its shield for a moment, then lets it go dark', () => {
    const ship = createShip();
    const bubble = () => ship.object.children.find((c) => c.children.length === 2)!;
    ship.update(0.016, 0, 1, 28);
    expect(bubble().visible).toBe(false);
    ship.flashShield();
    ship.update(0.016, 0.016, 1, 28);
    expect(bubble().visible).toBe(true);
    for (let i = 0; i < 100; i++) ship.update(0.05, i * 0.05, 1, 28);
    expect(bubble().visible).toBe(false);
  });
});

describe('asteroid', () => {
  it('resets to a visible, fresh rock, big enough to read from a distance', () => {
    const rock = createAsteroid(false);
    rock.object.visible = false;
    rock.reset();
    expect(rock.object.visible).toBe(true);
    expect(rock.radius).toBe(NORMAL_RADIUS);
    expect(createAsteroid(true).radius).toBe(BOSS_RADIUS);
  });

  it('keeps running through lock-on, urgency and damage without trouble', () => {
    for (const boss of [false, true]) {
      const asteroid = createAsteroid(boss);
      asteroid.reset();
      for (let i = 0; i < 120; i++) {
        asteroid.setLock(i / 60);
        asteroid.setUrgent(i > 60);
        asteroid.setDamage(i / 100);
        asteroid.update(0.016, i * 0.016);
      }
      expect(asteroid.object.children.length).toBeGreaterThan(1);
    }
  });
});

describe('obstacles', () => {
  it('start far ahead and stream towards the camera, spinning', () => {
    const obstacles = createObstacles();
    const hazard = obstacles.spawnHazard(1, -1)!;
    expect(hazard.active).toBe(true);
    expect(hazard.object.position.z).toBeLessThan(-100);
    const z = hazard.object.position.z;
    obstacles.update(0.5, 30, 0);
    expect(hazard.object.position.z).toBeCloseTo(z + 15);
    expect(hazard.object.position.x).toBe(1);
    expect(hazard.object.position.y).toBe(-1);
  });

  it('recycle what has flown past, so the pool never runs out', () => {
    const obstacles = createObstacles();
    for (let round = 0; round < 5; round++) {
      while (obstacles.spawnHazard(0, 0)) {
        // fill the pool
      }
      expect(obstacles.spawnHazard(0, 0)).toBeNull();
      for (let i = 0; i < 200; i++) obstacles.update(0.05, 40, i * 0.05);
      expect(obstacles.hazards.every((h) => !h.active && !h.object.visible)).toBe(true);
    }
  });

  it('shrink away once they are past the ship, instead of swelling up at the camera', () => {
    const obstacles = createObstacles();
    const hazard = obstacles.spawnHazard(0, 0)!;
    hazard.object.position.z = -2;
    obstacles.update(0.001, 30, 0);
    const near = hazard.object.scale.x;
    hazard.object.position.z = 3;
    obstacles.update(0.001, 30, 0);
    expect(hazard.object.scale.x).toBeLessThan(near * 0.5);
  });

  it('retires a hazard or crystal, and clears everything', () => {
    const obstacles = createObstacles();
    const hazard = obstacles.spawnHazard(0, 0)!;
    const crystal = obstacles.spawnCrystal(0, 0)!;
    obstacles.retire(hazard);
    expect(hazard.active).toBe(false);
    expect(crystal.active).toBe(true);
    obstacles.clear();
    expect(crystal.active).toBe(false);
    expect(crystal.object.visible).toBe(false);
  });
});

describe('effects', () => {
  const pieces = (effects: ReturnType<typeof createEffects>) =>
    effects.object.children.filter((c) => c.visible).length;

  it('clears itself away after an explosion and a shower of sparks', () => {
    const effects = createEffects();
    effects.explosion(new Vector3(0, 0, -5), 2);
    effects.rockBurst(new Vector3(1, 0, -5), 1);
    effects.knockOff(new Vector3(-1, 0, -5), 1);
    effects.sparkle(new Vector3(0, 1, -5));
    expect(pieces(effects)).toBeGreaterThan(30);
    for (let i = 0; i < 100; i++) effects.update(0.05);
    expect(pieces(effects)).toBe(0);
  });

  it('never makes more things than its pools hold, however many explosions', () => {
    const effects = createEffects();
    const total = effects.object.children.length;
    for (let i = 0; i < 30; i++) effects.explosion(new Vector3(0, 0, -5), 3);
    expect(effects.object.children.length).toBe(total);
  });

  it('flies twin bolts to the aim point and tells you when they land, once', () => {
    const effects = createEffects();
    const aim = new Vector3(0, 0, -20);
    let landed = 0;
    effects.fireBolts(new Vector3(-1, 0, 0), new Vector3(1, 0, 0), aim, 0.3, () => landed++);
    expect(pieces(effects)).toBe(2);
    for (let i = 0; i < 8; i++) effects.update(0.03);
    expect(landed).toBe(0);
    for (let i = 0; i < 8; i++) effects.update(0.03);
    expect(landed).toBe(1);
    for (let i = 0; i < 20; i++) effects.update(0.03);
    expect(landed).toBe(1);
    expect(pieces(effects)).toBe(0);
  });

  it('follows an aim point that moves, so the bolts always find the asteroid', () => {
    const effects = createEffects();
    const aim = new Vector3(0, 0, -20);
    effects.fireBolts(new Vector3(-1, 0, 0), new Vector3(1, 0, 0), aim, 0.3, () => {});
    aim.set(5, 0, -20);
    effects.update(0.299);
    const bolt = effects.object.children.find((c) => c.visible)!;
    // Nearly at the end of the flight: the bolt is near the new aim point, not the old one.
    expect(bolt.position.x).toBeGreaterThan(2);
  });

  it('bounces bolts off and flings debris that lands on target', () => {
    const effects = createEffects();
    effects.ricochet(new Vector3(0, 0, -5));
    expect(pieces(effects)).toBeGreaterThan(10);
    let hit = 0;
    effects.throwDebris(new Vector3(0, 0, -20), new Vector3(0, 0, 0), 0.5, () => hit++);
    for (let i = 0; i < 40; i++) effects.update(0.02);
    expect(hit).toBe(1);
    for (let i = 0; i < 100; i++) effects.update(0.05);
    expect(pieces(effects)).toBe(0);
  });

  it('can be cleared in an instant, dropping any landing it was waiting for', () => {
    const effects = createEffects();
    let landed = 0;
    effects.fireBolts(new Vector3(), new Vector3(), new Vector3(0, 0, -9), 0.3, () => landed++);
    effects.throwDebris(new Vector3(), new Vector3(0, 0, 4), 0.3, () => landed++);
    effects.clear();
    for (let i = 0; i < 40; i++) effects.update(0.03);
    expect(landed).toBe(0);
    expect(pieces(effects)).toBe(0);
  });
});

describe('manifest', () => {
  it('is scored in points, so the menu shows a high score', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../src/games/asteroid-run/game.json'), 'utf8'),
    );
    expect(manifest.id).toBe('asteroid-run');
    expect(manifest.scoring).toBe('score');
  });
});
