import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';

/** Everybody is drawn a little bigger than life, so they read on a phone. */
export const PERSON_SCALE = 1.3;

const HIP_Y = 0.52;
const THIGH = 0.26;
const SHIN = 0.26;
const SHOULDER_Y = 0.36;
const SHOULDER_X = 0.2;
const UPPER_ARM = 0.17;
const FOREARM = 0.16;
const HEAD_Y = 0.62;
const HEAD_R = 0.2;

export type HatStyle = 'cap' | 'helmet' | 'catcher' | 'none';

export interface PersonStyle {
  shirt: number;
  pants: number;
  skin?: number;
  hair?: number;
  hat?: HatStyle;
  hatColor?: number;
  shoe?: number;
  /** A big mitt on the left (+x when facing +z) or right hand. */
  glove?: 'left' | 'right';
  gloveColor?: number;
}

/** One arm or leg, in human terms: how far it is raised forward, swung out sideways, and bent. */
export interface LimbPose {
  raise: number;
  out: number;
  bend: number;
}

/** A whole body pose. Angles are radians; the person faces +z, and their left is +x. */
export interface Pose {
  /** Height of the body above standing (negative to crouch). */
  lift: number;
  /** The torso leaning forward, and twisting (positive turns the chest towards +x). */
  lean: number;
  twist: number;
  /** Positive looks up. */
  headPitch: number;
  /** The whole body tipped about its forward axis, in radians; positive tips towards their left (+x). */
  roll: number;
  headYaw: number;
  armL: LimbPose;
  armR: LimbPose;
  legL: LimbPose;
  legR: LimbPose;
}

export const limb = (raise = 0, out = 0, bend = 0): LimbPose => ({ raise, out, bend });

export function neutralPose(): Pose {
  return {
    lift: 0,
    lean: 0,
    twist: 0,
    headPitch: 0,
    headYaw: 0,
    roll: 0,
    armL: limb(),
    armR: limb(),
    legL: limb(),
    legR: limb(),
  };
}

/** Resets a pose to standing at ease. */
export function resetPose(pose: Pose): Pose {
  pose.lift = pose.lean = pose.twist = pose.headPitch = pose.headYaw = pose.roll = 0;
  for (const l of [pose.armL, pose.armR, pose.legL, pose.legR]) l.raise = l.out = l.bend = 0;
  return pose;
}

export interface Person {
  /** At the feet; yaw this to face somewhere (0 faces +z). Scaled by `PERSON_SCALE`. */
  root: Group;
  body: Group;
  torso: Group;
  head: Group;
  /** What is worn on the head (cap, helmet or catcher's mask); it can be taken off. */
  hat: Group;
  /** Joints at the hands, for holding a bat, glove or ball. Left is +x. */
  handL: Group;
  handR: Group;
  materials: { shirt: MeshStandardMaterial; hat: MeshStandardMaterial };
  apply(pose: Pose): void;
  /** Changes the colours of the shirt and hat. */
  recolour(shirt: number, hat: number): void;
  /** World position of a point on the hand. */
  handWorld(side: 'L' | 'R', out: Vector3): Vector3;
}

function mesh(
  geometry: BufferGeometry,
  material: Material,
  parent: Object3D,
  x = 0,
  y = 0,
  z = 0,
): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function joint(parent: Object3D, x: number, y: number, z = 0): Group {
  const g = new Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const eyeMaterial = new MeshStandardMaterial({ color: 0x1b1b24, roughness: 0.4 });
const smileMaterial = new MeshBasicMaterial({ color: 0x5b2a22 });
const shadowMaterial = new MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});

