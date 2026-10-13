import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';

const HIP_Y = 0.62;
const THIGH = 0.32;
const SHIN = 0.3;
const SHOULDER_Y = 1.17;
const UPPER_ARM = 0.3;
const FOREARM = 0.28;
const HEAD_Y = 1.44;
const HEAD_RADIUS = 0.28;
/** Height of the body's pivot when lying on its back on the grass. */
const LIE_Y = 0.3;
/** How far the body slides back towards the camera while flying and landing. */
const LIE_SLIDE = 0.8;
const BLAST_FLIGHT = 0.95;
const BLAST_BOUNCE = 0.3;

export type ZombieMode =
  /** Standing and swaying, groaning. */
  | 'sway'
  /** Wobbly shuffle towards the player. */
  | 'walk'
  /** Turned round and fleeing, arms in the air. */
  | 'run'
  /** Charging at the player, arms reaching, to smash through the barricade. */
  | 'charge'
  /** Stopped dead in whatever pose it was in. */
  | 'freeze'
  /** Knocked up by a bomb, landing flat on its back with dizzy stars. */
  | 'blast'
  /** Leaning over the barricade, waving its arms. */
  | 'lean'
  /** Doubled up laughing. */
  | 'laugh';

export interface ZombieLook {
  shirt: number;
  pants: number;
  skin: number;
  hair: 'tuft' | 'bald' | 'spikes' | 'side';
  /** Overall size multiplier. */
  scale: number;
  /** Offsets the walk cycle so a crowd doesn't move in lockstep. */
  seed: number;
}

/** One look per lane: bright shirts that stand out against the dusk. */
export const ZOMBIE_LOOKS: readonly ZombieLook[] = [
  { shirt: 0xff5fa2, pants: 0x4b5fd6, skin: 0x7ed957, hair: 'tuft', scale: 1.15, seed: 0 },
  { shirt: 0xffd43b, pants: 0x7a4bd1, skin: 0x9be15d, hair: 'bald', scale: 1.2, seed: 1.7 },
  { shirt: 0x3cc8ff, pants: 0x35405e, skin: 0x6fd68f, hair: 'spikes', scale: 1.1, seed: 3.1 },
  { shirt: 0xff6b3d, pants: 0x2f7a5a, skin: 0x8fe06a, hair: 'side', scale: 1.16, seed: 4.6 },
];

