/**
 * Geometry for the scenery that `world.ts` recycles along the course: the helpers that paint and
 * merge shapes into one draw call, and the parts of the later worlds (Iceberg Bay, Volcano Island,
 * Shark Reef, Candy Cove, Dino Lagoon). Everything is flat-shaded cartoon primitives painted with vertex colours; each
 * factory returns a fresh geometry that the world disposes.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  Color,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler();
const scaleVec = new Vector3();
const positionVec = new Vector3();

/** A geometry moved, turned and scaled, painted a single colour (as vertex colours). */
export function part(
  geometry: BufferGeometry,
  hex: number,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): BufferGeometry {
  quaternion.setFromEuler(euler.set(rx, ry, rz));
  matrix.compose(positionVec.set(x, y, z), quaternion, scaleVec.set(sx, sy, sz));
  geometry.applyMatrix4(matrix);
  const color = new Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Merges painted parts into one geometry (so a whole palm tree is a single draw call). */
export function merge(parts: BufferGeometry[]): BufferGeometry {
  // Same attributes everywhere: drop anything the shapes do not all share.
  const merged = mergeGeometries(
    parts.map((p) => {
      const g = p.index ? p.toNonIndexed() : p;
      for (const name of Object.keys(g.attributes)) {
        if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
      }
      return g;
    }),
    false,
  );
  parts.forEach((p) => p.dispose());
  return merged;
}

// ---------- Iceberg Bay ----------

/** A cartoon penguin (~1.3 u tall) as painted parts, standing at (x, y, z) facing +z. */
function penguinParts(x: number, y: number, z: number, scale = 1): BufferGeometry[] {
  const k = scale;
  return [
    part(new SphereGeometry(0.45 * k, 10, 8), 0x1f2a44, x, y + 0.62 * k, z, 0, 0, 0, 0.9, 1.3, 0.8),
    part(
      new SphereGeometry(0.38 * k, 10, 8),
      0xfafcff,
      x,
      y + 0.56 * k,
      z + 0.12 * k,
      0,
      0,
      0,
      0.9,
      1.2,
      0.75,
    ),
    part(new SphereGeometry(0.26 * k, 10, 8), 0x1f2a44, x, y + 1.3 * k, z + 0.02 * k),
    part(
      new ConeGeometry(0.08 * k, 0.22 * k, 6),
      0xff9a1f,
      x,
      y + 1.26 * k,
      z + 0.3 * k,
      Math.PI / 2,
      0,
      0,
    ),
  ];
}

/** An iceberg island: a faceted pale mound with a tall shard and a smaller block beside it. */
export function makeIceberg(): BufferGeometry {
  return merge([
    part(new IcosahedronGeometry(5.5, 0), 0xe9f6ff, 0, 2.0, 0, 0, 0.4, 0, 1, 1.25, 0.9),
    part(new IcosahedronGeometry(3.4, 0), 0xcfe8f6, 3.9, 1.4, 1.3, 0.3, 1.1, 0, 1, 1.4, 1),
    part(new ConeGeometry(2.2, 8.6, 5), 0xf6fcff, -2.6, 4.4, -1.4),
    part(new ConeGeometry(1.4, 5.0, 5), 0xd6ecf8, 1.0, 3.6, -3.0, 0, 0.5, 0),
    part(new IcosahedronGeometry(2.2, 0), 0xdcf0fb, -5.2, 0.6, 2.6, 0.2, 0.8, 0, 1.2, 0.8, 1),
  ]);
}

/** A flat ice floe with three penguins standing on it. */
export function makeIceFloe(): BufferGeometry {
  return merge([
    part(new CylinderGeometry(3.4, 3.9, 0.7, 8), 0xf2fbff, 0, 0.05, 0),
    part(new CylinderGeometry(1.5, 1.8, 0.55, 7), 0xdff2fc, 4.2, 0.0, 1.2),
    ...penguinParts(0.1, 0.4, 0.2),
    ...penguinParts(1.3, 0.4, -0.9, 0.9),
    ...penguinParts(-1.3, 0.4, 0.9, 0.85),
  ]);
}

/** A cluster of tall ice spires (the landmark that stands in for the lighthouse). */
export function makeIceSpires(): BufferGeometry {
  return merge([
    part(new ConeGeometry(2.2, 11, 5), 0xe6f5ff, 0, 5.5, 0),
    part(new ConeGeometry(1.6, 7.4, 5), 0xcfe8f6, 2.6, 3.7, 1.2, 0, 0.6, 0),
    part(new ConeGeometry(1.4, 5.8, 5), 0xf6fcff, -2.3, 2.9, 0.8, 0, 0.2, 0),
    part(new CylinderGeometry(3.4, 3.9, 0.9, 8), 0xf2fbff, 0, 0.1, 0.4),
  ]);
}

/**
 * A strip of far-off snowy peaks, rock below and snow above, for the sides of Iceberg Bay.
 * Starts at z = -29 and runs along +z like the Harbour City skylines.
 */
export function makeSnowPeaks(seed: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const rocks = [0x8aa3bd, 0x7f98b3, 0x94abc4];
  let z = -29;
  for (let i = 0; i < 6; i++) {
    const r = 8 + hash(seed * 31 + i * 3.1) * 6;
    const h = 20 + hash(seed * 17 + i * 5.3) * 18;
    const x = hash(seed * 7 + i) * 8;
    z += r * 0.8;
    parts.push(part(new ConeGeometry(r, h, 6), rocks[i % rocks.length], x, h / 2, z));
    parts.push(part(new ConeGeometry(r * 0.56, h * 0.4, 6), 0xffffff, x, h * 0.81, z));
    z += r * 0.5;
  }
  return merge(parts);
}

// ---------- Volcano Island ----------

/** A dark sand island with a darker rim and a couple of lava rocks. */
export function makeLavaIsland(sand: number): BufferGeometry {
  const radius = 7;
  return merge([
    part(new CylinderGeometry(radius * 0.8, radius, 1.5, 22), sand, 0, 0.05, 0),
    part(new CylinderGeometry(radius * 0.55, radius * 0.72, 0.4, 18), 0x2a2830, 0, 0.9, 0),
    part(new IcosahedronGeometry(1.1, 0), 0x3a3540, 3.4, 1.3, -2.2, 0.2, 0.5, 0, 1, 0.9, 1),
    part(new IcosahedronGeometry(0.7, 0), 0xff6a1a, 3.6, 1.7, -2.0),
    part(new IcosahedronGeometry(0.8, 0), 0x2e2a35, -3.9, 1.2, 1.9, 0.4, 0.1, 0),
  ]);
}

/** A little stack of dark rocks with lava glowing in the cracks (it floats and bobs). */
export function makeRockStack(): BufferGeometry {
  return merge([
    part(new IcosahedronGeometry(1.5, 0), 0x3a3540, 0, 0.6, 0, 0.3, 0.2, 0, 1.2, 0.8, 1),
    part(new IcosahedronGeometry(0.9, 0), 0x2e2a35, 1.5, 0.7, 0.6, 0.1, 0.9, 0),
    part(new IcosahedronGeometry(0.6, 0), 0xff7a1a, -0.4, 1.4, 0.3),
    part(new IcosahedronGeometry(0.5, 0), 0xffb02e, 1.3, 1.1, 0.7),
  ]);
}

const VOLCANO_HEIGHT = 46;
const VOLCANO_RADIUS = 36;

/** The volcano's cone of dark rock with a crater rim (it faces -x, like the other far strips). */
export function makeVolcano(): BufferGeometry {
  return merge([
    part(new ConeGeometry(VOLCANO_RADIUS, VOLCANO_HEIGHT, 14), 0x4a3a3c, 0, VOLCANO_HEIGHT / 2, 0),
    part(new ConeGeometry(26, 30, 10), 0x5a4642, -9, 15, 10, 0, 0.4, 0),
    part(new ConeGeometry(20, 22, 9), 0x3e3236, 12, 11, -14, 0, 0.9, 0),
    part(new CylinderGeometry(7.2, 8.6, 2.6, 14), 0x2e2428, 0, VOLCANO_HEIGHT - 0.4, 0),
  ]);
}

/**
 * The glow: the lava lake in the crater and the lava running down the slope facing the course. It
 * is drawn with an unlit material so it stays bright whatever the light.
 */
export function makeVolcanoLava(): BufferGeometry {
  const parts: BufferGeometry[] = [
    part(new CylinderGeometry(6.3, 6.3, 0.8, 14), 0xff6a1a, 0, VOLCANO_HEIGHT + 0.9, 0),
    part(
      new SphereGeometry(2.4, 8, 6),
      0xffb02e,
      -2,
      VOLCANO_HEIGHT + 1.6,
      1,
      0,
      0,
      0,
      1.4,
      0.4,
      1.2,
    ),
  ];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (0.78 + i * 0.15);
    const run = 22 + hash(i * 3.3) * 14;
    for (let k = 0; k < 9; k++) {
      const y = VOLCANO_HEIGHT - 2 - (k / 8) * run;
      const r = VOLCANO_RADIUS * (1 - y / VOLCANO_HEIGHT) + 0.5;
      const w = 1.7 - k * 0.1;
      parts.push(
        part(
          new BoxGeometry(w, 2.8, w),
          (k + i) % 2 ? 0xffa02e : 0xff6a1a,
          Math.cos(a) * r,
          y,
          Math.sin(a) * r,
          0.3 * k,
          a,
          0.2 * i,
        ),
      );
    }
  }
  return merge(parts);
}