/** A cartoon kid in a uniform: big head with a face, capsule limbs, and joints to pose. */
export function createPerson(style: PersonStyle): Person {
  const shirt = new MeshStandardMaterial({ color: style.shirt, roughness: 0.7 });
  const pants = new MeshStandardMaterial({ color: style.pants, roughness: 0.8 });
  const skin = new MeshStandardMaterial({ color: style.skin ?? 0xf1b48a, roughness: 0.75 });
  const hair = new MeshStandardMaterial({ color: style.hair ?? 0x5a3416, roughness: 0.9 });
  const hat = new MeshStandardMaterial({
    color: style.hatColor ?? style.shirt,
    roughness: 0.55,
  });
  const shoe = new MeshStandardMaterial({ color: style.shoe ?? 0xf4f4f4, roughness: 0.6 });

  const root = new Group();
  root.scale.setScalar(PERSON_SCALE);
  const body = joint(root, 0, 0);

  const makeLeg = (side: number) => {
    const hip = joint(body, side * 0.1, HIP_Y);
    mesh(new CapsuleGeometry(0.075, THIGH - 0.1, 4, 10), pants, hip, 0, -THIGH / 2);
    const knee = joint(hip, 0, -THIGH);
    mesh(new CapsuleGeometry(0.068, SHIN - 0.1, 4, 10), pants, knee, 0, -SHIN / 2);
    mesh(new BoxGeometry(0.13, 0.08, 0.25), shoe, knee, 0, -SHIN - 0.02, 0.05);
    return { hip, knee };
  };
  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  const torso = joint(body, 0, HIP_Y);
  torso.rotation.order = 'YXZ';
  mesh(new CapsuleGeometry(0.15, 0.12, 6, 16), shirt, torso, 0, 0.2).scale.set(1.15, 1, 0.9);
  mesh(new CylinderGeometry(0.152, 0.152, 0.05, 16), pants, torso, 0, 0.0).scale.set(1.15, 1, 0.9);
  mesh(new CylinderGeometry(0.06, 0.065, 0.1, 10), skin, torso, 0, 0.44);

  const head = joint(torso, 0, HEAD_Y);
  head.rotation.order = 'YXZ';
  mesh(new SphereGeometry(HEAD_R, 24, 18), skin, head);
  for (const side of [-1, 1]) {
    mesh(new SphereGeometry(0.03, 10, 8), eyeMaterial, head, side * 0.075, 0.025, HEAD_R - 0.02);
    mesh(
      new SphereGeometry(0.05, 10, 8),
      skin,
      head,
      side * (HEAD_R - 0.005),
      -0.02,
      0.0,
    ).scale.set(0.55, 1, 0.9);
  }
  mesh(new SphereGeometry(0.03, 8, 6), skin, head, 0, -0.025, HEAD_R + 0.005);
  const smile = mesh(new TorusGeometry(0.045, 0.009, 6, 12, Math.PI), smileMaterial, head);
  smile.position.set(0, -0.045, HEAD_R - 0.005);
  smile.rotation.z = Math.PI;

  /** Everything worn on the head, so a mask or cap can come off. */
  const headWear = joint(head, 0, 0);
  const hatStyle = style.hat ?? 'cap';
  if (hatStyle === 'none') {
    mesh(
      new SphereGeometry(HEAD_R + 0.012, 24, 14, 0, Math.PI * 2, 0, 1.55),
      hair,
      headWear,
      0,
      0.0,
      -0.015,
    );
  } else if (hatStyle === 'cap') {
    mesh(
      new SphereGeometry(HEAD_R + 0.018, 24, 12, 0, Math.PI * 2, 0, 1.3),
      hat,
      headWear,
      0,
      0.03,
      0,
    );
    mesh(new SphereGeometry(0.03, 8, 6), hat, headWear, 0, HEAD_R + 0.04, 0);
    const brim = mesh(
      new CylinderGeometry(0.19, 0.19, 0.025, 20, 1, false, -Math.PI / 2, Math.PI),
      hat,
      headWear,
      0,
      0.075,
      0.1,
    );
    brim.scale.set(1.1, 1, 1.15);
    brim.rotation.x = -0.12;
  } else {
    // A batting helmet with an ear flap, or a catcher's helmet that covers the whole head.
    const wide = hatStyle === 'catcher';
    mesh(
      new SphereGeometry(HEAD_R + 0.03, 24, 14, 0, Math.PI * 2, 0, wide ? 2.0 : 1.62),
      hat,
      headWear,
      0,
      0.0,
      -0.01,
    );
    if (!wide) {
      const brim = mesh(
        new CylinderGeometry(0.17, 0.17, 0.02, 18, 1, false, -Math.PI / 2, Math.PI),
        hat,
        headWear,
        0,
        0.075,
        0.1,
      );
      brim.scale.set(1.05, 1, 1.1);
      mesh(new BoxGeometry(0.05, 0.12, 0.12), hat, headWear, -(HEAD_R + 0.025), -0.03, 0.0);
    } else {
      for (const y of [-0.04, 0.05]) {
        const bar = mesh(
          new TorusGeometry(0.14, 0.012, 6, 16),
          eyeMaterial,
          headWear,
          0,
          y,
          HEAD_R,
        );
        bar.scale.set(1, 0.8, 1);
      }
    }
  }

  const makeArm = (side: number) => {
    const shoulder = joint(torso, side * SHOULDER_X, SHOULDER_Y);
    mesh(new SphereGeometry(0.07, 12, 8), shirt, shoulder);
    mesh(new CapsuleGeometry(0.052, UPPER_ARM - 0.06, 4, 10), shirt, shoulder, 0, -UPPER_ARM / 2);
    const elbow = joint(shoulder, 0, -UPPER_ARM);
    mesh(new CapsuleGeometry(0.047, FOREARM - 0.05, 4, 10), skin, elbow, 0, -FOREARM / 2);
    const hand = joint(elbow, 0, -FOREARM - 0.02);
    const gloved = style.glove === (side > 0 ? 'left' : 'right');
    if (gloved) {
      const mitt = new MeshStandardMaterial({
        color: style.gloveColor ?? 0x8a4b1f,
        roughness: 0.6,
      });
      mesh(new SphereGeometry(0.11, 14, 10), mitt, hand, 0, -0.04, 0.03).scale.set(1, 1.05, 0.7);
    } else {
      mesh(new SphereGeometry(0.058, 10, 8), skin, hand);
    }
    return { shoulder, elbow, hand };
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);

  const shadow = mesh(new CircleGeometry(0.34, 20), shadowMaterial, root);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;

  const apply = (pose: Pose) => {
    body.position.y = pose.lift;
    body.rotation.z = -pose.roll;
    torso.rotation.set(pose.lean, pose.twist, 0);
    head.rotation.set(-pose.headPitch, pose.headYaw, 0);
    for (const [arm, p, side] of [
      [armL, pose.armL, 1],
      [armR, pose.armR, -1],
    ] as const) {
      arm.shoulder.rotation.set(-p.raise, 0, side * p.out);
      arm.elbow.rotation.set(-p.bend, 0, 0);
    }
    for (const [leg, p, side] of [
      [legL, pose.legL, 1],
      [legR, pose.legR, -1],
    ] as const) {
      leg.hip.rotation.set(-p.raise, 0, side * p.out);
      leg.knee.rotation.set(p.bend, 0, 0);
    }
  };
  apply(neutralPose());

  return {
    root,
    body,
    torso,
    head,
    hat: headWear,
    handL: armL.hand,
    handR: armR.hand,
    materials: { shirt, hat },
    apply,
    recolour(shirtColor, hatColor) {
      shirt.color.setHex(shirtColor);
      hat.color.setHex(hatColor);
    },
    handWorld(side, out) {
      root.updateMatrixWorld(true);
      return (side === 'L' ? armL.hand : armR.hand).getWorldPosition(out);
    },
  };
}

