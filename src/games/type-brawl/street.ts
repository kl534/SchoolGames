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
import { createBackdrop, groundTexture, type Backdrop } from './backdrop';
import type { StageDef, StageId, StagePalette } from './rules';

/** Scenery is spawned in chunks this long (world units) ahead of the camera and recycled behind it. */
export const CHUNK = 12;
const BUILDING_Z = -6.5;
const PROP_Z = -2.5;
const QUAY_Z = -1.0;
/** World units one tile of the ground textures covers. */
const TILE = 8;

/** How the buildings behind the lane of each stage are shaped (heights in world units). */
const LOOKS: Record<StageId, { minH: number; maxH: number; minW: number; maxW: number }> = {
  street: { minH: 4.2, maxH: 8, minW: 3.4, maxW: 5.6 },
  docks: { minH: 3.4, maxH: 6, minW: 4.4, maxW: 7 },
  dojo: { minH: 3.2, maxH: 4.6, minW: 4.6, maxW: 6.6 },
  rooftop: { minH: 2.4, maxH: 9, minW: 2.8, maxW: 5 },
  jungle: { minH: 2.6, maxH: 6, minW: 3.6, maxW: 5.6 },
  snow: { minH: 2.8, maxH: 4.4, minW: 4.2, maxW: 6.2 },
};

