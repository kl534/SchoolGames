/**
 * The ground's textures and flat geometry helpers. Textures are drawn once per page load into
 * `DataTexture`s (no canvas, so they also build in tests) and shared by every hole.
 */
import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { seededRandom } from '../../shared/random';
import { centreX, type Ellipse, type Hole } from './course';

const SIZE = 256;

export interface GroundTextures {
  /** Grass noise, tinted by the material colour. One tile is 8 yd. */
  grass: DataTexture;
  /** Mown stripes: light then dark, 6 yd each, so one tile across is 12 yd. */
  fairway: DataTexture;
  /** Fine concentric mowing rings around the middle of a circle. */
  green: DataTexture;
  /** Sand grain. */
  sand: DataTexture;
}

/** Wrapping value noise on a `cells` x `cells` lattice, 0..1 at (u, v) in 0..1. */
function lattice(cells: number, seed: number): (u: number, v: number) => number {
  const rand = seededRandom(seed);
  const grid = Array.from({ length: cells * cells }, () => rand());
  const at = (i: number, j: number) => grid[(j % cells) * cells + (i % cells)];
  return (u, v) => {
    const x = u * cells;
    const y = v * cells;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/** Four octaves of tiling noise, 0..1. */
function fbm(seed: number): (u: number, v: number) => number {
  const octaves = [4, 8, 16, 32].map((n, i) => lattice(n, seed + i));
  return (u, v) => octaves.reduce((sum, f, i) => sum + f(u, v) * 0.5 ** (i + 1), 0) / 0.9375;
}

function texture(paint: (u: number, v: number, noise: number) => [number, number, number]) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const rand = seededRandom(99);
  const noise = fbm(7);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const n = noise(u, v);
      const [r, g, b] = paint(u, v, n);
      const grain = 0.94 + rand() * 0.06;
      const o = (y * SIZE + x) * 4;
      data[o] = Math.min(255, r * grain * 255);
      data[o + 1] = Math.min(255, g * grain * 255);
      data[o + 2] = Math.min(255, b * grain * 255);
      data[o + 3] = 255;
    }
  }
  const t = new DataTexture(data, SIZE, SIZE, RGBAFormat);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Three greens blended by noise, close to white so the material colour does the tinting. */
const grassTint = (n: number): [number, number, number] => {
  const mix = (a: number[], b: number[], k: number) => a.map((c, i) => c + (b[i] - c) * k);
  const dark = [0.86, 0.96, 0.84];
  const mid = [1, 1, 0.97];
  const warm = [0.96, 1, 0.8];
  const c = n < 0.5 ? mix(dark, mid, n * 2) : mix(mid, warm, (n - 0.5) * 2);
  return [c[0], c[1], c[2]];
};

let cache: GroundTextures | null = null;

/** The shared textures, drawn on first use. */
export function groundTextures(): GroundTextures {
  cache ??= {
    grass: texture((_u, _v, n) => grassTint(n)),
    fairway: texture((u, _v, n) => {
      const [r, g, b] = grassTint(n);
      const light = u < 0.5;
      // 0x7fc85e and 0x6fb853 relative to white: the colour is baked into the stripe.
      const base = light ? [0.5, 0.78, 0.37] : [0.435, 0.72, 0.325];
      return [r * base[0] * 1.2, g * base[1] * 1.2, b * base[2] * 1.2];
    }),
    green: texture((u, v, n) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const ring = 0.955 + 0.045 * Math.sin(d * 16 * Math.PI * 2);
      const k = ring * (0.97 + 0.03 * n);
      return [k, k, k];
    }),
    sand: texture((_u, _v, n) => {
      const k = 0.86 + 0.14 * n;
      return [k, k * 0.99, k * 0.95];
    }),
  };
  return cache;
}

/** Frees the textures' GPU copies; they upload again if a later hole uses them. */
export function disposeGroundTextures(): void {
  if (!cache) return;
  Object.values(cache).forEach((t: DataTexture) => t.dispose());
}

/** Scales a geometry's UVs, so one texture tile covers a chosen number of yards. */
export function scaleUV(g: BufferGeometry, su: number, sv: number): BufferGeometry {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return g;
}

/** Flips any triangle that faces down so the whole geometry faces up (+y). */
function faceUp(g: BufferGeometry): BufferGeometry {
  const pos = g.getAttribute('position');
  const index = g.index!;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const ux = pos.getX(b) - pos.getX(a);
    const uz = pos.getZ(b) - pos.getZ(a);
    const vx = pos.getX(c) - pos.getX(a);
    const vz = pos.getZ(c) - pos.getZ(a);
    // y of (u x v)
    if (uz * vx - ux * vz < 0) {
      index.setX(i + 1, c);
      index.setX(i + 2, b);
    }
  }
  const normals: number[] = [];
  for (let i = 0; i < pos.count; i++) normals.push(0, 1, 0);
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return g;
}

/**
 * The fairway as a ribbon along the bent centre line from `latA` to `latB` yards off it, a sample
 * every 5 yd. u is the lateral yards over 12 (so the stripe texture tiles every 12 yd), v the
 * distance down the hole over 8.
 */
export function ribbon(h: Hole, latA: number, latB: number): BufferGeometry {
  const zs: number[] = [];
  for (let z = 0; z < h.length; z += 5) zs.push(z);
  zs.push(h.length);
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  zs.forEach((z, i) => {
    const c = centreX(h, z);
    positions.push(c + latA, 0, z, c + latB, 0, z);
    uvs.push((latA + 18) / 12, z / 8, (latB + 18) / 12, z / 8);
    if (i > 0) {
      const a = (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return faceUp(g);
}

/**
 * A flat ring around an ellipse, from `inner` to `outer` yards outside its edge, going from height
 * `yInner` to `yOuter`. In world coordinates.
 */
export function ellipseRing(
  e: Ellipse,
  inner: number,
  outer: number,
  yInner: number,
  yOuter: number,
  segments = 40,
): BufferGeometry {
  const positions: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    positions.push(
      e.x + (e.rx + inner) * c,
      yInner,
      e.z + (e.rz + inner) * s,
      e.x + (e.rx + outer) * c,
      yOuter,
      e.z + (e.rz + outer) * s,
    );
    if (i > 0) {
      const k = (i - 1) * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  return faceUp(g);
}

/** A strip `width` yd wide along a run of points (the cart path). */
export function strip(points: { x: number; z: number }[], width: number): BufferGeometry {
  const positions: number[] = [];
  const index: number[] = [];
  points.forEach((p, i) => {
    const a = points[Math.max(i - 1, 0)];
    const b = points[Math.min(i + 1, points.length - 1)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = (-(b.z - a.z) / len) * (width / 2);
    const nz = ((b.x - a.x) / len) * (width / 2);
    positions.push(p.x - nx, 0, p.z - nz, p.x + nx, 0, p.z + nz);
    if (i > 0) {
      const k = (i - 1) * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  return faceUp(g);
}
