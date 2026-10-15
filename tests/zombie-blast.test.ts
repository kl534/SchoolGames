import { Box3, Group, MeshStandardMaterial, PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createHorde } from '../src/games/zombie-blast/horde';
import { createEffects } from '../src/games/zombie-blast/effects';
import {
  CAMERA,
  BARRICADE_Z,
  BREAK_Z,
  END_Z,
  fitView,
  LANES,
  laneX,
  layoutSigns,
  SPAWN_Z,
  START_Z,
  TARGET,
} from '../src/games/zombie-blast/layout';
import {
  approachZ,
  arcHeightFor,
  bombPosition,
  BRAINS,
  closestIndex,
  createWaveSpawner,
  easeOutBack,
  easeToward,
  fallTime,
  hitPoints,
  loseBrain,
  MAX_ON_FIELD,
  multiplierFor,
  nextStreak,
  outcomeText,
  outOfBrains,
  pickLane,
  plankFlight,
  planksInReach,
  spawnInterval,
  walkSpeed,
  wrapAngle,
  zombieProgress,
  zombiesInWave,
} from '../src/games/zombie-blast/rules';
import { barricade } from '../src/games/zombie-blast/field';
import { createThrower, RELEASE_TIME } from '../src/games/zombie-blast/thrower';
import {
  ARMOUR_ORDER,
  BRUTE_LOOK,
  createZombie,
  ZOMBIE_LOOKS,
} from '../src/games/zombie-blast/zombie';
import { seededRandom } from '../src/shared/random';

/** The game's camera for a screen of this size. */
function cameraFor(width: number, height: number): PerspectiveCamera {
  const aspect = width / height;
  const camera = new PerspectiveCamera(fitView(aspect).fov, aspect, 0.5, 800);
  camera.position.copy(CAMERA);
  camera.lookAt(TARGET);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

function toScreen(camera: PerspectiveCamera, width: number, height: number, p: Vector3) {
  const q = p.clone().project(camera);
  return { x: ((q.x + 1) / 2) * width, y: ((1 - q.y) / 2) * height };
}

/** From a small phone in portrait to a laptop in landscape. */
const SCREENS: [number, number][] = [
  [360, 640],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1366, 768],
];

describe('brains', () => {
  it('starts with three and loses one at a time, never going below zero', () => {
    expect(BRAINS).toBe(3);
    let brains: number = BRAINS;
    const seen = [brains];
    for (let i = 0; i < 4; i++) seen.push((brains = loseBrain(brains)));
    expect(seen).toEqual([3, 2, 1, 0, 0]);
  });

  it('is out of brains at zero only', () => {
    expect([3, 2, 1, 0].map(outOfBrains)).toEqual([false, false, false, true]);
  });
});

describe('zombie progress', () => {
  it('runs from the start line to the barricade as the clock runs down', () => {
    expect(zombieProgress(5, 5)).toBe(0);
    expect(zombieProgress(2.5, 5)).toBeCloseTo(0.5);
    expect(zombieProgress(0, 5)).toBe(1);
  });

  it('is linear, whatever the length of the clock', () => {
    for (const total of [5, 10, 15]) {
      expect(zombieProgress(total * 0.75, total)).toBeCloseTo(0.25);
    }
  });

  it('stays within 0 to 1 and copes with an empty clock', () => {
    expect(zombieProgress(-1, 5)).toBe(1);
    expect(zombieProgress(9, 5)).toBe(0);
    expect(zombieProgress(0, 0)).toBe(1);
  });

  it('puts the zombies at the barricade exactly when the clock hits zero', () => {
    expect(approachZ(zombieProgress(5, 5), START_Z, END_Z)).toBe(START_Z);
    expect(approachZ(zombieProgress(0, 5), START_Z, END_Z)).toBeCloseTo(END_Z);
    const half = approachZ(zombieProgress(2.5, 5), START_Z, END_Z);
    expect(half).toBeCloseTo((START_Z + END_Z) / 2);
  });
});

