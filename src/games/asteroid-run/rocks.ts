import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three';

/** A hash of three whole numbers to 0..1. */
function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth value noise, -1..1: the same point always gives the same answer. */
export function noise3(x: number, y: number, z: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const fz = smooth(z - z0);
  const corner = (dx: number, dy: number, dz: number) => hash3(x0 + dx, y0 + dy, z0 + dz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const plane = (dz: number) =>
    lerp(
      lerp(corner(0, 0, dz), corner(1, 0, dz), fx),
      lerp(corner(0, 1, dz), corner(1, 1, dz), fx),
      fy,
    );
  return lerp(plane(0), plane(1), fz) * 2 - 1;
}

/** Two layers of noise, the second finer and fainter, for lumpy rock. */
export function fbm3(x: number, y: number, z: number): number {
  return (noise3(x, y, z) + noise3(x * 2.1 + 5.2, y * 2.1 + 1.3, z * 2.1 + 9.7) * 0.5) / 1.5;
}

export interface RockOptions {
  radius: number;
  /** Icosahedron subdivisions: more is rounder and lumpier. */
  detail: number;
  /** How far the noise pushes the surface in and out, as a fraction of the radius. */
  roughness: number;
  /** Different seeds give different rocks. */
  seed: number;
  /** Squashes or stretches the rock along each axis. */
  stretch?: [number, number, number];
}

/**
 * A lumpy rock: an icosahedron with its corners pushed in and out by noise. The faces are not
 * shared, so use it with flat shading. The same corner always moves the same way, so the faces
 * still meet.
 */
export function rockGeometry(options: RockOptions): BufferGeometry {
  const { radius, detail, roughness, seed, stretch = [1, 1, 1] } = options;
  const geometry = new IcosahedronGeometry(1, detail);
  const position = geometry.attributes.position;
  const p = new Vector3();
  const offset = seed * 7.31;
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    const lump = fbm3(p.x * 1.7 + offset, p.y * 1.7 - offset * 0.6, p.z * 1.7 + offset * 1.3);
    p.multiplyScalar(radius * (1 + roughness * lump));
    position.setXYZ(i, p.x * stretch[0], p.y * stretch[1], p.z * stretch[2]);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The faces of a rock that lie along thin bands of noise, nudged out a little so they sit on the
 * surface: drawn bright, they look like glowing cracks.
 */
export function crackGeometry(rock: BufferGeometry, seed: number, width: number, lift: number) {
  const position = rock.attributes.position;
  const out: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const centre = new Vector3();
  const offset = seed * 3.77;
  for (let i = 0; i + 2 < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    centre
      .copy(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    const k = 0.45 / Math.max(centre.length(), 1e-6);
    const vein = Math.abs(
      fbm3(centre.x * k * 3 + offset, centre.y * k * 3, centre.z * k * 3 - offset),
    );
    if (vein > width) continue;
    for (const v of [a, b, c]) {
      v.addScaledVector(v.clone().normalize(), lift);
      out.push(v.x, v.y, v.z);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(out, 3));
  return geometry;
}
