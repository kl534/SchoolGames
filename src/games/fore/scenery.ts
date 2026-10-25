/**
 * Where the trees, bushes, rocks and flowers around a hole go, and where its cart path runs. Pure:
 * no DOM, no three.js. Seeded by the hole's length and bend, so a hole always looks the same.
 * Gameplay trees (`Hole.trees`) are not here; `hole.ts` draws those from `Hole.trees`.
 */
import { seededRandom, type Random } from '../../shared/random';
import { centreX, GREEN_R, inEllipse, type Hole } from './course';

export type Species = 'pine' | 'oak' | 'birch';

export interface SceneryTree {
  x: number;
  z: number;
  species: Species;
  /** The random size factor, 0.85 to 1.15. */
  scale: number;
  yaw: number;
  /** Final height and crown radius in yards (the factor included). */
  height: number;
  r: number;
}
export interface Bush {
  x: number;
  z: number;
  r: number;
}
export interface Rock extends Bush {
  yaw: number;
}
export interface Flower {
  x: number;
  z: number;
  color: number;
}
export interface Scenery {
  trees: SceneryTree[];
  bushes: Bush[];
  rocks: Rock[];
  flowers: Flower[];
  /** The side (-1 left, 1 right) with the thick grove and the cart path. */
  groveSide: -1 | 1;
}

/** No scenery tree stands nearer than this to the centre line (a ball can land 60 off it). */
export const LINE_CLEAR = 62;
/** Bushes and rocks stay at least this far off the centre line. */
export const LOW_MIN_OFF = 22;
/** The rough ends here for low things. */
const LOW_MAX_OFF = 58;
/** The cart path runs this far off the centre line and is this wide. */
export const PATH_OFF = 26;
export const PATH_WIDTH = 1.4;
export const MAX_TREES = 250;
const FLOWER_COLOURS = [0xffd84a, 0xffffff, 0xff8fb0];

const range = (rand: Random, a: number, b: number) => a + (b - a) * rand();

export function sceneryTrees(rand: Random, h: Hole, groveSide: -1 | 1): SceneryTree[] {
  const trees: SceneryTree[] = [];
  const add = (x: number, z: number) => {
    const u = rand();
    const species: Species = u < 0.45 ? 'pine' : u < 0.8 ? 'oak' : 'birch';
    const scale = range(rand, 0.85, 1.15);
    trees.push({
      x,
      z,
      species,
      scale,
      yaw: rand() * Math.PI * 2,
      height: range(rand, 10.6, 13.9) * scale,
      r: range(rand, 3.53, 5.2) * scale,
    });
  };
  // Tree lines on both sides, three rows deep, with clearings where the hills show through.
  for (const side of [-1, 1]) {
    const clearings: [number, number][] = [];
    for (let z = range(rand, 120, 200) - 40; z < h.length + 60; z += range(rand, 120, 200)) {
      clearings.push([z, z + range(rand, 25, 45)]);
    }
    for (let row = 0; row < 3; row++) {
      const base = 64 + row * 24;
      let z = -40 + rand() * 4;
      while (z < h.length + 60) {
        const clearing = clearings.find(([a, b]) => z >= a && z <= b);
        if (clearing) {
          z = clearing[1] + 1;
          continue;
        }
        const off = Math.min(base + range(rand, -2, 8), 128);
        add(centreX(h, z) + side * off, z);
        z += range(rand, 6, 11);
      }
    }
  }
  // Behind the tee, and a grove behind the green that is thickest on one side.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) add(side * range(rand, LINE_CLEAR, 100), range(rand, -60, -22));
    const count = side === groveSide ? 34 : 12;
    for (let i = 0; i < count; i++) {
      add(side * range(rand, LINE_CLEAR, 90), h.length + range(rand, 26, 90));
    }
  }
  if (trees.length <= MAX_TREES) return trees;
  const keep = (MAX_TREES - 10) / trees.length;
  return trees.filter(() => rand() < keep).slice(0, MAX_TREES);
}