/** A shipping container's ribs, in grey so the material colour tints it. */
function containerPaint(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#e8e8e8';
    g.fillRect(0, 0, 128, 64);
    for (let x = 4; x < 128; x += 8) {
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fillRect(x, 4, 3, 56);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(x + 3, 4, 2, 56);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, 128, 4);
    g.fillRect(0, 60, 128, 4);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Yellow and black warning stripes. */
function hazardPaint(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 16;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#f2c230';
    g.fillRect(0, 0, 64, 16);
    g.fillStyle = '#1c1c1c';
    for (let x = -16; x < 80; x += 16) {
      g.beginPath();
      g.moveTo(x, 16);
      g.lineTo(x + 8, 16);
      g.lineTo(x + 16, 0);
      g.lineTo(x + 8, 0);
      g.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export interface Street {
  /** The scenery and lights; add it to the scene. */
  readonly object: Group;
  /** Builds the chunks the camera needs around `cameraX` and drops the ones far behind it. */
  update(cameraX: number, seconds?: number): void;
  dispose(): void;
}

/** The chunk indexes that must exist when the camera is at `cameraX` (one behind, two ahead). */
export function chunksFor(cameraX: number): number[] {
  const mid = Math.floor(cameraX / CHUNK);
  return [mid - 1, mid, mid + 1, mid + 2];
}

/** The wall of a building, painted for its stage; the ground floor is left plain for the shopfront. */
function facadeTexture(
  id: StageId,
  palette: [string, string, string],
  seed: number,
): CanvasTexture {
  const W = 192;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const random = seededRandom(seed);
  if (g) {
    g.fillStyle = palette[0];
    g.fillRect(0, 0, W, H);
    if (id === 'street') {
      // Brick courses, then rows of framed windows with sills, and a cornice.
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < H; y += 8) g.fillRect(0, y, W, 1);
      for (let y = 0, r = 0; y < H; y += 8, r++)
        for (let x = (r % 2) * 8; x < W; x += 16) g.fillRect(x, y, 1, 8);
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
          const x = 14 + col * 44;
          const y = 14 + row * 32;
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.fillRect(x - 3, y - 3, 30, 26);
          g.fillStyle = random() < 0.35 ? palette[2] : palette[1];
          g.fillRect(x, y, 24, 20);
          g.fillStyle = 'rgba(255,255,255,0.4)';
          g.fillRect(x + 11, y, 2, 20);
          g.fillRect(x - 4, y + 21, 32, 3);
        }
      }
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, 0, W, 6);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(0, 6, W, 2);
    } else if (id === 'docks') {
      // Corrugated sheet metal with rust streaks, a few high windows and a painted number.
      for (let x = 0; x < W; x += 6) {
        g.fillStyle = 'rgba(255,255,255,0.1)';
        g.fillRect(x, 0, 3, H);
        g.fillStyle = 'rgba(0,0,0,0.14)';
        g.fillRect(x + 3, 0, 3, H);
      }
      for (let i = 0; i < 6; i++) {
        g.fillStyle = 'rgba(110,50,20,0.22)';
        g.fillRect(random() * W, random() * 120, 5 + random() * 8, 60 + random() * 80);
      }
      for (let col = 0; col < 4; col++) {
        const x = 14 + col * 44;
        g.fillStyle = '#2a2420';
        g.fillRect(x - 2, 20, 30, 18);
        g.fillStyle = random() < 0.4 ? palette[2] : palette[1];
        g.fillRect(x, 22, 26, 14);
      }
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.font = 'bold 34px sans-serif';
      g.fillText(String(1 + Math.floor(random() * 9)), 82, 100);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, 0, W, 5);
    } else if (id === 'dojo') {
      // Plaster wall with dark timber posts and shoji paper panels glowing from inside.
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const x = 12 + col * 60;
          const y = 16 + row * 100;
          g.fillStyle = palette[2];
          g.fillRect(x, y, 48, 82);
          g.strokeStyle = palette[1];
          g.lineWidth = 3;
          g.strokeRect(x, y, 48, 82);
          g.lineWidth = 1.5;
          for (let k = 1; k < 3; k++) {
            g.beginPath();
            g.moveTo(x + k * 16, y);
            g.lineTo(x + k * 16, y + 82);
            g.stroke();
          }
          for (let k = 1; k < 5; k++) {
            g.beginPath();
            g.moveTo(x, y + k * 16.4);
            g.lineTo(x + 48, y + k * 16.4);
            g.stroke();
          }
          if (random() < 0.4) {
            // A silhouette behind the paper.
            g.fillStyle = 'rgba(60,30,10,0.25)';
            g.beginPath();
            g.arc(x + 24, y + 42, 9, 0, 6.28);
            g.fill();
            g.fillRect(x + 16, y + 50, 16, 32);
          }
        }
      }
      g.fillStyle = palette[1];
      for (const x of [0, 66, 126, 186]) g.fillRect(x, 0, 6, H);
      g.fillRect(0, 4, W, 8);
      g.fillRect(0, 110, W, 5);
    } else if (id === 'jungle') {
      // Mossy carved stone blocks, glowing glyphs, and vines hanging from the top.
      g.fillStyle = 'rgba(0,0,0,0.2)';
      for (let y = 0; y < H; y += 32) g.fillRect(0, y, W, 3);
      for (let y = 0, r = 0; y < H; y += 32, r++)
        for (let x = (r % 2) * 32; x < W; x += 64) g.fillRect(x, y, 3, 32);
      for (let i = 0; i < 20; i++) {
        g.fillStyle = `rgba(60,120,40,${0.15 + random() * 0.25})`;
        g.fillRect(random() * W, random() * H, 10 + random() * 24, 8 + random() * 14);
      }
      g.save();
      g.translate(0, 90);
      for (let k = 0; k < 3; k++) {
        const x = 20 + k * 62;
        g.fillStyle = palette[1];
        g.fillRect(x, 40, 34, 40);
        g.fillStyle = palette[2];
        g.fillRect(x + 8, 50, 6, 6);
        g.fillRect(x + 20, 50, 6, 6);
        g.fillRect(x + 10, 64, 16, 4);
      }
      g.restore();
      g.strokeStyle = '#2c7a30';
      g.lineWidth = 3;
      for (let v = 0; v < 9; v++) {
        const x = random() * W;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + (random() - 0.5) * 10, 30 + random() * 90);
        g.stroke();
      }
    } else if (id === 'snow') {
      // A log chalet: horizontal logs, shuttered windows with warm light and frosted sills.
      for (let y = 0; y < H; y += 16) {
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(0, y + 13, W, 3);
        g.fillStyle = 'rgba(255,220,170,0.1)';
        g.fillRect(0, y, W, 4);
      }
      g.save();
      g.translate(0, 90);
      for (let k = 0; k < 3; k++) {
        const x = 18 + k * 58;
        g.fillStyle = '#3a2412';
        g.fillRect(x - 5, 28, 46, 52);
        g.fillStyle = random() < 0.75 ? palette[2] : palette[1];
        g.fillRect(x, 33, 36, 42);
        g.fillStyle = '#3a2412';
        g.fillRect(x + 16, 33, 4, 42);
        g.fillRect(x, 52, 36, 4);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.fillRect(x - 6, 76, 48, 6);
      }
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(0, 0, W, 7);
    } else {
      // A glass tower at night: tight rows of windows, many lit, with a lit crown.
      for (let row = 0; row < 14; row++) {
        for (let col = 0; col < 8; col++) {
          const roll = random();
          g.fillStyle = roll < 0.45 ? palette[2] : roll < 0.55 ? '#ffffff' : palette[1];
          g.fillRect(8 + col * 22, 10 + row * 17, 14, 10);
        }
      }
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(0, 0, 5, H);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(W - 5, 0, 5, H);
    }
    // Soft shade towards the bottom so the lane's edge reads as darker.
    const shade = g.createLinearGradient(0, H * 0.6, 0, H);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = shade;
    g.fillRect(0, H * 0.6, W, H * 0.4);
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
  const laneTexture = groundTexture(stage.id, 'lane', pal);
  const stripTexture = groundTexture(stage.id, 'strip', pal);
  const asphalt = new MeshStandardMaterial({ map: laneTexture, roughness: 0.9 });
  const sidewalk = new MeshStandardMaterial({ map: stripTexture, roughness: 0.9 });
  const backdrop: Backdrop = createBackdrop(scene, stage.id);
  object.add(backdrop.object);
  const nightGlow = (color: number, intensity = 1) =>
    new MeshStandardMaterial({
      color: new Color(color),
      emissive: new Color(color),
      emissiveIntensity: intensity,
      roughness: 0.6,
    });
  const awnings = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f].map((c) => material(c));
  const neons = [0xff4fa3, 0x4fe3ff, 0xffd84f, 0x7dff6a].map((c) => nightGlow(c, 1.3));
  const containerTexture = containerPaint();
  const containers = [0xc0392b, 0x2e86c1, 0xd68910, 0x1e8449, 0x7d3c98].map(
    (c) => new MeshStandardMaterial({ color: new Color(c), map: containerTexture, roughness: 0.7 }),
  );
  const toriiRed = nightGlow(0xc8301f, 0.25);
  const tile = material(0x2f3a4a);
  const blossom = material(0xf7a8c4);
  const blossomLight = material(0xffc9dc);
  const stone = material(0x8b8b86);
  const billboardFrame = material(0x20243a);
  const glass = nightGlow(0x9ee7ff, 0.9);
  const hazard = new MeshStandardMaterial({ map: hazardPaint(), roughness: 0.8 });
  const carColors = [0xc0392b, 0x2e86c1, 0xf1c40f, 0xecf0f1].map((c) => material(c));
  const carGlass = material(0x23303f);
  const hydrant = material(0xd62d20);
  const rollDoor = material(0x8a93a0);
  const seaTexture = stage.id === 'docks' ? groundTexture('docks', 'strip', pal) : undefined;
  seaTexture?.repeat.set(240 / TILE, 90 / TILE);
  const water = new MeshStandardMaterial({ map: seaTexture, roughness: 0.4, metalness: 0.1 });
  const quayWood = material(0x6e4a2b);
  const snowWhite = material(0xf4f8ff);
  const pineGreen = material(0x1f5a3a);
  const pineGreenLight = material(0x2c7a4c);
  const carrot = material(0xf08a24);
  const palmGreen = material(0x2f9a45);
  const palmTrunk = material(0x8a6a3a);
  const mossStone = material(0x7f8c6a);
  const glyphGlow = nightGlow(0xffd36a, 0.9);

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
  const textures = pal.walls.map((p, i) => facadeTexture(stage.id, p, 11 + i));
  const walls = textures.map((map) => new MeshStandardMaterial({ map, roughness: 0.9 }));
  const roof = material(pal.roof);
  const owned: MeshStandardMaterial[] = [
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
    ...awnings,
    ...neons,
    ...containers,
    toriiRed,
    tile,
    blossom,
    blossomLight,
    stone,
    billboardFrame,
    glass,
    hazard,
    ...carColors,
    carGlass,
    hydrant,
    rollDoor,
    water,
    quayWood,
    snowWhite,
    pineGreen,
    pineGreenLight,
    carrot,
    palmGreen,
    palmTrunk,
    mossStone,
    glyphGlow,
  ];
  const ownedTextures = [laneTexture, stripTexture, containerTexture, hazard.map, seaTexture];

  // The ground follows the camera; everything with a pattern is in the chunks.
  const road = new Mesh(flat, asphalt);
  road.rotation.x = -Math.PI / 2;
  // On the docks the ground stops at the water's edge.
  const roadBack = pal.sunken ? -1.2 : -12;
  road.scale.set(80, 32 - roadBack, 1);
  laneTexture.repeat.set(80 / TILE, (32 - roadBack) / TILE);
  road.position.set(0, 0, (32 + roadBack) / 2);
  object.add(road);
  const walk = new Mesh(unit, sidewalk);
  walk.scale.set(80, 0.12, 4);
  stripTexture.repeat.set(80 / TILE, 4 / TILE);
  walk.position.set(0, pal.sunken ? -0.12 : 0.06, -3.2);
  object.add(walk);
  const edge = new Mesh(unit, kerb);
  edge.scale.set(80, 0.13, 0.15);
  edge.position.set(0, 0.065, -1.2);
  object.add(edge);

  // Docks: open water out to the horizon, with a far quay for the warehouses to stand on.
  let sea: Mesh | undefined;
  let farQuay: Mesh | undefined;
  let rimMesh: Mesh | undefined;
  if (stage.id === 'docks') {
    sea = new Mesh(flat, water);
    sea.rotation.x = -Math.PI / 2;
    sea.scale.set(240, 90, 1);
    sea.position.set(0, -0.14, -46);
    object.add(sea);
    farQuay = new Mesh(unit, quayWood);
    farQuay.scale.set(80, 0.2, 5);
    farQuay.position.set(0, -0.02, -6.8);
    object.add(farQuay);
  }
  // The dojo's veranda edge is a wooden step; the rooftop has a lit parapet.
  if (stage.id === 'dojo') {
    edge.scale.set(80, 0.22, 0.4);
    edge.position.y = 0.11;
  } else if (stage.id === 'rooftop') {
    edge.scale.set(80, 0.5, 0.3);
    edge.position.set(0, 0.25, -1.2);
    const rim = new Mesh(unit, neons[1]);
    rim.scale.set(80, 0.04, 0.06);
    rim.position.set(0, 0.52, -1.2);
    object.add(rim);
    rimMesh = rim;
  }

  const chunks = new Map<number, Group>();
  const look = LOOKS[stage.id];

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
    for (let d = 0; d < (stage.id === 'street' || stage.id === 'rooftop' ? 4 : 0); d++) {
      const dash = add(unit, paint);
      dash.scale.set(1.6, 0.02, 0.14);
      dash.position.set(d * 3 + 1.2, 0.011, 1.1);
    }

    // Dashes of the lane line (the street) or the lane's own markings.
    if (stage.id === 'street' && index % 2 === 0) {
      // A zebra crossing.
      for (let z = 0; z < 6; z++) {
        const bar = add(unit, paint);
        bar.scale.set(0.5, 0.02, 2.6);
        bar.position.set(CHUNK * 0.55 + z * 0.9, 0.012, 0.1);
      }
    }
    if (stage.id === 'rooftop') {
      // A painted helipad ring and hazard stripes along the parapet.
      const stripe = add(unit, hazard);
      stripe.scale.set(CHUNK, 0.02, 0.22);
      stripe.position.set(CHUNK / 2, 0.012, -0.95);
    }

    // Buildings along the back, side by side with small gaps.
    let x = random() * 0.6;
    while (x < CHUNK - look.minW) {
      const width = look.minW + random() * (look.maxW - look.minW);
      const height = look.minH + random() * (look.maxH - look.minH);
      const palette = Math.floor(random() * walls.length);
      const cx = x + width / 2;
      const front = BUILDING_Z + 1.5;
      const body = add(unit, walls[palette]);
      body.scale.set(width, height, 3);
      body.position.set(cx, height / 2, BUILDING_Z);
      if (stage.id === 'dojo') {
        // A hall: two stacked tile roofs with wide eaves, red posts and a hanging lantern.
        const eave = add(unit, tile);
        eave.scale.set(width + 1.4, 0.22, 4.2);
        eave.position.set(cx, height * 0.52, BUILDING_Z + 0.4);
        const eaveTip = add(unit, tile);
        eaveTip.scale.set(width + 1.9, 0.12, 4.5);
        eaveTip.position.set(cx, height * 0.52 - 0.12, BUILDING_Z + 0.4);
        const upper = add(unit, tile);
        upper.scale.set(width + 0.8, 0.3, 3.6);
        upper.position.set(cx, height + 0.1, BUILDING_Z);
        const ridge = add(unit, tile);
        ridge.scale.set(width * 0.7, 0.45, 2.4);
        ridge.position.set(cx, height + 0.45, BUILDING_Z);
        for (const dx of [-width / 2 + 0.1, width / 2 - 0.1]) {
          const post = add(cylinder, toriiRed);
          post.scale.set(0.12, height * 0.52, 0.12);
          post.position.set(cx + dx, height * 0.26, front + 0.1);
          const horn = add(ball, tile);
          horn.scale.set(0.2, 0.2, 0.2);
          horn.position.set(cx + dx * 1.18, height * 0.52 + 0.1, BUILDING_Z + 2.2);
        }
        const lamp = add(ball, lanternRed);
        lamp.scale.set(0.2, 0.28, 0.2);
        lamp.position.set(cx, height * 0.52 - 0.5, front + 0.5);
      } else if (stage.id === 'snow') {
        // A chalet roof: a thick snow cap with a deep overhang, and a smoking chimney.
        const cap = add(unit, snowWhite);
        cap.scale.set(width + 0.6, 0.55, 3.8);
        cap.position.set(cx, height + 0.2, BUILDING_Z + 0.2);
        const ridgeCap = add(unit, snowWhite);
        ridgeCap.scale.set(width * 0.6, 0.5, 2.6);
        ridgeCap.position.set(cx, height + 0.65, BUILDING_Z);
        const chimney = add(unit, mossStone);
        chimney.scale.set(0.45, 0.9, 0.45);
        chimney.position.set(cx + width * 0.3, height + 0.9, BUILDING_Z);
        const chimneyCap = add(unit, snowWhite);
        chimneyCap.scale.set(0.55, 0.12, 0.55);
        chimneyCap.position.set(cx + width * 0.3, height + 1.4, BUILDING_Z);
      } else if (stage.id === 'jungle') {
        // A ruined temple block: stepped top, a broken corner and a leafy crown.
        const step = add(unit, mossStone);
        step.scale.set(width * 0.8, 0.5, 2.6);
        step.position.set(cx, height + 0.25, BUILDING_Z);
        const stepTop = add(unit, mossStone);
        stepTop.scale.set(width * 0.5, 0.5, 2);
        stepTop.position.set(cx - width * 0.1, height + 0.75, BUILDING_Z);
        const bush = add(ball, leaf);
        bush.scale.set(width * 0.28, 0.35, 0.9);
        bush.position.set(cx + width * 0.2, height + 0.55, BUILDING_Z + 0.9);
        const glyph = add(unit, glyphGlow);
        glyph.scale.set(0.3, 0.3, 0.06);
        glyph.position.set(cx, height * 0.55, front + 0.05);
        const column = add(cylinder, mossStone);
        column.scale.set(0.28, height * 0.8, 0.28);
        column.position.set(cx - width / 2 + 0.2, height * 0.4, front + 0.3);
      } else {
        const top = add(unit, roof);
        top.scale.set(width + 0.2, 0.25, 3.2);
        top.position.set(cx, height + 0.12, BUILDING_Z);
      }

      if (stage.id === 'street') {
        // A shopfront: dark window, door, striped awning and a neon sign.
        const shopH = 2.2;
        const frontage = add(unit, carGlass);
        frontage.scale.set(width * 0.86, shopH, 0.1);
        frontage.position.set(cx, shopH / 2 + 0.05, front + 0.03);
        const glassLit = add(unit, neons[Math.floor(random() * neons.length)]);
        glassLit.scale.set(width * 0.3, shopH * 0.5, 0.05);
        glassLit.position.set(cx - width * 0.2, shopH * 0.45, front + 0.1);
        const awning = add(unit, awnings[Math.floor(random() * awnings.length)]);
        awning.scale.set(width * 0.9, 0.1, 0.9);
        awning.rotation.x = 0.35;
        awning.position.set(cx, shopH + 0.15, front + 0.45);
        const sign = add(unit, neons[Math.floor(random() * neons.length)]);
        sign.scale.set(width * 0.4, 0.28, 0.06);
        sign.position.set(cx, shopH + 0.75, front + 0.05);
      } else if (stage.id === 'docks') {
        // A roll-up door with warning stripes over it, and a hanging lamp.
        const door = add(unit, rollDoor);
        door.scale.set(width * 0.55, 2.3, 0.1);
        door.position.set(cx, 1.2, front + 0.05);
        const stripe = add(unit, hazard);
        stripe.scale.set(width * 0.6, 0.18, 0.12);
        stripe.position.set(cx, 2.5, front + 0.08);
        const lamp = add(ball, lanternRed);
        lamp.scale.set(0.14, 0.14, 0.14);
        lamp.position.set(cx + width * 0.4, 2.6, front + 0.2);
      } else if (stage.id === 'rooftop') {
        // A neon strip along the roof edge and a rooftop unit.
        const strip = add(unit, neons[Math.floor(random() * neons.length)]);
        strip.scale.set(width, 0.08, 0.08);
        strip.position.set(cx, height + 0.3, front + 0.05);
        const unitBox = add(unit, metal);
        unitBox.scale.set(0.9, 0.5, 0.8);
        unitBox.position.set(cx - width * 0.25, height + 0.5, BUILDING_Z);
      }
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
      } else if (kind === 'car') {
        const body = add(unit, carColors[Math.floor(random() * carColors.length)]);
        body.scale.set(2.1, 0.5, 0.95);
        body.position.set(px, 0.42, z - 0.3);
        const cabin = add(unit, carGlass);
        cabin.scale.set(1.1, 0.42, 0.85);
        cabin.position.set(px - 0.1, 0.88, z - 0.3);
        for (const dx of [-0.65, 0.65]) {
          const wheel = add(cylinder, carGlass);
          wheel.rotation.x = Math.PI / 2;
          wheel.scale.set(0.24, 0.12, 0.24);
          wheel.position.set(px + dx, 0.24, z + 0.2);
        }
      } else if (kind === 'hydrant') {
        const body = add(cylinder, hydrant);
        body.scale.set(0.14, 0.5, 0.14);
        body.position.set(px, 0.37, z + 0.8);
        const cap = add(ball, hydrant);
        cap.scale.set(0.16, 0.12, 0.16);
        cap.position.set(px, 0.66, z + 0.8);
      } else if (kind === 'container') {
        const mat = containers[Math.floor(random() * containers.length)];
        const lower = add(unit, mat);
        lower.scale.set(2.4, 0.9, 1);
        lower.position.set(px, 0.55, z - 0.5);
        if (random() < 0.6) {
          const upper = add(unit, containers[Math.floor(random() * containers.length)]);
          upper.scale.set(2.4, 0.9, 1);
          upper.position.set(px + 0.1, 1.47, z - 0.5);
        }
      } else if (kind === 'torii') {
        for (const dx of [-0.9, 0.9]) {
          const leg = add(cylinder, toriiRed);
          leg.scale.set(0.12, 2.8, 0.12);
          leg.position.set(px + dx, 1.4 + y0, z - 0.4);
        }
        const beam = add(unit, toriiRed);
        beam.scale.set(2.5, 0.16, 0.18);
        beam.position.set(px, 2.7, z - 0.4);
        const tie = add(unit, toriiRed);
        tie.scale.set(1.9, 0.1, 0.12);
        tie.position.set(px, 2.35, z - 0.4);
        const cap = add(unit, tile);
        cap.scale.set(2.8, 0.1, 0.26);
        cap.position.set(px, 2.84, z - 0.4);
      } else if (kind === 'sakura') {
        const trunk = add(cylinder, darkWood);
        trunk.scale.set(0.12, 1.9, 0.12);
        trunk.position.set(px, 0.95 + y0, z);
        for (let c = 0; c < 4; c++) {
          const puff = add(ball, c % 2 ? blossom : blossomLight);
          puff.scale.set(0.6, 0.5, 0.6);
          puff.position.set(px + (c - 1.5) * 0.35, 2.1 + (c % 2) * 0.3, z + (c % 2) * 0.2);
        }
      } else if (kind === 'stonelamp') {
        const base = add(cylinder, stone);
        base.scale.set(0.16, 0.45, 0.16);
        base.position.set(px, 0.35, z);
        const box = add(unit, stone);
        box.scale.set(0.34, 0.26, 0.34);
        box.position.set(px, 0.72, z);
        const glow = add(unit, lanternRed);
        glow.scale.set(0.18, 0.14, 0.2);
        glow.position.set(px, 0.72, z + 0.02);
        const cap = add(unit, stone);
        cap.scale.set(0.5, 0.1, 0.5);
        cap.position.set(px, 0.92, z);
      } else if (kind === 'palm') {
        const lean = (random() - 0.5) * 0.3;
        const trunk = add(cylinder, palmTrunk);
        trunk.scale.set(0.12, 2.6, 0.12);
        trunk.rotation.z = lean;
        trunk.position.set(px, 1.3 + y0, z);
        for (let f = 0; f < 6; f++) {
          const frond = add(unit, palmGreen);
          frond.scale.set(1.1, 0.04, 0.22);
          frond.rotation.z = (f % 2 ? -1 : 1) * (0.35 + (f % 3) * 0.12);
          frond.rotation.y = (f * Math.PI) / 3;
          frond.position.set(px - lean * 2.6 * 1.3, 2.7 + y0, z);
        }
      } else if (kind === 'fern') {
        for (let f = 0; f < 5; f++) {
          const frond = add(unit, f % 2 ? leaf : palmGreen);
          frond.scale.set(0.8, 0.03, 0.14);
          frond.rotation.z = 0.7 - f * 0.3;
          frond.rotation.y = f * 0.7;
          frond.position.set(px, 0.35, z + 0.4);
        }
      } else if (kind === 'totem') {
        for (let t = 0; t < 3; t++) {
          const block = add(unit, t === 1 ? glyphGlow : mossStone);
          block.scale.set(0.6, 0.62, 0.6);
          block.position.set(px, 0.4 + t * 0.64, z - 0.2);
        }
        const hat = add(unit, mossStone);
        hat.scale.set(0.85, 0.12, 0.85);
        hat.position.set(px, 2.35, z - 0.2);
      } else if (kind === 'pine') {
        const trunk = add(cylinder, wood);
        trunk.scale.set(0.1, 0.5, 0.1);
        trunk.position.set(px, 0.3 + y0, z);
        for (let t = 0; t < 3; t++) {
          const cone = add(cylinder, t % 2 ? pineGreenLight : pineGreen);
          cone.scale.set(0.75 - t * 0.2, 0.75, 0.75 - t * 0.2);
          cone.position.set(px, 0.95 + t * 0.55, z);
          const snowCap = add(cylinder, snowWhite);
          snowCap.scale.set(0.5 - t * 0.14, 0.12, 0.5 - t * 0.14);
          snowCap.position.set(px, 1.18 + t * 0.55, z);
        }
      } else if (kind === 'snowman') {
        const bottom = add(ball, snowWhite);
        bottom.scale.set(0.42, 0.4, 0.42);
        bottom.position.set(px, 0.5, z + 0.6);
        const middle = add(ball, snowWhite);
        middle.scale.set(0.3, 0.3, 0.3);
        middle.position.set(px, 1.0, z + 0.6);
        const head = add(ball, snowWhite);
        head.scale.set(0.22, 0.22, 0.22);
        head.position.set(px, 1.36, z + 0.6);
        const nose = add(cylinder, carrot);
        nose.rotation.x = Math.PI / 2;
        nose.scale.set(0.035, 0.18, 0.035);
        nose.position.set(px, 1.36, z + 0.82);
        const hat = add(cylinder, darkWood);
        hat.scale.set(0.16, 0.2, 0.16);
        hat.position.set(px, 1.65, z + 0.6);
      } else if (kind === 'billboard') {
        for (const dx of [-0.9, 0.9]) {
          const leg = add(cylinder, metal);
          leg.scale.set(0.05, 2.2, 0.05);
          leg.position.set(px + dx, 1.1, z - 0.3);
        }
        const frame = add(unit, billboardFrame);
        frame.scale.set(2.4, 1.1, 0.1);
        frame.position.set(px, 2.5, z - 0.3);
        const screen = add(unit, neons[Math.floor(random() * neons.length)]);
        screen.scale.set(2.2, 0.9, 0.06);
        screen.position.set(px, 2.5, z - 0.22);
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
    update(cameraX, seconds = 0) {
      road.position.x = cameraX;
      walk.position.x = cameraX;
      edge.position.x = cameraX;
      if (rimMesh) rimMesh.position.x = cameraX;
      laneTexture.offset.x = cameraX / TILE;
      stripTexture.offset.x = cameraX / TILE;
      if (sea) {
        sea.position.x = cameraX;
        farQuay!.position.x = cameraX;
        if (seaTexture) {
          seaTexture.offset.x = cameraX / TILE + seconds * 0.03;
          seaTexture.offset.y = Math.sin(seconds * 0.4) * 0.02;
        }
      }
      backdrop.update(cameraX, seconds);
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
      backdrop.dispose();
      for (const t of ownedTextures) t?.dispose();
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
