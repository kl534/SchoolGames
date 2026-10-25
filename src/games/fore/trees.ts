import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from '../../shared/random';
import type { Species } from './scenery';

/** The parts of one tree kind: a trunk and a crown, each one merged, vertex-coloured geometry. */
interface Parts {
  trunk: BufferGeometry;
  crown: BufferGeometry;
}

export const CROWN_COLOURS: Record<Species, number> = {
  pine: 0x2c6b3c,
  oak: 0x3f8a3f,
  birch: 0x78b84f,
};
/** Birch crowns are narrow: the crown radius asked for is scaled by this. */
const WIDTH: Record<Species, number> = { pine: 1, oak: 1, birch: 0.6 };

/** Paints every vertex `colour` times `shade(y)` and strips the attributes that need no merging. */
function paint(g: BufferGeometry, colour: number, shade: (y: number) => number): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute('uv');
  const pos = out.getAttribute('position');
  const base = new Color(colour);
  const colours: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const s = shade(pos.getY(i));
    colours.push(base.r * s, base.g * s, base.b * s);
  }
  out.setAttribute('color', new Float32BufferAttribute(colours, 3));
  return out;
}

const merge = (list: BufferGeometry[]): BufferGeometry => {
  const merged = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  return merged;
};

/** A darker underside: 0.62 at the lowest vertex of the crown to 1 at the top. */
function underside(list: BufferGeometry[]): (y: number) => number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const g of list) {
    g.computeBoundingBox();
    lo = Math.min(lo, g.boundingBox!.min.y);
    hi = Math.max(hi, g.boundingBox!.max.y);
  }
  return (y) => 0.62 + 0.38 * Math.min(Math.max((y - lo) / (hi - lo), 0), 1);
}

function pineParts(): Parts {
  const rand = seededRandom(11);
  const trunk = new CylinderGeometry(0.15, 0.25, 3.4, 8).translate(0, 1.7, 0);
  const cones: BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const radius = 3.8 * 0.7 ** i;
    const height = 3.6 - i * 0.3;
    const cone = new ConeGeometry(radius, height, 9)
      .translate(0, height / 2, 0)
      .rotateX((rand() - 0.5) * 0.08)
      .rotateZ((rand() - 0.5) * 0.08)
      .translate((rand() - 0.5) * 0.2, 1.8 + i * 2, (rand() - 0.5) * 0.2);
    cones.push(cone);
  }
  const shade = underside(cones);
  return {
    trunk: merge([paint(trunk, 0x5a3d24, () => 1)]),
    crown: merge(cones.map((c) => paint(c, CROWN_COLOURS.pine, shade))),
  };
}

function oakParts(): Parts {
  const rand = seededRandom(22);
  const trunk = [
    new CylinderGeometry(0.22, 0.4, 5, 7).translate(0, 2.5, 0),
    new CylinderGeometry(0.1, 0.18, 2.6, 6).translate(0, 1.3, 0).rotateZ(0.5).translate(0, 4.4, 0),
    new CylinderGeometry(0.1, 0.18, 2.6, 6)
      .translate(0, 1.3, 0)
      .rotateZ(-0.45)
      .rotateY(1.6)
      .translate(0, 4.2, 0),
  ];
  const blobs: BufferGeometry[] = [new IcosahedronGeometry(3.4, 1).translate(0, 8.6, 0)];
  const n = 5 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.5;
    const r = 2.4 + rand() * 0.3;
    blobs.push(
      new IcosahedronGeometry(r, 1).translate(
        Math.cos(a) * 2.1,
        6.8 + rand() * 1.4,
        Math.sin(a) * 2.1,
      ),
    );
  }
  const shade = underside(blobs);
  return {
    trunk: merge(trunk.map((g) => paint(g, 0x6b4a2b, () => 1))),
    crown: merge(blobs.map((g) => paint(g, CROWN_COLOURS.oak, shade))),
  };
}

