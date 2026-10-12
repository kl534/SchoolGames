import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  type BufferGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Object3D,
} from 'three';

/** Height of the hip pivot when standing up straight. */
const WAIST_Y = 0.98;
const HIP_JOINT_Y = -0.08;
const THIGH = 0.42;
const SHIN = 0.4;
const ANKLE_TO_SOLE = 0.08;
const SHOULDER_X = 0.23;
const SHOULDER_Y = 0.5;
const UPPER_ARM = 0.28;
const FOREARM = 0.25;
/** Wrist to the middle of the glove. */
const HAND = 0.12;
const BALL_RADIUS = 0.2;
const GLOVE_DEPTH = 0.085;
/** The gloves sit this far behind the ball's centre when they touch it. */
const PALM_TO_BALL = BALL_RADIUS * 0.7 + GLOVE_DEPTH / 2;
/** Arm spread that puts the gloves either side of the back of the ball. */
const GLOVES_TOGETHER = -0.13;
/** Lying on the grass after a dive. */
const LYING_Y = 0.22;
/** Balls closer than this to the keeper sideways are caught without diving. */
const DIVE_DISTANCE = 0.7;

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t;

export interface DiveOptions {
  /** Seconds before the keeper reacts. */
  delay?: number;
  /** Catch the ball and gather it to the chest instead of parrying it. */
  hold?: boolean;
}

export interface Goalie {
  object: Object3D;
  /**
   * Dive (or step, crouch or jump) so the gloves are behind a ball whose centre is at
   * `ball`, arriving `duration` s after the delay.
   */
  diveTo(ball: Vector3, duration: number, options?: DiveOptions): void;
  /** Where the centre of a ball held in (or touching) the gloves is right now. */
  ballPosition(out: Vector3): Vector3;
  /** Back to the ready stance in the middle of the goal. */
  reset(): void;
  update(delta: number, elapsed: number): void;
}

/** Every joint angle and the body position; poses are blended field by field. */
interface Pose {
  x: number;
  y: number;
  z: number;
  /** Whole-body sideways lean about the hips (positive leans left, towards -x). */
  roll: number;
  /** Upper body bent forward at the waist. */
  lean: number;
  /** Arms out to the sides (negative brings the hands together). */
  armSpread: number;
  /** Arms swung forward from hanging down (negative is forward). */
  armPitch: number;
  elbow: number;
  legSpread: number;
  /** Thighs swung forward (negative) or back. */
  thigh: number;
  knee: number;
  /** Extra bend in one leg: positive tucks the right (+x) leg, negative the left. */
  tuck: number;
}

const KEYS = Object.keys({
  x: 0,
  y: 0,
  z: 0,
  roll: 0,
  lean: 0,
  armSpread: 0,
  armPitch: 0,
  elbow: 0,
  legSpread: 0,
  thigh: 0,
  knee: 0,
  tuck: 0,
} satisfies Pose) as (keyof Pose)[];

function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const out = { ...a };
  for (const key of KEYS) out[key] = MathUtils.lerp(a[key], b[key], k);
  return out;
}

/** Bends the knees so the feet stay on the grass with the hips at `pose.y`. */
function standOnGround(pose: Pose): Pose {
  const legHeight = (THIGH + SHIN) * Math.cos(pose.legSpread);
  const bend = Math.acos(
    MathUtils.clamp((pose.y + HIP_JOINT_Y - ANKLE_TO_SOLE) / legHeight, 0.25, 1),
  );
  return { ...pose, thigh: -bend, knee: bend * 2 };
}

function readyPose(x: number, y: number, z: number): Pose {
  return standOnGround({
    x,
    y,
    z,
    roll: 0,
    lean: 0.22,
    armSpread: 0.5,
    armPitch: -0.55,
    elbow: 1.25,
    legSpread: 0.2,
    thigh: 0,
    knee: 0,
    tuck: 0,
  });
}

/** The ball tucked against the chest after a catch. */
function holdPose(x: number, z: number): Pose {
  return standOnGround({
    x,
    y: WAIST_Y - 0.06,
    z,
    roll: 0,
    lean: 0.12,
    armSpread: 0.1,
    armPitch: -0.6,
    elbow: 1.5,
    legSpread: 0.16,
    thigh: 0,
    knee: 0,
    tuck: 0,
  });
}

function numberTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.font = 'bold 110px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = '#1f2a44';
  g.strokeText('1', 64, 70);
  g.fillStyle = '#ffffff';
  g.fillText('1', 64, 70);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
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
  g.rotation.order = 'XZY';
  parent.add(g);
  return g;
}

/** A rounded limb hanging down from its joint. */
function limb(parent: Object3D, length: number, radius: number, material: Material): Mesh {
  return mesh(new CapsuleGeometry(radius, length, 4, 12), material, parent, 0, -length / 2);
}

/** A goalkeeper with jointed arms and legs, facing +z (towards the camera). */
export function createGoalie(lineZ: number): Goalie {
  const jersey = new MeshStandardMaterial({ color: 0x7b4fe0, roughness: 0.65 });
  const trim = new MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.7 });
  const shorts = new MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.8 });
  const skin = new MeshStandardMaterial({ color: 0xc68642, roughness: 0.75 });
  const hair = new MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.9 });
  const glove = new MeshStandardMaterial({ color: 0x58e06f, roughness: 0.5 });
  const white = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const dark = new MeshStandardMaterial({ color: 0x151515, roughness: 0.5 });
  const lips = new MeshStandardMaterial({ color: 0x7a3b2e, roughness: 0.8 });

  const root = new Group();
  const body = new Group();
  root.add(body);

  // Hips and shorts
  mesh(new CylinderGeometry(0.19, 0.17, 0.24, 20), shorts, body, 0, -0.04).scale.set(1, 1, 0.72);

  // Upper body bends at the waist.
  const torso = new Group();
  body.add(torso);
  mesh(new CapsuleGeometry(0.16, 0.3, 6, 20), jersey, torso, 0, 0.3).scale.set(1.3, 1, 0.75);
  mesh(new CylinderGeometry(0.075, 0.075, 0.04, 16), trim, torso, 0, 0.56);
  const number = numberTexture();
  if (number) {
    const decal = new MeshStandardMaterial({ map: number, transparent: true, roughness: 0.65 });
    mesh(new PlaneGeometry(0.2, 0.2), decal, torso, 0, 0.32, 0.124);
  }
  mesh(new CylinderGeometry(0.055, 0.06, 0.12, 12), skin, torso, 0, 0.62);

  // Head
  const head = new Group();
  head.position.set(0, 0.79, 0);
  torso.add(head);
  mesh(new SphereGeometry(0.13, 24, 18), skin, head).scale.set(0.95, 1.05, 1);
  const cap = mesh(new SphereGeometry(0.137, 24, 12, 0, Math.PI * 2, 0, 1.3), hair, head, 0, 0.01);
  cap.rotation.x = -0.35;
  mesh(new SphereGeometry(0.03, 10, 8), skin, head, 0, -0.01, 0.13);
  for (const side of [-1, 1]) {
    mesh(new SphereGeometry(0.032, 10, 8), skin, head, side * 0.125, 0).scale.set(0.5, 1, 0.8);
    mesh(new SphereGeometry(0.024, 12, 8), white, head, side * 0.045, 0.025, 0.11);
    mesh(new SphereGeometry(0.013, 10, 8), dark, head, side * 0.045, 0.025, 0.13);
    const brow = mesh(new BoxGeometry(0.05, 0.012, 0.012), hair, head, side * 0.047, 0.065, 0.12);
    brow.rotation.z = side * -0.15;
  }
  mesh(new BoxGeometry(0.055, 0.012, 0.012), lips, head, 0, -0.065, 0.118);

  // Arms: long sleeves, white cuffs and chunky gloves.
  const gloves: Object3D[] = [];
  const arms = [-1, 1].map((side) => {
    const shoulder = joint(torso, side * SHOULDER_X, SHOULDER_Y);
    mesh(new SphereGeometry(0.068, 14, 10), jersey, shoulder);
    limb(shoulder, UPPER_ARM, 0.058, jersey);
    const elbow = joint(shoulder, 0, -UPPER_ARM);
    limb(elbow, FOREARM, 0.052, jersey);
    const wrist = joint(elbow, 0, -FOREARM);
    mesh(new CylinderGeometry(0.06, 0.06, 0.05, 14), white, wrist, 0, -0.01);
    const hand = new Group();
    hand.name = side < 0 ? 'glove-left' : 'glove-right';
    hand.position.set(0, -HAND, 0);
    wrist.add(hand);
    mesh(new CapsuleGeometry(0.065, 0.08, 6, 14), glove, hand).scale.set(1.35, 1, 0.65);
    const thumb = mesh(new CapsuleGeometry(0.026, 0.05, 4, 8), glove, hand, -side * 0.085, 0.02);
    thumb.rotation.z = side * 0.5;
    gloves.push(hand);
    return { shoulder, elbow, side };
  });

  // Legs: shorts, long socks with shin pads, boots.
  const legs = [-1, 1].map((side) => {
    const hip = joint(body, side * 0.1, HIP_JOINT_Y);
    mesh(new CylinderGeometry(0.1, 0.095, 0.2, 14), shorts, hip, 0, -0.07);
    limb(hip, THIGH, 0.082, skin);
    const knee = joint(hip, 0, -THIGH);
    limb(knee, SHIN, 0.068, jersey);
    mesh(new BoxGeometry(0.1, 0.2, 0.03), white, knee, 0, -0.17, 0.065);
    const ankle = joint(knee, 0, -SHIN);
    mesh(new BoxGeometry(0.12, 0.08, 0.26), dark, ankle, 0, -0.04, 0.05);
    mesh(new BoxGeometry(0.124, 0.02, 0.12), white, ankle, 0, -0.02, 0.06);
    return { hip, knee, ankle, side };
  });

  const shadow = new Mesh(
    new CircleGeometry(0.5, 32),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);

  const apply = (p: Pose) => {
    body.position.set(p.x, p.y, p.z);
    body.rotation.z = p.roll;
    torso.rotation.x = p.lean;
    for (const { shoulder, elbow, side } of arms) {
      shoulder.rotation.set(p.armPitch, 0, side * p.armSpread);
      elbow.rotation.x = -p.elbow;
    }
    for (const { hip, knee, ankle, side } of legs) {
      const tuck = Math.max(side * p.tuck, 0);
      hip.rotation.set(p.thigh - tuck, 0, side * p.legSpread);
      knee.rotation.x = p.knee + tuck * 1.6;
      // Keep the boots flat.
      ankle.rotation.set(-(hip.rotation.x + knee.rotation.x), 0, -side * p.legSpread);
    }
    shown = p;
  };

  const tmp = new Vector3();
  /** Midpoint of the gloves in the keeper's own space, for the pose last applied. */
  const glovesMid = (out: Vector3) => {
    root.updateMatrixWorld(true);
    out.set(0, 0, 0);
    for (const g of gloves) out.add(root.worldToLocal(g.getWorldPosition(tmp)));
    return out.multiplyScalar(0.5);
  };

  /** Moves `pose` so the gloves end up right behind `ball`, without sinking into the grass. */
  const placeGloves = (pose: Pose, ball: Vector3): Pose => {
    apply(pose);
    const mid = glovesMid(new Vector3());
    const palms = ball.clone().setZ(ball.z - PALM_TO_BALL);
    const placed = { ...pose, x: pose.x + palms.x - mid.x, y: pose.y + palms.y - mid.y };
    placed.z = pose.z + palms.z - mid.z;
    apply(placed);
    root.updateMatrixWorld(true);
    const lowest = new Box3().setFromObject(body, true).min.y;
    if (lowest < 0) placed.y -= lowest;
    return placed;
  };

  /** Ball close to the keeper: crouch, stand or jump, and raise the arms to its height. */
  const solveUpright = (from: Pose, ball: Vector3): Pose => {
    const jump = Math.max(ball.y - 2.05, 0);
    const pose = standOnGround({
      ...readyPose(from.x, MathUtils.clamp(ball.y + 0.15, 0.45, WAIST_Y) + jump, lineZ),
      lean: MathUtils.clamp(0.8 - 0.6 * ball.y, 0, 0.6),
      armSpread: GLOVES_TOGETHER,
      elbow: 0.25,
      legSpread: 0.22,
    });
    // From hanging straight down, the hands rise as the arms swing forward and up,
    // so bisect for the right height.
    let low = -pose.lean;
    let high = -3.05;
    for (let i = 0; i < 20; i++) {
      pose.armPitch = (low + high) / 2;
      apply(pose);
      if (glovesMid(tmp).y < ball.y) low = pose.armPitch;
      else high = pose.armPitch;
    }
    return placeGloves(pose, ball);
  };

  /** Ball out to the side: launch with the body stretched out towards it, arms overhead. */
  const solveDive = (from: Pose, ball: Vector3): Pose => {
    const roll = MathUtils.clamp(Math.atan2(-(ball.x - from.x), ball.y - 1), -1.75, 1.75);
    return placeGloves(
      {
        ...from,
        roll,
        lean: 0,
        armSpread: GLOVES_TOGETHER,
        armPitch: -2.95,
        elbow: 0.12,
        legSpread: 0.12,
        thigh: 0.1,
        knee: 0.2,
        tuck: Math.sign(roll) * 0.7,
      },
      ball,
    );
  };

  let shown = readyPose(0, WAIST_Y, lineZ);
  let from = shown;
  let to = shown;
  let landing = shown;
  let holding = false;
  let held = 0;
  let t = 0;
  let duration = 0;
  let mode: 'idle' | 'dive' | 'land' | 'down' = 'idle';

  const updateShadow = () => {
    const lift = Math.max(body.position.y - WAIST_Y, 0);
    const flat = Math.abs(Math.sin(body.rotation.z));
    torso.getWorldPosition(tmp);
    shadow.position.set((body.position.x + root.worldToLocal(tmp).x) / 2, 0.012, body.position.z);
    shadow.scale.set(0.6 + flat * 0.9, 0.4, 1);
    (shadow.material as MeshBasicMaterial).opacity = 0.32 * MathUtils.clamp(1 - lift, 0.35, 1);
  };

  apply(shown);
  updateShadow();

  return {
    object: root,
    diveTo(ball, diveDuration, { delay = 0, hold = false } = {}) {
      const start = shown;
      from = { ...start, z: lineZ };
      to =
        Math.abs(ball.x - from.x) < DIVE_DISTANCE
          ? solveUpright(from, ball)
          : solveDive(from, ball);
      const side = Math.abs(to.roll) > 0.3 ? Math.sign(to.roll) : 0;
      if (hold) landing = holdPose(to.x, to.z);
      else if (side) landing = { ...to, y: LYING_Y, roll: side * Math.PI * 0.5, tuck: side * 0.4 };
      else landing = { ...to, y: to.y - Math.max(to.y - WAIST_Y, 0) };
      apply(start);
      holding = hold;
      held = 0;
      t = -delay;
      duration = Math.max(diveDuration, 0.15);
      mode = 'dive';
    },
    ballPosition(out) {
      glovesMid(out);
      // Behind the ball while saving; between the gloves once it is gathered in.
      out.z += PALM_TO_BALL * (1 - held);
      return root.localToWorld(out);
    },
    reset() {
      mode = 'idle';
      holding = false;
      held = 0;
      apply(readyPose(0, WAIST_Y, lineZ));
      updateShadow();
    },
    update(delta, elapsed) {
      if (mode === 'idle') {
        // Bounce and shuffle on the line.
        const pose = readyPose(
          Math.sin(elapsed * 1.7) * 0.3,
          WAIST_Y - 0.08 + Math.abs(Math.sin(elapsed * 3.4)) * 0.04,
          lineZ,
        );
        pose.roll = Math.sin(elapsed * 1.7) * 0.04;
        pose.elbow += Math.sin(elapsed * 3.4) * 0.1;
        apply(pose);
      } else if (mode === 'dive') {
        t += delta;
        if (t > 0) {
          const k = Math.min(t / duration, 1);
          apply(lerpPose(from, to, easeOut(k)));
          if (k >= 1) {
            mode = 'land';
            t = -0.12; // hang in the air for a moment
          }
        }
      } else if (mode === 'land') {
        t += delta;
        const k = Math.min(Math.max(t, 0) / (holding ? 0.45 : 0.35), 1);
        if (holding) held = k;
        apply(lerpPose(to, landing, holding ? easeOut(k) : easeIn(k)));
        if (k >= 1) mode = 'down';
      }
      updateShadow();
    },
  };
}
