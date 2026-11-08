/**
 * Geometry for the scenery that `world.ts` recycles along the course: the helpers that paint and
 * merge shapes into one draw call, and the parts of the later worlds (Iceberg Bay, Volcano Island,
 * Shark Reef). Everything is flat-shaded cartoon primitives painted with vertex colours; each
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

/** The volcano's cone: dark rock, a crater with glowing lava and lava running down its slopes. */
export function makeVolcano(): BufferGeometry {
  const height = 46;
  const parts: BufferGeometry[] = [
    part(new ConeGeometry(36, height, 14, 1, true), 0x4a3a3c, 0, height / 2, 0),
    part(new ConeGeometry(30, height * 0.7, 14, 1, true), 0x5a4642, -6, height * 0.35, 3),
    part(new CylinderGeometry(7.5, 8.5, 2.4, 14), 0x2e2428, 0, height - 0.4, 0),
    part(new CylinderGeometry(6.4, 6.4, 0.6, 14), 0xff6a1a, 0, height + 0.5, 0),
  ];
  // Lava running down the slope facing the course (-x side is the course for the left strip).
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (0.7 + i * 0.2);
    const run = 11 + hash(i * 3.3) * 14;
    const slope = Math.atan(36 / height);
    parts.push(
      part(
        new BoxGeometry(1.5, run, 0.5),
        i % 2 ? 0xffa02e : 0xff6a1a,
        Math.cos(a) * (8 + run * 0.3) * 1.0,
        height - 3 - run * 0.5 * Math.cos(slope),
        Math.sin(a) * (8 + run * 0.3) * 1.0,
        0,
        -a + Math.PI / 2,
        Math.sin(slope) * 0.9,
      ),
    );
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
