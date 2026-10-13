import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
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
  type Object3D,
  type Scene,
} from 'three';
import { BARRICADE_Z, LANES, laneX } from './layout';
import {
  easeOutBack,
  fallTime,
  FENCE_GRAVITY,
  planksInReach,
  plankFlight,
  wrapAngle,
  type Point3,
} from './rules';

/** The colour of the sky at the horizon; the mist at the far end matches it. */
export const HORIZON_COLOR = 0xf7b58f;

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

/** Small deterministic random numbers so the scenery is the same every time. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function skyTexture() {
  return canvasTexture(8, 512, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#5b3bb0');
    sky.addColorStop(0.25, '#7d4fc4');
    sky.addColorStop(0.33, '#a560cc');
    sky.addColorStop(0.4, '#e47fa8');
    sky.addColorStop(0.46, '#ff9f6e');
    sky.addColorStop(0.5, '#f7b58f');
    sky.addColorStop(1, '#f7b58f');
    g.fillStyle = sky;
    g.fillRect(0, 0, 8, 512);
  });
}

function mistTexture() {
  return canvasTexture(128, 128, (g) => {
    const puff = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    puff.addColorStop(0, 'rgba(255,236,222,0.95)');
    puff.addColorStop(0.55, 'rgba(255,226,208,0.5)');
    puff.addColorStop(1, 'rgba(255,220,200,0)');
    g.fillStyle = puff;
    g.fillRect(0, 0, 128, 128);
  });
}

function stoneTexture(kind: number) {
  return canvasTexture(128, 160, (g) => {
    g.fillStyle = '#b9b3cf';
    g.fillRect(0, 0, 128, 160);
    g.strokeStyle = '#2d2a45';
    g.fillStyle = '#2d2a45';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.font = 'bold 40px system-ui, sans-serif';
    g.textAlign = 'center';
    if (kind === 0) {
      g.fillText('RIP', 64, 72);
      g.beginPath();
      g.moveTo(40, 100);
      g.lineTo(88, 100);
      g.stroke();
    } else if (kind === 1) {
      // A goofy face with crossed-out eyes and its tongue out.
      for (const x of [44, 84]) {
        g.beginPath();
        g.moveTo(x - 10, 46);
        g.lineTo(x + 10, 66);
        g.moveTo(x + 10, 46);
        g.lineTo(x - 10, 66);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(40, 100);
      g.quadraticCurveTo(64, 120, 90, 98);
      g.stroke();
      g.fillStyle = '#ff6b8b';
      g.beginPath();
      g.ellipse(72, 112, 9, 14, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillText('BOO!', 64, 80);
    }
  });
}

/** A rounded tombstone with a silly face, facing +z. */
function tombstone(kind: number): Group {
  const group = new Group();
  const stone = new MeshStandardMaterial({ color: 0xb9b3cf, roughness: 0.9 });
  const face = new MeshStandardMaterial({ map: stoneTexture(kind), roughness: 0.9 });
  const w = 0.75;
  const h = 0.8;
  const body = new Mesh(new BoxGeometry(w, h, 0.2), stone);
  body.position.y = h / 2;
  group.add(body);
  const top = new Mesh(new CylinderGeometry(w / 2, w / 2, 0.2, 20, 1, false, 0, Math.PI), stone);
  top.rotation.x = Math.PI / 2;
  top.rotation.z = Math.PI / 2;
  top.position.y = h;
  group.add(top);
  const decal = new Mesh(new PlaneGeometry(w * 0.92, 1.05), face);
  decal.position.set(0, 0.52, 0.102);
  group.add(decal);
  const mound = new Mesh(
    new SphereGeometry(0.55, 14, 8),
    new MeshStandardMaterial({ color: 0x6b5a3f, roughness: 1 }),
  );
  mound.scale.set(1, 0.18, 0.9);
  mound.position.set(0, 0.02, 0.35);
  group.add(mound);
  return group;
}

