/**
 * The school blacktop: ten painted lanes, the start and finish lines with the red tape, the
 * podium past the finish and the playground around it (fence, swings, slide, climbing frame,
 * hopscotch, hoop, trees and the school). Built once; it is short, so nothing is recycled.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Scene,
} from 'three';
import { createTape, type Tape } from './effects';
import {
  FINISH_Z,
  LANES,
  LANE_W,
  PODIUM_BLOCK_W,
  PODIUM_HEIGHTS,
  PODIUM_Z,
  START_Z,
} from './layout';

export const SKY = 0x9fd8ff;
/** Half the blacktop's width. */
export const TRACK_HALF = 8;
/** Where the fence stands. */
export const FENCE_X = TRACK_HALF + 0.3;
export const BLACKTOP_FROM = 12;
export const BLACKTOP_TO = -130;

export interface Track {
  object: Group;
  tape: Tape;
  dispose(): void;
}

const std = (color: number, roughness = 0.8): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness });

function canvasTexture(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D) => void,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (g) draw(g);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createTrack(scene: Scene): Track {
  const object = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: CanvasTexture[] = [];

  const box = (
    parent: Group,
    w: number,
    h: number,
    d: number,
    material: Material,
    x: number,
    y: number,
    z: number,
  ): Mesh => {
    const geometry = new BoxGeometry(w, h, d);
    geometries.push(geometry);
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cylinder = (
    parent: Group,
    r: number,
    h: number,
    material: Material,
    x: number,
    y: number,
    z: number,
  ): Mesh => {
    const geometry = new CylinderGeometry(r, r, h, 10);
    geometries.push(geometry);
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const flat = (
    parent: Group,
    w: number,
    d: number,
    material: Material,
    x: number,
    y: number,
    z: number,
  ): Mesh => {
    const geometry = new PlaneGeometry(w, d);
    geometries.push(geometry);
    const m = new Mesh(geometry, material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const keep = <M extends Material>(m: M): M => {
    materials.push(m);
    return m;
  };

  // ---------- Light and sky ----------
  scene.background = new Color(SKY);
  const hemi = new HemisphereLight(0xdff1ff, 0x6a7a55, 1.0);
  const sun = new DirectionalLight(0xfff1d0, 1.5);
  sun.position.set(-18, 30, 14);
  object.add(hemi, sun);

  // ---------- Ground and blacktop ----------
  const grass = keep(std(0x6dbb55, 1));
  flat(object, 160, 240, grass, 0, -0.02, -60);
  const asphalt = keep(std(0x3b3f46, 0.95));
  const length = BLACKTOP_FROM - BLACKTOP_TO;
  flat(object, TRACK_HALF * 2, length, asphalt, 0, 0, (BLACKTOP_FROM + BLACKTOP_TO) / 2);

  const paint = keep(new MeshBasicMaterial({ color: 0xffffff }));
  // Lane lines from the start to the finish.
  for (let j = 1; j <= LANES + 1; j++) {
    flat(object, 0.06, -FINISH_Z, paint, (j - 6) * LANE_W, 0.006, FINISH_Z / 2);
  }
  // The start line and the finish line (chequered).
  flat(object, LANES * LANE_W, 0.16, paint, 0, 0.007, START_Z);
  const checker = canvasTexture(256, 32, (g) => {
    for (let i = 0; i < 32; i++) {
      for (let row = 0; row < 4; row++) {
        g.fillStyle = (i + row) % 2 ? '#111111' : '#ffffff';
        g.fillRect(i * 8, row * 8, 8, 8);
      }
    }
  });
  textures.push(checker);
  const checkered = keep(new MeshBasicMaterial({ map: checker }));
  flat(object, LANES * LANE_W, 0.5, checkered, 0, 0.008, FINISH_Z);

  // The lane numbers, painted just before the start line (upright from behind).
  const numbers = canvasTexture(1280, 128, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = '900 100px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let lane = 1; lane <= LANES; lane++) g.fillText(String(lane), (lane - 0.5) * 128, 70);
  });
  textures.push(numbers);
  const numberMaterial = keep(new MeshBasicMaterial({ map: numbers, transparent: true }));
  flat(object, LANES * LANE_W, LANE_W, numberMaterial, 0, 0.009, START_Z + 1.3);

  // ---------- The finish: two red posts and the tape ----------
  const red = keep(std(0xe11d2e, 0.5));
  const postX = (LANES * LANE_W) / 2 + 0.3;
  for (const side of [-1, 1]) {
    cylinder(object, 0.07, 1.4, red, side * postX, 0.7, FINISH_Z);
    const cap = new Mesh(new SphereGeometry(0.11, 10, 8), red);
    geometries.push(cap.geometry);
    cap.position.set(side * postX, 1.42, FINISH_Z);
    object.add(cap);
  }
  const tape = createTape(postX, 1.15);
  tape.object.position.z = FINISH_Z;
  object.add(tape.object);

  // ---------- The podium ----------
  const white = keep(std(0xf8fafc, 0.6));
  PODIUM_HEIGHTS.forEach((height, i) => {
    const x = i === 0 ? 0 : i === 1 ? -PODIUM_BLOCK_W : PODIUM_BLOCK_W;
    box(object, PODIUM_BLOCK_W - 0.05, height, 1.2, white, x, height / 2, PODIUM_Z);
    const label = canvasTexture(128, 128, (g) => {
      g.fillStyle = '#1d4ed8';
      g.font = '900 100px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(i + 1), 64, 70);
    });
    textures.push(label);
    const plate = keep(new MeshBasicMaterial({ map: label, transparent: true }));
    const front = new Mesh(new PlaneGeometry(0.6, 0.6), plate);
    geometries.push(front.geometry);
    front.position.set(x, Math.max(0.25, height / 2), PODIUM_Z + 0.61);
    object.add(front);
  });

  // ---------- The fence along both sides ----------
  const fenceGreen = keep(std(0x2f8f46, 0.7));
  for (const side of [-1, 1]) {
    box(
      object,
      0.08,
      0.08,
      length,
      fenceGreen,
      side * FENCE_X,
      0.7,
      (BLACKTOP_FROM + BLACKTOP_TO) / 2,
    );
    box(
      object,
      0.08,
      0.08,
      length,
      fenceGreen,
      side * FENCE_X,
      0.25,
      (BLACKTOP_FROM + BLACKTOP_TO) / 2,
    );
    for (let z = BLACKTOP_FROM; z >= BLACKTOP_TO; z -= 3) {
      box(object, 0.1, 0.8, 0.1, fenceGreen, side * FENCE_X, 0.4, z);
    }
  }

  // ---------- The playground ----------
  const metal = keep(std(0xcbd5e1, 0.4));
  const bright = [0xef4444, 0xfacc15, 0x3b82f6, 0x22c55e].map((c) => keep(std(c, 0.6)));

  const swings = (x: number, z: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    for (const s of [-1, 1]) {
      const a = box(g, 0.1, 2.6, 0.1, metal, s * 1.6, 1.3, 0.8);
      a.rotation.x = -0.25;
      const b = box(g, 0.1, 2.6, 0.1, metal, s * 1.6, 1.3, -0.8);
      b.rotation.x = 0.25;
    }
    box(g, 3.5, 0.1, 0.1, metal, 0, 2.55, 0);
    for (const sx of [-0.6, 0.6]) {
      box(g, 0.04, 1.9, 0.04, metal, sx, 1.6, 0);
      box(g, 0.45, 0.07, 0.25, bright[0], sx, 0.62, 0);
    }
    object.add(g);
  };
  const slide = (x: number, z: number, face: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = face;
    box(g, 1.0, 0.1, 1.0, bright[1], 0, 1.8, 0);
    for (const s of [-0.45, 0.45]) box(g, 0.08, 1.8, 0.08, metal, s, 0.9, -0.45);
    for (let i = 0; i < 6; i++) box(g, 0.8, 0.06, 0.08, metal, 0, 0.3 + i * 0.28, -0.6 - i * 0.04);
    const chute = box(g, 0.8, 0.07, 2.6, bright[2], 0, 0.95, 1.6);
    chute.rotation.x = 0.55;
    object.add(g);
  };
  const frame = (x: number, z: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    for (const sx of [-1.2, 1.2])
      for (const sz of [-1.2, 1.2]) box(g, 0.08, 2.2, 0.08, bright[3], sx, 1.1, sz);
    for (const y of [0.5, 1.0, 1.5, 2.1]) {
      box(g, 2.5, 0.06, 0.06, bright[3], 0, y, 1.2);
      box(g, 2.5, 0.06, 0.06, bright[3], 0, y, -1.2);
      box(g, 0.06, 0.06, 2.5, bright[3], 1.2, y, 0);
      box(g, 0.06, 0.06, 2.5, bright[3], -1.2, y, 0);
    }
    object.add(g);
  };
  const hopscotch = (x: number, z: number) => {
    const chalk = canvasTexture(128, 512, (g) => {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 6;
      g.font = '700 40px system-ui, sans-serif';
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      const cells: [number, number][] = [
        [32, 448],
        [32, 384],
        [0, 320],
        [64, 320],
        [32, 256],
        [32, 192],
        [0, 128],
        [64, 128],
        [32, 64],
      ];
      cells.forEach(([cx, cy], i) => {
        g.strokeRect(cx + 3, cy + 3, 58, 58);
        g.fillText(String(i + 1), cx + 32, cy + 46);
      });
    });
    textures.push(chalk);
    const m = keep(new MeshBasicMaterial({ map: chalk, transparent: true }));
    flat(object, 1.2, 4.8, m, x, 0.01, z);
  };
  const hoop = (x: number, z: number, face: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = face;
    cylinder(g, 0.09, 3.2, metal, 0, 1.6, 0);
    box(g, 1.3, 0.9, 0.06, white, 0, 3.0, 0.45);
    const ring = new Mesh(new TorusGeometry(0.28, 0.025, 6, 16), keep(std(0xf97316, 0.5)));
    geometries.push(ring.geometry);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 2.75, 0.8);
    g.add(ring);
    box(g, 0.08, 0.08, 0.5, metal, 0, 2.8, 0.55);
    object.add(g);
  };
  const tree = (x: number, z: number, size: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    cylinder(g, 0.25 * size, 2.0 * size, keep(std(0x7a4b2a, 1)), 0, 1.0 * size, 0);
    const crown = new Mesh(new SphereGeometry(1.5 * size, 10, 8), keep(std(0x2f9e44, 0.9)));
    geometries.push(crown.geometry);
    crown.position.y = 3.0 * size;
    g.add(crown);
    const top = new Mesh(new ConeGeometry(1.0 * size, 1.4 * size, 8), crown.material);
    geometries.push(top.geometry);
    top.position.y = 4.4 * size;
    g.add(top);
    object.add(g);
  };

  // Right side (+x): swings, climbing frame, hoop; left side (-x): the school and the slide.
  swings(15, -18);
  swings(14, -76);
  frame(18, -42);
  frame(15, -96);
  hoop(13, -58, -Math.PI / 2);
  hoop(13, -8, -Math.PI / 2);
  slide(-14, -30, Math.PI / 2);
  slide(-13, -86, Math.PI / 2);
  hopscotch(-11.5, -52);
  hopscotch(11.5, -34);
  for (const [x, z, s] of [
    [22, -4, 1.1],
    [24, -30, 1.3],
    [21, -60, 1],
    [25, -88, 1.2],
    [20, -118, 1.1],
    [-19, -8, 1],
    [-21, -70, 1.2],
    [-20, -112, 1.1],
  ] as [number, number, number][]) {
    tree(x, z, s);
  }

  // The school building on the left: brick, windows in rows, a clock over the door.
  const facade = canvasTexture(1024, 256, (g) => {
    g.fillStyle = '#b5523b';
    g.fillRect(0, 0, 1024, 256);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 1024, 2);
    const windowsAt = (x: number, y: number) => {
      g.fillStyle = '#ffffff';
      g.fillRect(x - 4, y - 4, 56, 72);
      g.fillStyle = '#8ecbff';
      g.fillRect(x, y, 48, 64);
      g.fillStyle = '#ffffff';
      g.fillRect(x + 22, y, 4, 64);
      g.fillRect(x, y + 30, 48, 4);
    };
    for (let i = 0; i < 12; i++) {
      if (i === 5 || i === 6) continue;
      windowsAt(30 + i * 82, 28);
      windowsAt(30 + i * 82, 148);
    }
    // The door and the clock.
    g.fillStyle = '#4b2e83';
    g.fillRect(450, 140, 124, 116);
    g.fillStyle = '#facc15';
    g.fillRect(508, 150, 6, 106);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(512, 62, 42, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#111827';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(512, 62);
    g.lineTo(512, 34);
    g.moveTo(512, 62);
    g.lineTo(532, 70);
    g.stroke();
  });
  textures.push(facade);
  const brick = keep(new MeshStandardMaterial({ map: facade, roughness: 0.9 }));
  const roof = keep(std(0x55392d, 0.9));
  const school = new Group();
  school.position.set(-30, 0, -62);
  const wall = new Mesh(new BoxGeometry(8, 8, 74), roof);
  geometries.push(wall.geometry);
  wall.position.y = 4;
  school.add(wall);
  // The long face towards the track is +x, so the facade goes on the plane in front of it.
  const face = new Mesh(new PlaneGeometry(74, 8), brick);
  geometries.push(face.geometry);
  face.rotation.y = Math.PI / 2;
  face.position.set(4.02, 4, 0);
  school.add(face);
  object.add(school);

  scene.add(object);

  return {
    object,
    tape,
    dispose() {
      scene.remove(object);
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
