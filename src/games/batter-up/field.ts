import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type Scene,
} from 'three';
import {
  BASE_SPOTS,
  BASE_SIDE,
  BOARD,
  FIREWORKS_CENTRE,
  FOUL_ANGLE,
  MOUND,
  MOUND_HEIGHT,
  WALL_HEIGHT,
  fieldPoint,
  wallRadius,
} from './flight';

export const SKY_COLOR = 0x8cc8f4;

function canvasTexture(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D) => void,
): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (g) draw(g);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A tiny deterministic random sequence, so the crowd looks the same every time. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Where the scoreboard's outs dots go on its 512px face: centres across, and the radius. */
export const BOARD_DOT_RADIUS = 13;
export const BOARD_DOT_STROKE = 3;
export const BOARD_DOT_SPACING = 36;
/** The right edge of the numbers on the face, which the last dot lines up with. */
export const BOARD_RIGHT_EDGE = 472;

/** Centre x of each of the three outs dots; the last one's outer edge is at `BOARD_RIGHT_EDGE`. */
export function boardDotCentres(): number[] {
  const last = BOARD_RIGHT_EDGE - BOARD_DOT_RADIUS - BOARD_DOT_STROKE / 2;
  return [0, 1, 2].map((i) => last - (2 - i) * BOARD_DOT_SPACING);
}

export interface BoardInfo {
  runs: number;
  outs: number;
  strikes: number;
  batter: number;
  batters: number;
}

export interface Field {
  /** Redraws the scoreboard. */
  setBoard(info: BoardInfo): void;
  /** Where fireworks should go off: above the scoreboard. */
  fireworksCentre: { x: number; y: number; z: number };
}

const std = (color: number, roughness = 1) => new MeshStandardMaterial({ color, roughness });

