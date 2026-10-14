import { MathUtils } from 'three';
import type { Vec } from './flight';
import { createAnimator, runPose, type Animator, type Person, type Pose } from './person';

/** Ground covered per full stride (a cycle of the legs), in world units. */
const STRIDE = 2.6;

export interface Mover {
  person: Person;
  anim: Animator;
  /** Poses the person when standing still. Swap it to change what they do while waiting. */
  idle: (pose: Pose, elapsed: number) => void;
  readonly moving: boolean;
  /** Runs along `points` in turn at `speed` (units/s); `onArrive` runs at the last one. */
  runTo(points: Vec[], speed: number, onArrive?: () => void): void;
  /** Stops where they are. */
  halt(): void;
  /** Turns to face a spot when standing still. */
  face(point: Vec): void;
  setYaw(yaw: number): void;
  place(x: number, z: number): void;
  update(delta: number, elapsed: number): void;
}

/** Yaw (about y) that makes something facing +z look along (dx, dz). */
export function yawTo(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

function turnToward(current: number, goal: number, rate: number, delta: number): number {
  const diff = MathUtils.euclideanModulo(goal - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + diff * (1 - Math.exp(-rate * delta));
}

/** Gives a person somewhere to be: running between spots, facing the way they go. */
export function createMover(person: Person): Mover {
  const anim = createAnimator(person);
  let path: Vec[] = [];
  let speed = 0;
  let onArrive: (() => void) | undefined;
  let moving = false;
  let phase = 0;
  let yaw = person.root.rotation.y;
  let faceYaw = yaw;
  let amount = 0;

  const mover: Mover = {
    person,
    anim,
    idle: () => {},
    get moving() {
      return moving;
    },
    runTo(points, runSpeed, arrive) {
      path = [...points];
      speed = runSpeed;
      onArrive = arrive;
    },
    halt() {
      path = [];
      onArrive = undefined;
    },
    face(point) {
      faceYaw = yawTo(point.x - person.root.position.x, point.z - person.root.position.z);
    },
    setYaw(value) {
      yaw = faceYaw = value;
      person.root.rotation.y = value;
    },
    place(x, z) {
      person.root.position.set(x, person.root.position.y, z);
    },
    update(delta, elapsed) {
      const pos = person.root.position;
      let heading: number | null = null;
      const wasMoving = moving;
      if (path.length) {
        let left = speed * delta;
        while (path.length && left > 0) {
          const next = path[0];
          const dx = next.x - pos.x;
          const dz = next.z - pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 1e-4) heading = yawTo(dx, dz);
          if (dist <= left) {
            pos.x = next.x;
            pos.z = next.z;
            left -= dist;
            path.shift();
          } else {
            pos.x += (dx / dist) * left;
            pos.z += (dz / dist) * left;
            left = 0;
          }
        }
        moving = true;
        phase += ((speed * delta) / STRIDE) * Math.PI * 2;
        amount = Math.min(1, speed / 9);
        if (!path.length) {
          moving = false;
          const arrive = onArrive;
          onArrive = undefined;
          arrive?.();
        }
      } else {
        moving = false;
      }
      if (moving !== wasMoving) anim.transition(0.18);
      if (heading !== null) faceYaw = heading;
      yaw = turnToward(yaw, heading ?? faceYaw, heading === null ? 6 : 14, delta);
      person.root.rotation.y = yaw;
      anim.step(delta, (pose) => {
        if (moving) runPose(pose, phase, amount);
        else mover.idle(pose, elapsed);
      });
    },
  };
  return mover;
}
