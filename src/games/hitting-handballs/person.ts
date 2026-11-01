import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
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

/** Height of the hip joint on an unscaled person (before `PERSON_SCALE`). */
export const HIP_Y = 0.52;
const THIGH = 0.26;
const SHIN = 0.26;
const SHOULDER_Y = 0.36;
const SHOULDER_X = 0.2;
const UPPER_ARM_BASE = 0.17;
const FOREARM_BASE = 0.16;
const HEAD_Y = 0.62;
const HEAD_R = 0.2;

export type HatStyle = 'party' | 'puppy' | 'colander' | 'pirate' | 'headband' | 'crown' | 'none';

export interface PersonStyle {
  shirt: number;
  pants: number;
  skin?: number;
  hair?: number;
  hat?: HatStyle;
  hatColor?: number;
  shoe?: number;
  /** How much longer than a plain cartoon kid's the arms are (a player's reach for the rim). */
  armLength?: number;
  /** A red cape down the back. */
  cape?: boolean;
  /** A black patch over the eye the camera sees. */
  eyepatch?: boolean;
  /** Two dark lenses over the eyes. */
  sunglasses?: boolean;
  /** A cardboard box worn over the torso. */
  boxArmour?: boolean;
  /** Size of the whole person next to the usual (1). */
  scale?: number;
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
  /** What is worn on the head (hair and a hat); it can be taken off. */
  hat: Group;
  /** Just the hat part of `hat`, so a crown can be dropped onto the head. */
  hatSlot: Group;
  /** The dark disc under the feet (hide it when airborne). */
  shadow: Mesh;

  /** Joints at the hands, for holding a ball. Left is +x. */
  handL: Group;
  handR: Group;
  materials: {
    shirt: MeshStandardMaterial;
    hat: MeshStandardMaterial;
    pants: MeshStandardMaterial;
  };
  apply(pose: Pose): void;
  /** Swaps the hat (and its main colour, when given). */
  setHat(style: HatStyle, color?: number): void;
  setCape(on: boolean): void;
  setEyepatch(on: boolean): void;
  setSunglasses(on: boolean): void;
  setBoxArmour(on: boolean): void;
  /** Size of the whole person next to the usual (1). */
  setScale(scale: number): void;
  /** Pupils turned in towards the nose. */
  setCrossEyes(on: boolean): void;
  /** Changes the colours of the shirt, and of the shorts and headband (the trim). */
  recolour(shirt: number, trim: number): void;
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
const eyeWhite = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const smileMaterial = new MeshBasicMaterial({ color: 0x5b2a22 });
const shadowMaterial = new MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});

