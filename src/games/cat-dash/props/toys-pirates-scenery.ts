/**
 * The decor of the toy store (indoors, against a wall) and the pirate ship (outdoors: a sea, an
 * island, the ship's rail and a mast), in tile coordinates (x from 0 to 24, the backdrop at
 * z = WALL_Z, the floor at y = 0).
 */
import {
  ConeGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  SphereGeometry,
  TorusGeometry,
  type Group,
  type Material,
} from 'three';
import type { Kit } from '../kit';
import type { PlaceId, PlaceLook } from '../places';
import { WALL_Z } from './house-scenery';

type Decor = (kit: Kit, tile: Group, look: PlaceLook) => void;

const Z = WALL_Z + 0.2;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const BRIGHT = [0xe0504a, 0xf2c230, 0x3f8fd8, 0x5cb85c, 0xff9f43, 0x9b59b6, 0xff7ab8];

/** A teddy bear sitting at (x, y) on a shelf (y is the shelf top). */
function teddy(kit: Kit, tile: Group, x: number, y: number, colour: number, z: number) {
  const fur = kit.lit(colour, 0.9);
  kit.mesh(new SphereGeometry(0.42, 12, 10), fur, tile, x, y + 0.42, z);
  kit.mesh(new SphereGeometry(0.3, 12, 10), fur, tile, x, y + 1.0, z);
  for (const s of [-1, 1]) {
    kit.mesh(new SphereGeometry(0.11, 8, 6), fur, tile, x + s * 0.22, y + 1.26, z);
    kit.mesh(new SphereGeometry(0.12, 8, 6), fur, tile, x + s * 0.4, y + 0.55, z + 0.15);
    kit.mesh(
      new SphereGeometry(0.04, 6, 5),
      kit.lit(0x222222, 0.5),
      tile,
      x + s * 0.1,
      y + 1.05,
      z + 0.27,
    );
  }
  kit.mesh(new SphereGeometry(0.1, 8, 6), kit.lit(0xf4dcc0, 0.8), tile, x, y + 0.93, z + 0.26);
}

/** A toy car: a body, a cabin and four wheels. */
function toyCar(kit: Kit, tile: Group, x: number, y: number, colour: number, z: number) {
  kit.box(0.9, 0.28, 0.42, kit.lit(colour, 0.4), tile, x, y + 0.26, z);
  kit.box(0.46, 0.22, 0.38, kit.lit(0xdff4ff, 0.3), tile, x - 0.05, y + 0.5, z);
  for (const dx of [-0.28, 0.28])
    kit.mesh(
      new CylinderGeometry(0.11, 0.11, 0.46, 10),
      kit.lit(0x222222, 0.6),
      tile,
      x + dx,
      y + 0.12,
      z,
    ).rotation.x = Math.PI / 2;
}

/** A spinning top: a cone point under a disc and a stem. */
function top(kit: Kit, tile: Group, x: number, y: number, colour: number, z: number) {
  const mat = kit.lit(colour, 0.4);
  kit.mesh(new ConeGeometry(0.3, 0.5, 12), mat, tile, x, y + 0.25, z).rotation.x = Math.PI;
  kit.mesh(new CylinderGeometry(0.34, 0.34, 0.1, 14), kit.lit(0xf2c230, 0.4), tile, x, y + 0.55, z);
  kit.mesh(new CylinderGeometry(0.05, 0.05, 0.3, 8), mat, tile, x, y + 0.75, z);
}

/** A toy rocket standing on its fins. */
function rocket(kit: Kit, tile: Group, x: number, y: number, z: number) {
  kit.mesh(new CylinderGeometry(0.22, 0.22, 1.1, 14), kit.lit(0xf4f4f4, 0.4), tile, x, y + 0.75, z);
  kit.mesh(new ConeGeometry(0.22, 0.4, 14), kit.lit(0xe0504a, 0.4), tile, x, y + 1.5, z);
  for (const s of [-1, 1])
    kit.box(0.1, 0.4, 0.3, kit.lit(0xe0504a, 0.4), tile, x + s * 0.25, y + 0.4, z);
  kit.mesh(new SphereGeometry(0.09, 8, 6), kit.lit(0x3f8fd8, 0.3), tile, x, y + 0.95, z + 0.2);
}

