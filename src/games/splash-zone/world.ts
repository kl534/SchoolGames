/**
 * The world around the water: a sky dome, fog, sun, and scenery recycled along the course at 18 to
 * 70 u either side of the ski's path. The Lagoon is sandy islands with palm trees, sailboats, a
 * lighthouse, a pier with a cheering crowd every ~120 u, and dolphins that leap now and then; Harbour
 * City is concrete docks with skyline towers and containers, tugboats, cranes and a skyline beyond,
 * with the same cheering pier. All procedural; nothing to load.
 */
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { swell } from './anim';
import { createDolphin, type Dolphin } from './critters';
import type { WorldId } from './rules';
import * as scenery from './scenery';
import { hash, merge, part } from './scenery';

export type WorldTheme = WorldId;

export interface WorldPalette {
  skyTop: number;
  skyBottom: number;
  water: number;
  sand: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  /** The daylight: sky and ground tints of the hemisphere light, the sun's colour and strength. */
  light?: { sky: number; ground: number; sun: number; sunPower: number };
}

export const PALETTES: Record<WorldTheme, WorldPalette> = {
  lagoon: {
    skyTop: 0x5ec8ff,
    skyBottom: 0xd8f4ff,
    water: 0x1fc7c1,
    sand: 0xffe2a0,
    fog: 0xbfefff,
    fogNear: 90,
    fogFar: 200,
  },
  harbour: {
    skyTop: 0x7ab8e8,
    skyBottom: 0xe4f1fb,
    water: 0x2a8fb0,
    sand: 0xb9bdc6,
    fog: 0xcfe3f1,
    fogNear: 90,
    fogFar: 200,
  },
  iceberg: {
    skyTop: 0xbfe6ff,
    skyBottom: 0xffffff,
    water: 0x3aa0c8,
    sand: 0xf4fbff,
    fog: 0xeaf6ff,
    fogNear: 80,
    fogFar: 190,
    light: { sky: 0xeaf6ff, ground: 0x7fb4d0, sun: 0xffffff, sunPower: 2.1 },
  },
};

export type Mood = 'idle' | 'cheer' | 'groan';

export interface World {
  /** The water's colour for this world. */
  readonly water: number;
  /**
   * Follows the ski: recycles the scenery to cover the course around z = `skiZ` and keeps the sky
   * dome round the camera.
   */
  update(
    skiZ: number,
    camera: { x: number; y: number; z: number },
    delta: number,
    time: number,
  ): void;
  /** The pier crowds cheer or groan for 2.2 seconds, then go back to watching. */
  cheer(): void;
  groan(): void;
  /** The blob shadow under a flying ski: its spot on the water and its height above it. */
  setShadow(slot: 0 | 1, x: number, z: number, height: number): void;
  /** Leaps one dolphin right now (for the lab). */
  leapDolphin(): void;
  dispose(): void;
}

/** One chunk of scenery covers this much of the course (u). */
const CHUNK = 60;
/** Chunks kept alive at once: some behind the ski, the rest ahead out to the fog. */
const SLOTS = 6;
/** The pier (and its crowd) comes round every this-many chunks: 120 u. */
const PIER_EVERY = 2;
const CROWD = 12;

const euler = new Euler();
const scaleVec = new Vector3();
const positionVec = new Vector3();