describe('bomb arc', () => {
  const from = { x: 0.3, y: 1.2, z: 1.5 };
  const to = { x: -2.2, y: 0.12, z: -5 };

  it('starts at the hand and lands exactly on the target', () => {
    expect(bombPosition(from, to, 0, 0.7, 2)).toEqual(from);
    const end = bombPosition(from, to, 0.7, 0.7, 2);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
    expect(end.z).toBeCloseTo(to.z);
  });

  it('peaks above the straight line half way through, and moves steadily sideways', () => {
    const mid = bombPosition(from, to, 0.35, 0.7, 2);
    expect(mid.y).toBeCloseTo((from.y + to.y) / 2 + 2);
    expect(mid.x).toBeCloseTo((from.x + to.x) / 2);
    expect(mid.z).toBeCloseTo((from.z + to.z) / 2);
  });

  it('rises then falls, never dipping below the target', () => {
    const ys = Array.from({ length: 15 }, (_, i) => bombPosition(from, to, i * 0.05, 0.7, 2).y);
    const top = ys.indexOf(Math.max(...ys));
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(ys.length - 1);
    for (let i = 1; i <= top; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    for (let i = top + 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1]);
    for (const y of ys) expect(y).toBeGreaterThanOrEqual(to.y - 1e-9);
    expect(ys[top]).toBeGreaterThan(from.y);
  });

  it('holds still at the ends after the flight is over', () => {
    expect(bombPosition(from, to, 5, 0.7, 2).z).toBeCloseTo(to.z);
    expect(bombPosition(from, to, -1, 0.7, 2).z).toBeCloseTo(from.z);
  });

  it('lobs further targets a little higher, within limits', () => {
    expect(arcHeightFor(10)).toBeGreaterThan(arcHeightFor(2));
    expect(arcHeightFor(1000)).toBe(arcHeightFor(14));
  });
});

describe('lane layout', () => {
  it('spaces lanes evenly either side of the middle', () => {
    const xs = [0, 1, 2, 3].map((i) => laneX(i, END_Z, 1.2));
    expect(xs[0]).toBeCloseTo(-xs[3]);
    expect(xs[1]).toBeCloseTo(-xs[2]);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1]);
    expect(LANES).toBe(4);
  });

  it('widens the lanes with distance, so the zombies fan out as they emerge', () => {
    expect(laneX(3, SPAWN_Z, 1)).toBeGreaterThan(laneX(3, START_Z, 1));
    expect(laneX(3, START_Z, 1)).toBeGreaterThan(laneX(3, END_Z, 1));
  });

  it('never makes a lane narrower than the one at the barricade', () => {
    expect(laneX(3, 4, 1)).toBeCloseTo(laneX(3, 0, 1));
  });

  for (const [w, h] of SCREENS) {
    describe(`${w}x${h}`, () => {
      const camera = cameraFor(w, h);
      const { lane } = fitView(w / h);

      it('keeps all four zombies on screen from the mist to the barricade', () => {
        for (const z of [SPAWN_Z, START_Z, END_Z]) {
          for (let i = 0; i < LANES; i++) {
            const p = toScreen(camera, w, h, new Vector3(laneX(i, z, lane), 1.2, z));
            expect(p.x).toBeGreaterThan(20);
            expect(p.x).toBeLessThan(w - 20);
          }
        }
      });

      it('keeps neighbouring lanes the same distance apart on screen all the way along', () => {
        const gap = (z: number) => {
          const a = toScreen(camera, w, h, new Vector3(laneX(1, z, lane), 1, z));
          const b = toScreen(camera, w, h, new Vector3(laneX(2, z, lane), 1, z));
          return b.x - a.x;
        };
        expect(gap(START_Z)).toBeCloseTo(gap(END_Z), 0);
        expect(gap(SPAWN_Z)).toBeCloseTo(gap(END_Z), 0);
      });
    });
  }

  it('widens the lanes on wide screens and zooms out on narrow ones', () => {
    expect(fitView(16 / 9).lane).toBeGreaterThan(fitView(9 / 16).lane);
    expect(fitView(9 / 16).fov).toBeGreaterThan(fitView(16 / 9).fov);
    expect(fitView(0).lane).toBeGreaterThan(0);
  });
});

