import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  type Scene,
} from 'three';
import { seededRandom } from '../../shared/random';

/** Scenery is spawned in chunks this long (world units) ahead of the camera and recycled behind it. */
export const CHUNK = 12;
const BUILDING_Z = -6.5;
const PROP_Z = -2.5;

/** [wall, window, lit window] of the three building palettes. */
const PALETTES: [string, string, string][] = [
  ['#8b5e3c', '#3b2a22', '#ffe9a8'],
  ['#4a6fa5', '#27364f', '#d6ecff'],
  ['#9c9a8f', '#4b4a45', '#fff3b0'],
];

export interface Street {
  /** The scenery and lights; add it to the scene. */
  readonly object: Group;
  /** Builds the chunks the camera needs around `cameraX` and drops the ones far behind it. */
  update(cameraX: number): void;
  dispose(): void;
}

/** The chunk indexes that must exist when the camera is at `cameraX` (one behind, two ahead). */
export function chunksFor(cameraX: number): number[] {
  const mid = Math.floor(cameraX / CHUNK);
  return [mid - 1, mid, mid + 1, mid + 2];
}

function windowTexture(palette: [string, string, string], seed: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  const random = seededRandom(seed);
  if (g) {
    g.fillStyle = palette[0];
    g.fillRect(0, 0, 64, 128);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 4; col++) {
        g.fillStyle = random() < 0.35 ? palette[2] : palette[1];
        g.fillRect(6 + col * 15, 6 + row * 15, 10, 10);
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function skyTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (g) {
    const gradient = g.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#4ba3ff');
    gradient.addColorStop(0.7, '#bfe3ff');
    gradient.addColorStop(1, '#ffe6c2');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 2, 256);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The long street: asphalt with a dashed lane line, a sidewalk strip, buildings behind and props along it. */
export function createStreet(scene: Scene): Street {
  const object = new Group();
  const sky = skyTexture();
  scene.background = sky;

  object.add(new HemisphereLight(0xffffff, 0x8a93a6, 1.5));
  object.add(new AmbientLight(0xffffff, 0.35));
  const sun = new DirectionalLight(0xfff1d6, 1.6);
  sun.position.set(-4, 9, 10);
  object.add(sun);

  const unit = new BoxGeometry(1, 1, 1);
  const cylinder = new CylinderGeometry(1, 1, 1, 10);
  const ball = new SphereGeometry(1, 12, 8);
  const flat = new PlaneGeometry(1, 1);
  const material = (color: number) => new MeshStandardMaterial({ color, roughness: 0.85 });
  const asphalt = material(0x3d4048);
  const sidewalk = material(0x9fa5b0);
  const kerb = material(0xc9ced6);
  const paint = new MeshStandardMaterial({ color: 0xf1f1ea, roughness: 0.9 });
  const metal = material(0x4a4f5a);
  const bin = material(0x2f7d4f);
  const wood = material(0x7a5230);
  const leaf = material(0x3f9d4a);
  const fence = material(0xd9c9a0);
  const textures = PALETTES.map((p, i) => windowTexture(p, 11 + i));
  const walls = textures.map((map) => new MeshStandardMaterial({ map, roughness: 0.9 }));
  const roof = material(0x555a66);
  const owned = [asphalt, sidewalk, kerb, paint, metal, bin, wood, leaf, fence, roof, ...walls];

  // The ground follows the camera; everything with a pattern is in the chunks.
  const road = new Mesh(flat, asphalt);
  road.rotation.x = -Math.PI / 2;
  road.scale.set(80, 44, 1);
  road.position.set(0, 0, 10);
  object.add(road);
  const walk = new Mesh(unit, sidewalk);
  walk.scale.set(80, 0.12, 4);
  walk.position.set(0, 0.06, -3.2);
  object.add(walk);
  const edge = new Mesh(unit, kerb);
  edge.scale.set(80, 0.13, 0.15);
  edge.position.set(0, 0.065, -1.2);
  object.add(edge);

  const chunks = new Map<number, Group>();

  const build = (index: number): Group => {
    const group = new Group();
    group.position.x = index * CHUNK;
    const random = seededRandom(index * 7919 + 13);
    const add = (
      geometry: BoxGeometry | CylinderGeometry | SphereGeometry,
      mat: MeshStandardMaterial,
    ) => {
      const mesh = new Mesh(geometry, mat);
      group.add(mesh);
      return mesh;
    };

    // Dashes of the lane line.
    for (let d = 0; d < 4; d++) {
      const dash = add(unit, paint);
      dash.scale.set(1.6, 0.02, 0.14);
      dash.position.set(d * 3 + 1.2, 0.011, 1.1);
    }

    // Buildings along the back, side by side with small gaps.
    let x = random() * 0.6;
    while (x < CHUNK - 3) {
      const width = 3.4 + random() * 2.2;
      const height = 5.5 + random() * 5;
      const palette = Math.floor(random() * walls.length);
      const body = add(unit, walls[palette]);
      body.scale.set(width, height, 3);
      body.position.set(x + width / 2, height / 2, BUILDING_Z);
      const top = add(unit, roof);
      top.scale.set(width + 0.2, 0.25, 3.2);
      top.position.set(x + width / 2, height + 0.12, BUILDING_Z);
      x += width + 0.15 + random() * 0.6;
    }

    // Props on the sidewalk: lamp posts, bins, trees and low fences.
    const slots = 4;
    for (let s = 0; s < slots; s++) {
      const px = (s + 0.3 + random() * 0.4) * (CHUNK / slots);
      const kind = Math.floor(random() * 4);
      if (kind === 0) {
        const post = add(cylinder, metal);
        post.scale.set(0.06, 3.2, 0.06);
        post.position.set(px, 1.6 + 0.12, PROP_Z);
        const head = add(unit, metal);
        head.scale.set(0.7, 0.1, 0.18);
        head.position.set(px + 0.25, 3.3, PROP_Z);
      } else if (kind === 1) {
        const can = add(cylinder, bin);
        can.scale.set(0.24, 0.7, 0.24);
        can.position.set(px, 0.35 + 0.12, PROP_Z);
        const lid = add(cylinder, metal);
        lid.scale.set(0.27, 0.06, 0.27);
        lid.position.set(px, 0.85, PROP_Z);
      } else if (kind === 2) {
        const trunk = add(cylinder, wood);
        trunk.scale.set(0.1, 1.2, 0.1);
        trunk.position.set(px, 0.6 + 0.12, PROP_Z);
        const crown = add(ball, leaf);
        crown.scale.set(0.7, 0.7, 0.7);
        crown.position.set(px, 1.7, PROP_Z);
      } else {
        const rail = add(unit, fence);
        rail.scale.set(2.2, 0.08, 0.06);
        rail.position.set(px, 0.55, PROP_Z);
        for (let p = 0; p < 4; p++) {
          const stake = add(unit, fence);
          stake.scale.set(0.08, 0.6, 0.08);
          stake.position.set(px - 1 + p * 0.67, 0.42, PROP_Z);
        }
      }
    }
    return group;
  };

  return {
    object,
    update(cameraX) {
      road.position.x = cameraX;
      walk.position.x = cameraX;
      edge.position.x = cameraX;
      const need = new Set(chunksFor(cameraX));
      for (const [index, group] of chunks) {
        if (need.has(index)) continue;
        object.remove(group);
        chunks.delete(index);
      }
      for (const index of need) {
        if (chunks.has(index)) continue;
        const group = build(index);
        chunks.set(index, group);
        object.add(group);
      }
    },
    dispose() {
      sky.dispose();
      for (const t of textures) t.dispose();
      for (const m of owned) m.dispose();
      unit.dispose();
      cylinder.dispose();
      ball.dispose();
      flat.dispose();
      scene.background = null;
    },
  };
}
