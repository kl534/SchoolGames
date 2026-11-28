/**
 * The decor of the four town places and their far layers: what stands behind the cat outdoors,
 * in tile coordinates (x from 0 to 24, the backdrop at z = WALL_Z, the floor at y = 0).
 */
import { CylinderGeometry, Group, SphereGeometry } from 'three';
import type { Kit } from '../kit';
import type { PlaceId, PlaceLook } from '../places';
import { WALL_Z } from './house-scenery';

const Z = WALL_Z + 0.2;

type Decor = (kit: Kit, tile: Group, look: PlaceLook) => void;

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A round-topped tree. */
function tree(kit: Kit, tile: Group, x: number, scale = 1, z = -1.9, leaf = 0x3e9a4a) {
  kit.mesh(
    new CylinderGeometry(0.35 * scale, 0.5 * scale, 3.2 * scale, 10),
    kit.wood(0x7a5230),
    tile,
    x,
    1.6 * scale,
    z,
  );
  const mat = kit.foliage(leaf);
  for (const [dx, dy, r] of [
    [0, 4.2, 1.7],
    [-1.1, 3.6, 1.2],
    [1.1, 3.7, 1.25],
    [0.1, 5.3, 1.2],
  ] as const) {
    kit.mesh(new SphereGeometry(r * scale, 14, 10), mat, tile, x + dx * scale, dy * scale, z);
  }
}

function lamppost(kit: Kit, tile: Group, x: number, z = -1.6) {
  const dark = kit.metal(0x33363c);
  kit.mesh(new CylinderGeometry(0.1, 0.14, 5.4, 8), dark, tile, x, 2.7, z);
  kit.box(0.7, 0.14, 0.14, dark, tile, x + 0.3, 5.45, z);
  kit.mesh(new SphereGeometry(0.28, 12, 10), kit.basic(0xfff3b0), tile, x + 0.6, 5.3, z);
}

function bench(kit: Kit, tile: Group, x: number, z = -1.5) {
  const wood = kit.wood(0xa56b3a);
  kit.box(2.2, 0.14, 0.7, wood, tile, x, 1.0, z);
  kit.box(2.2, 0.8, 0.12, wood, tile, x, 1.55, z - 0.3);
  for (const dx of [-0.9, 0.9]) kit.box(0.12, 1.0, 0.6, kit.metal(0x33363c), tile, x + dx, 0.5, z);
}

function bush(kit: Kit, tile: Group, x: number, r: number, color = 0x3e9a4a, z = -1.8) {
  const mat = kit.foliage(color);
  for (const [dx, dr] of [
    [-0.6, 0.8],
    [0, 1],
    [0.6, 0.8],
  ] as const) {
    kit.mesh(new SphereGeometry(r * dr, 12, 9), mat, tile, x + dx * r, r * dr * 0.8, z);
  }
}

/** A building front with a grid of windows. */
function building(
  kit: Kit,
  tile: Group,
  x: number,
  w: number,
  h: number,
  color: number,
  lit = 0xbfe4ff,
  z = Z,
) {
  kit.box(w, h, 0.5, kit.stone(color), tile, x, h / 2, z - 0.25);
  kit.box(w + 0.3, 0.3, 0.7, kit.stone(color ^ 0x202020), tile, x, h + 0.1, z - 0.2);
  const glass = kit.basic(lit);
  for (let wx = -w / 2 + 1; wx < w / 2 - 0.5; wx += 1.6) {
    for (let wy = 3.2; wy < h - 1; wy += 2) {
      kit.box(0.9, 1.1, 0.06, glass, tile, x + wx, wy, z + 0.02);
    }
  }
}

