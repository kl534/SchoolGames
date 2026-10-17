/**
 * The shared set of fielding actions: every fielder, the pitcher and the catcher can scoop,
 * throw, catch, dive and so on. Each action is a pose with a clock; it holds until another one
 * starts or `stop` is called.
 */
import { lunge, type Mover } from './mover';
import { clamp01, easeInOut, easeOut, lerp, type Pose } from './person';
import type { Vec } from './flight';
import type { FielderPose } from './choreo';

export interface ActionOptions {
  /** Seconds from the start of a `throw` to the ball leaving the hand (an outfielder's crow hop). */
  release?: number;
}

export interface Actions {
  /** Starts an action. `toward` is who or what he faces; `side` +1 is to his glove (left) side. */
  start(pose: FielderPose, opts?: { toward?: Vec; side?: -1 | 1 }): void;
  /** Back to whatever the owner does when idle. */
  stop(): void;
  readonly pose: FielderPose | null;
  /** Seconds since the action began. */
  readonly clock: number;
  /** Poses the person this frame when an action is running; false when there is none. */
  build(pose: Pose, elapsed: number): boolean;
  /** Advances the clock, and carries a dive or a leap along. */
  update(delta: number): void;
  /** Runs the moment a throw leaves the hand. */
  onRelease?: () => void;
}

/** Seconds a pose takes from its start to the ball leaving the hand. */
const FLIP_RELEASE = 0.12;
const LOB_RELEASE = 0.12;
/** At second on a double play: a catch, a step across the bag, then the throw. */
export const PIVOT_RELEASE = 0.34;

export function createActions(mover: Mover, options: ActionOptions = {}): Actions {
  const throwRelease = options.release ?? 0.3;
  let current: FielderPose | null = null;
  let t = 0;
  let side: -1 | 1 = 1;
  let origin: Vec = { x: 0, y: 0, z: 0 };
  let released = false;
  let slideDir = { x: 0, z: 0 };

  const actions: Actions = {
    get pose() {
      return current;
    },
    get clock() {
      return t;
    },
    start(pose, opts) {
      current = pose;
      t = 0;
      released = false;
      side = opts?.side ?? 1;
      if (opts?.toward) mover.face(opts.toward);
      const p = mover.person.root.position;
      origin = { x: p.x, y: 0, z: p.z };
      if (pose === 'dive' || pose === 'dive-miss') {
        const yaw = mover.person.root.rotation.y;
        // His left (+x when facing +z) as a direction on the ground.
        slideDir = { x: Math.cos(yaw) * side, z: -Math.sin(yaw) * side };
      }
      mover.anim.transition(pose === 'dive' || pose === 'dive-miss' ? 0.08 : 0.12);
    },
    stop() {
      current = null;
      mover.anim.transition(0.2);
    },
    update(delta) {
      if (!current) return;
      t += delta;
      const release =
        current === 'throw'
          ? throwRelease
          : current === 'flip'
            ? FLIP_RELEASE
            : current === 'lob'
              ? LOB_RELEASE
              : current === 'pivot'
                ? PIVOT_RELEASE
                : Infinity;
      if (!released && t >= release) {
        released = true;
        actions.onRelease?.();
      }
      if (current === 'dive' || current === 'dive-miss') {
        const at = lunge(origin, slideDir, 1.6, t);
        mover.place(at.x, at.z);
      }
    },
    build(pose, elapsed) {
      if (!current) return false;
      buildPose(current, pose, t, elapsed, side, throwRelease);
      return true;
    },
  };
  return actions;
}

