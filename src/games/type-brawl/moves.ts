/**
 * The hero's moves as pure keyframes (`moveFrame`), what a thug does when one lands (`reactionFrame`,
 * `launchPath`), and the small poses of a swing, a recoil and a fall. Poses are the shared person
 * rig's; the person faces +z, so these are written for the arm and leg nearest the camera being the
 * right ones (`mirrorPose` swaps them for a fighter facing the other way). No DOM, no three.js.
 */
import {
  clamp01,
  easeInOut,
  easeOut,
  lerp,
  mixPose,
  neutralPose,
  resetPose,
  type LimbPose,
  type Pose,
} from './person';
import type { MoveClass, MoveId } from './rules';

export interface Reaction {
  /** How far the thug is pushed back and returns (world units). */
  push: number;
  /** Lifted this high and dropped. */
  lift?: number;
  /** Turns spun (whole-body yaw). */
  spin?: number;
  /** The head snaps round. */
  snap?: boolean;
  /** Doubled over. */
  doubled?: boolean;
}

export interface Launch {
  /** Distance travelled along the floor; `dir` -1 throws back over the hero. */
  dist: number;
  dir: 1 | -1;
  /** Whole-body somersaults (positive back, negative forward) and whole-body spins about the head-to-toe axis. */
  flips: number;
  spins: number;
}

export interface MoveDef {
  id: MoveId;
  cls: MoveClass;
  /** Seconds the hero takes. */
  duration: number;
  /** Seconds in when the hit lands. */
  contact: number;
  word: string;
  reaction: Reaction;
  /** Finishers launch the thug instead. */
  launch?: Launch;
  /** Whole-body turns of the hero during the move. */
  spin?: number;
}

export const MOVES: Record<MoveId, MoveDef> = {
  jab: {
    id: 'jab',
    cls: 'light',
    duration: 0.35,
    contact: 0.14,
    word: 'POW!',
    reaction: { push: 0.15 },
  },
  cross: {
    id: 'cross',
    cls: 'light',
    duration: 0.4,
    contact: 0.18,
    word: 'BAM!',
    reaction: { push: 0.2 },
  },
  hook: {
    id: 'hook',
    cls: 'medium',
    duration: 0.5,
    contact: 0.22,
    word: 'WHAP!',
    reaction: { push: 0.3, snap: true },
  },
  kick: {
    id: 'kick',
    cls: 'medium',
    duration: 0.5,
    contact: 0.25,
    word: 'THWACK!',
    reaction: { push: 0.35 },
  },
  elbow: {
    id: 'elbow',
    cls: 'medium',
    duration: 0.45,
    contact: 0.2,
    word: 'BOP!',
    reaction: { push: 0.25, doubled: true },
  },
  uppercut: {
    id: 'uppercut',
    cls: 'heavy',
    duration: 0.6,
    contact: 0.28,
    word: 'SMACK!',
    reaction: { push: 0.1, lift: 0.3 },
  },
  roundhouse: {
    id: 'roundhouse',
    cls: 'heavy',
    duration: 0.65,
    contact: 0.3,
    word: 'CRACK!',
    reaction: { push: 0.4, spin: 0.5 },
  },
  'flying-kick': {
    id: 'flying-kick',
    cls: 'finisher',
    duration: 0.9,
    contact: 0.4,
    word: 'K.O.!',
    reaction: { push: 0 },
    launch: { dist: 4.5, dir: 1, flips: 1, spins: 0 },
  },
  'spin-kick': {
    id: 'spin-kick',
    cls: 'finisher',
    duration: 1.0,
    contact: 0.45,
    word: 'SMASH!',
    reaction: { push: 0 },
    launch: { dist: 5, dir: 1, flips: -1, spins: 2 },
    spin: 1,
  },
  throw: {
    id: 'throw',
    cls: 'finisher',
    duration: 1.1,
    contact: 0.5,
    word: 'BOOM!',
    reaction: { push: 0 },
    launch: { dist: 4, dir: -1, flips: 1, spins: 0 },
  },
};

/** Spread across the limbs of a spec: [raise, out, bend]. */
type L = [number, number, number];
interface Spec {
  lift?: number;
  lean?: number;
  twist?: number;
  headPitch?: number;
  headYaw?: number;
  roll?: number;
  armL?: L;
  armR?: L;
  legL?: L;
  legR?: L;
}

