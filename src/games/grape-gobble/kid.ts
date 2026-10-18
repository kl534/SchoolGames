import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Object3D,
} from 'three';
import {
  eatFrame,
  EAT_CHOMP_AT,
  EAT_SECONDS,
  FOREARM,
  gagFrame,
  GAG_CUES,
  HEAD_REST,
  restFrame,
  SHOULDER_L,
  SHOULDER_R,
  UPPER_ARM,
  type Cue,
  type Eyes,
  type KidFrame,
} from './gags';
import { solveArm, vec3, type Vec3 } from './ik';
import { createGrapeMesh, flat } from './kitchen';
import { GAG_SECONDS, type Gag } from './rules';

const SKIN = 0xe0ac7e;
const SHIRT = 0xffc83d;
const POLE_R = vec3(-0.6, -1, 0);
const POLE_L = vec3(0.6, -1, 0);
/** How much of the head's dive the body follows. */
const DIVE_FOLLOW = 0.85;

type Mode = 'rest' | 'eat' | 'gag' | 'frozen';

export interface Kid {
  object: Object3D;
  /** The frame last shown. */
  readonly frame: KidFrame;
  readonly mode: Mode;
  apply(frame: KidFrame): void;
  update(delta: number, elapsed: number): void;
  /** One chew. Starts from wherever the kid is, so it can start in the middle of another. `onChomp` runs when the grape goes in. */
  eat(onChomp?: () => void): void;
  /** Plays a gag; `onCue` runs for each cue as its time comes, `onDone` when the kid is back at rest. */
  playGag(kind: Gag, onCue: (cue: Cue) => void, onDone: () => void): void;
  /** Stops a gag where it is. A chew in progress is left to finish. */
  freeze(): void;
  /** Back at rest at once, dropping anything in progress. */
  rest(): void;
  /** Shows one frame and holds it (for the dev frame view). */
  setFrame(frame: KidFrame): void;
  headWorld(out: Vector3): Vector3;
  mouthWorld(out: Vector3): Vector3;
}

interface Eye {
  group: Group;
  white: Mesh;
  pupil: Mesh;
  line: Mesh;
  side: -1 | 1;
}

interface Limb {
  group: Group;
  bone: Mesh;
  joint: Mesh;
}

const UP = new Vector3(0, 1, 0);
const tmpA = new Vector3();
const tmpQ = new Quaternion();

function makeLimb(radius: number, color: number): Limb {
  const group = new Group();
  const bone = new Mesh(new CylinderGeometry(radius, radius, 1, 10), flat(color));
  const joint = new Mesh(new SphereGeometry(radius, 10, 8), flat(color));
  group.add(bone, joint);
  return { group, bone, joint };
}

/** Lays a limb between two points: the group sits at `from`, points at `to`, and is as long as the gap. */
function placeLimb(limb: Limb, from: Vec3, to: Vec3) {
  tmpA.set(to.x - from.x, to.y - from.y, to.z - from.z);
  const length = Math.max(tmpA.length(), 1e-4);
  tmpA.divideScalar(length);
  limb.group.position.set(from.x, from.y, from.z);
  limb.group.quaternion.copy(tmpQ.setFromUnitVectors(UP, tmpA));
  limb.bone.position.y = length / 2;
  limb.bone.scale.y = length;
}

function makeEye(side: -1 | 1): Eye {
  const group = new Group();
  group.position.set(side * 0.15, 0.07, 0.36);
  const white = new Mesh(new SphereGeometry(0.075, 14, 10), flat(0xffffff));
  const pupil = new Mesh(new SphereGeometry(0.04, 10, 8), flat(0x111111));
  pupil.position.z = 0.045;
  const line = new Mesh(new BoxGeometry(0.15, 0.014, 0.02), flat(0x3b2417));
  line.position.z = 0.06;
  group.add(white, pupil, line);
  return { group, white, pupil, line, side };
}

