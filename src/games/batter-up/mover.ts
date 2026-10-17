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
  /**
   * Runs along `points` in turn at `speed` (units/s); `onArrive` runs at the last one. With
   * `face` the person keeps facing that spot while moving (a backpedal or a shuffle), and the leg
   * cycle runs backward when the motion is away from where they face.
   */
  runTo(
    points: Vec[],
    speed: number,
    onArrive?: () => void,
    opts?: { face?: Vec; slowEnd?: number },
  ): void;
  /** Poses the person in place of the run cycle or the idle pose, when it returns true. */
  override?: (pose: Pose, elapsed: number) => boolean;
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

/**
 * How far a dive carries the root, in the direction `dir` (a unit vector on the ground), `t`
 * seconds in: up to 1.6 units over 0.35 s. Returns the offset from where the dive began.
 */
export function lunge(from: Vec, dir: { x: number; z: number }, distance: number, t: number): Vec {
  const k = Math.min(Math.max(t / 0.35, 0), 1);
  const eased = 1 - (1 - k) ** 2;
  const d = Math.min(distance, 1.6) * eased;
  return { x: from.x + dir.x * d, y: from.y, z: from.z + dir.z * d };
}

/** Gives a person somewhere to be: running between spots, facing the way they go. */
export function createMover(
  person: Person,
  opts: { ground?: (x: number, z: number) => number } = {},
): Mover {
  const anim = createAnimator(person);
  let path: Vec[] = [];
  let speed = 0;
  let onArrive: (() => void) | undefined;
  let moving = false;
  let phase = 0;
  let yaw = person.root.rotation.y;
  let faceYaw = yaw;
  let amount = 0;
  let facing: Vec | null = null;
  let slowEnd = 0;

  const mover: Mover = {
    person,
    anim,
    idle: () => {},
    get moving() {
      return moving;
    },
    runTo(points, runSpeed, arrive, options) {
      path = [...points];
      speed = runSpeed;
      onArrive = arrive;
      facing = options?.face ?? null;
      slowEnd = options?.slowEnd ?? 0;
    },
    halt() {
      path = [];
      onArrive = undefined;
      facing = null;
      slowEnd = 0;
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
      let backward = false;
      let arrived: (() => void) | undefined;
      const wasMoving = moving;
      if (path.length) {
        // A slide slows down over its last few units, to a little under half speed.
        let now = speed;
        if (slowEnd > 0) {
          let remaining = Math.hypot(path[0].x - pos.x, path[0].z - pos.z);
          for (let i = 1; i < path.length; i++) {
            remaining += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
          }
          if (remaining < slowEnd) now = speed * (0.45 + 0.55 * (remaining / slowEnd));
        }
        let left = now * delta;
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
        if (facing) {
          // Look at the spot, not where they are going; the legs run backward if they back away.
          const toFace = yawTo(facing.x - pos.x, facing.z - pos.z);
          if (heading !== null) {
            backward = Math.cos(heading - toFace) < -0.2;
            heading = toFace;
          }
        }
        phase += (((backward ? -now : now) * delta) / STRIDE) * Math.PI * 2;
        amount = Math.min(1, speed / 9);
        if (!path.length) {
          moving = false;
          facing = null;
          arrived = onArrive;
          onArrive = undefined;
        }
      } else {
        moving = false;
      }
      if (moving !== wasMoving) anim.transition(0.18);
      if (heading !== null) faceYaw = heading;
      if (opts.ground) pos.y = opts.ground(pos.x, pos.z);
      yaw = turnToward(yaw, heading ?? faceYaw, heading === null ? 6 : 14, delta);
      person.root.rotation.y = yaw;
      anim.step(delta, (pose) => {
        if (mover.override?.(pose, elapsed)) return;
        if (moving) runPose(pose, phase, amount);
        else mover.idle(pose, elapsed);
      });
      // Arriving may turn him (face a spot, set a pose), so it comes after this frame's heading.
      arrived?.();
    },
  };
  return mover;
}
