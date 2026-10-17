import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  TorusGeometry,
  type Scene,
} from 'three';
import { BOARD, FENCE, RIM, RIM_GROUND, RIM_RADIUS, THREE_RADIUS, type Vec } from './geometry';

export const SKY_COLOR = 0x8cc8f4;
const NET_LENGTH = 0.42;
const NET_STRANDS = 12;

export interface Court {
  /** Where the benches are, so kids can be seated on them. Seat centres, facing `facing`. */
  seats: { pos: Vec; facing: Vec }[];
  /** The net ripples as the ball goes through. */
  swish(): void;
  /** The rim dips and wobbles after a dunk. */
  dunkWobble(): void;
  update(delta: number): void;
  dispose(): void;
}

const flat = (geometry: BufferGeometry) => geometry.rotateX(-Math.PI / 2);

/** A flat ribbon of `width` along a polyline of [x, z] points, lying at height `y`. */
function ribbon(
  points: [number, number][],
  width: number,
  y: number,
  material: MeshLambertMaterial,
) {
  const positions: number[] = [];
  const index: number[] = [];
  const half = width / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const d = Math.hypot(dx, dz) || 1;
    const nx = (-dz / d) * half;
    const nz = (dx / d) * half;
    const base = positions.length / 3;
    positions.push(
      x0 + nx,
      y,
      z0 + nz,
      x0 - nx,
      y,
      z0 - nz,
      x1 + nx,
      y,
      z1 + nz,
      x1 - nx,
      y,
      z1 - nz,
    );
    index.push(
      base,
      base + 1,
      base + 2,
      base + 1,
      base + 3,
      base + 2,
      base,
      base + 2,
      base + 1,
      base + 1,
      base + 2,
      base + 3,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return new Mesh(geometry, material);
}

function arcPoints(cx: number, cz: number, r: number, from: number, to: number, steps = 40) {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    points.push([cx + r * Math.sin(a), cz + r * Math.cos(a)]);
  }
  return points;
}

function fenceTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(64, 64);
  g.moveTo(64, 0);
  g.lineTo(0, 64);
  g.moveTo(-32, 32);
  g.lineTo(32, 96);
  g.moveTo(32, -32);
  g.lineTo(96, 32);
  g.moveTo(32, 96);
  g.lineTo(96, 32);
  g.moveTo(-32, 32);
  g.lineTo(32, -32);
  g.stroke();
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function buildCourt(scene: Scene): Court {
  const root = new Group();
  scene.add(root);
  scene.background = new Color(SKY_COLOR);
  scene.add(new HemisphereLight(0xdcecff, 0x6a8a58, 1.5));
  scene.add(new AmbientLight(0xffffff, 0.4));
  const sun = new DirectionalLight(0xfff0d6, 2.2);
  sun.position.set(-12, 24, 10);
  scene.add(sun);

  const lambert = (color: number) => new MeshLambertMaterial({ color });

  // ---- Ground ----
  const grass = new Mesh(flat(new PlaneGeometry(240, 240)), lambert(0x6cbf4f));
  grass.position.y = -0.01;
  root.add(grass);
  const asphalt = new Mesh(flat(new PlaneGeometry(17, 17.8)), lambert(0x356d73));
  asphalt.position.set(0, 0, (16 - 1.8) / 2);
  root.add(asphalt);
  // The lighter court inside the lines.
  const inner = new Mesh(flat(new PlaneGeometry(15, 14)), lambert(0x3f7f86));
  inner.position.set(0, 0.001, 7);
  root.add(inner);
  const key = new Mesh(flat(new PlaneGeometry(4.9, 5.8)), lambert(0xb5533c));
  key.position.set(0, 0.002, 2.9);
  root.add(key);

  // ---- Lines ----
  const white = lambert(0xf5f5f5);
  const lineY = 0.004;
  const line = (points: [number, number][]) => root.add(ribbon(points, 0.06, lineY, white));
  line([
    [-7.5, 0],
    [7.5, 0],
  ]);
  line([
    [-7.5, 0],
    [-7.5, 14],
  ]);
  line([
    [7.5, 0],
    [7.5, 14],
  ]);
  line([
    [-7.5, 14],
    [7.5, 14],
  ]);
  line(arcPoints(0, 14, 1.8, Math.PI / 2, (Math.PI * 3) / 2, 32));
  // The 3-point arc, with straight lines at x = +-6.6 from the baseline until they meet it.
  const meet = Math.asin(6.6 / THREE_RADIUS);
  const arcZ = RIM_GROUND.z + THREE_RADIUS * Math.cos(meet);
  line([
    [-6.6, 0],
    [-6.6, arcZ],
  ]);
  line([
    [6.6, 0],
    [6.6, arcZ],
  ]);
  line(arcPoints(0, RIM_GROUND.z, THREE_RADIUS, -meet, meet, 60));
  // The key and the free-throw circle.
  line([
    [-2.45, 0],
    [-2.45, 5.8],
  ]);
  line([
    [2.45, 0],
    [2.45, 5.8],
  ]);
  line([
    [-2.45, 5.8],
    [2.45, 5.8],
  ]);
  line(arcPoints(0, 5.8, 1.8, 0, Math.PI * 2, 48));

  // ---- Hoop ----
  const hoopGroup = new Group();
  root.add(hoopGroup);
  const steel = new MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.5, metalness: 0.4 });
  const pole = new Mesh(new CylinderGeometry(0.09, 0.09, 3.55, 12), steel);
  pole.position.set(0, 3.55 / 2, -0.6);
  hoopGroup.add(pole);
  const arm = new Mesh(new CylinderGeometry(0.06, 0.06, 1.78, 10), steel);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, 3.45, -0.6 + 1.78 / 2);
  hoopGroup.add(arm);
  const board = new Mesh(
    new BoxGeometry(1.8, 1.05, 0.05),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
  );
  board.position.set(0, 3.425, BOARD.z);
  hoopGroup.add(board);
  const red = new MeshBasicMaterial({ color: 0xd23b2f });
  const outline = (w: number, h: number, x: number, y: number) => {
    const m = new Mesh(new BoxGeometry(w, h, 0.01), red);
    m.position.set(x, y, BOARD.z + 0.03);
    hoopGroup.add(m);
  };
  // 0.59 x 0.45, its bottom edge at rim height.
  const t = 0.03;
  outline(0.59, t, 0, RIM.y + t / 2);
  outline(0.59, t, 0, RIM.y + 0.45 - t / 2);
  outline(t, 0.45, -0.295 + t / 2, RIM.y + 0.225);
  outline(t, 0.45, 0.295 - t / 2, RIM.y + 0.225);

  // The rim and the net hang in a group so they can dip together.
  const rimGroup = new Group();
  rimGroup.position.set(RIM.x, RIM.y, RIM.z);
  hoopGroup.add(rimGroup);
  const rim = new Mesh(
    new TorusGeometry(RIM_RADIUS, 0.02, 8, 32),
    new MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.4 }),
  );
  rim.rotation.x = Math.PI / 2;
  rimGroup.add(rim);
  const bracketLength = RIM.z - RIM_RADIUS - (BOARD.z + 0.025);
  const bracket = new Mesh(new BoxGeometry(0.1, 0.03, bracketLength + 0.04), steel);
  bracket.position.set(0, 0, -RIM_RADIUS - bracketLength / 2 + 0.02);
  rimGroup.add(bracket);

  // The net: strands from the rim down to a smaller ring, scaled in y to ripple.
  const netGroup = new Group();
  rimGroup.add(netGroup);
  const strandPoints: number[] = [];
  const ringAt = (i: number, radius: number, y: number): [number, number, number] => {
    const a = (i / NET_STRANDS) * Math.PI * 2;
    return [Math.cos(a) * radius, y, Math.sin(a) * radius];
  };
  for (let i = 0; i < NET_STRANDS; i++) {
    strandPoints.push(...ringAt(i, RIM_RADIUS, 0), ...ringAt(i, 0.14, -NET_LENGTH));
    // Diamonds: each strand crosses to the next halfway down.
    strandPoints.push(
      ...ringAt(i, 0.185, -NET_LENGTH / 2),
      ...ringAt(i + 1, 0.185, -NET_LENGTH / 2),
    );
  }
  const strands = new BufferGeometry();
  strands.setAttribute('position', new Float32BufferAttribute(strandPoints, 3));
  netGroup.add(new LineSegments(strands, new LineBasicMaterial({ color: 0xffffff })));
  const sheet = new Mesh(
    new CylinderGeometry(RIM_RADIUS, 0.14, NET_LENGTH, NET_STRANDS, 1, true).translate(
      0,
      -NET_LENGTH / 2,
      0,
    ),
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  netGroup.add(sheet);

  // ---- Fence ----
  const mesh = fenceTexture();
  const fenceHeight = 3;
  const panel = (x: number, z: number, length: number, turned: boolean) => {
    const texture = mesh?.clone();
    if (texture) {
      texture.needsUpdate = true;
      texture.repeat.set(length / 0.35, fenceHeight / 0.35);
    }
    const m = new Mesh(
      new PlaneGeometry(length, fenceHeight),
      new MeshBasicMaterial({
        map: texture ?? undefined,
        color: 0x9aa3ad,
        transparent: true,
        opacity: texture ? 0.9 : 0.18,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    m.position.set(x, fenceHeight / 2, z);
    if (turned) m.rotation.y = Math.PI / 2;
    root.add(m);
  };
  const lengthZ = FENCE.zMax - FENCE.zMin;
  const lengthX = FENCE.x * 2;
  const midZ = (FENCE.zMax + FENCE.zMin) / 2;
  panel(-FENCE.x, midZ, lengthZ, true);
  panel(FENCE.x, midZ, lengthZ, true);
  panel(0, FENCE.zMin, lengthX, false);
  panel(0, FENCE.zMax, lengthX, false);
  const postMaterial = new MeshStandardMaterial({ color: 0x2f3338, roughness: 0.6 });
  const post = (x: number, z: number) => {
    const m = new Mesh(new CylinderGeometry(0.05, 0.05, fenceHeight + 0.1, 8), postMaterial);
    m.position.set(x, (fenceHeight + 0.1) / 2, z);
    root.add(m);
  };
  for (let z = FENCE.zMin; z <= FENCE.zMax + 0.01; z += 3) {
    post(-FENCE.x, z);
    post(FENCE.x, z);
  }
  for (let x = -FENCE.x + 3; x < FENCE.x - 0.01; x += 3) {
    post(x, FENCE.zMin);
    post(x, FENCE.zMax);
  }
  for (const [x, z, w, d] of [
    [-FENCE.x, midZ, 0.06, lengthZ],
    [FENCE.x, midZ, 0.06, lengthZ],
    [0, FENCE.zMin, lengthX, 0.06],
    [0, FENCE.zMax, lengthX, 0.06],
  ]) {
    const rail = new Mesh(new BoxGeometry(w, 0.06, d), postMaterial);
    rail.position.set(x, fenceHeight + 0.05, z);
    root.add(rail);
  }

  // ---- Trees ----
  const trunk = new MeshLambertMaterial({ color: 0x6b4a2b });
  const leaves = [0x3f9a3c, 0x4fae45, 0x2f8a40].map((c) => new MeshLambertMaterial({ color: c }));
  const tree = (x: number, z: number, size: number) => {
    const g = new Group();
    const stem = new Mesh(new CylinderGeometry(0.22 * size, 0.3 * size, 2.6 * size, 8), trunk);
    stem.position.y = 1.3 * size;
    g.add(stem);
    const blobs: [number, number, number, number][] = [
      [0, 3.4, 0, 1.9],
      [0.9, 2.9, 0.3, 1.4],
      [-0.8, 3.0, -0.4, 1.5],
    ];
    blobs.forEach(([bx, by, bz, br], i) => {
      const m = new Mesh(new IcosahedronGeometry(br * size, 1), leaves[i % 3]);
      m.position.set(bx * size, by * size, bz * size);
      g.add(m);
    });
    g.position.set(x, 0, z);
    root.add(g);
  };
  const trees: [number, number, number][] = [
    [-8, -9, 1.2],
    [-2.5, -11, 1.4],
    [3.5, -9.5, 1.1],
    [9, -11, 1.3],
    [-14, 2, 1.2],
    [14, 6, 1.3],
    [-13, 12, 1.1],
    [-5, 22, 1.4],
    [6, 21, 1.2],
    [13, 19, 1.1],
  ];
  trees.forEach(([x, z, size]) => tree(x, z, size));

  // ---- Benches ----
  const wood = new MeshLambertMaterial({ color: 0x8a5a32 });
  const legs = new MeshLambertMaterial({ color: 0x3a3430 });
  const seats: Court['seats'] = [];
  const bench = (x: number, z: number, facing: number) => {
    const g = new Group();
    const top = new Mesh(new BoxGeometry(2.6, 0.08, 0.45), wood);
    top.position.y = 0.41;
    const back = new Mesh(new BoxGeometry(2.6, 0.4, 0.05), wood);
    back.position.set(0, 0.7, -0.2 * facing);
    g.add(top, back);
    for (const lx of [-1.15, 1.15]) {
      const leg = new Mesh(new BoxGeometry(0.08, 0.41, 0.4), legs);
      leg.position.set(lx, 0.205, 0);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    root.add(g);
  };
  bench(-3.7, -2.4, 1);
  bench(3.7, -2.4, 1);
  bench(0, 16.2, -1);
  // Seats: two on each near bench, three on the far one.
  for (const x of [-3.7, 3.7]) {
    for (const dx of [-0.55, 0.55]) {
      seats.push({ pos: { x: x + dx, y: 0.45, z: -2.4 }, facing: { x: x + dx, y: 0, z: 10 } });
    }
  }
  for (const dx of [-0.8, 0, 0.8]) {
    seats.push({ pos: { x: dx, y: 0.45, z: 16.2 }, facing: { x: dx, y: 0, z: 0 } });
  }

  // ---- Net ripple and rim wobble ----
  let ripple = -1;
  let wobble = -1;
  const update = (delta: number) => {
    let drop = 0;
    if (ripple >= 0) {
      ripple += delta;
      const k = ripple / 0.35;
      if (k >= 1) ripple = -1;
      else drop = 0.12 * Math.sin(Math.PI * k) * (1 - k * 0.3);
    }
    netGroup.scale.y = 1 + drop / NET_LENGTH;
    let dip = 0;
    if (wobble >= 0) {
      wobble += delta;
      const k = wobble / 0.4;
      if (k >= 1) wobble = -1;
      else dip = -0.06 * Math.cos(k * Math.PI * 5) * (1 - k);
    }
    rimGroup.position.y = RIM.y + dip;
  };

  return {
    seats,
    swish() {
      ripple = 0;
    },
    dunkWobble() {
      wobble = 0;
    },
    update,
    dispose() {
      scene.remove(root);
    },
  };
}
