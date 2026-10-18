import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  RingGeometry,
  SRGBColorSpace,
  type Material,
  type Scene,
} from 'three';
import { arrowTipX, lineX, type Aim } from './aim';
import { BENCH_TOP, BENCH_Z } from './friends';
import {
  ARROW_Z,
  BALL_R,
  BOARD_W,
  BOARDS,
  DECK_BACK_Z,
  DOTS_Z,
  GUTTER_DEPTH,
  GUTTER_W,
  GUTTER_X,
  HEAD_Z,
  KICKBACK_X,
  LANE_HALF,
  LANE_WIDTH,
  PIN_IDS,
  PIT_BACK_Z,
  RELEASE_Z,
  pinSpot,
} from './geometry';
import { createPinMesh } from './pins';

/** The centres of the lanes beside ours, and the pitch between lanes. */
export const LANE_PITCH = 1.77;
const NEIGHBOURS = [-2 * LANE_PITCH, -LANE_PITCH, LANE_PITCH, 2 * LANE_PITCH];
const ALL_LANES = [-2 * LANE_PITCH, -LANE_PITCH, 0, LANE_PITCH, 2 * LANE_PITCH];
/** Where the approach ends behind the foul line. */
const APPROACH_END = 4.6;
/** The room's half-width, enough to hold the five lanes. */
const ROOM_HALF = 4.6;

// ---------- Textures ----------

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  if (!g) throw new Error('No 2D canvas');
  return [c, g];
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** 39 maple boards side by side, alternating two tones, with thin darker seams. */
function boardTexture(a: number, b: number, height: number, repeatY: number): CanvasTexture {
  const width = 512;
  const [c, g] = canvas(width, height);
  const board = width / BOARDS;
  // A stable pseudo-random so the lane looks the same every game.
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < BOARDS; i++) {
    g.fillStyle = hex(i % 2 === 0 ? a : b);
    g.fillRect(i * board, 0, board + 1, height);
    // Grain: a few long, faint streaks along the board.
    for (let k = 0; k < 6; k++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(90,50,10,0.06)' : 'rgba(255,230,180,0.06)';
      g.fillRect(i * board + rnd() * board, rnd() * height, 1.2, 80 + rnd() * 500);
    }
  }
  g.fillStyle = 'rgba(70,40,10,0.35)';
  for (let i = 1; i < BOARDS; i++) g.fillRect(i * board - 0.5, 0, 1, height);
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, repeatY);
  texture.anisotropy = 8;
  return texture;
}

