import { Group, Vector3 } from 'three';
import { BALL_R, BOWLER_Z, GUTTER_DEPTH, GUTTER_X, RELEASE_Z, SLIDE_Z, type Vec } from './geometry';
import {
  clamp01,
  createAnimator,
  createPerson,
  lerp,
  runPose,
  type Person,
  type Pose,
} from './person';

/** How far the bowler's right hand is to the +x side of the body's middle (a person's own width). */
export const BOWLER_HAND_X = 0.26; // (default)
export const THROW_SECONDS = 0.9;
export const SLIP_SECONDS = 1.2;
/** Seconds into a throw when the ball starts to ease from the hand to the release point. */
export const HAND_LETS_GO = 0.75;
/** Seconds into a slip when the ball leaves the hand, and when it lands in the gutter. */
export const SLIP_BALL_LEAVES = 0.45;
export const SLIP_BALL_LANDS = 0.7;
/** The ball's speed along the gutter. */
export const GUTTER_SPEED = 4;
/** The ball's x at the gutter's landing spot, and its height there. */
const LANDING_Z = 0.1;
const LANDING_Y = BALL_R - GUTTER_DEPTH;

export type BowlerMove = 'hold' | 'throw' | 'follow' | 'slip' | 'slump';

export interface Bowler {
  root: Group;
  person: Person;
  /**
   * Poses the bowler `t` seconds into a move and stands them for a ball released at `startX`.
   * `side` is the gutter a slip goes towards.
   */
  play(move: BowlerMove, t: number, delta: number, startX: number, side?: -1 | 1): void;
  /**
   * Where the ball is while the bowler has it, or false when it has left the hand. A throw hands
   * the ball over to the physics at THROW_SECONDS; a slip drops it at SLIP_BALL_LEAVES.
   */
  ballAt(move: BowlerMove, t: number, startX: number, out: Vector3): boolean;
}

const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

/**
 * Holding the ball at the chest: the right hand has it (so, from behind, it shows beside the body
 * and is over the lane where it will be let go), and the left arm steadies it.
 */
function holdBall(p: Pose): void {
  p.armR.raise = 0.9;
  p.armR.bend = 1.2;
  p.armR.out = 0;
  p.armL.raise = 0.8;
  p.armL.bend = 1.3;
  p.armL.out = -0.2;
}

/** The three-step approach, `t` seconds in (0 … THROW_SECONDS). */
function throwPose(t: number, p: Pose): void {
  const u = clamp01(t / THROW_SECONDS);
  const amount = Math.min(1, t / 0.15) * (t < 0.6 ? 0.8 : lerp(0.8, 0, smooth((t - 0.6) / 0.3)));
  runPose(p, u * 3 * Math.PI, amount);
  // The slide: a deep lean, low, with the left leg forward and the right trailing.
  const slide = smooth((t - 0.55) / 0.35);
  p.lean = lerp(p.lean, 0.55, slide);
  p.lift = lerp(p.lift, -0.25, slide);
  p.legL.raise = lerp(p.legL.raise, 0.9, slide);
  p.legL.bend = lerp(p.legL.bend, 0.15, slide);
  p.legR.raise = lerp(p.legR.raise, -0.45, slide);
  p.legR.bend = lerp(p.legR.bend, 1.0, slide);
  p.armL.raise = lerp(p.armL.raise, 0.4, slide);
  p.armL.bend = lerp(p.armL.bend, 0.5, slide);
  p.armL.out = lerp(p.armL.out, 0.8, slide);
  // The ball arm: push away, back-swing, forward swing.
  if (t < 0.2) {
    p.armR.raise = lerp(0.9, 0.5, t / 0.2);
    p.armR.bend = lerp(1.2, 0.3, t / 0.2);
    p.armR.out = lerp(-0.12, 0.05, t / 0.2);
  } else if (t < 0.55) {
    p.armR.raise = lerp(0.5, -1.3, smooth((t - 0.2) / 0.35));
    p.armR.bend = 0.15;
    p.armR.out = 0.05;
  } else {
    p.armR.raise = lerp(-1.3, 0.2, smooth((t - 0.55) / 0.35));
    p.armR.bend = 0.1;
    p.armR.out = 0.05;
  }
}

