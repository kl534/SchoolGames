import {
  Box3,
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';

/** A grown-up is drawn this tall, yards, cap included, unless the style says otherwise. */
export const DEFAULT_HEIGHT = 2;

/** The rig's bones, yards, for a person 2 yd tall (a person is scaled to its own height). */
export const RIG = {
  hipY: 0.99,
  thigh: 0.47,
  shin: 0.45,
  hipX: 0.09,
  shoulderY: 0.62,
  shoulderX: 0.25,
  upperArm: 0.36,
  forearm: 0.3,
  /** The hand joint hangs this far below the wrist end of the forearm. */
  hand: 0.03,
  headY: 0.86,
  headR: 0.09,
} as const;

export type HatStyle = 'cap' | 'headband' | 'none';

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
  /** Standing height in yards, cap included (default 2). */
  height?: number;
  /** Long trousers with a belt, instead of shorts. */
  trousers?: boolean;
  /** The colour of a glove on the left hand. */
  glove?: number;
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
  /** Twist of the shoulders relative to the pelvis; shoulders turn by `hips + twist`. */
  twist: number;
  /** Turn of the pelvis about the vertical (positive turns it towards +x); the feet stay planted. */
  hips: number;
  /** Sideways shift of the pelvis in yards (positive towards +x); the feet stay planted. */
  slide: number;
  /** Positive looks up. */
  headPitch: number;
  /** The whole body tipped about its forward axis, in radians; positive tips towards their left (+x). */
  roll: number;
  headYaw: number;
  /** Heel raise of each foot about the ankle (the toes stay down, the heel comes up). */
  footL: number;
  footR: number;
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
    hips: 0,
    slide: 0,
    headPitch: 0,
    headYaw: 0,
    roll: 0,
    footL: 0,
    footR: 0,
    armL: limb(),
    armR: limb(),
    legL: limb(),
    legR: limb(),
  };
}

/** Resets a pose to standing at ease. */
export function resetPose(pose: Pose): Pose {
  pose.lift = pose.lean = pose.twist = pose.headPitch = pose.headYaw = pose.roll = 0;
  pose.hips = pose.slide = pose.footL = pose.footR = 0;
  for (const l of [pose.armL, pose.armR, pose.legL, pose.legR]) l.raise = l.out = l.bend = 0;
  return pose;
}

/**
 * How far the body drops when both knees bend by `bend` (radians) with the feet flat under the
 * hips, yards (before scaling). Use it as `-kneeDrop(bend)` for `Pose.lift`.
 */
export function kneeDrop(bend: number): number {
  const { thigh, shin } = RIG;
  const raise = (bend * shin) / (thigh + shin);
  return thigh + shin - (thigh * Math.cos(raise) + shin * Math.cos(bend - raise));
}

/** The thigh raise that keeps the ankle under the hip when the knee bends by `bend`. */
export const kneeRaise = (bend: number): number => (bend * RIG.shin) / (RIG.thigh + RIG.shin);

/**
 * The knee bend that puts a foot whose heel is raised by `heel` (radians, toes down) on the ground
 * when the body is `lift` above standing (negative to crouch). Yards before scaling.
 */
export function plantedBend(lift: number, heel: number): number {
  const { hipY, thigh, shin } = RIG;
  const want = hipY + lift - 0.07 * Math.cos(heel) - 0.2 * Math.sin(heel);
  let lo = 0;
  let hi = 2;
  for (let i = 0; i < 30; i++) {
    const b = (lo + hi) / 2;
    const r = kneeRaise(b);
    const extent = thigh * Math.cos(r) + shin * Math.cos(b - r);
    if (extent > want) lo = b;
    else hi = b;
  }
  return (lo + hi) / 2;
}