function skyGeometry(palette: WorldPalette): BufferGeometry {
  // A dome painted with vertex colours: top colour overhead, bottom colour at the horizon.
  const geometry = new SphereGeometry(320, 24, 16);
  const position = geometry.getAttribute('position') as BufferAttribute;
  const top = new Color(palette.skyTop);
  const bottom = new Color(palette.skyBottom);
  const colors: number[] = [];
  const c = new Color();
  for (let i = 0; i < position.count; i++) {
    const h = Math.min(Math.max(position.getY(i) / 320, 0), 1);
    c.copy(bottom).lerp(top, Math.pow(h, 0.55));
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

interface Slot {
  group: Group;
  chunk: number;
  islands: [Group, Group];
  boats: [Mesh, Mesh];
  lighthouse: Mesh;
  pier: Group;
  crowd: { bodies: InstancedMesh; heads: InstancedMesh; arms: InstancedMesh };
  skyline: [Mesh, Mesh];
  boatBase: [number, number];
  pierSide: number;
  hasPier: boolean;
}

export function createWorld(scene: Scene, theme: WorldTheme): World {
  const palette = PALETTES[theme];
  const geometries: BufferGeometry[] = [];
  const materials: (MeshStandardMaterial | MeshBasicMaterial)[] = [];
  const track = <T extends BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const std = (opts: ConstructorParameters<typeof MeshStandardMaterial>[0]) => {
    const m = new MeshStandardMaterial(opts);
    materials.push(m);
    return m;
  };

  // ---------- Sky, fog and light ----------
  scene.background = new Color(palette.skyBottom);
  scene.fog = new Fog(palette.fog, palette.fogNear, palette.fogFar);
  const root = new Group();
  scene.add(root);
  const dome = new Mesh(
    track(skyGeometry(palette)),
    new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }),
  );
  materials.push(dome.material as MeshBasicMaterial);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  root.add(dome);
  const lights = new Group();
  const daylight = palette.light ?? {
    sky: 0xdcf4ff,
    ground: 0x4aa7b0,
    sun: 0xfff2d8,
    sunPower: 2.4,
  };
  lights.add(new HemisphereLight(daylight.sky, daylight.ground, 1.7));
  lights.add(new AmbientLight(0xffffff, 0.45));
  const sun = new DirectionalLight(daylight.sun, daylight.sunPower);
  sun.position.set(-14, 26, 10);
  lights.add(sun);
  root.add(lights);

  // Open water out to the fog, under the nearer plane that `water.ts` heaves.
  const farWater = new Mesh(
    track(new PlaneGeometry(900, 900).rotateX(-Math.PI / 2)),
    std({ color: palette.water, roughness: 0.4, flatShading: true }),
  );
  farWater.position.y = -0.12;
  farWater.frustumCulled = false;
  root.add(farWater);

  // ---------- Shared parts ----------
  const sceneryMaterial = std({ vertexColors: true, roughness: 0.8, flatShading: true });
  const boatMaterial = std({ vertexColors: true, roughness: 0.6, side: DoubleSide });

  const makeSandIsland = () => {
    const radius = 7;
    const sand = merge([
      part(new CylinderGeometry(radius * 0.8, radius, 1.5, 22), palette.sand, 0, 0.05, 0),
      part(
        new CylinderGeometry(radius * 0.55, radius * 0.72, 0.4, 18),
        0xf3cf86,
        0,
        0.9,
        0,
        0,
        0,
        0,
      ),
    ]);
    return track(sand);
  };

  const makePalm = () => {
    const parts: BufferGeometry[] = [
      part(new CylinderGeometry(0.1, 0.19, 3.4, 8), 0x9a6a3a, 0.25, 1.7, 0, 0, 0, -0.14),
      part(new SphereGeometry(0.13, 8, 6), 0x6b4423, 0.45, 3.3, 0.1),
      part(new SphereGeometry(0.13, 8, 6), 0x6b4423, 0.55, 3.25, -0.1),
    ];
    const greens = [0x2f9d4a, 0x3fbf5f, 0x2a8a43];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      parts.push(
        part(
          new ConeGeometry(0.34, 2.3, 5),
          greens[i % 3],
          0.5 + Math.cos(a) * 0.9,
          3.35 - 0.2,
          Math.sin(a) * 0.9,
          Math.sin(a) * 1.15,
          0,
          -Math.cos(a) * 1.15,
          1,
          1,
          0.28,
        ),
      );
    }
    return track(merge(parts));
  };

  const makeBoat = () => {
    const sail = new Shape();
    sail.moveTo(0, 0);
    sail.lineTo(0, 3.6);
    sail.lineTo(1.5, 0.15);
    sail.lineTo(0, 0);
    const jib = new Shape();
    jib.moveTo(0, 0);
    jib.lineTo(0, 3.0);
    jib.lineTo(-1.1, 0.1);
    jib.lineTo(0, 0);
    return track(
      merge([
        part(new BoxGeometry(1.1, 0.55, 3.2), 0xffffff, 0, 0.15, 0),
        part(new BoxGeometry(1.14, 0.12, 3.24), 0xe8403a, 0, 0.35, 0),
        part(new ConeGeometry(0.55, 1.1, 4), 0xffffff, 0, 0.15, -2.1, -Math.PI / 2, Math.PI / 4, 0),
        part(new CylinderGeometry(0.04, 0.04, 4.2, 6), 0x6a5a48, 0, 2.5, 0),
        part(new ShapeGeometry(sail), 0xffffff, 0, 0.55, 0.05, 0, Math.PI / 2, 0),
        part(new ShapeGeometry(jib), 0xffe066, 0, 0.55, -0.1, 0, Math.PI / 2, 0),
      ]),
    );
  };

  const makeLighthouse = () => {
    const parts: BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      parts.push(
        part(
          new CylinderGeometry(1.1 - i * 0.17, 1.27 - i * 0.17, 2.1, 14),
          i % 2 === 0 ? 0xe8403a : 0xffffff,
          0,
          1.05 + i * 2.1,
          0,
        ),
      );
    }
    parts.push(part(new CylinderGeometry(1.35, 1.1, 0.35, 14), 0x333344, 0, 8.55, 0));
    parts.push(part(new CylinderGeometry(0.6, 0.6, 1.0, 12), 0xfff2a8, 0, 9.2, 0));
    parts.push(part(new ConeGeometry(0.85, 0.9, 12), 0xe8403a, 0, 10.15, 0));
    return track(merge(parts));
  };

  const makePier = () => {
    const parts: BufferGeometry[] = [
      part(new BoxGeometry(15, 0.25, 3.4), 0xc99a5b, 0, 1.0, 0),
      part(new BoxGeometry(15, 0.5, 0.1), 0xffffff, 0, 1.45, 1.65),
      part(new BoxGeometry(15, 0.5, 0.1), 0xffffff, 0, 1.45, -1.65),
    ];
    for (let i = 0; i < 8; i++) {
      for (const side of [-1, 1]) {
        parts.push(
          part(new CylinderGeometry(0.12, 0.12, 2.2, 6), 0x7a5a3a, -7 + i * 2, 0.1, side * 1.5),
        );
      }
    }
    // Bunting along the rail.
    const flags = [0xe8403a, 0xffd43b, 0x2fa4e7, 0x7be07b];
    for (let i = 0; i < 14; i++) {
      parts.push(
        part(new ConeGeometry(0.2, 0.4, 3), flags[i % 4], -6.6 + i * 1.0, 1.9, 1.65, Math.PI, 0, 0),
      );
    }
    return track(merge(parts));
  };

  // ---------- Harbour City parts ----------
  const makeDock = () => {
    const parts: BufferGeometry[] = [
      part(new BoxGeometry(15, 1.6, 10), palette.sand, 0, 0.1, 0),
      part(new BoxGeometry(15.3, 0.25, 10.3), 0x8d93a0, 0, 0.95, 0),
    ];
    const towers: [number, number, number, number, number, number][] = [
      [-3.5, -1.5, 4, 9, 4, 0x8fb0d8],
      [1.5, 0.5, 3.4, 13, 3.4, 0xc9d6e8],
      [4.6, -2, 3, 6, 3.4, 0xe6b8a2],
      [-4.8, 2.6, 2.8, 5, 2.8, 0xa7c4a0],
    ];
    for (const [x, z, w, h, d, color] of towers) {
      parts.push(part(new BoxGeometry(w, h, d), color, x, 1.05 + h / 2, z));
      for (let y = 2.2; y < h + 0.4; y += 1.5) {
        parts.push(part(new BoxGeometry(w * 0.78, 0.5, 0.06), 0x2c4a70, x, y, z + d / 2 + 0.02));
        parts.push(part(new BoxGeometry(w * 0.78, 0.5, 0.06), 0x2c4a70, x, y, z - d / 2 - 0.02));
      }
    }
    const boxes = [0xe8403a, 0x2fa4e7, 0xffd43b, 0x7be07b];
    for (let i = 0; i < 6; i++) {
      parts.push(
        part(
          new BoxGeometry(2.4, 1.05, 1.0),
          boxes[i % 4],
          5.2 - (i % 3) * 2.5,
          1.65 + (i > 2 ? 1.05 : 0),
          3.6,
        ),
      );
    }
    return track(merge(parts));
  };

  const makeCrane = () => {
    const parts: BufferGeometry[] = [
      part(new BoxGeometry(2.4, 1.2, 2.4), 0x4a5266, 0, 0.6, 0),
      part(new BoxGeometry(0.9, 12, 0.9), 0xffc83d, 0, 7.2, 0),
      part(new BoxGeometry(12, 0.7, 0.7), 0xffc83d, 2.6, 13.4, 0),
      part(new BoxGeometry(2.2, 1.5, 1.5), 0x6c7488, -3.4, 13.0, 0),
      part(new BoxGeometry(1.4, 1.2, 1.2), 0xf6f6f6, 0.9, 12.4, 0.9),
      part(new CylinderGeometry(0.04, 0.04, 7, 6), 0x2b2f3a, 7.6, 9.8, 0),
      part(new BoxGeometry(0.6, 0.5, 0.6), 0xe8403a, 7.6, 6.2, 0),
    ];
    return track(merge(parts));
  };

  const makeTug = () =>
    track(
      merge([
        part(new BoxGeometry(2.8, 0.9, 6.2), 0xd8453a, 0, 0.1, 0),
        part(new BoxGeometry(2.84, 0.18, 6.24), 0xffffff, 0, 0.45, 0),
        part(new ConeGeometry(1.4, 1.6, 4), 0xd8453a, 0, 0.1, -3.9, -Math.PI / 2, Math.PI / 4, 0),
        part(new BoxGeometry(1.8, 1.2, 2.2), 0xffffff, 0, 1.15, 0.9),
        part(new BoxGeometry(1.84, 0.4, 2.0), 0x2c4a70, 0, 1.35, 0.5),
        part(new CylinderGeometry(0.34, 0.4, 1.3, 10), 0x22262e, 0, 2.3, 1.3),
        part(new CylinderGeometry(0.36, 0.36, 0.3, 10), 0xe8403a, 0, 2.7, 1.3),
      ]),
    );

  /** A strip of far-off towers facing -x (the side the course is on); turned round for the other side. */
  const makeSkyline = (seed: number) => {
    const parts: BufferGeometry[] = [];
    const tints = [0xaec6e0, 0xc9d6e8, 0xd9c3b3, 0xb6cbb0, 0x9fb4cf];
    let z = -29;
    for (let i = 0; i < 9; i++) {
      const w = 3.2 + hash(seed * 31 + i * 3.1) * 3;
      const h = 9 + hash(seed * 17 + i * 5.3) * 19;
      const d = 5 + hash(seed * 11 + i * 2.7) * 3;
      const x = hash(seed * 7 + i) * 6;
      z += d / 2;
      parts.push(part(new BoxGeometry(d, h, w), tints[i % tints.length], x, h / 2, z));
      for (let y = 2; y < h; y += 1.8) {
        parts.push(part(new BoxGeometry(0.06, 0.7, w * 0.8), 0x2c4a70, x - d / 2 - 0.02, y, z));
      }
      z += d / 2 + 0.6;
    }
    return track(merge(parts));
  };

  const palmGeometry = makePalm();
  /** What each world puts in the same places: islands, boats, a landmark and far-off strips. */
  const set = (() => {
    switch (theme) {
      case 'harbour':
        return {
          island: makeDock(),
          boat: makeTug(),
          landmark: makeCrane(),
          strips: [makeSkyline(1), makeSkyline(2)],
          palms: false,
        };
      case 'iceberg':
        return {
          island: track(scenery.makeIceberg()),
          boat: track(scenery.makeIceFloe()),
          landmark: track(scenery.makeIceSpires()),
          strips: [track(scenery.makeSnowPeaks(1)), track(scenery.makeSnowPeaks(2))],
          palms: false,
        };
      default:
        return {
          island: makeSandIsland(),
          boat: makeBoat(),
          landmark: makeLighthouse(),
          strips: [] as BufferGeometry[],
          palms: true,
        };
    }
  })();
  const islandGeometry = set.island;
  const boatGeometry = set.boat;
  const lighthouseGeometry = set.landmark;
  const skylineGeometries = set.strips;
  const emptyGeometry = track(new BufferGeometry());
  const pierGeometry = makePier();
  const personBody = track(new CapsuleGeometry(0.2, 0.45, 4, 8));
  const personHead = track(new SphereGeometry(0.17, 10, 8));
  const personArm = track(new CapsuleGeometry(0.055, 0.4, 3, 6));
  const bodyMaterial = std({ roughness: 0.8 });
  const skinMaterial = std({ color: 0xf1b48a, roughness: 0.75 });
  const crowdColors = [0xe8403a, 0x2fa4e7, 0xffd43b, 0x7be07b, 0xff8fd0, 0xff9f1c, 0xb28dff];

  // ---------- Slots of scenery ----------
  const slots: Slot[] = [];
  for (let s = 0; s < SLOTS; s++) {
    const group = new Group();
    root.add(group);
    const makeIslandGroup = () => {
      const g = new Group();
      g.add(new Mesh(islandGeometry, sceneryMaterial));
      for (const [x, z] of !set.palms
        ? []
        : [
            [-2.0, 1.2],
            [2.2, -1.5],
          ]) {
        const palm = new Mesh(palmGeometry, sceneryMaterial);
        palm.position.set(x, 1.1, z);
        palm.rotation.y = x * 2;
        g.add(palm);
      }
      group.add(g);
      return g;
    };
    const islands: [Group, Group] = [makeIslandGroup(), makeIslandGroup()];
    const lighthouse = new Mesh(lighthouseGeometry, sceneryMaterial);
    group.add(lighthouse);
    const boats: [Mesh, Mesh] = [
      new Mesh(boatGeometry, boatMaterial),
      new Mesh(boatGeometry, boatMaterial),
    ];
    boats.forEach((b) => group.add(b));
    const makeStrip = (side: number) => {
      const strip = new Mesh(skylineGeometries[(s + side) % 2] ?? emptyGeometry, sceneryMaterial);
      strip.visible = skylineGeometries.length > 0;
      strip.rotation.y = side === 0 ? Math.PI : 0;
      strip.frustumCulled = false;
      group.add(strip);
      return strip;
    };
    const skyline: [Mesh, Mesh] = [makeStrip(0), makeStrip(1)];
    const pier = new Group();
    pier.add(new Mesh(pierGeometry, sceneryMaterial));
    group.add(pier);
    const bodies = new InstancedMesh(personBody, bodyMaterial, CROWD);
    const heads = new InstancedMesh(personHead, skinMaterial, CROWD);
    const arms = new InstancedMesh(personArm, skinMaterial, CROWD * 2);
    for (let i = 0; i < CROWD; i++) {
      bodies.setColorAt(i, new Color(crowdColors[i % crowdColors.length]));
    }
    for (const m of [bodies, heads, arms]) {
      m.frustumCulled = false;
      pier.add(m);
    }
    slots.push({
      group,
      chunk: Number.NaN,
      islands,
      boats,
      lighthouse,
      pier,
      skyline,
      crowd: { bodies, heads, arms },
      boatBase: [0, 0],
      pierSide: 1,
      hasPier: false,
    });
  }

  /** Lays out a slot for course chunk `c`, from a hash of the chunk number so it never changes. */
  const layout = (slot: Slot, c: number) => {
    slot.chunk = c;
    const z0 = -(c + 0.5) * CHUNK;
    slot.group.position.set(0, 0, z0);
    const h = (k: number) => hash(c * 17.31 + k * 3.7);
    slot.hasPier = c % PIER_EVERY === 0 && c > 0;
    slot.pierSide = h(1) < 0.5 ? -1 : 1;
    slot.islands.forEach((island, i) => {
      const side = i === 0 ? -1 : 1;
      const blocked = slot.hasPier && side === slot.pierSide;
      island.visible = !blocked && h(2 + i) < 0.85;
      const x = side * (30 + h(4 + i) * 34);
      const z = (h(6 + i) - 0.5) * CHUNK * 0.7;
      const scale = 0.8 + h(8 + i) * 0.9;
      island.position.set(x, -0.1, z);
      island.scale.set(scale, 1, scale * (0.8 + h(9 + i) * 0.5));
      island.rotation.y = h(10 + i) * 6.28;
    });
    // The lighthouse stands on the biggest island of a chunk now and then.
    slot.lighthouse.visible = false;
    if (c % 5 === 3) {
      const i = h(12) < 0.5 ? 0 : 1;
      if (slot.islands[i].visible) {
        slot.lighthouse.visible = true;
        slot.lighthouse.position.set(
          slot.islands[i].position.x + (i === 0 ? 1.5 : -1.5),
          0.7,
          slot.islands[i].position.z,
        );
      }
    }
    slot.boats.forEach((boat, i) => {
      const side = h(14 + i) < 0.5 ? -1 : 1;
      boat.position.set(side * (20 + h(16 + i) * 38), 0, (h(18 + i) - 0.5) * CHUNK * 0.8);
      boat.rotation.y = h(20 + i) * 6.28;
      slot.boatBase[i] = boat.rotation.y;
    });
    if (skylineGeometries.length > 0) {
      slot.skyline[0].position.set(-(84 + h(30) * 8), 0, 0);
      slot.skyline[1].position.set(84 + h(31) * 8, 0, 0);
    }
    slot.pier.visible = slot.hasPier;
    if (slot.hasPier) {
      // The pier juts out from the shore towards the course, ending 19 u from its middle.
      slot.pier.position.set(slot.pierSide * 27, 0, (h(22) - 0.5) * 20);
      slot.pier.rotation.y = 0;
    }
  };

  const crowdMatrix = new Matrix4();
  const crowdQuat = new Quaternion();
  const animateCrowd = (slot: Slot, time: number, mood: Mood, moodAmount: number) => {
    if (!slot.hasPier) return;
    const { bodies, heads, arms } = slot.crowd;
    for (let i = 0; i < CROWD; i++) {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = -5.2 + col * 2.0 + (row ? 0.8 : 0) + (hash(i + slot.chunk * 5) - 0.5) * 0.5;
      const z = (row ? 0.75 : -0.75) + (hash(i * 3 + 1) - 0.5) * 0.3;
      const phase = hash(i * 7 + slot.chunk) * 6.28;
      // Cheering: hopping. Groaning: slumped and swaying. Idle: a little sway.
      let hop = 0;
      let slump = 0;
      if (mood === 'cheer') hop = Math.abs(Math.sin(time * 9 + phase)) * 0.55 * moodAmount;
      else if (mood === 'groan') slump = 0.16 * moodAmount;
      const y = 1.12 + 0.62 - slump + hop + Math.sin(time * 1.6 + phase) * 0.01;
      const tilt = mood === 'groan' ? 0.25 * moodAmount : Math.sin(time * 1.3 + phase) * 0.03;
      const faceCourse = slot.pierSide === 1 ? -1 : 1;
      crowdQuat.setFromEuler(euler.set(0, 0, tilt));
      crowdMatrix.compose(positionVec.set(x, y, z), crowdQuat, scaleVec.set(1, 1 - slump * 0.5, 1));
      bodies.setMatrixAt(i, crowdMatrix);
      crowdMatrix.compose(
        positionVec.set(x, y + 0.62 - slump * 1.2, z),
        crowdQuat.identity(),
        scaleVec.set(1, 1, 1),
      );
      heads.setMatrixAt(i, crowdMatrix);
      for (const side of [-1, 1]) {
        // Arms down at the sides, or thrown up when cheering.
        const up = mood === 'cheer' ? moodAmount : 0;
        const swing = mood === 'cheer' ? Math.sin(time * 9 + phase + side) * 0.3 : 0;
        crowdQuat.setFromEuler(euler.set(0, 0, side * (0.25 + up * 2.6 + swing)));
        crowdMatrix.compose(
          positionVec.set(x + side * 0.27, y + 0.1 + up * 0.36, z + faceCourse * 0.0),
          crowdQuat,
          scaleVec.set(1, 1, 1),
        );
        arms.setMatrixAt(i * 2 + (side === 1 ? 1 : 0), crowdMatrix);
      }
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  };

  // ---------- Dolphins that leap now and then ----------
  interface Leaper {
    dolphin: Dolphin;
    t: number;
    life: number;
    x: number;
    z: number;
    dir: number;
  }
  const leapers: Leaper[] = [0, 1].map(() => {
    const dolphin = createDolphin();
    dolphin.object.visible = false;
    root.add(dolphin.object);
    return { dolphin, t: 0, life: 0, x: 0, z: 0, dir: 1 };
  });
  let nextLeap = 3;
  let lastSkiZ = 0;
  const startLeap = (skiZ: number) => {
    const l = leapers.find((p) => p.life <= 0);
    if (!l) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    l.x = side * (15 + Math.random() * 12);
    l.z = skiZ - 35 - Math.random() * 45;
    l.dir = side;
    l.t = 0;
    l.life = 1.3;
    l.dolphin.object.visible = true;
  };

  // ---------- The blob shadows (one for the ski, one for a free rider) ----------
  const shadowTexture = (() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    if (!g) return null;
    const fill = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    fill.addColorStop(0, 'rgba(6, 50, 62, 0.85)');
    fill.addColorStop(0.55, 'rgba(6, 50, 62, 0.45)');
    fill.addColorStop(1, 'rgba(6, 50, 62, 0)');
    g.fillStyle = fill;
    g.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
  })();
  const shadowMaterial = new MeshBasicMaterial({
    map: shadowTexture ?? undefined,
    color: shadowTexture ? 0xffffff : 0x0b3d4a,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  materials.push(shadowMaterial);
  const shadowGeometry = track(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const shadows = [0, 1].map(() => {
    const mesh = new Mesh(shadowGeometry, shadowMaterial.clone());
    materials.push(mesh.material as MeshBasicMaterial);
    mesh.visible = false;
    mesh.renderOrder = 1;
    root.add(mesh);
    return mesh;
  });

  // ---------- The crowd's mood ----------
  let mood: Mood = 'idle';
  let moodLeft = 0;

  return {
    water: palette.water,
    update(skiZ, camera, delta, time) {
      lastSkiZ = skiZ;
      dome.position.set(camera.x, 0, camera.z);
      farWater.position.x = camera.x;
      farWater.position.z = camera.z;
      // Recycle: chunks from one behind the ski out to the fog.
      const base = Math.floor(-skiZ / CHUNK) - 1;
      for (let s = 0; s < SLOTS; s++) {
        const c = base + ((((s - base) % SLOTS) + SLOTS) % SLOTS);
        if (slots[s].chunk !== c) layout(slots[s], c);
      }
      moodLeft = Math.max(moodLeft - delta, 0);
      if (moodLeft <= 0) mood = 'idle';
      const amount = Math.min(1, moodLeft / 0.3);
      for (const slot of slots) {
        animateCrowd(slot, time, mood, mood === 'idle' ? 0 : Math.max(amount, 0.0001));
        slot.boats.forEach((boat, i) => {
          const y = swell(boat.position.x, boat.position.z + slot.group.position.z, time);
          boat.position.y = y + 0.08;
          boat.rotation.z = Math.sin(time * 1.4 + i + slot.chunk) * 0.05;
          boat.rotation.x = Math.sin(time * 1.1 + i * 2) * 0.03;
        });
      }
      nextLeap -= delta;
      if (nextLeap <= 0) {
        nextLeap = 4 + Math.random() * 5;
        startLeap(skiZ);
      }
      for (const l of leapers) {
        if (l.life <= 0) continue;
        l.t += delta;
        const u = l.t / l.life;
        if (u >= 1) {
          l.life = 0;
          l.dolphin.object.visible = false;
          continue;
        }
        const arcY = 3.2 * 4 * u * (1 - u) - 0.9;
        l.dolphin.object.position.set(l.x + l.dir * (u - 0.5) * 3, arcY, l.z - (u - 0.5) * 4);
        l.dolphin.pose(u);
        l.dolphin.object.rotation.y = 0.5 * l.dir;
        l.dolphin.update(time);
      }
    },
    cheer() {
      mood = 'cheer';
      moodLeft = 2.2;
    },
    groan() {
      mood = 'groan';
      moodLeft = 2.4;
    },
    setShadow(slot, x, z, height) {
      const shadow = shadows[slot];
      const visible = height > 0.15 && height < 16;
      shadow.visible = visible;
      if (!visible) return;
      // A soft round blob that shrinks and fades the higher the thing is.
      const k = Math.max(0.9, 2.6 - height * 0.14);
      shadow.scale.set(k, 1, k);
      shadow.position.set(x, 0.05, z);
      (shadow.material as MeshBasicMaterial).opacity = Math.max(0.18, 0.85 - height * 0.07);
    },
    leapDolphin() {
      startLeap(lastSkiZ);
    },
    dispose() {
      leapers.forEach((l) => l.dolphin.dispose());
      for (const slot of slots) {
        slot.crowd.bodies.dispose();
        slot.crowd.heads.dispose();
        slot.crowd.arms.dispose();
      }
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      shadowTexture?.dispose();
      root.removeFromParent();
      scene.fog = null;
    },
  };
}