/** A plump pumpkin with a glowing grin, facing +z. */
function pumpkin(): Group {
  const group = new Group();
  const skin = new MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.6 });
  const rib = new MeshStandardMaterial({ color: 0xf07300, roughness: 0.6 });
  const glow = new MeshBasicMaterial({ color: 0xffe14d });
  const stem = new MeshStandardMaterial({ color: 0x4f8a2b, roughness: 0.9 });
  const core = new Mesh(new SphereGeometry(0.42, 18, 12), skin);
  core.scale.set(1.15, 0.85, 1.05);
  core.position.y = 0.36;
  group.add(core);
  for (const angle of [-0.9, 0.9]) {
    const side = new Mesh(new SphereGeometry(0.4, 14, 10), rib);
    side.scale.set(0.7, 0.84, 1);
    side.position.set(Math.sin(angle) * 0.34, 0.36, Math.cos(angle) * 0.1);
    group.add(side);
  }
  const stalk = new Mesh(new CylinderGeometry(0.05, 0.08, 0.2, 8), stem);
  stalk.position.set(0.02, 0.76, 0);
  stalk.rotation.z = 0.25;
  group.add(stalk);
  const tri = new Shape();
  tri.moveTo(0, 0.09);
  tri.lineTo(-0.08, -0.06);
  tri.lineTo(0.08, -0.06);
  tri.closePath();
  for (const x of [-0.17, 0.17]) {
    const eye = new Mesh(new ShapeGeometry(tri), glow);
    eye.position.set(x, 0.46, 0.43);
    group.add(eye);
  }
  const grin = new Shape();
  grin.moveTo(-0.26, 0.12);
  grin.quadraticCurveTo(0, -0.14, 0.26, 0.12);
  grin.lineTo(0.2, 0.0);
  grin.quadraticCurveTo(0, -0.14, -0.2, 0.0);
  grin.closePath();
  const mouth = new Mesh(new ShapeGeometry(grin), glow);
  mouth.position.set(0, 0.22, 0.43);
  group.add(mouth);
  return group;
}

/** A position and rotation a fence piece can be sent back to. */
interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

/** A plank or post that can be knocked about and then pops back into place. */
interface Piece {
  object: Object3D;
  home: Pose;
  /** Where it was when the repair began. */
  from: Pose;
  state: 'home' | 'moving' | 'repairing';
  /** Seconds since it was smashed, or since the repair began. */
  t: number;
}

interface Plank extends Piece {
  velocity: Point3;
  spin: Point3;
  /** Seconds in the air, and the rotation it lands with. */
  airTime: number;
  landed: Point3;
}

interface Post extends Piece {
  /** Sideways lean it falls with, in radians. */
  side: number;
}

/** Planks within this of a lane's centre are smashed when a zombie goes through it. */
const SMASH_REACH = 1.1;
/** Posts within this of a lane's centre fall over. */
const POST_REACH = 0.8;
/** Planks come to rest this high, lying on the grass. */
const PLANK_FLOOR = 0.06;
/** Seconds a landed plank takes to settle flat. */
const SETTLE_TIME = 0.15;
const TIP_TIME = 0.3;
const TIP_ANGLE = 1.3;
const REPAIR_TIME = 0.3;

const homePose = (object: Object3D): Pose => ({
  x: object.position.x,
  y: object.position.y,
  z: object.position.z,
  rx: object.rotation.x,
  ry: object.rotation.y,
  rz: object.rotation.z,
});

const blank = (): Pose => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });

export interface Fence {
  object: Group;
  smash(x: number): void;
  repair(): void;
  update(delta: number): void;
}