export interface Person {
  /** At the feet; yaw this to face somewhere (0 faces +z). Scaled to the person's height. */
  root: Group;
  /** How much `root` is scaled (the rig's yards are multiplied by this). */
  scale: number;
  body: Group;
  /** The hips: the legs and the torso hang from here. */
  pelvis: Group;
  torso: Group;
  head: Group;
  /** What is worn on the head (a cap or headband); it can be taken off. */
  hat: Group;
  shoulderL: Group;
  shoulderR: Group;
  elbowL: Group;
  elbowR: Group;
  /** Joints at the hands, for holding a ball. Left is +x. */
  handL: Group;
  handR: Group;
  materials: {
    shirt: MeshStandardMaterial;
    hat: MeshStandardMaterial;
    pants: MeshStandardMaterial;
  };
  apply(pose: Pose): void;
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
const shadowMaterial = new MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const qa = new Quaternion();
const qb = new Quaternion();

/** A grown-up in a polo: jointed limbs, a head with a face, and joints to pose. */
export function createPerson(style: PersonStyle): Person {
  const { thigh, shin, hipX, shoulderX, shoulderY, headY, headR } = RIG;
  const UPPER_ARM = RIG.upperArm * (style.armLength ?? 1);
  const FOREARM = RIG.forearm * (style.armLength ?? 1);
  const shirt = new MeshStandardMaterial({ color: style.shirt, roughness: 0.7 });
  const pants = new MeshStandardMaterial({ color: style.pants, roughness: 0.8 });
  const skin = new MeshStandardMaterial({ color: style.skin ?? 0xf1b48a, roughness: 0.75 });
  const hair = new MeshStandardMaterial({ color: style.hair ?? 0x5a3416, roughness: 0.9 });
  const hat = new MeshStandardMaterial({
    color: style.hatColor ?? style.pants,
    roughness: 0.55,
  });
  const shoe = new MeshStandardMaterial({ color: style.shoe ?? 0xf4f4f4, roughness: 0.6 });
  const sole = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const belt = new MeshStandardMaterial({ color: 0x1d1d22, roughness: 0.6 });
  const glove = style.glove === undefined ? skin : new MeshStandardMaterial({ color: style.glove });

  const root = new Group();
  const body = joint(root, 0, 0);
  const pelvis = joint(body, 0, RIG.hipY);
  pelvis.rotation.order = 'YXZ';

  const makeLeg = (side: number) => {
    const hip = joint(pelvis, side * hipX, 0);
    hip.rotation.order = 'YXZ';
    const knee = joint(hip, 0, -thigh);
    const ankle = joint(knee, 0, -shin);
    ankle.rotation.order = 'YXZ';
    if (style.trousers) {
      mesh(new CapsuleGeometry(0.088, thigh - 0.176, 4, 12), pants, hip, 0, -thigh / 2);
      mesh(new CapsuleGeometry(0.068, shin - 0.136, 4, 12), pants, knee, 0, -shin / 2 + 0.01);
    } else {
      mesh(new CapsuleGeometry(0.082, thigh - 0.164, 4, 12), skin, hip, 0, -thigh / 2);
      // Shorts: a wider, shorter tube over the top of the thigh.
      mesh(new CapsuleGeometry(0.098, 0.12, 4, 12), pants, hip, 0, -0.12);
      mesh(new CapsuleGeometry(0.063, shin - 0.126, 4, 12), skin, knee, 0, -shin / 2 + 0.01);
    }
    // A golf shoe: dark upper on a white sole, toes forward.
    mesh(new BoxGeometry(0.105, 0.05, 0.25), shoe, ankle, 0, -0.03, 0.06);
    mesh(new BoxGeometry(0.11, 0.02, 0.27), sole, ankle, 0, -0.06, 0.06);
    return { hip, knee, ankle };
  };
  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  const torso = joint(pelvis, 0, 0);
  const chest = mesh(new CapsuleGeometry(0.15, 0.3, 6, 18), shirt, torso, 0, 0.3);
  chest.scale.set(1.5, 1, 0.85);
  const hips = mesh(new CylinderGeometry(0.15, 0.15, 0.2, 18), pants, torso, 0, -0.04);
  hips.scale.set(1.45, 1, 0.87);
  if (style.trousers) {
    const strap = mesh(new CylinderGeometry(0.153, 0.153, 0.035, 18), belt, torso, 0, 0.07);
    strap.scale.set(1.45, 1, 0.87);
  }
  mesh(new CylinderGeometry(0.05, 0.056, 0.18, 10), skin, torso, 0, 0.68);
  // The polo collar: a ring at the neck and a small placket down the chest.
  const collar = mesh(new TorusGeometry(0.075, 0.02, 6, 16), shirt, torso, 0, 0.62, 0.0);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1, 1, 1.4);
  mesh(new BoxGeometry(0.035, 0.12, 0.012), shirt, torso, 0, 0.5, 0.13);

  const head = joint(torso, 0, headY);
  head.rotation.order = 'YXZ';
  const skull = mesh(new SphereGeometry(headR, 24, 18), skin, head);
  skull.scale.set(1, 1.22, 1.08);
  for (const side of [-1, 1]) {
    mesh(new SphereGeometry(0.013, 8, 6), eyeMaterial, head, side * 0.033, 0.018, headR * 1.08);
    mesh(
      new BoxGeometry(0.036, 0.007, 0.01),
      hair,
      head,
      side * 0.033,
      0.043,
      headR * 1.08 - 0.004,
    );
    mesh(
      new SphereGeometry(0.022, 8, 6),
      skin,
      head,
      side * (headR + 0.002),
      -0.005,
      -0.004,
    ).scale.set(0.45, 1, 0.8);
  }
  mesh(new SphereGeometry(0.017, 8, 6), skin, head, 0, -0.012, headR * 1.08 + 0.004);

