/**
 * The decor of the four busy places (grocery, library, fish market, construction site), in tile
 * coordinates (x from 0 to 24, the backdrop at z = WALL_Z, the floor at y = 0). The first three
 * are indoors against a wall; the construction site is outdoors.
 */
import { CylinderGeometry, SphereGeometry, type Group } from 'three';
import type { Kit } from '../kit';
import type { PlaceId, PlaceLook } from '../places';
import { WALL_Z } from './house-scenery';

const Z = WALL_Z + 0.2;

type Decor = (kit: Kit, tile: Group, look: PlaceLook) => void;

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const PRODUCT = [0xe0504a, 0xf2c230, 0x3f8fd8, 0x5cb85c, 0xff9f43, 0x9b59b6, 0xffffff];
const BOOKS = [0xd9534f, 0x3f8fd8, 0xf2c14a, 0x5cb85c, 0x9b59b6, 0xff9f43, 0x8a5a3c];

/** A shelving unit full of small boxes (`colors`), `rows` shelves tall. */
function shelves(
  kit: Kit,
  tile: Group,
  x: number,
  w: number,
  rows: number,
  rowH: number,
  colors: readonly number[],
  frame: number,
  seed: number,
  books = false,
) {
  const wood = kit.lit(frame, 0.7);
  const h = rows * rowH + 0.3;
  kit.box(w, h, 0.5, kit.lit(frame ^ 0x181818, 0.9), tile, x, h / 2, Z + 0.1);
  for (let r = 0; r <= rows; r++) kit.box(w, 0.12, 0.7, wood, tile, x, 0.15 + r * rowH, Z + 0.3);
  for (const s of [-1, 1])
    kit.box(0.14, h, 0.7, wood, tile, x + (s * (w - 0.14)) / 2, h / 2, Z + 0.3);
  for (let r = 0; r < rows; r++) {
    let px = x - w / 2 + 0.25;
    let i = 0;
    while (px < x + w / 2 - 0.3) {
      const bw = books
        ? 0.16 + hash(seed + r * 31 + i) * 0.14
        : 0.3 + hash(seed + r * 31 + i) * 0.2;
      const bh = books ? rowH * (0.62 + hash(seed + r + i * 3) * 0.3) : rowH * 0.55;
      kit.box(
        bw,
        bh,
        books ? 0.4 : 0.34,
        kit.lit(colors[(seed + r * 3 + i) % colors.length], 0.7),
        tile,
        px + bw / 2,
        0.21 + r * rowH + bh / 2,
        Z + 0.32,
      );
      px += bw + 0.04;
      i++;
    }
  }
}

function hangingSign(kit: Kit, tile: Group, x: number, y: number, w: number, color: number) {
  for (const s of [-1, 1])
    kit.box(0.04, 1.4, 0.04, kit.lit(0x444444, 0.5), tile, x + s * w * 0.35, y + 0.9, Z + 0.4);
  kit.box(w, 0.7, 0.1, kit.lit(color, 0.6), tile, x, y, Z + 0.4);
  kit.box(w * 0.7, 0.3, 0.02, kit.basic(0xffffff), tile, x, y, Z + 0.46);
}