/** A row of posts and nailed planks that zombies can smash through and that mend themselves. */
export function barricade(): Fence {
  const group = new Group();
  const rand = seeded(7);
  const woods = [0xb7773f, 0xc98a4b, 0x9c6532, 0xd09b5c].map(
    (color) => new MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  const nail = new MeshStandardMaterial({ color: 0x8b8f9c, roughness: 0.4, metalness: 0.6 });
  const nailGeometry = new SphereGeometry(0.03, 6, 4);
  const spacing = 1.5;
  const count = 13;
  const planks: Plank[] = [];
  const posts: Post[] = [];
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    const height = 0.85 + rand() * 0.2;
    // Each post is a pivot at ground level, so it tips over about its base.
    const pivot = new Group();
    pivot.position.set(x, 0, 0);
    pivot.rotation.z = (rand() - 0.5) * 0.08;
    group.add(pivot);
    const post = new Mesh(new BoxGeometry(0.24, height, 0.24), woods[2]);
    post.position.y = height / 2;
    pivot.add(post);
    const point = new Mesh(new ConeGeometry(0.17, 0.2, 4), woods[2]);
    point.position.y = height + 0.08;
    point.rotation.y = Math.PI / 4;
    pivot.add(point);
    posts.push({
      object: pivot,
      home: homePose(pivot),
      from: blank(),
      state: 'home',
      t: 0,
      side: 0,
    });
    if (i < count - 1) {
      for (const [row, y] of [0.22, 0.46, 0.7].entries()) {
        const plank = new Mesh(
          new BoxGeometry(spacing + 0.12, 0.2, 0.09),
          woods[(i + row * 2) % 4 === 2 ? 0 : (i + row) % 4],
        );
        plank.position.set(x + spacing / 2, y + (rand() - 0.5) * 0.05, 0.14);
        plank.rotation.z = (rand() - 0.5) * 0.1;
        group.add(plank);
        for (const dx of [-0.6, 0.6]) {
          const head = new Mesh(nailGeometry, nail);
          head.position.set(dx, 0, 0.06);
          plank.add(head);
        }
        planks.push({
          object: plank,
          home: homePose(plank),
          from: blank(),
          state: 'home',
          t: 0,
          velocity: { x: 0, y: 0, z: 0 },
          spin: { x: 0, y: 0, z: 0 },
          airTime: 0,
          landed: { x: 0, y: 0, z: 0 },
        });
      }
    }
  }
  group.position.z = BARRICADE_Z;

  const plankXs = planks.map((p) => p.home.x);
  const scratch: Point3 = { x: 0, y: 0, z: 0 };

  const startRepair = (piece: Piece) => {
    const { object, from } = piece;
    from.x = object.position.x;
    from.y = object.position.y;
    from.z = object.position.z;
    from.rx = wrapAngle(object.rotation.x);
    from.ry = wrapAngle(object.rotation.y);
    from.rz = wrapAngle(object.rotation.z);
    piece.state = 'repairing';
    piece.t = 0;
  };

  /** Eases the piece back to its home pose with a little overshoot. */
  const stepRepair = (piece: Piece, delta: number) => {
    piece.t += delta;
    const { object, from, home } = piece;
    const done = piece.t >= REPAIR_TIME;
    const k = done ? 1 : easeOutBack(piece.t / REPAIR_TIME);
    object.position.set(
      from.x + (home.x - from.x) * k,
      from.y + (home.y - from.y) * k,
      from.z + (home.z - from.z) * k,
    );
    object.rotation.set(
      from.rx + (home.rx - from.rx) * k,
      from.ry + (home.ry - from.ry) * k,
      from.rz + (home.rz - from.rz) * k,
    );
    if (done) piece.state = 'home';
  };

  const stepPlank = (plank: Plank, delta: number) => {
    plank.t += delta;
    const { home, spin, landed, airTime } = plank;
    const p = plankFlight(home, plank.velocity, plank.t, PLANK_FLOOR, FENCE_GRAVITY, scratch);
    plank.object.position.set(p.x, p.y, p.z);
    const air = Math.min(plank.t, airTime);
    // Tumbling in the air, then dropping flat on the grass once it lands.
    const settle = easeOutBack((plank.t - airTime) / SETTLE_TIME, 0.8);
    const flatX = landed.x >= 0 ? Math.PI / 2 : -Math.PI / 2;
    plank.object.rotation.set(
      plank.t < airTime ? home.rx + spin.x * air : landed.x + (flatX - landed.x) * settle,
      plank.t < airTime ? home.ry + spin.y * air : landed.y * (1 - settle),
      home.rz + spin.z * air,
    );
  };

  const stepPost = (post: Post, delta: number) => {
    post.t += delta;
    const k = Math.min(post.t / TIP_TIME, 1);
    const fall = k * k;
    post.object.rotation.set(post.home.rx + TIP_ANGLE * fall, 0, post.home.rz + post.side * fall);
  };

  return {
    object: group,
    smash(x) {
      for (const i of planksInReach(plankXs, x, SMASH_REACH)) {
        const plank = planks[i];
        if (plank.state !== 'home') continue;
        // Flung towards the kid, spinning.
        const { velocity, spin, home } = plank;
        velocity.x = (Math.random() - 0.5) * 3;
        velocity.y = 2.5 + Math.random() * 1.5;
        velocity.z = 1.5 + Math.random() * 1.5;
        spin.x = (Math.random() - 0.5) * 12;
        spin.y = (Math.random() - 0.5) * 6;
        spin.z = (Math.random() - 0.5) * 12;
        plank.airTime = fallTime(home.y, velocity.y, PLANK_FLOOR);
        plank.landed.x = wrapAngle(home.rx + spin.x * plank.airTime);
        plank.landed.y = wrapAngle(home.ry + spin.y * plank.airTime);
        plank.landed.z = home.rz + spin.z * plank.airTime;
        plank.state = 'moving';
        plank.t = 0;
      }
      for (const post of posts) {
        if (post.state !== 'home' || Math.abs(post.home.x - x) > POST_REACH) continue;
        post.side = (Math.random() - 0.5) * 0.3;
        post.state = 'moving';
        post.t = 0;
      }
    },
    repair() {
      for (const piece of [...planks, ...posts]) if (piece.state !== 'home') startRepair(piece);
    },
    update(delta) {
      for (const plank of planks) {
        if (plank.state === 'moving') stepPlank(plank, delta);
        else if (plank.state === 'repairing') stepRepair(plank, delta);
      }
      for (const post of posts) {
        if (post.state === 'moving') stepPost(post, delta);
        else if (post.state === 'repairing') stepRepair(post, delta);
      }
    },
  };
}

