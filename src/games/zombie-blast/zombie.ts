import {
  AdditiveBlending,
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { fallTime, plankFlight, type Point3 } from './rules';

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

/** How much bigger, wider and longer-armed the brute is than the rest. */
const BRUTE_WIDTH = 1.4;
const BRUTE_ARMS = 1.3;
/** Seconds the whole body flashes white when the brute takes a hit, and it lurches back for. */
const FLASH_TIME = 0.12;
const STAGGER_TIME = 0.4;
/** Seconds a knocked-off armour piece lies on the grass, then takes to fade away. */
const DEBRIS_LIE = 1.5;
const DEBRIS_FADE = 0.4;
/** Height of the grass where armour comes to rest, in world units. */
const DEBRIS_FLOOR = 0.14;

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

/** The brute's armour, in the order it is knocked off. */
export const ARMOUR_ORDER = ['pads', 'chest', 'helmet'] as const;
export type ArmourName = (typeof ARMOUR_ORDER)[number];

export interface ArmourPiece {
  name: ArmourName;
  /** The meshes that make up the piece: two shoulder pads, one plate, one helmet. */
  parts: readonly Object3D[];
  attached: boolean;
}

export interface ZombieOptions {
  /** Build the big armoured boss instead of a regular zombie. */
  brute?: boolean;
}

/** The boss: dark grey-green skin under a torn black shirt. */
export const BRUTE_LOOK: ZombieLook = {
  shirt: 0x2c2a33,
  pants: 0x3a3d33,
  skin: 0x5f7d68,
  hair: 'bald',
  scale: 2.2,
  seed: 0.5,
};

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
  /** `still` holds the pose instead of advancing the walk cycle (the effects keep playing). */
  update(delta: number, still?: boolean): void;
  readonly brute: boolean;
  /** The armour pieces (none on a regular zombie), in the order they come off. */
  readonly armour: readonly ArmourPiece[];
  readonly armourLeft: number;
  /**
   * Knocks the next armour piece off: it flies up and away, lands on the grass and fades out.
   * Returns where it came off (world position), or null when there is no armour left.
   */
  knockOffArmour(out?: Vector3): Vector3 | null;
  /** The whole body flashes white for a moment. */
  flash(): void;
  /** A short lurch backwards, as if hit. */
  stagger(): void;
  /** Called on each heavy footfall of a walking brute. */
  onFootfall: (() => void) | null;
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

/** A soft round glow, made without a canvas so it also works under test. */
function haloTexture(): DataTexture {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - (size - 1) / 2, y - (size - 1) / 2) / (size / 2);
      const a = Math.max(0, 1 - r) ** 2;
      data.set([255, 255, 255, Math.round(a * 255)], (y * size + x) * 4);
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

let halo: DataTexture | undefined;

interface Debris {
  part: Object3D;
  from: Point3;
  velocity: Point3;
  spin: Vector3;
  age: number;
  floor: number;
  /** Materials to fade; the piece owns them so fading one never touches another. */
  materials: Material[];
}

/**
 * A goofy green zombie with arms stretched out in front, facing +z (towards the camera). With
 * `brute` it is the boss: nearly twice the height, hunched and broad, with red eyes and three
 * pieces of armour that come off one by one.
 */
export function createZombie(
  initialLook: ZombieLook = ZOMBIE_LOOKS[0],
  options: ZombieOptions = {},
): Zombie {
  const brute = options.brute === true;
  const W = brute ? BRUTE_WIDTH : 1;
  const ARM = brute ? BRUTE_ARMS : 1;
  const upperArm = UPPER_ARM * ARM;
  const forearm = FOREARM * ARM;
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
  mesh(new CapsuleGeometry(0.2, 0.34, 6, 16), shirt, torso, 0, 0.4).scale.set(
    1.2 * W,
    1,
    brute ? 0.9 : 0.78,
  );
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const tooth = mesh(
      new ConeGeometry(0.055, 0.12, 4),
      shirt,
      torso,
      Math.cos(a) * 0.23 * W,
      0.07,
      Math.sin(a) * (brute ? 0.2 : 0.17),
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
  if (brute) {
    // Glowing red eyes: unlit, with a soft additive halo, so they show through the helmet slit.
    halo ??= haloTexture();
    for (const x of [-0.11, 0.11]) {
      mesh(
        new SphereGeometry(0.058, 12, 8),
        new MeshBasicMaterial({ color: 0xff2a1a }),
        head,
        x,
        0.05,
        0.225,
      );
      const glow = new Sprite(
        new SpriteMaterial({
          map: halo,
          color: 0xff3a22,
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
          fog: false,
        }),
      );
      glow.scale.setScalar(0.34);
      glow.position.set(x, 0.05, 0.3);
      head.add(glow);
    }
  } else {
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
  }
  const brow = mesh(new BoxGeometry(0.14, 0.03, 0.03), hairMat, head, -0.11, 0.2, 0.22);
  brow.rotation.z = -0.3;
  if (brute) {
    mesh(new BoxGeometry(0.14, 0.035, 0.03), hairMat, head, 0.11, 0.17, 0.22).rotation.z = 0.3;
  }
  const mouth = mesh(new SphereGeometry(0.11, 14, 8), mouthMat, head, 0.01, -0.12, 0.22);
  mouth.scale.set(1, 0.4, 0.3);
  mesh(new BoxGeometry(0.045, 0.05, 0.02), white, head, -0.04, -0.09, 0.255);
  mesh(new BoxGeometry(0.045, 0.05, 0.02), white, head, 0.06, -0.09, 0.255);
  if (brute) {
    // Two tusks poking up from the lower jaw.
    for (const x of [-0.09, 0.1]) {
      mesh(new ConeGeometry(0.022, 0.1, 6), white, head, x, -0.08, 0.245);
    }
  }
  const hair = new Group();
  head.add(hair);

  // Arms stretched forward.
  const arms = [-1, 1].map((side) => {
    const shoulder = joint(torso, side * 0.27 * W, SHOULDER_Y - HIP_Y);
    const thick = brute ? 1.3 : 1;
    mesh(new SphereGeometry(0.1 * thick, 12, 8), shirt, shoulder);
    limb(shoulder, upperArm, 0.075 * thick, shirt);
    const elbow = joint(shoulder, 0, -upperArm);
    limb(elbow, forearm, 0.065 * thick, skin);
    mesh(new SphereGeometry(0.1 * thick, 12, 8), skin, elbow, 0, -forearm - 0.04).scale.set(
      1,
      1,
      brute ? 0.9 : 0.7,
    );
    if (brute) {
      // A few crude stitches across the forearm.
      mesh(new BoxGeometry(0.014, 0.2, 0.014), dark, elbow, 0.03, -forearm * 0.5, 0.085);
      for (const y of [0.3, 0.5, 0.7]) {
        mesh(
          new BoxGeometry(0.1, 0.014, 0.014),
          dark,
          elbow,
          0.03,
          -forearm * y,
          0.088,
        ).rotation.z = side * 0.4;
      }
    }
    return { shoulder, elbow, side };
  });

  // Legs, with a stiff shuffle.
  const legs = [-1, 1].map((side) => {
    const hip = joint(body, side * (brute ? 0.16 : 0.11), HIP_Y);
    const thick = brute ? 1.25 : 1;
    limb(hip, THIGH, 0.095 * thick, pants);
    const knee = joint(hip, 0, -THIGH);
    limb(knee, SHIN, 0.08 * thick, pants);
    mesh(new BoxGeometry(0.15 * thick, 0.1, 0.3), shoeMat, knee, 0, -SHIN - 0.04, 0.07);
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

  const hitbox = new Mesh(
    new BoxGeometry(brute ? 1.4 : 1.05, brute ? 2.1 : 2.2, 0.9),
    new MeshBasicMaterial(),
  );
  hitbox.position.y = 1.05;
  hitbox.visible = false;
  root.add(hitbox);

  // ---------- The brute's armour: shoulder pads, chest plate, helmet ----------
  interface Home {
    part: Object3D;
    parent: Object3D;
    position: Vector3;
    quaternion: Quaternion;
    scale: Vector3;
  }
  const armour: ArmourPiece[] = [];
  const homes: Home[] = [];
  const flashable: MeshStandardMaterial[] = [
    skin,
    shirt,
    pants,
    hairMat,
    white,
    dark,
    mouthMat,
    shoeMat,
    patch,
  ];
  const debris: Debris[] = [];
  const pieceMaterials = new Map<ArmourName, Material[]>();

  if (brute) {
    // Dull steel with rust-brown edges and rivets. Each piece has its own copies so it can fade.
    const steelColor = 0x9aa2ac;
    const rustColor = 0x6b3f26;
    const addPiece = (
      name: ArmourName,
      build: (steel: Material, rust: Material) => [Object3D, Object3D][],
    ) => {
      const steel = new MeshStandardMaterial({
        color: steelColor,
        metalness: 0.5,
        roughness: 0.45,
        emissive: 0x1e2227,
        side: DoubleSide,
        transparent: true,
      });
      const rust = new MeshStandardMaterial({
        color: rustColor,
        metalness: 0.3,
        roughness: 0.75,
        transparent: true,
      });
      flashable.push(steel, rust);
      pieceMaterials.set(name, [steel, rust]);
      const parts = build(steel, rust).map(([part, parent]) => {
        parent.add(part);
        homes.push({
          part,
          parent,
          position: part.position.clone(),
          quaternion: part.quaternion.clone(),
          scale: part.scale.clone(),
        });
        return part;
      });
      armour.push({ name, parts, attached: true });
    };

    // 1. Spiked shoulder pads, one rounded plate per shoulder.
    addPiece('pads', (steel, rust) =>
      arms.map(({ shoulder, side }) => {
        const pad = new Group();
        pad.position.set(side * 0.07, 0.1, 0);
        pad.rotation.z = -side * 0.3;
        const dome = mesh(
          new SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          steel,
          pad,
        );
        dome.scale.set(1.1, 0.75, 1.05);
        mesh(new TorusGeometry(0.205, 0.02, 6, 20), rust, pad).rotation.x = Math.PI / 2;
        for (const [x, y, z, tilt] of [
          [0, 0.15, 0, 0],
          [side * 0.1, 0.1, 0.07, -side * 0.5],
          [side * 0.1, 0.1, -0.07, -side * 0.5],
        ]) {
          const spike = mesh(new ConeGeometry(0.04, 0.17, 6), rust, pad, x, y, z);
          spike.rotation.z = tilt;
        }
        return [pad, shoulder] as [Object3D, Object3D];
      }),
    );

    // 2. A curved chest plate with rivets and a couple of dents.
    addPiece('chest', (steel, rust) => {
      const plate = new Group();
      plate.position.set(0, 0.5, 0);
      const front = mesh(
        new CylinderGeometry(0.2, 0.2, 0.4, 24, 1, true, -Math.PI * 0.6, Math.PI * 1.2),
        steel,
        plate,
      );
      front.scale.set(1.78, 1, 1.02);
      mesh(new BoxGeometry(0.035, 0.4, 0.03), rust, plate, 0, 0, 0.2);
      for (const a of [-0.85, -0.55, -0.28, 0.28, 0.55, 0.85]) {
        mesh(
          new SphereGeometry(0.02, 6, 4),
          rust,
          plate,
          Math.sin(a) * 0.356,
          0.16,
          Math.cos(a) * 0.205,
        );
      }
      for (const [x, y] of [
        [-0.17, -0.06],
        [0.12, 0.04],
      ]) {
        mesh(new SphereGeometry(0.055, 8, 6), rust, plate, x, y, 0.2).scale.set(1, 0.8, 0.25);
      }
      return [[plate, torso]];
    });

    // 3. A domed helmet with an eye slit, nose guard, crest and one horn.
    addPiece('helmet', (steel, rust) => {
      const helmet = new Group();
      helmet.position.set(0, 0.02, 0);
      const dome = mesh(new SphereGeometry(0.335, 20, 12, 0, Math.PI * 2, 0, 1.2), steel, helmet);
      dome.scale.set(1.04, 0.95, 1.02);
      mesh(new TorusGeometry(0.3, 0.02, 6, 24), rust, helmet, 0, 0.1, 0).rotation.x = Math.PI / 2;
      mesh(new BoxGeometry(0.055, 0.2, 0.04), steel, helmet, 0, 0.0, 0.318);
      mesh(new BoxGeometry(0.04, 0.12, 0.4), rust, helmet, 0, 0.33, 0);
      const horn = mesh(new ConeGeometry(0.05, 0.24, 8), rust, helmet, -0.27, 0.2, 0);
      horn.rotation.z = 0.9;
      for (const x of [-0.2, 0.2]) {
        mesh(new SphereGeometry(0.02, 6, 4), rust, helmet, x, 0.15, 0.27);
      }
      return [[helmet, head]];
    });
  }

  const armourLeft = () => armour.filter((piece) => piece.attached).length;
  const setEmissive = (on: boolean) => {
    for (const m of flashable) {
      if (on) {
        m.userData.emissive ??= m.emissive.getHex();
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 0.9;
      } else if (m.userData.emissive !== undefined) {
        m.emissive.setHex(m.userData.emissive as number);
        m.emissiveIntensity = 1;
      }
    }
  };
  let flashLeft = 0;
  let staggerLeft = 0;

  let look = initialLook;
  let mode: ZombieMode = 'sway';
  let modeTime = 0;
  let phase = initialLook.seed;
  /** Facing: 0 towards the camera, π away from it. */
  let yaw = 0;
  let lifted = false;
  let lastStep = 0;
  let onFootfall: (() => void) | null = null;

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
    // The brute is hunched forward with its head thrust out and its long arms hanging low.
    torso.rotation.set(brute ? 0.42 : 0.12, 0, 0);
    head.rotation.set(brute ? -0.22 : 0.1, 0, 0);
    mouth.scale.set(1, 0.4, 0.3);
    for (const { shoulder, elbow, side } of arms) {
      shoulder.rotation.set(brute ? -0.35 : -1.45, 0, side * (brute ? 0.2 : 0.06));
      elbow.rotation.set(brute ? -0.25 : -0.15, 0, 0);
    }
    for (const { hip, knee, side } of legs) {
      hip.rotation.set(0, 0, side * 0.05);
      knee.rotation.set(0, 0, 0);
    }
  };

  const pose = (delta: number) => {
    modeTime += delta;
    const speed =
      mode === 'run' || mode === 'charge'
        ? 12
        : mode === 'walk'
          ? brute
            ? 4.2
            : 6.5
          : mode === 'lean'
            ? 9
            : 2.2;
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

    if (brute && (mode === 'walk' || mode === 'sway')) {
      // Heavy stomping: slow, wide steps, arms swinging low, the whole body rolling.
      const walking = mode === 'walk';
      const swing = walking ? 0.3 : 0.05;
      body.position.y = Math.abs(c) * (walking ? 0.09 : 0.015);
      body.rotation.z = s * (walking ? 0.09 : 0.03);
      arms.forEach(({ shoulder, side }) => {
        shoulder.rotation.x = -0.35 + Math.sin(phase + (side > 0 ? 0 : Math.PI)) * swing;
      });
      if (walking) {
        legs.forEach(({ hip, knee, side }) => {
          const p = phase + (side > 0 ? 0 : Math.PI);
          hip.rotation.x = Math.sin(p) * 0.45;
          knee.rotation.x = Math.max(0, -Math.sin(p + 0.8)) * 0.8;
        });
        const step = Math.floor((phase - Math.PI / 2) / Math.PI);
        if (step !== lastStep) {
          lastStep = step;
          onFootfall?.();
        }
      }
    }

    if (staggerLeft > 0 && mode !== 'blast') {
      // Lurches back: chest up, head and arms thrown back, then recovers.
      const k = Math.sin(Math.PI * (1 - staggerLeft / STAGGER_TIME));
      torso.rotation.x -= 0.75 * k;
      head.rotation.x -= 0.4 * k;
      arms.forEach(({ shoulder }) => (shoulder.rotation.x -= 0.9 * k));
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

  /** Armour that has come off flies up and away, lands on the grass, lies a while and fades. */
  const updateDebris = (delta: number) => {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.age += delta;
      const flight = fallTime(d.from.y, d.velocity.y, d.floor);
      const p = plankFlight(d.from, d.velocity, d.age, d.floor);
      d.part.position.set(p.x, p.y, p.z);
      if (d.age < flight)
        d.part.rotation.set(
          d.part.rotation.x + d.spin.x * delta,
          d.part.rotation.y + d.spin.y * delta,
          d.part.rotation.z + d.spin.z * delta,
        );
      const lying = d.age - flight - DEBRIS_LIE;
      const fade = MathUtils.clamp(1 - lying / DEBRIS_FADE, 0, 1);
      d.materials.forEach((m) => (m.opacity = fade));
      if (fade <= 0) {
        d.part.visible = false;
        debris.splice(i, 1);
      }
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
    get brute() {
      return brute;
    },
    armour,
    get armourLeft() {
      return armourLeft();
    },
    get onFootfall() {
      return onFootfall;
    },
    set onFootfall(fn) {
      onFootfall = fn;
    },
    flash() {
      flashLeft = FLASH_TIME;
      setEmissive(true);
    },
    stagger() {
      staggerLeft = STAGGER_TIME;
    },
    knockOffArmour(out = new Vector3()) {
      const piece = armour.find((p) => p.attached);
      if (!piece) return null;
      piece.attached = false;
      const host = root.parent ?? root;
      const materials = pieceMaterials.get(piece.name) ?? [];
      root.updateWorldMatrix(true, true);
      piece.parts.forEach((part, i) => {
        host.attach(part);
        part.getWorldPosition(out);
        const sign = piece.parts.length > 1 ? (i === 0 ? -1 : 1) : Math.random() < 0.5 ? -1 : 1;
        debris.push({
          part,
          from: { x: part.position.x, y: part.position.y, z: part.position.z },
          velocity: {
            x: sign * (1.4 + Math.random() * 1.6),
            y: 4.5 + Math.random() * 1.5,
            z: 1.2 + Math.random() * 1.5,
          },
          spin: new Vector3(
            (Math.random() - 0.5) * 14,
            (Math.random() - 0.5) * 14,
            (Math.random() - 0.5) * 14,
          ),
          age: 0,
          floor: DEBRIS_FLOOR,
          materials,
        });
      });
      const first = piece.parts[0];
      first.getWorldPosition(out);
      return out;
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
      out.z += 0.39 * root.scale.z;
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
      flashLeft = 0;
      staggerLeft = 0;
      lastStep = 0;
      setEmissive(false);
      // Every piece of armour goes back on, whether it is flying, lying or fading.
      debris.length = 0;
      homes.forEach(({ part, parent, position, quaternion, scale }) => {
        parent.add(part);
        part.position.copy(position);
        part.quaternion.copy(quaternion);
        part.scale.copy(scale);
        part.visible = true;
      });
      armour.forEach((piece) => (piece.attached = true));
      pieceMaterials.forEach((list) => list.forEach((m) => (m.opacity = 1)));
      applyLook(next);
      neutral();
    },
    update(delta, still = false) {
      if (flashLeft > 0) {
        flashLeft -= delta;
        if (flashLeft <= 0) setEmissive(false);
      }
      if (staggerLeft > 0) staggerLeft = Math.max(0, staggerLeft - delta);
      updateDebris(delta);
      // Turn to run away, and back round to face the player for the next wave.
      const target = mode === 'run' ? Math.PI : 0;
      yaw = MathUtils.damp(yaw, target, 14, delta);
      root.rotation.y = yaw;
      if (mode === 'freeze' || still) return;
      pose(delta);
    },
  };

  applyLook(initialLook);
  neutral();
  return zombie;
}
