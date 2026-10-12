import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type Scene,
} from 'three';
import { Body, Box, ContactMaterial, Material, Plane, Vec3, type World } from 'cannon-es';

// A kid-sized goal: taller than real life relative to its width so the four
// answer targets have room on portrait phones.
export const GOAL_WIDTH = 6.4;
export const GOAL_HEIGHT = 3;
export const NET_DEPTH = 1.6;
const POST_RADIUS = 0.08;

function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (g) draw(g);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function addLine(scene: Scene, x: number, z: number, width: number, depth: number) {
  const line = new Mesh(
    new PlaneGeometry(width, depth),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
  );
  line.rotation.x = -Math.PI / 2;
  line.position.set(x, 0.005, z);
  scene.add(line);
}

/** Grid of line segments over a rectangle, used for the net. */
function netGeometry(
  corner: [number, number, number],
  u: [number, number, number],
  v: [number, number, number],
  spacing: number,
): number[] {
  const lenU = Math.hypot(...u);
  const lenV = Math.hypot(...v);
  const points: number[] = [];
  const at = (s: number, t: number) => corner.map((c, i) => c + u[i] * s + v[i] * t);
  for (let s = 0; s <= lenU + 1e-6; s += spacing) {
    points.push(...at(s / lenU, 0), ...at(s / lenU, 1));
  }
  for (let t = 0; t <= lenV + 1e-6; t += spacing) {
    points.push(...at(0, t / lenV), ...at(1, t / lenV));
  }
  return points;
}

/** Pitch, goal, net, crowd and lights. */
export function buildField(scene: Scene): void {
  scene.add(new HemisphereLight(0xcfe8ff, 0x2e6b30, 1.4));
  scene.add(new AmbientLight(0xffffff, 0.4));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(6, 12, 10);
  scene.add(sun);

  // Striped grass
  const grass = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#3a9d48';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#348f41';
    g.fillRect(0, 0, 256, 128);
  });
  grass.wrapS = grass.wrapT = RepeatWrapping;
  grass.repeat.set(1, 12);
  const pitch = new Mesh(
    new PlaneGeometry(80, 80),
    new MeshStandardMaterial({ map: grass, roughness: 1 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.z = 10;
  scene.add(pitch);

  // Goal line, goal area and penalty area
  const w = 0.08;
  addLine(scene, 0, 0, 40, w);
  for (const [halfWidth, depth] of [
    [GOAL_WIDTH / 2 + 2, 2.2],
    [GOAL_WIDTH / 2 + 7, 9],
  ]) {
    addLine(scene, 0, depth, halfWidth * 2, w);
    addLine(scene, -halfWidth, depth / 2, w, depth);
    addLine(scene, halfWidth, depth / 2, w, depth);
  }

  // Posts and crossbar
  const frame = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  for (const side of [-1, 1]) {
    const post = new Mesh(new CylinderGeometry(POST_RADIUS, POST_RADIUS, GOAL_HEIGHT, 16), frame);
    post.position.set((side * GOAL_WIDTH) / 2, GOAL_HEIGHT / 2, 0);
    scene.add(post);
  }
  const bar = new Mesh(
    new CylinderGeometry(POST_RADIUS, POST_RADIUS, GOAL_WIDTH + POST_RADIUS * 2, 16),
    frame,
  );
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, GOAL_HEIGHT, 0);
  scene.add(bar);

  // Net: back, roof and both sides
  const hw = GOAL_WIDTH / 2;
  const h = GOAL_HEIGHT;
  const d = -NET_DEPTH;
  const net = [
    ...netGeometry([-hw, 0, d], [GOAL_WIDTH, 0, 0], [0, h, 0], 0.25),
    ...netGeometry([-hw, h, 0], [GOAL_WIDTH, 0, 0], [0, 0, d], 0.25),
    ...netGeometry([-hw, 0, 0], [0, 0, d], [0, h, 0], 0.25),
    ...netGeometry([hw, 0, 0], [0, 0, d], [0, h, 0], 0.25),
  ];
  const netGeo = new BufferGeometry();
  netGeo.setAttribute('position', new Float32BufferAttribute(net, 3));
  scene.add(
    new LineSegments(
      netGeo,
      new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    ),
  );

  // Advertising boards and a crowd behind the goal
  const boardColors = [0x1c7ed6, 0xf59f00, 0xe03131, 0x37b24d, 0x7048e8];
  for (let i = -6; i <= 6; i++) {
    const board = new Mesh(
      new BoxGeometry(5.9, 0.9, 0.1),
      new MeshStandardMaterial({ color: boardColors[(i + 6) % boardColors.length] }),
    );
    board.position.set(i * 6, 0.45, -5);
    scene.add(board);
  }
  const crowd = canvasTexture(1024, 256, (g) => {
    g.fillStyle = '#1b2240';
    g.fillRect(0, 0, 1024, 256);
    const colors = ['#ff6b6b', '#ffd43b', '#4dabf7', '#ffffff', '#69db7c', '#f783ac', '#ffa94d'];
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = colors[i % colors.length];
      g.beginPath();
      g.arc(Math.random() * 1024, 20 + Math.random() * 236, 3 + Math.random() * 2, 0, Math.PI * 2);
      g.fill();
    }
  });
  const stands = new Mesh(
    new PlaneGeometry(90, 14),
    new MeshStandardMaterial({ map: crowd, roughness: 1 }),
  );
  stands.position.set(0, 6, -12);
  stands.rotation.x = -0.25;
  scene.add(stands);
}

/** Ground, posts and net as static physics bodies so the ball stops in the goal. */
export function buildGoalBodies(world: World, ballMaterial: Material): void {
  const ground = new Material('ground');
  const net = new Material('net');
  world.addContactMaterial(
    new ContactMaterial(ballMaterial, ground, { restitution: 0.5, friction: 0.4 }),
  );
  world.addContactMaterial(
    new ContactMaterial(ballMaterial, net, { restitution: 0.05, friction: 0.8 }),
  );

  const floor = new Body({ mass: 0, shape: new Plane(), material: ground });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  const box = (
    half: [number, number, number],
    pos: [number, number, number],
    material: Material,
  ) => {
    const body = new Body({ mass: 0, shape: new Box(new Vec3(...half)), material });
    body.position.set(...pos);
    world.addBody(body);
  };
  const hw = GOAL_WIDTH / 2;
  // Thick boxes so a fast ball can't pass through in one physics step.
  box([hw + 1, GOAL_HEIGHT / 2 + 1, 0.5], [0, GOAL_HEIGHT / 2, -NET_DEPTH - 0.5], net);
  box([hw + 1, 0.5, NET_DEPTH / 2], [0, GOAL_HEIGHT + 0.5, -NET_DEPTH / 2], net);
  for (const side of [-1, 1]) {
    box(
      [0.5, GOAL_HEIGHT / 2, NET_DEPTH / 2],
      [side * (hw + 0.5), GOAL_HEIGHT / 2, -NET_DEPTH / 2],
      net,
    );
    box([POST_RADIUS, GOAL_HEIGHT / 2, POST_RADIUS], [side * hw, GOAL_HEIGHT / 2, 0], ground);
  }
  box([hw, POST_RADIUS, POST_RADIUS], [0, GOAL_HEIGHT, 0], ground);
}