/** Sky, grass, the dirt diamond, bases, the outfield wall, stands and a scoreboard. */
export function buildField(scene: Scene): Field {
  scene.background = new Color(SKY_COLOR);
  scene.add(new HemisphereLight(0xdcecff, 0x4b7f3e, 1.7));
  scene.add(new AmbientLight(0xffffff, 0.35));
  const sun = new DirectionalLight(0xfff0d6, 2.3);
  sun.position.set(-18, 40, 26);
  scene.add(sun);

  // A sky that fades to a pale haze at the horizon.
  const skyTexture = canvasTexture(4, 256, (g) => {
    const gradient = g.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#4a97e0');
    gradient.addColorStop(0.55, '#9fd0f5');
    gradient.addColorStop(0.74, '#e6f3fb');
    gradient.addColorStop(1, '#e6f3fb');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 4, 256);
  });
  const sky = new Mesh(
    new SphereGeometry(300, 16, 16),
    new MeshBasicMaterial({
      map: skyTexture,
      color: skyTexture ? 0xffffff : SKY_COLOR,
      side: BackSide,
    }),
  );
  sky.position.y = -30;
  scene.add(sky);

  // Grass with mowing stripes.
  const grassTexture = canvasTexture(16, 64, (g) => {
    g.fillStyle = '#3d9a4b';
    g.fillRect(0, 0, 16, 32);
    g.fillStyle = '#358f43';
    g.fillRect(0, 32, 16, 32);
  });
  if (grassTexture) {
    grassTexture.wrapS = grassTexture.wrapT = RepeatWrapping;
    grassTexture.repeat.set(1, 30);
  }
  const ground = new Mesh(
    new PlaneGeometry(420, 420),
    new MeshStandardMaterial({
      map: grassTexture,
      color: grassTexture ? 0xffffff : 0x3d9a4b,
      roughness: 1,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -60;
  scene.add(ground);

  const flat = (
    geometry: PlaneGeometry | CircleGeometry | ShapeGeometry,
    color: number,
    y: number,
  ) => {
    const m = new Mesh(geometry, std(color));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    scene.add(m);
    return m;
  };

  // The infield: a ring of dirt round a diamond of grass, a circle of dirt at home and the mound.
  const dirt = 0xc48f5e;
  const infield = flat(new CircleGeometry(14.5, 48), dirt, 0.012);
  infield.position.z = -8.8;
  const homeDirt = flat(new CircleGeometry(3.6, 32), dirt, 0.016);
  homeDirt.position.z = 0.2;
  const half = BASE_SIDE / Math.SQRT2 - 1.9;
  const inner = flat(new PlaneGeometry(half * Math.SQRT2, half * Math.SQRT2), 0x3b9649, 0.02);
  inner.rotation.z = Math.PI / 4;
  inner.position.z = -BASE_SIDE / Math.SQRT2;
  const mound = new Mesh(new CylinderGeometry(1.0, 2.4, MOUND_HEIGHT, 28), std(dirt));
  mound.position.set(MOUND.x, MOUND_HEIGHT / 2, MOUND.z);
  scene.add(mound);
  const rubber = new Mesh(new BoxGeometry(0.9, 0.05, 0.18), std(0xffffff, 0.5));
  rubber.position.set(MOUND.x, MOUND_HEIGHT + 0.02, MOUND.z);
  scene.add(rubber);

  // Bases and home plate.
  const white = std(0xffffff, 0.5);
  for (const spot of BASE_SPOTS.slice(1)) {
    const base = new Mesh(new BoxGeometry(0.95, 0.12, 0.95), white);
    base.position.set(spot.x, 0.07, spot.z);
    base.rotation.y = Math.PI / 4;
    scene.add(base);
  }
  const plate = new Shape();
  plate.moveTo(-0.32, 0.3);
  plate.lineTo(0.32, 0.3);
  plate.lineTo(0.32, -0.05);
  plate.lineTo(0, -0.42);
  plate.lineTo(-0.32, -0.05);
  plate.closePath();
  const plateMesh = new Mesh(
    new ShapeGeometry(plate),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: DoubleSide }),
  );
  plateMesh.rotation.x = -Math.PI / 2;
  plateMesh.position.y = 0.04;
  scene.add(plateMesh);

  // Chalk: the batter's boxes and the foul lines.
  const chalk = (x: number, z: number, w: number, d: number, y = 0.03, yaw = 0) => {
    const line = new Mesh(new BoxGeometry(w, 0.02, d), white);
    line.position.set(x, y, z);
    line.rotation.y = yaw;
    scene.add(line);
  };
  for (const side of [-1, 1]) {
    const cx = side * 1.1;
    chalk(cx, -0.9, 1.4, 0.07);
    chalk(cx, 1.5, 1.4, 0.07);
    chalk(cx - 0.7, 0.3, 0.07, 2.47);
    chalk(cx + 0.7, 0.3, 0.07, 2.47);
    // The foul line runs from home out along the edge of fair ground.
    const length = wallRadius(FOUL_ANGLE) + 1;
    const mid = fieldPoint(side * FOUL_ANGLE, length / 2);
    chalk(mid.x, mid.z, 0.12, length, 0.03, -side * FOUL_ANGLE);
  }

  // The outfield wall with its warning track, padded green with a yellow top.
  const wall = new Group();
  scene.add(wall);
  const segments = 32;
  const wallGreen = std(0x1d5f3d, 0.8);
  const yellow = std(0xffd23f, 0.6);
  const track = std(0xa87a4d);
  const crowdTexture = canvasTexture(256, 128, (g) => {
    g.fillStyle = '#3a3f55';
    g.fillRect(0, 0, 256, 128);
    const rnd = lcg(7);
    const colours = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#ffffff', '#ff9f1c', '#c77dff'];
    for (let i = 0; i < 520; i++) {
      g.fillStyle = colours[Math.floor(rnd() * colours.length)];
      const x = rnd() * 256;
      const y = rnd() * 128;
      g.fillRect(x, y, 4, 4);
      g.fillStyle = '#f3c9a0';
      g.fillRect(x + 0.5, y - 3, 3, 3);
    }
  });
  if (crowdTexture) crowdTexture.wrapS = crowdTexture.wrapT = RepeatWrapping;
  // The crowd is tiled to the size of each stand, so the people stay the same size everywhere.
  const crowdCache = new Map<string, MeshStandardMaterial>();
  const crowdFor = (width: number, height: number) => {
    const rx = Math.max(1, Math.round(width / 5));
    const ry = Math.max(1, Math.round(height / 3));
    const key = `${rx}x${ry}`;
    let material = crowdCache.get(key);
    if (!material) {
      const map = crowdTexture?.clone() ?? null;
      if (map) {
        map.repeat.set(rx, ry);
        map.needsUpdate = true;
      }
      material = new MeshStandardMaterial({ map, color: map ? 0xffffff : 0x6a6f88, roughness: 1 });
      crowdCache.set(key, material);
    }
    return material;
  };
  const concrete = std(0x8a8f9c);
  for (let i = 0; i < segments; i++) {
    const theta = -FOUL_ANGLE + ((i + 0.5) / segments) * FOUL_ANGLE * 2;
    const r = wallRadius(theta);
    const len = ((2 * r * FOUL_ANGLE) / segments) * 1.1;
    const place = (mesh: Mesh, radius: number, y: number) => {
      const p = fieldPoint(theta, radius);
      mesh.position.set(p.x, y, p.z);
      mesh.rotation.y = -theta;
      wall.add(mesh);
    };
    place(new Mesh(new BoxGeometry(len, WALL_HEIGHT, 0.6), wallGreen), r + 0.3, WALL_HEIGHT / 2);
    place(new Mesh(new BoxGeometry(len, 0.14, 0.7), yellow), r + 0.3, WALL_HEIGHT + 0.07);
    place(new Mesh(new BoxGeometry(len, 0.02, 2.4), track), r - 1.4, 0.018);
    // Stands in three tiers behind the wall.
    for (let tier = 0; tier < 3; tier++) {
      const height = 3.4 + tier * 2.6;
      const depth = 3.4;
      const stand = new Mesh(new BoxGeometry(len, height, depth), [
        concrete,
        concrete,
        crowdFor(len, depth),
        concrete,
        crowdFor(len, height),
        concrete,
      ]);
      place(stand, r + 2.4 + depth * (tier + 0.5), height / 2);
    }
  }

  // Foul poles at the ends of the wall, and low fences with stands along the foul lines.
  for (const side of [-1, 1]) {
    const end = fieldPoint(side * FOUL_ANGLE, wallRadius(FOUL_ANGLE) + 0.3);
    const pole = new Mesh(new CylinderGeometry(0.1, 0.1, 9, 8), yellow);
    pole.position.set(end.x, 4.5, end.z);
    scene.add(pole);

    const line = new Group();
    line.rotation.y = -side * FOUL_ANGLE;
    scene.add(line);
    // In this group's frame the foul line is the -z axis and foul ground is on the side of `side`.
    const fenceLength = wallRadius(FOUL_ANGLE) - 12;
    const fence = new Mesh(new BoxGeometry(0.5, 1.4, fenceLength), wallGreen);
    fence.position.set(side * 6, 0.7, -(12 + fenceLength / 2));
    line.add(fence);
    for (let tier = 0; tier < 3; tier++) {
      const height = 2.6 + tier * 2.4;
      // The face towards the field and the top carry the crowd.
      const faces = [concrete, concrete, crowdFor(fenceLength, 3.2), concrete, concrete, concrete];
      faces[side > 0 ? 1 : 0] = crowdFor(fenceLength, height);
      const stand = new Mesh(new BoxGeometry(3.2, height, fenceLength), faces);
      stand.position.set(side * (8.4 + tier * 3.2), height / 2, -(12 + fenceLength / 2));
      line.add(stand);
    }
    // A low dugout beside the line, with a bench.
    const pit = new Mesh(new BoxGeometry(2.4, 0.8, 6), std(0x3b4a73));
    pit.position.set(side * 6.2, 0.45, -12);
    line.add(pit);
    const bench = new Mesh(new BoxGeometry(0.5, 0.15, 5.4), std(0xc9a46a));
    bench.position.set(side * 6.8, 1.0, -12);
    line.add(bench);
  }

  // The scoreboard, high above the stands in centre field.
  const boardCanvas =
    typeof document === 'undefined'
      ? null
      : Object.assign(document.createElement('canvas'), { width: 512, height: 256 });
  const boardTexture = boardCanvas ? new CanvasTexture(boardCanvas) : null;
  if (boardTexture) boardTexture.colorSpace = SRGBColorSpace;
  const boardZ = BOARD.z;
  const board = new Mesh(new BoxGeometry(BOARD.width, BOARD.height, 0.8), [
    std(0x22262e),
    std(0x22262e),
    std(0x22262e),
    std(0x22262e),
    new MeshBasicMaterial({ map: boardTexture, color: boardTexture ? 0xffffff : 0x1c4d33 }),
    std(0x22262e),
  ]);
  board.position.set(BOARD.x, BOARD.y, boardZ);
  scene.add(board);
  // Posts from the ground up behind the board's lower edge.
  const postHeight = BOARD.y - BOARD.height / 2 + 2;
  for (const x of [-7, 7]) {
    const post = new Mesh(new BoxGeometry(0.8, postHeight, 0.8), std(0x3a3f4a));
    post.position.set(x, postHeight / 2, boardZ - 0.2);
    scene.add(post);
  }

  const setBoard = (info: BoardInfo) => {
    const g = boardCanvas?.getContext('2d');
    if (!g || !boardTexture) return;
    g.fillStyle = '#12432b';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#e8f5ea';
    g.lineWidth = 6;
    g.strokeRect(8, 8, 496, 240);
    g.fillStyle = '#ffe066';
    g.font = '800 54px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('BATTER UP', 256, 72);
    g.font = '800 40px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillStyle = '#ffffff';
    g.fillText('RUNS', 40, 135);
    g.fillText('OUTS', 40, 185);
    g.fillText('BATTER', 40, 232);
    g.textAlign = 'right';
    g.fillStyle = '#ffe066';
    g.fillText(String(info.runs), 472, 135);
    boardDotCentres().forEach((cx, i) => {
      g.beginPath();
      g.arc(cx, 172, BOARD_DOT_RADIUS, 0, Math.PI * 2);
      g.fillStyle = i < info.outs ? '#ffe066' : '#2f6b4a';
      g.fill();
      g.strokeStyle = '#ffe066';
      g.lineWidth = BOARD_DOT_STROKE;
      g.stroke();
    });
    g.fillStyle = '#ffe066';
    g.fillText(`${Math.min(info.batter, info.batters)} / ${info.batters}`, 472, 232);
    boardTexture.needsUpdate = true;
  };
  setBoard({ runs: 0, outs: 0, strikes: 0, batter: 1, batters: 9 });

  return {
    setBoard,
    fireworksCentre: { ...FIREWORKS_CENTRE },
  };
}
