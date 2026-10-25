import { InstancedMesh, Mesh, type BufferGeometry, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { centreX, GREEN_R, HOLES, inEllipse, type Hole } from '../src/games/fore/course';
import { groundTextures } from '../src/games/fore/ground';
import { buildHole } from '../src/games/fore/hole';
import { placeScenery, LINE_CLEAR, LOW_MIN_OFF } from '../src/games/fore/scenery';
import { finishShot, planShot, resolveShot, TREE_HEIGHT } from '../src/games/fore/shot';
import { treeBounds, treeScale } from '../src/games/fore/trees';

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

  it('leave finishShot results unchanged for fixed plans', () => {
    const results = HOLES.map((h) =>
      [-4, 0, 3].map((aim) => {
        const plan = planShot(h, { x: 0, z: 0 }, 'tee', aim);
        const outcome = resolveShot(plan, true, 0.5, 6, 1);
        return JSON.stringify(finishShot(h, plan, outcome));
      }),
    );
    // Holes without trees can't be stopped by one; the tree holes at these aims are recorded below.
    expect(results).toMatchInlineSnapshot(`
      [
        [
          "{"kind":"rest","at":{"x":-16.741553698590074,"z":239.41537206235782},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":0,"z":240},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":12.56062949830652,"z":239.67108834109771},"surface":"fairway"}",
        ],
        [
          "{"kind":"rest","at":{"x":-6.46834158673629,"z":129.68332653377715},"surface":"sand"}",
          "{"kind":"rest","at":{"x":2.6,"z":130},"surface":"green"}",
          "{"kind":"rest","at":{"x":9.403674311582698,"z":129.8218395180946},"surface":"green"}",
        ],
        [
          "{"kind":"rest","at":{"x":-21.541553698590075,"z":239.41537206235782},"surface":"rough"}",
          "{"kind":"rest","at":{"x":-4.8,"z":240},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":7.76062949830652,"z":239.67108834109771},"surface":"fairway"}",
        ],
        [
          "{"kind":"rest","at":{"x":-9.541553698590075,"z":239.41537206235782},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":7.2,"z":240},"surface":"rough"}",
          "{"kind":"rest","at":{"x":19.76062949830652,"z":239.67108834109771},"surface":"rough"}",
        ],
        [
          "{"kind":"rest","at":{"x":-7.141553698590075,"z":239.41537206235782},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":9.6,"z":240},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":22.16062949830652,"z":239.67108834109771},"surface":"rough"}",
        ],
        [
          "{"kind":"rest","at":{"x":-15.961035799060049,"z":159.61024804157188},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":-4.8,"z":160},"surface":"green"}",
          "{"kind":"rest","at":{"x":3.573752998871014,"z":159.7807255607318},"surface":"green"}",
        ],
        [
          "{"kind":"rest","at":{"x":-16.741553698590074,"z":239.41537206235782},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":0,"z":240},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":12.56062949830652,"z":239.67108834109771},"surface":"rough"}",
        ],
        [
          "{"kind":"rest","at":{"x":-23.941553698590074,"z":239.41537206235782},"surface":"rough"}",
          "{"kind":"rest","at":{"x":-7.2,"z":240},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":5.36062949830652,"z":239.67108834109771},"surface":"fairway"}",
        ],
        [
          "{"kind":"rest","at":{"x":-11.941553698590074,"z":239.41537206235782},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":4.8,"z":240},"surface":"fairway"}",
          "{"kind":"rest","at":{"x":17.36062949830652,"z":239.67108834109771},"surface":"fairway"}",
        ],
      ]
    `);
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

  it('disposes everything it built, textures included', () => {
    const textures = Object.values(groundTextures());
    for (const h of HOLES) {
      let disposed = 0;
      textures.forEach((t) => t.addEventListener('dispose', () => disposed++));
      const hole = buildHole(h);
      expect(hole.object.children.length).toBeGreaterThan(0);
      hole.dispose();
      expect(hole.object.children.length).toBe(0);
      expect(hole.object.parent).toBeNull();
      expect(disposed).toBeGreaterThanOrEqual(textures.length);
    }
  });
});