/** The boxing guard: fists up by the chin, knees a little bent, one foot back. */
const GUARD: Required<Spec> = {
  lift: -0.05,
  lean: 0.1,
  twist: 0.15,
  headPitch: 0,
  headYaw: 0,
  roll: 0,
  armL: [0.75, 0.1, 1.9],
  armR: [0.95, 0.1, 1.9],
  legL: [0.22, 0.1, 0.35],
  legR: [-0.2, 0.1, 0.4],
};

const setLimb = (limb: LimbPose, v: L): void => {
  limb.raise = v[0];
  limb.out = v[1];
  limb.bend = v[2];
};

/** Writes a spec over the guard into `pose`. */
function writeSpec(pose: Pose, spec: Spec): Pose {
  const s = { ...GUARD, ...spec };
  pose.lift = s.lift;
  pose.lean = s.lean;
  pose.twist = s.twist;
  pose.headPitch = s.headPitch;
  pose.headYaw = s.headYaw;
  pose.roll = s.roll;
  setLimb(pose.armL, s.armL);
  setLimb(pose.armR, s.armR);
  setLimb(pose.legL, s.legL);
  setLimb(pose.legR, s.legR);
  return pose;
}

/** The boxing guard, as a pose. */
export const guardPose = (pose: Pose): Pose => writeSpec(pose, {});

type Keys = [number, Spec][];