/** The printed panel above the pins: navy with stars and stripes, and the game's name. */
function panelTexture(): CanvasTexture {
  const [c, g] = canvas(2048, 330);
  g.fillStyle = '#1c2f6b';
  g.fillRect(0, 0, 2048, 330);
  // Stripes along the top and bottom edges.
  const stripes = ['#d62828', '#f7f5ef'];
  for (let i = 0; i < 2048 / 64; i++) {
    g.fillStyle = stripes[i % 2];
    g.fillRect(i * 64, 0, 64, 24);
    g.fillRect(i * 64, 306, 64, 24);
  }
  const colours = ['#ffd166', '#ff595e', '#8ac926', '#1982c4', '#f7f5ef'];
  let seed = 99;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const star = (x: number, y: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.42;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };
  for (let i = 0; i < 60; i++) {
    g.fillStyle = colours[i % colours.length];
    const x = rnd() * 2048;
    // Keep the middle clear for the name.
    if (x > 560 && x < 1488) continue;
    star(x, 50 + rnd() * 230, 12 + rnd() * 20);
  }
  g.font = '900 190px system-ui, "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 16;
  g.strokeStyle = '#0a1236';
  g.strokeText('STRIKE ZONE', 1024, 172);
  g.fillStyle = '#ffd166';
  g.fillText('STRIKE ZONE', 1024, 172);
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// ---------- The aim drawings ----------

export interface AimMarks {
  object: Group;
  setAim(aim: Aim): void;
  setVisible(visible: boolean): void;
}

const MARK_Y = 0.006;
const ARROW_HEAD_LENGTH = 0.25;
const DOT_GAP = 0.6;

function createAimMarks(): AimMarks {
  const object = new Group();
  object.renderOrder = 10;
  const yellow = new MeshBasicMaterial({
    color: 0xffd166,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    // The guide is drawn over the bowler too, so the line can always be seen.
    depthTest: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const white = (opacity: number) =>
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

  // A flat 0.06-wide shaft lying along local z, one metre long, scaled to length.
  const shaft = new Mesh(new PlaneGeometry(0.06, 1).rotateX(-Math.PI / 2), yellow);
  // The head: apex at local z = 0, base 0.25 further along +z.
  const headGeometry = new BufferGeometry();
  headGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [0, 0, 0, -0.08, 0, ARROW_HEAD_LENGTH, 0.08, 0, ARROW_HEAD_LENGTH],
      3,
    ),
  );
  headGeometry.computeVertexNormals();
  const head = new Mesh(headGeometry, yellow);
  object.add(shaft, head);

  const dotMaterial = white(0.55);
  const dotGeometry = new CircleGeometry(0.035, 12).rotateX(-Math.PI / 2);
  const dotCount = Math.floor((ARROW_Z - (HEAD_Z + 0.4)) / DOT_GAP) + 1;
  const dots = Array.from({ length: dotCount }, () => {
    const dot = new Mesh(dotGeometry, dotMaterial);
    object.add(dot);
    return dot;
  });

  const ring = new Mesh(new RingGeometry(0.085, BALL_R, 32).rotateX(-Math.PI / 2), white(0.8));
  object.add(ring);

  return {
    object,
    setAim(aim) {
      const tipX = arrowTipX(aim);
      // Direction along the line (towards -z), and its yaw.
      const dx = tipX - aim.startX;
      const dz = ARROW_Z - RELEASE_Z;
      const length = Math.hypot(dx, dz);
      const yaw = Math.atan2(-dx, -dz);
      const ux = dx / length;
      const uz = dz / length;
      // Local +z of the shaft/head runs towards the bowler (the opposite of the arrow), so the
      // head's apex (local z = 0) sits at the tip and its base is behind it.
      head.position.set(tipX, MARK_Y, ARROW_Z);
      head.rotation.y = yaw;
      const shaftLength = length - ARROW_HEAD_LENGTH;
      shaft.scale.z = shaftLength;
      shaft.position.set(
        aim.startX + (ux * shaftLength) / 2,
        MARK_Y,
        RELEASE_Z + (uz * shaftLength) / 2,
      );
      shaft.rotation.y = yaw;
      dots.forEach((dot, i) => {
        const z = ARROW_Z - i * DOT_GAP;
        dot.visible = z >= HEAD_Z + 0.4 - 1e-6;
        dot.position.set(lineX(aim, z), MARK_Y, z);
      });
      ring.position.set(lineX(aim, HEAD_Z + 0.35), MARK_Y, HEAD_Z + 0.35);
    },
    setVisible(visible) {
      object.visible = visible;
    },
  };
}

// ---------- The alley ----------

export interface Alley {
  aim: AimMarks;
}

export function buildAlley(scene: Scene): Alley {
  scene.background = new Color(0x08070d);
  const root = new Group();
  scene.add(root);

  const std = (color: number, roughness = 0.8) => new MeshStandardMaterial({ color, roughness });
  const black = new MeshBasicMaterial({ color: 0x000000 });
  const plane = (
    w: number,
    d: number,
    material: Material,
    x: number,
    y: number,
    z: number,
  ): Mesh => {
    const m = new Mesh(new PlaneGeometry(w, d), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    material: Material,
    x: number,
    y: number,
    z: number,
  ): Mesh => {
    const m = new Mesh(new BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  // ---- Lights ----
  scene.add(new HemisphereLight(0xfff4e0, 0x3a2a20, 2.6));
  const sun = new DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(2, 8, 6);
  scene.add(sun);
  const glow = new PointLight(0xffffff, 3.5, 6);
  glow.position.set(0, 1.4, HEAD_Z + 0.6);
  scene.add(glow);

  // ---- The room ----
  const laneLength = -DECK_BACK_Z;
  plane(60, 60, std(0x2a2238, 0.95), 0, -0.02, -8);
  const wall = std(0x16121f, 0.95);
  box(0.3, 4, 40, wall, -ROOM_HALF - 3.2, 2, -8);
  box(0.3, 4, 40, wall, ROOM_HALF + 3.2, 2, -8);

  // ---- Lanes ----
  const laneMaterial = new MeshStandardMaterial({
    map: boardTexture(0xd9a86c, 0xd2a064, 4096, 4),
    roughness: 0.25,
  });
  const deckMaterial = new MeshStandardMaterial({
    map: boardTexture(0xe6c08a, 0xe0b982, 512, 1),
    roughness: 0.25,
  });
  const approachMaterial = new MeshStandardMaterial({
    map: boardTexture(0xe2b77e, 0xdcb078, 1024, 2),
    roughness: 0.55,
  });
  const gutterMaterial = new MeshStandardMaterial({
    color: 0x2b2f36,
    roughness: 0.5,
    side: DoubleSide,
  });
  const cap = std(0x3a3f48, 0.7);
  const kickback = std(0x23262d, 0.7);

  // The gutter is a shallow arc: a chord GUTTER_W wide that dips GUTTER_DEPTH below the lane.
  const sag = GUTTER_DEPTH;
  const arcR = ((GUTTER_W / 2) ** 2 + sag ** 2) / (2 * sag);
  const arcHalf = Math.asin(GUTTER_W / 2 / arcR);
  const gutterLength = -PIT_BACK_Z;
  const gutterGeometry = new CylinderGeometry(
    arcR,
    arcR,
    gutterLength,
    20,
    1,
    true,
    -arcHalf,
    2 * arcHalf,
  ).rotateX(Math.PI / 2);

  const addPins = (cx: number) => {
    for (const id of PIN_IDS) {
      const spot = pinSpot(id);
      const pin = createPinMesh();
      pin.position.set(cx + spot.x, 0.15, spot.z);
      root.add(pin);
    }
  };

  for (const cx of ALL_LANES) {
    // Boards and the pin deck.
    plane(LANE_WIDTH, laneLength, laneMaterial, cx, 0, -laneLength / 2);
    plane(LANE_WIDTH, 1.0, deckMaterial, cx, 0.002, DECK_BACK_Z + 0.5);
    // Gutters.
    for (const side of [-1, 1]) {
      const g = new Mesh(gutterGeometry, gutterMaterial);
      // The arc's bottom is GUTTER_DEPTH under the lane; centre it arcR above that.
      g.position.set(cx + side * GUTTER_X, -GUTTER_DEPTH + arcR, -gutterLength / 2);
      root.add(g);
      // Kickback beside the deck.
      box(
        0.04,
        0.6,
        HEAD_Z + 0.5 - PIT_BACK_Z,
        kickback,
        cx + side * (KICKBACK_X + 0.02),
        0.3,
        (HEAD_Z + 0.5 + PIT_BACK_Z) / 2,
      );
    }
    // The approach.
    const approachLength = cx === 0 ? APPROACH_END : 3.2;
    plane(LANE_PITCH, approachLength, approachMaterial, cx, 0, approachLength / 2);
  }
  // The approach texture should show boards of the same width as the lane's: the approach is wider
  // than the lane, so its texture repeats across it.
  approachMaterial.map!.repeat.set(LANE_PITCH / LANE_WIDTH, 2);

  // Cappings between the lanes and at the outer edges (they fill the space between the gutters).
  const gapWidth = LANE_PITCH - 2 * KICKBACK_X;
  const capEdges = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((n) => n * LANE_PITCH);
  for (const x of capEdges) plane(gapWidth, -PIT_BACK_Z, cap, x, 0.003, PIT_BACK_Z / 2);

  // The foul line across all the lanes.
  plane(ROOM_HALF * 2, 0.02, std(0x111111, 0.6), 0, 0.004, 0);

  // Arrows (boards 5, 10, ..., 35 counted from the right) and dots.
  const arrowMaterial = new MeshStandardMaterial({
    color: 0x7a1f1f,
    roughness: 0.6,
    side: DoubleSide,
  });
  const arrowGeometry = new BufferGeometry();
  arrowGeometry.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0, -0.075, -0.025, 0, 0.075, 0.025, 0, 0.075], 3),
  );
  arrowGeometry.computeVertexNormals();
  const boardX = (n: number) => LANE_HALF - (n - 0.5) * BOARD_W;
  for (const n of [5, 10, 15, 20, 25, 30, 35]) {
    const arrow = new Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(boardX(n), 0.005, ARROW_Z);
    root.add(arrow);
  }
  const dotMaterial = new MeshStandardMaterial({ color: 0x5a2a1a, roughness: 0.6 });
  const dotGeometry = new CircleGeometry(0.011, 10).rotateX(-Math.PI / 2);
  for (const n of [3, 5, 8, 11, 14, 26, 29, 32, 35, 37]) {
    const dot = new Mesh(dotGeometry, dotMaterial);
    dot.position.set(boardX(n), 0.005, DOTS_Z);
    root.add(dot);
  }

  // ---- The pit, the curtain and the printed panel ----
  const pitWidth = ROOM_HALF * 2;
  plane(pitWidth, DECK_BACK_Z - PIT_BACK_Z, black, 0, -0.25, (DECK_BACK_Z + PIT_BACK_Z) / 2);
  const face = new Mesh(new PlaneGeometry(pitWidth, 0.25), black);
  face.position.set(0, -0.125, DECK_BACK_Z);
  root.add(face);
  const curtain = new Mesh(new PlaneGeometry(pitWidth, 2.8), black);
  curtain.position.set(0, 1.1, PIT_BACK_Z);
  root.add(curtain);
  // The dark housing the pins stand in front of, from the deck to the panel's top edge.
  const housing = new Mesh(new PlaneGeometry(pitWidth, 2.4), black);
  housing.position.set(0, 1.2, DECK_BACK_Z - 0.05);
  root.add(housing);

  const panelMaterial = new MeshStandardMaterial({
    map: panelTexture(),
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    roughness: 0.8,
  });
  panelMaterial.emissiveMap = panelMaterial.map;
  const panel = new Mesh(new PlaneGeometry(pitWidth, 1.45), panelMaterial);
  panel.position.set(0, (0.95 + 2.4) / 2, HEAD_Z - 0.3);
  root.add(panel);

  // ---- The neighbouring lanes' pins (drawn only; they never fall) ----
  for (const cx of NEIGHBOURS) addPins(cx);

  // ---- The bench for the friends ----
  const orange = std(0xe5702a, 0.7);
  box(2.0, BENCH_TOP, 0.5, orange, -2.6, BENCH_TOP / 2, BENCH_Z);
  box(2.0, 0.4, 0.06, orange, -2.6, BENCH_TOP + 0.2, BENCH_Z + 0.22);

  // ---- The aim drawings ----
  const aim = createAimMarks();
  root.add(aim.object);
  return { aim };
}
