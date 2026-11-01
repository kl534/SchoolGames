import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { cheer, slump } from './moves';
import {
  createAnimator,
  createPerson,
  limb,
  type Animator,
  type Person,
  type Pose,
} from './person';
import { WALL_X } from './shots';

const flat = (color: number, roughness = 0.9) => new MeshStandardMaterial({ color, roughness });

/** Where the watching kids stand along the fence, and what they wear. */
const WATCHERS = [
  { x: -1.5, shirt: 0xff7a59, pants: 0x3a4a6a },
  { x: 0, shirt: 0xb185ff, pants: 0x4a5a3a },
  { x: 1.5, shirt: 0x4cc9f0, pants: 0x6a4a3a },
  { x: 2.8, shirt: 0xffd23f, pants: 0x3a4a6a },
] as const;
const WATCHER_Z = -2.75;

export interface Watchers {
  /** The watching kids hop with arms up for `seconds`. */
  cheer(seconds?: number): void;
  /** They slump for `seconds`. */
  slump(seconds?: number): void;
}

export interface Court {
  object: Group;
  kids: Watchers;
  update(delta: number, elapsed: number): void;
}

function canvasTexture(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D) => void,
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (g) draw(g);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** Red-brown bricks with light mortar lines. */
function brickTexture(): Texture {
  const texture = canvasTexture(128, 128, (g) => {
    g.fillStyle = '#d9cfc2';
    g.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) {
      const shift = row % 2 ? 16 : 0;
      for (let col = -1; col < 4; col++) {
        const tint = 0xb5 + ((row * 7 + col * 13) % 3) * 6;
        g.fillStyle = `rgb(${tint}, ${0x54 + ((col + row) % 2) * 6}, ${0x3c})`;
        g.fillRect(col * 32 + shift + 1.5, row * 16 + 1.5, 29, 13);
      }
    }
  });
  texture.magFilter = NearestFilter;
  return texture;
}

/** A grey chain-link diamond grid on a clear background. */
function fenceTexture(): Texture {
  const texture = canvasTexture(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = '#8c929a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(64, 64);
    g.moveTo(0, 64);
    g.lineTo(64, 0);
    g.stroke();
  });
  return texture;
}