const grocery: Decor = (kit, tile) => {
  // Three aisles of shelves full of boxes and tins, with signs hanging over them.
  shelves(kit, tile, 3.2, 4.4, 4, 1.15, PRODUCT, 0xc9c1b0, 1);
  shelves(kit, tile, 12.2, 4.4, 4, 1.15, PRODUCT, 0xc9c1b0, 7);
  shelves(kit, tile, 20.6, 4.0, 4, 1.15, PRODUCT, 0xc9c1b0, 13);
  hangingSign(kit, tile, 3.2, 7.2, 2.2, 0xe0504a);
  hangingSign(kit, tile, 12.2, 7.2, 2.2, 0x3f8fd8);
  hangingSign(kit, tile, 20.6, 7.2, 2.2, 0x5cb85c);
  // A freezer with glass doors between the aisles.
  kit.box(2.6, 2.8, 0.9, kit.lit(0xeaf4ff, 0.4), tile, 7.7, 1.4, Z + 0.55);
  kit.box(2.2, 2.2, 0.06, kit.glass(0x9ad0ff, 0.5), tile, 7.7, 1.5, Z + 1.03);
  for (let i = 0; i < 6; i++)
    kit.box(
      0.5,
      0.5,
      0.05,
      kit.lit(PRODUCT[i], 0.6),
      tile,
      6.95 + (i % 3) * 0.75,
      0.9 + Math.floor(i / 3) * 1.1,
      Z + 0.99,
    );
  // A fruit stand: a crate of apples and oranges.
  kit.box(2.4, 0.8, 1.0, kit.lit(0xc9a15a, 0.85), tile, 16.2, 0.4, Z + 0.7);
  for (let i = 0; i < 10; i++) {
    kit.mesh(
      new SphereGeometry(0.22, 10, 8),
      kit.lit(i % 2 ? 0xe03a3a : 0xff9f43, 0.5),
      tile,
      15.3 + (i % 5) * 0.45,
      0.95 + Math.floor(i / 5) * 0.2,
      Z + 0.6 + (i % 2) * 0.25,
    );
  }
  // A banner.
  kit.box(5, 0.9, 0.06, kit.lit(0xf2c230, 0.6), tile, 16.2, 5.2, Z + 0.1);
  kit.box(3.4, 0.35, 0.02, kit.lit(0xe0504a, 0.6), tile, 16.2, 5.2, Z + 0.15);
};

const library: Decor = (kit, tile) => {
  shelves(kit, tile, 3.2, 4.6, 6, 1.1, BOOKS, 0x7a4a2a, 3, true);
  shelves(kit, tile, 20.4, 4.6, 6, 1.1, BOOKS, 0x7a4a2a, 17, true);
  shelves(kit, tile, 12.4, 3.2, 5, 1.1, BOOKS, 0x7a4a2a, 29, true);
  // The rail the library ladder rolls on.
  kit.box(24, 0.14, 0.14, kit.lit(0x3a2a1a, 0.6), tile, 12, 7.3, Z + 0.7);
  // A round clock and a globe on a stand.
  kit.mesh(
    new CylinderGeometry(0.7, 0.7, 0.12, 20),
    kit.lit(0xffffff, 0.5),
    tile,
    7.9,
    6.2,
    Z + 0.1,
  ).rotation.x = Math.PI / 2;
  kit.box(0.05, 0.45, 0.04, kit.lit(0x222222), tile, 7.9, 6.4, Z + 0.2);
  kit.box(0.3, 0.05, 0.04, kit.lit(0x222222), tile, 8.05, 6.2, Z + 0.2);
  kit.mesh(
    new CylinderGeometry(0.05, 0.05, 1.2, 8),
    kit.lit(0x5a3a24, 0.6),
    tile,
    16.1,
    0.6,
    Z + 0.9,
  );
  kit.mesh(new SphereGeometry(0.6, 16, 12), kit.lit(0x3f8fd8, 0.5), tile, 16.1, 1.8, Z + 0.9);
  kit.mesh(new SphereGeometry(0.2, 8, 6), kit.lit(0x5cb85c, 0.6), tile, 16.3, 1.9, Z + 1.45);
  // A reading table with a lamp and a stack of books.
  kit.box(2.6, 0.14, 1.1, kit.lit(0x8a5a3c, 0.6), tile, 8.0, 1.1, Z + 0.9);
  for (const x of [7.0, 9.0])
    kit.box(0.14, 1.1, 0.9, kit.lit(0x6a3a24, 0.7), tile, x, 0.55, Z + 0.9);
  kit.box(0.3, 0.06, 0.3, kit.lit(0x2f6a4a, 0.5), tile, 8.5, 1.2, Z + 0.9);
  kit.box(0.04, 0.7, 0.04, kit.lit(0x2f6a4a, 0.5), tile, 8.5, 1.5, Z + 0.9);
  kit.mesh(new CylinderGeometry(0.1, 0.32, 0.3, 12), kit.basic(0xfff1a8), tile, 8.5, 1.95, Z + 0.9);
  for (let i = 0; i < 3; i++)
    kit.box(0.7, 0.12, 0.5, kit.lit(BOOKS[i], 0.7), tile, 7.6, 1.24 + i * 0.12, Z + 0.9);
  // Warm lamps along the top of the shelves.
  for (const x of [3.2, 12.4, 20.4])
    kit.mesh(new SphereGeometry(0.22, 10, 8), kit.basic(0xfff1a8), tile, x, 7.9, Z + 0.4);
};