/** A shelving unit `w` wide with two shelves of toys. */
function shelf(kit: Kit, tile: Group, x: number, w: number, seed: number) {
  const wood = kit.lit(0xc98a52, 0.7);
  kit.box(w, 5.4, 0.5, kit.lit(0xa86a3a, 0.9), tile, x, 2.7, Z + 0.1);
  for (const y of [0.2, 2.4, 4.6]) kit.box(w, 0.14, 0.8, wood, tile, x, y, Z + 0.35);
  for (const s of [-1, 1])
    kit.box(0.14, 5.4, 0.8, wood, tile, x + (s * (w - 0.14)) / 2, 2.7, Z + 0.35);
  const slots = Math.floor((w - 0.6) / 1.1);
  for (const [row, y] of [
    [0, 2.47],
    [1, 4.67],
  ] as const) {
    for (let i = 0; i < slots; i++) {
      const px = x - ((slots - 1) * 1.1) / 2 + i * 1.1;
      const pick = Math.floor(hash(seed + row * 9 + i) * 4);
      const colour = BRIGHT[Math.floor(hash(seed + i * 3 + row) * BRIGHT.length)];
      if (pick === 0) teddy(kit, tile, px, y, [0xc98a52, 0xf2c0a0, 0xe08a6a][i % 3], Z + 0.4);
      else if (pick === 1) toyCar(kit, tile, px, y, colour, Z + 0.4);
      else if (pick === 2) top(kit, tile, px, y, colour, Z + 0.4);
      else rocket(kit, tile, px, y, Z + 0.4);
    }
  }
}

const toyStore: Decor = (kit, tile) => {
  shelf(kit, tile, 3.6, 5.0, 1);
  shelf(kit, tile, 13.8, 5.4, 40);
  shelf(kit, tile, 21.2, 4.0, 77);
  // A big wall sign made of coloured letter blocks.
  kit.box(5.8, 2.4, 0.2, kit.lit(0xffffff, 0.6), tile, 8.6, 8.2, Z + 0.1);
  ['T', 'O', 'Y', 'S'].forEach((letter, i) => {
    const colour = BRIGHT[(i * 2) % BRIGHT.length];
    const x = 7.0 + i * 1.2;
    kit.box(1.0, 1.0, 0.3, kit.lit(colour, 0.5), tile, x, 8.2, Z + 0.3);
    const tex = kit.paint(64, 64, (g) => {
      g.fillStyle = '#ffffff';
      g.font = 'bold 54px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(letter, 32, 36);
    });
    if (tex) {
      const m = new MeshBasicMaterial({ map: tex, transparent: true });
      kit.materials.push(m);
      kit.box(0.8, 0.8, 0.02, m, tile, x, 8.2, Z + 0.47);
    }
  });
  // Hanging balloons on strings.
  const string = kit.lit(0xffffff, 0.8);
  for (let i = 0; i < 9; i++) {
    const x = 1 + i * 2.7 + hash(i) * 0.9;
    const y = 9.2 + hash(i + 5) * 3.4;
    kit.box(0.02, 4, 0.02, string, tile, x, y - 2.4, Z + 0.9);
    kit.mesh(
      new SphereGeometry(0.55, 12, 10),
      kit.lit(BRIGHT[i % BRIGHT.length], 0.25),
      tile,
      x,
      y,
      Z + 0.9,
    ).scale.y = 1.2;
  }
};

/** A palm tree with a leaning trunk. */
function palm(kit: Kit, tile: Group, x: number, y: number, h: number, z: number) {
  const trunk = kit.lit(0x8a6a3a, 0.9);
  kit.mesh(new CylinderGeometry(0.1, 0.16, h, 8), trunk, tile, x, y + h / 2, z).rotation.z = 0.12;
  const leaf = kit.lit(0x2f9a4a, 0.8);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const m = kit.mesh(
      new ConeGeometry(0.16, 1.5, 6),
      leaf,
      tile,
      x + 0.15 + Math.cos(a) * 0.65,
      y + h - 0.1 + Math.sin(a) * 0.1 - 0.25,
      z,
    );
    m.rotation.z = Math.PI / 2 + (Math.cos(a) > 0 ? -0.5 : 0.5);
    m.rotation.y = a;
  }
}

