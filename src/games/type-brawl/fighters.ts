import { MathUtils } from 'three';
import { writeDance, type DanceId } from '../../shared/dances';
import {
  DOWN_SECONDS,
  HURT_SECONDS,
  LAUNCH_SECONDS,
  MOVES,
  REACT_SECONDS,
  SWING_SECONDS,
  downPose,
  flyingPose,
  guardPose,
  hurtPose,
  hurtPush,
  launchPath,
  mirrorPose,
  moveFrame,
  moveSpin,
  reactionFrame,
  swingPose,
} from './moves';
import {
  createAnimator,
  createPerson,
  runPose,
  type Animator,
  type HatStyle,
  type Person,
} from './person';
import type { Kind, MoveId } from './rules';
import type { Random } from '../../shared/random';

export interface Look {
  shirt: number;
  pants: number;
  skin?: number;
  hair?: number;
  hat: HatStyle;
  hatColor: number;
  eyepatch?: boolean;
  cape?: boolean;
  scale: number;
}

export const HERO_LOOK: Look = {
  shirt: 0xd7263d,
  pants: 0x1d4ed8,
  hat: 'headband',
  hatColor: 0xffffff,
  scale: 1,
};

const THUG_SHIRTS = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x9b5de5, 0x00a6fb, 0xf15bb5];
const SKINS = [0xf1b48a, 0xc68642, 0x8d5524, 0xffdbac];
const HAIRS = [0x5a3416, 0x1b1b1b, 0xb5651d, 0x8a8a8a];

/**
 * How a thug of this kind looks: a random shirt, hat and skin; a bruiser is bigger, darker and wears an
 * eyepatch; a boss is bigger still, in the stage's colour, with a cape and a crown.
 */
export function lookFor(kind: Kind, random: Random, bossShirt = 0x5b1a2a): Look {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const base: Look = {
    shirt: pick(THUG_SHIRTS),
    pants: 0x2b2d42,
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hat: random() < 0.5 ? 'headband' : 'none',
    hatColor: pick([0xffd23f, 0x111111, 0xffffff]),
    scale: 1,
  };
  if (kind === 'bruiser') {
    return { ...base, shirt: 0x3a2f4d, pants: 0x1a1a24, scale: 1.2, eyepatch: true, hat: 'none' };
  }
  if (kind === 'boss') {
    return { ...base, shirt: bossShirt, scale: 1.4, cape: true, hat: 'crown', hatColor: 0xffc928 };
  }
  return base;
}

export type Mode =
  | { kind: 'idle' }
  | { kind: 'walk' }
  /** The hero's move. */
  | { kind: 'move'; move: MoveId; t: number }
  /** A thug's punch. */
  | { kind: 'swing'; t: number }
  /** A recoil after a hit (hero) or after a move that did not finish (thug). */
  | { kind: 'hurt'; t: number }
  | { kind: 'react'; move: MoveId; t: number; away: 1 | -1 }
  | { kind: 'launch'; move: MoveId; t: number; away: 1 | -1 }
  | { kind: 'down'; t: number }
  /** A victory dance, facing the camera. */
  | { kind: 'dance'; dance: DanceId; t: number };

export interface Fighter {
  readonly person: Person;
  /** Where the feet stand; the animation adds its own offsets on top. */
  x: number;
  z: number;
  /** The way they face: 1 looks to +x, -1 to -x. The body turns over 0.25 s. */
  facing: 1 | -1;
  readonly mode: Mode;
  /** True while a move, swing or recoil is playing. */
  readonly busy: boolean;
  face(dir: 1 | -1, instant?: boolean): void;
  setMode(mode: Mode): void;
  update(delta: number): void;
  /** Where the top of the head is, in world units above the feet (for labels). */
  headHeight(): number;
  /** The world x of the feet right now, with the animation's offsets. */
  worldX(): number;
}

const TURN_SPEED = (Math.PI * 2) / 0.25 / 2;
const BODY_HEIGHT = 2.05;