/** Keyframes for a move: at u = 0 the guard, the wind-up, the strike at `c` (contact / duration), the follow-through, the guard. */
function keysFor(id: MoveId, c: number): Keys {
  const wind = c * 0.5;
  const after = Math.min(0.98, c + (1 - c) * 0.4);
  switch (id) {
    case 'jab':
      return [
        [0, {}],
        [wind, { armR: [0.7, 0.1, 2.3], lean: 0.05 }],
        [c, { armR: [1.5, 0.05, 0.05], lean: 0.3, twist: 0.45, lift: -0.08 }],
        [after, { armR: [1.5, 0.05, 0.1], lean: 0.3, twist: 0.45, lift: -0.08 }],
        [1, {}],
      ];
    case 'cross':
      return [
        [0, {}],
        [wind, { armR: [0.4, 0.1, 2.4], twist: -0.3, lean: 0.0, legR: [-0.55, 0.1, 0.6] }],
        [
          c,
          { armR: [1.55, 0.05, 0.05], lean: 0.4, twist: 0.8, lift: -0.1, legR: [-0.5, 0.1, 0.2] },
        ],
        [
          after,
          { armR: [1.5, 0.05, 0.1], lean: 0.4, twist: 0.8, lift: -0.1, legR: [-0.5, 0.1, 0.2] },
        ],
        [1, {}],
      ];
    case 'hook':
      return [
        [0, {}],
        [wind, { armR: [0.7, 1.0, 1.9], twist: -0.5, lean: 0.0 }],
        [c, { armR: [1.35, 0.6, 1.5], twist: 0.9, lean: 0.3, lift: -0.08 }],
        [after, { armR: [1.2, 0.5, 1.6], twist: 0.9, lean: 0.3, lift: -0.08 }],
        [1, {}],
      ];
    case 'kick':
      return [
        [0, {}],
        [wind, { legR: [-0.4, 0.1, 1.3], lean: 0.0, armL: [0.2, 0.9, 0.4], armR: [0.4, 0.7, 0.4] }],
        [
          c,
          {
            legR: [1.55, 0.05, 0.05],
            lean: -0.25,
            armL: [0.1, 1.0, 0.3],
            armR: [0.6, 0.9, 0.3],
            lift: 0.0,
          },
        ],
        [
          after,
          { legR: [1.4, 0.05, 0.2], lean: -0.2, armL: [0.1, 1.0, 0.3], armR: [0.6, 0.9, 0.3] },
        ],
        [1, {}],
      ];
    case 'elbow':
      return [
        [0, {}],
        [wind, { armR: [0.9, 0.1, 2.6], twist: -0.3, lean: 0.0 }],
        [c, { armR: [1.15, 0.05, 2.5], twist: 0.9, lean: 0.4, lift: -0.12, legL: [0.5, 0.1, 0.6] }],
        [after, { armR: [1.15, 0.05, 2.5], twist: 0.9, lean: 0.4, lift: -0.12 }],
        [1, {}],
      ];
    case 'uppercut':
      return [
        [0, {}],
        [
          wind,
          {
            armR: [-0.2, 0.1, 1.3],
            lift: -0.2,
            lean: 0.2,
            legL: [0.5, 0.1, 0.9],
            legR: [-0.4, 0.1, 0.9],
          },
        ],
        [
          c,
          {
            armR: [2.3, 0.05, 0.6],
            lift: 0.12,
            lean: -0.15,
            twist: 0.6,
            legL: [0.1, 0.1, 0.1],
            legR: [-0.1, 0.1, 0.1],
            headPitch: 0.3,
          },
        ],
        [after, { armR: [2.4, 0.05, 0.5], lift: 0.06, lean: -0.1, twist: 0.6, headPitch: 0.3 }],
        [1, {}],
      ];
    case 'roundhouse':
      return [
        [0, {}],
        [
          wind,
          {
            legR: [-0.3, 0.8, 1.4],
            twist: -0.6,
            lean: 0.1,
            armL: [0.3, 1.0, 0.4],
            armR: [0.5, 1.0, 0.4],
          },
        ],
        [
          c,
          {
            legR: [1.45, 1.0, 0.15],
            twist: 0.7,
            lean: -0.3,
            roll: -0.15,
            armL: [0.2, 1.1, 0.3],
            armR: [0.4, 1.1, 0.3],
          },
        ],
        [
          after,
          {
            legR: [1.3, 0.9, 0.3],
            twist: 0.7,
            lean: -0.25,
            roll: -0.12,
            armL: [0.2, 1.1, 0.3],
            armR: [0.4, 1.1, 0.3],
          },
        ],
        [1, {}],
      ];
    case 'flying-kick':
      return [
        [0, {}],
        [
          wind,
          {
            lift: -0.25,
            lean: 0.2,
            legL: [0.6, 0.1, 1.2],
            legR: [-0.5, 0.1, 1.2],
            armL: [0.5, 0.2, 1.5],
            armR: [0.5, 0.2, 1.5],
          },
        ],
        [
          c,
          {
            lift: 0.55,
            lean: -0.6,
            legR: [1.55, 0.05, 0.05],
            legL: [0.2, 0.1, 1.3],
            armL: [0.2, 1.1, 0.4],
            armR: [0.6, 1.1, 0.4],
            headPitch: 0.2,
          },
        ],
        [
          after,
          {
            lift: 0.4,
            lean: -0.55,
            legR: [1.5, 0.05, 0.1],
            legL: [0.2, 0.1, 1.3],
            armL: [0.2, 1.1, 0.4],
            armR: [0.6, 1.1, 0.4],
          },
        ],
        [1, {}],
      ];
    case 'spin-kick':
      return [
        [0, {}],
        [
          wind,
          {
            lift: -0.2,
            twist: -0.8,
            lean: 0.1,
            legL: [0.5, 0.1, 1.0],
            legR: [-0.4, 0.1, 1.0],
            armL: [0.4, 0.8, 0.8],
            armR: [0.4, 0.8, 0.8],
          },
        ],
        [
          c,
          {
            lift: 0.2,
            twist: 0.6,
            lean: -0.3,
            legR: [1.5, 0.8, 0.1],
            roll: -0.15,
            armL: [0.2, 1.2, 0.3],
            armR: [0.4, 1.2, 0.3],
          },
        ],
        [
          after,
          {
            lift: 0.12,
            twist: 0.5,
            lean: -0.25,
            legR: [1.3, 0.8, 0.2],
            roll: -0.1,
            armL: [0.2, 1.2, 0.3],
            armR: [0.4, 1.2, 0.3],
          },
        ],
        [1, {}],
      ];
    case 'throw':
      return [
        [0, {}],
        [
          wind,
          {
            lean: 0.35,
            armL: [1.5, 0.2, 0.3],
            armR: [1.5, 0.2, 0.3],
            lift: -0.15,
            legL: [0.5, 0.1, 0.8],
            legR: [-0.3, 0.1, 0.8],
          },
        ],
        [
          c,
          {
            lean: -0.3,
            lift: -0.02,
            armL: [2.9, 0.2, 0.3],
            armR: [2.9, 0.2, 0.3],
            legL: [0.2, 0.1, 0.3],
            legR: [-0.2, 0.1, 0.3],
            headPitch: 0.3,
          },
        ],
        [
          after,
          {
            lean: 0.5,
            twist: 0.0,
            armL: [0.8, 0.2, 0.2],
            armR: [0.8, 0.2, 0.2],
            lift: -0.1,
            legL: [0.4, 0.1, 0.6],
          },
        ],
        [1, {}],
      ];
  }
}

const keyCache = new Map<MoveId, Keys>();
const keysOf = (id: MoveId): Keys => {
  let keys = keyCache.get(id);
  if (!keys) {
    const def = MOVES[id];
    keys = keysFor(id, def.contact / def.duration);
    keyCache.set(id, keys);
  }
  return keys;
};