const fishMarket: Decor = (kit, tile) => {
  // A striped market canopy across the back.
  for (let i = 0; i < 12; i++)
    kit.box(
      2,
      0.9,
      0.1,
      kit.lit(i % 2 ? 0xffffff : 0x3f8fd8, 0.7),
      tile,
      1 + i * 2,
      6.9,
      Z + 0.7,
    ).rotation.x = -0.25;
  // Fish counters: a table, a bed of ice and rows of fish.
  for (const x of [3.6, 11.8, 20.2]) {
    kit.box(4.0, 1.2, 1.2, kit.lit(0xe8eef2, 0.4), tile, x, 0.6, Z + 0.9);
    kit.box(3.6, 0.2, 0.9, kit.lit(0xcfeaff, 0.25), tile, x, 1.3, Z + 0.9);
    for (let i = 0; i < 5; i++) {
      const fish = kit.mesh(
        new SphereGeometry(0.28, 10, 8),
        kit.lit(i % 2 ? 0xb9c6d4 : 0xf2a65a, 0.35),
        tile,
        x - 1.4 + i * 0.7,
        1.55,
        Z + 0.9,
      );
      fish.scale.set(1.6, 0.6, 0.6);
    }
    kit.box(0.04, 0.9, 0.04, kit.lit(0x444444, 0.5), tile, x, 4.8, Z + 0.4);
  }
  // Fish hanging from a rail.
  kit.box(24, 0.1, 0.1, kit.lit(0x666666, 0.4), tile, 12, 5.4, Z + 0.5);
  for (let i = 0; i < 8; i++) {
    const x = 1.2 + i * 3 + hash(i) * 0.8;
    kit.box(0.02, 0.5, 0.02, kit.lit(0x666666, 0.4), tile, x, 5.1, Z + 0.5);
    const fish = kit.mesh(
      new SphereGeometry(0.3, 10, 8),
      kit.lit(i % 2 ? 0x6fa8dc : 0xb9c6d4, 0.35),
      tile,
      x,
      4.5,
      Z + 0.5,
    );
    fish.scale.set(0.5, 1.5, 0.5);
  }
  // A lobster tank and a sign.
  kit.box(2.4, 1.6, 1.0, kit.glass(0x7fd0ff, 0.45), tile, 16, 1.4, Z + 0.7);
  kit.box(2.5, 0.2, 1.1, kit.lit(0x4a6a8a, 0.5), tile, 16, 0.5, Z + 0.7);
  kit.mesh(new SphereGeometry(0.22, 10, 8), kit.lit(0xe0502a, 0.5), tile, 15.7, 0.8, Z + 0.7);
  kit.mesh(new SphereGeometry(0.22, 10, 8), kit.lit(0xe0502a, 0.5), tile, 16.4, 0.8, Z + 0.7);
  kit.box(4, 0.8, 0.1, kit.lit(0x3f8fd8, 0.6), tile, 16, 4.0, Z + 0.15);
  kit.box(2.6, 0.3, 0.02, kit.basic(0xffffff), tile, 16, 4.0, Z + 0.21);
  // Buckets by the wall.
  for (const x of [7.4, 8.1, 23]) {
    kit.mesh(
      new CylinderGeometry(0.4, 0.3, 0.7, 12),
      kit.lit(0x3f8fd8, 0.6),
      tile,
      x,
      0.35,
      Z + 0.8,
    );
  }
};

