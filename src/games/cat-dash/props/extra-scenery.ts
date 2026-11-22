/**
 * The decor of the farm and the jungle, in tile coordinates (x from 0 to 24, the backdrop at
 * z = WALL_Z, the floor at y = 0). Both are outdoors under a sky.
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

/** A red barn with a white X on the door. */
function barn(kit: Kit, tile: Group, x: number) {
  const red = kit.lit(0xb83a2a, 0.8);
  const white = kit.lit(0xfaf4e6, 0.7);
  kit.box(5.2, 3.8, 1.6, red, tile, x, 1.9, -2.6);
  kit.mesh(
    new CylinderGeometry(0.01, 3.1, 1.8, 4, 1),
    kit.lit(0x6a3a2a, 0.8),
    tile,
    x,
    4.7,
    -2.6,
  ).rotation.y = Math.PI / 4;
  kit.box(1.8, 2.4, 0.1, white, tile, x, 1.2, -1.78);
  kit.box(1.6, 2.2, 0.12, red, tile, x, 1.2, -1.76);
  for (const s of [-1, 1]) kit.box(0.12, 2.8, 0.14, white, tile, x, 1.2, -1.7).rotation.z = s * 0.8;
}

const farm: Decor = (kit, tile) => {
  barn(kit, tile, 5);
  // A silo.
  kit.mesh(new CylinderGeometry(1.0, 1.0, 6, 14), kit.lit(0xc9ccd2, 0.5), tile, 10.2, 3, -3.2);
  kit.mesh(new SphereGeometry(1.0, 14, 8), kit.lit(0x9a9ea6, 0.5), tile, 10.2, 6, -3.2).scale.y =
    0.7;
  // Rolling green hills.
  const hill = kit.lit(0x7ec85a, 0.95);
  for (const [x, r] of [
    [15, 4],
    [21, 3.4],
    [1, 3.4],
  ] as const)
    kit
      .mesh(new SphereGeometry(r, 16, 10), hill, tile, x, -r * 0.55, WALL_Z + 1)
      .scale.set(1.6, 0.8, 0.3);
  // A wooden fence and a few trees.
  const wood = kit.lit(0xcfae7a, 0.9);
  for (let i = 0; i < 12; i++) kit.box(0.14, 1.0, 0.14, wood, tile, 13 + i * 1, 0.5, -1.5);
  kit.box(12, 0.12, 0.1, wood, tile, 18.5, 0.8, -1.5);
  kit.box(12, 0.12, 0.1, wood, tile, 18.5, 0.45, -1.5);
  for (const x of [13.2, 22.4]) {
    kit.mesh(new CylinderGeometry(0.2, 0.26, 1.8, 8), kit.lit(0x7a5230, 0.9), tile, x, 0.9, -2.0);
    kit.mesh(new SphereGeometry(1.2, 12, 10), kit.lit(0x3e9a4a, 0.8), tile, x, 2.6, -2.0);
  }
  // Sunflowers.
  for (let i = 0; i < 5; i++) {
    const x = 1.5 + i * 0.5 + hash(i) * 0.2;
    kit.box(0.06, 1.3, 0.06, kit.lit(0x3e9a4a, 0.8), tile, x, 0.65, -1.2);
    kit.mesh(new SphereGeometry(0.22, 10, 8), kit.lit(0xf2c230, 0.6), tile, x, 1.4, -1.15).scale.z =
      0.4;
  }
};

const jungle: Decor = (kit, tile) => {
  const trunk = kit.lit(0x6a4a2a, 0.9);
  const leaf = kit.lit(0x2f9a4a, 0.8);
  const dark = kit.lit(0x1f7a3a, 0.8);
  // Big trees with a crown and hanging vines.
  for (const [x, h] of [
    [2, 9],
    [9.5, 11],
    [15.5, 9],
    [22, 10],
  ] as const) {
    kit.mesh(new CylinderGeometry(0.5, 0.75, h, 10), trunk, tile, x, h / 2, -3.0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      kit.mesh(
        new SphereGeometry(1.6, 10, 8),
        i % 2 ? leaf : dark,
        tile,
        x + Math.cos(a) * 1.6,
        h + Math.sin(a) * 0.6,
        -3.0,
      ).scale.y = 0.6;
    }
    kit.box(0.08, 4.5, 0.08, kit.lit(0x4a8a2a, 0.85), tile, x + 1.1, h - 2.2, -2.4);
  }
  // Ferns and flowers on the ground.
  for (let i = 0; i < 12; i++) {
    const x = 0.8 + i * 2 + hash(i) * 0.8;
    kit.mesh(new ConeGeometry(0.3, 1.2, 5), i % 2 ? leaf : dark, tile, x, 0.6, -1.4).rotation.z =
      (hash(i + 4) - 0.5) * 0.6;
    if (i % 3 === 0)
      kit.mesh(
        new SphereGeometry(0.16, 8, 6),
        kit.lit(i % 2 ? 0xff6f91 : 0xf2c230, 0.6),
        tile,
        x + 0.3,
        0.5,
        -1.2,
      );
  }
};

export const EXTRA_SCENERY: Record<Extract<PlaceId, 'farm' | 'jungle'>, Decor> = { farm, jungle };