/** A low ridge of dark peaks (the quiet stretch of coast between volcanoes). */
export function makeDarkRidge(seed: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const rocks = [0x4a3a3c, 0x3a2f35, 0x5a4642];
  let z = -24;
  for (let i = 0; i < 5; i++) {
    const r = 7 + hash(seed * 13 + i * 2.1) * 5;
    const h = 10 + hash(seed * 19 + i * 4.7) * 12;
    z += r * 0.8;
    parts.push(part(new ConeGeometry(r, h, 6), rocks[i % 3], hash(seed + i) * 6, h / 2, z));
    z += r * 0.6;
  }
  return merge(parts);
}

/** The puffs of smoke over the crater, one grey merged blob that the world sways. */
export function makeSmoke(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const puffs: [number, number, number, number][] = [
    [0, 52, 0, 5.5],
    [3, 59, 1, 6.8],
    [-2, 67, -1, 7.6],
    [4, 76, 2, 8.4],
    [-1, 86, 0, 9.0],
  ];
  puffs.forEach(([x, y, z, r], i) => {
    parts.push(part(new IcosahedronGeometry(r, 1), i % 2 ? 0x8d8585 : 0xa39a98, x, y, z));
  });
  return merge(parts);
}

// ---------- Shark Reef ----------

/** A coral rock island: a purple-grey mound with branching coral in orange, pink and yellow. */
export function makeCoralIsland(): BufferGeometry {
  const parts: BufferGeometry[] = [
    part(new CylinderGeometry(5.2, 6.6, 1.6, 12), 0x7a5876, 0, 0.05, 0),
    part(new IcosahedronGeometry(3.4, 0), 0x6a4a6a, -0.6, 1.9, 0.4, 0.2, 0.3, 0, 1, 0.8, 1),
    part(new IcosahedronGeometry(2.0, 0), 0x83607f, 3.6, 1.3, -1.2, 0.5, 0.2, 0),
  ];
  const colors = [0xff6f61, 0xff8fb1, 0xffc247, 0xc77dff];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + hash(i * 1.9);
    const r = 1.3 + hash(i * 2.7) * 3.2;
    const h = 1.4 + hash(i * 4.1) * 2.6;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const c = colors[i % colors.length];
    parts.push(part(new CylinderGeometry(0.16, 0.26, h, 6), c, x, 1.4 + h / 2, z));
    for (const k of [-1, 1]) {
      parts.push(
        part(
          new CylinderGeometry(0.1, 0.17, h * 0.55, 6),
          c,
          x + k * 0.35,
          1.4 + h * 0.8,
          z + k * 0.1,
          0,
          0,
          -k * 0.7,
        ),
      );
    }
    parts.push(part(new SphereGeometry(0.34, 8, 6), c, x, 1.4 + h + 0.1, z));
  }
  return merge(parts);
}

