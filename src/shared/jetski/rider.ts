/**
 * The jet-ski rider: a cartoon kid in a helmet with the player's avatar on it, and a bright
 * orange life vest. Built from the Strike Zone kid (capsule limbs, joints to pose, an animator
 * that blends between poses), with faces for scared, dizzy and soaked, gag props (seaweed on the
 * helmet, a fish in the mouth) and the poses a jet-ski trick rider needs.
 */
import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { FaceName, PoseName } from './anim';
import { createFish, createSeaweed, type Prop } from './critters';

/** The rider is drawn a little bigger than life, so he reads on a phone. */
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
  /** The torso leaning forward, and twisting. */
  lean: number;
  twist: number;
  /** Positive looks up. */
  headPitch: number;
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
    armL: limb(),
    armR: limb(),
    legL: limb(),
    legR: limb(),
  };
}

/** Resets a pose to standing at ease. */
export function resetPose(pose: Pose): Pose {
  pose.lift = pose.lean = pose.twist = pose.headPitch = pose.headYaw = 0;
  for (const l of [pose.armL, pose.armR, pose.legL, pose.legR]) l.raise = l.out = l.bend = 0;
  return pose;
}

// ---------- Easing and blending ----------

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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
  mixLimb(a.armL, b.armL, t, out.armL);
  mixLimb(a.armR, b.armR, t, out.armR);
  mixLimb(a.legL, b.legL, t, out.legL);
  mixLimb(a.legR, b.legR, t, out.legR);
  return out;
}

// ---------- The poses ----------

