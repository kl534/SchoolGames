/**
 * The kids of the race: their looks (the player in gold, nine rivals), the poses (crouch, run,
 * stumble, face-plant, head down, clap, wave and the dances) and `createRunner`, which puts a
 * person on an animator and a mode. The poses are pure: they only write a `Pose`.
 */
import { writeDance, type DanceId } from '../../shared/dances';
import { FACEPLANT_SECONDS, GETUP_SECONDS, RACE_SPEED, PLAYER_LANE, RIVAL_FACTORS } from './rules';
import {
  createAnimator,
  createPerson,
  easeInOut,
  mixPose,
  neutralPose,
  resetPose,
  runPose,
  type Animator,
  type Person,
  type PersonStyle,
  type Pose,
} from './person';

export const PLAYER_SHIRT = 0xffc928;
export const PLAYER_PANTS = 0x1d4ed8;
const RIVAL_SHIRTS = [
  0xe63946, 0x2a9d8f, 0x8338ec, 0xff8fab, 0x3a86ff, 0xfb8500, 0x06d6a0, 0x8d99ae, 0x9b5de5,
];
const SKINS = [0xf1b48a, 0xe0a070, 0xc68642, 0x8d5524, 0xffd9b8];
const HAIRS = [0x2b1b10, 0x5a3416, 0xc9a227, 0xb5532a, 0x111111];
const SHORTS = [0x1d3557, 0x264653, 0x3d405b, 0x2b2d42, 0x14213d];

export const playerLook = (): PersonStyle => ({
  shirt: PLAYER_SHIRT,
  pants: PLAYER_PANTS,
  hair: 0x3a2412,
  bib: PLAYER_LANE,
});

/** Rival `index` (0 to 8) in `lane`: its own shirt, and a skin, hair and shorts picked by `random`. */
export function rivalLook(index: number, lane: number, random: () => number): PersonStyle {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length];
  return {
    shirt: RIVAL_SHIRTS[index % RIVAL_SHIRTS.length],
    pants: pick(SHORTS),
    skin: pick(SKINS),
    hair: pick(HAIRS),
    bib: lane,
  };
}

/** The shirt colour of rival `index`, as a CSS colour for the race bar. */
export const rivalCss = (index: number): string =>
  `#${RIVAL_SHIRTS[index % RIVAL_SHIRTS.length].toString(16).padStart(6, '0')}`;

// ---------- Poses (pure) ----------

const clamp01 = (n: number): number => Math.min(Math.max(n, 0), 1);
const smooth = (k: number): number => easeInOut(clamp01(k));

/** Crouched on the marks: leaning right over, one knee forward. */
export function crouchPose(pose: Pose): Pose {
  pose.lean = 0.9;
  pose.lift = -0.25;
  pose.legL.raise = 0.6;
  pose.legR.raise = -0.3;
  pose.legL.bend = 1.2;
  pose.legR.bend = 1.2;
  pose.armL.raise = -0.4;
  pose.armR.raise = -0.4;
  return pose;
}

/** How fast a runner is moving as a share of the heat's pace, for the arm and leg swing. */
export const runAmount = (speed: number): number =>
  speed <= 0 ? 0 : Math.min(1, Math.max(0.3 * Math.min(1, speed / 0.5), speed / RACE_SPEED));

/** A stumble: a slow, flailing run. `t` counts up in seconds. */
export function stumblePose(pose: Pose, phase: number, t: number): Pose {
  runPose(pose, phase, 0.4);
  pose.roll = 0.3 * Math.sin(t * 25);
  pose.armL.out = pose.armR.out = 1.2;
  pose.armL.raise = pose.armR.raise = 0.8;
  return pose;
}

/** Seconds a fall takes. */
export const FALL_SECONDS = 0.25;

/**
 * Face down on the ground, arms forward, for `t` seconds into the face-plant; the last
 * `GETUP_SECONDS` stand back up into a run.
 */
