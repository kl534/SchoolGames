/**
 * Shared building blocks for the props of obstacles and Mega courses: small maths helpers and
 * `Kit`, which builds meshes and remembers what to dispose.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Mesh,
  SRGBColorSpace,
  type Group,
  type Material,
  type Object3D,
} from 'three';

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const smooth = (u: number) => {
  const c = clamp01(u);
  return c * c * (3 - 2 * c);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A stretch of road that is not there (a pool, a canyon), as x from and to. */
export type Cut = readonly [from: number, to: number];

/** What the game needs of anything it places on the road: an obstacle, a Mega course or a gate. */
export interface Placed {
  /** Its origin is the entry line on the road. */
  object: Group;
  /** x of its end, for retiring it once it is far behind the camera. */
  length: number;
  /** The stretches of road it replaces, in its own coordinates. */
  cuts: readonly Cut[];
  /** Idle motion. */
  ambient(time: number): void;
  /** Puts every prop back as it was before the ride. */
  reset(): void;
}

/**
 * A solid ribbon following a surface from x0 to x1, in flat-shaded segments that alternate
 * between two colours. The underside is `bottom` (a height, or a function of x).
 */
export function ribbon(
  surface: (x: number) => number,
  x0: number,
  x1: number,
  step: number,
  bottom: number | ((x: number) => number),
  halfZ: number,
  colorA: number,
  colorB: number,
  zCenter = 0,
): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const colA = [(colorA >> 16) / 255, ((colorA >> 8) & 255) / 255, (colorA & 255) / 255];
  const colB = [(colorB >> 16) / 255, ((colorB >> 8) & 255) / 255, (colorB & 255) / 255];
  const low = (x: number) => (typeof bottom === 'number' ? bottom : bottom(x));
  const quad = (p: number[][], c: number[]) => {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      positions.push(p[i][0], p[i][1], p[i][2]);
      colors.push(c[0], c[1], c[2]);
    }
  };
  const count = Math.max(1, Math.round((x1 - x0) / step));
  const z0 = zCenter - halfZ;
  const z1 = zCenter + halfZ;
  for (let i = 0; i < count; i++) {
    const xa = lerp(x0, x1, i / count);
    const xb = lerp(x0, x1, (i + 1) / count);
    const ya = surface(xa);
    const yb = surface(xb);
    const c = i % 2 === 0 ? colA : colB;
    quad(
      [
        [xa, ya, z0],
        [xb, yb, z0],
        [xb, yb, z1],
        [xa, ya, z1],
      ],
      c,
    );
    quad(
      [
        [xa, ya, z1],
        [xb, yb, z1],
        [xb, low(xb), z1],
        [xa, low(xa), z1],
      ],
      c,
    );
    quad(
      [
        [xa, ya, z0],
        [xb, yb, z0],
        [xb, low(xb), z0],
        [xa, low(xa), z0],
      ],
      c,
    );
    quad(
      [
        [xa, low(xa), z0],
        [xb, low(xb), z0],
        [xb, low(xb), z1],
        [xa, low(xa), z1],
      ],
      c,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A lit material that uses the vertex colours of a `ribbon`. */
export function ribbonMaterial(kit: Kit): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: DoubleSide });
  kit.materials.push(m);
  return m;
}

/** Builds meshes and remembers what to dispose. */
export class Kit {
  readonly geometries: BufferGeometry[] = [];
  readonly materials: Material[] = [];
  readonly textures: CanvasTexture[] = [];
  private cache = new Map<string, MeshStandardMaterial>();

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
    return this.mesh(new BoxGeometry(w, h, d), material, parent, x, y, z);
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