describe('answer signs', () => {
  const area = { left: 8, top: 120, right: 0, bottom: 0 };
  const H = 64;
  const GAP = 6;

  const overlaps = (
    a: { x: number; y: number; w: number },
    b: { x: number; y: number; w: number },
  ) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < H;

  /** Signs hung over the zombies' heads at the start line, the barricade and in between. */
  for (const [w, h] of SCREENS) {
    it(`never overlap each other or leave the screen at ${w}x${h}, even with long answers`, () => {
      const camera = cameraFor(w, h);
      const { lane } = fitView(w / h);
      const random = seededRandom(w * 31 + h);
      const bounds = { ...area, right: w - 8, bottom: h - 64 };
      for (const z of [START_Z, (START_Z + END_Z) / 2, END_Z]) {
        for (const widths of [
          [64, 64, 64, 64],
          [72, 90, 68, 80],
          [150, 64, 140, 64],
          [220, 220, 220, 220],
          ...Array.from({ length: 20 }, () =>
            Array.from({ length: LANES }, () => 64 + Math.floor(random() * 160)),
          ),
        ]) {
          const items = widths.map((width, i) => {
            const head = toScreen(camera, w, h, new Vector3(laneX(i, z, lane), 2.4, z));
            return { x: head.x + (random() - 0.5) * 16, y: head.y - 12 - H / 2, w: width };
          });
          const placed = layoutSigns(items, H, GAP, bounds).map((p, i) => ({ ...p, w: widths[i] }));
          placed.forEach((a, i) => {
            expect(a.x - a.w / 2).toBeGreaterThanOrEqual(bounds.left - 1e-6);
            expect(a.x + a.w / 2).toBeLessThanOrEqual(bounds.right + 1e-6);
            expect(a.y - H / 2).toBeGreaterThanOrEqual(bounds.top - 1e-6);
            expect(a.y + H / 2).toBeLessThanOrEqual(bounds.bottom + 1e-6);
            for (const b of placed.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
          });
        }
      }
    });
  }

  it('leaves signs where they are when there is room', () => {
    const items = [
      { x: 100, y: 300, w: 64 },
      { x: 200, y: 310, w: 64 },
    ];
    const placed = layoutSigns(items, H, GAP, { left: 0, right: 400, top: 100, bottom: 700 });
    expect(placed).toEqual([
      { x: 100, y: 300 },
      { x: 200, y: 310 },
    ]);
  });

  it('lifts a sign clear of a nearer one that it would overlap', () => {
    const items = [
      { x: 100, y: 300, w: 100 },
      { x: 140, y: 290, w: 100 },
    ];
    const [near, far] = layoutSigns(items, H, GAP, { left: 0, right: 400, top: 100, bottom: 700 });
    expect(near.y).toBe(300);
    expect(far.y).toBe(300 - H - GAP);
  });

  it('keeps a sign inside the edges of the screen', () => {
    const [sign] = layoutSigns([{ x: 2, y: 300, w: 80 }], H, GAP, {
      left: 8,
      right: 360,
      top: 100,
      bottom: 600,
    });
    expect(sign.x).toBe(48);
  });
});

describe('zombie', () => {
  it('hangs its sign above its head and puts the bomb at its feet', () => {
    const zombie = createZombie();
    zombie.object.position.set(1, 0, -4);
    zombie.update(0.016);
    const sign = zombie.signAnchor(new Vector3());
    const feet = zombie.feetPosition(new Vector3());
    expect(sign.y).toBeGreaterThan(1.8);
    expect(sign.x).toBeCloseTo(1, 0);
    expect(feet.y).toBeLessThan(0.3);
    expect(feet.z).toBeGreaterThan(-4);
  });

  it('can be hit by a ray through its body but not one that misses', () => {
    const zombie = createZombie();
    zombie.object.position.set(-1, 0, -4);
    zombie.object.updateMatrixWorld(true);
    const ray = new Raycaster();
    const eye = CAMERA.clone();
    ray.set(eye, new Vector3(-1, 1, -4).sub(eye).normalize());
    expect(ray.intersectObject(zombie.hitbox, false)).toHaveLength(1);
    ray.set(eye, new Vector3(2, 1, -4).sub(eye).normalize());
    expect(ray.intersectObject(zombie.hitbox, false)).toHaveLength(0);
  });

  it('is knocked flat on its back and stays down after a blast', () => {
    const zombie = createZombie();
    zombie.setMode('blast');
    for (let i = 0; i < 100; i++) zombie.update(0.02);
    const lowHead = zombie.signAnchor(new Vector3());
    // Lying down, the head is no longer up at standing height.
    expect(lowHead.y).toBeLessThan(1.6);
    zombie.reset();
    zombie.update(0.016);
    expect(zombie.signAnchor(new Vector3()).y).toBeGreaterThan(1.8);
    expect(zombie.mode).toBe('sway');
  });

  it('stops dead when frozen', () => {
    const zombie = createZombie();
    zombie.setMode('walk');
    zombie.update(0.3);
    zombie.setMode('freeze');
    const before = zombie.signAnchor(new Vector3());
    zombie.update(0.5);
    expect(zombie.signAnchor(new Vector3()).distanceTo(before)).toBeLessThan(1e-9);
  });

  it('turns round to run away', () => {
    const zombie = createZombie();
    zombie.setMode('run');
    for (let i = 0; i < 30; i++) zombie.update(0.03);
    expect(Math.cos(zombie.object.rotation.y)).toBeLessThan(-0.99);
  });
});

describe('thrower', () => {
  it('lets go of the bomb once, at the release time, from in front of the kid', () => {
    const kid = createThrower();
    kid.object.position.set(0, 0, 1.5);
    let released = 0;
    let at = -1;
    let hand = new Vector3();
    kid.throwBomb(() => {
      released++;
      hand = kid.handPosition(new Vector3());
    });
    const dt = 0.02;
    for (let t = dt; t < 1.2; t += dt) {
      kid.update(dt, t);
      if (released === 1 && at < 0) at = t;
    }
    expect(released).toBe(1);
    expect(at).toBeGreaterThanOrEqual(RELEASE_TIME - 1e-9);
    expect(at).toBeLessThan(RELEASE_TIME + 0.05);
    // Overarm: the hand is above the kid's head, a little forward of the body.
    expect(hand.y).toBeGreaterThan(1);
    expect(hand.z).toBeLessThan(1.6);
  });
});

describe('effects', () => {
  it('clears itself away after a boom and a fizzle', () => {
    const effects = createEffects();
    effects.boom(new Vector3(0, 0, -3));
    effects.fizzle(new Vector3(1, 0, -3));
    effects.poof(new Vector3(-1, 0, -3));
    expect(effects.object.children.length).toBeGreaterThan(10);
    for (let i = 0; i < 100; i++) effects.update(0.05);
    expect(effects.object.children).toHaveLength(0);
  });
});

describe('fence breaking', () => {
  it('picks the planks within reach of a lane', () => {
    const xs = [-2.25, -0.75, 0.75, 2.25];
    expect(planksInReach(xs, 0.4, 0.9)).toEqual([2]);
    expect(planksInReach(xs, 2.7, 0.9)).toEqual([3]);
    expect(planksInReach(xs, 9, 0.9)).toEqual([]);
  });

  it('flies a plank up and over, then leaves it on the grass where it landed', () => {
    const from = { x: 1, y: 0.5, z: 0.14 };
    const v = { x: 1.2, y: 3, z: 2 };
    expect(plankFlight(from, v, 0, 0.06)).toEqual(from);
    const up = plankFlight(from, v, 0.3, 0.06);
    expect(up.y).toBeGreaterThan(from.y);
    expect(up.z).toBeGreaterThan(from.z);
    const land = fallTime(from.y, v.y, 0.06);
    const landed = plankFlight(from, v, land, 0.06);
    expect(landed.y).toBeCloseTo(0.06, 6);
    // After landing it neither sinks nor slides.
    const later = plankFlight(from, v, land + 2, 0.06);
    expect(later).toEqual(landed);
    expect(landed.z).toBeCloseTo(from.z + v.z * land, 6);
  });

  it('writes into the point it is given', () => {
    const out = { x: 0, y: 0, z: 0 };
    const p = plankFlight({ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 1 }, 0.1, 0.06, 9.8, out);
    expect(p).toBe(out);
    expect(out.x).toBeCloseTo(0.1, 6);
  });

  it('pops back with a little overshoot and ends exactly home', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map((t) => easeOutBack(t)))).toBeGreaterThan(1);
  });

  it('wraps angles so blending back never spins the long way', () => {
    expect(wrapAngle(Math.PI * 2 + 0.2)).toBeCloseTo(0.2, 6);
    expect(wrapAngle(-Math.PI * 2 - 0.2)).toBeCloseTo(-0.2, 6);
  });

  it('smashes a lane open, then mends it', () => {
    const fence = barricade();
    const planks = fence.object.children.filter((c) => c.position.z > 0);
    const before = planks.map((p) => p.position.clone());
    expect(planks).toHaveLength(36);
    fence.smash(0.4);
    for (let i = 0; i < 60; i++) fence.update(1 / 60);
    const moved = planks.filter((p, i) => p.position.distanceTo(before[i]) > 0.5);
    // One column of three planks is gone, the rest stay put.
    expect(moved).toHaveLength(3);
    expect(Math.min(...moved.map((p) => p.position.z))).toBeGreaterThan(BARRICADE_Z);
    fence.repair();
    for (let i = 0; i < 60; i++) fence.update(1 / 60);
    planks.forEach((p, i) => expect(p.position.distanceTo(before[i])).toBeLessThan(1e-6));
  });

  it('puts the end of the break beyond the barricade and short of the kid', () => {
    expect(BREAK_Z).toBeGreaterThan(END_Z);
    expect(BREAK_Z).toBeLessThan(1.5);
  });
});

