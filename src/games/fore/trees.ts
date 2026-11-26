import {
  BufferGeometry,
  CircleGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RGBAFormat,
  ShaderChunk,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { seededRandom } from '../../shared/random';
import { FALLBACK_LOOK, type Look } from './ground';
import { swayMaterial } from './grass';
import type { Species } from './scenery';
import {
  BUSH_BOUNDS,
  cardAxes,
  growBush,
  growTree,
  TREE_BOUNDS,
  type Card,
  type Segment,
} from './trees-grow';

export const CROWN_COLOURS: Record<Species, number> = {
  pine: 0x2c6b3c,
  oak: 0x3f8a3f,
  birch: 0x78b84f,
};
/** Birch crowns are narrow: the crown radius asked for is scaled by this. */
const WIDTH: Record<Species, number> = { pine: 1, oak: 1, birch: 0.6 };
/** The leaf picture's colour is multiplied by this (white keeps the photo as it is). */
const LEAF_TINT: Record<Species, number> = { pine: 0xd9ead5, oak: 0xe9f5d2, birch: 0xf6ffc4 };
/** Trunk and branch colour when the bark picture is missing, and the birch's tint with it. */
const BARK_PLAIN: Record<Species, number> = { pine: 0x5a3d24, oak: 0x6b4a2b, birch: 0xd8d4c8 };
const BARK_TINT: Record<Species, number> = { pine: 0xd8c8b8, oak: 0xffffff, birch: 0xdcd6c8 };
/** Yards of trunk one bark tile covers. */
const BARK_TILE = 1.6;
const VARIANTS = 3;
const LEAF_SWAY = 0.04;

export interface TreeBounds {
  /** Tallest point of the tree at scale 1, yards. */
  height: number;
  /** Widest reach of the crown from the trunk, yards. */
  radius: number;
}

/** The size of a species' tree at scale 1. */
export function treeBounds(species: Species): TreeBounds {
  return TREE_BOUNDS[species];
}

/** The scale a tree of this species gets to stand `height` tall with a crown of radius `r`. */
export function treeScale(species: Species, r: number, height: number): { sx: number; sy: number } {
  const b = treeBounds(species);
  return { sx: (r * WIDTH[species]) / b.radius, sy: height / b.height };
}

/** A species, or the low leafy ball a bush is. */
export type Kind = Species | 'bush';

export interface TreePlacement {
  x: number;
  /** Ground height under the trunk (default 0). */
  y?: number;
  z: number;
  species: Kind;
  /** Crown radius and total height, yards. */
  r: number;
  height: number;
  yaw: number;
  /** Draw a soft dark blob on the ground (default true). */
  blob?: boolean;
}

export interface TreeLayer {
  object: Group;
  /** Moves the leaves in the wind; `t` in seconds. */
  update(t: number): void;
  dispose(): void;
}

/** A repeatable 0..1 from a position, to vary the shade of each tree without a generator. */
const hash01 = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// ---------- Geometry ----------

/** Trunk and branches as tapered cylinders (7 sides, 4 on the thin twigs) in one geometry. */
export function barkGeometry(segments: readonly Segment[]): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const axis = new Vector3();
  const u = new Vector3();
  const v = new Vector3();
  for (const s of segments) {
    a.set(...s.from);
    b.set(...s.to);
    axis.subVectors(b, a);
    const length = axis.length();
    if (length < 1e-6) continue;
    axis.divideScalar(length);
    u.set(Math.abs(axis.y) > 0.9 ? 1 : 0, Math.abs(axis.y) > 0.9 ? 0 : 1, 0)
      .cross(axis)
      .normalize();
    v.crossVectors(axis, u);
    const sides = s.r0 > 0.15 ? 7 : 4;
    const around = Math.max(1, Math.round((Math.PI * 2 * s.r0) / BARK_TILE));
    const along = length / BARK_TILE;
    const ring = (j: number, r: number, at: Vector3) => {
      const t = (j / sides) * Math.PI * 2;
      const nx = u.x * Math.cos(t) + v.x * Math.sin(t);
      const ny = u.y * Math.cos(t) + v.y * Math.sin(t);
      const nz = u.z * Math.cos(t) + v.z * Math.sin(t);
      return { p: [at.x + nx * r, at.y + ny * r, at.z + nz * r], n: [nx, ny, nz] };
    };
    for (let j = 0; j < sides; j++) {
      const lo0 = ring(j, s.r0, a);
      const lo1 = ring(j + 1, s.r0, a);
      const hi0 = ring(j, s.r1, b);
      const hi1 = ring(j + 1, s.r1, b);
      const u0 = (j / sides) * around;
      const u1 = ((j + 1) / sides) * around;
      for (const [q, uu, vv] of [
        [lo0, u0, 0],
        [hi0, u0, along],
        [lo1, u1, 0],
        [lo1, u1, 0],
        [hi0, u0, along],
        [hi1, u1, along],
      ] as const) {
        positions.push(...q.p);
        normals.push(...q.n);
        uvs.push(uu, vv);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return g;
}

/**
 * Leaf cards as quads in one geometry. Each card's four normals are its crown-outward normal (soft,
 * rounded light); the colour is a darker underside and inside with a little scatter.
 */
export function leafGeometry(
  cards: readonly Card[],
  shade: (card: Card) => number,
  seed = 1,
): BufferGeometry {
  const rand = seededRandom(seed);
  const positions = new Float32Array(cards.length * 12);
  const normals = new Float32Array(cards.length * 12);
  const uvs = new Float32Array(cards.length * 8);
  const colours = new Float32Array(cards.length * 12);
  const index = new Uint16Array(cards.length * 6);
  cards.forEach((c, i) => {
    const { right, up } = cardAxes(c);
    const h = c.size / 2;
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const col = c.tile % 2;
    const row = Math.floor(c.tile / 2);
    const k = Math.min(Math.max(shade(c) * (0.92 + 0.16 * rand()), 0), 1.2);
    corners.forEach(([sx, sy], j) => {
      const o = (i * 4 + j) * 3;
      for (let d = 0; d < 3; d++) {
        positions[o + d] = c.at[d] + right[d] * sx * h + up[d] * sy * h;
        normals[o + d] = c.normal[d];
        colours[o + d] = k;
      }
      uvs[(i * 4 + j) * 2] = col * 0.5 + (sx + 1) * 0.25;
      uvs[(i * 4 + j) * 2 + 1] = 0.5 * (1 - row) + (sy + 1) * 0.25;
    });
    index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new Float32BufferAttribute(colours, 3));
  // Cards per tree are far below 16 bits' worth (65536 / 4 vertices).
  g.setIndex(new Uint16BufferAttribute(index, 1));
  return g;
}

/** Lighter at the top and out at the edge, darker low and deep inside the crown. */
const crownShade = (species: Species) => (c: Card) => {
  const { height, radius } = TREE_BOUNDS[species];
  const up = Math.min(Math.max(c.at[1] / height, 0), 1);
  const out = Math.min(Math.hypot(c.at[0], c.at[2]) / radius, 1);
  const lit = species === 'pine' ? 0.5 + 0.5 * up : 0.45 + 0.3 * up + 0.35 * out;
  return Math.min(lit, 1.05);
};
const bushShade = (c: Card) => {
  const up = Math.min(Math.max(c.at[1] / BUSH_BOUNDS.height, 0), 1);
  return 0.55 + 0.45 * up;
};

/** A soft round blob of leaves: the stand-in for a leaf picture that did not load. */
function blobTexture(): DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const rand = seededRandom(3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
      const ragged = 0.78 + 0.2 * rand();
      const o = (y * size + x) * 4;
      const k = 0.8 + 0.2 * rand();
      data[o] = data[o + 1] = data[o + 2] = Math.round(255 * k);
      data[o + 3] = d < ragged ? 255 : 0;
    }
  }
  const t = new DataTexture(data, size, size, RGBAFormat);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// ---------- The layer ----------

/**
 * Draws the trees as instances: for each species three seeded variants, each one InstancedMesh of
 * bark (trunk and branches) and one of leaf cards; bushes are one mesh of leaf cards. They cast and
 * receive real shadows where the tier has them, else blob decals. A crown's colour varies by +-8%.
 */
export function buildTreeLayer(
  list: readonly TreePlacement[],
  look: Look = FALLBACK_LOOK,
): TreeLayer {
  const object = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const ownTextures: Texture[] = [];
  const dummy = new Object3D();
  const time = { value: 0 };
  const trees = look.assets.trees;
  const msaa = look.settings.msaa > 0;
  const fallbackLeaf = trees ? null : blobTexture();
  if (fallbackLeaf) ownTextures.push(fallbackLeaf);

  const leafMaterial = (species: Species) => {
    const map = trees ? (species === 'pine' ? trees.pine : trees.oak) : fallbackLeaf;
    const m = new MeshStandardMaterial({
      map,
      color: trees ? LEAF_TINT[species] : CROWN_COLOURS[species],
      vertexColors: true,
      alphaTest: 0.5,
      alphaToCoverage: msaa,
      side: DoubleSide,
      roughness: 0.8,
      metalness: 0,
    });
    // A card is lit by its crown-outward normal from both sides: do not flip it on the back face.
    const fix = (shader: WebGLProgramParametersWithUniforms) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''),
      );
    };
    m.onBeforeCompile = fix;
    m.customProgramCacheKey = () => 'fore-leaf';
    if (look.settings.post || look.settings.shadows !== 'none') {
      swayMaterial(
        m,
        time,
        `float leafWave = uTime * ${(Math.PI * 0.8).toFixed(3)} + swayPhase;
         transformed += vec3(sin(leafWave), 0.3 * sin(leafWave * 1.3 + 1.0), cos(leafWave * 0.9)) * ${LEAF_SWAY};`,
        'leaf',
      );
    }
    materials.push(m);
    return m;
  };
  const barkMaterial = (species: Species) => {
    const bark = trees;
    const m = new MeshStandardMaterial({
      map: bark?.barkColor ?? null,
      normalMap: bark?.barkNormal ?? null,
      color: bark ? BARK_TINT[species] : BARK_PLAIN[species],
      roughness: 0.95,
    });
    materials.push(m);
    return m;
  };

  const place = (
    mesh: InstancedMesh,
    mine: readonly TreePlacement[],
    size: (t: TreePlacement) => { sx: number; sy: number },
    tintOf: (t: TreePlacement) => number,
    withColour: boolean,
  ) => {
    const tint = new Color();
    mine.forEach((t, i) => {
      const { sx, sy } = size(t);
      dummy.position.set(t.x, t.y ?? 0, t.z);
      dummy.rotation.set(0, t.yaw, 0);
      dummy.scale.set(sx, sy, sx);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (withColour) {
        const k = tintOf(t);
        mesh.setColorAt(i, tint.setRGB(k, k, k));
      }
    });
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = look.shadows;
    object.add(mesh);
  };
  const variantOf = (t: TreePlacement) => Math.floor(hash01(t.z, t.x) * VARIANTS) % VARIANTS;
  const tintOf = (t: TreePlacement) => 0.92 + 0.16 * hash01(t.x, t.z);

  for (const species of Object.keys(TREE_BOUNDS) as Species[]) {
    const ofSpecies = list.filter((t) => t.species === species);
    if (ofSpecies.length === 0) continue;
    const cards = Math.round(look.settings.treeLeafCards * (species === 'pine' ? 0.6 : 1));
    const bark = barkMaterial(species);
    const leaves = leafMaterial(species);
    for (let variant = 0; variant < VARIANTS; variant++) {
      const mine = ofSpecies.filter((t) => variantOf(t) === variant);
      if (mine.length === 0) continue;
      const shape = growTree(species, variant as 0 | 1 | 2, cards);
      const trunkGeometry = barkGeometry(shape.segments);
      const crownGeometry = leafGeometry(shape.cards, crownShade(species), variant + 1);
      geometries.push(trunkGeometry, crownGeometry);
      const size = (t: TreePlacement) => treeScale(species, t.r, t.height);
      place(new InstancedMesh(trunkGeometry, bark, mine.length), mine, size, tintOf, false);
      place(new InstancedMesh(crownGeometry, leaves, mine.length), mine, size, tintOf, true);
    }
  }

  const bushes = list.filter((t) => t.species === 'bush');
  if (bushes.length > 0) {
    const cards = Math.max(14, Math.round(look.settings.treeLeafCards * 0.12));
    const geometry = leafGeometry(growBush(cards), bushShade, 9);
    geometries.push(geometry);
    place(
      new InstancedMesh(geometry, leafMaterial('oak'), bushes.length),
      bushes,
      (t) => ({ sx: t.r / BUSH_BOUNDS.radius, sy: (t.r / BUSH_BOUNDS.radius) * 0.6 }),
      tintOf,
      true,
    );
  }

  // Blob shadows: the sun is high in the north-east, so they lean towards -x and +z.
  const blobs = look.shadows ? [] : list.filter((t) => t.blob !== false && t.species !== 'bush');
  if (blobs.length > 0) {
    const geometry = new CircleGeometry(1, 14).rotateX(-Math.PI / 2);
    const material = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    geometries.push(geometry);
    materials.push(material);
    const mesh = new InstancedMesh(geometry, material, blobs.length);
    blobs.forEach((t, i) => {
      dummy.position.set(t.x - t.height * 0.2, (t.y ?? 0) + 0.05, t.z + t.height * 0.17);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(t.r * 1.15, 1, t.r * 1.0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.frustumCulled = false;
    object.add(mesh);
  }

  return {
    object,
    update: (t) => (time.value = t),
    dispose() {
      object.children.forEach((c) => (c as InstancedMesh).dispose?.());
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      ownTextures.forEach((t) => t.dispose());
      object.removeFromParent();
    },
  };
}