/** Where the bowler's feet are, `t` seconds into a throw. */
function throwZ(t: number): number {
  const u = clamp01(t / THROW_SECONDS);
  return lerp(BOWLER_Z, SLIDE_Z, u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
}

/** Stands in the hands of the person: the ball is held in the right hand, a little below it. */
const HAND_DROP = 0.08;
/** At rest the ball is held this far in front of the hand (towards the pins). */
const HAND_FORWARD = 0.06;

export function createBowler(): Bowler {
  const person = createPerson({ shirt: 0x2a9d8f, pants: 0x2b2d42, hat: 'none' });
  const root = person.root;
  // Faces the pins (-z), so the right hand is on the +x side.
  root.rotation.y = Math.PI;
  const animator = createAnimator(person);
  let last: BowlerMove | null = null;
  const right = new Vector3();
  const release = new Vector3();

  return {
    root,
    person,
    play(move, t, delta, startX, side = 1) {
      if (move !== last) {
        animator.transition(last === null || move === 'hold' ? 0.001 : 0.12);
        last = move;
      }
      let z = BOWLER_Z;
      switch (move) {
        case 'hold':
          z = BOWLER_Z;
          break;
        case 'throw':
          z = throwZ(t);
          break;
        case 'follow':
          z = SLIDE_Z;
          break;
        case 'slip':
          z = throwZ(Math.min(t, SLIP_BALL_LEAVES));
          break;
        case 'slump':
          z = throwZ(SLIP_BALL_LEAVES);
          break;
      }
      root.position.set(startX - BOWLER_HAND_X, 0, z);
      animator.step(delta, (p) => {
        switch (move) {
          case 'hold':
            holdBall(p);
            p.roll = Math.sin(t * 1.6) * 0.02;
            p.lift = Math.sin(t * 1.6 + 1) * 0.004;
            break;
          case 'throw':
            throwPose(Math.min(t, THROW_SECONDS), p);
            break;
          case 'follow': {
            throwPose(THROW_SECONDS, p);
            const up = smooth(t / 0.35);
            p.armR.raise = lerp(0.2, 1.6, up);
            p.armR.bend = lerp(0.1, 0.05, up);
            p.lean = lerp(0.55, 0.45, up);
            break;
          }
          case 'slip': {
            throwPose(Math.min(t, SLIP_BALL_LEAVES), p);
            const fall = smooth((t - SLIP_BALL_LEAVES) / 0.25);
            const recover = smooth((t - 0.9) / 0.3);
            const tip = fall * (1 - recover);
            // The body tips towards the gutter side. Turned to face the pins, the person's own
            // left (roll > 0) is the world's -x.
            p.roll = -side * 0.3 * tip;
            p.lean = lerp(p.lean, -0.3, tip);
            p.lift = lerp(p.lift, 0, tip * 0.5);
            const flail = Math.sin(t * Math.PI * 2 * 6) * 0.4 * tip;
            p.armL.raise = lerp(p.armL.raise, 1.2 + flail, tip);
            p.armR.raise = lerp(p.armR.raise, 1.2 - flail, tip);
            p.armL.out = lerp(p.armL.out, 0.8, tip);
            p.armR.out = lerp(p.armR.out, 0.8, tip);
            p.armL.bend = lerp(p.armL.bend, 0.3, tip);
            p.armR.bend = lerp(p.armR.bend, 0.3, tip);
            break;
          }
          case 'slump':
            throwPose(SLIP_BALL_LEAVES, p);
            p.lean = 0.3;
            p.headPitch = -0.55;
            p.lift = -0.05;
            p.roll = 0;
            p.armL.raise = -0.1;
            p.armR.raise = -0.1;
            p.armL.out = 0.05;
            p.armR.out = 0.05;
            p.armL.bend = 0;
            p.armR.bend = 0;
            p.legL.raise = p.legR.raise = 0;
            p.legL.bend = p.legR.bend = 0;
            break;
        }
      });
    },
    ballAt(move, t, startX, out) {
      if (move === 'hold') {
        person.handWorld('R', right);
        out.copy(right);
        out.z -= HAND_FORWARD;
        return true;
      }
      if (move === 'throw') {
        person.handWorld('R', right);
        // The ball sits in front of the hand at first, and hangs below it as the arm swings.
        right.y -= HAND_DROP * smooth(t / 0.2);
        right.z -= HAND_FORWARD * (1 - smooth(t / 0.2));
        if (t < HAND_LETS_GO) {
          out.copy(right);
          return true;
        }
        const k = smooth((t - HAND_LETS_GO) / (THROW_SECONDS - HAND_LETS_GO));
        out.copy(right).lerp(release.set(startX, BALL_R, RELEASE_Z), k);
        return true;
      }
      if (move === 'slip' && t < SLIP_BALL_LEAVES) {
        person.handWorld('R', right);
        right.y -= HAND_DROP;
        out.copy(right);
        return true;
      }
      return false;
    },
  };
}

export interface GutterBall {
  pos: Vec;
  /** The ball has landed and is rolling down the gutter. */
  rolling: boolean;
  /** The ball has gone far enough down the gutter to be hidden. */
  gone: boolean;
}

/**
 * The scripted gutter ball, `t` seconds into a slip: it leaves the hand at SLIP_BALL_LEAVES (from
 * `from`), arcs 0.15 m high to the gutter at SLIP_BALL_LANDS, then rolls down it.
 */
export function gutterBallAt(t: number, from: Vec, side: -1 | 1, hideZ: number): GutterBall {
  const landing = { x: side * GUTTER_X, y: LANDING_Y, z: LANDING_Z };
  if (t < SLIP_BALL_LEAVES) return { pos: { ...from }, rolling: false, gone: false };
  if (t < SLIP_BALL_LANDS) {
    const u = (t - SLIP_BALL_LEAVES) / (SLIP_BALL_LANDS - SLIP_BALL_LEAVES);
    return {
      pos: {
        x: lerp(from.x, landing.x, u),
        y: lerp(from.y, landing.y, u) + 0.15 * 4 * u * (1 - u),
        z: lerp(from.z, landing.z, u),
      },
      rolling: false,
      gone: false,
    };
  }
  const z = landing.z - GUTTER_SPEED * (t - SLIP_BALL_LANDS);
  return { pos: { ...landing, z }, rolling: true, gone: z < hideZ };
}