describe('charging zombie', () => {
  it('faces the player rather than turning away', () => {
    const zombie = createZombie();
    zombie.setMode('charge');
    for (let i = 0; i < 30; i++) zombie.update(0.03);
    expect(Math.cos(zombie.object.rotation.y)).toBeGreaterThan(0.99);
  });
});

describe('thrower head', () => {
  it('has a head sitting clear above the torso and a pack below the neck', () => {
    const kid = createThrower();
    kid.update(0.016, 0);
    kid.object.updateMatrixWorld(true);
    let top = 0;
    kid.object.traverse((o) => {
      if ('geometry' in o) {
        const box = new Box3().setFromObject(o);
        top = Math.max(top, box.max.y);
      }
    });
    expect(top).toBeGreaterThan(1.3);
    expect(top).toBeLessThan(1.5);
  });
});

describe('waves', () => {
  it('sends 6, 8, 10 … regular zombies', () => {
    expect([1, 2, 3, 4].map(zombiesInWave)).toEqual([6, 8, 10, 12]);
  });

  it('spawns every 5 seconds at first, half a second faster each wave, never under 1 second', () => {
    expect([1, 2, 3, 9, 10, 30].map(spawnInterval)).toEqual([5, 4.5, 4, 1, 1, 1]);
  });
});

