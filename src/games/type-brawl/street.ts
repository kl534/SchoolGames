import {
  AmbientLight,
  Color,
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
import type { StageDef, StagePalette } from './rules';

/** Scenery is spawned in chunks this long (world units) ahead of the camera and recycled behind it. */
export const CHUNK = 12;
const BUILDING_Z = -6.5;
const PROP_Z = -2.5;
const QUAY_Z = -1.0;

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

function skyTexture(colors: StagePalette['sky']): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (g) {
    const gradient = g.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.7, colors[1]);
    gradient.addColorStop(1, colors[2]);
    g.fillStyle = gradient;
    g.fillRect(0, 0, 2, 256);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The long street of a stage: ground with a dashed line, a strip behind, buildings and props along it. */
export function createStreet(scene: Scene, stage: StageDef): Street {
  const pal = stage.palette;
  const object = new Group();
  const sky = skyTexture(pal.sky);
  scene.background = sky;

  object.add(new HemisphereLight(new Color(pal.hemi[0]), new Color(pal.hemi[1]), 1.5));
  object.add(new AmbientLight(0xffffff, stage.id === 'rooftop' ? 0.5 : 0.35));
  const sun = new DirectionalLight(new Color(pal.sun), stage.id === 'rooftop' ? 1.5 : 1.6);
  sun.position.set(-4, 9, 10);
  object.add(sun);

  const unit = new BoxGeometry(1, 1, 1);
  const cylinder = new CylinderGeometry(1, 1, 1, 10);
  const ball = new SphereGeometry(1, 12, 8);
  const flat = new PlaneGeometry(1, 1);
  const material = (color: number | string) =>
    new MeshStandardMaterial({ color: new Color(color), roughness: 0.85 });
  const asphalt = material(pal.ground);
  const sidewalk = material(pal.walk);
  const kerb = material(pal.kerb);
  const paint = new MeshStandardMaterial({ color: new Color(pal.paint), roughness: 0.9 });
  const metal = material(0x4a4f5a);
  const bin = material(0x2f7d4f);
  const wood = material(0x7a5230);
  const leaf = material(0x3f9d4a);
  const fence = material(0xd9c9a0);
  const crateWood = material(0xb07a3c);
  const barrelBlue = material(0x2a5d9f);
  const lanternRed = new MeshStandardMaterial({
    color: 0xe63946,
    emissive: new Color(0xff5a36),
    emissiveIntensity: 0.6,
    roughness: 0.6,
  });
  const darkWood = material(0x4a2f1c);
  const light = new MeshStandardMaterial({
    color: 0xff3b3b,
    emissive: new Color(0xff2020),
    emissiveIntensity: 1,
  });
  const textures = pal.walls.map((p, i) => windowTexture(p, 11 + i));
  const walls = textures.map((map) => new MeshStandardMaterial({ map, roughness: 0.9 }));
  const roof = material(pal.roof);
  const owned = [
    asphalt,
    sidewalk,
    kerb,
    paint,
    metal,
    bin,
    wood,
    leaf,
    fence,
    roof,
    crateWood,
    barrelBlue,
    lanternRed,
    darkWood,
    light,
    ...walls,
  ];

  // The ground follows the camera; everything with a pattern is in the chunks.
  const road = new Mesh(flat, asphalt);
  road.rotation.x = -Math.PI / 2;
  // On the docks the ground stops at the water's edge.
  const roadBack = pal.sunken ? -1.2 : -12;
  road.scale.set(80, 32 - roadBack, 1);
  road.position.set(0, 0, (32 + roadBack) / 2);
  object.add(road);
  const walk = new Mesh(unit, sidewalk);
  walk.scale.set(80, 0.12, 4);
  walk.position.set(0, pal.sunken ? -0.12 : 0.06, -3.2);
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

    // Props along the back of the lane, the stage's own kinds.
    const slots = 4;
    for (let s = 0; s < slots; s++) {
      const px = (s + 0.3 + random() * 0.4) * (CHUNK / slots);
      const kind = stage.props[Math.floor(random() * stage.props.length)];
      // On the docks the props stand on the quay at the lane's edge; the strip behind is water.
      const z = pal.sunken ? QUAY_Z : PROP_Z;
      const y0 = 0.12;
      if (kind === 'lamp') {
        const post = add(cylinder, metal);
        post.scale.set(0.06, 3.2, 0.06);
        post.position.set(px, 1.6 + y0, z);
        const head = add(unit, metal);
        head.scale.set(0.7, 0.1, 0.18);
        head.position.set(px + 0.25, 3.3, z);
      } else if (kind === 'bin') {
        const can = add(cylinder, bin);
        can.scale.set(0.24, 0.7, 0.24);
        can.position.set(px, 0.35 + y0, z);
        const lid = add(cylinder, metal);
        lid.scale.set(0.27, 0.06, 0.27);
        lid.position.set(px, 0.85, z);
      } else if (kind === 'tree') {
        const trunk = add(cylinder, wood);
        trunk.scale.set(0.1, 1.2, 0.1);
        trunk.position.set(px, 0.6 + y0, z);
        const crown = add(ball, leaf);
        crown.scale.set(0.7, 0.7, 0.7);
        crown.position.set(px, 1.7, z);
      } else if (kind === 'fence') {
        const rail = add(unit, fence);
        rail.scale.set(2.2, 0.08, 0.06);
        rail.position.set(px, 0.55, z);
        for (let p = 0; p < 4; p++) {
          const stake = add(unit, fence);
          stake.scale.set(0.08, 0.6, 0.08);
          stake.position.set(px - 1 + p * 0.67, 0.42, z);
        }
      } else if (kind === 'crate') {
        const w = 0.7 + random() * 0.3;
        const lower = add(unit, crateWood);
        lower.scale.set(w, w, w);
        lower.position.set(px, w / 2 + 0.1, z);
        if (random() < 0.6) {
          const upper = add(unit, crateWood);
          upper.scale.set(w * 0.8, w * 0.8, w * 0.8);
          upper.position.set(px + 0.05, w + w * 0.4 + 0.1, z);
        }
      } else if (kind === 'barrel') {
        const drum = add(cylinder, barrelBlue);
        drum.scale.set(0.3, 0.8, 0.3);
        drum.position.set(px, 0.5, z);
        const band = add(cylinder, metal);
        band.scale.set(0.32, 0.06, 0.32);
        band.position.set(px, 0.55, z);
      } else if (kind === 'bollard') {
        const post = add(cylinder, metal);
        post.scale.set(0.14, 0.5, 0.14);
        post.position.set(px, 0.35, z);
        const top = add(ball, metal);
        top.scale.set(0.17, 0.12, 0.17);
        top.position.set(px, 0.62, z);
      } else if (kind === 'lantern') {
        const post = add(cylinder, darkWood);
        post.scale.set(0.07, 2.4, 0.07);
        post.position.set(px, 1.2 + y0, z);
        const lamp = add(ball, lanternRed);
        lamp.scale.set(0.28, 0.36, 0.28);
        lamp.position.set(px, 2.5, z);
      } else if (kind === 'pillar') {
        const pillar = add(cylinder, darkWood);
        pillar.scale.set(0.22, 4.2, 0.22);
        pillar.position.set(px, 2.1 + y0, z);
      } else if (kind === 'bonsai') {
        const pot = add(cylinder, darkWood);
        pot.scale.set(0.25, 0.3, 0.25);
        pot.position.set(px, 0.27, z);
        const tuft = add(ball, leaf);
        tuft.scale.set(0.42, 0.28, 0.42);
        tuft.position.set(px, 0.62, z);
      } else if (kind === 'vent') {
        const body = add(unit, metal);
        body.scale.set(0.9, 0.7, 0.7);
        body.position.set(px, 0.35 + 0.1, z);
        const fan = add(cylinder, roof);
        fan.scale.set(0.28, 0.08, 0.28);
        fan.position.set(px, 0.85, z);
      } else if (kind === 'antenna') {
        const mast = add(cylinder, metal);
        mast.scale.set(0.04, 3.6, 0.04);
        mast.position.set(px, 1.8 + 0.1, z);
        const bar = add(unit, metal);
        bar.scale.set(0.7, 0.04, 0.04);
        bar.position.set(px, 3.0, z);
        const lamp = add(ball, light);
        lamp.scale.set(0.09, 0.09, 0.09);
        lamp.position.set(px, 3.65, z);
      } else {
        const tank = add(cylinder, wood);
        tank.scale.set(0.5, 0.9, 0.5);
        tank.position.set(px, 1.6, z);
        for (const dx of [-0.3, 0.3]) {
          const leg = add(unit, metal);
          leg.scale.set(0.06, 1.1, 0.06);
          leg.position.set(px + dx, 0.65, z);
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
      object.removeFromParent();
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