/** A shark's dorsal fin and the little hump of its back, pointing along -z. */
export function makeSharkFin(): BufferGeometry {
  return merge([
    part(new ConeGeometry(0.62, 1.9, 4), 0x56677a, 0, 0.8, 0, -0.35, 0.78, 0, 0.35, 1, 1),
    part(new SphereGeometry(0.7, 10, 8), 0x56677a, 0, 0.0, 0.7, 0, 0, 0, 0.55, 0.5, 1.8),
    part(new ConeGeometry(0.34, 1.1, 4), 0x56677a, 0, 0.35, 1.9, 0.5, 0.78, 0, 0.35, 1, 1),
  ]);
}

/** A moored pirate ship: a brown hull, two masts with cream sails and a black flag. */
export function makePirateShip(): BufferGeometry {
  const parts: BufferGeometry[] = [
    part(new BoxGeometry(3.4, 1.6, 8.6), 0x7a4a2a, 0, 0.5, 0),
    part(new BoxGeometry(3.0, 0.3, 8.2), 0xb07a45, 0, 1.4, 0),
    part(new ConeGeometry(1.5, 2.6, 4), 0x7a4a2a, 0, 0.5, -5.4, -Math.PI / 2, Math.PI / 4, 0),
    part(new BoxGeometry(3.4, 0.18, 8.7), 0xe8c24a, 0, 1.0, 0),
    part(new BoxGeometry(3.2, 1.7, 2.2), 0x6a3d22, 0, 2.2, 3.0),
    part(new BoxGeometry(0.16, 0.16, 3.4), 0x5a3a22, 0, 2.0, -6.3, 0.35, 0, 0),
  ];
  for (const [z, h] of [
    [-1.6, 8.8],
    [2.0, 7.4],
  ] as const) {
    parts.push(part(new CylinderGeometry(0.12, 0.16, h, 8), 0x5a3a22, 0, 1.4 + h / 2, z));
    parts.push(part(new BoxGeometry(3.6, 0.1, 0.1), 0x5a3a22, 0, 1.4 + h * 0.86, z));
    parts.push(part(new BoxGeometry(3.3, h * 0.5, 0.08), 0xf6ead0, 0, 1.4 + h * 0.58, z + 0.1));
    parts.push(part(new BoxGeometry(3.0, h * 0.14, 0.08), 0xe9d9b0, 0, 1.4 + h * 0.2, z + 0.1));
  }
  parts.push(part(new BoxGeometry(1.5, 1.0, 0.06), 0x16161c, 0.8, 10.7, -1.6));
  return merge(parts);
}