export interface Zombie {
  /** Place this in the scene; it faces the camera (+z). */
  object: Group;
  /** Invisible, generous box for tap tests. */
  hitbox: Object3D;
  readonly mode: ZombieMode;
  /** Seconds spent in the current mode. */
  readonly modeTime: number;
  setMode(mode: ZombieMode): void;
  /** Where an answer sign should hang: over the lane, just above the head. */
  signAnchor(out: Vector3): Vector3;
  /** Where a bomb lands: the grass just in front of the feet. */
  feetPosition(out: Vector3): Vector3;
  /** Back to standing upright, facing the camera, ready for the next wave. */
  reset(look?: ZombieLook): void;
  update(delta: number): void;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

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

function limb(parent: Object3D, length: number, radius: number, material: Material): Mesh {
  return mesh(new CapsuleGeometry(radius, length, 4, 10), material, parent, 0, -length / 2);
}

function starGeometry(outer: number, inner: number): ExtrudeGeometry {
  const shape = new Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
}

/** A goofy green zombie with arms stretched out in front, facing +z (towards the camera). */
export function createZombie(initialLook: ZombieLook = ZOMBIE_LOOKS[0]): Zombie {
  const skin = new MeshStandardMaterial({ color: initialLook.skin, roughness: 0.7 });
  const shirt = new MeshStandardMaterial({ color: initialLook.shirt, roughness: 0.75 });
  const pants = new MeshStandardMaterial({ color: initialLook.pants, roughness: 0.8 });
  const hairMat = new MeshStandardMaterial({ color: 0x2f4a2a, roughness: 0.9 });
  const white = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const dark = new MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.5 });
  const mouthMat = new MeshStandardMaterial({ color: 0x5a1230, roughness: 0.6 });
  const shoeMat = new MeshStandardMaterial({ color: 0x5b3b24, roughness: 0.8 });
  const patch = new MeshStandardMaterial({ color: 0xfff1d0, roughness: 0.8 });

  const root = new Group();
  const body = new Group();
  body.rotation.order = 'YXZ';
  root.add(body);
  const torso = joint(body, 0, HIP_Y);
  torso.rotation.order = 'XZY';

  // Shirt, with a ragged hem and a tummy poking out.
  mesh(new CapsuleGeometry(0.2, 0.34, 6, 16), shirt, torso, 0, 0.4).scale.set(1.2, 1, 0.78);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const tooth = mesh(
      new ConeGeometry(0.055, 0.12, 4),
      shirt,
      torso,
      Math.cos(a) * 0.23,
      0.07,
      Math.sin(a) * 0.17,
    );
    tooth.rotation.x = Math.PI;
    tooth.rotation.y = a;
  }
  mesh(new SphereGeometry(0.1, 12, 8), skin, torso, 0.06, 0.18, 0.16).scale.set(1, 0.7, 0.5);
  mesh(new BoxGeometry(0.13, 0.11, 0.02), patch, torso, -0.08, 0.5, 0.16).rotation.z = 0.2;

  // Head: big and round, with mismatched eyes and a wonky grin.
  const head = joint(torso, 0, HEAD_Y - HIP_Y);
  mesh(new SphereGeometry(HEAD_RADIUS, 24, 18), skin, head).scale.set(1, 0.95, 0.95);
  mesh(new SphereGeometry(0.075, 12, 8), skin, head, 0, -0.02, HEAD_RADIUS - 0.02);
  const eyes = [
    { x: -0.11, r: 0.095, px: 0.025 },
    { x: 0.12, r: 0.07, px: -0.02 },
  ];
  for (const eye of eyes) {
    mesh(new SphereGeometry(eye.r, 14, 10), white, head, eye.x, 0.08, 0.2);
    mesh(
      new SphereGeometry(eye.r * 0.45, 10, 8),
      dark,
      head,
      eye.x + eye.px,
      0.075,
      0.2 + eye.r * 0.8,
    );
  }
  const brow = mesh(new BoxGeometry(0.14, 0.03, 0.03), hairMat, head, -0.11, 0.2, 0.22);
  brow.rotation.z = -0.3;
  const mouth = mesh(new SphereGeometry(0.11, 14, 8), mouthMat, head, 0.01, -0.12, 0.22);
  mouth.scale.set(1, 0.4, 0.3);
  mesh(new BoxGeometry(0.045, 0.05, 0.02), white, head, -0.04, -0.09, 0.255);
  mesh(new BoxGeometry(0.045, 0.05, 0.02), white, head, 0.06, -0.09, 0.255);
  const hair = new Group();
  head.add(hair);

  // Arms stretched forward.
  const arms = [-1, 1].map((side) => {
    const shoulder = joint(torso, side * 0.27, SHOULDER_Y - HIP_Y);
    mesh(new SphereGeometry(0.1, 12, 8), shirt, shoulder);
    limb(shoulder, UPPER_ARM, 0.075, shirt);
    const elbow = joint(shoulder, 0, -UPPER_ARM);
    limb(elbow, FOREARM, 0.065, skin);
    mesh(new SphereGeometry(0.1, 12, 8), skin, elbow, 0, -FOREARM - 0.04).scale.set(1, 1, 0.7);
    return { shoulder, elbow, side };
  });

  // Legs, with a stiff shuffle.
  const legs = [-1, 1].map((side) => {
    const hip = joint(body, side * 0.11, HIP_Y);
    limb(hip, THIGH, 0.095, pants);
    const knee = joint(hip, 0, -THIGH);
    limb(knee, SHIN, 0.08, pants);
    mesh(new BoxGeometry(0.15, 0.1, 0.3), shoeMat, knee, 0, -SHIN - 0.04, 0.07);
    return { hip, knee, side };
  });

  const shadow = mesh(
    new CircleGeometry(0.42, 24),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
    root,
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;

  // Dizzy stars, only shown while knocked out.
  const stars = new Group();
  stars.visible = false;
  root.add(stars);
  const starGeo = starGeometry(0.13, 0.055);
  const starMat = new MeshBasicMaterial({ color: 0xffe44d });
  const starMeshes = [0, 1, 2].map(() => mesh(starGeo, starMat, stars));

  const hitbox = new Mesh(new BoxGeometry(1.05, 2.2, 0.9), new MeshBasicMaterial());
  hitbox.position.y = 1.05;
  hitbox.visible = false;
  root.add(hitbox);

  let look = initialLook;
  let mode: ZombieMode = 'sway';
  let modeTime = 0;
  let phase = initialLook.seed;
  /** Facing: 0 towards the camera, π away from it. */
  let yaw = 0;
  let lifted = false;

  const buildHair = (kind: ZombieLook['hair']) => {
    hair.clear();
    if (kind === 'tuft') {
      for (const x of [-0.06, 0, 0.07]) {
        const strand = mesh(new CylinderGeometry(0.008, 0.014, 0.18, 6), hairMat, hair, x, 0.33);
        strand.rotation.z = -x * 3;
      }
    } else if (kind === 'spikes') {
      for (const x of [-0.14, -0.05, 0.05, 0.14]) {
        const spike = mesh(new ConeGeometry(0.05, 0.16, 6), hairMat, hair, x, 0.28);
        spike.rotation.z = -x * 2.5;
      }
    } else if (kind === 'side') {
      const flop = mesh(new SphereGeometry(0.16, 12, 8), hairMat, hair, -0.12, 0.2, -0.02);
      flop.scale.set(1, 0.5, 0.9);
      flop.rotation.z = 0.5;
    }
  };

  const applyLook = (next: ZombieLook) => {
    look = next;
    skin.color.setHex(next.skin);
    shirt.color.setHex(next.shirt);
    pants.color.setHex(next.pants);
    buildHair(next.hair);
    root.scale.setScalar(next.scale);
    phase = next.seed;
  };

  /** Resets every joint the animations touch to a neutral standing pose. */
  const neutral = () => {
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    torso.rotation.set(0.12, 0, 0);
    head.rotation.set(0.1, 0, 0);
    mouth.scale.set(1, 0.4, 0.3);
    for (const { shoulder, elbow, side } of arms) {
      shoulder.rotation.set(-1.45, 0, side * 0.06);
      elbow.rotation.set(-0.15, 0, 0);
    }
    for (const { hip, knee, side } of legs) {
      hip.rotation.set(0, 0, side * 0.05);
      knee.rotation.set(0, 0, 0);
    }
  };

  const pose = (delta: number) => {
    modeTime += delta;
    const speed =
      mode === 'run' || mode === 'charge' ? 12 : mode === 'walk' ? 6.5 : mode === 'lean' ? 9 : 2.2;
    phase += delta * speed;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    neutral();

    if (mode === 'walk' || mode === 'run' || mode === 'charge') {
      const sprint = mode !== 'walk';
      const amp = sprint ? 0.9 : 0.5;
      body.position.y = Math.abs(c) * (sprint ? 0.12 : 0.06);
      body.rotation.z = s * (mode === 'charge' ? 0.07 : sprint ? 0.1 : 0.12);
      legs.forEach(({ hip, knee, side }) => {
        const p = phase + (side > 0 ? 0 : Math.PI);
        hip.rotation.x = Math.sin(p) * amp;
        knee.rotation.x = Math.max(0, -Math.sin(p + 0.8)) * (sprint ? 1.3 : 0.7);
      });
      head.rotation.z = Math.sin(phase * 0.5 + 1) * 0.2;
      if (mode === 'run') {
        torso.rotation.x = 0.35;
        arms.forEach(({ shoulder, elbow, side }) => {
          shoulder.rotation.set(-2.7 + Math.sin(phase * 1.3 + side) * 0.45, 0, side * 0.35);
          elbow.rotation.x = -0.3;
        });
        mouth.scale.set(1.1, 1.1, 0.4);
      } else if (mode === 'charge') {
        // Facing the player, leaning in with both arms reaching and grabbing.
        torso.rotation.x = 0.5;
        head.rotation.x = -0.3;
        arms.forEach(({ shoulder, elbow, side }) => {
          shoulder.rotation.set(-1.65 + Math.sin(phase * 1.3 + side * 1.6) * 0.22, 0, side * 0.1);
          elbow.rotation.x = -0.35 + Math.sin(phase * 2.6 + side) * 0.2;
        });
        mouth.scale.set(1.25, 1.5, 0.5);
      } else {
        arms.forEach(({ shoulder, side }) => {
          shoulder.rotation.x = -1.45 + Math.sin(phase * 2 + side) * 0.1;
        });
      }
    } else if (mode === 'sway') {
      body.rotation.z = s * 0.07;
      body.position.y = Math.abs(c) * 0.015;
      head.rotation.z = Math.sin(phase * 0.7 + 1) * 0.22;
      head.rotation.x = 0.1 + Math.sin(phase * 0.5) * 0.08;
      mouth.scale.y = 0.4 + Math.max(0, Math.sin(phase * 0.35)) * 0.35;
      arms.forEach(({ shoulder, side }) => {
        shoulder.rotation.x = -1.4 + Math.sin(phase * 1.3 + side * 1.5) * 0.13;
        shoulder.rotation.z = side * (0.06 + Math.sin(phase * 0.9) * 0.05);
      });
      legs.forEach(({ hip, side }) => (hip.rotation.x = Math.sin(phase * 0.7 + side) * 0.05));
    } else if (mode === 'lean') {
      const lean = Math.min(modeTime / 0.25, 1);
      torso.rotation.x = 0.12 + lean * 0.75;
      head.rotation.x = -0.3 * lean;
      body.position.y = Math.abs(c) * 0.03;
      mouth.scale.set(1.15, 1.2, 0.4);
      arms.forEach(({ shoulder, elbow, side }) => {
        // Both arms flung up and waving over the barricade.
        shoulder.rotation.set(
          -2.3 + Math.sin(phase + side * 1.2) * 0.55,
          0,
          side * (0.2 + Math.max(0, Math.sin(phase * 0.8 + side)) * 0.5),
        );
        elbow.rotation.x = -0.2 + Math.sin(phase * 1.5) * 0.3;
      });
      legs.forEach(({ hip, side }) => (hip.rotation.x = Math.sin(phase * 0.8 + side * 2) * 0.1));
    } else if (mode === 'laugh') {
      const hop = Math.abs(Math.sin(modeTime * 11));
      body.position.y = hop * 0.14;
      torso.rotation.x = -0.35 + Math.sin(modeTime * 22) * 0.04;
      head.rotation.x = -0.45;
      head.rotation.z = Math.sin(modeTime * 9) * 0.1;
      mouth.scale.set(1.3, 1.5, 0.5);
      arms.forEach(({ shoulder, elbow, side }) => {
        shoulder.rotation.set(-0.5, 0, side * 0.2);
        elbow.rotation.x = -1.7;
      });
      legs.forEach(({ hip, knee }) => {
        hip.rotation.x = -0.15;
        knee.rotation.x = 0.2;
      });
    } else if (mode === 'blast') {
      blastPose();
    }
  };

  /** Pops up spinning, lands flat on its back, bounces once and lies there seeing stars. */
  const blastPose = () => {
    const t = modeTime;
    const flying = t < BLAST_FLIGHT;
    const s = Math.min(t / BLAST_FLIGHT, 1);
    const wobble = Math.sin(t * 40) * 0.12;
    let y: number;
    if (flying) {
      y = LIE_Y + 2.6 * 4 * s * (1 - s);
    } else {
      const u = Math.min((t - BLAST_FLIGHT) / BLAST_BOUNCE, 1);
      y = LIE_Y + 0.22 * 4 * u * (1 - u);
    }
    body.position.set(0, y, LIE_SLIDE * easeInOut(s));
    body.rotation.y = s * Math.PI * 4;
    body.rotation.x = -(Math.PI / 2) * easeInOut(s);
    torso.rotation.x = 0;
    head.rotation.set(flying ? 0.3 + wobble : 0.1, 0, 0);
    mouth.scale.set(1.2, 1.5, 0.5);
    const rest = flying ? 0 : Math.min((t - BLAST_FLIGHT) / 0.3, 1);
    arms.forEach(({ shoulder, elbow, side }) => {
      shoulder.rotation.set(
        -0.4 - rest * 0.5 + (flying ? wobble : 0),
        0,
        side * (0.6 + rest * 0.9),
      );
      elbow.rotation.x = -0.3;
    });
    legs.forEach(({ hip, knee, side }) => {
      hip.rotation.set(flying ? wobble * side : 0.05, 0, side * (0.1 + rest * 0.3));
      knee.rotation.x = flying ? 0.5 : 0.1;
    });
    shadow.scale.setScalar(1 - Math.min(y - LIE_Y, 2.4) * 0.25);

    const landed = !flying;
    stars.visible = landed;
    lifted = landed;
    if (landed) {
      // The head ends up at the far end of the body; stars circle above it.
      stars.position.set(0, LIE_Y + 0.62, -HEAD_Y + LIE_SLIDE);
      starMeshes.forEach((star, i) => {
        const a = t * 4.5 + (i / starMeshes.length) * Math.PI * 2;
        star.position.set(Math.cos(a) * 0.42, Math.sin(t * 6 + i) * 0.04, Math.sin(a) * 0.3);
        star.rotation.set(0, 0, t * 3 + i);
      });
    }
  };

  const zombie: Zombie = {
    object: root,
    hitbox,
    get mode() {
      return mode;
    },
    get modeTime() {
      return modeTime;
    },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      modeTime = 0;
      if (next !== 'blast') {
        stars.visible = false;
        lifted = false;
        shadow.scale.setScalar(1);
      }
    },
    signAnchor(out) {
      // Sideways it stays over the lane, so swaying heads don't make neighbouring signs jump about.
      root.getWorldPosition(out);
      const x = out.x;
      const z = out.z;
      head.getWorldPosition(out);
      out.set(x, out.y + HEAD_RADIUS * root.scale.y + (lifted ? 0.65 : 0.05), z);
      return out;
    },
    feetPosition(out) {
      root.getWorldPosition(out);
      out.z += 0.45;
      out.y = 0.12;
      return out;
    },
    reset(next = look) {
      mode = 'sway';
      modeTime = 0;
      yaw = 0;
      lifted = false;
      stars.visible = false;
      shadow.scale.setScalar(1);
      root.visible = true;
      root.rotation.y = 0;
      applyLook(next);
      neutral();
    },
    update(delta) {
      // Turn to run away, and back round to face the player for the next wave.
      const target = mode === 'run' ? Math.PI : 0;
      yaw = MathUtils.damp(yaw, target, 14, delta);
      root.rotation.y = yaw;
      if (mode === 'freeze') return;
      pose(delta);
    },
  };

  applyLook(initialLook);
  neutral();
  return zombie;
}