function birchParts(): Parts {
  const rand = seededRandom(33);
  const trunk: BufferGeometry[] = [
    paint(new CylinderGeometry(0.09, 0.14, 7.5, 6).translate(0, 3.75, 0), 0xeeeee6, () => 1),
  ];
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const mark = new BoxGeometry(0.1, 0.09, 0.03)
      .rotateY(-a)
      .translate(Math.cos(a) * 0.12, 0.8 + i * 0.7, Math.sin(a) * 0.12);
    trunk.push(paint(mark, 0x2a2a2a, () => 1));
  }
  const blobs: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    blobs.push(
      new IcosahedronGeometry(1.7 - i * 0.12, 1).translate(
        (rand() - 0.5) * 0.6,
        6 + i * 1.6,
        (rand() - 0.5) * 0.6,
      ),
    );
  }
  const shade = underside(blobs);
  return {
    trunk: merge(trunk),
    crown: merge(blobs.map((g) => paint(g, CROWN_COLOURS.birch, shade))),
  };
}

const PARTS: Record<Species, () => Parts> = {
  pine: pineParts,
  oak: oakParts,
  birch: birchParts,
};

export interface TreeBounds {
  /** Tallest point of the tree at scale 1, yards. */
  height: number;
  /** Widest reach of the crown from the trunk, yards. */
  radius: number;
}

const bounds = new Map<Species, TreeBounds>();

/** The size of a species' tree at scale 1. */
export function treeBounds(species: Species): TreeBounds {
  let b = bounds.get(species);
  if (!b) {
    const { trunk, crown } = PARTS[species]();
    crown.computeBoundingBox();
    trunk.computeBoundingBox();
    const pos = crown.getAttribute('position');
    let radius = 0;
    for (let i = 0; i < pos.count; i++)
      radius = Math.max(radius, Math.hypot(pos.getX(i), pos.getZ(i)));
    b = { height: Math.max(crown.boundingBox!.max.y, trunk.boundingBox!.max.y), radius };
    bounds.set(species, b);
    trunk.dispose();
    crown.dispose();
  }
  return b;
}

/** The scale a tree of this species gets to stand `height` tall with a crown of radius `r`. */
export function treeScale(species: Species, r: number, height: number): { sx: number; sy: number } {
  const b = treeBounds(species);
  return { sx: (r * WIDTH[species]) / b.radius, sy: height / b.height };
}

export interface TreePlacement {
  x: number;
  /** Ground height under the trunk (default 0). */
  y?: number;
  z: number;
  species: Species;
  /** Crown radius and total height, yards. */
  r: number;
  height: number;
  yaw: number;
  /** Draw a soft dark blob on the ground (default true). */
  blob?: boolean;
}

export interface TreeLayer {
  object: Group;
  dispose(): void;
}

/** A repeatable 0..1 from a position, to vary the shade of each tree without a generator. */
const hash01 = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Draws the trees as instances, one trunk mesh and one crown mesh per species, plus one mesh of
 * blob shadows. A crown's colour varies by +-8% per tree.
 */
export function buildTreeLayer(list: readonly TreePlacement[]): TreeLayer {
  const object = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const dummy = new Object3D();
  const trunkMaterial = new MeshLambertMaterial({ vertexColors: true });
  const crownMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  materials.push(trunkMaterial, crownMaterial);

  for (const species of Object.keys(PARTS) as Species[]) {
    const mine = list.filter((t) => t.species === species);
    if (mine.length === 0) continue;
    const parts = PARTS[species]();
    geometries.push(parts.trunk, parts.crown);
    const trunk = new InstancedMesh(parts.trunk, trunkMaterial, mine.length);
    const crown = new InstancedMesh(parts.crown, crownMaterial, mine.length);
    const tint = new Color();
    mine.forEach((t, i) => {
      const { sx, sy } = treeScale(species, t.r, t.height);
      dummy.position.set(t.x, t.y ?? 0, t.z);
      dummy.rotation.set(0, t.yaw, 0);
      dummy.scale.set(sx, sy, sx);
      dummy.updateMatrix();
      trunk.setMatrixAt(i, dummy.matrix);
      crown.setMatrixAt(i, dummy.matrix);
      const k = 0.92 + 0.16 * hash01(t.x, t.z);
      crown.setColorAt(i, tint.setRGB(k, k, k));
    });
    for (const m of [trunk, crown]) {
      m.frustumCulled = false;
      object.add(m);
    }
  }

  // Blob shadows: the sun is high in the north-east, so they lean towards -x and +z.
  const blobs = list.filter((t) => t.blob !== false && !t.y);
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
      dummy.position.set(t.x - t.height * 0.2, 0.05, t.z + t.height * 0.17);
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
    dispose() {
      object.children.forEach((c) => (c as InstancedMesh).dispose?.());
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      object.removeFromParent();
    },
  };
}