/** The glove arm is the left (+x); the throwing arm the right. */
function buildPose(
  name: FielderPose,
  pose: Pose,
  t: number,
  elapsed: number,
  side: -1 | 1,
  throwRelease: number,
): void {
  const sway = Math.sin(elapsed * 1.9);
  switch (name) {
    case 'ready':
      ready(pose, sway);
      return;
    case 'scoop': {
      const k = easeOut(clamp01(t / 0.2));
      pose.lift = -0.1 * k;
      pose.lean = 0.9 * k;
      pose.headPitch = -0.4 * k;
      pose.legL.raise = pose.legR.raise = 0.5 * k;
      pose.legL.bend = pose.legR.bend = 0.9 * k;
      pose.armL.raise = 1.0 * k;
      pose.armL.bend = 0.2;
      pose.armR.raise = 0.8 * k;
      pose.armR.bend = 0.3;
      return;
    }
    case 'backhand': {
      const k = easeOut(clamp01(t / 0.2));
      pose.lift = -0.1 * k;
      pose.lean = 0.8 * k;
      pose.twist = -0.5 * side * k;
      pose.headPitch = -0.35 * k;
      pose.legL.raise = pose.legR.raise = 0.5 * k;
      pose.legL.bend = pose.legR.bend = 0.9 * k;
      pose.armL.raise = 1.0 * k;
      pose.armL.out = -0.6 * k;
      pose.armL.bend = 0.2;
      pose.armR.raise = 0.4 * k;
      return;
    }
    case 'barehand': {
      const k = easeOut(clamp01(t / 0.15));
      pose.lift = -0.14 * k;
      pose.lean = 1.0 * k;
      pose.headPitch = -0.5 * k;
      pose.legL.raise = pose.legR.raise = 0.6 * k;
      pose.legL.bend = pose.legR.bend = 1.0 * k;
      pose.legL.out = pose.legR.out = 0.25;
      pose.armR.raise = 1.15 * k;
      pose.armR.bend = 0.1;
      pose.armL.raise = 0.6 * k;
      pose.armL.bend = 0.5;
      return;
    }
    case 'throw':
      overhand(pose, t, throwRelease);
      return;
    case 'flip': {
      // An underhand toss: the hand swings from behind the knee to out in front.
      const k = easeOut(clamp01(t / FLIP_RELEASE));
      const after = easeOut(clamp01((t - FLIP_RELEASE) / 0.25));
      pose.lean = 0.35 + 0.1 * k;
      pose.lift = -0.05;
      pose.headPitch = -0.2;
      pose.armR.raise = lerp(-0.3, 1.05, k) - 0.2 * after;
      pose.armR.bend = 0.2;
      pose.armL.raise = 0.9;
      pose.armL.bend = 0.7;
      pose.legL.bend = pose.legR.bend = 0.4;
      return;
    }
    case 'lob': {
      const k = easeOut(clamp01(t / LOB_RELEASE));
      pose.lean = 0.15;
      pose.armR.raise = lerp(1.3, 2.0, k);
      pose.armR.bend = lerp(1.2, 0.3, k);
      pose.armL.raise = 1.0;
      pose.armL.bend = 0.7;
      return;
    }
    case 'receive': {
      // Glove up at the chest towards the throw; a little snap when it comes.
      const snap = Math.sin(clamp01(t / 0.3) * Math.PI) * 0.1;
      pose.lean = 0.2;
      pose.lift = -0.05;
      pose.legL.bend = pose.legR.bend = 0.4;
      pose.legL.out = pose.legR.out = 0.2;
      pose.armL.raise = 1.45 + snap;
      pose.armL.bend = 0.4;
      pose.armR.raise = 0.9;
      pose.armR.bend = 0.9;
      return;
    }
    case 'stretch': {
      // First base: the back foot on the bag, the front leg lunging towards the throw.
      const k = easeOut(clamp01(t / 0.2));
      pose.lift = -0.12 * k;
      pose.lean = 0.35 * k;
      pose.legL.raise = 1.05 * k;
      pose.legL.bend = 0.2;
      pose.legR.raise = -0.45 * k;
      pose.legR.bend = 0.5 * k;
      pose.legL.out = 0.15;
      pose.armL.raise = 1.75 * k;
      pose.armL.bend = 0.15;
      pose.armR.raise = 0.6;
      pose.armR.bend = 0.5;
      return;
    }
    case 'pivot': {
      // Catch, step across the bag, throw to first.
      const catching = 1 - easeOut(clamp01(t / 0.12));
      if (t < 0.12) {
        pose.lean = 0.2;
        pose.armL.raise = 1.45;
        pose.armL.bend = 0.4;
        pose.armR.raise = 0.9;
        pose.armR.bend = 0.9;
        pose.legL.bend = pose.legR.bend = 0.4 * catching;
        return;
      }
      overhand(pose, t - 0.12, PIVOT_RELEASE - 0.12);
      return;
    }
    case 'settle': {
      // Under a fly ball, the glove above the head, looking up.
      const k = easeOut(clamp01(t / 0.25));
      pose.headPitch = 0.9 * k;
      pose.lean = -0.05 * k;
      pose.lift = -0.03 * k;
      pose.legL.bend = pose.legR.bend = 0.3 * k;
      pose.legL.out = pose.legR.out = 0.2;
      pose.armL.raise = 2.55 * k;
      pose.armL.bend = 0.25;
      pose.armR.raise = 1.6 * k;
      pose.armR.bend = 0.5;
      return;
    }
    case 'basket': {
      const k = easeOut(clamp01(t / 0.25));
      pose.lean = 0.2 * k;
      pose.headPitch = 0.55 * k;
      pose.armL.raise = 0.9 * k;
      pose.armR.raise = 0.9 * k;
      pose.armL.bend = pose.armR.bend = 1.2;
      pose.legL.bend = pose.legR.bend = 0.4 * k;
      return;
    }
    case 'dive':
    case 'dive-miss': {
      // Rolls out over his glove side, arm fully out, and gets up again after 0.6 s.
      const down = easeOut(clamp01(t / 0.2));
      const up = easeInOut(clamp01((t - 0.6) / 0.35));
      const k = down * (1 - up);
      pose.roll = 1.3 * side * k;
      pose.lift = -0.35 * k;
      pose.lean = 0.3 * k;
      pose.armL.raise = 2.9 * k;
      pose.armL.out = 0.2 * k;
      pose.armL.bend = 0.05;
      pose.armR.raise = 1.5 * k;
      pose.legL.raise = -0.3 * k;
      pose.legR.raise = 0.6 * k;
      pose.legR.bend = 0.5 * k;
      if (name === 'dive-miss') pose.headPitch = -0.2 * k;
      return;
    }
    case 'leap': {
      // Up at the wall, the glove as high as it goes.
      const s = clamp01(t / 0.5);
      pose.lift = 0.6 * 4 * s * (1 - s);
      pose.armL.raise = 3.0 * easeOut(clamp01(t / 0.2));
      pose.armL.bend = 0.05;
      pose.armR.raise = 1.6;
      pose.legL.bend = pose.legR.bend = 0.9 * (1 - Math.abs(s - 0.5) * 2);
      pose.headPitch = 0.7;
      return;
    }
    case 'call-for-it': {
      const k = easeOut(clamp01(t / 0.15));
      pose.headPitch = 0.8 * k;
      pose.armL.raise = 2.7 * k;
      pose.armL.out = (0.25 + Math.sin(t * 14) * 0.3) * k;
      pose.armL.bend = 0.2;
      pose.armR.raise = 0.5;
      pose.legL.bend = pose.legR.bend = 0.3;
      return;
    }
    case 'point-up': {
      const k = easeOut(clamp01(t / 0.2));
      pose.headPitch = 0.9 * k;
      pose.armR.raise = 2.8 * k;
      pose.armR.bend = 0.1;
      pose.armL.raise = 0.6;
      return;
    }
    case 'cover': {
      // One foot on the bag, the glove up as a target.
      pose.lean = 0.2;
      pose.lift = -0.05;
      pose.legL.raise = 0.55;
      pose.legL.bend = 0.3;
      pose.legR.bend = 0.3;
      pose.legL.out = pose.legR.out = 0.2;
      pose.armL.raise = 1.3 + sway * 0.03;
      pose.armL.bend = 0.5;
      pose.armR.raise = 0.5;
      pose.armR.bend = 0.6;
      return;
    }
    case 'tag': {
      // A sweep of the glove down to the bag.
      const k = easeInOut(clamp01(t / 0.25));
      pose.lean = lerp(0.2, 0.9, k);
      pose.lift = -0.1 * k;
      pose.armL.raise = lerp(1.45, 0.25, k);
      pose.armL.bend = lerp(0.4, 0.1, k);
      pose.armR.raise = 0.9;
      pose.legL.bend = pose.legR.bend = 0.6 * k;
      pose.legL.out = pose.legR.out = 0.25;
      return;
    }
    case 'let-go': {
      // Ducks a little, the glove up, as the throw goes through.
      const k = easeOut(clamp01(t / 0.15));
      pose.lift = -0.12 * k;
      pose.lean = 0.4 * k;
      pose.armL.raise = 2.2 * k;
      pose.armL.bend = 0.3;
      pose.armR.raise = 0.5;
      pose.legL.bend = pose.legR.bend = 0.6 * k;
      return;
    }
    case 'mask-off': {
      // Stands out of the crouch and tosses the mask away.
      const k = easeOut(clamp01(t / 0.3));
      pose.lean = 0.1;
      pose.headPitch = 0.5 * k;
      pose.armR.raise = lerp(0.9, 2.2, k);
      pose.armR.bend = lerp(0.9, 0.4, k);
      pose.armL.raise = 1.2;
      pose.armL.bend = 0.5;
      return;
    }
    case 'watch': {
      // Watching a ball sail away, glove hanging.
      const k = easeOut(clamp01(t / 0.3));
      pose.lean = -0.1 * k;
      pose.headPitch = 0.9 * k;
      pose.armL.raise = 0.2;
      pose.armR.raise = 0.1;
      return;
    }
  }
}