/** A cartoon kid in a uniform: big head with a face, capsule limbs, and joints to pose. */
export function createPerson(style: PersonStyle): Person {
  const UPPER_ARM = UPPER_ARM_BASE * (style.armLength ?? 1);
  const FOREARM = FOREARM_BASE * (style.armLength ?? 1);
  const shirt = new MeshStandardMaterial({ color: style.shirt, roughness: 0.7 });
  const pants = new MeshStandardMaterial({ color: style.pants, roughness: 0.8 });
  const skin = new MeshStandardMaterial({ color: style.skin ?? 0xf1b48a, roughness: 0.75 });
  const hair = new MeshStandardMaterial({ color: style.hair ?? 0x5a3416, roughness: 0.9 });
  const hat = new MeshStandardMaterial({
    color: style.hatColor ?? style.pants,
    roughness: 0.55,
  });
  const shoe = new MeshStandardMaterial({ color: style.shoe ?? 0xf4f4f4, roughness: 0.6 });

  const root = new Group();
  root.scale.setScalar(PERSON_SCALE);
  const body = joint(root, 0, 0);

  const makeLeg = (side: number) => {
    const hip = joint(body, side * 0.1, HIP_Y);
    mesh(new CapsuleGeometry(0.07, THIGH - 0.1, 4, 10), skin, hip, 0, -THIGH / 2);
    // Shorts: a wider, shorter tube over the top of the thigh.
    mesh(new CapsuleGeometry(0.088, 0.1, 4, 10), pants, hip, 0, -0.1);
    const knee = joint(hip, 0, -THIGH);
    mesh(new CapsuleGeometry(0.062, SHIN - 0.1, 4, 10), skin, knee, 0, -SHIN / 2);
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
  const pupils: { mesh: Mesh; side: number }[] = [];
  for (const side of [-1, 1]) {
    mesh(new SphereGeometry(0.047, 12, 10), eyeWhite, head, side * 0.075, 0.03, HEAD_R - 0.035);
    const pupil = mesh(
      new SphereGeometry(0.027, 10, 8),
      eyeMaterial,
      head,
      side * 0.075,
      0.03,
      HEAD_R - 0.035 + 0.03,
    );
    pupils.push({ mesh: pupil, side });
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
  const hatStyle: HatStyle = style.hat ?? 'headband';
  mesh(
    new SphereGeometry(HEAD_R + 0.012, 24, 14, 0, Math.PI * 2, 0, 1.55),
    hair,
    headWear,
    0,
    0.0,
    -0.015,
  );
  const hatSlot = joint(headWear, 0, 0);
  const accent = new MeshStandardMaterial({ color: 0xffd23f, roughness: 0.4 });
  const gold = new MeshStandardMaterial({ color: 0xffc928, roughness: 0.3, metalness: 0.7 });
  const silver = new MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.3, metalness: 0.7 });
  const black = new MeshStandardMaterial({ color: 0x17171c, roughness: 0.6 });
  const white = new MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.5 });

  const buildHat = (kind: HatStyle) => {
    if (kind === 'headband' || kind === 'puppy') {
      const band = mesh(new TorusGeometry(HEAD_R + 0.008, 0.022, 8, 28), hat, hatSlot, 0, 0.07, 0);
      band.rotation.x = Math.PI / 2;
    }
    if (kind === 'headband') {
      // Two tails hanging behind.
      for (const [dx, tilt] of [
        [-0.03, 0.35],
        [0.04, -0.25],
      ]) {
        const tail = mesh(
          new BoxGeometry(0.045, 0.2, 0.012),
          hat,
          hatSlot,
          dx,
          -0.03,
          -HEAD_R - 0.03,
        );
        tail.rotation.set(0.25, 0, tilt);
      }
    }
    if (kind === 'puppy') {
      for (const side of [-1, 1]) {
        const ear = mesh(
          new SphereGeometry(1, 12, 10),
          hat,
          hatSlot,
          side * (HEAD_R + 0.025),
          0.0,
          0.0,
        );
        ear.scale.set(0.045, 0.13, 0.085);
        ear.rotation.z = side * 0.28;
      }
    }
    if (kind === 'party') {
      const cone = mesh(new ConeGeometry(0.12, 0.3, 18), hat, hatSlot, 0, HEAD_R + 0.12, 0);
      cone.rotation.z = -0.1;
      const ring = mesh(new TorusGeometry(0.093, 0.012, 6, 20), accent, hatSlot, -0.012, 0.31, 0);
      ring.rotation.set(Math.PI / 2, 0, -0.1);
      mesh(new SphereGeometry(0.035, 10, 8), accent, hatSlot, -0.045, HEAD_R + 0.28, 0);
    }
    if (kind === 'colander') {
      mesh(
        new SphereGeometry(HEAD_R + 0.04, 24, 12, 0, Math.PI * 2, 0, 1.45),
        silver,
        hatSlot,
        0,
        0.01,
        0,
      );
      for (let i = 0; i < 12; i++) {
        const theta = (i / 12) * Math.PI * 2;
        const phi = 0.45 + (i % 3) * 0.3;
        const r = HEAD_R + 0.041;
        const hole = mesh(
          new CircleGeometry(0.013, 8),
          black,
          hatSlot,
          Math.sin(phi) * Math.cos(theta) * r,
          0.01 + Math.cos(phi) * r,
          Math.sin(phi) * Math.sin(theta) * r,
        );
        hole.lookAt(hole.position.clone().multiplyScalar(2));
      }
      for (const side of [-1, 1]) {
        const handle = mesh(
          new BoxGeometry(0.07, 0.025, 0.03),
          silver,
          hatSlot,
          side * 0.25,
          0.07,
          0,
        );
        handle.rotation.z = side * -0.2;
      }
    }
    if (kind === 'pirate') {
      const brim = mesh(new CylinderGeometry(0.27, 0.27, 0.025, 24), black, hatSlot, 0, 0.12, 0);
      brim.scale.set(1, 1, 0.8);
      const crown = mesh(new CylinderGeometry(0.15, 0.19, 0.14, 20), black, hatSlot, 0, 0.2, 0);
      crown.scale.set(1, 1, 0.9);
      mesh(new TorusGeometry(0.17, 0.012, 6, 24), white, hatSlot, 0, 0.145, 0).rotation.x =
        Math.PI / 2;
      mesh(new SphereGeometry(0.03, 8, 6), white, hatSlot, 0, 0.21, 0.165).scale.set(1, 1.1, 0.4);
    }
    if (kind === 'crown') {
      const base = mesh(
        new CylinderGeometry(0.15, 0.135, 0.07, 18, 1, true),
        gold,
        hatSlot,
        0,
        HEAD_R + 0.06,
        0,
      );
      (base.material as MeshStandardMaterial).side = DoubleSide;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        mesh(
          new ConeGeometry(0.035, 0.1, 8),
          gold,
          hatSlot,
          Math.cos(a) * 0.145,
          HEAD_R + 0.155,
          Math.sin(a) * 0.145,
        );
        mesh(
          new SphereGeometry(0.018, 8, 6),
          i % 2 ? hat : accent,
          hatSlot,
          Math.cos(a) * 0.15,
          HEAD_R + 0.065,
          Math.sin(a) * 0.15,
        );
      }
    }
  };
  const setHat = (kind: HatStyle, color?: number) => {
    for (const child of [...hatSlot.children]) {
      hatSlot.remove(child);
      (child as Mesh).geometry?.dispose();
    }
    if (color !== undefined) hat.color.setHex(color);
    buildHat(kind);
  };
  setHat(hatStyle);

  const makeArm = (side: number) => {
    const shoulder = joint(torso, side * SHOULDER_X, SHOULDER_Y);
    mesh(new SphereGeometry(0.07, 12, 8), shirt, shoulder);
    mesh(new CapsuleGeometry(0.052, UPPER_ARM - 0.06, 4, 10), shirt, shoulder, 0, -UPPER_ARM / 2);
    const elbow = joint(shoulder, 0, -UPPER_ARM);
    mesh(new CapsuleGeometry(0.047, FOREARM - 0.05, 4, 10), skin, elbow, 0, -FOREARM / 2);
    const hand = joint(elbow, 0, -FOREARM - 0.02);
    mesh(new SphereGeometry(0.058, 10, 8), skin, hand);
    return { shoulder, elbow, hand };
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);

  // Things that come and go with the costume.
  const capeMaterial = new MeshStandardMaterial({
    color: 0xd7263d,
    roughness: 0.7,
    side: DoubleSide,
  });
  const cape = mesh(new BoxGeometry(0.4, 0.62, 0.025), capeMaterial, torso, 0, 0.1, -0.17);
  cape.rotation.x = 0.1;
  cape.visible = style.cape ?? false;
  const armour = joint(torso, 0, 0.2);
  const boxMaterial = new MeshStandardMaterial({ color: 0xc79a5a, roughness: 0.9 });
  const tapeMaterial = new MeshStandardMaterial({ color: 0xa87a3e, roughness: 0.9 });
  mesh(new BoxGeometry(0.46, 0.46, 0.34), boxMaterial, armour);
  mesh(new BoxGeometry(0.48, 0.05, 0.36), tapeMaterial, armour, 0, 0.12, 0);
  mesh(new BoxGeometry(0.48, 0.05, 0.36), tapeMaterial, armour, 0, -0.12, 0);
  armour.visible = style.boxArmour ?? false;
  const patch = joint(head, 0, 0);
  mesh(new SphereGeometry(0.058, 12, 8), black, patch, 0.075, 0.03, HEAD_R - 0.05).scale.set(
    1,
    1,
    0.45,
  );
  const strap = mesh(new TorusGeometry(HEAD_R + 0.004, 0.007, 6, 28), black, patch, 0, 0.05, 0);
  strap.rotation.set(Math.PI / 2 + 0.25, 0, 0);
  patch.visible = style.eyepatch ?? false;
  const glasses = joint(head, 0, 0);
  for (const side of [-1, 1]) {
    mesh(new BoxGeometry(0.1, 0.06, 0.03), black, glasses, side * 0.075, 0.035, HEAD_R - 0.01);
  }
  mesh(new BoxGeometry(0.06, 0.012, 0.02), black, glasses, 0, 0.05, HEAD_R - 0.005);
  glasses.visible = style.sunglasses ?? false;

  const baseScale = PERSON_SCALE;
  root.scale.setScalar(baseScale * (style.scale ?? 1));

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
    hatSlot,
    shadow,
    handL: armL.hand,
    handR: armR.hand,
    materials: { shirt, hat, pants },
    apply,
    setHat,
    setCape: (on) => (cape.visible = on),
    setEyepatch: (on) => (patch.visible = on),
    setSunglasses: (on) => (glasses.visible = on),
    setBoxArmour: (on) => (armour.visible = on),
    setScale: (scale) => root.scale.setScalar(baseScale * scale),
    setCrossEyes(on) {
      for (const { mesh: pupil, side } of pupils) {
        pupil.position.x = side * (on ? 0.028 : 0.075);
        pupil.position.z = HEAD_R - 0.035 + (on ? 0.036 : 0.03);
      }
    },
    recolour(shirtColor, trimColor) {
      shirt.color.setHex(shirtColor);
      hat.color.setHex(trimColor);
      pants.color.setHex(trimColor);
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
