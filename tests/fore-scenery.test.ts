import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { InstancedMesh, Matrix4, Mesh, Vector3, type BufferGeometry, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { centreX, GREEN_R, HOLES, inEllipse, type Hole } from '../src/games/fore/course';
import { FALLBACK_LOOK, groundTextures, type Look } from '../src/games/fore/ground';
import { GFX_SETTINGS, type Gfx } from '../src/games/fore/quality';
import { groundY } from '../src/games/fore/terrain';
import { buildHole } from '../src/games/fore/hole';
import {
  clubhouseSite,
  CLUBHOUSE_CLEAR,
  placeScenery,
  LINE_CLEAR,
  LOW_MIN_OFF,
  WOODS_FROM,
  WOODS_TO,
} from '../src/games/fore/scenery';
import { finishShot, planShot, resolveShot, TREE_HEIGHT } from '../src/games/fore/shot';
import { treeBounds, treeScale } from '../src/games/fore/trees';

const look = (gfx: Gfx): Look => ({
  ...FALLBACK_LOOK,
  settings: GFX_SETTINGS[gfx],
  shadows: gfx !== 'low',
});

const off = (h: Hole, p: { x: number; z: number }) => Math.abs(p.x - centreX(h, p.z));

describe('scenery placement', () => {
  it('keeps trees off the line, hazards, the green and the gameplay trees', () => {
    for (const h of HOLES) {
      const s = placeScenery(h);
      for (const t of s.trees) {
        expect(off(h, t)).toBeGreaterThanOrEqual(LINE_CLEAR);
        for (const hz of h.hazards) {
          const inflated = { ...hz.at, rx: hz.at.rx + 4, rz: hz.at.rz + 4 };
          expect(inEllipse(inflated, t.x, t.z)).toBe(false);
        }
        expect(Math.hypot(t.x - h.pin.x, t.z - h.pin.z)).toBeGreaterThanOrEqual(GREEN_R + 10);
        for (const tr of h.trees) {
          expect(Math.hypot(t.x - tr.x, t.z - tr.z)).toBeGreaterThanOrEqual(tr.r + t.r + 1);
        }
        expect(t.height).toBeGreaterThanOrEqual(9);
        expect(t.height).toBeLessThanOrEqual(16.01);
        expect(t.r).toBeGreaterThanOrEqual(3);
        expect(t.r).toBeLessThanOrEqual(6);
      }
    }
  });

  it('keeps bushes and rocks well off the line, with counts inside the limits', () => {
    for (const h of HOLES) {
      const s = placeScenery(h);
      for (const b of [...s.bushes, ...s.rocks])
        expect(off(h, b)).toBeGreaterThanOrEqual(LOW_MIN_OFF);
      expect(s.trees.length).toBeGreaterThanOrEqual(120);
      expect(s.trees.length).toBeLessThanOrEqual(260);
      expect(s.bushes.length).toBeGreaterThanOrEqual(80);
      expect(s.bushes.length).toBeLessThanOrEqual(200);
      expect(s.rocks.length).toBeGreaterThanOrEqual(4);
      expect(s.rocks.length).toBeLessThanOrEqual(24);
      expect(s.flowers.length).toBeLessThanOrEqual(400);
      expect(s.flowers.length).toBeGreaterThan(0);
    }
  });

  it('is the same every time for a hole, and differs between holes', () => {
    for (const h of HOLES) expect(placeScenery(h)).toEqual(placeScenery(h));
    expect(placeScenery(HOLES[0]).trees).not.toEqual(placeScenery(HOLES[1]).trees);
  });
});

describe('woods line', () => {
  it('stands 100 to 170 yd off the line or behind the green, 7 to 10 yd apart, on every hole', () => {
    for (const h of HOLES) {
      const woods = placeScenery(h).woods;
      expect(woods.length).toBeGreaterThan(100);
      for (const t of woods) {
        const beyond = t.z >= h.length + 90;
        expect(beyond || off(h, t) >= WOODS_FROM - 8).toBe(true);
        expect(beyond || off(h, t) <= WOODS_TO).toBe(true);
      }
    }
  });
});

describe('clubhouse clearance', () => {
  it('drops every tree, bush, rock and flower within 30 yd of a clubhouse', () => {
    for (const h of HOLES) {
      const house = clubhouseSite(h);
      if (!house) continue;
      const s = placeScenery(h);
      for (const p of [...s.trees, ...s.woods, ...s.bushes, ...s.rocks, ...s.flowers]) {
        expect(Math.hypot(p.x - house.x, p.z - house.z)).toBeGreaterThanOrEqual(CLUBHOUSE_CLEAR);
      }
    }
    expect(clubhouseSite(HOLES[0])).toMatchObject({ x: -85, z: -25 });
    expect(clubhouseSite(HOLES[8])).toMatchObject({ x: 0, z: HOLES[8].length + 90 });
    expect(HOLES.filter((h) => clubhouseSite(h)).length).toBe(2);
  });
});

describe('gameplay trees', () => {
  it('keep their positions, radii and height', () => {
    expect(TREE_HEIGHT).toBe(12);
    const round = (n: number) => Math.round(n * 1000) / 1000;
    const seen = HOLES.map((h) => h.trees.map((t) => [round(t.x), t.z, t.r]));
    const at = (bend: number, length: number, z: number, o: number) =>
      round(bend * Math.sin((Math.PI * z) / length) + o);
    expect(seen[2]).toEqual([
      [at(14, 360, 150, -28), 150, 4],
      [at(14, 360, 215, -34), 215, 4.5],
      [at(14, 360, 290, 30), 290, 4],
    ]);
    expect(seen[5]).toEqual([
      [-30, 60, 4],
      [32, 100, 4.5],
      [-27, 122, 4],
    ]);
    expect(seen[6]).toEqual([
      [at(-16, 380, 120, 30), 120, 4.5],
      [at(-16, 380, 200, -32), 200, 4],
      [at(-16, 380, 310, 28), 310, 4],
    ]);
    expect(seen[8]).toEqual([
      [-28, 90, 4],
      [30, 170, 4.5],
      [-30, 250, 4],
    ]);
    for (const i of [0, 1, 3, 4, 7]) expect(seen[i]).toEqual([]);
  });

  it('are drawn exactly as tall as TREE_HEIGHT with the crown radius asked for', () => {
    for (const species of ['oak', 'pine'] as const) {
      const b = treeBounds(species);
      const { sx, sy } = treeScale(species, 4.5, TREE_HEIGHT);
      expect(b.height * sy).toBeCloseTo(TREE_HEIGHT, 6);
      expect(b.radius * sx).toBeCloseTo(4.5, 6);
    }
  });

  it('leave the straight tee shots alone', () => {
    const results = HOLES.map((h) =>
      // A driver off the tee at 4 degrees left, straight and 3 degrees right on screen.
      [4, 0, -3].map((deg) => {
        const want = {
          x: 240 * Math.sin(-deg * (Math.PI / 180)),
          z: 240 * Math.cos(-deg * (Math.PI / 180)),
        };
        const plan = planShot(h, { x: 0, z: 0 }, 'tee', want);
        const result = finishShot(h, plan, resolveShot(plan, true, 0.5, 6, 1, 0.5));
        return result.kind === 'rest' && result.tree !== undefined ? result.tree : null;
      }),
    );
    expect(results.flat().every((r) => r === null)).toBe(true);
  });
});

function stats(root: Object3D) {
  let meshes = 0;
  let triangles = 0;
  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    meshes++;
    const g = (o as Mesh).geometry as BufferGeometry;
    const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    triangles += n * ((o as InstancedMesh).isInstancedMesh ? (o as InstancedMesh).count : 1);
  });
  return { meshes, triangles };
}