  /** Everything worn on the head, so a mask or cap can come off. */
  const headWear = joint(head, 0, 0);
  const hatStyle = style.hat ?? 'headband';
  const hairCap = mesh(
    new SphereGeometry(headR + 0.006, 24, 14, 0, Math.PI * 2, 0, 1.7),
    hair,
    headWear,
    0,
    0.0,
    -0.012,
  );
  hairCap.scale.set(1, 1.22, 1.08);
  if (hatStyle === 'headband') {
    const band = mesh(new TorusGeometry(headR + 0.004, 0.016, 8, 28), hat, headWear, 0, 0.06, 0);
    band.rotation.x = Math.PI / 2;
  } else if (hatStyle === 'cap') {
    const dome = mesh(
      new SphereGeometry(headR + 0.014, 24, 12, 0, Math.PI * 2, 0, 1.3),
      hat,
      headWear,
      0,
      0.004,
      -0.004,
    );
    dome.scale.set(1, 1.22, 1.08);
    const peak = mesh(
      new CylinderGeometry(0.075, 0.075, 0.007, 14, 1, false, -Math.PI / 2, Math.PI),
      hat,
      headWear,
      0,
      0.05,
      headR * 0.9,
    );
    peak.rotation.x = 0.14;
  }

  const makeArm = (side: number) => {
    const shoulder = joint(torso, side * shoulderX, shoulderY);
    shoulder.rotation.order = 'YXZ';
    mesh(new SphereGeometry(0.072, 12, 8), shirt, shoulder);
    // Bare upper arm under a short sleeve that ends above the elbow.
    mesh(new CapsuleGeometry(0.049, UPPER_ARM - 0.1, 4, 10), skin, shoulder, 0, -UPPER_ARM / 2);
    mesh(new CapsuleGeometry(0.063, 0.1, 4, 10), shirt, shoulder, 0, -0.12);
    const elbow = joint(shoulder, 0, -UPPER_ARM);
    mesh(new CapsuleGeometry(0.043, FOREARM - 0.086, 4, 10), skin, elbow, 0, -FOREARM / 2);
    const hand = joint(elbow, 0, -FOREARM - RIG.hand);
    const palm = mesh(new SphereGeometry(0.045, 10, 8), side > 0 ? glove : skin, hand);
    palm.scale.set(0.85, 1.15, 0.85);
    mesh(new SphereGeometry(0.02, 8, 6), side > 0 ? glove : skin, hand, side * -0.02, 0.01, 0.035);
    return { shoulder, elbow, hand };
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);

  // Scale so the standing person comes out at the style's height, cap included.
  const standing = new Box3().setFromObject(root);
  const scale = (style.height ?? DEFAULT_HEIGHT) / (standing.max.y - standing.min.y);
  root.scale.setScalar(scale);

  const shadow = mesh(new CircleGeometry(0.4, 20), shadowMaterial, root);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  shadow.name = 'blob';

  const legLength = thigh + shin;
  const apply = (pose: Pose) => {
    body.position.y = pose.lift;
    body.rotation.z = -pose.roll;
    pelvis.position.x = pose.slide;
    pelvis.rotation.y = pose.hips;
    // The spine keeps its forward tilt while the shoulders turn about it, whatever the pelvis does.
    torso.quaternion
      .copy(qa.setFromAxisAngle(AXIS_Y, -pose.hips))
      .multiply(qb.setFromAxisAngle(AXIS_X, pose.lean))
      .multiply(qa.setFromAxisAngle(AXIS_Y, pose.hips + pose.twist));
    head.rotation.set(-pose.headPitch, pose.headYaw, 0);
    for (const [arm, p, side] of [
      [armL, pose.armL, 1],
      [armR, pose.armR, -1],
    ] as const) {
      arm.shoulder.rotation.set(-p.raise, 0, side * p.out);
      arm.elbow.rotation.set(-p.bend, 0, 0);
    }
    for (const [leg, p, side, foot] of [
      [legL, pose.legL, 1, pose.footL],
      [legR, pose.legR, -1, pose.footR],
    ] as const) {
      // The leg leans back under the pelvis when it slides, and turns against it: feet stay put.
      const z = side * p.out - pose.slide / legLength;
      leg.hip.rotation.set(-p.raise, -pose.hips, z);
      leg.knee.rotation.set(p.bend, 0, 0);
      leg.ankle.rotation.set(p.raise - p.bend + foot, side > 0 ? 0.35 : -0.15, -z);
    }
  };
  apply(neutralPose());

  return {
    root,
    scale,
    body,
    pelvis,
    torso,
    head,
    hat: headWear,
    shoulderL: armL.shoulder,
    shoulderR: armR.shoulder,
    elbowL: armL.elbow,
    elbowR: armR.elbow,
    handL: armL.hand,
    handR: armR.hand,
    materials: { shirt, hat, pants },
    apply,
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
  to.hips = from.hips;
  to.slide = from.slide;
  to.footL = from.footL;
  to.footR = from.footR;
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
  out.hips = lerp(a.hips, b.hips, t);
  out.slide = lerp(a.slide, b.slide, t);
  out.footL = lerp(a.footL, b.footL, t);
  out.footR = lerp(a.footR, b.footR, t);
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