/** Each pose fills in the limbs; `t` is seconds, for wobbles. */
export const POSES: Record<PoseName, (pose: Pose, t: number) => void> = {
  ride(p, t) {
    // Sitting astride the ski, hands on the bars, knees bent.
    p.lean = 0.3;
    p.legL.raise = p.legR.raise = 0.95;
    p.legL.bend = p.legR.bend = 1.1;
    p.legL.out = p.legR.out = 0.3;
    p.armL.raise = p.armR.raise = 1.25;
    p.armL.bend = p.armR.bend = 0.25;
    p.headPitch = -0.1 + Math.sin(t * 6) * 0.03;
  },
  wave(p, t) {
    POSES.ride(p, t);
    p.armL.raise = 3.0;
    p.armL.out = 0.35;
    p.armL.bend = 0.4 + Math.sin(t * 11) * 0.45;
  },
  armsUp(p, t) {
    POSES.ride(p, t);
    p.armL.raise = p.armR.raise = 3.05;
    p.armL.out = p.armR.out = 0.3;
    p.armL.bend = p.armR.bend = 0.1;
    p.headPitch = 0.2;
  },
  fistPump(p, t) {
    POSES.ride(p, t);
    p.armR.raise = 2.9;
    p.armR.out = 0.15;
    p.armR.bend = 0.5 + Math.sin(t * 9) * 0.4;
    p.headPitch = 0.15;
  },
  flail(p, t) {
    const s = (k: number) => Math.sin(t * 16 + k);
    p.lean = 0.2 * s(0);
    p.armL.raise = 1.8 + s(0.5) * 1.3;
    p.armR.raise = 1.8 + s(2.5) * 1.3;
    p.armL.out = 0.5 + Math.abs(s(1)) * 0.5;
    p.armR.out = 0.5 + Math.abs(s(3)) * 0.5;
    p.armL.bend = 0.4 + Math.abs(s(4)) * 0.6;
    p.armR.bend = 0.4 + Math.abs(s(5)) * 0.6;
    p.legL.raise = 0.6 + s(1.5) * 0.9;
    p.legR.raise = 0.6 + s(3.5) * 0.9;
    p.legL.bend = 0.5 + Math.abs(s(2)) * 0.7;
    p.legR.bend = 0.5 + Math.abs(s(6)) * 0.7;
    p.legL.out = p.legR.out = 0.25;
  },
  superman(p, t) {
    // Hands on the bars, body stretched out flat behind them, legs straight out at the back.
    POSES.ride(p, t);
    p.lift = 0.25;
    p.lean = 1.35;
    p.armL.raise = p.armR.raise = 1.45;
    p.armL.bend = p.armR.bend = 0.05;
    p.legL.raise = p.legR.raise = -0.9;
    p.legL.bend = p.legR.bend = 0.05;
    p.legL.out = p.legR.out = 0.2;
    p.headPitch = 0.35;
  },
  dizzy(p, t) {
    POSES.float(p, t);
    p.headYaw = Math.sin(t * 5) * 0.4;
    p.headPitch = Math.sin(t * 3) * 0.15;
  },
  thumbs(p, t) {
    POSES.ride(p, t);
    p.armL.raise = 1.2;
    p.armL.out = 0.55;
    p.armL.bend = 1.5;
    p.lean = 0.1;
  },
  stand(p, t) {
    // Standing on the footwells, knees soft, one hand waving, the other out for balance.
    p.lift = 0.2;
    p.lean = 0.08;
    p.legL.raise = p.legR.raise = 0.3;
    p.legL.bend = p.legR.bend = 0.5;
    p.legL.out = p.legR.out = 0.18;
    p.armL.raise = 3.0;
    p.armL.out = 0.35;
    p.armL.bend = 0.4 + Math.sin(t * 11) * 0.45;
    p.armR.raise = 0.2;
    p.armR.out = 1.3 + Math.sin(t * 6) * 0.1;
  },
  tuck(p, t) {
    // Curled up into a ball for a flip.
    p.lean = 0.85;
    p.legL.raise = p.legR.raise = 1.6;
    p.legL.bend = p.legR.bend = 2.0;
    p.legL.out = p.legR.out = 0.2;
    p.armL.raise = p.armR.raise = 1.4;
    p.armL.bend = p.armR.bend = 1.5;
    p.headPitch = -0.35 + Math.sin(t * 8) * 0.02;
  },
  frisbee(p) {
    // Flat as a pancake, arms and legs spread, belly down, head up.
    p.lift = 0.2;
    p.lean = Math.PI / 2;
    p.armL.raise = p.armR.raise = 0.1;
    p.armL.out = p.armR.out = 1.6;
    p.legL.out = p.legR.out = 0.5;
    p.headPitch = 0.7;
  },
  float(p, t) {
    // Treading water chest deep: arms out, bobbing, legs hanging (and hidden by the water).
    p.lift = 0.05 * Math.sin(t * 3);
    p.armL.raise = p.armR.raise = 0.2;
    p.armL.out = p.armR.out = 1.15 + Math.sin(t * 4) * 0.12;
    p.armL.bend = p.armR.bend = 0.2;
    p.legL.raise = p.legR.raise = 0.1;
    p.legL.out = p.legR.out = 0.15;
    p.headPitch = 0.15;
  },
  climb(p, t) {
    // Hauling up onto the ski: leaning in, reaching for the bars, legs kicking.
    p.lean = 0.7;
    p.armL.raise = 2.3;
    p.armR.raise = 1.9;
    p.armL.bend = p.armR.bend = 0.4;
    p.legL.raise = 0.7 + Math.sin(t * 12) * 0.35;
    p.legR.raise = 0.7 - Math.sin(t * 12) * 0.35;
    p.legL.bend = p.legR.bend = 0.9;
    p.legL.out = p.legR.out = 0.25;
    p.headPitch = 0.1;
  },
};

/** Which way a free rider faces, by pose: towards the three-quarter camera, else along the ski. */
const FREE_FACE: Partial<Record<PoseName, number>> = {
  float: Math.PI / 4,
  dizzy: Math.PI / 4,
  thumbs: Math.PI / 4,
  wave: Math.PI / 4,
};
/** Along the ski (the way it goes, -z): the model faces +z, so it turns half a circle. */
const FORWARD = Math.PI;

// ---------- The avatar sticker ----------