/** The school wall, the asphalt court and the yard behind it, with four watching kids. */
export function buildCourt(): Court {
  const object = new Group();

  // Light.
  object.add(new HemisphereLight(0xffffff, 0x99aa88, 1.6));
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(2, 5, 4);
  object.add(sun);

  // Asphalt and painted lines.
  const asphalt = new Mesh(new PlaneGeometry(14, 10), flat(0x5b5f66, 1));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(1, 0, 0.5);
  object.add(asphalt);
  const paint = flat(0xf2c230, 0.8);
  const line = (w: number, d: number, x: number, z: number) => {
    const bar = new Mesh(new BoxGeometry(w, 0.01, d), paint);
    bar.position.set(x, 0.006, z);
    object.add(bar);
  };
  line(8, 0.06, 1.2, -1.6);
  line(8, 0.06, 1.2, 1.4);
  line(0.06, 3.06, -0.6, -0.1);
  line(0.06, 3.06, 3.2, -0.1);

  // The brick wall, with its face at WALL_X.
  const bricks = brickTexture();
  bricks.repeat.set(3, 1.2);
  const brickMaterial = new MeshStandardMaterial({ map: bricks, roughness: 0.95 });
  const wall = new Mesh(new BoxGeometry(0.4, 3.4, 4.8), brickMaterial);
  wall.position.set(WALL_X - 0.2, 1.7, -0.2);
  object.add(wall);
  const stripe = new Mesh(new BoxGeometry(0.02, 0.08, 4.8), flat(0xffffff, 0.7));
  stripe.position.set(WALL_X + 0.005, 0.3, -0.2);
  object.add(stripe);
  const cap = new Mesh(new BoxGeometry(0.5, 0.1, 4.9), flat(0xc9c2b6));
  cap.position.set(WALL_X - 0.2, 3.45, -0.2);
  object.add(cap);

  // Grass beyond, a chain-link fence, the school and a tree.
  const grass = new Mesh(new PlaneGeometry(40, 14), flat(0x5aa54a, 1));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.002, -10);
  object.add(grass);
  const mesh = fenceTexture();
  mesh.repeat.set(26, 4);
  const fence = new Mesh(
    new PlaneGeometry(13, 1.8),
    new MeshStandardMaterial({ map: mesh, transparent: true, side: DoubleSide, roughness: 0.6 }),
  );
  fence.position.set(1, 0.9, -3.2);
  object.add(fence);
  const topRail = new Mesh(new BoxGeometry(13, 0.05, 0.05), flat(0x8c929a, 0.5));
  topRail.position.set(1, 1.8, -3.2);
  object.add(topRail);
  for (let i = 0; i <= 6; i++) {
    const post = new Mesh(new CylinderGeometry(0.03, 0.03, 1.85, 6), flat(0x8c929a, 0.5));
    post.position.set(-5.5 + i * 2.2, 0.92, -3.2);
    object.add(post);
  }

  const school = new Mesh(new BoxGeometry(14, 3.2, 1.5), flat(0xd8b78a));
  school.position.set(1, 1.6, -8);
  object.add(school);
  const glass = flat(0x8fc4e8, 0.3);
  for (let i = 0; i < 6; i++) {
    const win = new Mesh(new BoxGeometry(1.0, 0.8, 0.05), glass);
    win.position.set(-4 + i * 1.8, 1.9, -7.22);
    object.add(win);
  }
  const door = new Mesh(new BoxGeometry(1.0, 1.6, 0.05), flat(0x7a4a2a));
  door.position.set(1, 0.8, -7.22);
  object.add(door);
  const trunk = new Mesh(new CylinderGeometry(0.18, 0.25, 2.2, 8), flat(0x7a5a3a));
  trunk.position.set(5.5, 1.1, -5.2);
  object.add(trunk);
  for (const [x, y, r] of [
    [5.5, 3.0, 1.1],
    [4.9, 2.6, 0.8],
    [6.1, 2.7, 0.8],
  ] as const) {
    const leaves = new Mesh(new SphereGeometry(r, 12, 10), flat(0x3f8f3f));
    leaves.position.set(x, y, -5.2);
    object.add(leaves);
  }
  const bush = new Mesh(new ConeGeometry(0.5, 0.9, 8), flat(0x3f8f3f));
  bush.position.set(-4.4, 0.45, -4.4);
  object.add(bush);

  // The watching kids.
  const watchers: { person: Person; animator: Animator; phase: number }[] = WATCHERS.map(
    (spot, i) => {
      const person = createPerson({ shirt: spot.shirt, pants: spot.pants, hat: 'none' });
      person.setScale(0.95);
      person.root.position.set(spot.x, 0, WATCHER_Z);
      person.root.rotation.y = -Math.sign(spot.x - 0.5) * 0.2;
      object.add(person.root);
      return { person, animator: createAnimator(person), phase: i * 1.7 };
    },
  );
  let mode: 'sway' | 'cheer' | 'slump' = 'sway';
  let until = 0;
  let started = 0;
  let last = 0;

  const startMode = (next: 'cheer' | 'slump', seconds: number, blend: number) => {
    mode = next;
    started = last;
    until = last + seconds;
    for (const w of watchers) w.animator.transition(blend);
  };

  const pose = (target: Pose, k: number) => {
    const frame = (mode === 'cheer' ? cheer : slump)(k);
    target.lift = frame.lift ?? 0;
    target.lean = frame.lean ?? 0;
    target.headPitch = frame.headPitch ?? 0;
    for (const arm of [target.armL, target.armR]) {
      const from = frame.hit ?? limb();
      arm.raise = from.raise;
      arm.out = from.out;
      arm.bend = from.bend;
    }
  };

  return {
    object,
    kids: {
      cheer: (seconds = 1) => startMode('cheer', seconds, 0.12),
      slump: (seconds = 1) => startMode('slump', seconds, 0.2),
    },
    update(delta, elapsed) {
      last = elapsed;
      if (mode !== 'sway' && elapsed >= until) {
        mode = 'sway';
        for (const w of watchers) w.animator.transition(0.3);
      }
      for (const w of watchers) {
        w.animator.step(delta, (target) => {
          const t = elapsed + w.phase;
          if (mode !== 'sway') {
            pose(target, elapsed - started);
          } else {
            target.roll = Math.sin(t * 1.6) * 0.05;
            target.armL.out = target.armR.out = 0.1 + Math.sin(t * 1.6) * 0.05;
            target.lift = Math.max(0, Math.sin(t * 3.1)) * 0.015;
          }
        });
      }
    },
  };
}