/** The path's centre points in runs, with the runs broken where it would cross a hazard or tree. */
export function cartPath(h: Hole, side: -1 | 1): { x: number; z: number }[][] {
  const runs: { x: number; z: number }[][] = [];
  let run: { x: number; z: number }[] = [];
  const flush = () => {
    if (run.length > 1) runs.push(run);
    run = [];
  };
  for (let z = 0; z <= h.length; z += 5) {
    const p = { x: centreX(h, z) + side * PATH_OFF, z };
    const blocked =
      h.hazards.some((hz) =>
        inEllipse({ ...hz.at, rx: hz.at.rx + 1.5, rz: hz.at.rz + 1.5 }, p.x, p.z),
      ) || h.trees.some((tr) => Math.hypot(p.x - tr.x, p.z - tr.z) < tr.r + 2.5);
    if (blocked) flush();
    else run.push(p);
  }
  flush();
  return runs;
}

export function placeScenery(h: Hole): Scenery {
  const rand = seededRandom(Math.round(h.length * 31 + h.bend * 977 + 12345));
  const groveSide: -1 | 1 = rand() < 0.5 ? -1 : 1;
  const trees = sceneryTrees(rand, h, groveSide);

  const onPath = (x: number, z: number) =>
    z >= -3 &&
    z <= h.length + 3 &&
    Math.abs(x - centreX(h, z) - groveSide * PATH_OFF) < PATH_WIDTH / 2 + 2;
  // A low thing is not on a hazard (with 2 yd room), a gameplay tree, the path or the green.
  const clear = (x: number, z: number, r: number) =>
    !h.hazards.some((hz) =>
      inEllipse({ ...hz.at, rx: hz.at.rx + 2 + r, rz: hz.at.rz + 2 + r }, x, z),
    ) &&
    !h.trees.some((tr) => Math.hypot(x - tr.x, z - tr.z) < tr.r + r + 2) &&
    !onPath(x, z) &&
    Math.hypot(x - h.pin.x, z - h.pin.z) > GREEN_R + 4;

  const bushes: Bush[] = [];
  const target = 90 + Math.floor(rand() * 60);
  for (let tries = 0; bushes.length < target && tries < 400; tries++) {
    const side = rand() < 0.5 ? -1 : 1;
    const z = range(rand, -10, h.length + 20);
    const cx = centreX(h, z) + side * range(rand, 27, 52);
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n && bushes.length < 200; i++) {
      const x = cx + range(rand, -2.5, 2.5);
      const bz = z + range(rand, -2.5, 2.5);
      const r = range(rand, 0.5, 1.2);
      const off = Math.abs(x - centreX(h, bz));
      if (off >= LOW_MIN_OFF + 0.5 && off <= LOW_MAX_OFF && clear(x, bz, r)) {
        bushes.push({ x, z: bz, r });
      }
    }
  }

  const rocks: Rock[] = [];
  const rockCount = 4 + Math.floor(rand() * 5);
  for (let tries = 0; rocks.length < rockCount && tries < 200; tries++) {
    const side = rand() < 0.5 ? -1 : 1;
    const z = range(rand, 10, h.length + 10);
    const x = centreX(h, z) + side * range(rand, 24, 56);
    const r = range(rand, 0.3, 0.9);
    if (clear(x, z, r)) rocks.push({ x, z, r, yaw: rand() * Math.PI * 2 });
  }

  const flowers: Flower[] = [];
  const patches = 6 + Math.floor(rand() * 5);
  for (let tries = 0, made = 0; made < patches && tries < 200; tries++) {
    const side = rand() < 0.5 ? -1 : 1;
    // The first two patches sit around the tee box, the rest in the rough.
    const atTee = made < 2;
    const z = atTee ? range(rand, -4, 6) : range(rand, 0, h.length);
    const x = atTee ? side * range(rand, 6.5, 11) : centreX(h, z) + side * range(rand, 30, 55);
    if (!clear(x, z, 2)) continue;
    made++;
    const colour = FLOWER_COLOURS[Math.floor(rand() * FLOWER_COLOURS.length)];
    const n = 12 + Math.floor(rand() * 13);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 1.8;
      flowers.push({
        x: x + Math.cos(a) * d,
        z: z + Math.sin(a) * d,
        color: rand() < 0.8 ? colour : FLOWER_COLOURS[Math.floor(rand() * 3)],
      });
    }
  }

  return { trees, bushes, rocks, flowers, groveSide };
}