function buildDog() {
  const group = new Group();
  const brown = flat(0xb87333);
  const dark = flat(0x8a5522);
  const white = flat(0xffffff);
  const black = flat(0x111111);
  const sphere = (
    r: number,
    material: ReturnType<typeof flat>,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
  ) => {
    const mesh = new Mesh(new SphereGeometry(r, 12, 10), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    group.add(mesh);
    return mesh;
  };
  sphere(0.2, brown, 0, 0.36, 0, 1, 0.9, 1.6);
  sphere(0.13, white, 0, 0.32, 0.2, 1, 1, 0.9);
  sphere(0.17, brown, 0, 0.55, 0.3);
  sphere(0.09, white, 0, 0.5, 0.43, 1, 0.8, 1.1);
  sphere(0.03, black, 0, 0.52, 0.52);
  sphere(0.025, black, -0.07, 0.6, 0.42);
  sphere(0.025, black, 0.07, 0.6, 0.42);
  const earL = sphere(0.07, dark, 0.15, 0.6, 0.27, 0.5, 1.4, 0.8);
  const earR = sphere(0.07, dark, -0.15, 0.6, 0.27, 0.5, 1.4, 0.8);
  earL.rotation.z = -0.4;
  earR.rotation.z = 0.4;
  const jaw = sphere(0.06, flat(0xd96b6b), 0, 0.44, 0.42, 1, 0.6, 1.3);
  for (const x of [-0.1, 0.1]) {
    for (const z of [-0.22, 0.2]) {
      const leg = new Mesh(new CylinderGeometry(0.045, 0.04, 0.26, 8), brown);
      leg.position.set(x, 0.13, z);
      group.add(leg);
      const paw = new Mesh(new SphereGeometry(0.05, 8, 6), white);
      paw.position.set(x, 0.03, z + 0.02);
      paw.scale.set(1, 0.7, 1.3);
      group.add(paw);
    }
  }
  const tail = new Group();
  tail.position.set(0, 0.42, -0.3);
  const tailBone = new Mesh(new CapsuleGeometry(0.035, 0.22, 4, 8), brown);
  tailBone.position.y = 0.12;
  tailBone.rotation.x = 0.3;
  tail.add(tailBone);
  group.add(tail);
  return { group, jaw, tail };
}

export function createKid(): Kid {
  const root = new Group();
  const eyeSides: Eye[] = [makeEye(-1), makeEye(1)];

  // ---------- Body ----------
  const torso = new Group();
  torso.position.set(0, 0.98, -0.6);
  torso.add(new Mesh(new CapsuleGeometry(0.34, 0.5, 6, 18), flat(SHIRT)));
  for (const y of [0.0, 0.16]) {
    const stripe = new Mesh(new TorusGeometry(0.345, 0.04, 8, 28), flat(0x7a4dd8));
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = y - 0.05;
    stripe.scale.set(1, 1, 1);
    torso.add(stripe);
  }
  const napkin = new Mesh(new BoxGeometry(0.34, 0.22, 0.05), flat(0xffffff));
  napkin.position.set(0, 0.5, 0.3);
  napkin.rotation.x = -0.45;
  torso.add(napkin);
  root.add(torso);
  const neck = new Mesh(new CylinderGeometry(0.12, 0.14, 0.3, 12), flat(SKIN));
  neck.position.set(0, 1.4, -0.6);
  root.add(neck);

  // ---------- Head ----------
  const head = new Group();
  head.rotation.order = 'YXZ';
  head.add(new Mesh(new SphereGeometry(0.42, 24, 18), flat(SKIN)));
  const hair = new Mesh(
    new SphereGeometry(0.435, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    flat(0x3b2417),
  );
  hair.rotation.x = -0.75;
  head.add(hair);
  const tuft = new Mesh(new SphereGeometry(0.07, 8, 6), flat(0x3b2417));
  tuft.position.set(0.02, 0.45, 0.13);
  tuft.scale.set(1, 1.4, 1);
  head.add(tuft);
  for (const side of [-1, 1]) {
    const ear = new Mesh(new SphereGeometry(0.09, 10, 8), flat(SKIN));
    ear.position.set(side * 0.42, 0, 0);
    ear.scale.set(0.55, 1, 0.8);
    head.add(ear);
    const blush = new Mesh(new SphereGeometry(0.075, 10, 8), flat(0xff9aa8));
    blush.position.set(side * 0.28, -0.07, 0.3);
    blush.scale.set(1, 0.8, 0.35);
    blush.rotation.y = side * 0.8;
    head.add(blush);
  }
  const nose = new Mesh(new SphereGeometry(0.05, 10, 8), flat(0xd99a6e));
  nose.position.set(0, -0.03, 0.41);
  head.add(nose);
  eyeSides.forEach((eye) => head.add(eye.group));
  const brows = [-1, 1].map((side) => {
    const brow = new Mesh(new BoxGeometry(0.14, 0.03, 0.03), flat(0x3b2417));
    brow.position.set(side * 0.15, 0.2, 0.36);
    head.add(brow);
    return brow;
  });
  const mouthMesh = new Mesh(new SphereGeometry(1, 14, 8), flat(0x4a1a1a));
  mouthMesh.position.set(0, -0.17, 0.375);
  const tongue = new Mesh(new SphereGeometry(1, 10, 6), flat(0xff7a8a));
  tongue.position.set(0, -0.2, 0.385);
  head.add(mouthMesh, tongue);
  const cheeks = [-1, 1].map((side) => {
    const cheek = new Mesh(new SphereGeometry(0.1, 12, 10), flat(SKIN));
    cheek.position.set(side * 0.28, -0.1, 0.28);
    head.add(cheek);
    return cheek;
  });
  const faceGrape = new Mesh(new SphereGeometry(0.13, 12, 10), flat(0x7bd23c));
  const faceShine = new Mesh(new SphereGeometry(0.04, 8, 6), flat(0xe6ffbf));
  faceShine.position.set(-0.05, 0.06, 0.1);
  faceGrape.add(faceShine);
  head.add(faceGrape);
  const hairGrape = createGrapeMesh();
  head.add(hairGrape);
  const dust = new Group();
  for (const [x, y, z, r] of [
    [0, 0, 0, 0.08],
    [0.07, 0.03, 0.02, 0.06],
    [-0.07, 0.02, -0.01, 0.06],
    [0.01, 0.07, 0.03, 0.05],
  ]) {
    const puff = new Mesh(new SphereGeometry(r, 8, 6), flat(0xa8a8a8));
    puff.position.set(x, y, z);
    dust.add(puff);
  }
  head.add(dust);
  root.add(head);

  // ---------- Arms ----------
  const upperR = makeLimb(0.085, SHIRT);
  const foreR = makeLimb(0.075, SKIN);
  const upperL = makeLimb(0.085, SHIRT);
  const foreL = makeLimb(0.075, SKIN);
  const handR = new Mesh(new SphereGeometry(0.1, 12, 10), flat(SKIN));
  const handL = new Mesh(new SphereGeometry(0.1, 12, 10), flat(SKIN));
  root.add(upperR.group, foreR.group, upperL.group, foreL.group, handR, handL);

  // ---------- Props ----------
  const grape = createGrapeMesh();
  grape.visible = false;
  root.add(grape);
  const dogParts = buildDog();
  dogParts.group.visible = false;
  root.add(dogParts.group);

  // ---------- State ----------
  let mode: Mode = 'rest';
  let frame: KidFrame = restFrame();
  let t = 0;
  let from: KidFrame = frame;
  let chomped = true;
  let onChomp: (() => void) | undefined;
  let gag: Gag | null = null;
  let nextCue = 0;
  let onCue: ((cue: Cue) => void) | undefined;
  let onDone: (() => void) | undefined;
  let blinkIn = 3;
  let blinking = 0;
  let clock = 0;

  const setEyes = (state: Eyes, lookX: number, lookY: number) => {
    for (const eye of eyeSides) {
      const closed = state === 'shut' || (state === 'one-shut' && eye.side === -1) || blinking > 0;
      let open = 1;
      let size = 1;
      let cross = 0;
      if (state === 'squint') open = 0.4;
      else if (state === 'wide' || (state === 'one-shut' && eye.side === 1)) size = 1.3;
      else if (state === 'cross') cross = 0.032;
      if (closed) open = 0.08;
      eye.white.scale.set(size, open * size, size);
      eye.pupil.visible = !closed;
      eye.pupil.scale.set(1, open, 1);
      eye.pupil.position.set(
        -eye.side * cross + lookX * 0.025,
        (state === 'cross' ? 0.012 : 0) + lookY * 0.02,
        0.045 * size,
      );
      eye.line.visible = closed;
    }
    brows.forEach((brow, i) => {
      const side = i === 0 ? -1 : 1;
      const raised = state === 'wide' || state === 'cross' ? 0.04 : 0;
      const lowered = state === 'squint' ? 0.03 : 0;
      brow.position.y = 0.2 + raised - lowered;
      brow.rotation.z = state === 'squint' ? side * 0.35 : state === 'cross' ? -side * 0.2 : 0;
    });
  };

  const apply = (f: KidFrame) => {
    frame = f;
    const dive = Math.min(0, f.head.y) * DIVE_FOLLOW;
    // The body ducks with the head, but never pokes out under the cloth: it squashes instead.
    const torsoBottom = 0.39 + 0.06 * Math.min(1, -dive);
    const torsoLength = Math.max(1.57 + dive - torsoBottom, 0.3);
    torso.position.y = torsoBottom + torsoLength / 2;
    torso.scale.y = torsoLength / 1.18;
    neck.position.y = 1.4 + Math.min(0, f.head.y) * 0.9;
    head.position.set(HEAD_REST.x + f.head.x, HEAD_REST.y + f.head.y, HEAD_REST.z + f.head.z);
    head.rotation.set(f.pitch, f.yaw, -f.roll);

    const shoulderR = vec3(SHOULDER_R.x, SHOULDER_R.y + dive, SHOULDER_R.z);
    const shoulderL = vec3(SHOULDER_L.x, SHOULDER_L.y + dive, SHOULDER_L.z);
    const armR = solveArm(shoulderR, f.handR, UPPER_ARM, FOREARM, POLE_R);
    const armL = solveArm(shoulderL, f.handL, UPPER_ARM, FOREARM, POLE_L);
    placeLimb(upperR, shoulderR, armR.elbow);
    placeLimb(foreR, armR.elbow, armR.hand);
    placeLimb(upperL, shoulderL, armL.elbow);
    placeLimb(foreL, armL.elbow, armL.hand);
    handR.position.set(armR.hand.x, armR.hand.y, armR.hand.z);
    handL.position.set(armL.hand.x, armL.hand.y, armL.hand.z);

    setEyes(f.eyes, f.look.x, f.look.y);
    const open = 0.02 + 0.11 * f.mouth;
    mouthMesh.scale.set(0.14, open, 0.03);
    tongue.scale.set(0.085, Math.max(0.0001, open * 0.55), 0.025);
    tongue.visible = f.mouth > 0.12;
    tongue.position.y = -0.17 - open * 0.45;
    cheeks.forEach((cheek, i) => {
      const amount = i === 0 ? f.cheekR : f.cheekL;
      cheek.scale.setScalar(0.001 + amount * 1.45);
    });

    if (f.grape) {
      grape.visible = true;
      grape.position.set(f.grape.pos.x, f.grape.pos.y, f.grape.pos.z);
      const s = Math.max(f.grape.squash, 0.05);
      const wide = 1 / Math.sqrt(s);
      grape.scale.set(wide, wide, s);
    } else {
      grape.visible = false;
    }

    if (f.dog) {
      dogParts.group.visible = true;
      dogParts.group.position.set(f.dog.pos.x, f.dog.pos.y, f.dog.pos.z);
      dogParts.group.rotation.y = f.dog.yaw;
      dogParts.jaw.position.y = 0.44 - 0.06 * f.dog.mouthOpen;
      dogParts.jaw.rotation.x = 0.5 * f.dog.mouthOpen;
      dogParts.tail.rotation.z = Math.sin(clock * 22) * 0.6;
    } else {
      dogParts.group.visible = false;
    }

    if (f.faceGrape) {
      faceGrape.visible = true;
      faceGrape.position.set(f.faceGrape.pos.x, f.faceGrape.pos.y, f.faceGrape.pos.z);
      const s = Math.max(f.faceGrape.size, 0.01);
      faceGrape.scale.set(1.25 * s, 1.1 * s, 0.45 * s);
    } else {
      faceGrape.visible = false;
    }
    hairGrape.visible = f.hairProp?.kind === 'grape';
    dust.visible = f.hairProp?.kind === 'dust';
    if (f.hairProp) {
      const target = f.hairProp.kind === 'grape' ? hairGrape : dust;
      target.position.set(f.hairProp.pos.x, f.hairProp.pos.y, f.hairProp.pos.z);
    }
  };

  const idleFrame = (elapsed: number): KidFrame => {
    const f = restFrame();
    f.head.y = Math.sin(elapsed * 1.4) * 0.02;
    return f;
  };

  const toRest = () => {
    mode = 'rest';
    gag = null;
    onCue = undefined;
    onDone = undefined;
    onChomp = undefined;
    chomped = true;
  };

  const kid: Kid = {
    object: root,
    get frame() {
      return frame;
    },
    get mode() {
      return mode;
    },
    apply,
    update(delta, elapsed) {
      clock = elapsed;
      blinkIn -= delta;
      if (blinking > 0) blinking -= delta;
      if (blinkIn <= 0) {
        blinking = 0.12;
        blinkIn = 2.5 + Math.random() * 2;
      }
      if (mode === 'frozen') {
        apply(frame);
        return;
      }
      if (mode === 'eat') {
        t += delta;
        if (!chomped && t >= EAT_CHOMP_AT) {
          chomped = true;
          onChomp?.();
        }
        if (t >= EAT_SECONDS) {
          toRest();
          apply(idleFrame(elapsed));
        } else {
          apply(eatFrame(t, from));
        }
        return;
      }
      if (mode === 'gag' && gag) {
        t += delta;
        const kind = gag;
        const cues = GAG_CUES[kind];
        while (nextCue < cues.length && cues[nextCue].at <= t) {
          const cue = cues[nextCue++];
          onCue?.(cue);
        }
        if (t >= GAG_SECONDS[kind]) {
          const done = onDone;
          toRest();
          apply(idleFrame(elapsed));
          done?.();
        } else {
          apply(gagFrame(kind, t));
        }
        return;
      }
      apply(idleFrame(elapsed));
    },
    eat(chompCallback) {
      if (mode === 'gag' || mode === 'frozen') return;
      from = structuredClone(frame);
      mode = 'eat';
      t = 0;
      chomped = false;
      onChomp = chompCallback;
      apply(eatFrame(0, from));
    },
    playGag(kind, cueCallback, doneCallback) {
      mode = 'gag';
      gag = kind;
      t = 0;
      nextCue = 0;
      onCue = cueCallback;
      onDone = doneCallback;
      chomped = true;
      apply(gagFrame(kind, 0));
    },
    freeze() {
      if (mode !== 'gag') return;
      mode = 'frozen';
      gag = null;
      onCue = undefined;
      onDone = undefined;
    },
    rest() {
      toRest();
      apply(idleFrame(clock));
    },
    setFrame(next) {
      mode = 'frozen';
      apply(next);
    },
    headWorld(out) {
      return out.set(head.position.x, head.position.y, head.position.z);
    },
    mouthWorld(out) {
      head.updateMatrix();
      return out.set(0, -0.17, 0.38).applyMatrix4(head.matrix);
    },
  };
  apply(frame);
  return kid;
}
