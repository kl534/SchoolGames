import {
  BoxGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector2,
  type Object3D,
} from 'three';

/** Height of the hip pivot when standing. */
const WAIST_Y = 0.95;
/** Distance from the hip pivot to the glove tips with arms straight up. */
const REACH = 1.28;
const READY_ARM_ANGLE = 0.9;
const FLAT_ON_GROUND_Y = 0.35;

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t;

export interface Goalie {
  object: Object3D;
  /** Dive so the gloves reach (x, y) on the goalie's plane, arriving after `duration` s. */
  diveTo(x: number, y: number, duration: number, delay?: number): void;
  /** Back to the ready stance in the middle of the goal. */
  reset(): void;
  update(delta: number, elapsed: number): void;
}

function part(
  geometry: BoxGeometry | SphereGeometry,
  material: MeshStandardMaterial,
  x: number,
  y: number,
  z = 0,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

/** A blocky keeper built from primitives, facing +z (towards the camera). */
export function createGoalie(z: number): Goalie {
  const jersey = new MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.7 });
  const shorts = new MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.8 });
  const skin = new MeshStandardMaterial({ color: 0xc68642, roughness: 0.8 });
  const glove = new MeshStandardMaterial({ color: 0x51cf66, roughness: 0.6 });
  const dark = new MeshStandardMaterial({ color: 0x111111 });

  const root = new Group();
  root.position.set(0, WAIST_Y, z);

  root.add(part(new BoxGeometry(0.52, 0.62, 0.28), jersey, 0, 0.31));
  root.add(part(new BoxGeometry(0.5, 0.2, 0.3), shorts, 0, -0.02));
  root.add(part(new SphereGeometry(0.16, 16, 12), skin, 0, 0.8));
  for (const side of [-1, 1]) {
    root.add(part(new SphereGeometry(0.025, 8, 6), dark, side * 0.06, 0.84, 0.15));
    root.add(part(new BoxGeometry(0.18, 0.78, 0.2), shorts, side * 0.13, -0.5));
    root.add(part(new BoxGeometry(0.2, 0.1, 0.3), dark, side * 0.13, -0.9, 0.04));
  }

  // Arms pivot at the shoulders and point up (+y) at rotation 0.
  const arms = [-1, 1].map((side) => {
    const shoulder = new Group();
    shoulder.position.set(side * 0.3, 0.56, 0);
    shoulder.add(part(new BoxGeometry(0.13, 0.56, 0.14), jersey, 0, 0.28));
    shoulder.add(part(new SphereGeometry(0.1, 12, 10), glove, 0, 0.6));
    root.add(shoulder);
    return { shoulder, side };
  });

  type State = { x: number; y: number; roll: number; arm: number };
  const ready = (): State => ({ x: 0, y: WAIST_Y, roll: 0, arm: READY_ARM_ANGLE });
  let from = ready();
  let to = ready();
  let landing: State | null = null;
  let t = 0;
  let delay = 0;
  let duration = 0;
  let mode: 'idle' | 'dive' | 'land' | 'down' = 'idle';

  const apply = (s: State) => {
    root.position.x = s.x;
    root.position.y = s.y;
    root.rotation.z = s.roll;
    for (const { shoulder, side } of arms) shoulder.rotation.z = -side * s.arm;
  };
  const lerpState = (a: State, b: State, k: number): State => ({
    x: MathUtils.lerp(a.x, b.x, k),
    y: MathUtils.lerp(a.y, b.y, k),
    roll: MathUtils.lerp(a.roll, b.roll, k),
    arm: MathUtils.lerp(a.arm, b.arm, k),
  });
  const current = (): State => ({
    x: root.position.x,
    y: root.position.y,
    roll: root.rotation.z,
    arm: -arms[1].shoulder.rotation.z,
  });

  apply(from);

  return {
    object: root,
    diveTo(x, y, diveDuration, diveDelay = 0) {
      from = current();
      t = 0;
      delay = diveDelay;
      duration = Math.max(diveDuration, 0.15);
      mode = 'dive';
      if (y < WAIST_Y && Math.abs(x - from.x) < 0.8) {
        // Low ball straight at the keeper: crouch with arms down instead of diving.
        to = { x, y: Math.max(y + 0.45, 0.7), roll: 0, arm: 2.7 };
        landing = to;
        return;
      }
      const dir = new Vector2(x - from.x, y - WAIST_Y);
      if (dir.lengthSq() < 1e-6) dir.set(0, 1);
      dir.normalize();
      const reachX = x - dir.x * REACH;
      const reachY = Math.max(y - dir.y * REACH, FLAT_ON_GROUND_Y);
      const roll = Math.atan2(-dir.x, dir.y);
      to = { x: reachX, y: reachY, roll, arm: 0.12 };
      // After the save, fall flat on the side the keeper dived to.
      const side = Math.abs(roll) > 0.3 ? Math.sign(roll) : 0;
      landing = { x: reachX, y: side ? FLAT_ON_GROUND_Y : WAIST_Y, roll: side * 1.45, arm: 0.12 };
    },
    reset() {
      from = to = ready();
      landing = null;
      mode = 'idle';
      apply(from);
    },
    update(delta, elapsed) {
      if (mode === 'idle') {
        // Bounce and shuffle on the line.
        apply({
          x: Math.sin(elapsed * 1.7) * 0.3,
          y: WAIST_Y + Math.abs(Math.sin(elapsed * 3.4)) * 0.04,
          roll: Math.sin(elapsed * 1.7) * 0.05,
          arm: READY_ARM_ANGLE + Math.sin(elapsed * 3.4) * 0.08,
        });
        return;
      }
      if (delay > 0) {
        delay -= delta;
        return;
      }
      t += delta;
      if (mode === 'dive') {
        const k = Math.min(t / duration, 1);
        apply(lerpState(from, to, easeOut(k)));
        if (k >= 1) {
          mode = 'land';
          t = -0.12; // hang in the air for a moment
        }
      } else if (mode === 'land' && landing) {
        const k = Math.min(Math.max(t, 0) / 0.35, 1);
        apply(lerpState(to, landing, easeIn(k)));
        if (k >= 1) mode = 'down';
      }
    },
  };
}
