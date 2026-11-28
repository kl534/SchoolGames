/**
 * The decor of the four house places: what hangs on the wall and stands against it, in tile
 * coordinates (x from 0 to 24, the wall at z = WALL_Z, the floor at y = 0).
 */
import { CylinderGeometry, Group, SphereGeometry } from 'three';
import type { Kit } from '../kit';
import type { PlaceId, PlaceLook } from '../places';

/** Where the back wall's face is. */
export const WALL_Z = -2.7;
const Z = WALL_Z + 0.2;

type Decor = (kit: Kit, tile: Group, look: PlaceLook) => void;

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A window: frame, glass, cross bars and a sill. */
function windowAt(
  kit: Kit,
  tile: Group,
  x: number,
  y: number,
  w: number,
  h: number,
  glass: number,
) {
  const frame = kit.wood(0xffffff);
  kit.box(w + 0.5, h + 0.5, 0.12, frame, tile, x, y, Z);
  kit.box(w, h, 0.14, kit.basic(glass), tile, x, y, Z + 0.02);
  kit.box(0.14, h, 0.16, frame, tile, x, y, Z + 0.05);
  kit.box(w, 0.14, 0.16, frame, tile, x, y, Z + 0.05);
  kit.box(w + 0.8, 0.14, 0.4, frame, tile, x, y - h / 2 - 0.3, Z + 0.15);
}

function curtains(
  kit: Kit,
  tile: Group,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
) {
  const mat = kit.fabric(color);
  for (const s of [-1, 1]) {
    const g = kit.box(w * 0.28, h + 0.8, 0.2, mat, tile, x + s * (w / 2 + 0.05), y - 0.1, Z + 0.22);
    g.rotation.z = s * 0.03;
  }
  kit.box(w + 1.6, 0.14, 0.14, kit.wood(0x8a6a3a), tile, x, y + h / 2 + 0.5, Z + 0.3);
}

function frameAt(kit: Kit, tile: Group, x: number, y: number, w: number, h: number, art: number) {
  kit.box(w + 0.3, h + 0.3, 0.1, kit.wood(0x6b4526), tile, x, y, Z);
  kit.box(w, h, 0.12, kit.basic(art), tile, x, y, Z + 0.02);
  kit.box(
    w * 0.5,
    h * 0.4,
    0.14,
    kit.basic(art ^ 0x303030),
    tile,
    x - w * 0.1,
    y - h * 0.15,
    Z + 0.04,
  );
}

function plant(kit: Kit, tile: Group, x: number, scale = 1) {
  kit.mesh(
    new CylinderGeometry(0.55 * scale, 0.4 * scale, 0.9 * scale, 12),
    kit.stone(0xc0623a),
    tile,
    x,
    0.45 * scale,
    -1.6,
  );
  const leaf = kit.foliage(0x3e9a4a);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const m = kit.mesh(
      new SphereGeometry(0.4 * scale, 10, 8),
      leaf,
      tile,
      x + Math.cos(a) * 0.5 * scale,
      (1.5 + hash(i) * 0.8) * scale,
      -1.6 + Math.sin(a) * 0.3,
    );
    m.scale.set(0.7, 1.7, 0.7);
    m.rotation.z = -Math.cos(a) * 0.4;
  }
}

function floorLamp(kit: Kit, tile: Group, x: number) {
  const metal = kit.metal(0x555555);
  kit.mesh(new CylinderGeometry(0.4, 0.4, 0.1, 12), metal, tile, x, 0.05, -1.7);
  kit.mesh(new CylinderGeometry(0.05, 0.05, 4.6, 8), metal, tile, x, 2.4, -1.7);
  kit.mesh(new CylinderGeometry(0.5, 0.9, 1.1, 14), kit.lit(0xfff0b8, 0.9), tile, x, 5.2, -1.7);
}

function rug(kit: Kit, tile: Group, x: number, w: number, color: number) {
  const r = kit.box(w, 0.04, 2.6, kit.fabric(color), tile, x, 0.025, 0.0);
  kit.box(w - 0.6, 0.05, 2.0, kit.fabric(color ^ 0x202020), tile, x, 0.03, 0);
  void r;
}

const livingRoom: Decor = (kit, tile) => {
  windowAt(kit, tile, 4, 5.8, 3, 3.4, 0x9ad4f5);
  curtains(kit, tile, 4, 5.8, 3, 3.4, 0xd64550);
  frameAt(kit, tile, 10.5, 6.2, 1.6, 1.2, 0xf2b134);
  frameAt(kit, tile, 13, 5.6, 1.1, 1.5, 0x4cae6b);
  frameAt(kit, tile, 15.4, 6.4, 1.8, 1.1, 0x3f8fd8);
  floorLamp(kit, tile, 8);
  plant(kit, tile, 18.5, 1.2);
  rug(kit, tile, 13, 6, 0x8b3a4a);
  // A clock.
  kit.mesh(
    new CylinderGeometry(0.6, 0.6, 0.12, 20),
    kit.lit(0xffffff, 0.4),
    tile,
    21,
    6.6,
    Z,
  ).rotation.x = Math.PI / 2;
  kit.box(0.06, 0.4, 0.06, kit.lit(0x222222), tile, 21, 6.75, Z + 0.1);
  kit.box(0.3, 0.06, 0.06, kit.lit(0x222222), tile, 21.12, 6.6, Z + 0.1);
};