// ---------- Shared motion ----------

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOut = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;
export const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Pose for a run or walk cycle: legs and arms swing against each other. `phase` advances with
 * distance covered; `amount` is 0 for standing still and 1 for a full sprint.
 */
export function runPose(pose: Pose, phase: number, amount: number): Pose {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  pose.lift = Math.abs(c) * 0.06 * amount;
  pose.lean = 0.25 * amount;
  pose.legL.raise = s * 1.0 * amount;
  pose.legR.raise = -s * 1.0 * amount;
  pose.legL.bend = (0.15 + Math.max(0, -s) * 1.3) * amount;
  pose.legR.bend = (0.15 + Math.max(0, s) * 1.3) * amount;
  pose.armL.raise = -s * 0.9 * amount;
  pose.armR.raise = s * 0.9 * amount;
  pose.armL.bend = 1.3 * amount;
  pose.armR.bend = 1.3 * amount;
  pose.armL.out = pose.armR.out = 0.05;
  return pose;
}

// ---------- Blending between poses ----------

function copyLimb(from: LimbPose, to: LimbPose): void {
  to.raise = from.raise;
  to.out = from.out;
  to.bend = from.bend;
}

export function copyPose(from: Pose, to: Pose): Pose {
  to.lift = from.lift;
  to.lean = from.lean;
  to.twist = from.twist;
  to.headPitch = from.headPitch;
  to.headYaw = from.headYaw;
  to.roll = from.roll;
  copyLimb(from.armL, to.armL);
  copyLimb(from.armR, to.armR);
  copyLimb(from.legL, to.legL);
  copyLimb(from.legR, to.legR);
  return to;
}

function mixLimb(a: LimbPose, b: LimbPose, t: number, out: LimbPose): void {
  out.raise = lerp(a.raise, b.raise, t);
  out.out = lerp(a.out, b.out, t);
  out.bend = lerp(a.bend, b.bend, t);
}

export function mixPose(a: Pose, b: Pose, t: number, out: Pose): Pose {
  out.lift = lerp(a.lift, b.lift, t);
  out.lean = lerp(a.lean, b.lean, t);
  out.twist = lerp(a.twist, b.twist, t);
  out.headPitch = lerp(a.headPitch, b.headPitch, t);
  out.headYaw = lerp(a.headYaw, b.headYaw, t);
  out.roll = lerp(a.roll, b.roll, t);
  mixLimb(a.armL, b.armL, t, out.armL);
  mixLimb(a.armR, b.armR, t, out.armR);
  mixLimb(a.legL, b.legL, t, out.legL);
  mixLimb(a.legR, b.legR, t, out.legR);
  return out;
}

export interface Animator {
  /** The next frames ease from the pose showing now, taking `seconds`. */
  transition(seconds?: number): void;
  /** Builds this frame's target pose with `build` and shows it, eased in after a transition. */
  step(delta: number, build: (pose: Pose) => void): void;
}

/** Eases a person between whatever poses the caller builds, so changes of action never snap. */
export function createAnimator(person: Person): Animator {
  const current = neutralPose();
  const from = neutralPose();
  const target = neutralPose();
  let blend = 1;
  let blendTime = 0.2;
  return {
    transition(seconds = 0.2) {
      copyPose(current, from);
      blend = 0;
      blendTime = Math.max(seconds, 0.001);
    },
    step(delta, build) {
      build(resetPose(target));
      blend = Math.min(1, blend + delta / blendTime);
      mixPose(from, target, easeInOut(blend), current);
      person.apply(current);
    },
  };
}
