import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { clamp01, createAnimator, createPerson, lerp, type Person, type Pose } from './person';

export type GolfMove = 'address' | 'swing' | 'follow' | 'cheer' | 'groan';

/** The swing takes this long; the club meets the ball at IMPACT_AT. */
export const SWING_SECONDS = 0.6;
export const IMPACT_AT = 0.4;

export interface Golfer {
  root: Group;
  person: Person;
  /** Poses the golfer `t` seconds into a move. */
  play(move: GolfMove, t: number, delta: number): void;
  /** Stands beside the ball (to its left, as seen from behind), facing along `dir` (radians). */
  stand(ball: { x: number; z: number }, dir: number): void;
}

const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

/** Both hands on the club, leaning over the ball. */
function addressPose(p: Pose): void {
  p.lean = 0.5;
  p.headPitch = -0.45;
  p.lift = -0.05;
  p.armL.raise = 0.55;
  p.armR.raise = 0.55;
  p.armL.bend = 0.12;
  p.armR.bend = 0.12;
  p.armL.out = -0.1;
  p.armR.out = -0.1;
  p.legL.out = 0.1;
  p.legR.out = 0.1;
  p.legL.bend = 0.2;
  p.legR.bend = 0.2;
}

/** The swing, `t` seconds in (0 to SWING_SECONDS). */
function swingPose(t: number, p: Pose): void {
  addressPose(p);
  let arms: number;
  let twist: number;
  if (t < 0.25) {
    const u = smooth(t / 0.25);
    arms = lerp(0.55, 2.0, u);
    twist = lerp(0, -0.8, u);
    p.lean = lerp(0.5, 0.3, u);
  } else if (t < IMPACT_AT) {
    const u = smooth((t - 0.25) / (IMPACT_AT - 0.25));
    arms = lerp(2.0, 0.5, u);
    twist = lerp(-0.8, 0.3, u);
    p.lean = lerp(0.3, 0.5, u);
  } else {
    const u = smooth((t - IMPACT_AT) / (SWING_SECONDS - IMPACT_AT));
    arms = lerp(0.5, 1.7, u);
    twist = lerp(0.3, 0.9, u);
    p.lean = lerp(0.5, 0.15, u);
    p.headPitch = lerp(-0.45, 0.1, u);
  }
  p.armL.raise = p.armR.raise = arms;
  p.twist = twist;
}

export function createGolfer(): Golfer {
  const person = createPerson({
    shirt: 0xf26b3a,
    pants: 0x2b3a55,
    hat: 'headband',
    hatColor: 0xffffff,
  });
  const root = person.root;
  const animator = createAnimator(person);

  // The club: a shaft down from the right hand and a head at the end.
  const club = new Group();
  const shaft = new Mesh(
    new CylinderGeometry(0.012, 0.012, 0.95, 6),
    new MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.4, metalness: 0.5 }),
  );
  shaft.position.y = -0.45;
  const head = new Mesh(
    new BoxGeometry(0.06, 0.05, 0.16),
    new MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 }),
  );
  head.position.set(0, -0.93, 0.05);
  club.add(shaft, head);
  club.rotation.x = -0.35;
  person.handR.add(club);

  let last: GolfMove | null = null;
  return {
    root,
    person,
    play(move, t, delta) {
      if (move !== last) {
        animator.transition(last === null || move === 'address' ? 0.12 : 0.1);
        last = move;
      }
      animator.step(delta, (p) => {
        switch (move) {
          case 'address':
            addressPose(p);
            p.lift += Math.sin(t * 1.8) * 0.004;
            break;
          case 'swing':
            swingPose(Math.min(t, SWING_SECONDS), p);
            break;
          case 'follow':
            swingPose(SWING_SECONDS, p);
            p.twist += Math.sin(t * 2) * 0.02;
            break;
          case 'cheer':
            p.armL.raise = p.armR.raise = 2.6 + Math.sin(t * 12) * 0.2;
            p.armL.out = p.armR.out = 0.35;
            p.lift = Math.abs(Math.sin(t * 9)) * 0.08;
            p.headPitch = 0.2;
            break;
          case 'groan':
            p.lean = 0.35;
            p.headPitch = -0.6;
            p.armL.raise = p.armR.raise = 0.15;
            p.armL.out = p.armR.out = 0.05;
            p.lift = -0.03;
            p.roll = Math.sin(t * 3) * 0.04;
            break;
        }
      });
    },
    stand(ball, dir) {
      // Left of the ball seen from behind, a little behind it.
      const f = { x: Math.sin(dir), z: Math.cos(dir) };
      const r = { x: Math.cos(dir), z: -Math.sin(dir) };
      root.position.set(ball.x - r.x * 1.0 - f.x * 0.35, 0, ball.z - r.z * 1.0 - f.z * 0.35);
      root.rotation.y = dir;
    },
  };
}