const backyard: Decor = (kit, tile, look) => {
  // A tall wooden fence and a hedge along the back.
  const plank = kit.wood(0xc9a77a);
  for (let i = 0; i < 48; i++) kit.box(0.46, 5.4, 0.1, plank, tile, i * 0.5 + 0.25, 2.7, Z - 0.2);
  kit.box(24, 0.2, 0.2, kit.wood(0xa88658), tile, 12, 4.2, Z - 0.1);
  kit.box(24, 0.2, 0.2, kit.wood(0xa88658), tile, 12, 1.2, Z - 0.1);
  const hedge = kit.foliage(look.wall);
  for (let x = 1; x < 24; x += 2.2) {
    kit.mesh(new SphereGeometry(1.2, 12, 9), hedge, tile, x, 0.9, -2.2).scale.y = 0.8;
  }
  tree(kit, tile, 2.2, 1.1, -2.0);
  tree(kit, tile, 18.5, 0.9, -2.0, 0x4aa84a);
  // A doghouse.
  kit.box(2.2, 1.6, 1.6, kit.wood(0xc0623a), tile, 11.5, 0.8, -1.7);
  const roof = kit.box(2.8, 0.14, 1.9, kit.wood(0x7a3b2a), tile, 11.1, 2.0, -1.7);
  roof.rotation.z = 0.5;
  const roof2 = kit.box(2.8, 0.14, 1.9, kit.wood(0x7a3b2a), tile, 11.9, 2.0, -1.7);
  roof2.rotation.z = -0.5;
  kit.box(0.9, 1.0, 0.08, kit.lit(0x2a1d14), tile, 11.5, 0.5, -0.88);
  // A barbecue and a gnome.
  kit.mesh(new SphereGeometry(0.7, 14, 10), kit.metal(0x2a2a2e), tile, 19.5, 1.5, -1.6);
  kit.box(0.1, 1.2, 0.1, kit.metal(0x555555), tile, 19.5, 0.6, -1.6);
  kit.mesh(new CylinderGeometry(0.01, 0.3, 0.6, 10), kit.lit(0xe0504a, 0.7), tile, 15.5, 1.1, -1.3);
  kit.mesh(new SphereGeometry(0.22, 10, 8), kit.lit(0xf2c9a0, 0.7), tile, 15.5, 0.68, -1.3);
  kit.box(0.4, 0.5, 0.3, kit.lit(0x3f8fd8, 0.8), tile, 15.5, 0.25, -1.3);
  // Flower pots.
  for (const x of [6.2, 7.0, 14]) {
    kit.mesh(new CylinderGeometry(0.3, 0.22, 0.5, 10), kit.stone(0xc0623a), tile, x, 0.25, -1.4);
    kit.mesh(new SphereGeometry(0.3, 10, 8), kit.lit(0xff6f91, 0.7), tile, x, 0.75, -1.4);
  }
};

const park: Decor = (kit, tile, look) => {
  // Rolling hills of bushes along the back, and a row of trees.
  const bushes = kit.foliage(look.wall);
  for (let x = 0; x < 24; x += 2.6) {
    kit.mesh(new SphereGeometry(1.8, 12, 9), bushes, tile, x + hash(x) * 0.8, 0.5, -2.4).scale.y =
      0.7;
  }
  tree(kit, tile, 1.5, 1.3);
  tree(kit, tile, 9, 1.0, -2.1, 0x4aa84a);
  tree(kit, tile, 16.5, 1.2);
  tree(kit, tile, 22.5, 0.9, -2.1, 0x57b455);
  lamppost(kit, tile, 6);
  bench(kit, tile, 13);
  // A picnic blanket with a basket, and some bushes.
  kit.box(3.4, 0.04, 2.0, kit.fabric(0xe0504a), tile, 20, 0.03, -0.2);
  kit.box(1.7, 0.05, 1.0, kit.fabric(0xffffff), tile, 20, 0.04, -0.2);
  kit.box(0.7, 0.45, 0.5, kit.wood(0xc9a15a), tile, 20.4, 0.28, -0.2);
  bush(kit, tile, 11, 0.8, 0x2f8a46);
  bush(kit, tile, 3.8, 0.7, 0x4aa84a);
  // A sign.
  kit.box(0.14, 1.8, 0.14, kit.wood(0x7a5230), tile, 15, 0.9, -1.4);
  kit.box(1.4, 0.7, 0.1, kit.wood(0x3f8fd8), tile, 15, 2.0, -1.4);
};

