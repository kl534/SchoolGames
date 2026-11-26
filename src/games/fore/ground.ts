/**
 * The ground's textures and flat geometry helpers. Textures are drawn once per page load into
 * `DataTexture`s (no canvas, so they also build in tests) and shared by every hole.
 */
import {
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  Vector3,
  Vector4,
  type Material,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { CSM } from 'three/addons/csm/CSM.js';
import { seededRandom } from '../../shared/random';
import { NO_ASSETS, type ForeAssets } from './assets';
import { centreX, type Ellipse, type Hole } from './course';
import { GFX_SETTINGS, type GfxSettings } from './quality';
import { moundY } from './terrain';

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
 * every 5 yd. u is the lateral yards over `tileU` and v the distance down the hole over `tileV`
 * (12 and 8 for the old stripe texture).
 */
export function ribbon(h: Hole, latA: number, latB: number, tileU = 12, tileV = 8): BufferGeometry {
  const zs: number[] = [];
  for (let z = 0; z < h.length; z += 5) zs.push(z);
  zs.push(h.length);
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  zs.forEach((z, i) => {
    const c = centreX(h, z);
    positions.push(c + latA, 0, z, c + latB, 0, z);
    uvs.push((latA + 18) / tileU, z / tileV, (latB + 18) / tileU, z / tileV);
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

// ---------- Looks, lit materials and turf ----------

/** Everything a hole needs to dress itself for this device. */
export interface Look {
  settings: GfxSettings;
  /** What loaded; `NO_ASSETS` falls back to the plain procedural look. */
  assets: ForeAssets;
  /** The cascaded shadow map, on the high tier. */
  csm: CSM | null;
  /** Unit vector from the scene towards the sun. */
  sun: Vector3;
  /** Whether shadows are cast and received (any tier but low, and not `?shadows=off`). */
  shadows: boolean;
}

/** The look of a Node run with no assets and no shadows (tests, and the low tier's fallback). */
export const FALLBACK_LOOK: Look = {
  settings: GFX_SETTINGS.low,
  assets: NO_ASSETS,
  csm: null,
  sun: new Vector3(-0.45, 0.62, -0.64).normalize(),
  shadows: false,
};

const isLit = (m: Material) =>
  (m as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial ||
  (m as { isMeshLambertMaterial?: boolean }).isMeshLambertMaterial ||
  (m as { isMeshPhongMaterial?: boolean }).isMeshPhongMaterial;

/**
 * Makes `m` take the cascaded shadow map's light. CSM replaces `onBeforeCompile`, so a hook the
 * material already had runs after it. Materials the CSM already knows are left alone.
 */
export function litMaterial<T extends Material>(csm: CSM | null, m: T): T {
  if (!csm || csm.shaders.has(m) || !isLit(m)) return m;
  const own = m.onBeforeCompile;
  csm.setupMaterial(m);
  m.needsUpdate = true;
  const hook = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    hook.call(m, shader, renderer);
    own.call(m, shader, renderer);
  };
  return m;
}

/** Runs `litMaterial` over every material under `root`. */
export function litTree(csm: CSM | null, root: Object3D): void {
  if (!csm) return;
  root.traverse((o) => {
    const material = (o as { material?: Material | Material[] }).material;
    if (!material) return;
    (Array.isArray(material) ? material : [material]).forEach((m) => litMaterial(csm, m));
  });
}

/** Forgets a material the CSM was given (call before disposing it). */
export function unlitMaterial(csm: CSM | null, m: Material): void {
  csm?.shaders.delete(m);
}

export type TurfKind = 'rough' | 'fairway' | 'fringe' | 'green' | 'tee';

interface TurfSpec {
  colour: number;
  roughness: number;
  normal: number;
  /** One tile of the grass picture, yards. */
  tile: number;
}
const TURF: Record<TurfKind, TurfSpec> = {
  rough: { colour: 0x5d7f3c, roughness: 0.95, normal: 1.0, tile: 3 },
  fairway: { colour: 0x86b153, roughness: 0.85, normal: 0.6, tile: 2.5 },
  fringe: { colour: 0x7aa84c, roughness: 0.85, normal: 0.5, tile: 2.5 },
  green: { colour: 0x76b04a, roughness: 0.7, normal: 0.3, tile: 1.2 },
  tee: { colour: 0x80ad50, roughness: 0.85, normal: 0.5, tile: 2.5 },
};
const KIND_INDEX: Record<TurfKind, number> = { rough: 0, fairway: 1, fringe: 2, green: 3, tee: 4 };
/** The grass picture is evened to 0.92 of white, so the turf is brightened back. */
const TURF_GAIN = 1.2;

/** Yards one tile of this turf covers (what UVs should be scaled to): the plain look uses 8. */
export function turfTile(look: Look, kind: TurfKind): number {
  return look.assets.grass ? TURF[kind].tile : 8;
}

const TURF_VERTEX = `
varying vec3 vTurfW;
`;
const TURF_FRAGMENT = `
varying vec3 vTurfW;
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x),
             mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float tPar(float v) { return mod(floor(v), 2.0); }
float turfShade() {
  vec2 w = vTurfW.xz;
  float macro = (tNoise(w / 35.0) - 0.5) * 0.6 + (tNoise(w / 9.0) - 0.5) * 0.4;
  float k = 1.0 + 0.18 * macro;
  #if TURF_KIND == 1
    k *= mix(1.08, 0.9, tPar(w.y / 6.0));
  #elif TURF_KIND == 3
    float a = tPar((w.x + w.y) * 0.70711 / 3.0);
    float b = tPar((w.x - w.y) * 0.70711 / 3.0);
    k *= mix(0.94, 1.05, (a + b) * 0.5);
  #elif TURF_KIND == 4
    k *= mix(1.06, 0.94, tPar(w.y / 2.0));
  #endif
  return k * ${TURF_GAIN.toFixed(2)};
}
`;

/** How far past a hazard's edge the flat layers (and the rough) are cut away. */
export const CUT_OUT = { sand: 0.6, water: 1.4 } as const;

/** The ellipses a hole's flat layers must leave open: its bunkers and ponds, a little larger. */
export function hazardCuts(h: Hole): Ellipse[] {
  return h.hazards.map((hz) => inflated(hz.at, CUT_OUT[hz.kind]));
}

/**
 * Makes `material` leave the given ellipses open (a bunker or pond sunk below the layer shows
 * through). The hook runs after any hook the material already has.
 */
export function cutOut<T extends Material>(material: T, cuts: readonly Ellipse[]): T {
  if (cuts.length === 0) return material;
  const own = material.onBeforeCompile;
  const list = cuts.map((c) => new Vector4(c.x, c.z, c.rx, c.rz));
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}-cut${list.length}`;
  material.onBeforeCompile = (shader, renderer) => {
    own.call(material, shader, renderer);
    shader.uniforms.uCuts = { value: list };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vCutW;\nvoid main() {')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `varying vec3 vCutW;\nuniform vec4 uCuts[${list.length}];\nvoid main() {\n  for (int i = 0; i < ${list.length}; i++) {\n    vec2 d = (vCutW.xz - uCuts[i].xy) / uCuts[i].zw;\n    if (dot(d, d) < 1.0) discard;\n  }`,
    );
  };
  return material;
}

/**
 * The grass for one part of the course: the photo's colour, normal and roughness maps tinted to
 * the kind's colour, with macro noise from world position (so tiling never shows) and the mown
 * stripes. Without the picture it is the old noise texture with the same colours. `cuts` are
 * left open (a layer over a bunker or pond).
 */
export function turfMaterial(
  look: Look,
  kind: TurfKind,
  cuts: readonly Ellipse[] = [],
): MeshStandardMaterial {
  const spec = TURF[kind];
  const grass = look.assets.grass;
  const plain = groundTextures();
  const material = new MeshStandardMaterial({
    color: new Color(grass || kind !== 'fairway' ? spec.colour : 0xffffff),
    roughness: spec.roughness,
    map: grass
      ? grass.color
      : kind === 'fairway'
        ? plain.fairway
        : kind === 'green'
          ? plain.green
          : plain.grass,
    normalMap: grass ? grass.normal : null,
    roughnessMap: grass ? grass.rough : null,
    metalness: 0,
  });
  material.normalScale = new Vector2(spec.normal, spec.normal);
  material.customProgramCacheKey = () => `turf-${kind}-${grass ? 'photo' : 'plain'}`;
  if (grass) {
    material.defines = { TURF_KIND: KIND_INDEX[kind] };
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `${TURF_VERTEX}void main() {`)
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\n  vTurfW = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `${TURF_FRAGMENT}void main() {`)
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\n  diffuseColor.rgb *= turfShade();',
        );
    };
  }
  return cutOut(material, cuts);
}

/** The sand: the photo's maps tinted `0xe3d2a6`, or the old grain texture. */
export function sandMaterial(look: Look): MeshStandardMaterial {
  const sand = look.assets.sand;
  return new MeshStandardMaterial({
    color: 0xe3d2a6,
    roughness: 0.9,
    map: sand ? sand.color : groundTextures().sand,
    normalMap: sand?.normal ?? null,
    roughnessMap: sand?.rough ?? null,
    metalness: 0,
  });
}

/** Yards one tile of the sand covers. */
export const SAND_TILE = 2;

// ---------- Rough, dishes and banks ----------

const inflated = (e: Ellipse, by: number): Ellipse => ({ ...e, rx: e.rx + by, rz: e.rz + by });

/**
 * The rough: one grid under everything out to the foot of the hills, 4 yd cells within 130 yd of
 * the line and 12 yd beyond, heights from the mounds, smooth normals, UV in tiles of `tile` yards.
 * The grid is cut away where a bunker or pond goes (vertices snap to the cut's edge, whole
 * triangles inside drop out), so the dish and the bank can sit below grade.
 */
export function roughGeometry(h: Hole, tile: number): BufferGeometry {
  const axis = (from: number, to: number, nearFrom: number, nearTo: number) => {
    const out: number[] = [];
    for (let v = from; v < nearFrom; v += 12) out.push(v);
    for (let v = nearFrom; v < nearTo; v += 4) out.push(v);
    for (let v = nearTo; v < to; v += 12) out.push(v);
    out.push(to);
    return out;
  };
  const xs = axis(-500, 500, -148, 148);
  const zs = axis(-300, h.length + 500, -130, h.length + 130);
  const cuts = h.hazards.map((hz) => inflated(hz.at, CUT_OUT[hz.kind]));
  const nx = xs.length;
  const positions = new Float32Array(nx * zs.length * 3);
  const normals = new Float32Array(nx * zs.length * 3);
  const uvs = new Float32Array(nx * zs.length * 2);
  const inside = new Uint8Array(nx * zs.length);
  const EPS = 0.5;
  zs.forEach((z, j) => {
    xs.forEach((x, i) => {
      const k = j * nx + i;
      let px = x;
      let pz = z;
      let py = moundY(h, x, z);
      for (const c of cuts) {
        const q = Math.hypot((px - c.x) / c.rx, (pz - c.z) / c.rz);
        if (q < 1) {
          inside[k] = 1;
          px = c.x + (px - c.x) / Math.max(q, 1e-6);
          pz = c.z + (pz - c.z) / Math.max(q, 1e-6);
          py = 0;
          break;
        }
      }
      positions.set([px, py, pz], k * 3);
      uvs.set([px / tile, pz / tile], k * 2);
      const dx = moundY(h, x + EPS, z) - moundY(h, x - EPS, z);
      const dz = moundY(h, x, z + EPS) - moundY(h, x, z - EPS);
      const n = new Vector3(-dx / (2 * EPS), 1, -dz / (2 * EPS)).normalize();
      normals.set([n.x, n.y, n.z], k * 3);
    });
  });
  const index: number[] = [];
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      // Counter-clockwise seen from above (+y).
      if (!(inside[a] && inside[c] && inside[b])) index.push(a, c, b);
      if (!(inside[b] && inside[c] && inside[d])) index.push(b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return g;
}

/**
 * A ring around an ellipse made of a profile: each `[offset, y]` is a loop `offset` yards outside
 * its edge (negative is inside) at height `y`. UVs are world position over `tile`; normals smooth.
 */
export function profileRing(
  e: Ellipse,
  profile: readonly (readonly [number, number])[],
  tile: number,
  segments = 48,
): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (const [offset, y] of profile) {
      const x = e.x + (e.rx + offset) * c;
      const z = e.z + (e.rz + offset) * s;
      positions.push(x, y, z);
      uvs.push(x / tile, z / tile);
    }
  }
  const m = profile.length;
  for (let i = 0; i < segments; i++) {
    for (let k = 0; k < m - 1; k++) {
      const a = i * m + k;
      const b = a + m;
      // Counter-clockwise from above: round the ellipse first, then outwards.
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A bowl: a polar grid from the middle to the edge of the ellipse, heights from `height(x, z)`. */
export function dish(
  e: Ellipse,
  height: (x: number, z: number) => number,
  tile: number,
  around = 32,
  rings = 16,
): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const s = r / rings;
    for (let i = 0; i <= around; i++) {
      const a = (i / around) * Math.PI * 2;
      const x = e.x + e.rx * s * Math.cos(a);
      const z = e.z + e.rz * s * Math.sin(a);
      positions.push(x, height(x, z), z);
      uvs.push(x / tile, z / tile);
    }
  }
  const w = around + 1;
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < around; i++) {
      const a = r * w + i;
      const b = a + w;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