const construction: Decor = (kit, tile, look) => {
  // An orange hoarding fence along the back.
  const board = kit.lit(look.wall, 0.8);
  for (let i = 0; i < 24; i++) kit.box(0.98, 3.2, 0.1, board, tile, i + 0.5, 1.6, Z - 0.3);
  kit.box(24, 0.2, 0.2, kit.lit(0x3a3a40, 0.6), tile, 12, 3.2, Z - 0.2);
  kit.box(24, 0.2, 0.2, kit.lit(0x3a3a40, 0.6), tile, 12, 0.6, Z - 0.2);
  // A half-built steel building frame and a crane tower.
  const steel = kit.lit(0x6f7a8a, 0.5);
  const yellow = kit.lit(0xf2c230, 0.5);
  for (const x of [7.5, 11.5, 15.5]) kit.box(0.3, 9, 0.3, steel, tile, x, 4.5, -2.0);
  for (const y of [3.2, 6.0, 8.8]) kit.box(8.3, 0.3, 0.3, steel, tile, 11.5, y, -2.0);
  for (const [x0, x1, y0, y1] of [
    [7.5, 11.5, 3.2, 6.0],
    [11.5, 15.5, 6.0, 8.8],
  ] as const) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    kit.box(len, 0.15, 0.15, steel, tile, (x0 + x1) / 2, (y0 + y1) / 2, -2.0).rotation.z =
      Math.atan2(y1 - y0, x1 - x0);
  }
  kit.box(0.6, 15, 0.6, yellow, tile, 21, 7.5, -2.3);
  kit.box(7, 0.5, 0.5, yellow, tile, 19, 15.2, -2.3);
  kit.box(1.4, 1.0, 1.0, kit.lit(0x333a48, 0.5), tile, 22.2, 14.7, -2.3);
  // Traffic cones, pipes, bricks and a wheelbarrow.
  for (const x of [3.2, 5.6, 19.6]) {
    kit.mesh(
      new CylinderGeometry(0.05, 0.38, 0.9, 12),
      kit.lit(0xff7a1a, 0.6),
      tile,
      x,
      0.45,
      -1.2,
    );
    kit.mesh(new CylinderGeometry(0.2, 0.28, 0.12, 12), kit.lit(0xffffff, 0.6), tile, x, 0.5, -1.2);
  }
  for (let i = 0; i < 4; i++) {
    kit.mesh(
      new CylinderGeometry(0.32, 0.32, 2.2, 12),
      kit.lit(0x8a9098, 0.5),
      tile,
      1.8,
      0.35 + i * 0.1,
      -1.6 + i * 0.3,
    ).rotation.z = Math.PI / 2;
  }
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 4 - r; i++)
      kit.box(
        0.5,
        0.25,
        0.3,
        kit.lit(0xb5543a, 0.9),
        tile,
        17.2 + i * 0.52 + r * 0.26,
        0.13 + r * 0.26,
        -1.4,
      );
  kit.box(1.2, 0.5, 0.8, kit.lit(0xe0504a, 0.6), tile, 13.6, 0.7, -1.3);
  kit.mesh(
    new CylinderGeometry(0.2, 0.2, 0.1, 10),
    kit.lit(0x222222, 0.6),
    tile,
    14.3,
    0.2,
    -1.3,
  ).rotation.x = Math.PI / 2;
  // A warning sign.
  kit.box(0.1, 2.2, 0.1, kit.lit(0x555555), tile, 9.0, 1.1, -1.4);
  kit.box(1.1, 1.1, 0.08, yellow, tile, 9.0, 2.5, -1.4).rotation.z = Math.PI / 4;
};

export const BUSY_SCENERY: Record<
  Extract<PlaceId, 'grocery' | 'library' | 'fish-market' | 'construction'>,
  Decor
> = { grocery, library, 'fish-market': fishMarket, construction };