const scratchA = neutralPose();
const scratchB = neutralPose();

/** The hero's pose `t` seconds into move `id` (clamped to its duration). */
export function moveFrame(id: MoveId, t: number, pose: Pose): Pose {
  const def = MOVES[id];
  const u = clamp01(t / def.duration);
  const keys = keysOf(id);
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const [u0, s0] = keys[i];
  const [u1, s1] = keys[i + 1];
  const k = u1 > u0 ? clamp01((u - u0) / (u1 - u0)) : 1;
  writeSpec(scratchA, s0);
  writeSpec(scratchB, s1);
  return mixPose(scratchA, scratchB, easeInOut(k), pose);
}

/** The yaw (radians) a spinning move adds to the hero at `t`: a whole turn between 25% and 90% of it. */
export function moveSpin(id: MoveId, t: number): number {
  const def = MOVES[id];
  if (!def.spin) return 0;
  const u = clamp01((t / def.duration - 0.2) / 0.7);
  return def.spin * Math.PI * 2 * easeInOut(u);
}

/** Swaps left and right (arms, legs, twist, roll, head yaw): the same move as seen when facing the other way. */
export function mirrorPose(pose: Pose): Pose {
  const arm = { ...pose.armL };
  Object.assign(pose.armL, pose.armR);
  Object.assign(pose.armR, arm);
  const leg = { ...pose.legL };
  Object.assign(pose.legL, pose.legR);
  Object.assign(pose.legR, leg);
  pose.twist = -pose.twist;
  pose.roll = -pose.roll;
  pose.headYaw = -pose.headYaw;
  return pose;
}

// ---------- What a thug does ----------

/** Seconds a stagger lasts. */
export const REACT_SECONDS = 0.5;

/** What a thug's body shows `r` seconds after a non-finisher move landed: pose, push, lift and spin. */
export function reactionFrame(
  reaction: Reaction,
  r: number,
  pose: Pose,
): { push: number; lift: number; spin: number } {
  const u = clamp01(r / REACT_SECONDS);
  const k = Math.sin(Math.PI * Math.min(1, u * 1.15)); // up fast, back down
  resetPose(pose);
  pose.lean = -0.35 * k;
  pose.headPitch = 0.35 * k;
  pose.armL.raise = 0.9 * k;
  pose.armL.out = 0.9 * k;
  pose.armR.raise = 0.7 * k;
  pose.armR.out = 0.9 * k;
  pose.legL.raise = 0.25 * k;
  pose.legR.raise = -0.25 * k;
  if (reaction.snap) pose.headYaw = 1.0 * k;
  if (reaction.doubled) {
    pose.lean = 1.0 * k;
    pose.headPitch = -0.2 * k;
    pose.lift = -0.08 * k;
    pose.armL.raise = 0.2 * k;
    pose.armR.raise = 0.2 * k;
    pose.armL.out = 0.3 * k;
    pose.armR.out = 0.3 * k;
  }
  return {
    push: reaction.push * k,
    lift: (reaction.lift ?? 0) * k,
    spin: (reaction.spin ?? 0) * easeOut(u),
  };
}

/** Seconds in the air, lying on the ground, and shrinking away after a finisher. */
export const AIR_SECONDS = 0.8;
export const LYING_SECONDS = 0.4;
export const SHRINK_SECONDS = 0.4;
export const LAUNCH_SECONDS = AIR_SECONDS + LYING_SECONDS + SHRINK_SECONDS;
export const LAUNCH_APEX = 1.2;

export interface LaunchState {
  /** Distance along the floor from where the thug stood, away from the hero (negative: over and behind). */
  dx: number;
  /** Height of the feet above the floor. */
  y: number;
  /** Somersault turns (about the sideways axis) and spins (about the vertical axis). */
  flips: number;
  spins: number;
  scale: number;
  lying: boolean;
}

/** The ballistic path of a launched thug `t` seconds after contact: apex 1.2 over 0.8 s, then lying 0.4 s, then shrinking away. */
export function launchPath(launch: Launch, t: number): LaunchState {
  const air = clamp01(t / AIR_SECONDS);
  const dx = launch.dist * launch.dir * easeOut(air) * 0.85 + launch.dist * launch.dir * 0.15 * air;
  const y = 4 * LAUNCH_APEX * air * (1 - air);
  const shrink = clamp01((t - AIR_SECONDS - LYING_SECONDS) / SHRINK_SECONDS);
  return {
    dx,
    y,
    flips: launch.flips * air,
    spins: launch.spins * air,
    scale: 1 - shrink,
    lying: t >= AIR_SECONDS,
  };
}

