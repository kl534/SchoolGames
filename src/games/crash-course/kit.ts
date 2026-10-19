/**
 * Shared building blocks for the props of obstacles and Mega courses: small maths helpers and
 * `Kit`, which builds meshes and remembers what to dispose.
 */
import {
  BoxGeometry,
  CanvasTexture,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Mesh,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const smooth = (u: number) => {
  const c = clamp01(u);
  return c * c * (3 - 2 * c);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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
