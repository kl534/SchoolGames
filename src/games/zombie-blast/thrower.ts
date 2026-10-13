import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { createBomb } from './bomb';

const HIP_Y = 0.5;
/** Shoulders, relative to the torso's pivot at the hips (world height about 0.86). */
const SHOULDER_Y = 0.36;
const UPPER_ARM = 0.2;
const FOREARM = 0.18;
/** The big head sits clear above the torso: its centre is at this world height. */
const HEAD_Y = 1.12;
const HEAD_RADIUS = 0.22;
/** Seconds from the start of the throw to the bomb leaving the hand. */
export const RELEASE_TIME = 0.32;
const WINDUP_TIME = 0.2;
const THROW_TIME = 0.62;

export type Reaction = 'cheer' | 'cower';

export interface Thrower {
  /** The kid faces -z (away from the camera, towards the zombies). */
  object: Group;
  /** Starts an overarm throw; `onRelease` runs the moment the bomb leaves the hand. */
  throwBomb(onRelease: () => void): void;
  /** Cheers or cowers after the outcome is known. */
  react(reaction: Reaction): void;
  /** World position of the throwing hand. */
  handPosition(out: Vector3): Vector3;
  /** Ready again, with a fresh bomb in hand. */
  reset(): void;
  update(delta: number, elapsed: number): void;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const lerp = MathUtils.lerp;

function mesh(
  geometry: BufferGeometry,
  material: Material,
  parent: Object3D,
  x = 0,
  y = 0,
  z = 0,
): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function joint(parent: Object3D, x: number, y: number, z = 0): Group {
  const g = new Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** A cartoon kid in a blue hoodie and red cap, seen from behind, with a bomb in the throwing hand. */
export function createThrower(): Thrower {
  const hoodie = new MeshStandardMaterial({ color: 0x2f8cff, roughness: 0.7 });
  const jeans = new MeshStandardMaterial({ color: 0x2c3a6b, roughness: 0.8 });
  const skin = new MeshStandardMaterial({ color: 0xf1b48a, roughness: 0.75 });
  const hair = new MeshStandardMaterial({ color: 0x5a3416, roughness: 0.9 });
  const cap = new MeshStandardMaterial({ color: 0xe8353d, roughness: 0.6 });
  const pack = new MeshStandardMaterial({ color: 0xffb703, roughness: 0.7 });
  const shoe = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });

  const root = new Group();
  const body = joint(root, 0, 0);

  // Legs and shoes
  const legs = [-1, 1].map((side) => {
    const hip = joint(body, side * 0.1, HIP_Y);
    mesh(new CapsuleGeometry(0.075, 0.3, 4, 10), jeans, hip, 0, -0.22);
    mesh(new BoxGeometry(0.14, 0.09, 0.26), shoe, hip, 0, -0.46, -0.04);
    return { hip, side };
  });

