import { Group, Vector3 } from 'three';
import { clamp, type Vec } from './geometry';
import {
  createAnimator,
  createPerson,
  runPose,
  type Person,
  type PersonStyle,
  type Pose,
} from './person';
import { dribbleHeight, jumpLift, type Move } from './plays';

/** Ballers are drawn bigger than the plain cartoon kid, so their reach meets the rim (REACH). */
export const BALLER_SCALE = 1.4;
/** Longer arms too: the cartoon kid's are short for a basketball player. */
const BALLER_ARMS = 1.15;

export type KidMove = 'sit' | 'cheer' | 'groan';
export type AnyMove = Move | KidMove;

export interface Baller {
  root: Group;
  person: Person;
  /** Whether the ball is in this player's hands when standing. */
  holding: boolean;
  setPos(p: Vec): void;
  face(target: Vec): void;
  /** Poses the player for `move`, `t` seconds into it. `delta` is the frame time, for easing. */
  play(move: AnyMove, t: number, delta?: number): void;
  /** Where the ball is held (the right hand). */
  handPosition(out: Vector3): Vector3;
  /** The player's size in the world: how many metres a unit of the model is. */
  readonly size: number;
}

const smooth = (x: number) => {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Both legs bent and apart as in a crouch of `c` model units (positive is lower). */
function crouch(p: Pose, c: number, spread = 0.12, lean = 0.2) {
  const theta = Math.acos(clamp(1 - c / 0.52, 0, 1));
  p.lift = -c;
  p.lean = lean;
  for (const leg of [p.legL, p.legR]) {
    leg.raise = theta;
    leg.bend = theta * 2;
  }
  p.legL.out = spread;
  p.legR.out = spread;
}

/** Both hands at the chest as if holding a ball. */
function holdBall(p: Pose, raise = 0.95, bend = 1.5) {
  for (const arm of [p.armL, p.armR]) {
    arm.raise = raise;
    arm.bend = bend;
  }
  p.armL.out = -0.12;
  p.armR.out = -0.12;
}

/** The dribbling hand follows the ball up and down. */
function dribbleArm(p: Pose, ballHeight: number, shoulderY: number) {
  const hand = clamp(ballHeight + 0.1, 0.62, 1.1);
  const reach = 0.44;
  const phi = Math.acos(clamp((shoulderY - hand) / reach, -1, 1));
  p.armR.raise = clamp(phi, 0.2, 1.4);
  p.armR.bend = 0.25;
  p.armR.out = -0.25;
}

function armsUp(p: Pose, raise = 3.0, out = 0.12) {
  p.armL.raise = raise;
  p.armR.raise = raise;
  p.armL.out = out;
  p.armR.out = out;
}

/** Poses for every move, in model units (`k` is the world size of one model unit). */
function buildPose(move: AnyMove, t: number, p: Pose, k: number, holding: boolean) {
  const lift = (m: Move) => jumpLift(m, t) / k;
  // Shoulder height in model units when standing: used to place the dribbling hand.
  const shoulderY = 0.88 * 0.94;
  switch (move) {
    case 'stand':
      if (holding) holdBall(p);
      else {
        p.armL.out = 0.08;
        p.armR.out = 0.08;
      }
      break;
    case 'dribble': {
      crouch(p, 0.08, 0.1, 0.18);
      dribbleArm(p, dribbleHeight(t), shoulderY - 0.08);
      p.armL.raise = 0.5;
      p.armL.out = 0.55;
      p.armL.bend = 0.9;
      break;
    }
    case 'run-dribble': {
      runPose(p, t * 12, 1);
      dribbleArm(p, dribbleHeight(t), shoulderY);
      break;
    }
    case 'run':
      runPose(p, t * 12, 1);
      break;
    case 'guard': {
      crouch(p, 0.18, 0.4, 0.25);
      armsUp(p, 0.7, 1.0);
      p.armL.bend = 0.6;
      p.armR.bend = 0.6;
      break;
    }
    case 'jump-shot': {
      const c = t < 0.15 ? 0.12 * smooth(t / 0.15) : 0;
      if (c > 0) crouch(p, c, 0.1, 0.1);
      const rise = smooth((t - 0.05) / 0.35);
      for (const arm of [p.armL, p.armR]) {
        arm.raise = lerp(0.95, 2.95, rise);
        arm.bend = lerp(1.5, t > 0.45 ? 0.05 : 0.4, rise);
      }
      p.armL.out = lerp(-0.12, 0.1, rise);
      p.armR.out = lerp(-0.12, 0.05, rise);
      if (t >= 0.15) {
        p.lift = lift('jump-shot');
        p.legL.bend = 0.3;
        p.legR.bend = 0.3;
        p.legL.raise = 0.15;
        p.legR.raise = 0.15;
      }
      if (t > 0.45) p.armR.bend = 0.0;
      break;
    }
    case 'set-shot': {
      const c = t < 0.25 ? 0.14 * Math.sin((Math.PI * Math.min(t, 0.25)) / 0.25) : 0;
      if (c > 0) crouch(p, c, 0.1, 0.1);
      const rise = smooth((t - 0.05) / 0.3);
      for (const arm of [p.armL, p.armR]) {
        arm.raise = lerp(0.95, 2.4, rise);
        arm.bend = lerp(1.5, 0.3, rise);
        arm.out = -0.1;
      }
      p.lift += lift('set-shot');
      break;
    }
    case 'layup': {
      p.lift = lift('layup');
      p.legR.raise = 1.3;
      p.legR.bend = 1.5;
      p.legL.raise = 0.1;
      p.legL.bend = 0.2;
      p.lean = 0.1;
      p.armR.raise = lerp(1.2, 3.0, smooth(t / 0.25));
      p.armR.bend = lerp(1.0, 0.1, smooth(t / 0.25));
      p.armL.raise = 1.1;
      p.armL.bend = 1.3;
      p.armL.out = 0.4;
      break;
    }
    case 'dunk':
    case 'hang': {
      p.lift = jumpLift(move, t) / k;
      p.armR.raise = 3.0;
      p.armR.bend = 0.0;
      p.armL.raise = 2.2;
      p.armL.out = 0.7;
      p.armL.bend = 0.4;
      const swing = Math.sin(t * 9) * 0.35;
      p.legL.raise = 0.5 + swing;
      p.legR.raise = 0.5 - swing;
      p.legL.bend = 0.9;
      p.legR.bend = 0.9;
      break;
    }
    case 'contest':
      p.lift = lift('contest');
      armsUp(p, 3.0, 0.2);
      break;
    case 'block': {
      p.lift = lift('block');
      const swing = smooth((t - 0.2) / 0.15);
      p.armR.raise = lerp(3.0, 1.2, swing);
      p.armR.bend = 0.0;
      p.armL.raise = 2.8;
      p.armL.out = 0.3;
      p.lean = lerp(-0.1, 0.3, swing);
      break;
    }
    case 'reach': {
      crouch(p, 0.2, 0.25, 0.4);
      p.legR.raise = 0.9;
      p.legR.bend = 0.6;
      p.armR.raise = 1.3;
      p.armR.bend = 0.1;
      p.armL.raise = 0.4;
      p.armL.out = 0.7;
      break;
    }
    case 'stumble': {
      p.lean = -0.35;
      p.lift = Math.abs(Math.sin(t * 7)) * 0.04;
      p.armL.raise = 1.0 + Math.sin(t * 14) * 0.9;
      p.armR.raise = 1.0 - Math.sin(t * 14) * 0.9;
      p.armL.out = 0.9;
      p.armR.out = 0.9;
      p.legL.raise = Math.sin(t * 10) * 0.5;
      p.legR.raise = -Math.sin(t * 10) * 0.5;
      break;
    }
    case 'rebound': {
      p.lift = lift('rebound');
      const pull = smooth((t - 0.25) / 0.3);
      for (const arm of [p.armL, p.armR]) {
        arm.raise = lerp(3.0, 0.95, pull);
        arm.bend = lerp(0.0, 1.5, pull);
      }
      break;
    }
    case 'celebrate': {
      const hop = Math.abs(Math.sin(t * 7)) * 0.06;
      p.lift = hop;
      const pump = Math.max(0, Math.sin(t * 7 - 0.5));
      p.armR.raise = lerp(0.6, 3.0, pump);
      p.armR.bend = lerp(1.4, 0.2, pump);
      p.armL.raise = lerp(0.6, 2.4, 1 - pump);
      p.armL.bend = lerp(1.4, 0.4, 1 - pump);
      break;
    }
    case 'slump':
      p.lean = 0.3;
      p.headPitch = -0.55;
      p.lift = -0.03;
      p.armL.raise = -0.1;
      p.armR.raise = -0.1;
      break;
    case 'sit': {
      p.lift = -0.135;
      for (const leg of [p.legL, p.legR]) {
        leg.raise = 1.5;
        leg.bend = 1.5;
      }
      p.roll = Math.sin(t * 1.3) * 0.03;
      // An occasional clap.
      const clap = Math.sin(t * 0.9) > 0.92 ? Math.sin(t * 22) : 0;
      p.armL.raise = 0.9 + clap * 0.15;
      p.armR.raise = 0.9 + clap * 0.15;
      p.armL.bend = 1.5;
      p.armR.bend = 1.5;
      p.armL.out = -0.15 + clap * 0.1;
      p.armR.out = -0.15 + clap * 0.1;
      p.legL.raise += Math.sin(t * 3) * 0.12;
      break;
    }
    case 'cheer': {
      // Up off the bench, two jumps with the arms up, and back down by 1.2 s.
      const stand = smooth(t / 0.2) * (1 - smooth((t - 1.0) / 0.2));
      const hop =
        t > 0.2 && t < 1.0 ? Math.abs(Math.sin(((t - 0.2) / 0.8) * Math.PI * 2)) * 0.22 : 0;
      p.lift = lerp(-0.135, 0, stand) + hop;
      for (const leg of [p.legL, p.legR]) {
        leg.raise = lerp(1.5, 0.1, stand);
        leg.bend = lerp(1.5, hop > 0.02 ? 0.5 : 0.1, stand);
      }
      armsUp(p, lerp(0.9, 3.0, stand), 0.35);
      break;
    }
    case 'groan': {
      const e = Math.sin(clamp(t / 1.2, 0, 1) * Math.PI);
      p.lift = -0.135;
      for (const leg of [p.legL, p.legR]) {
        leg.raise = 1.5;
        leg.bend = 1.5;
      }
      p.lean = -0.2 * e;
      p.headPitch = 0.4 * e;
      for (const arm of [p.armL, p.armR]) {
        arm.raise = lerp(0.9, 2.5, e);
        arm.bend = lerp(1.5, 2.4, e);
        arm.out = lerp(-0.15, 0.5, e);
      }
      break;
    }
  }
}

/** A baller (or, at a smaller `scale`, a kid on a bench). Face +z at rest. */
export function createBaller(style: PersonStyle, scale = 1): Baller {
  const person = createPerson({ armLength: BALLER_ARMS, ...style });
  const factor = BALLER_SCALE * scale;
  person.root.scale.multiplyScalar(factor);
  const size = person.root.scale.x;
  const animator = createAnimator(person);
  let last: AnyMove | null = null;
  const baller: Baller = {
    root: person.root,
    person,
    holding: false,
    size,
    setPos(p) {
      person.root.position.set(p.x, 0, p.z);
    },
    face(target) {
      const dx = target.x - person.root.position.x;
      const dz = target.z - person.root.position.z;
      if (Math.hypot(dx, dz) > 1e-6) person.root.rotation.y = Math.atan2(dx, dz);
    },
    play(move, t, delta = 1 / 60) {
      if (move !== last) {
        animator.transition(move === 'sit' || move === 'cheer' || move === 'groan' ? 0.1 : 0.14);
        last = move;
      }
      animator.step(delta, (pose) => buildPose(move, Math.max(t, 0), pose, size, baller.holding));
      // Guarding players sway side to side (drawing only).
      person.body.position.x =
        move === 'guard' ? (Math.sin(t * Math.PI * 2 * 0.8) * 0.15) / size : 0;
    },
    handPosition(out) {
      person.handWorld('R', out);
      out.y += 0.06;
      return out;
    },
  };
  return baller;
}
