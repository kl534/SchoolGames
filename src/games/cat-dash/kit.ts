/**
 * Shared building blocks for the props and the scenery: small maths helpers, `Kit`, which builds
 * meshes and remembers what to dispose, and the `Prop` an obstacle is drawn with.
 */
import type { Outcome, Variant } from './rules';
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Mesh,
  SRGBColorSpace,
  type Group,
  type Material,
  type Object3D,
  RepeatWrapping,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GRAIN_SIZE, paintGrain, type GrainKind } from './textures';

/** How big one painted grain texture is on a prop, in units. */
const GRAIN_UNITS = 1.5;
/** Boxes thinner than this stay plain boxes; thicker ones get rounded edges. */
export const BEVEL_MIN = 0.1;
/**
 * Boxes thinner than this round their edges with one segment, not two: the bevel is a couple of
 * pixels wide there, so the second segment can't be seen but almost triples the triangles (a shelf
 * of books is most of the library's triangles).
 */
export const BEVEL_FINE = 0.3;

/**
 * Parts smaller than this across (in world units) cast no real shadow: in the shadow map they are
 * a texel or two, a speck nobody sees, but each would still cost a draw call every frame.
 */
export const SHADOW_MIN = 0.1;

const scratch = new Vector3();

/**
 * Sets `castShadow` on every mesh under `root`: solid ones (not see-through, not unlit) that are at
 * least `SHADOW_MIN` across. Call it once the parts are in place.
 */
export function castShadows(root: Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as Material;
    const solid = !m.transparent && !(m instanceof MeshBasicMaterial);
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const radius = mesh.geometry.boundingSphere?.radius ?? 0;
    mesh.getWorldScale(scratch);
    const across =
      2 * radius * Math.max(Math.abs(scratch.x), Math.abs(scratch.y), Math.abs(scratch.z));
    mesh.castShadow = solid && across >= SHADOW_MIN;
  });
}

/** Surface look of each grain: roughness and metalness of its material. */
const GRAIN_LOOK: Record<GrainKind, { roughness: number; metalness: number }> = {
  wood: { roughness: 0.6, metalness: 0 },
  fabric: { roughness: 0.95, metalness: 0 },
  foliage: { roughness: 0.85, metalness: 0 },
  metal: { roughness: 0.35, metalness: 0.6 },
  stone: { roughness: 0.9, metalness: 0 },
};

/** Scales a box's UVs to its size (one texture per `GRAIN_UNITS`), face by face. */
function scaleBoxUvs(g: BufferGeometry, w: number, h: number, d: number): void {
  const uv = g.getAttribute('uv');
  const n = g.getAttribute('normal');
  if (!uv || !n) return;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    // The face's two edge lengths: a +-x face is d by h, a +-y face w by d, a +-z face w by h.
    const [a, b] = ax >= ay && ax >= az ? [d, h] : ay >= az ? [w, d] : [w, h];
    uv.setXY(i, (uv.getX(i) * a) / GRAIN_UNITS, (uv.getY(i) * b) / GRAIN_UNITS);
  }
  uv.needsUpdate = true;
}

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const smooth = (u: number) => {
  const c = clamp01(u);
  return c * c * (3 - 2 * c);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** An obstacle as meshes, posed at the same time `t` as the cat's move. */
export interface Prop {
  /** Its origin is the entry line on the floor. */
  object: Group;
  /**
   * Poses the prop at second `t` of a move; with `outcome` null it is the idle motion before the
   * answer (the mop swings, the door opens) and `t` is the clock.
   */
  update(outcome: Outcome | null, variant: Variant, t: number): void;
  /** Puts everything back as it was before the ride. */
  reset(): void;
  dispose(): void;
}

/** Builds meshes and remembers what to dispose. */
export class Kit {
  readonly geometries: BufferGeometry[] = [];
  readonly materials: Material[] = [];
  readonly textures: CanvasTexture[] = [];
  private cache = new Map<string, MeshStandardMaterial>();
  private boxes = new Map<string, BufferGeometry>();
  private grains = new Map<GrainKind, CanvasTexture | null>();

  lit(color: number, roughness = 0.65): MeshStandardMaterial {
    const key = `${color}|${roughness}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new MeshStandardMaterial({ color, roughness });
      this.cache.set(key, m);
      this.materials.push(m);
    }
    return m;
  }

  basic(color: number, opacity = 1): MeshBasicMaterial {
    const m = new MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    this.materials.push(m);
    return m;
  }

  glass(color: number, opacity: number): MeshStandardMaterial {
    const m = new MeshStandardMaterial({
      color,
      roughness: 0.2,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    this.materials.push(m);
    return m;
  }

  mesh(geometry: BufferGeometry, material: Material, parent: Object3D, x = 0, y = 0, z = 0): Mesh {
    this.geometries.push(geometry);
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  /** A box; bevelled when it is at least `BEVEL_MIN` thick, else crisp. Equal sizes share a geometry. */
  box(
    w: number,
    h: number,
    d: number,
    material: Material,
    parent: Object3D,
    x = 0,
    y = 0,
    z = 0,
  ): Mesh {
    const key = `${w}|${h}|${d}`;
    let geometry = this.boxes.get(key);
    if (!geometry) {
      const least = Math.min(w, h, d);
      geometry =
        least >= BEVEL_MIN
          ? new RoundedBoxGeometry(
              w,
              h,
              d,
              least < BEVEL_FINE ? 1 : 2,
              Math.min(0.08, 0.18 * least),
            )
          : new BoxGeometry(w, h, d);
      scaleBoxUvs(geometry, w, h, d);
      this.boxes.set(key, geometry);
      this.geometries.push(geometry);
    }
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  private grain(kind: GrainKind, color: number): MeshStandardMaterial {
    const key = `${kind}|${color}`;
    let m = this.cache.get(key);
    if (m) return m;
    let map = this.grains.get(kind);
    if (map === undefined) {
      map = this.paint(GRAIN_SIZE, GRAIN_SIZE, (g) => paintGrain(g, kind));
      if (map) map.wrapS = map.wrapT = RepeatWrapping;
      this.grains.set(kind, map);
    }
    const look = GRAIN_LOOK[kind];
    m = new MeshStandardMaterial({ color, map, ...look });
    this.cache.set(key, m);
    this.materials.push(m);
    return m;
  }

  /** Wood grain in `color`. */
  wood(color: number): MeshStandardMaterial {
    return this.grain('wood', color);
  }
  /** A fine cloth weave. */
  fabric(color: number): MeshStandardMaterial {
    return this.grain('fabric', color);
  }
  /** Leaf blobs, lighter on top. */
  foliage(color: number): MeshStandardMaterial {
    return this.grain('foliage', color);
  }
  /** Brushed metal. */
  metal(color: number): MeshStandardMaterial {
    return this.grain('metal', color);
  }
  /** Mottled stone. */
  stone(color: number): MeshStandardMaterial {
    return this.grain('stone', color);
  }

  /** A canvas painting as a texture, or null where there is no 2D canvas. */
  paint(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    if (!g) return null;
    draw(g);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    this.textures.push(texture);
    return texture;
  }

  dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
