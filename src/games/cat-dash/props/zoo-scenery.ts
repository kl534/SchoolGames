/**
 * The decor of the zoo (outdoors: a sandy path along the back, low wooden enclosure fences with
 * picture signs, trees, a balloon cart, rocks and a pond in the far enclosure, distant hills), in
 * tile coordinates (x from 0 to 24, the backdrop at z = WALL_Z, the floor at y = 0).
 */
import { ConeGeometry, CylinderGeometry, SphereGeometry, type Group } from 'three';
import type { Kit } from '../kit';
import type { PlaceId, PlaceLook } from '../places';
import { WALL_Z } from './house-scenery';

type Decor = (kit: Kit, tile: Group, look: PlaceLook) => void;

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A round tree: a trunk and a few leafy balls. */
function tree(kit: Kit, tile: Group, x: number, z: number, h: number, colour = 0x3e9a4a) {
  kit.mesh(new CylinderGeometry(0.22, 0.32, h, 8), kit.wood(0x7a5230), tile, x, h / 2, z);
  const leaf = kit.foliage(colour);
  kit.mesh(new SphereGeometry(1.5, 12, 10), leaf, tile, x, h + 0.5, z);
  kit.mesh(new SphereGeometry(1.1, 12, 10), leaf, tile, x - 0.9, h, z + 0.2);
  kit.mesh(new SphereGeometry(1.1, 12, 10), leaf, tile, x + 0.9, h - 0.1, z - 0.1);
}

/** A sign post with a round animal face on a board (no words). */
function signPost(
  kit: Kit,
  tile: Group,
  x: number,
  z: number,
  face: number,
  ears: 'round' | 'long',
) {
  const wood = kit.wood(0x7a5230);
  kit.mesh(new CylinderGeometry(0.07, 0.07, 2.4, 8), wood, tile, x, 1.2, z);
  kit.box(1.2, 1.0, 0.1, kit.wood(0xfaf4e6), tile, x, 2.5, z + 0.05);
  const skin = kit.lit(face, 0.7);
  kit.mesh(new SphereGeometry(0.34, 12, 10), skin, tile, x, 2.45, z + 0.14);
  for (const s of [-1, 1]) {
    if (ears === 'round') {
      kit.mesh(new SphereGeometry(0.14, 8, 6), skin, tile, x + s * 0.3, 2.78, z + 0.12);
    } else {
      kit.mesh(new SphereGeometry(0.1, 8, 6), skin, tile, x + s * 0.2, 2.95, z + 0.12).scale.y = 2;
    }
    kit.mesh(
      new SphereGeometry(0.05, 6, 5),
      kit.lit(0x16161c, 0.3),
      tile,
      x + s * 0.13,
      2.5,
      z + 0.3,
    );
  }
}

/** A balloon cart: a striped awning over a box, with a bunch of balloons. */
function balloonCart(kit: Kit, tile: Group, x: number, z: number) {
  kit.box(2.0, 0.9, 1.0, kit.lit(0xe0504a, 0.6), tile, x, 0.85, z);
  for (const dx of [-0.8, 0.8]) {
    kit.mesh(
      new CylinderGeometry(0.3, 0.3, 0.12, 12),
      kit.metal(0x33363c),
      tile,
      x + dx,
      0.3,
      z + 0.3,
    ).rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 6; i++) {
    kit.box(
      0.4,
      0.1,
      1.3,
      kit.fabric(i % 2 ? 0xffffff : 0xe0504a),
      tile,
      x - 0.8 + i * 0.32,
      2.5,
      z,
    );
  }
  for (const dx of [-0.95, 0.95]) {
    kit.box(0.08, 1.7, 0.08, kit.lit(0xfaf4e6, 0.6), tile, x + dx, 1.7, z + 0.45);
  }
  const colours = [0xe0504a, 0xf2c230, 0x3f8fd8, 0x5cb85c, 0xff7ab8, 0x9b59b6];
  colours.forEach((c, i) => {
    const bx = x + 0.4 + (i % 3) * 0.35;
    const by = 3.5 + (i % 2) * 0.45 + Math.floor(i / 3) * 0.3;
    kit.mesh(new SphereGeometry(0.3, 10, 8), kit.lit(c, 0.3), tile, bx, by, z + 0.1).scale.y = 1.2;
    kit.box(0.015, by - 2.6, 0.015, kit.basic(0xffffff, 0.7), tile, bx, (by + 2.6) / 2, z + 0.1);
  });
}