const kitchen: Decor = (kit, tile) => {
  const white = kit.lit(0xf4f4f4, 0.4);
  // Fridge.
  kit.box(2.6, 6.2, 1.2, white, tile, 3, 3.1, -1.9);
  kit.box(2.6, 0.06, 1.22, kit.metal(0x999999), tile, 3, 4.3, -1.9);
  kit.box(0.12, 1.2, 0.12, kit.metal(0x999999), tile, 4.0, 5.2, -1.25);
  kit.box(0.12, 1.6, 0.12, kit.metal(0x999999), tile, 4.0, 2.7, -1.25);
  // Tiled splashback and wall cupboards.
  kit.box(22, 1.8, 0.1, kit.lit(0xffffff, 0.4), tile, 14, 3.1, Z);
  for (let i = 0; i < 22; i++)
    kit.box(0.04, 1.8, 0.12, kit.lit(0xcdd9d6), tile, 3.5 + i, 3.1, Z + 0.02);
  const cup = kit.wood(0xf2d9a0);
  for (const x of [8, 10.2, 12.4, 19, 21.2]) {
    kit.box(2.1, 2.0, 0.9, cup, tile, x, 6.2, Z + 0.45);
    kit.box(0.08, 0.7, 0.1, kit.metal(0x555555), tile, x + 0.8, 5.7, Z + 0.95);
  }
  windowAt(kit, tile, 16, 5.4, 2.4, 2.6, 0x9ad4f5);
  curtains(kit, tile, 16, 5.4, 2.4, 2.6, 0xf2b134);
  // A hob and a pot on it.
  kit.box(2.2, 0.9, 1.1, kit.metal(0x888888), tile, 6.2, 0.45, -1.9);
  kit.mesh(new CylinderGeometry(0.5, 0.45, 0.7, 14), kit.metal(0x9aa5ad), tile, 6.2, 1.25, -1.9);
};

const bathroom: Decor = (kit, tile, look) => {
  // Wall tiles: a grid up to the rail.
  const grid = kit.lit(look.wall ^ 0x181818, 0.6);
  for (let i = 0; i < 24; i++) kit.box(0.04, 4.8, 0.12, grid, tile, i + 0.5, 2.4, Z + 0.02);
  for (let j = 1; j < 4; j++) kit.box(24, 0.04, 0.12, grid, tile, 12, j * 1.2, Z + 0.02);
  // Mirror and a light above it.
  kit.box(2.4, 3, 0.1, kit.lit(0xeeeeee, 0.3), tile, 8, 6.3, Z + 0.04);
  kit.box(2.1, 2.7, 0.12, kit.basic(0xcfeaf7), tile, 8, 6.3, Z + 0.06);
  kit.box(2.8, 0.2, 0.3, kit.lit(0xdddddd, 0.3), tile, 8, 8.0, Z + 0.15);
  plant(kit, tile, 12.5, 0.9);
  // A toilet.
  const white = kit.lit(0xffffff, 0.3);
  kit.box(1.2, 1.7, 0.6, white, tile, 18, 1.7, -2.2);
  kit.mesh(new CylinderGeometry(0.6, 0.45, 0.9, 16), white, tile, 18, 0.45, -1.6);
  // A towel hook and rubber mat.
  rug(kit, tile, 22, 3, 0x6bbf7a);
};

const bedroom: Decor = (kit, tile) => {
  windowAt(kit, tile, 5, 6.2, 3, 3.4, 0x1c2a5c);
  curtains(kit, tile, 5, 6.2, 3, 3.4, 0xf29fc0);
  // A moon and stars in the window.
  kit.mesh(new SphereGeometry(0.5, 14, 10), kit.basic(0xfff3b0), tile, 5.5, 7, Z + 0.1);
  for (let i = 0; i < 6; i++)
    kit.mesh(
      new SphereGeometry(0.06, 6, 5),
      kit.basic(0xffffff),
      tile,
      3.8 + hash(i) * 2.4,
      5 + hash(i + 3) * 2.3,
      Z + 0.1,
    );
  // A poster and a bedside lamp.
  frameAt(kit, tile, 14, 6.2, 2.2, 3, 0xff6f91);
  kit.box(1.4, 1.3, 1.0, kit.wood(0x8a5a33), tile, 10, 0.65, -1.9);
  kit.mesh(new CylinderGeometry(0.3, 0.5, 0.6, 12), kit.lit(0xfff0b8, 0.9), tile, 10, 1.7, -1.9);
  // A toy box with a ball.
  const box = kit.wood(0x4d8fe0);
  kit.box(2.2, 1.3, 1.3, box, tile, 19.5, 0.65, -1.7);
  kit.mesh(new SphereGeometry(0.42, 12, 10), kit.lit(0xe0504a, 0.5), tile, 20.4, 1.7, -1.7);
  kit.mesh(new SphereGeometry(0.35, 12, 10), kit.lit(0xf2c14a, 0.5), tile, 19.2, 1.65, -1.7);
  rug(kit, tile, 13, 5, 0x6b4f9a);
};

export const HOUSE_SCENERY: Record<
  Extract<PlaceId, 'living-room' | 'kitchen' | 'bathroom' | 'bedroom'>,
  Decor
> = {
  'living-room': livingRoom,
  kitchen,
  bathroom,
  bedroom,
};