const street: Decor = (kit, tile) => {
  building(kit, tile, 3.5, 7, 9, 0xd9a577);
  building(kit, tile, 10.5, 7, 12, 0xc98a6a, 0xffe6a0);
  building(kit, tile, 17, 6, 8, 0x9db4c9);
  building(kit, tile, 22.8, 4, 10.5, 0xe0c27a, 0xbfe4ff);
  // Doors and an awning on the shops.
  kit.box(1.4, 2.4, 0.1, kit.wood(0x6b4526), tile, 3.5, 1.2, Z + 0.05);
  kit.box(3.2, 0.4, 0.9, kit.fabric(0xe0504a), tile, 10.5, 3.0, Z + 0.4);
  kit.box(1.6, 2.4, 0.1, kit.wood(0x3d5a80), tile, 10.5, 1.2, Z + 0.05);
  lamppost(kit, tile, 7.2);
  lamppost(kit, tile, 20);
  bench(kit, tile, 14.2);
  // A bus-stop sign.
  kit.box(0.1, 3.2, 0.1, kit.metal(0x555555), tile, 1.2, 1.6, -1.4);
  kit.mesh(
    new CylinderGeometry(0.5, 0.5, 0.08, 16),
    kit.lit(0x3f8fd8, 0.5),
    tile,
    1.2,
    3.3,
    -1.4,
  ).rotation.x = Math.PI / 2;
  // The kerb.
  kit.box(24, 0.2, 0.3, kit.stone(0xb4b6bc), tile, 12, 0.1, -2.1);
};

const rooftops: Decor = (kit, tile, look) => {
  // A skyline of dark buildings with lit windows, and a water tower.
  const dusk = [0x4a3d63, 0x3b3358, 0x56476f, 0x2f2a4a];
  for (let i = 0; i < 6; i++) {
    const w = 3 + hash(i) * 2;
    const h = 5.5 + hash(i + 3) * 4.5;
    building(kit, tile, 2 + i * 4.2, w, h, dusk[i % dusk.length], 0xffd27a, Z - 0.6);
  }
  const wood = kit.wood(0x7a5230);
  kit.mesh(new CylinderGeometry(1.1, 1.1, 1.8, 14), wood, tile, 10, 12.6, -2.4);
  kit.mesh(new CylinderGeometry(0.1, 0.1, 3, 6), wood, tile, 9.3, 10.4, -2.4);
  kit.mesh(new CylinderGeometry(0.1, 0.1, 3, 6), wood, tile, 10.7, 10.4, -2.4);
  // A low wall along the back edge of the roof, vents and a satellite dish.
  kit.box(24, 1.0, 0.5, kit.stone(look.wall), tile, 12, 0.5, -2.0);
  kit.box(24, 0.16, 0.7, kit.stone(look.trim), tile, 12, 1.08, -2.0);
  for (const x of [2.5, 13.5, 21]) {
    kit.mesh(new CylinderGeometry(0.4, 0.5, 1.0, 10), kit.metal(0x888e98), tile, x, 0.6, -1.5);
    kit.mesh(new CylinderGeometry(0.55, 0.4, 0.15, 10), kit.metal(0x6f7580), tile, x, 1.15, -1.5);
  }
  kit.mesh(
    new SphereGeometry(0.8, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    kit.lit(0xe8e8ec, 0.5),
    tile,
    18,
    1.4,
    -1.5,
  ).rotation.x = -0.9;
  kit.box(0.1, 1.2, 0.1, kit.metal(0x555555), tile, 18, 0.6, -1.5);
};

export const TOWN_SCENERY: Record<
  Extract<PlaceId, 'backyard' | 'park' | 'street' | 'rooftops'>,
  Decor
> = { backyard, park, street, rooftops };

/** The far layer of an outdoor place: a sun or a moon, clouds or stars, every 8 u. */
export function buildOutdoorFar(
  placeId: PlaceId,
  kit: Kit,
  far: Group,
  count: number,
  step: number,
) {
  const dusk = placeId === 'rooftops';
  const cloud = kit.basic(dusk ? 0xd9a0b8 : 0xffffff, dusk ? 0.8 : 0.95);
  const z = WALL_Z - 5;
  const sun = kit.basic(dusk ? 0xfff0c2 : 0xffe46b);
  for (let j = -3; j <= count; j++) {
    const x = j * step;
    const y = 15 + hash(j + 11) * 7;
    // One sun or moon in every third slot, so the view always holds about one.
    if (j % 3 === 0) {
      kit.mesh(new SphereGeometry(dusk ? 2.2 : 2.6, 16, 12), sun, far, x + 4, dusk ? 9 : 22, z - 1);
    }
    if (dusk) {
      kit.mesh(new SphereGeometry(0.16, 6, 5), kit.basic(0xffffff), far, x + 2, y + 5, z);
    }
    for (const [dx, dy, r] of [
      [0, 0, 1.8],
      [1.7, -0.3, 1.4],
      [-1.7, -0.4, 1.3],
    ] as const) {
      kit.mesh(new SphereGeometry(r, 10, 8), cloud, far, x + dx, y + dy, z).scale.y = 0.6;
    }
  }
}
