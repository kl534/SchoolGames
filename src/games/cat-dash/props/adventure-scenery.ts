/**
 * The decor of the four adventure places (beach, snowy forest, desert, space station), in tile
 * coordinates (x from 0 to 24, the backdrop at z = WALL_Z, the floor at y = 0). The first three
 * are outdoors under a sky; the space station is indoors with a starry window.
 */
import { ConeGeometry, CylinderGeometry, SphereGeometry, type Group } from 'three';
import type { Kit } from '../kit';
import type { PlaceId, PlaceLook } from '../places';
import { WALL_Z } from './house-scenery';

const Z = WALL_Z + 0.2;

type Decor = (kit: Kit, tile: Group, look: PlaceLook) => void;

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function palm(kit: Kit, tile: Group, x: number, h: number, z = -1.7) {
  const trunk = kit.lit(0x9a6a3c, 0.9);
  for (let i = 0; i < 6; i++) {
    const y = (i + 0.5) * (h / 6);
    kit.mesh(
      new CylinderGeometry(0.2 - i * 0.012, 0.25 - i * 0.012, h / 6 + 0.05, 8),
      trunk,
      tile,
      x + Math.sin(i * 0.35) * 0.35,
      y,
      z,
    );
  }
  const top = x + Math.sin(6 * 0.35) * 0.35;
  const leaf = kit.lit(0x3e9a4a, 0.8);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const l = kit.mesh(
      new ConeGeometry(0.28, 2.2, 5),
      leaf,
      tile,
      top + Math.cos(a) * 0.9,
      h - Math.abs(Math.sin(a)) * 0.2 - 0.2,
      z + Math.sin(a) * 0.6,
    );
    l.rotation.z = Math.cos(a) * -1.15;
    l.rotation.x = Math.sin(a) * 1.0;
  }
  kit.mesh(new SphereGeometry(0.22, 8, 6), kit.lit(0x6b4a2b, 0.8), tile, top, h - 0.2, z + 0.15);
}

const beach: Decor = (kit, tile) => {
  // The sea along the horizon, with white wave lines and a sailboat.
  kit.box(24, 3.6, 0.3, kit.lit(0x2f9be8, 0.5), tile, 12, 1.8, -3.4);
  for (let i = 0; i < 10; i++)
    kit.box(
      1.6 + hash(i) * 1.2,
      0.08,
      0.05,
      kit.basic(0xffffff),
      tile,
      1.2 + i * 2.4,
      0.5 + hash(i + 4) * 2.2,
      -3.2,
    );
  kit.box(0.08, 2.0, 0.08, kit.lit(0x6b4a2b, 0.8), tile, 17, 4.6, -3.2);
  kit.box(1.1, 1.5, 0.04, kit.lit(0xffffff, 0.7), tile, 17.5, 4.7, -3.2);
  kit.box(1.8, 0.35, 0.3, kit.lit(0xe0504a, 0.6), tile, 17, 3.55, -3.2);
  palm(kit, tile, 2.6, 5.2);
  palm(kit, tile, 21.5, 4.4, -1.9);
  // An umbrella with a towel, a beach ball and some shells.
  kit.box(0.08, 3.2, 0.08, kit.lit(0xffffff, 0.6), tile, 13, 1.6, -1.5);
  kit.mesh(new ConeGeometry(1.8, 0.9, 10), kit.lit(0xe0504a, 0.6), tile, 13, 3.35, -1.5);
  kit.box(2.2, 0.04, 1.0, kit.lit(0xf2c230, 0.8), tile, 11.8, 0.03, -1.2);
  kit.mesh(new SphereGeometry(0.4, 14, 10), kit.lit(0x3f8fd8, 0.5), tile, 15.6, 0.4, -1.0);
  kit.mesh(new SphereGeometry(0.14, 8, 6), kit.lit(0xff6f91, 0.5), tile, 15.6, 0.62, -0.62);
  for (const x of [6.2, 8.8, 19.2])
    kit
      .mesh(new SphereGeometry(0.2, 8, 6), kit.lit(0xffd6e0, 0.6), tile, x, 0.1, -0.9)
      .scale.set(1, 0.5, 1);
};

function pine(kit: Kit, tile: Group, x: number, s: number, z: number) {
  kit.mesh(
    new CylinderGeometry(0.2 * s, 0.28 * s, 1.2 * s, 8),
    kit.lit(0x6a4a2a, 0.9),
    tile,
    x,
    0.6 * s,
    z,
  );
  const green = kit.lit(0x2f6a4a, 0.85);
  const snow = kit.lit(0xffffff, 0.9);
  for (let i = 0; i < 4; i++) {
    const r = (1.6 - i * 0.32) * s;
    const y = (1.4 + i * 1.05) * s;
    kit.mesh(new ConeGeometry(r, 1.5 * s, 10), green, tile, x, y, z);
    kit.mesh(new ConeGeometry(r * 0.78, 0.7 * s, 10), snow, tile, x, y + 0.45 * s, z + 0.02);
  }
}