// ---------- Candy Cove ----------

const PINK = 0xff8fc7;
const ICING = 0xfff4fa;
const SWIRL = [0xff5fa8, 0xffffff, 0x4fd6c4, 0xffd23f];

/** A lollipop: a pale stick and a swirled disc standing on it, `h` tall, at (x, y, z). */
function lollipopParts(
  x: number,
  y: number,
  z: number,
  h: number,
  r: number,
  tilt = 0,
): BufferGeometry[] {
  const top = y + h;
  const parts: BufferGeometry[] = [
    part(
      new CylinderGeometry(0.1 * (r / 1.2), 0.12 * (r / 1.2), h, 6),
      0xfff7f0,
      x,
      y + h / 2,
      z,
      0,
      0,
      tilt,
    ),
    part(new CylinderGeometry(r, r, 0.3 * (r / 1.2), 14), SWIRL[0], x, top, z, Math.PI / 2, 0, 0),
    part(
      new TorusGeometry(r * 0.62, 0.09 * (r / 1.2), 5, 14),
      SWIRL[1],
      x,
      top,
      z + 0.16 * (r / 1.2),
    ),
    part(
      new TorusGeometry(r * 0.3, 0.09 * (r / 1.2), 5, 12),
      SWIRL[2],
      x,
      top,
      z + 0.16 * (r / 1.2),
    ),
  ];
  return parts;
}