/** The pose of a launched thug: flung out in the air, then flat on the ground. */
export function flyingPose(pose: Pose, t: number): Pose {
  resetPose(pose);
  const air = clamp01(t / AIR_SECONDS);
  const spread = Math.sin(Math.PI * Math.min(1, air * 1.1));
  pose.armL.raise = 2.2 * spread + 0.4;
  pose.armR.raise = 2.0 * spread + 0.4;
  pose.armL.out = 0.8 * spread;
  pose.armR.out = 0.8 * spread;
  pose.legL.raise = 0.6 * spread;
  pose.legR.raise = -0.3 * spread;
  pose.legL.bend = 0.4 * spread;
  pose.headPitch = 0.5 * spread;
  return pose;
}

// ---------- The hero and the thugs when they are hit or hit ----------

export const SWING_SECONDS = 0.5;
export const SWING_CONTACT = 0.25;
export const HURT_SECONDS = 0.35;
export const DOWN_SECONDS = 0.6;

/** A thug's punch `t` seconds in: pulls back, throws at 0.25 s, and returns. */
export function swingPose(pose: Pose, t: number): Pose {
  const u = clamp01(t / SWING_SECONDS);
  const contact = SWING_CONTACT / SWING_SECONDS;
  resetPose(pose);
  const wind = clamp01(u / contact);
  const strike = clamp01((u - contact) / 0.25);
  const out = 1 - clamp01((u - contact - 0.2) / 0.3);
  const reach = easeOut(wind) * (1 - strike) * 0.9 + strike * out;
  pose.twist =
    lerp(-0.5, 0.8, easeInOut(clamp01(u / contact))) * (u < 0.9 ? 1 : 1 - (u - 0.9) * 10);
  pose.lean = 0.35 * reach;
  pose.armR.raise = lerp(-0.4, 1.55, easeOut(clamp01((u - contact * 0.7) / (contact * 0.5))));
  pose.armR.bend = lerp(2.0, 0.05, easeOut(clamp01((u - contact * 0.7) / (contact * 0.5))));
  if (u > contact + 0.25) {
    const back = clamp01((u - contact - 0.25) / 0.25);
    pose.armR.raise = lerp(pose.armR.raise, 0, back);
    pose.armR.bend = lerp(pose.armR.bend, 0.3, back);
    pose.lean = lerp(pose.lean, 0, back);
  }
  pose.armL.raise = 0.6;
  pose.armL.bend = 1.6;
  pose.legL.raise = 0.3;
  pose.legR.raise = -0.3;
  return pose;
}

/** The hero's recoil `t` seconds after a hit: knocked back, head snapped. */
export function hurtPose(pose: Pose, t: number): Pose {
  const u = clamp01(t / HURT_SECONDS);
  const k = Math.sin(Math.PI * Math.min(1, u * 1.1));
  guardPose(pose);
  pose.lean = lerp(0.1, -0.5, k);
  pose.headPitch = 0.4 * k;
  pose.armL.raise = lerp(0.75, 0.3, k);
  pose.armL.out = lerp(0.1, 0.9, k);
  pose.armL.bend = lerp(1.9, 0.6, k);
  pose.armR.raise = lerp(0.95, 0.4, k);
  pose.armR.out = lerp(0.1, 0.9, k);
  pose.armR.bend = lerp(1.9, 0.6, k);
  pose.lift = lerp(-0.05, 0.02, k);
  return pose;
}

/** How far the hero is knocked back (world units) `t` seconds after a hit. */
export const hurtPush = (t: number): number =>
  0.25 * Math.sin(Math.PI * Math.min(1, clamp01(t / HURT_SECONDS) * 1.1));

/** The hero going down: reeling and falling back over 0.6 s. Returns how far the body has tipped (0 to 1). */
export function downPose(pose: Pose, t: number): number {
  const u = clamp01(t / DOWN_SECONDS);
  resetPose(pose);
  const fall = easeInOut(u);
  pose.armL.raise = 0.6 * (1 - fall) + 1.4 * fall;
  pose.armR.raise = 0.6 * (1 - fall) + 1.2 * fall;
  pose.armL.out = 0.9;
  pose.armR.out = 0.9;
  pose.headPitch = 0.4 * fall;
  pose.legL.raise = 0.3 * fall;
  pose.legR.raise = -0.2 * fall;
  return fall;
}