const snowyForest: Decor = (kit, tile) => {
  // Snowy hills behind, then rows of pine trees.
  const hill = kit.lit(0xe8f1fb, 0.95);
  for (const [x, r] of [
    [3, 4],
    [11, 5.5],
    [19, 4.4],
  ] as const)
    kit.mesh(new SphereGeometry(r, 16, 10), hill, tile, x, -r * 0.3, -3.2).scale.z = 0.15;
  for (const [x, s, z] of [
    [1.4, 1.2, -2.3],
    [4.6, 1.5, -2.5],
    [8.0, 1.1, -2.2],
    [10.8, 1.6, -2.6],
    [14.6, 1.2, -2.3],
    [17.4, 1.5, -2.5],
    [21.6, 1.3, -2.3],
  ] as const)
    pine(kit, tile, x, s, z);
  // A snowman with a scarf and a carrot nose.
  const white = kit.lit(0xffffff, 0.9);
  kit.mesh(new SphereGeometry(0.7, 14, 10), white, tile, 13, 0.7, -1.4);
  kit.mesh(new SphereGeometry(0.5, 14, 10), white, tile, 13, 1.7, -1.4);
  kit.mesh(new SphereGeometry(0.36, 14, 10), white, tile, 13, 2.4, -1.4);
  kit.mesh(
    new ConeGeometry(0.06, 0.4, 6),
    kit.lit(0xff7a1a, 0.6),
    tile,
    13.3,
    2.4,
    -1.12,
  ).rotation.z = -Math.PI / 2;
  kit.box(0.7, 0.14, 0.4, kit.lit(0xe0504a, 0.7), tile, 13, 2.05, -1.4);
  for (const dx of [-0.1, 0.1])
    kit.mesh(new SphereGeometry(0.04, 6, 5), kit.lit(0x111111), tile, 13 + dx + 0.12, 2.5, -1.08);
  // A signpost and a few snow drifts.
  kit.box(0.14, 2.0, 0.14, kit.lit(0x7a5230, 0.9), tile, 7, 1.0, -1.3);
  kit.box(1.2, 0.5, 0.08, kit.lit(0xb98a5e, 0.8), tile, 7.3, 1.9, -1.3);
  for (const x of [2.5, 9.6, 16.6, 22.6])
    kit.mesh(new SphereGeometry(0.8, 12, 8), white, tile, x, 0.1, -1.2).scale.set(1.6, 0.45, 1);
};

function mesa(kit: Kit, tile: Group, x: number, w: number, h: number, z: number) {
  const bands = [0xd8703a, 0xc9602a, 0xe08a4a, 0xb85a2a];
  const n = Math.ceil(h / 1.2);
  for (let i = 0; i < n; i++) {
    const k = 1 - (i / n) * 0.18;
    kit.box(
      w * k,
      h / n + 0.02,
      1.8,
      kit.lit(bands[i % bands.length], 0.95),
      tile,
      x,
      (i + 0.5) * (h / n),
      z,
    );
  }
}

const desert: Decor = (kit, tile, look) => {
  void look;
  mesa(kit, tile, 3.5, 5, 6.5, -3.0);
  mesa(kit, tile, 13.5, 6.5, 8.5, -3.2);
  mesa(kit, tile, 21.5, 4, 5, -3.0);
  // Small background cacti, rocks and a cow skull on a post.
  const green = kit.lit(0x3e9a4a, 0.85);
  for (const x of [8.4, 18.2]) {
    kit.mesh(new CylinderGeometry(0.28, 0.3, 2.4, 8), green, tile, x, 1.2, -2.0);
    kit.mesh(new CylinderGeometry(0.16, 0.16, 0.9, 8), green, tile, x - 0.5, 1.7, -2.0);
    kit.mesh(new CylinderGeometry(0.16, 0.16, 0.8, 8), green, tile, x + 0.5, 1.4, -2.0);
  }
  const rock = kit.lit(0xb08a5a, 0.95);
  for (const [x, r] of [
    [6, 0.5],
    [11.4, 0.7],
    [16.4, 0.45],
    [23, 0.55],
  ] as const)
    kit.mesh(new SphereGeometry(r, 10, 8), rock, tile, x, r * 0.5, -1.2).scale.set(1.3, 0.8, 1);
  kit.box(0.14, 1.8, 0.14, kit.lit(0x7a5230, 0.9), tile, 15, 0.9, -1.3);
  kit
    .mesh(new SphereGeometry(0.34, 10, 8), kit.lit(0xf2ead8, 0.8), tile, 15, 1.95, -1.3)
    .scale.set(1.2, 0.8, 0.7);
  for (const s of [-1, 1])
    kit.mesh(
      new ConeGeometry(0.07, 0.55, 5),
      kit.lit(0xf2ead8, 0.8),
      tile,
      15 + s * 0.42,
      2.1,
      -1.3,
    ).rotation.z = -s * 1.2;
  // A dry bush.
  for (let i = 0; i < 6; i++)
    kit.box(
      0.05,
      0.7,
      0.05,
      kit.lit(0x8a6a3a, 0.9),
      tile,
      20 + (i - 3) * 0.1,
      0.35,
      -1.0,
    ).rotation.z = (i - 3) * 0.25;
};