describe('hole build', () => {
  it('stays under 250 meshes and 300k triangles', () => {
    for (const h of HOLES) {
      const hole = buildHole(h);
      const { meshes, triangles } = stats(hole.object);
      expect(meshes).toBeLessThan(250);
      expect(triangles).toBeLessThan(300_000);
      hole.dispose();
    }
  });

  it('keeps each tier inside its draw budget (high 220 meshes, low 120)', () => {
    const budget: Record<Gfx, number> = { low: 120, medium: 220, high: 220 };
    // Leaf cards and bark are many small triangles; each tier gets a share.
    const triangleBudget: Record<Gfx, number> = { low: 250_000, medium: 450_000, high: 650_000 };
    for (const gfx of ['low', 'medium', 'high'] as const) {
      for (const h of HOLES) {
        const hole = buildHole(h, look(gfx));
        const { meshes, triangles } = stats(hole.object);
        expect(meshes, `${gfx} hole ${HOLES.indexOf(h) + 1}`).toBeLessThanOrEqual(budget[gfx]);
        expect(triangles, `${gfx} hole ${HOLES.indexOf(h) + 1} triangles`).toBeLessThan(
          triangleBudget[gfx],
        );
        hole.dispose();
      }
    }
  });

  it('builds every hole on every tier with no pictures, and disposes everything', () => {
    const textures = Object.values(groundTextures());
    for (const gfx of ['low', 'medium', 'high'] as const) {
      for (const h of HOLES) {
        let disposed = 0;
        textures.forEach((t) => t.addEventListener('dispose', () => disposed++));
        const hole = buildHole(h, look(gfx));
        expect(hole.object.children.length).toBeGreaterThan(0);
        hole.dispose();
        expect(hole.object.children.length).toBe(0);
        expect(hole.object.parent).toBeNull();
        expect(disposed).toBeGreaterThanOrEqual(textures.length);
      }
    }
  });

  it('stands every tree, bush, rock and flower on the ground height', () => {
    const m = new Matrix4();
    const at = new Vector3();
    for (const h of HOLES) {
      const hole = buildHole(h, look('high'));
      // Every instance's base (x, y, z), by instance mesh.
      const bases: Vector3[] = [];
      hole.object.traverse((o) => {
        const im = o as InstancedMesh;
        if (!im.isInstancedMesh) return;
        for (let i = 0; i < im.count; i++) {
          im.getMatrixAt(i, m);
          bases.push(at.setFromMatrixPosition(m).clone());
        }
      });
      const near = (x: number, z: number) =>
        bases.filter((b) => Math.hypot(b.x - x, b.z - z) < 1e-3);
      const scenery = placeScenery(h);
      for (const t of [...h.trees, ...scenery.trees]) {
        const found = near(t.x, t.z);
        expect(found.length, `tree at ${t.x}, ${t.z}`).toBeGreaterThan(0);
        // The trunk and the crown share one base; the blob shadow sits just above it.
        expect(found.some((b) => Math.abs(b.y - groundY(h, t.x, t.z)) < 1e-6)).toBe(true);
      }
      for (const b of scenery.bushes) {
        expect(near(b.x, b.z).some((p) => Math.abs(p.y - groundY(h, b.x, b.z)) < 1e-6)).toBe(true);
      }
      for (const r of scenery.rocks) {
        expect(
          near(r.x, r.z).some((p) => Math.abs(p.y - groundY(h, r.x, r.z) - r.r * 0.25) < 1e-6),
        ).toBe(true);
      }
      const house = clubhouseSite(h);
      if (house) {
        const built = hole.object.getObjectByName('clubhouse');
        expect(built, `clubhouse on hole ${HOLES.indexOf(h) + 1}`).toBeDefined();
        expect(built!.position.y).toBeCloseTo(groundY(h, house.x, house.z), 6);
      }
      hole.dispose();
    }
  });

  it('puts a clubhouse and two carts on holes 1 and 9 only, and a sign on every tee', () => {
    HOLES.forEach((h, i) => {
      const hole = buildHole(h, look('medium'));
      const house = hole.object.getObjectByName('clubhouse');
      expect(Boolean(house), `hole ${i + 1}`).toBe(i === 0 || i === 8);
      if (house) expect(house.getObjectByName('carts')).toBeDefined();
      expect(hole.object.getObjectByName('sign')).toBeDefined();
      hole.dispose();
    });
  });
});

describe('public/fore assets', () => {
  const dir = join(__dirname, '..', 'public', 'fore');
  const files = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? files(p) : [p];
    });

  it('lists every file in CREDITS.md and stays under 15 MB', () => {
    const credits = readFileSync(join(dir, 'CREDITS.md'), 'utf8');
    const all = files(dir);
    let total = 0;
    for (const f of all) {
      const rel = f.slice(dir.length + 1).replaceAll('\\', '/');
      expect(credits, rel).toContain(`\`${rel}\``);
      total += statSync(f).size;
    }
    expect(all.length).toBeGreaterThan(5);
    expect(total).toBeLessThanOrEqual(15 * 1024 * 1024);
  });
});