export interface Field {
  /** Moves the graveyard clear of the zombies' lanes, which depend on the screen shape. */
  layout(lane: number): void;
  /** A zombie smashes through the barricade at this x: the planks there fly off and posts tip. */
  smashFence(x: number): void;
  /** Mends the barricade, every plank and post popping back into place. */
  repairFence(): void;
  /** Drifts the mist, flaps the bats and moves any broken fence. */
  update(elapsed: number, delta: number): void;
}

/** Room to leave around the outer zombies, including their stretched-out arms. */
const LANE_CLEARANCE = 1.1;

/** The dusk lawn: sky, mist, barricade, tombstones and pumpkins. */
export function buildField(scene: Scene): Field {
  scene.fog = new Fog(HORIZON_COLOR, 12, 34);
  scene.add(new HemisphereLight(0xffd6ee, 0x5a8f46, 1.5));
  scene.add(new AmbientLight(0xffffff, 0.45));
  const sun = new DirectionalLight(0xffe2b8, 2.3);
  sun.position.set(-5, 9, 12);
  scene.add(sun);

  // Sky dome, a low sun and a few puffy clouds.
  const dome = new Mesh(
    new SphereGeometry(320, 24, 16),
    new MeshBasicMaterial({ map: skyTexture(), side: BackSide, fog: false, depthWrite: false }),
  );
  dome.position.y = 0;
  dome.renderOrder = -2;
  scene.add(dome);
  const sunDisc = new Mesh(
    new CircleGeometry(34, 32),
    new MeshBasicMaterial({ color: 0xffe9a3, fog: false }),
  );
  sunDisc.position.set(55, 14, -290);
  scene.add(sunDisc);
  const cloudMat = new MeshBasicMaterial({
    color: 0xffc9d8,
    fog: false,
    transparent: true,
    opacity: 0.85,
  });
  const rand = seeded(11);
  for (let i = 0; i < 7; i++) {
    const cloud = new Group();
    for (let j = 0; j < 4; j++) {
      const blob = new Mesh(new SphereGeometry(1, 10, 8), cloudMat);
      blob.scale.set(9 + rand() * 6, 3 + rand() * 2, 3);
      blob.position.set((j - 1.5) * 9, rand() * 2, 0);
      cloud.add(blob);
    }
    cloud.position.set((i - 3) * 70 + rand() * 20, 55 + rand() * 40, -280);
    scene.add(cloud);
  }

  // Striped lawn that fades into the mist.
  const grass = canvasTexture(8, 128, (g) => {
    g.fillStyle = '#5db04a';
    g.fillRect(0, 0, 8, 128);
    g.fillStyle = '#55a643';
    g.fillRect(0, 0, 8, 64);
  });
  grass.wrapS = grass.wrapT = RepeatWrapping;
  grass.repeat.set(1, 60);
  const lawn = new Mesh(
    new PlaneGeometry(500, 500),
    new MeshStandardMaterial({ map: grass, roughness: 1 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.z = -150;
  scene.add(lawn);

  const fence = barricade();
  scene.add(fence.object);

  // Goofy graveyard along both sides. Positions are fixed so every game looks the same; how far
  // out each one stands is set in `layout`, so none ever hides a zombie.
  const scenery = seeded(3);
  const props: { object: Group; side: number; z: number; gap: number; far: boolean }[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const near = i < 4;
      const stone = tombstone(Math.floor(scenery() * 3));
      stone.rotation.set(0, (scenery() - 0.5) * 0.5 - side * 0.15, (scenery() - 0.5) * 0.3);
      scene.add(stone);
      props.push({
        object: stone,
        side,
        z: near ? 1 - i * 2.4 + scenery() : -9 - (i - 4) * 2.6 - scenery() * 2,
        gap: near ? 0.5 + scenery() * 1.6 : 0.8 + scenery() * 8,
        far: !near,
      });
    }
    for (let i = 0; i < 4; i++) {
      const p = pumpkin();
      p.rotation.y = (scenery() - 0.5) * 0.8 - side * 0.3;
      p.scale.setScalar(0.9 + scenery() * 0.6);
      scene.add(p);
      props.push({
        object: p,
        side,
        z: i < 2 ? -1.5 - scenery() * 5 : -10 - scenery() * 8,
        gap: i < 2 ? 0.5 + scenery() * 2.5 : 0.8 + scenery() * 7,
        far: i >= 2,
      });
    }
  }

  // Low mist at the far end where the zombies come out.
  const mistMat = new MeshBasicMaterial({
    map: mistTexture(),
    transparent: true,
    depthWrite: false,
    fog: false,
    side: DoubleSide,
  });
  const puffs: { mesh: Mesh; x: number; speed: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const mesh = new Mesh(new PlaneGeometry(10, 4), mistMat);
    const x = (i - 5.5) * 3.4;
    mesh.position.set(x, 1.2 + scenery() * 1.2, -14.5 - (i % 4) * 2.4);
    scene.add(mesh);
    puffs.push({ mesh, x, speed: 0.15 + scenery() * 0.2 });
  }

  // A few bats flapping across the sky.
  const batMat = new MeshBasicMaterial({ color: 0x3a2358, fog: false, side: DoubleSide });
  const wing = new Shape();
  wing.moveTo(0, 0);
  wing.quadraticCurveTo(1.2, 1.1, 2.6, 0.2);
  wing.quadraticCurveTo(1.8, 0.2, 1.4, -0.5);
  wing.quadraticCurveTo(0.7, -0.1, 0, -0.4);
  wing.closePath();
  const wingGeo = new ShapeGeometry(wing);
  const bats = [0, 1, 2].map((i) => {
    const bat = new Group();
    const body = new Mesh(new SphereGeometry(0.5, 8, 6), batMat);
    body.scale.set(0.8, 1, 0.8);
    bat.add(body);
    const wings = [-1, 1].map((side) => {
      const w = new Mesh(wingGeo, batMat);
      w.scale.x = side;
      bat.add(w);
      return { w, side };
    });
    bat.scale.setScalar(2.2);
    scene.add(bat);
    return { bat, wings, i };
  });

  return {
    layout(lane) {
      for (const { object, side, z, gap, far } of props) {
        // Beyond the start line the zombies are hidden in the mist, so far props may stand in
        // their lanes; nearer ones keep clear.
        const edge = far ? 0.6 : laneX(LANES - 1, z, lane) + LANE_CLEARANCE;
        object.position.set(side * (edge + gap), 0, z);
      }
    },
    smashFence: (x) => fence.smash(x),
    repairFence: () => fence.repair(),
    update(elapsed, delta) {
      fence.update(delta);
      for (const puff of puffs) {
        puff.mesh.position.x = puff.x + Math.sin(elapsed * puff.speed + puff.x) * 1.2;
      }
      for (const { bat, wings, i } of bats) {
        const a = elapsed * (0.25 + i * 0.07) + i * 2.1;
        bat.position.set(Math.cos(a) * (30 + i * 12) - 10, 26 + i * 6 + Math.sin(a * 2) * 2, -150);
        const flap = Math.sin(elapsed * 12 + i) * 0.6;
        for (const { w, side } of wings) w.rotation.z = flap * side;
      }
    },
  };
}