/** The fielder's usual stance, hands ready. */
export function ready(pose: Pose, sway = 0): void {
  pose.lift = -0.07;
  pose.lean = 0.3;
  pose.headPitch = -0.1;
  pose.legL.raise = pose.legR.raise = 0.35;
  pose.legL.bend = pose.legR.bend = 0.7;
  pose.legL.out = pose.legR.out = 0.2;
  pose.armL.raise = 0.75 + sway * 0.04;
  pose.armL.bend = 0.9;
  pose.armL.out = 0.1;
  pose.armR.raise = 0.3;
  pose.armR.bend = 0.4;
}

/**
 * An overhand throw: a small crow hop with the glove arm pointing at the target, then the arm
 * whips through. The ball leaves at `release` seconds in.
 */
function overhand(pose: Pose, t: number, release: number): void {
  const whip = 0.18;
  const hop = Math.max(release - whip, 0.04);
  const s = clamp01(t / hop);
  const w = easeInOut(clamp01((t - hop) / whip));
  const after = easeOut(clamp01((t - release) / 0.3));
  // The crow hop: a little jump forward as he gathers.
  pose.lift = 0.15 * Math.sin(Math.PI * s) * (t < hop ? 1 : 0) - 0.05 * w;
  pose.lean = lerp(lerp(0.15, 0.0, s), 0.65, w);
  pose.twist = lerp(-0.2, 0.25, w);
  pose.headPitch = lerp(0.05, -0.25, w);
  pose.armL.raise = lerp(1.4, 0.8, after);
  pose.armL.out = 0.1;
  pose.armL.bend = 0.3;
  // The throwing arm cocks back, whips over the top, and follows through across the body.
  pose.armR.raise = lerp(lerp(0.9, 2.4, s), lerp(2.4, 0.5, w), w > 0 ? 1 : 0);
  pose.armR.bend = lerp(lerp(0.8, 0.7, s), lerp(0.7, 0.3, w), w > 0 ? 1 : 0);
  pose.armR.out = lerp(0.1, -0.3, after);
  pose.legL.raise = lerp(0.2, 0.55, w);
  pose.legL.bend = lerp(0.5, 0.3, w);
  pose.legR.raise = -0.3 * w;
  pose.legR.bend = lerp(0.5, 0.9, w);
}