/** A person in a mode: idling in the guard, walking, punching, reeling or flying. */
export function createFighter(look: Look, idleSeed = 0): Fighter {
  const person = createPerson({
    shirt: look.shirt,
    pants: look.pants,
    skin: look.skin,
    hair: look.hair,
    hat: look.hat,
    hatColor: look.hatColor,
    cape: look.cape,
    eyepatch: look.eyepatch,
    scale: look.scale,
  });
  const animator: Animator = createAnimator(person);
  let mode: Mode = { kind: 'idle' };
  let clock = idleSeed;
  let walkPhase = 0;
  let yaw = Math.PI / 2;
  let facing: 1 | -1 = 1;
  let offsetX = 0;
  let offsetY = 0;
  let spin = 0;
  let shrink = 1;

  const fighter: Fighter = {
    person,
    x: 0,
    z: 0,
    get facing() {
      return facing;
    },
    set facing(dir) {
      facing = dir;
    },
    get mode() {
      return mode;
    },
    get busy() {
      return (
        mode.kind === 'move' ||
        mode.kind === 'swing' ||
        mode.kind === 'hurt' ||
        mode.kind === 'react' ||
        mode.kind === 'launch' ||
        mode.kind === 'down'
      );
    },
    face(dir, instant = false) {
      facing = dir;
      if (instant) yaw = dir * (Math.PI / 2);
    },
    setMode(next) {
      animator.transition(next.kind === 'move' || next.kind === 'swing' ? 0.06 : 0.12);
      mode = next;
    },
    headHeight: () => BODY_HEIGHT * look.scale,
    worldX: () => fighter.x + offsetX,
    update(delta) {
      clock += delta;
      const target = mode.kind === 'dance' ? 0 : facing * (Math.PI / 2);
      const diff = target - yaw;
      yaw += Math.sign(diff) * Math.min(Math.abs(diff), TURN_SPEED * delta);

      offsetX = 0;
      offsetY = 0;
      spin = 0;
      shrink = 1;
      let fall = 0;
      let flips = 0;
      let spins = 0;
      let lying = false;
      const m = mode;
      animator.step(delta, (pose) => {
        switch (m.kind) {
          case 'idle': {
            guardPose(pose);
            const bob = Math.sin(clock * 4.2);
            pose.lift += bob * 0.025;
            pose.lean += bob * 0.03;
            pose.armR.raise += Math.sin(clock * 4.2 + 1) * 0.08;
            break;
          }
          case 'walk':
            walkPhase += delta * 8;
            runPose(pose, walkPhase, 0.6);
            break;
          case 'move': {
            m.t += delta;
            moveFrame(m.move, m.t, pose);
            spin = moveSpin(m.move, m.t);
            if (m.t >= MOVES[m.move].duration) mode = { kind: 'idle' };
            break;
          }
          case 'swing':
            m.t += delta;
            swingPose(pose, m.t);
            if (m.t >= SWING_SECONDS) mode = { kind: 'idle' };
            break;
          case 'hurt':
            m.t += delta;
            hurtPose(pose, m.t);
            offsetX = -facing * hurtPush(m.t);
            if (m.t >= HURT_SECONDS) mode = { kind: 'idle' };
            break;
          case 'react': {
            m.t += delta;
            const r = reactionFrame(MOVES[m.move].reaction, m.t, pose);
            offsetX = m.away * r.push;
            offsetY = r.lift;
            spin = r.spin * Math.PI * 2;
            if (m.t >= REACT_SECONDS) mode = { kind: 'idle' };
            break;
          }
          case 'launch': {
            m.t += delta;
            const launch = MOVES[m.move].launch;
            if (!launch) break;
            const path = launchPath(launch, m.t);
            flyingPose(pose, m.t);
            offsetX = m.away * path.dx;
            offsetY = path.y;
            flips = path.flips;
            spins = path.spins;
            lying = path.lying;
            shrink = path.scale;
            if (path.lying) {
              pose.armL.raise = 0.3;
              pose.armR.raise = 0.3;
              pose.armL.out = 0.4;
              pose.armR.out = 0.4;
              pose.headPitch = 0;
            }
            break;
          }
          case 'dance':
            m.t += delta;
            writeDance(pose, m.dance, m.t);
            break;
          case 'down':
            m.t += delta;
            fall = downPose(pose, m.t);
            offsetX = -facing * 0.5 * fall;
            break;
        }
        const mirrored = facing === -1 && m.kind !== 'launch' && m.kind !== 'dance';
        if (mirrored) mirrorPose(pose);
      });

      // Whole-body tilts that the rig's joints do not do: falling back, flips and cartwheels.
      let tipX = -fall * (Math.PI / 2 - 0.12);
      if (flips !== 0 || lying) {
        const turned = lying ? 0 : flips * Math.PI * 2;
        const flat = lying
          ? MathUtils.clamp((m.kind === 'launch' ? m.t - 0.8 : 0) / 0.12, 0, 1)
          : 0;
        tipX = -(turned + flat * (Math.PI / 2 - 0.1));
      }
      person.body.rotation.x = tipX;
      person.body.rotation.y = 0;
      person.root.rotation.y = yaw + spin + (lying ? 0 : spins * Math.PI * 2);
      person.root.position.set(fighter.x + offsetX, offsetY + (lying ? 0.18 : 0), fighter.z);
      person.setScale(look.scale * Math.max(shrink, 0.001));
      person.root.visible = shrink > 0.02;
    },
  };
  return fighter;
}

export const LAUNCH_TOTAL = LAUNCH_SECONDS;
export const DOWN_TOTAL = DOWN_SECONDS;

/** Frees the geometry and materials of a fighter that left the scene. */
export function disposeFighter(fighter: Fighter): void {
  fighter.person.root.removeFromParent();
  fighter.person.root.traverse((obj) => {
    const mesh = obj as Partial<{ geometry: { dispose(): void }; material: unknown }>;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((m) => (m as { dispose?: () => void } | undefined)?.dispose?.());
  });
}
