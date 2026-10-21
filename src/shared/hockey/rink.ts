import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  CircleGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  type Scene,
} from 'three';
import {
  BLUE_LINE_X,
  CORNER_R,
  CREASE_R,
  END_DOT_X,
  END_DOT_Z,
  GOAL_DEPTH,
  GOAL_H,
  GOAL_LINE_X,
  GOAL_W,
  RINK_LENGTH,
  RINK_WIDTH,
  type Side,
} from './geometry';

export interface Rink {
  /** The lamp behind the net a side shoots at (we shoot at +x). */
  setLamp(side: Side, on: boolean): void;
  /** `cameraX` hides a lamp the camera is behind (it would hang in front of the net). */
  update(delta: number, cameraX: number): void;
  dispose(): void;
}

const HALF_L = RINK_LENGTH / 2;
const HALF_W = RINK_WIDTH / 2;
const BOARD_H = 1.0;
const GLASS_H = 1.6;

/** The outline of the rink as a closed loop of points (x, z), corners rounded. */
function outline(inset = 0, steps = 10): [number, number][] {
  const r = CORNER_R - inset;
  const hx = HALF_L - inset;
  const hz = HALF_W - inset;
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [hx - r, hz - r, 0],
    [-hx + r, hz - r, Math.PI / 2],
    [-hx + r, -hz + r, Math.PI],
    [hx - r, -hz + r, (Math.PI * 3) / 2],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

/** A vertical band standing on an outline between two heights. */
function wall(points: [number, number][], y0: number, y1: number): BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  points.forEach(([x, z], i) => {
    pos.push(x, y0, z, x, y1, z);
    const n = (i + 1) % points.length;
    const a = i * 2;
    const b = n * 2;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

export function buildRink(scene: Scene): Rink {
  const group = new Group();
  scene.add(group);
  scene.background = new Color(0x1c2536);
  scene.add(new HemisphereLight(0xeef4ff, 0x5a6578, 1.7));
  scene.add(new AmbientLight(0xffffff, 0.5));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-10, 30, 10);
  scene.add(sun);

  const flat = (geometry: BufferGeometry, color: number, y: number, rotate = true) => {
    const mesh = new Mesh(
      geometry,
      new MeshStandardMaterial({ color, roughness: 0.5, side: DoubleSide }),
    );
    if (rotate) mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    group.add(mesh);
    return mesh;
  };

  // The ice: a rounded rectangle.
  const shape = new Shape();
  outline(0, 10).forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  flat(new ShapeGeometry(shape), 0xf4f8fb, 0);

  // Lines.
  const line = (x: number, w: number, color: number, y = 0.004) =>
    flat(new PlaneGeometry(w, RINK_WIDTH - 0.2), color, y).position.set(x, y, 0);
  line(0, 0.3, 0xd23a3a);
  line(BLUE_LINE_X, 0.35, 0x2a5fd1, 0.005);
  line(-BLUE_LINE_X, 0.35, 0x2a5fd1, 0.005);
  line(GOAL_LINE_X, 0.06, 0xd23a3a, 0.006);
  line(-GOAL_LINE_X, 0.06, 0xd23a3a, 0.006);

  // Faceoff circles and dots.
  const circle = (x: number, z: number, color: number, r = 4.5) => {
    const ring = flat(new RingGeometry(r - 0.05, r, 48), color, 0.007);
    ring.position.set(x, 0.007, z);
  };
  const dot = (x: number, z: number, color: number, r = 0.3) => {
    const d = flat(new CircleGeometry(r, 20), color, 0.008);
    d.position.set(x, 0.008, z);
  };
  circle(0, 0, 0x2a5fd1);
  dot(0, 0, 0x2a5fd1);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      circle(sx * END_DOT_X, sz * END_DOT_Z, 0xd23a3a);
      dot(sx * END_DOT_X, sz * END_DOT_Z, 0xd23a3a);
    }
  }

  // Blue creases.
  for (const sx of [-1, 1]) {
    const crease = flat(
      new CircleGeometry(CREASE_R, 24, sx > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI),
      0x9cc7ff,
      0.003,
    );
    crease.position.set(sx * GOAL_LINE_X, 0.003, 0);
  }

  // Boards, kick plate and glass.
  const edge = outline(0, 10);
  const boards = new Mesh(
    wall(edge, 0, BOARD_H),
    new MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.6, side: DoubleSide }),
  );
  const kick = new Mesh(
    wall(edge, 0, 0.28),
    new MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6, side: DoubleSide }),
  );
  kick.scale.set(1.002, 1, 1.002);
  const glass = new Mesh(
    wall(edge, BOARD_H, BOARD_H + GLASS_H),
    new MeshStandardMaterial({
      color: 0xbfe0ff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  group.add(boards, kick, glass);

  // A few rows of low-poly crowd.
  const palette = [0xe63946, 0xf4a261, 0x2a9d8f, 0x8e7dbe, 0xffd166, 0x06d6a0, 0x4d9de0, 0xf1f1f1];
  const rows = [
    { inset: -1.6, y: 1.5 },
    { inset: -2.4, y: 2.1 },
    { inset: -3.2, y: 2.7 },
  ];
  const spots: { x: number; z: number; y: number }[] = [];
  for (const row of rows) {
    const pts = outline(row.inset, 14);
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % pts.length];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 1.1));
      for (let k = 0; k < n; k++) {
        const f = k / n;
        const x = ax + (bx - ax) * f;
        // Nobody sits behind our goal, where the camera is when they shoot at it.
        if (x < -(HALF_L - CORNER_R)) continue;
        spots.push({ x, z: az + (bz - az) * f, y: row.y });
      }
    }
  }
  const crowd = new InstancedMesh(
    new BoxGeometry(0.7, 0.9, 0.6),
    new MeshStandardMaterial({ roughness: 0.9 }),
    spots.length,
  );
  const m = new Matrix4();
  const tint = new Color();
  spots.forEach((s, i) => {
    m.makeTranslation(s.x, s.y, s.z);
    crowd.setMatrixAt(i, m);
    crowd.setColorAt(i, tint.setHex(palette[(i * 7 + (i >> 3)) % palette.length]));
  });
  group.add(crowd);

  // The two nets, with a lamp above the glass behind each.
  const pipe = new MeshStandardMaterial({ color: 0xd62828, roughness: 0.4 });
  const mesh = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    side: DoubleSide,
    depthWrite: false,
  });
  const lamps: Record<Side, Mesh> = {} as Record<Side, Mesh>;
  const lampOff = new MeshStandardMaterial({ color: 0x5a1010, roughness: 0.5 });
  const lampOn = new MeshStandardMaterial({
    color: 0xff2a2a,
    emissive: 0xff1a1a,
    emissiveIntensity: 2.2,
  });
  for (const sx of [-1, 1]) {
    const net = new Group();
    net.position.set(sx * GOAL_LINE_X, 0, 0);
    const post = (z: number) => {
      const p = new Mesh(new CylinderGeometry(0.04, 0.04, GOAL_H, 8), pipe);
      p.position.set(0, GOAL_H / 2, z);
      net.add(p);
    };
    post(-GOAL_W / 2);
    post(GOAL_W / 2);
    const bar = new Mesh(new CylinderGeometry(0.04, 0.04, GOAL_W, 8), pipe);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, GOAL_H, 0);
    net.add(bar);
    const depth = sx * GOAL_DEPTH;
    for (const z of [-GOAL_W / 2, GOAL_W / 2]) {
      const side = new Mesh(new PlaneGeometry(GOAL_DEPTH, GOAL_H), mesh);
      side.rotation.y = Math.PI / 2;
      side.rotation.set(0, 0, 0);
      side.position.set(depth / 2, GOAL_H / 2, z);
      net.add(side);
    }
    const back = new Mesh(new PlaneGeometry(GOAL_W, GOAL_H), mesh);
    back.rotation.y = Math.PI / 2;
    back.position.set(depth, GOAL_H / 2, 0);
    net.add(back);
    const top = new Mesh(new PlaneGeometry(GOAL_DEPTH, GOAL_W), mesh);
    top.rotation.x = Math.PI / 2;
    top.position.set(depth / 2, GOAL_H, 0);
    net.add(top);
    group.add(net);

    const lamp = new Mesh(new SphereGeometry(0.32, 16, 12), lampOff);
    lamp.position.set(sx * (HALF_L + 1.0), BOARD_H + GLASS_H + 1.7, 0);
    group.add(lamp);
    lamps[sx > 0 ? 'us' : 'them'] = lamp;
  }

  const lampState: Record<Side, number> = { us: 0, them: 0 };
  let clock = 0;
  return {
    setLamp(side, on) {
      lampState[side] = on ? 1 : 0;
      lamps[side].material = on ? lampOn : lampOff;
    },
    update(delta, cameraX) {
      clock += delta;
      // The lit lamp blinks at 3 Hz.
      for (const side of ['us', 'them'] as const) {
        const lamp = lamps[side];
        const behind = Math.sign(lamp.position.x) * cameraX > Math.abs(lamp.position.x) - 1;
        const blink = lampState[side] ? Math.floor(clock * 6) % 2 === 0 : true;
        lamp.visible = blink && !behind;
      }
    },
    dispose() {
      scene.remove(group);
    },
  };
}