/** A white disc with the player's avatar on it, drawn once per run. Null without a 2D canvas. */
export function createAvatarTexture(avatar: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(64, 64, 64, 0, Math.PI * 2);
  g.fill();
  g.font = '86px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#222';
  g.fillText(avatar, 64, 70);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

// ---------- The rig ----------

export interface RiderStyle {
  shirt: number;
  pants: number;
  helmet: number;
  skin?: number;
  shoe?: number;
}

export const DEFAULT_STYLE: RiderStyle = {
  shirt: 0x2fa4e7,
  pants: 0x2d3a8c,
  helmet: 0xe8403a,
};

export interface Rider {
  /** Add this to the ski's seat (seated) or the scene (free). Its origin is the hips. */
  root: Group;
  mode: 'seated' | 'free';
  /** Seated: parented to the ski's seat. Free: parented to `world`. */
  setMode(mode: 'seated' | 'free', seat: Object3D, world: Object3D): void;
  setPose(name: PoseName): void;
  setFace(face: FaceName): void;
  /** Gag props: seaweed hanging off the helmet, a fish in the mouth. */
  setProps(seaweed: boolean, fish: boolean): void;
  /**
   * Free mode: where the hips are (world x, y, z) and how the body is turned about them, with the
   * same angles as the ski (pitch + noses up, roll + dips the right side, yaw + turns left).
   */
  place(x: number, y: number, z: number, pitch: number, roll: number, yaw: number): void;
  setVisible(visible: boolean): void;
  /** Steps the animation; `time` is for wobbles. */
  update(delta: number, time: number): void;
  dispose(): void;
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

/** A cartoon kid in a helmet: big head, capsule limbs, joints to pose. */
export function createRider(avatar: string, style: RiderStyle = DEFAULT_STYLE): Rider {
  const shirt = new MeshStandardMaterial({ color: style.shirt, roughness: 0.7 });
  const pants = new MeshStandardMaterial({ color: style.pants, roughness: 0.8 });
  const skin = new MeshStandardMaterial({ color: style.skin ?? 0xf1b48a, roughness: 0.75 });
  const helmet = new MeshStandardMaterial({ color: style.helmet, roughness: 0.25, metalness: 0.1 });
  const shoe = new MeshStandardMaterial({ color: style.shoe ?? 0xf4f4f4, roughness: 0.6 });
  const dark = new MeshStandardMaterial({ color: 0x1b1b24, roughness: 0.4 });
  const white = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const mouthMaterial = new MeshBasicMaterial({ color: 0x5b2a22 });
  const strapMaterial = new MeshStandardMaterial({ color: 0x222233, roughness: 0.8 });
  const vest = new MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 });
  const vestStrap = new MeshStandardMaterial({ color: 0xfff1c2, roughness: 0.6 });
  const dropMaterial = new MeshBasicMaterial({ color: 0x9ee2ff });

  // root: the hips (the pivot); facing: which way the body looks; person: scaled rig.
  const root = new Group();
  const facing = joint(root, 0, 0);
  const person = joint(facing, 0, -HIP_Y * PERSON_SCALE);
  person.scale.setScalar(PERSON_SCALE);
  const body = joint(person, 0, 0);

  const makeLeg = (side: number) => {
    const hip = joint(body, side * 0.1, HIP_Y);
    mesh(new CapsuleGeometry(0.07, THIGH - 0.1, 4, 10), skin, hip, 0, -THIGH / 2);
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
  // The life vest: a slightly bigger orange shell with two pale straps and a buckle.
  mesh(new CapsuleGeometry(0.166, 0.1, 6, 16), vest, torso, 0, 0.21).scale.set(1.17, 1, 0.98);
  for (const side of [-1, 1]) {
    mesh(new BoxGeometry(0.05, 0.3, 0.012), vestStrap, torso, side * 0.06, 0.24, 0.158);
  }
  mesh(new BoxGeometry(0.2, 0.035, 0.014), vestStrap, torso, 0, 0.11, 0.165);

  const head = joint(torso, 0, HEAD_Y);
  head.rotation.order = 'YXZ';
  const headMesh = mesh(new SphereGeometry(HEAD_R, 24, 18), skin, head);
  void headMesh;
  for (const side of [-1, 1]) {
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

  // Faces: every feature is built once and shown or hidden.
  const happy = joint(head, 0, 0);
  for (const side of [-1, 1]) {
    mesh(new SphereGeometry(0.03, 10, 8), dark, happy, side * 0.075, 0.025, HEAD_R - 0.02);
  }
  const smile = mesh(new TorusGeometry(0.045, 0.009, 6, 12, Math.PI), mouthMaterial, happy);
  smile.position.set(0, -0.045, HEAD_R - 0.005);
  smile.rotation.z = Math.PI;

  const scared = joint(head, 0, 0);
  for (const side of [-1, 1]) {
    mesh(new SphereGeometry(0.052, 12, 10), white, scared, side * 0.075, 0.03, HEAD_R - 0.035);
    mesh(new SphereGeometry(0.02, 8, 6), dark, scared, side * 0.075, 0.03, HEAD_R + 0.012);
  }
  mesh(new TorusGeometry(0.03, 0.011, 6, 14), mouthMaterial, scared, 0, -0.06, HEAD_R - 0.01);

  const dizzy = joint(head, 0, 0);
  for (const side of [-1, 1]) {
    const eye = joint(dizzy, side * 0.075, 0.03, HEAD_R - 0.01);
    mesh(new TorusGeometry(0.04, 0.008, 6, 16), dark, eye);
    mesh(new TorusGeometry(0.02, 0.008, 6, 14), dark, eye);
    mesh(new SphereGeometry(0.009, 6, 4), dark, eye);
  }
  for (let i = 0; i < 4; i++) {
    mesh(
      new SphereGeometry(0.011, 6, 4),
      mouthMaterial,
      dizzy,
      -0.045 + i * 0.03,
      -0.055 + (i % 2 ? 0.012 : -0.012),
      HEAD_R - 0.005,
    );
  }

  const soaked = joint(head, 0, 0);
  for (const side of [-1, 1]) {
    // Squinting eyes shut against the water, brows pushed down.
    mesh(new BoxGeometry(0.07, 0.014, 0.01), dark, soaked, side * 0.075, 0.025, HEAD_R - 0.005);
    const brow = mesh(
      new BoxGeometry(0.08, 0.012, 0.01),
      dark,
      soaked,
      side * 0.075,
      0.06,
      HEAD_R - 0.012,
    );
    brow.rotation.z = side * 0.3;
  }
  const wobble = mesh(new TorusGeometry(0.04, 0.009, 6, 12, Math.PI), mouthMaterial, soaked);
  wobble.position.set(0, -0.07, HEAD_R - 0.005);
  // Water drops on the forehead and cheeks.
  for (const [x, y] of [
    [-0.11, -0.03],
    [0.12, -0.05],
    [0.02, 0.1],
    [-0.06, 0.0],
  ]) {
    mesh(new SphereGeometry(0.014, 8, 6), dropMaterial, soaked, x, y, HEAD_R - 0.01).scale.set(
      0.8,
      1.3,
      0.8,
    );
  }

  // Soot: a charcoal mask over the face with wide white eyes and a gasping mouth.
  const sooty = joint(head, 0, 0);
  const soot = new MeshStandardMaterial({ color: 0x241f1f, roughness: 0.95 });
  mesh(new SphereGeometry(HEAD_R + 0.006, 22, 14, Math.PI / 2 - 1.0, 2.0, 0.5, 1.75), soot, sooty);
  for (const side of [-1, 1]) {
    mesh(new SphereGeometry(0.05, 12, 10), white, sooty, side * 0.072, 0.03, HEAD_R - 0.03);
    mesh(new SphereGeometry(0.02, 8, 6), dark, sooty, side * 0.072, 0.025, HEAD_R + 0.016);
    // A few puffs of soot on the helmet side and the cheeks.
    mesh(new SphereGeometry(0.02, 6, 5), soot, sooty, side * 0.13, -0.05, HEAD_R - 0.045);
  }
  mesh(new TorusGeometry(0.028, 0.011, 6, 14), mouthMaterial, sooty, 0, -0.07, HEAD_R - 0.004);
  mesh(new BoxGeometry(0.05, 0.016, 0.01), white, sooty, 0, -0.045, HEAD_R + 0.002);

  const faces: Record<FaceName, Group> = { happy, scared, dizzy, soaked, sooty };

  // The helmet: a glossy shell with a visor ridge, a chin strap and the avatar stickers.
  const headWear = joint(head, 0, 0);
  const shell = mesh(
    new SphereGeometry(HEAD_R + 0.035, 28, 16, 0, Math.PI * 2, 0, 1.78),
    helmet,
    headWear,
    0,
    0.012,
    -0.02,
  );
  shell.rotation.x = -0.1;
  const peak = mesh(new BoxGeometry(0.3, 0.025, 0.1), helmet, headWear, 0, 0.1, HEAD_R + 0.04);
  peak.rotation.x = 0.35;
  const strap = mesh(
    new TorusGeometry(HEAD_R - 0.005, 0.012, 6, 24, Math.PI),
    strapMaterial,
    headWear,
  );
  strap.rotation.set(0, 0, Math.PI);
  strap.position.set(0, -0.02, 0);
  strap.scale.set(1, 0.9, 1);
  const texture = createAvatarTexture(avatar);
  const stickerMaterial = new MeshBasicMaterial({ color: 0xffffff, map: texture ?? undefined });
  const stickers: Mesh[] = [];
  for (const side of [-1, 1]) {
    const sticker = mesh(new CircleGeometry(0.095, 24), stickerMaterial, headWear);
    sticker.position.set(side * (HEAD_R + 0.037), 0.07, -0.03);
    sticker.rotation.y = side * (Math.PI / 2);
    stickers.push(sticker);
  }

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
  // A thumb for the thumbs-up.
  const thumb = mesh(new CapsuleGeometry(0.02, 0.05, 3, 6), skin, armL.hand, 0, -0.05, 0.02);
  thumb.rotation.x = Math.PI;
  thumb.visible = false;

  // Gag props: seaweed that hangs off the helmet and a fish held in the mouth.
  const seaweed: Prop = createSeaweed();
  seaweed.object.position.set(0, HEAD_R + 0.02, 0);
  head.add(seaweed.object);
  seaweed.object.visible = false;
  const fish: Prop = createFish();
  fish.object.position.set(0, -0.06, HEAD_R + 0.02);
  head.add(fish.object);
  fish.object.visible = false;

  const apply = (pose: Pose) => {
    person.position.y = -(HIP_Y + pose.lift) * PERSON_SCALE;
    body.position.y = pose.lift;
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

  // The animator: eases between whatever poses are asked for, so changes of action never snap.
  const current = neutralPose();
  const from = neutralPose();
  const target = neutralPose();
  let blend = 1;
  let blendTime = 0.18;
  let poseName: PoseName = 'ride';
  let faceName: FaceName = 'happy';
  let mode: 'seated' | 'free' = 'seated';
  let yaw = FORWARD;

  const setFace = (face: FaceName) => {
    faceName = face;
    for (const name of Object.keys(faces) as FaceName[]) faces[name].visible = name === face;
  };
  setFace('happy');
  apply(neutralPose());

  return {
    root,
    get mode() {
      return mode;
    },
    setMode(next, seat, world) {
      mode = next;
      (next === 'seated' ? seat : world).add(root);
      root.rotation.order = 'YXZ';
      if (next === 'seated') {
        root.position.set(0, 0, 0);
        root.rotation.set(0, 0, 0);
      }
    },
    setPose(name) {
      if (name === poseName) return;
      poseName = name;
      copyPose(current, from);
      blend = 0;
      blendTime = 0.18;
    },
    setFace(face) {
      if (face !== faceName) setFace(face);
    },
    setProps(showSeaweed, showFish) {
      seaweed.object.visible = showSeaweed;
      fish.object.visible = showFish;
    },
    place(x, y, z, pitch, roll, turn) {
      root.position.set(x, y, z);
      root.rotation.order = 'YXZ';
      root.rotation.set(pitch, turn, -roll);
    },
    setVisible(visible) {
      root.visible = visible;
    },
    update(delta, time) {
      resetPose(target);
      POSES[poseName](target, time);
      blend = Math.min(1, blend + delta / blendTime);
      mixPose(from, target, easeInOut(blend), current);
      apply(current);
      thumb.visible = poseName === 'thumbs';
      seaweed.update(time);
      // Seated riders look ahead; free ones turn towards the camera when floating, else go ahead.
      const goal = mode === 'free' ? (FREE_FACE[poseName] ?? FORWARD) : FORWARD;
      yaw += (goal - yaw) * Math.min(1, delta * 9);
      facing.rotation.y = yaw;
    },
    dispose() {
      texture?.dispose();
      seaweed.dispose();
      fish.dispose();
      stickerMaterial.dispose();
      for (const m of [
        shirt,
        pants,
        skin,
        helmet,
        shoe,
        dark,
        white,
        mouthMaterial,
        strapMaterial,
        vest,
        vestStrap,
        dropMaterial,
        soot,
      ]) {
        m.dispose();
      }
      root.removeFromParent();
    },
  };
}