export function facePlantPose(pose: Pose, t: number): Pose {
  const fall = smooth(t / FALL_SECONDS);
  // The hips drop to the ground, the legs stretch out behind and the chest goes flat.
  pose.lean = 1.5 * fall;
  pose.lift = -0.4 * fall;
  pose.legL.raise = pose.legR.raise = -1.45 * fall;
  pose.legL.out = pose.legR.out = 0.12 * fall;
  pose.armL.raise = pose.armR.raise = 3.0 * fall;
  pose.armL.out = pose.armR.out = 0.2 * fall;
  pose.headPitch = 0.6 * fall;
  const up = (t - (FACEPLANT_SECONDS - GETUP_SECONDS)) / GETUP_SECONDS;
  if (up > 0) {
    const down = neutralPose();
    Object.assign(down, { lean: pose.lean, lift: pose.lift, headPitch: pose.headPitch });
    for (const key of ['armL', 'armR', 'legL', 'legR'] as const)
      Object.assign(down[key], pose[key]);
    const stand = runPose(neutralPose(), 0, 0.5);
    mixPose(down, stand, smooth(up), pose);
  }
  return pose;
}

/** The head hangs and the arms too: out of the race. */
export function headDownPose(pose: Pose): Pose {
  pose.headPitch = -0.5;
  pose.lean = 0.15;
  pose.armL.out = pose.armR.out = 0.08;
  pose.armL.bend = pose.armR.bend = 0.1;
  return pose;
}

/** Clapping in front of the chest. */
export function clapPose(pose: Pose, t: number): Pose {
  const swing = 0.25 * Math.sin(t * 14);
  pose.armL.raise = pose.armR.raise = 1.4;
  pose.armL.bend = pose.armR.bend = 1.3;
  pose.armL.out = 0.2 + swing;
  pose.armR.out = 0.2 + swing;
  pose.lift = Math.abs(Math.sin(t * 7)) * 0.03;
  return pose;
}

/** Waving the right arm high. */
export function wavePose(pose: Pose, t: number): Pose {
  pose.armR.raise = 2.9;
  pose.armR.out = 0.3 + 0.35 * Math.sin(t * 9);
  pose.armR.bend = 0.3;
  pose.armL.out = 0.1;
  pose.lift = Math.abs(Math.sin(t * 4)) * 0.02;
  return pose;
}

// ---------- The runner ----------

export type RunnerMode =
  | { kind: 'stand' }
  | { kind: 'crouch' }
  /** `phase` advances with metres run; `speed` in m/s sets the swing. */
  | { kind: 'run'; phase: number; speed: number }
  | { kind: 'stumble'; phase: number; t: number }
  | { kind: 'down'; t: number }
  | { kind: 'headdown' }
  | { kind: 'clap'; t: number }
  | { kind: 'wave'; t: number }
  | { kind: 'dance'; dance: DanceId; t: number };

export interface Runner {
  person: Person;
  animator: Animator;
  /** Set every frame; a change of kind eases from the old pose (0.2 s). */
  setMode(mode: RunnerMode): void;
  readonly mode: RunnerMode;
  /** Poses the person for the mode and `delta` seconds. */
  step(delta: number): void;
}

export function createRunner(style: PersonStyle): Runner {
  const person = createPerson(style);
  const animator = createAnimator(person);
  let mode: RunnerMode = { kind: 'stand' };
  return {
    person,
    animator,
    get mode() {
      return mode;
    },
    setMode(next) {
      if (next.kind !== mode.kind) animator.transition(next.kind === 'down' ? 0.08 : 0.2);
      mode = next;
    },
    step(delta) {
      const m = mode;
      animator.step(delta, (pose) => {
        resetPose(pose);
        switch (m.kind) {
          case 'crouch':
            crouchPose(pose);
            break;
          case 'run':
            runPose(pose, m.phase, runAmount(m.speed));
            break;
          case 'stumble':
            stumblePose(pose, m.phase, m.t);
            break;
          case 'down':
            facePlantPose(pose, m.t);
            break;
          case 'headdown':
            headDownPose(pose);
            break;
          case 'clap':
            clapPose(pose, m.t);
            break;
          case 'wave':
            wavePose(pose, m.t);
            break;
          case 'dance':
            writeDance(pose, m.dance, m.t);
            break;
          default:
            break;
        }
      });
    },
  };
}

/** Which rival (index into `RIVAL_FACTORS`) is in a lane list: the lanes are a shuffle of the other nine. */
export const RIVAL_COUNT = RIVAL_FACTORS.length;