/** A gumdrop: a sugared dome of colour. */
const gumdrop = (hex: number, x: number, y: number, z: number, r: number) =>
  part(new SphereGeometry(r, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), hex, x, y, z);

/**
 * A candy island: a frosted cake mound (pink icing over sponge, with a white drip edge), two
 * lollipop palms and a scatter of gumdrops.
 */
export function makeCandyIsland(): BufferGeometry {
  const parts: BufferGeometry[] = [
    part(new CylinderGeometry(5.6, 6.2, 1.3, 14), 0xf2c98f, 0, 0.0, 0),
    part(new CylinderGeometry(5.5, 5.7, 0.55, 14), PINK, 0, 0.95, 0),
    part(
      new SphereGeometry(3.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      PINK,
      0,
      1.2,
      0,
      0,
      0,
      0,
      1,
      0.55,
      1,
    ),
  ];
  // The white icing drips over the pink rim.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const len = 0.5 + hash(i * 3.3) * 0.7;
    parts.push(
      part(
        new SphereGeometry(0.42, 7, 5),
        ICING,
        Math.cos(a) * 5.55,
        0.75 - len / 2,
        Math.sin(a) * 5.55,
        0,
        0,
        0,
        1,
        len * 1.6,
        1,
      ),
    );
  }
  parts.push(...lollipopParts(-1.6, 1.6, 0.6, 4.6, 1.5, 0.08));
  parts.push(...lollipopParts(1.8, 1.6, -0.8, 3.6, 1.2, -0.1));
  const drops = [0xff5f5f, 0xffd23f, 0x4fd6c4, 0xb28dff];
  for (let i = 0; i < 7; i++) {
    const a = hash(i * 2.1) * Math.PI * 2;
    const r = 2.4 + hash(i * 5.7) * 2.2;
    parts.push(gumdrop(drops[i % 4], Math.cos(a) * r, 1.45, Math.sin(a) * r, 0.5 + hash(i) * 0.3));
  }
  return merge(parts);
}

/** A floating gumdrop buoy: a striped candy ring with a little flag (it bobs on the water). */
export function makeGumdropBuoy(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(
      part(
        new SphereGeometry(0.55, 8, 6),
        i % 2 ? 0xffffff : 0xff4f6f,
        Math.cos(a) * 1.25,
        0.25,
        Math.sin(a) * 1.25,
        0,
        0,
        0,
        1,
        0.9,
        1,
      ),
    );
  }
  parts.push(part(new CylinderGeometry(0.06, 0.06, 2.6, 6), 0xfff7f0, 0, 1.5, 0));
  parts.push(part(new BoxGeometry(0.06, 0.6, 1.0), 0x4fd6c4, 0, 2.5, 0.5));
  return merge(parts);
}

