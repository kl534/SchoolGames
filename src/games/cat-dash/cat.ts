/**
 * The cat: a rounded body, a head with ears, big eyes, a nose and whiskers, four two-part legs and
 * a seven-segment tail, all built from simple shapes. It faces +x, seen from the side with the
 * head turned a little towards the camera. `apply` poses it from a move's frame.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type Material,
} from 'three';
import { Kit } from './kit';
import type { CatLook } from './looks';
import type { CatFace, CatFrame, CatPose, Coat, Hat } from './moves';

/** Where the body's centre is above the floor when the cat stands. */
export const BODY_Y = 0.5;
const TAIL_SEGMENTS = 7;
const SEGMENT = 0.17;

const COAT_COLORS: Record<Exclude<Coat, 'none' | 'wet' | 'puff'>, number> = {
  flour: 0xffffff,
  foam: 0xf4fbff,
  dust: 0xb8b3ad,
  mud: 0x6b4a2b,
  sand: 0xe6cf93,
  chalk: 0xf2f2f2,
  soot: 0x2a2a2e,
  milk: 0xfdfdf5,
  cement: 0x9a9a9a,
  snow: 0xffffff,
};

interface PoseSpec {
  /** Body height offset from standing, and the nose-up pitch (radians). */
  y: number;
  pitch: number;
  /** Upper leg swing (positive forward) and knee bend for the front and the back legs. */
  front: [upper: number, knee: number];
  back: [upper: number, knee: number];
  /** How far the legs cycle, and how fast per unit of distance (0 = by time instead). */
  amp: number;
  /** Tail curl (positive raises it) and how much it waves. */
  tail: number;
  wave: number;
  /** Head tilt (positive looks up). */
  head: number;
  /** 1 when the cat is curled into a ball. */
  curl?: number;
}

const POSES: Record<CatPose, PoseSpec> = {
  run: {
    y: 0,
    pitch: 0.06,
    front: [0.1, -0.5],
    back: [-0.1, 0.5],
    amp: 0.95,
    tail: 0.5,
    wave: 0.2,
    head: 0,
  },
  trot: {
    y: 0,
    pitch: 0.02,
    front: [0.05, -0.3],
    back: [-0.05, 0.3],
    amp: 0.5,
    tail: 0.9,
    wave: 0.15,
    head: 0,
  },
  crouch: {
    y: -0.22,
    pitch: -0.12,
    front: [0.6, -1.1],
    back: [-0.7, 1.1],
    amp: 0,
    tail: -0.2,
    wave: 0.3,
    head: -0.2,
  },
  leap: {
    y: 0,
    pitch: 0.18,
    front: [1.25, -0.2],
    back: [-1.2, 0.25],
    amp: 0,
    tail: 0,
    wave: 0.1,
    head: 0.2,
  },
  land: {
    y: -0.12,
    pitch: -0.05,
    front: [0.35, -0.7],
    back: [-0.35, 0.7],
    amp: 0,
    tail: 0.3,
    wave: 0.2,
    head: 0,
  },
  slide: {
    y: -0.3,
    pitch: 0,
    front: [1.35, 0],
    back: [-1.1, 0.2],
    amp: 0,
    tail: 0,
    wave: 0.15,
    head: 0.1,
  },
  balance: {
    y: 0,
    pitch: 0,
    front: [0.05, -0.3],
    back: [-0.05, 0.3],
    amp: 0.3,
    tail: 1.3,
    wave: 0.25,
    head: 0,
  },
  climb: {
    y: 0,
    pitch: 1.4,
    front: [1.7, -0.3],
    back: [-0.5, 0.6],
    amp: 0.7,
    tail: -0.2,
    wave: 0.2,
    head: 0.1,
  },
  hang: {
    y: 0,
    pitch: 1.3,
    front: [2.8, 0],
    back: [-0.1, 0.2],
    amp: 0.1,
    tail: -0.4,
    wave: 0.3,
    head: 0.1,
  },
  swing: {
    y: 0,
    pitch: 1.05,
    front: [2.7, 0],
    back: [0.6, -0.5],
    amp: 0.1,
    tail: 0,
    wave: 0.3,
    head: 0.1,
  },
  splat: {
    y: -0.38,
    pitch: 0,
    front: [1.5, 0],
    back: [-1.5, 0],
    amp: 0,
    tail: -0.5,
    wave: 0.05,
    head: -0.35,
  },
  dizzy: {
    y: -0.05,
    pitch: 0.1,
    front: [0.25, -0.2],
    back: [-0.25, 0.2],
    amp: 0,
    tail: 0.4,
    wave: 0.1,
    head: 0,
  },
  curl: {
    y: -0.1,
    pitch: 0,
    front: [1.0, -2.1],
    back: [-1.0, 2.1],
    amp: 0,
    tail: 2.2,
    wave: 0,
    head: -0.5,
    curl: 1,
  },
  surf: {
    y: -0.05,
    pitch: -0.1,
    front: [0.6, -0.4],
    back: [-0.6, 0.4],
    amp: 0,
    tail: 0.8,
    wave: 0.2,
    head: 0,
  },
  sit: {
    y: -0.08,
    pitch: 0.95,
    front: [0.1, 0],
    back: [1.5, -1.1],
    amp: 0,
    tail: -0.3,
    wave: 0.25,
    head: -0.6,
  },
  shake: {
    y: 0,
    pitch: 0,
    front: [0.1, -0.2],
    back: [-0.1, 0.2],
    amp: 0,
    tail: 0.6,
    wave: 0.5,
    head: 0,
  },
  flail: {
    y: 0,
    pitch: 0,
    front: [0.5, -0.4],
    back: [-0.5, 0.4],
    amp: 1.5,
    tail: 0.5,
    wave: 0.6,
    head: 0,
  },
};

