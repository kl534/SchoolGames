import { Group } from 'three';
import {
  clamp01,
  createAnimator,
  createPerson,
  lerp,
  type Animator,
  type Person,
  type Pose,
} from './person';

export type FriendMove = 'sit' | 'cheer' | 'groan';

/** Where the friends sit on the bench, and how big they are next to the bowler. */
export const FRIEND_XS = [-3.2, -2.6, -2.0];
export const BENCH_Z = 4.2;
export const BENCH_TOP = 0.45;
export const FRIEND_SCALE = 0.75;
/**
 * The seated pose lowers the body by this much (in model units), so the hips meet the top of the
 * bench: the hips stand 0.52 · scale up, and sit at BENCH_TOP.
 */
const SIT_LIFT = (BENCH_TOP - 0.52 * 1.3 * FRIEND_SCALE) / (1.3 * FRIEND_SCALE);

const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

/** The sit, cheer and groan poses, as for the kids on the benches in Buzzer Beater. */
function friendPose(move: FriendMove, t: number, p: Pose): void {
  switch (move) {
    case 'sit': {
      p.lift = SIT_LIFT;
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
      p.lift = lerp(SIT_LIFT, 0, stand) + hop;
      for (const leg of [p.legL, p.legR]) {
        leg.raise = lerp(1.5, 0.1, stand);
        leg.bend = lerp(1.5, hop > 0.02 ? 0.5 : 0.1, stand);
      }
      const raise = lerp(0.9, 3.0, stand);
      p.armL.raise = raise;
      p.armR.raise = raise;
      p.armL.out = 0.35;
      p.armR.out = 0.35;
      break;
    }
    case 'groan': {
      const e = Math.sin(clamp01(t / 1.2) * Math.PI);
      p.lift = SIT_LIFT;
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

export interface Friend {
  person: Person;
  animator: Animator;
  move: FriendMove;
  /** Game time the current move began (a little after, for a random start). */
  since: number;
  /** Keeps the seated sway of the three from moving in step. */
  phase: number;
  /** The move being drawn now, so a change eases in. */
  shown: FriendMove | null;
}

export interface Friends {
  object: Group;
  /** Starts a move for everyone, each a random 0 - 0.25 s late. */
  set(move: FriendMove, now: number): void;
  /** Poses everybody. A cheer or a groan goes back to sitting after 1.2 s. */
  update(now: number, delta: number): void;
}

const LOOKS = [
  { shirt: 0xe63946, skin: 0xf1b48a, hair: 0x2b1b10 },
  { shirt: 0x2a9d8f, skin: 0x8d5524, hair: 0x111111 },
  { shirt: 0xffd166, skin: 0xe0ac69, hair: 0x8b3a1a },
];

export function createFriends(): Friends {
  const object = new Group();
  const friends: Friend[] = FRIEND_XS.map((x, i) => {
    const person = createPerson({ ...LOOKS[i], pants: 0x2b3a55, hat: 'none' });
    person.root.scale.multiplyScalar(FRIEND_SCALE);
    // Faces the lane (-z).
    person.root.position.set(x, 0, BENCH_Z);
    person.root.rotation.y = Math.PI;
    object.add(person.root);
    return {
      person,
      animator: createAnimator(person),
      move: 'sit',
      since: 0,
      phase: Math.random() * 20,
      shown: null,
    };
  });
  return {
    object,
    set(move, now) {
      for (const friend of friends) {
        friend.move = move;
        friend.since = now + Math.random() * 0.25;
      }
    },
    update(now, delta) {
      for (const friend of friends) {
        let t = now - friend.since;
        let move = friend.move;
        if (move !== 'sit' && t >= 1.2) {
          friend.move = 'sit';
          move = 'sit';
        }
        if (t < 0) move = 'sit';
        t = move === 'sit' ? now + friend.phase : t;
        if (move !== friend.shown) {
          friend.animator.transition(friend.shown === null ? 0.001 : 0.1);
          friend.shown = move;
        }
        friend.animator.step(delta, (pose) => friendPose(move, Math.max(t, 0), pose));
      }
    },
  };
}