describe('walk pace', () => {
  const path = END_Z - SPAWN_Z;

  it('covers the whole path in the question time', () => {
    for (const seconds of [15, 10, 5]) expect(walkSpeed(seconds) * seconds).toBeCloseTo(path);
  });

  it('is slower for the boss and slower still while a wrong answer is explained', () => {
    expect(walkSpeed(10, true)).toBeCloseTo(walkSpeed(10) * 0.5);
    expect(walkSpeed(10, false, true)).toBeCloseTo(walkSpeed(10) * 0.25);
    expect(walkSpeed(10, true, true)).toBeCloseTo(walkSpeed(10) * 0.125);
  });

  it('copes with a zero question time', () => {
    expect(Number.isFinite(walkSpeed(0))).toBe(true);
  });

  it('eases towards a goal without overshooting', () => {
    let pace = 0;
    for (let i = 0; i < 30; i++) {
      const next = easeToward(pace, 4, 6, 1 / 60);
      expect(next).toBeGreaterThan(pace);
      expect(next).toBeLessThanOrEqual(4);
      pace = next;
    }
    // Most of the way there after half a second.
    expect(pace).toBeGreaterThan(3.7);
  });
});

describe('score', () => {
  it('steps the multiplier up at streaks of 5 and 10', () => {
    expect([1, 4, 5, 9, 10, 25].map(multiplierFor)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('counts a streak up on hits and resets it on a miss', () => {
    expect(nextStreak(3, true)).toBe(4);
    expect(nextStreak(3, false)).toBe(0);
  });

  it('gives 100 to 150 points for the answer time, times the multiplier', () => {
    expect(hitPoints(0, 10, 1)).toBe(150);
    expect(hitPoints(5, 10, 1)).toBe(125);
    expect(hitPoints(10, 10, 1)).toBe(100);
    expect(hitPoints(30, 10, 1)).toBe(100);
    expect(hitPoints(0, 10, 5)).toBe(300);
    expect(hitPoints(0, 10, 10)).toBe(450);
    expect(hitPoints(1, 0, 1)).toBe(100);
  });

  it('words the outcome for one zombie and for many', () => {
    expect(outcomeText(3, 1)).toBe('You reached wave 3 and blasted 1 zombie!');
    expect(outcomeText(1, 7)).toBe('You reached wave 1 and blasted 7 zombies!');
  });
});

describe('targeting', () => {
  it('picks the zombie nearest the barricade, ignoring those that cannot be hit', () => {
    expect(closestIndex([-10, -3, -7])).toBe(1);
    expect(closestIndex([-10, null, -7])).toBe(2);
    expect(closestIndex([null, null])).toBe(-1);
    expect(closestIndex([])).toBe(-1);
  });

  it('prefers a clear lane, then the lane whose last zombie has walked furthest', () => {
    expect(pickLane([-5, null, -9, -2], () => 0)).toBe(1);
    expect(pickLane([-5, -8, -9, -2], () => 0)).toBe(3);
    expect(pickLane([null, null, null, null], () => 0.99)).toBe(3);
  });

  it('breaks ties at random among the best lanes only', () => {
    const lanes = [-5, null, -9, null];
    expect(pickLane(lanes, () => 0)).toBe(1);
    expect(pickLane(lanes, () => 0.99)).toBe(3);
    const random = seededRandom(5);
    for (let i = 0; i < 50; i++) expect([1, 3]).toContain(pickLane(lanes, random));
  });
});

describe('wave spawner', () => {
  it('sends the first zombie at once, as the field is empty', () => {
    const spawner = createWaveSpawner();
    expect(spawner.left).toBe(6);
    expect(spawner.update(0, 0)).toBe(1);
    expect(spawner.left).toBe(5);
  });

  it('sends the next after the interval when one is walking, and not before', () => {
    const spawner = createWaveSpawner();
    spawner.update(0, 0);
    expect(spawner.update(4.9, 1)).toBe(0);
    expect(spawner.update(0.2, 1)).toBe(1);
    // The interval restarts at each spawn.
    expect(spawner.update(4.9, 2)).toBe(0);
    expect(spawner.update(0.2, 2)).toBe(1);
  });

  it('sends one at once whenever the field empties', () => {
    const spawner = createWaveSpawner();
    spawner.update(0, 0);
    expect(spawner.update(0.5, 1)).toBe(0);
    expect(spawner.update(0.016, 0)).toBe(1);
    // ... and the interval restarts from that spawn.
    expect(spawner.update(4.9, 1)).toBe(0);
  });

  it('waits while the field is full and sends the moment there is room', () => {
    const spawner = createWaveSpawner();
    expect(spawner.update(60, MAX_ON_FIELD)).toBe(0);
    expect(spawner.update(60, MAX_ON_FIELD + 1)).toBe(0);
    expect(spawner.left).toBe(6);
    expect(spawner.update(0.016, MAX_ON_FIELD - 1)).toBe(1);
  });

  it('counts down to the boss, which is due once the last regular is gone', () => {
    const spawner = createWaveSpawner();
    for (let i = 0; i < 6; i++) expect(spawner.update(0, 0)).toBe(1);
    expect(spawner.left).toBe(0);
    expect(spawner.update(10, 0)).toBe(0);
    expect(spawner.bossDue).toBe(true);
    // Not while any regular is still walking.
    spawner.update(0.1, 2);
    expect(spawner.bossDue).toBe(false);
    spawner.update(0.1, 0);
    expect(spawner.bossDue).toBe(true);
    spawner.bossSent();
    expect(spawner.bossDue).toBe(false);
  });

  it('is not due for the boss right after the last regular is sent', () => {
    const spawner = createWaveSpawner();
    for (let i = 0; i < 6; i++) spawner.update(0, 0);
    expect(spawner.bossDue).toBe(false);
  });

  it('starts the next wave with more zombies and a shorter interval', () => {
    const spawner = createWaveSpawner();
    for (let i = 0; i < 6; i++) spawner.update(0, 0);
    spawner.update(1, 0);
    spawner.bossSent();
    spawner.nextWave();
    expect(spawner.wave).toBe(2);
    expect(spawner.left).toBe(8);
    expect(spawner.bossDue).toBe(false);
    expect(spawner.update(0, 0)).toBe(1);
    expect(spawner.update(4.4, 1)).toBe(0);
    expect(spawner.update(0.2, 1)).toBe(1);
  });
});

describe('brute boss', () => {
  const brute = () => createZombie(BRUTE_LOOK, { brute: true });

  it('is nearly twice as tall as a regular zombie', () => {
    const regular = createZombie();
    const boss = brute();
    for (const z of [regular, boss]) z.update(0.016);
    const ratio = boss.signAnchor(new Vector3()).y / regular.signAnchor(new Vector3()).y;
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(2.3);
    expect(boss.brute).toBe(true);
    expect(regular.brute).toBe(false);
    expect(regular.armour).toHaveLength(0);
    expect(regular.armourLeft).toBe(0);
  });

  it('is broader than a regular zombie', () => {
    const width = (z: ReturnType<typeof createZombie>) => {
      z.object.updateMatrixWorld(true);
      const box = new Box3().setFromObject(z.object);
      return (box.max.x - box.min.x) / z.object.scale.x;
    };
    expect(width(brute())).toBeGreaterThan(width(createZombie()) * 1.25);
  });

  it('puts the bomb target at its feet, further out at the bigger scale', () => {
    const regular = createZombie(ZOMBIE_LOOKS[0]);
    const boss = brute();
    for (const z of [regular, boss]) z.object.position.set(0, 0, -4);
    const a = regular.feetPosition(new Vector3());
    const b = boss.feetPosition(new Vector3());
    expect(b.y).toBeLessThan(0.3);
    expect(b.z).toBeGreaterThan(a.z);
    expect(b.z).toBeLessThan(-4 + 1.2);
  });

  it('wears three pieces of armour, and each hit takes the next one off', () => {
    const scene = new Group();
    const boss = brute();
    scene.add(boss.object);
    expect(boss.armour.map((p) => p.name)).toEqual([...ARMOUR_ORDER]);
    expect(ARMOUR_ORDER).toEqual(['pads', 'chest', 'helmet']);
    expect(boss.armourLeft).toBe(3);
    boss.armour.forEach((p) => p.parts.forEach((part) => expect(part.parent).not.toBeNull()));
    const attachedParts = (name: string) =>
      boss.armour.find((p) => p.name === name)!.parts.map((part) => part.parent !== scene);
    for (const [i, name] of ARMOUR_ORDER.entries()) {
      expect(boss.knockOffArmour()).not.toBeNull();
      expect(boss.armourLeft).toBe(2 - i);
      expect(boss.armour.filter((p) => !p.attached).map((p) => p.name)).toEqual(
        ARMOUR_ORDER.slice(0, i + 1),
      );
      // The piece that came off now hangs in the scene, the rest still on the boss.
      expect(attachedParts(name).every((onBoss) => !onBoss)).toBe(true);
      for (const later of ARMOUR_ORDER.slice(i + 1)) {
        expect(attachedParts(later).every(Boolean)).toBe(true);
      }
    }
  });

  it('has two shoulder pads that come off together, and never goes below no armour', () => {
    const boss = brute();
    expect(boss.armour[0].parts).toHaveLength(2);
    for (let i = 0; i < 3; i++) expect(boss.knockOffArmour()).not.toBeNull();
    expect(boss.knockOffArmour()).toBeNull();
    expect(boss.armourLeft).toBe(0);
  });

  it('throws armour up, lands it on the grass and then lets it vanish', () => {
    const scene = new Group();
    const boss = brute();
    scene.add(boss.object);
    boss.object.position.set(0, 0, -5);
    boss.update(0.016);
    boss.knockOffArmour();
    const helmetless = boss.armour[0].parts[0];
    const startY = helmetless.position.y;
    let top = startY;
    for (let i = 0; i < 20; i++) {
      boss.update(0.02);
      top = Math.max(top, helmetless.position.y);
    }
    expect(top).toBeGreaterThan(startY + 0.5);
    for (let i = 0; i < 60; i++) boss.update(0.05);
    expect(helmetless.position.y).toBeLessThan(0.3);
    for (let i = 0; i < 100; i++) boss.update(0.05);
    expect(helmetless.visible).toBe(false);
  });

  it('puts all the armour back on reset', () => {
    const scene = new Group();
    const boss = brute();
    scene.add(boss.object);
    const homes = boss.armour.flatMap((p) => p.parts.map((part) => [part, part.parent] as const));
    for (let i = 0; i < 3; i++) boss.knockOffArmour();
    for (let i = 0; i < 200; i++) boss.update(0.05);
    boss.reset();
    expect(boss.armourLeft).toBe(3);
    for (const [part, parent] of homes) {
      expect(part.parent).toBe(parent);
      expect(part.visible).toBe(true);
    }
  });

  it('flashes white when hit and then goes back to its own colours', () => {
    const boss = brute();
    const materials: MeshStandardMaterial[] = [];
    boss.object.traverse((o) => {
      const m = (o as { material?: unknown }).material;
      if (m instanceof MeshStandardMaterial) materials.push(m);
    });
    const colours = materials.map((m) => m.color.getHex());
    const emissive = materials.map((m) => m.emissive.getHex());
    boss.flash();
    expect(materials.some((m) => m.emissive.getHex() === 0xffffff)).toBe(true);
    for (let i = 0; i < 10; i++) boss.update(0.02);
    expect(materials.map((m) => m.color.getHex())).toEqual(colours);
    expect(materials.map((m) => m.emissive.getHex())).toEqual(emissive);
  });

  it('lurches back when hit and recovers', () => {
    const boss = brute();
    boss.setMode('walk');
    boss.update(0.1);
    const upright = boss.signAnchor(new Vector3());
    boss.stagger();
    boss.update(0.2);
    const leaning = boss.signAnchor(new Vector3());
    expect(leaning.distanceTo(upright)).toBeGreaterThan(0.01);
    for (let i = 0; i < 40; i++) boss.update(0.02);
    expect(boss.signAnchor(new Vector3()).y).toBeGreaterThan(upright.y - 0.4);
  });

  it('thumps on each step of its walk, but not when standing', () => {
    const boss = brute();
    let steps = 0;
    boss.onFootfall = () => steps++;
    boss.setMode('sway');
    for (let i = 0; i < 100; i++) boss.update(0.02);
    expect(steps).toBe(0);
    boss.setMode('walk');
    for (let i = 0; i < 300; i++) boss.update(0.02);
    expect(steps).toBeGreaterThan(5);
    expect(steps).toBeLessThan(14);
  });

  it('is knocked out like any zombie once the armour is gone', () => {
    const boss = brute();
    for (let i = 0; i < 3; i++) boss.knockOffArmour();
    boss.setMode('blast');
    for (let i = 0; i < 100; i++) boss.update(0.02);
    expect(boss.signAnchor(new Vector3()).y).toBeLessThan(3);
  });
});

describe('horde', () => {
  const make = () => {
    const scene = new Group();
    const effects = createEffects();
    const horde = createHorde(scene, effects, seededRandom(3));
    horde.setLane(1.2);
    return { scene, effects, horde };
  };
  const run = (horde: ReturnType<typeof make>['horde'], seconds: number, speed = 2) => {
    for (let t = 0; t < seconds; t += 0.05) horde.update(0.05, speed);
  };

  it('makes every zombie up front and puts them all in the scene, hidden', () => {
    const { scene, horde } = make();
    expect(horde.slots).toHaveLength(MAX_ON_FIELD + 3 + 1);
    expect(scene.children).toHaveLength(horde.slots.length);
    expect(horde.slots.every((s) => !s.zombie.object.visible && s.state === 'idle')).toBe(true);
  });

  it('sends a zombie out of the mist in one of the lanes and walks it to the barricade', () => {
    const { horde } = make();
    const slot = horde.spawn()!;
    expect(slot.z).toBe(SPAWN_Z);
    expect(slot.lane).toBeGreaterThanOrEqual(0);
    expect(slot.lane).toBeLessThan(LANES);
    expect(slot.zombie.mode).toBe('walk');
    expect(horde.walkingCount).toBe(1);
    run(horde, 2, 4);
    expect(slot.z).toBeCloseTo(SPAWN_Z + 8, 0);
    expect(slot.zombie.object.position.z).toBeCloseTo(slot.z);
    // It stays in its lane, give or take the wobble.
    expect(Math.abs(slot.zombie.object.position.x - laneX(slot.lane, slot.z, 1.2))).toBeLessThan(
      0.15 * 1.2 * 4 + 1e-6,
    );
  });

  it('walks the boss at half pace down the middle', () => {
    const { horde } = make();
    const regular = horde.spawn()!;
    const boss = horde.spawnBoss();
    run(horde, 2, 4);
    expect(boss.z - SPAWN_Z).toBeCloseTo((regular.z - SPAWN_Z) / 2, 1);
    expect(boss.zombie.object.position.x).toBe(0);
  });

  it('spreads new zombies over the lanes rather than stacking them', () => {
    const { horde } = make();
    const lanes = Array.from({ length: 4 }, () => horde.spawn()!.lane);
    expect(new Set(lanes).size).toBe(4);
  });

  it('picks the zombie nearest the barricade, and skips the knocked out', () => {
    const { horde } = make();
    const first = horde.spawn()!;
    run(horde, 1);
    const second = horde.spawn()!;
    expect(horde.closest()).toBe(first);
    horde.blast(first);
    expect(first.zombie.mode).toBe('blast');
    expect(horde.closest()).toBe(second);
    expect(horde.walkingCount).toBe(1);
    horde.blast(second);
    expect(horde.closest()).toBeNull();
  });

  it('lets a knocked out zombie lie there, then poof away and free its place', () => {
    const { horde, effects } = make();
    const slot = horde.spawn()!;
    horde.blast(slot);
    run(horde, 1);
    expect(slot.state).toBe('blasted');
    expect(slot.zombie.object.visible).toBe(true);
    run(horde, 0.5);
    expect(slot.state).toBe('idle');
    expect(slot.zombie.object.visible).toBe(false);
    expect(effects.object.children.length).toBeGreaterThan(0);
  });

  it('tells you when a zombie reaches the barricade, leans it there, then poofs it', () => {
    const { horde } = make();
    const reached: number[] = [];
    horde.onReach((slot) => reached.push(slot.z));
    const slot = horde.spawn()!;
    run(horde, 20, 5);
    expect(reached).toEqual([END_Z]);
    expect(slot.state === 'idle').toBe(true);
    const other = horde.spawn()!;
    run(horde, 2, 10);
    expect(other.state).toBe('reached');
    expect(other.zombie.mode).toBe('lean');
    run(horde, 1, 10);
    expect(other.state).toBe('idle');
    expect(horde.walkingCount).toBe(0);
  });

  it('keeps zombies leaning over the barricade when told to linger', () => {
    const { horde } = make();
    horde.setLingering(true);
    const slot = horde.spawn()!;
    run(horde, 20, 5);
    expect(slot.state).toBe('reached');
    expect(slot.zombie.object.visible).toBe(true);
  });

  it('holds a laughing zombie still until told to walk on', () => {
    const { horde } = make();
    const slot = horde.spawn()!;
    run(horde, 1, 3);
    horde.laugh(slot);
    const z = slot.z;
    run(horde, 1, 3);
    expect(slot.z).toBe(z);
    expect(slot.zombie.mode).toBe('laugh');
    expect(horde.walkingCount).toBe(1);
    horde.unlaugh();
    run(horde, 1, 3);
    expect(slot.z).toBeGreaterThan(z);
    expect(slot.zombie.mode).toBe('walk');
  });

  it('staggers the boss back, but never past the mist', () => {
    const { horde } = make();
    const boss = horde.spawnBoss();
    run(horde, 4, 4);
    const before = boss.z;
    horde.knockBack(boss, 1.5);
    run(horde, 0.6, 0);
    expect(boss.z).toBeCloseTo(before - 1.5, 3);
    const fresh = horde.spawn()!;
    horde.knockBack(fresh, 5);
    run(horde, 0.6, 0);
    expect(fresh.z).toBe(SPAWN_Z);
  });

  it('never runs out of places: the oldest body makes way for a new zombie', () => {
    const { horde } = make();
    for (let i = 0; i < MAX_ON_FIELD + 3; i++) horde.blast(horde.spawn()!);
    expect(horde.spawn()).not.toBeNull();
  });

  it('puts the boss back for the next wave with all its armour on', () => {
    const { horde } = make();
    const boss = horde.spawnBoss();
    boss.zombie.knockOffArmour();
    horde.blast(boss);
    run(horde, 3);
    expect(boss.state).toBe('idle');
    horde.spawnBoss();
    expect(boss.zombie.armourLeft).toBe(3);
    expect(boss.z).toBe(SPAWN_Z);
  });
});