const pirateShip: Decor = (kit, tile) => {
  // The sea: a band at the horizon with a few low white wave crests.
  const sea: Material = kit.lit(0x2f8fd0, 0.35);
  kit.box(24, 4.6, 0.3, sea, tile, 12, 1.6, WALL_Z - 0.15);
  kit.box(24, 0.5, 0.3, kit.lit(0x6fc0ee, 0.4), tile, 12, 3.7, WALL_Z - 0.1);
  const foam = kit.lit(0xeaf8ff, 0.5);
  for (let i = 0; i < 14; i++) {
    const x = 0.8 + i * 1.75 + hash(i) * 0.6;
    const y = 0.4 + hash(i + 9) * 2.6;
    kit
      .mesh(new SphereGeometry(0.6, 10, 6), foam, tile, x, y, WALL_Z + 0.05)
      .scale.set(1.6, 0.14, 0.2);
  }
  // A little island with a palm tree, far away.
  const sand = kit.lit(0xf0d58a, 0.9);
  kit
    .mesh(new SphereGeometry(2.4, 14, 8), sand, tile, 18.5, 3.2, WALL_Z + 0.2)
    .scale.set(1.5, 0.35, 0.3);
  palm(kit, tile, 18.2, 3.5, 2.6, WALL_Z + 0.3);
  palm(kit, tile, 19.6, 3.4, 1.9, WALL_Z + 0.3);
  // The ship's rail along the front of the deck: posts and a top rail.
  const wood = kit.lit(0x7a4a26, 0.85);
  const rail = kit.lit(0x95602f, 0.8);
  for (let i = 0; i < 25; i++) kit.box(0.2, 1.2, 0.2, wood, tile, i, 0.6, -2.4);
  kit.box(24, 0.18, 0.3, rail, tile, 12, 1.25, -2.4);
  kit.box(24, 0.1, 0.12, wood, tile, 12, 0.5, -2.4);
  // A tall mast with a furled sail and a black flag with a white cat face.
  const mx = 14;
  kit.mesh(new CylinderGeometry(0.2, 0.28, 14, 10), kit.lit(0x6b4220, 0.85), tile, mx, 7, -2.6);
  kit.mesh(
    new CylinderGeometry(0.28, 0.28, 5, 10),
    kit.lit(0xf1e6c8, 0.9),
    tile,
    mx,
    9.5,
    -2.2,
  ).rotation.z = Math.PI / 2;
  kit.box(5.4, 0.16, 0.16, wood, tile, mx, 9.6, -2.25);
  kit.box(1.6, 1.0, 0.05, kit.basic(0x222222), tile, mx + 1.0, 13.4, -2.6);
  const white = kit.basic(0xffffff);
  kit.mesh(new SphereGeometry(0.28, 10, 8), white, tile, mx + 1.0, 13.4, -2.55);
  for (const s of [-1, 1])
    kit.mesh(new ConeGeometry(0.1, 0.2, 4), white, tile, mx + 1.0 + s * 0.17, 13.7, -2.55);
  // Barrels and a coil of rope along the rail.
  for (const x of [4, 20.5]) {
    kit.mesh(new CylinderGeometry(0.5, 0.5, 1.0, 14), kit.lit(0x8a5a2a, 0.9), tile, x, 0.5, -1.9);
    kit.mesh(
      new TorusGeometry(0.5, 0.04, 6, 16),
      kit.lit(0x2e3036, 0.4),
      tile,
      x,
      0.75,
      -1.9,
    ).rotation.x = Math.PI / 2;
  }
};

export const TOYS_PIRATES_SCENERY: Record<Extract<PlaceId, 'toy-store' | 'pirate-ship'>, Decor> = {
  'toy-store': toyStore,
  'pirate-ship': pirateShip,
};