/** The landmark: a tall swirl lollipop beside a candy-cane arch. */
export function makeCandyTower(): BufferGeometry {
  const parts: BufferGeometry[] = [...lollipopParts(0, 0, 0, 9, 3.4)];
  // The candy-cane arch: two striped legs and a half ring across the top.
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      parts.push(
        part(
          new CylinderGeometry(0.4, 0.4, 1.1, 8),
          k % 2 ? 0xffffff : 0xff4f6f,
          7 + side * 3,
          0.55 + k * 1.1,
          0.5,
        ),
      );
    }
  }
  const segs = 9;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI;
    parts.push(
      part(
        new SphereGeometry(0.5, 7, 5),
        i % 2 ? 0xffffff : 0xff4f6f,
        7 + Math.cos(a) * 3,
        4.4 + Math.sin(a) * 2.6,
        0.5,
      ),
    );
  }
  return merge(parts);
}

/** A far strip of frosted layer-cake hills: pale sponge layers under pink and mint icing. */
export function makeCakeHills(seed: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const icings = [PINK, 0x9ff0dc, 0xffe08a];
  let z = -29;
  for (let i = 0; i < 6; i++) {
    const r = 8 + hash(seed * 31 + i * 3.1) * 6;
    const h = 12 + hash(seed * 17 + i * 5.3) * 14;
    const x = hash(seed * 7 + i) * 8;
    z += r * 0.8;
    const layers = 3;
    const lh = h / layers;
    for (let k = 0; k < layers; k++) {
      const rr = r * (1 - k * 0.22);
      parts.push(
        part(
          new CylinderGeometry(rr * 0.9, rr, lh, 12),
          k % 2 ? 0xf6dcae : 0xf2c98f,
          x,
          lh * (k + 0.5),
          z,
        ),
      );
      parts.push(
        part(
          new CylinderGeometry(rr * 0.92, rr * 0.92, 0.5, 12),
          icings[(i + k) % 3],
          x,
          lh * (k + 1) - 0.1,
          z,
        ),
      );
    }
    parts.push(part(new SphereGeometry(1.1, 8, 6), 0xff4f6f, x, h + 0.9, z));
    z += r * 0.5;
  }
  return merge(parts);
}

// ---------- Dino Lagoon ----------

const FERN = [0x3f8f3a, 0x58a845, 0x2f7a3a];
const MOSS = 0x4f8f45;
const DINO_GREEN = 0x5fa85a;
const DINO_BELLY = 0xb7d078;
const SPIKE = 0xf3e6b8;

/** A giant fern: a fan of drooping flat fronds round a short stem. */
function fernParts(x: number, y: number, z: number, scale: number, seed: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const len = (2.6 + hash(seed * 9 + i) * 0.8) * scale;
    const tilt = 1.0 + hash(seed * 5 + i * 1.7) * 0.25;
    parts.push(
      part(
        new ConeGeometry(0.34 * scale, len, 4),
        FERN[i % FERN.length],
        x + Math.sin(a) * len * 0.3,
        y + len * 0.35,
        z + Math.cos(a) * len * 0.3,
        Math.cos(a) * tilt,
        0,
        -Math.sin(a) * tilt,
        1,
        1,
        0.35,
      ),
    );
  }
  return parts;
}

/** A cycad: a stubby scaly trunk with a crown of long fronds. */
function cycadParts(x: number, z: number, height: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [
    part(new CylinderGeometry(0.3, 0.45, height, 7), 0x7a5a38, x, 1.0 + height / 2, z),
  ];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(
      part(
        new ConeGeometry(0.28, 3.2, 4),
        FERN[i % FERN.length],
        x + Math.sin(a) * 1.0,
        1.0 + height + 0.3,
        z + Math.cos(a) * 1.0,
        Math.cos(a) * 1.15,
        0,
        -Math.sin(a) * 1.15,
        1,
        1,
        0.3,
      ),
    );
  }
  return parts;
}

