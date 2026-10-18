/**
 * The stunt rider: a cartoon kid in a helmet with the player's avatar on it. Built from the
 * Strike Zone kid (capsule limbs, joints to pose, an animator that blends between poses), with a
 * helmet, faces for scared, dizzy and sooty, and the poses a stunt rider needs.
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
import type { FaceName, PoseName } from './stunts';

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

/**
 * Pose for a run cycle: legs and arms swing against each other. `phase` advances with time;
 * `amount` is 0 for standing still and 1 for a full sprint.
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
    p.lean = 0.3;
    p.legL.raise = p.legR.raise = 1.2;
    p.legL.bend = p.legR.bend = 1.7;
    p.legL.out = 0.1;
    p.legR.out = 0.1;
    p.armL.raise = p.armR.raise = 1.25;
    p.armL.bend = p.armR.bend = 0.25;
    p.headPitch = -0.15 + Math.sin(t * 6) * 0.03;
  },
  wheelie(p, t) {
    POSES.ride(p, t);
    p.lean = -0.25;
    p.armL.raise = p.armR.raise = 1.35;
    p.armL.bend = p.armR.bend = 0.1;
    p.headPitch = 0.1;
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
  balance(p, t) {
    POSES.ride(p, t);
    p.lean = 0.1;
    p.armL.raise = p.armR.raise = 0;
    p.armL.out = p.armR.out = 1.5 + Math.sin(t * 5) * 0.12;
    p.armL.bend = p.armR.bend = 0;
  },
  duck(p, t) {
    POSES.ride(p, t);
    p.lean = 0.95;
    p.headPitch = -0.4;
    p.armL.raise = p.armR.raise = 1.5;
  },
  surf(p, t) {
    // Standing on the pegs, knees soft, arms out for balance.
    p.lift = 0.22;
    p.lean = 0.12;
    p.legL.raise = p.legR.raise = 0.45;
    p.legL.bend = p.legR.bend = 0.75;
    p.legL.out = p.legR.out = 0.12;
    p.armL.raise = p.armR.raise = 0.2;
    p.armL.out = p.armR.out = 1.35 + Math.sin(t * 6) * 0.1;
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
  dangle(p, t) {
    p.armL.raise = p.armR.raise = 3.0;
    p.armL.out = p.armR.out = 0.12;
    p.legL.raise = Math.sin(t * 4) * 0.12;
    p.legR.raise = Math.sin(t * 4 + 1) * 0.12;
    p.legL.bend = p.legR.bend = 0.15;
    p.headPitch = -0.2;
  },
  splat(p) {
    // A starfish: arms and legs spread flat.
    p.armL.raise = p.armR.raise = 0.1;
    p.armL.out = p.armR.out = 2.2;
    p.legL.out = p.legR.out = 0.75;
    p.headPitch = 0.1;
  },
  sit(p) {
    // Sitting on the ground, legs out in front, hands propping.
    p.lean = 0.05;
    p.legL.raise = p.legR.raise = 1.45;
    p.legL.bend = p.legR.bend = 0.12;
    p.legL.out = p.legR.out = 0.15;
    p.armL.raise = p.armR.raise = 0.55;
    p.armL.out = p.armR.out = 0.25;
    p.armL.bend = p.armR.bend = 0.3;
  },
  dizzy(p, t) {
    POSES.sit(p, t);
    p.headYaw = Math.sin(t * 5) * 0.4;
    p.headPitch = Math.sin(t * 3) * 0.15;
  },
  run(p, t) {
    runPose(p, t * 14, 1);
  },
  thumbs(p, t) {
    POSES.sit(p, t);
    p.armL.raise = 1.2;
    p.armL.out = 0.55;
    p.armL.bend = 1.5;
    p.lean = 0;
  },
};

/** Which way the free rider faces, by pose: sideways to the camera, or turned towards it. */
const FREE_YAW: Partial<Record<PoseName, number>> = {
  sit: 0.5,
  dizzy: 0.5,
  thumbs: 0.5,
  splat: 0,
  wave: 0.5,
};

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
  /** Add this to the bike's seat (seated) or the scene (free). Its origin is the hips. */
  root: Group;
  mode: 'seated' | 'free';
  /** Seated: parented to the bike's seat. Free: parented to `world`. */
  setMode(mode: 'seated' | 'free', seat: Object3D, world: Object3D): void;
  setPose(name: PoseName): void;
  setFace(face: FaceName): void;
  /** Free mode: where the hips are and how far the body is turned. */
  place(x: number, y: number, rot: number): void;
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
  const skinColor = skin.color.getHex();
  const helmetColor = helmet.color.getHex();

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

  const sooty = joint(head, 0, 0);
  for (const side of [-1, 1]) {
    mesh(new SphereGeometry(0.045, 12, 10), white, sooty, side * 0.075, 0.03, HEAD_R - 0.03);
    mesh(new SphereGeometry(0.018, 8, 6), dark, sooty, side * 0.075, 0.025, HEAD_R + 0.01);
  }
  mesh(new BoxGeometry(0.07, 0.012, 0.01), white, sooty, 0, -0.06, HEAD_R - 0.003);

  const faces: Record<FaceName, Group> = { happy, scared, dizzy, sooty };

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
  let yaw = Math.PI / 2;
  let lastX = 0;
  let heading = 1;

  const setFace = (face: FaceName) => {
    faceName = face;
    for (const name of Object.keys(faces) as FaceName[]) faces[name].visible = name === face;
    const sooted = face === 'sooty';
    skin.color.setHex(sooted ? 0x3d3d44 : skinColor);
    helmet.color.setHex(sooted ? 0x55555c : helmetColor);
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
    place(x, y, rot) {
      root.position.set(x, y, 0);
      root.rotation.set(0, 0, rot);
      heading = x > lastX + 1e-4 ? 1 : x < lastX - 1e-4 ? -1 : heading;
      lastX = x;
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
      // Seated riders look ahead; free ones turn towards the camera for a sit, a splat or a wave.
      let goal = Math.PI / 2;
      if (mode === 'free') {
        goal = FREE_YAW[poseName] ?? (Math.PI / 2) * (poseName === 'run' ? heading : 1);
      }
      yaw += (goal - yaw) * Math.min(1, delta * 9);
      facing.rotation.y = yaw;
    },
    dispose() {
      texture?.dispose();
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
      ]) {
        m.dispose();
      }
      root.removeFromParent();
    },
  };
}