  // Torso twists and leans for the throw.
  const torso = joint(body, 0, HIP_Y);
  torso.rotation.order = 'YXZ';
  // A short, chubby torso (top at about 0.92) with a small backpack that stays below the neck.
  mesh(new CapsuleGeometry(0.16, 0.1, 6, 16), hoodie, torso, 0, 0.2).scale.set(1.2, 1, 0.9);
  mesh(new BoxGeometry(0.3, 0.3, 0.12), pack, torso, 0, 0.2, 0.2);
  mesh(new BoxGeometry(0.2, 0.1, 0.05), pack, torso, 0, 0.1, 0.27);
  // The hood is rolled into a collar around the base of the neck.
  const collar = mesh(new TorusGeometry(0.1, 0.045, 8, 20), hoodie, torso, 0, 0.42, 0.02);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.15, 1.1, 1);
  mesh(new CylinderGeometry(0.06, 0.065, 0.12, 10), skin, torso, 0, 0.45, 0);

  // Big round head, brown hair over the back and sides, ears, and a red cap on backwards.
  const head = joint(torso, 0, HEAD_Y - HIP_Y);
  mesh(new SphereGeometry(HEAD_RADIUS, 24, 18), skin, head);
  // Sphere azimuth 0 to π runs round the back (+z) from one side to the other.
  mesh(
    new SphereGeometry(HEAD_RADIUS + 0.012, 24, 16, -0.45, Math.PI + 0.9, 0.85, 1.45),
    hair,
    head,
  );
  for (const side of [-1, 1]) {
    mesh(
      new SphereGeometry(0.05, 10, 8),
      skin,
      head,
      side * (HEAD_RADIUS + 0.005),
      -0.02,
      0.02,
    ).scale.set(0.55, 1, 0.9);
  }
  mesh(
    new SphereGeometry(HEAD_RADIUS + 0.018, 24, 12, 0, Math.PI * 2, 0, 1.25),
    cap,
    head,
    0,
    0.03,
    0,
  ).scale.set(1, 0.95, 1);
  mesh(new SphereGeometry(0.03, 8, 6), cap, head, 0, HEAD_RADIUS + 0.035, 0);
  // The brim points back at the camera.
  const brim = mesh(
    new CylinderGeometry(0.19, 0.19, 0.025, 20, 1, false, -Math.PI / 2, Math.PI),
    cap,
    head,
    0,
    0.07,
    0.1,
  );
  brim.scale.set(1.15, 1, 1.2);
  brim.rotation.x = 0.18;

  // Left arm hangs relaxed; the right one throws.
  const leftShoulder = joint(torso, -0.23, SHOULDER_Y);
  mesh(
    new CapsuleGeometry(0.052, UPPER_ARM + FOREARM - 0.06, 4, 10),
    hoodie,
    leftShoulder,
    0,
    -0.17,
  );
  mesh(new SphereGeometry(0.06, 10, 8), skin, leftShoulder, 0, -0.38);

  const shoulder = joint(torso, 0.23, SHOULDER_Y);
  mesh(new SphereGeometry(0.075, 12, 8), hoodie, shoulder);
  mesh(new CapsuleGeometry(0.055, UPPER_ARM - 0.06, 4, 10), hoodie, shoulder, 0, -UPPER_ARM / 2);
  const elbow = joint(shoulder, 0, -UPPER_ARM);
  mesh(new CapsuleGeometry(0.05, FOREARM - 0.06, 4, 10), hoodie, elbow, 0, -FOREARM / 2);
  const hand = joint(elbow, 0, -FOREARM - 0.03);
  mesh(new SphereGeometry(0.065, 10, 8), skin, hand);
  const bomb = createBomb();
  bomb.object.position.set(0, -0.12, -0.02);
  bomb.object.scale.setScalar(0.6);
  hand.add(bomb.object);

  const shadow = mesh(
    new CircleGeometry(0.4, 24),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
    root,
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;

  let mode: 'idle' | 'throw' | Reaction = 'idle';
  let t = 0;
  let released = false;
  let onRelease: (() => void) | undefined;

  const setIdle = (elapsed: number) => {
    const breath = Math.sin(elapsed * 2.4);
    body.position.y = breath * 0.008;
    body.rotation.set(0, 0, 0);
    torso.rotation.set(breath * 0.02, Math.sin(elapsed * 0.9) * 0.06, 0);
    head.rotation.set(0, Math.sin(elapsed * 0.9) * 0.1, 0);
    // The bomb is held up, ready, in front of the shoulder.
    shoulder.rotation.set(0.8 + breath * 0.03, 0, -0.05);
    elbow.rotation.set(1.35, 0, 0);
    leftShoulder.rotation.set(0.1, 0, 0.08);
    legs.forEach(({ hip, side }) => hip.rotation.set(0, 0, side * 0.03));
    bomb.object.visible = true;
  };

  const setThrow = () => {
    const wind = easeInOut(clamp01(t / WINDUP_TIME));
    const swing = easeOut(clamp01((t - WINDUP_TIME) / (THROW_TIME - WINDUP_TIME)));
    // Arm back and up, then over the top and forward; the body twists and leans into it.
    shoulder.rotation.x = lerp(lerp(0.8, -2.3, wind), -4.9, swing);
    shoulder.rotation.z = lerp(-0.05, -0.25, wind) * (1 - swing);
    elbow.rotation.x = lerp(lerp(1.35, 0.5, wind), 0.1, swing);
    torso.rotation.y = lerp(lerp(0, -0.65, wind), 0.55, swing);
    torso.rotation.x = lerp(lerp(0, 0.18, wind), -0.35, swing);
    leftShoulder.rotation.x = lerp(0.1, -0.9, wind) * (1 - swing) + swing * 0.5;
    head.rotation.set(0, 0.15 * (1 - swing), 0);
    body.position.y = swing * 0.0;
    legs.forEach(({ hip, side }) => hip.rotation.set(side * 0.35 * swing, 0, side * 0.03));
    if (!released && t >= RELEASE_TIME) {
      released = true;
      bomb.object.visible = false;
      onRelease?.();
    }
  };

  const setReaction = (elapsed: number) => {
    const k = easeOut(clamp01(t / 0.25));
    torso.rotation.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    legs.forEach(({ hip, side }) => hip.rotation.set(0, 0, side * 0.03));
    if (mode === 'cheer') {
      // Hop with both arms in the air.
      body.position.y = Math.abs(Math.sin(t * 9)) * 0.14 * k;
      shoulder.rotation.set(lerp(-4.9, -3.3, k), 0, lerp(0, 0.45, k));
      leftShoulder.rotation.set(lerp(0.5, -3.3, k), 0, lerp(0, -0.45, k));
      elbow.rotation.set(0.15, 0, 0);
      head.rotation.set(-0.25 * k, 0, 0);
    } else {
      // Arms over the head, knees knocking.
      body.position.y = -0.05 * k + Math.sin(elapsed * 40) * 0.006;
      torso.rotation.x = 0.25 * k;
      shoulder.rotation.set(lerp(-4.9, -2.6, k), 0, lerp(0, 0.3, k));
      leftShoulder.rotation.set(lerp(0.5, -2.6, k), 0, lerp(0, -0.3, k));
      elbow.rotation.set(lerp(0.1, 0.3, k), 0, 0);
      head.rotation.set(0.3 * k, 0, 0);
    }
  };

  return {
    object: root,
    throwBomb(callback) {
      mode = 'throw';
      t = 0;
      released = false;
      onRelease = callback;
    },
    react(reaction) {
      if (mode === reaction) return;
      mode = reaction;
      t = 0;
      // Whatever is left in the hand gets dropped.
      bomb.object.visible = false;
    },
    handPosition(out) {
      root.updateMatrixWorld(true);
      return hand.getWorldPosition(out);
    },
    reset() {
      mode = 'idle';
      t = 0;
      released = false;
      onRelease = undefined;
    },
    update(delta, elapsed) {
      bomb.update(elapsed);
      if (mode === 'idle') {
        setIdle(elapsed);
        return;
      }
      t += delta;
      if (mode === 'throw') setThrow();
      else setReaction(elapsed);
    },
  };
}