/** A mossy sand-and-rock mound with giant ferns, a cycad and a few round dino eggs. */
export function makeFernIsland(): BufferGeometry {
  const parts: BufferGeometry[] = [
    part(new CylinderGeometry(5.4, 6.2, 1.3, 12), 0xc9a86a, 0, 0, 0),
    part(
      new SphereGeometry(4.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      MOSS,
      0,
      0.6,
      0,
      0,
      0,
      0,
      1,
      0.5,
      1,
    ),
    part(new IcosahedronGeometry(1.5, 0), 0x8a8478, 3.6, 0.9, 1.2, 0.3, 0.5, 0, 1, 0.8, 1),
    part(new IcosahedronGeometry(1.0, 0), 0x77736a, -3.8, 0.8, -1.6, 0.1, 0.2, 0, 1, 0.8, 1),
  ];
  parts.push(...fernParts(-1.8, 1.0, 1.4, 1.3, 1));
  parts.push(...fernParts(2.0, 1.0, -1.2, 1.1, 2));
  parts.push(...fernParts(0.4, 1.0, 3.0, 0.9, 3));
  parts.push(...cycadParts(0.0, -1.0, 2.2));
  const eggs = [
    [-0.4, 3.4],
    [0.5, 3.8],
    [-3.0, -2.6],
  ];
  eggs.forEach(([x, z], i) => {
    parts.push(
      part(
        new SphereGeometry(0.5, 10, 8),
        i === 2 ? 0xe9dcae : 0xf6ecc8,
        x,
        1.5,
        z,
        0,
        0,
        0,
        1,
        1.25,
        1,
      ),
    );
    parts.push(part(new SphereGeometry(0.1, 6, 5), 0x4f9a4a, x + 0.35, 1.7, z + 0.2));
  });
  return merge(parts);
}

/** A long-neck dinosaur's humped back and cream spikes just breaking the water. */
export function makeDinoBackRidge(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const humps: [number, number, number][] = [
    [-2.4, 0.9, 1.5],
    [0.2, 1.2, 1.9],
    [2.8, 0.8, 1.4],
  ];
  for (const [z, h, r] of humps) {
    parts.push(
      part(new SphereGeometry(r, 10, 8), DINO_GREEN, 0, -0.5, z, 0, 0, 0, 0.9, h / r + 0.1, 1.2),
    );
    for (let k = -1; k <= 1; k++) {
      parts.push(
        part(new ConeGeometry(0.28, 0.8, 4), SPIKE, 0, h + 0.3, z + k * 0.7, 0, 0, 0, 0.5, 1, 1),
      );
    }
  }
  // The tail trails off behind and the neck dips in front.
  parts.push(
    part(new ConeGeometry(0.8, 4.2, 8), DINO_GREEN, 0, -0.1, 6.3, Math.PI / 2 + 0.1, 0, 0),
  );
  parts.push(
    part(
      new CylinderGeometry(0.5, 0.8, 3.4, 8),
      DINO_GREEN,
      0,
      0.2,
      -5.2,
      Math.PI / 2 - 0.35,
      0,
      0,
    ),
  );
  return merge(parts);
}

/** The landmark: a tall Brachiosaurus standing in the shallows, a long neck up and a small head. */
export function makeBrachioTower(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  // Four thick legs in the water, then the barrel body, belly and tail.
  for (const [x, z] of [
    [-1.6, -2.4],
    [1.6, -2.4],
    [-1.6, 2.4],
    [1.6, 2.4],
  ]) {
    parts.push(part(new CylinderGeometry(0.85, 1.05, 5.5, 8), DINO_GREEN, x, 2.2, z));
  }
  parts.push(part(new SphereGeometry(3.2, 12, 9), DINO_GREEN, 0, 6.2, 0, 0, 0, 0, 1, 0.85, 1.55));
  parts.push(part(new SphereGeometry(2.6, 10, 8), DINO_BELLY, 0, 5.3, 0, 0, 0, 0, 1, 0.8, 1.5));
  parts.push(part(new ConeGeometry(1.5, 8, 8), DINO_GREEN, 0, 5.6, 8.2, Math.PI / 2 + 0.15, 0, 0));
  // The neck: a chain of overlapping spheres leaning forward as it climbs to about 21 u.
  const links = 13;
  for (let i = 0; i <= links; i++) {
    const u = i / links;
    const y = 7.0 + 12.6 * u;
    const z = -3.2 - 3.8 * Math.sin(u * 1.4) ** 2;
    parts.push(
      part(
        new SphereGeometry(1.45 - 0.75 * u, 9, 7),
        i % 3 === 2 ? DINO_BELLY : DINO_GREEN,
        0,
        y,
        z,
      ),
    );
  }
  const topZ = -3.2 - 3.8 * Math.sin(1.4) ** 2;
  parts.push(
    part(new SphereGeometry(0.95, 10, 8), DINO_GREEN, 0, 20.3, topZ - 0.4, 0, 0, 0, 1, 0.85, 1.2),
  );
  parts.push(part(new SphereGeometry(0.1, 6, 5), 0x1d2a1d, -0.55, 20.6, topZ - 1.2));
  parts.push(part(new SphereGeometry(0.1, 6, 5), 0x1d2a1d, 0.55, 20.6, topZ - 1.2));
  // Cream spots along the back.
  for (let i = 0; i < 6; i++) {
    parts.push(
      part(
        new SphereGeometry(0.45, 6, 5),
        SPIKE,
        (i % 2 ? 1 : -1) * 1.1,
        8.1 - Math.abs(i - 2.5) * 0.15,
        -3.2 + i * 1.2,
        0,
        0,
        0,
        1,
        0.5,
        1,
      ),
    );
  }
  return merge(parts);
}

/**
 * A far strip of rounded green jungle hills with fern clumps and, now and then, a pair of small
 * smoking volcano cones.
 */
export function makeJungleHills(seed: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const greens = [0x4f9a45, 0x5fae4f, 0x3f8a42];
  let z = -29;
  for (let i = 0; i < 6; i++) {
    const r = 8 + hash(seed * 31 + i * 3.1) * 6;
    const h = 9 + hash(seed * 17 + i * 5.3) * 9;
    const x = hash(seed * 7 + i) * 8;
    z += r * 0.8;
    if ((i + seed) % 3 === 2) {
      // A pair of mini volcano cones with a puff of smoke each.
      for (const side of [-1, 1]) {
        const cz = z + side * r * 0.5;
        parts.push(part(new ConeGeometry(r * 0.5, h * 1.05, 8), 0x5a4a46, x, (h * 1.05) / 2, cz));
        parts.push(part(new ConeGeometry(r * 0.12, h * 0.2, 8), 0xff8a3a, x, h * 1.0, cz));
        parts.push(
          part(
            new SphereGeometry(1.5, 7, 5),
            0x9a9290,
            x,
            h * 1.05 + 1.8,
            cz,
            0,
            0,
            0,
            1.2,
            0.9,
            1.2,
          ),
        );
        parts.push(
          part(
            new SphereGeometry(1.1, 7, 5),
            0xb4aeab,
            x + 0.6,
            h * 1.05 + 3.6,
            cz,
            0,
            0,
            0,
            1.2,
            0.9,
            1.2,
          ),
        );
      }
    } else {
      parts.push(
        part(
          new SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          greens[i % 3],
          x,
          0,
          z,
          0,
          0,
          0,
          1,
          h / r,
          1,
        ),
      );
      for (let k = 0; k < 3; k++) {
        const a = hash(seed * 3 + i * 7 + k) * Math.PI * 2;
        parts.push(
          ...fernParts(x + Math.cos(a) * r * 0.4, h * 0.72, z + Math.sin(a) * r * 0.4, 1.4, i + k),
        );
      }
    }
    z += r * 0.5;
  }
  return merge(parts);
}