const zoo: Decor = (kit, tile) => {
  // Rolling hills far away, and a sandy path along the back.
  const hill = kit.foliage(0x86d06a);
  for (const [x, r] of [
    [3, 4.2],
    [11, 3.4],
    [19, 4.6],
    [25, 3.4],
  ] as const) {
    kit
      .mesh(new SphereGeometry(r, 16, 10), hill, tile, x, -r * 0.5, WALL_Z + 1)
      .scale.set(1.7, 0.8, 0.3);
  }
  kit.box(24, 0.03, 1.6, kit.lit(0xecdca8, 0.95), tile, 12, 0.015, -2.1);
  // Low wooden enclosure fences with picture signs.
  const wood = kit.wood(0xc99a5e);
  for (let i = 0; i < 25; i++) kit.box(0.16, 1.1, 0.16, wood, tile, i, 0.55, -3.2);
  kit.box(24, 0.12, 0.1, wood, tile, 12, 0.95, -3.2);
  kit.box(24, 0.12, 0.1, wood, tile, 12, 0.55, -3.2);
  signPost(kit, tile, 4, -2.7, 0x9aa6b2, 'round');
  signPost(kit, tile, 12.5, -2.7, 0xf2c14a, 'long');
  signPost(kit, tile, 20.5, -2.7, 0x2b3550, 'round');
  // Trees along the back.
  for (const [x, h, c] of [
    [1.5, 3.4, 0x3e9a4a],
    [8, 2.6, 0x56ae3a],
    [16.2, 3.0, 0x3e9a4a],
    [23, 3.6, 0x56ae3a],
  ] as const) {
    tree(kit, tile, x, -5.2, h, c);
  }
  // The far enclosure: a pond with rocks.
  const water = kit.lit(0x4fb0e0, 0.25);
  kit.mesh(new CylinderGeometry(2.2, 2.2, 0.04, 24), water, tile, 13.4, 0.03, -4.8).scale.z = 0.5;
  const rock = kit.stone(0x8a8a90);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    kit
      .mesh(
        new SphereGeometry(0.3 + hash(i) * 0.2, 8, 6),
        rock,
        tile,
        13.4 + Math.cos(a) * 2.4,
        0.2,
        -4.8 + Math.sin(a) * 1.3,
      )
      .scale.set(1, 0.7, 1);
  }
  kit.mesh(new SphereGeometry(0.9, 10, 8), rock, tile, 5.6, 0.3, -4.4).scale.set(1.5, 0.7, 1);
  kit.mesh(new SphereGeometry(0.7, 10, 8), rock, tile, 6.8, 0.2, -4.2).scale.set(1.4, 0.6, 1);
  // The balloon cart by the path, and a few flowers.
  balloonCart(kit, tile, 15.5, -2.2);
  const colours = [0xff6f91, 0xf2d34a, 0xffffff];
  for (let i = 0; i < 10; i++) {
    const x = 0.8 + i * 2.4 + hash(i + 3);
    kit.mesh(
      new ConeGeometry(0.12, 0.25, 6),
      kit.lit(colours[i % 3], 0.6),
      tile,
      x,
      0.15,
      -3.9 + hash(i) * 0.5,
    );
  }
};

export const ZOO_SCENERY: Record<Extract<PlaceId, 'zoo'>, Decor> = { zoo };