/** How far one unit of distance turns the run cycle (radians), and the time-driven rate. */
const STRIDE = 2.4;
const TIME_RATE = 14;

interface Leg {
  upper: Group;
  lower: Group;
}

export interface Cat {
  /** Its origin is on the floor under the body. */
  object: Group;
  setLook(look: CatLook): void;
  /** Poses the cat from a move's frame, `x0` being the obstacle's entry line. */
  apply(frame: CatFrame, x0: number, dt: number): void;
  /** Pose it by hand (the picker's cat and the run along the floor). */
  setPose(pose: CatPose, face?: CatFace): void;
  /** Wiggles the tail and the ears. */
  update(dt: number, elapsed: number): void;
  dispose(): void;
}

export function createCat(initial: CatLook): Cat {
  const kit = new Kit();
  const furMat = new MeshStandardMaterial({ roughness: 0.85, flatShading: false });
  const bellyMat = new MeshStandardMaterial({ roughness: 0.85 });
  const pawMat = new MeshStandardMaterial({ roughness: 0.85 });
  const stripeMat = new MeshStandardMaterial({ roughness: 0.9 });
  const eyeMat = new MeshStandardMaterial({ roughness: 0.3 });
  const noseMat = new MeshStandardMaterial({ roughness: 0.5 });
  const coatMat = new MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.88 });
  // The head is fur or, under a coat, the coat's colour (so the eyes and nose stay in view).
  const headMat = new MeshStandardMaterial({ roughness: 0.85 });
  kit.materials.push(furMat, bellyMat, pawMat, stripeMat, eyeMat, noseMat, coatMat, headMat);
  const patchMats = [0, 1, 2, 3].map(() => {
    const m = new MeshStandardMaterial({ roughness: 0.9 });
    kit.materials.push(m);
    return m;
  });
  const white = kit.lit(0xffffff, 0.4);
  const ink = kit.lit(0x1b1226, 0.5);
  const pink = kit.lit(0xf6a5b8, 0.7);

  const sphere = (r: number, sx: number, sy: number, sz: number, mat: Material, parent: Group) => {
    const m = kit.mesh(new SphereGeometry(r, 18, 14), mat, parent);
    m.scale.set(sx, sy, sz);
    return m;
  };

  const object = new Group();
  // `spin` is at the body's centre, so a somersault turns about the middle of the cat.
  const spin = new Group();
  spin.position.y = BODY_Y;
  object.add(spin);
  const rig = new Group();
  spin.add(rig);

  // ----- Body -----
  const torso = sphere(1, 0.64, 0.33, 0.34, furMat, rig);
  const belly = sphere(1, 0.5, 0.2, 0.3, bellyMat, rig);
  belly.position.set(0.08, -0.13, 0.05);
  const coatBody = sphere(1, 0.7, 0.4, 0.4, coatMat, rig);
  coatBody.visible = false;
  // Stripes across the back.
  const stripes: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const x = -0.42 + i * 0.2;
    const stripe = kit.box(0.07, 0.12, 0.5, stripeMat, rig, x, 0.25 - 0.18 * (x / 0.64) ** 2, 0);
    stripe.rotation.z = -x * 0.45;
    stripes.push(stripe);
  }
  // Calico patches: two on the back (one on each side of the middle), one on the head, one on the tail.
  const backPatches = [0, 1].map((i) => {
    const m = sphere(1, 0.2, 0.17, 0.36, patchMats[i], rig);
    m.position.set(i === 0 ? -0.15 : 0.22, 0.14, 0.02);
    return m;
  });

  // ----- Head -----
  const head = new Group();
  head.position.set(0.66, 0.26, 0);
  head.rotation.y = -0.5;
  rig.add(head);
  sphere(0.28, 1.02, 0.94, 1.05, headMat, head);
  const muzzle = sphere(0.12, 1.1, 0.8, 1, bellyMat, head);
  muzzle.position.set(0.22, -0.08, 0);
  const headPatch = sphere(0.2, 0.9, 0.7, 1.1, patchMats[2], head);
  headPatch.position.set(0.0, 0.12, 0.08);
  const nose = sphere(0.045, 1, 0.8, 1.2, noseMat, head);
  nose.position.set(0.31, -0.03, 0);
  const mouth = sphere(0.06, 0.9, 1, 1.4, ink, head);
  mouth.position.set(0.28, -0.13, 0);
  mouth.visible = false;
  const ears: Group[] = [];
  for (const z of [-0.17, 0.17]) {
    const ear = new Group();
    ear.position.set(-0.02, 0.22, z);
    ear.rotation.x = z > 0 ? -0.3 : 0.3;
    head.add(ear);
    kit.mesh(new ConeGeometry(0.11, 0.24, 4), furMat, ear, 0, 0.1, 0);
    const inner = kit.mesh(new ConeGeometry(0.065, 0.16, 4), pink, ear, 0.03, 0.08, 0);
    inner.rotation.y = 0;
    ears.push(ear);
  }
  // Eyes: white, an iris, a pupil, a glint and an X for a dizzy face.
  const irises: Mesh[] = [];
  const eyeGroups: Group[] = [];
  const crosses: Group[] = [];
  for (const z of [-0.14, 0.14]) {
    const eye = new Group();
    eye.position.set(0.2, 0.07, z);
    eye.rotation.y = z > 0 ? 0.55 : -0.55;
    head.add(eye);
    eyeGroups.push(eye);
    sphere(0.085, 0.5, 1, 1, white, eye);
    const iris = sphere(0.07, 0.4, 0.85, 0.85, eyeMat, eye);
    iris.position.x = 0.03;
    irises.push(iris);
    const pupil = sphere(0.04, 0.4, 1.3, 0.5, ink, eye);
    pupil.position.x = 0.055;
    const glint = sphere(0.018, 0.5, 1, 1, white, eye);
    glint.position.set(0.062, 0.035, 0.015);
    const cross = new Group();
    cross.position.x = 0.06;
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const bar = kit.box(0.02, 0.2, 0.04, ink, cross);
      bar.rotation.x = a;
    }
    cross.visible = false;
    eye.add(cross);
    crosses.push(cross);
  }
  // Whiskers.
  for (const z of [-1, 1]) {
    for (const a of [-0.25, 0, 0.25]) {
      const w = kit.box(0.3, 0.012, 0.012, white, head, 0.3, -0.07 + a * 0.1, z * 0.12);
      w.rotation.y = z * (0.5 + a);
      w.rotation.z = a * 0.6;
    }
  }
  // Foam beard (a coat of foam also gets bubbles on the chin).
  const beard = new Group();
  for (const [x, y, z, r] of [
    [0.18, -0.2, 0.1, 0.07],
    [0.1, -0.26, -0.05, 0.08],
    [0.24, -0.16, -0.08, 0.06],
    [0.02, -0.22, 0.12, 0.06],
    [0.3, -0.12, 0.05, 0.05],
  ]) {
    sphere(r, 1, 1, 1, kit.lit(0xffffff, 0.3), beard).position.set(x, y, z);
  }
  beard.visible = false;
  head.add(beard);
  // Hats sit on top of the head.
  const hats: Record<Exclude<Hat, 'none'>, Group> = {
    cushion: new Group(),
    sock: new Group(),
    duck: new Group(),
    sweater: new Group(),
    lid: new Group(),
    banana: new Group(),
    sheet: new Group(),
    box: new Group(),
    bucket: new Group(),
    seaweed: new Group(),
  };
  for (const g of Object.values(hats)) {
    g.position.set(0, 0.3, 0);
    g.visible = false;
    head.add(g);
  }
  kit.box(0.5, 0.13, 0.42, kit.lit(0xf4d6a0), hats.cushion, 0, 0.04, 0).rotation.z = 0.15;
  sphere(0.035, 1, 1, 1, kit.lit(0xc44a3a), hats.cushion).position.set(0, 0.12, 0);
  const sockTube = kit.mesh(
    new CylinderGeometry(0.1, 0.13, 0.48, 12),
    kit.lit(0xf4f4f4),
    hats.sock,
    0.12,
    0.2,
    0,
  );
  sockTube.rotation.z = -0.9;
  const sockCuff = kit.mesh(
    new CylinderGeometry(0.135, 0.135, 0.09, 12),
    kit.lit(0xe0504a),
    hats.sock,
    0.01,
    0.04,
    0,
  );
  sockCuff.rotation.z = 0;
  sphere(0.19, 1, 0.9, 1, kit.lit(0xffd43b, 0.5), hats.duck).position.set(0, 0.1, 0);
  const beak = kit.mesh(new ConeGeometry(0.06, 0.14, 8), kit.lit(0xff9f1c), hats.duck, 0.2, 0.1, 0);
  beak.rotation.z = -Math.PI / 2;
  kit.box(0.46, 0.2, 0.44, kit.lit(0x4d7fe0, 0.9), hats.sweater, 0, 0.08, 0);
  for (const z of [-0.26, 0.26]) {
    const sleeve = kit.mesh(
      new CylinderGeometry(0.07, 0.07, 0.3, 10),
      kit.lit(0x3f6bc4, 0.9),
      hats.sweater,
      0.1,
      0.0,
      z,
    );
    sleeve.rotation.z = 0.9;
  }
  // A dented bin lid, a banana peel and a ghost-sheet drape.
  const lidDisc = kit.mesh(
    new CylinderGeometry(0.3, 0.3, 0.05, 16),
    kit.lit(0x9aa5ad, 0.4),
    hats.lid,
    0,
    0.05,
    0,
  );
  lidDisc.rotation.z = 0.25;
  kit.mesh(new CylinderGeometry(0.05, 0.05, 0.1, 8), kit.lit(0x555d63, 0.4), hats.lid, 0, 0.12, 0);
  const peel = kit.lit(0xffd93b, 0.6);
  for (const a of [0, 1, 2, 3]) {
    const flap = kit.box(0.3, 0.05, 0.1, peel, hats.banana, 0.02, 0.07, 0);
    flap.rotation.y = (a * Math.PI) / 4;
    flap.rotation.z = a % 2 ? 0.5 : -0.5;
  }
  sphere(0.04, 1, 1, 1, kit.lit(0x6b4a2b, 0.8), hats.banana).position.set(0, 0.12, 0);
  const drape = sphere(0.32, 1, 0.8, 1, kit.lit(0xffffff, 0.9), hats.sheet);
  drape.position.set(-0.02, 0.04, 0);
  for (const z of [-0.3, 0.3])
    kit.box(0.4, 0.28, 0.06, kit.lit(0xffffff, 0.9), hats.sheet, -0.04, -0.12, z);

  // A cereal box, a sand bucket and a drape of seaweed.
  const cardboard = kit.lit(0xe8b04a, 0.7);
  kit.box(0.56, 0.42, 0.5, cardboard, hats.box, 0, 0.14, 0);
  kit.box(0.4, 0.26, 0.02, kit.lit(0xe0504a, 0.6), hats.box, 0.0, 0.14, 0.26);
  kit.box(0.5, 0.03, 0.16, cardboard, hats.box, 0, 0.36, 0.1).rotation.x = -0.5;
  kit.box(0.5, 0.03, 0.16, cardboard, hats.box, 0, 0.36, -0.1).rotation.x = 0.5;
  kit.mesh(
    new CylinderGeometry(0.17, 0.27, 0.34, 14),
    kit.lit(0x3f8fd8, 0.5),
    hats.bucket,
    0,
    0.1,
    0,
  );
  kit.mesh(
    new CylinderGeometry(0.28, 0.28, 0.05, 14),
    kit.lit(0xf2c230, 0.5),
    hats.bucket,
    0,
    -0.06,
    0,
  );
  kit.mesh(
    new TorusGeometry(0.14, 0.015, 6, 12, Math.PI),
    kit.lit(0x9aa5ad, 0.4),
    hats.bucket,
    0,
    0.27,
    0,
  );
  const kelp = kit.lit(0x2f8a46, 0.8);
  sphere(0.2, 1, 0.55, 1, kelp, hats.seaweed).position.set(0, 0.06, 0);
  for (const [x, z, h] of [
    [-0.12, -0.22, 0.5],
    [0.1, -0.24, 0.42],
    [-0.1, 0.22, 0.46],
    [0.12, 0.24, 0.55],
    [0.26, 0.0, 0.3],
  ] as const) {
    kit.box(0.07, h, 0.03, kelp, hats.seaweed, x, 0.02 - h / 2, z);
  }

  // ----- Legs -----
  const makeLeg = (x: number, z: number): Leg => {
    const upper = new Group();
    upper.position.set(x, -0.1, z);
    rig.add(upper);
    const thigh = kit.mesh(new CylinderGeometry(0.085, 0.07, 0.22, 10), furMat, upper, 0, -0.1, 0);
    thigh.scale.z = 0.95;
    const lower = new Group();
    lower.position.y = -0.2;
    upper.add(lower);
    kit.mesh(new CylinderGeometry(0.065, 0.055, 0.2, 10), furMat, lower, 0, -0.08, 0);
    const paw = sphere(0.085, 1.25, 0.8, 1, pawMat, lower);
    paw.position.set(0.03, -0.17, 0);
    return { upper, lower };
  };
  // Far legs first so the near ones draw over them.
  const legs = {
    farFront: makeLeg(0.38, -0.17),
    farBack: makeLeg(-0.38, -0.17),
    nearFront: makeLeg(0.38, 0.17),
    nearBack: makeLeg(-0.38, 0.17),
  };

  // ----- Tail -----
  const tailRoot = new Group();
  tailRoot.position.set(-0.6, 0.04, 0);
  rig.add(tailRoot);
  const tail: Group[] = [];
  let parent: Group = tailRoot;
  let tailPatch: Mesh | null = null;
  for (let i = 0; i < TAIL_SEGMENTS; i++) {
    const seg = new Group();
    if (i > 0) seg.position.x = -SEGMENT;
    parent.add(seg);
    const r = 0.085 - i * 0.006;
    const part = sphere(r, 2.0, 1, 1, furMat, seg);
    part.position.x = -SEGMENT * 0.35;
    if (i === 2) {
      tailPatch = sphere(r * 1.08, 2.0, 1.02, 1.02, patchMats[3], seg);
      tailPatch.position.x = -SEGMENT * 0.35;
    }
    // Rings on a tabby tail.
    if (i % 2 === 1) {
      const ring = kit.mesh(
        new CylinderGeometry(r * 1.03, r * 1.03, 0.05, 10),
        stripeMat,
        seg,
        -SEGMENT * 0.35,
        0,
        0,
      );
      ring.rotation.z = Math.PI / 2;
      ring.userData.stripe = true;
      stripes.push(ring);
    }
    tail.push(seg);
    parent = seg;
  }

  // ----- Coat extras -----
  const spikes = new Group();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spike = kit.mesh(new ConeGeometry(0.06, 0.2, 5), coatMat, spikes);
    spike.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.32, 0.0);
    spike.rotation.z = a - Math.PI / 2;
  }
  spikes.visible = false;
  rig.add(spikes);

  // ----- State -----
  let look: CatLook = initial;
  let pose: CatPose = 'run';
  let face: CatFace = 'happy';
  let coat: Coat = 'none';
  let hat: Hat = 'none';
  let phase = 0;
  let lastX: number | null = null;
  let shakeAmount = 0;
  let rot = 0;

  const furBase = { r: 0, g: 0, b: 0 };
  const paintFur = () => {
    furMat.color.setHex(look.fur);
    furBase.r = furMat.color.r;
    furBase.g = furMat.color.g;
    furBase.b = furMat.color.b;
    headMat.color.copy(furMat.color);
    bellyMat.color.setHex(look.belly);
    const whitePaws = look.id === 'tuxedo' || look.id === 'calico';
    pawMat.color.setHex(whitePaws ? look.belly : look.fur);
    eyeMat.color.setHex(look.eyes);
    noseMat.color.setHex(look.nose);
    stripeMat.color.setHex(look.stripes ?? look.fur);
    stripes.forEach((s) => (s.visible = look.stripes !== null));
    const back = look.patches.filter((p) => p.where === 'back');
    backPatches.forEach((m, i) => {
      const p = back[i];
      m.visible = !!p;
      if (p) patchMats[i].color.setHex(p.color);
    });
    const hp = look.patches.find((p) => p.where === 'head');
    headPatch.visible = !!hp;
    if (hp) patchMats[2].color.setHex(hp.color);
    const tp = look.patches.find((p) => p.where === 'tail');
    if (tailPatch) tailPatch.visible = !!tp;
    if (tp) patchMats[3].color.setHex(tp.color);
  };
  paintFur();

  const applyCoat = () => {
    const none = coat === 'none';
    const wet = coat === 'wet';
    const puff = coat === 'puff';
    coatBody.visible = !none && !wet;
    spikes.visible = puff;
    beard.visible = coat === 'foam';
    const shellScale = puff ? 1.25 : 1;
    coatBody.scale.set(0.7 * shellScale, 0.4 * shellScale, 0.4 * shellScale);
    if (!none && !wet) {
      const c = puff ? look.fur : COAT_COLORS[coat as keyof typeof COAT_COLORS];
      coatMat.color.setHex(c);
      if (puff) coatMat.color.offsetHSL(0, 0, 0.12);
    }
    // A wet cat is dark and thin.
    const k = wet ? 0.55 : 1;
    furMat.color.setRGB(furBase.r * k, furBase.g * k, furBase.b * k);
    headMat.color.copy(none || wet ? furMat.color : coatMat.color);
    torso.scale.set(0.64, wet ? 0.29 : 0.33, wet ? 0.3 : 0.34);
  };

  const applyHat = () => {
    for (const [name, g] of Object.entries(hats)) g.visible = name === hat;
  };

  const applyFace = () => {
    const dizzy = face === 'dizzy';
    const scaleY = face === 'wide' ? 1.35 : face === 'squint' || face === 'sneeze' ? 0.3 : 1;
    eyeGroups.forEach((g, i) => {
      g.scale.set(1, scaleY, face === 'wide' ? 1.3 : 1);
      g.children.forEach((c, k) => {
        if (k < 4) c.visible = !dizzy;
      });
      crosses[i].visible = dizzy;
    });
    void irises;
    mouth.visible = face === 'wide' || face === 'sneeze';
    mouth.scale.set(0.9, face === 'sneeze' ? 1.8 : 1.2, 1.4);
  };
  applyFace();

  const setPoseOnly = (next: CatPose) => {
    pose = next;
  };

  const solve = (elapsed: number) => {
    const spec = POSES[pose];
    const swing = pose === 'flail' ? TIME_RATE * 0.9 : TIME_RATE;
    const cyc = spec.amp > 0 ? Math.sin(phase) * spec.amp : 0;
    const cyc2 = spec.amp > 0 ? Math.sin(phase + Math.PI) * spec.amp : 0;
    const bob = spec.amp > 0 && pose !== 'balance' ? Math.abs(Math.cos(phase)) * 0.04 : 0;
    const wobble = pose === 'dizzy' ? Math.sin(elapsed * 9) * 0.12 : 0;
    const flailPitch = pose === 'flail' ? Math.sin(elapsed * 17) * 0.3 : 0;
    rig.position.y = spec.y + bob;
    rig.rotation.z = spec.pitch + wobble + flailPitch;
    const yaw = pose === 'shake' ? Math.sin(elapsed * 55) * 0.45 * (shakeAmount || 1) : 0;
    rig.rotation.y = yaw;
    const set = (leg: Leg, base: [number, number], offset: number, knee: number) => {
      leg.upper.rotation.z = base[0] + offset;
      leg.lower.rotation.z = base[1] - knee * (spec.amp > 0 ? 0.4 : 0);
    };
    const fa = pose === 'flail' ? Math.sin(phase * 1.3) * spec.amp : cyc;
    const fb = pose === 'flail' ? Math.sin(phase * 1.1 + 2) * spec.amp : cyc2;
    set(legs.nearFront, spec.front, fa, Math.max(0, -Math.cos(phase)));
    set(legs.farFront, spec.front, fb, Math.max(0, Math.cos(phase)));
    set(legs.nearBack, spec.back, fb, Math.max(0, Math.cos(phase)));
    set(legs.farBack, spec.back, fa, Math.max(0, -Math.cos(phase)));
    head.rotation.z = spec.head + (pose === 'dizzy' ? Math.sin(elapsed * 7) * 0.25 : 0);
    head.position.set(spec.curl ? 0.5 : 0.66, spec.curl ? 0.1 : 0.26, 0);
    // Tail: raised by `tail`, waved along its length.
    for (let i = 0; i < TAIL_SEGMENTS; i++) {
      const wave = Math.sin(elapsed * (pose === 'flail' ? 14 : 4) - i * 0.7) * spec.wave;
      tail[i].rotation.z = -(spec.tail / TAIL_SEGMENTS) * (i === 0 ? 1.6 : 1) + wave * 0.35;
    }
    const earFlat = pose === 'leap' || pose === 'slide' || pose === 'splat' ? 1.1 : 0;
    ears.forEach((ear, i) => {
      ear.rotation.x = (i === 1 ? -0.3 : 0.3) * (1 + earFlat);
    });
    void swing;
  };

  let elapsedTime = 0;

  return {
    object,
    setLook(next) {
      look = next;
      paintFur();
      applyCoat();
    },
    setPose(next, nextFace = 'happy') {
      setPoseOnly(next);
      face = nextFace;
      applyFace();
      solve(elapsedTime);
    },
    apply(frame, x0, dt) {
      if (frame.pose === 'shake' && pose !== 'shake') shakeAmount = 1;
      pose = frame.pose;
      if (frame.face !== face) {
        face = frame.face;
        applyFace();
      }
      if (frame.coat !== coat) {
        coat = frame.coat;
        applyCoat();
      }
      if (frame.hat !== hat) {
        hat = frame.hat;
        applyHat();
      }
      const worldX = x0 + frame.x;
      const spec = POSES[pose];
      if (spec.amp > 0 && pose !== 'flail' && pose !== 'balance') {
        // The legs turn with the ground covered.
        if (lastX !== null) phase += Math.abs(worldX - lastX) * STRIDE;
      } else if (spec.amp > 0) {
        phase += dt * TIME_RATE * (pose === 'balance' ? 0.5 : 1);
      }
      lastX = worldX;
      rot = frame.rot;
      object.visible = frame.visible;
      object.position.set(worldX, frame.y, frame.z);
      object.scale.set(frame.sx, frame.sy, 1);
      spin.rotation.z = rot;
      solve(elapsedTime);
    },
    update(dt, elapsed) {
      elapsedTime = elapsed;
      shakeAmount = Math.max(0, shakeAmount - dt * 0.2);
      solve(elapsed);
    },
    dispose() {
      kit.dispose();
      object.removeFromParent();
    },
  };
}
