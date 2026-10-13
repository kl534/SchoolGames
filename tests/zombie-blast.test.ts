import { PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createEffects } from '../src/games/zombie-blast/effects';
import {
  CAMERA,
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
  loseBrain,
  outOfBrains,
  zombieProgress,
} from '../src/games/zombie-blast/rules';
import { createThrower, RELEASE_TIME } from '../src/games/zombie-blast/thrower';
import { createZombie } from '../src/games/zombie-blast/zombie';
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