const spaceStation: Decor = (kit, tile) => {
  // A big round window onto the stars and a planet, framed in metal.
  const frame = kit.lit(0x8aa0c8, 0.4);
  kit.mesh(new CylinderGeometry(2.4, 2.4, 0.2, 32), frame, tile, 12, 5.4, Z).rotation.x =
    Math.PI / 2;
  kit.mesh(
    new CylinderGeometry(2.0, 2.0, 0.22, 32),
    kit.basic(0x0a0e22),
    tile,
    12,
    5.4,
    Z + 0.02,
  ).rotation.x = Math.PI / 2;
  for (let i = 0; i < 26; i++) {
    const a = hash(i) * Math.PI * 2;
    const r = Math.sqrt(hash(i + 8)) * 1.8;
    kit.box(
      0.06,
      0.06,
      0.02,
      kit.basic(0xffffff),
      tile,
      12 + Math.cos(a) * r,
      5.4 + Math.sin(a) * r,
      Z + 0.15,
    );
  }
  kit.mesh(new SphereGeometry(0.9, 16, 12), kit.basic(0x3f8fd8), tile, 12.8, 4.7, Z + 0.1);
  kit
    .mesh(
      new SphereGeometry(0.9, 16, 12, 0, Math.PI),
      kit.basic(0x5cb85c),
      tile,
      12.8,
      4.7,
      Z + 0.11,
    )
    .scale.set(0.8, 0.9, 1);
  // Pipes along the wall, and two control panels with blinking-looking lights.
  const pipe = kit.lit(0x9aa5ad, 0.4);
  for (const y of [1.6, 7.6])
    kit.mesh(new CylinderGeometry(0.16, 0.16, 24, 10), pipe, tile, 12, y, Z + 0.3).rotation.z =
      Math.PI / 2;
  for (const x of [3.8, 19.6]) {
    kit.box(3.2, 2.2, 0.5, kit.lit(0x39425a, 0.5), tile, x, 1.9, Z + 0.4);
    kit.box(2.6, 1.0, 0.04, kit.basic(0x5ce1ff), tile, x, 2.4, Z + 0.68);
    for (let i = 0; i < 6; i++)
      kit.mesh(
        new SphereGeometry(0.08, 8, 6),
        kit.basic([0xff4a4a, 0x5cff8a, 0xf2c230][i % 3]),
        tile,
        x - 1.0 + i * 0.4,
        1.35,
        Z + 0.68,
      );
  }
  // A pod door and hazard stripes.
  kit.box(2.2, 3.4, 0.3, kit.lit(0x6a7488, 0.4), tile, 7.8, 1.7, Z + 0.3);
  kit.box(1.6, 2.8, 0.06, kit.lit(0x39425a, 0.4), tile, 7.8, 1.7, Z + 0.48);
  for (let i = 0; i < 12; i++)
    kit.box(
      0.5,
      0.35,
      0.05,
      kit.lit(i % 2 ? 0xf2c230 : 0x222222, 0.6),
      tile,
      16 + (i % 6) * 0.5,
      4.2 + Math.floor(i / 6) * 0.35,
      Z + 0.1,
    );
  // Cables hanging from the ceiling.
  for (const x of [1.4, 9.6, 15.4, 22.4])
    kit.box(0.08, 3.6, 0.08, kit.lit(0x222833, 0.6), tile, x, 7.2, Z + 0.5);
};

export const ADVENTURE_SCENERY: Record<
  Extract<PlaceId, 'beach' | 'snowy-forest' | 'desert' | 'space-station'>,
  Decor
> = { beach, 'snowy-forest': snowyForest, desert, 'space-station': spaceStation };
