/**
 * The props of Raptor Rapids: a Brachiosaurus whose neck bows and who sneezes, a Stegosaurus with
 * three plates that dip as the ski lands on them, and a T. rex leaning in from the shallows with
 * jaws that open in a roar and snap.
 * Painted primitives, built once and only moved. Element-local coordinates: z = -d, x = s.
 */
import {
  ConeGeometry,
  Group,
  SphereGeometry,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { prog } from '../anim';
import { lerp, ribbonMaterial, type Kit } from '../kit';
import {
  NECK,
  REX,
  STEGO,
  T_CHOMP,
  T_CLIP,
  T_CREST,
  T_PLATE,
  T_SNEEZE,
  T_SPIT,
  neckY,
  rexRampY,
  stegoRampY,
} from './raptor-rapids';
import { loft, profile, type LoftRing, type MegaBuilt } from './props-kit';

const GREEN = [0x5fa85a, 0x7cbf68];
const CREAM = 0xf3e6b8;

/** A ball scaled into an ellipsoid. */
function blob(
  kit: Kit,
  parent: Object3D,
  material: Material,
  r: number,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
): Mesh {
  const m = kit.mesh(new SphereGeometry(r, 14, 10), material, parent, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

/** A pair of eyes and a dark pupil on a head facing -z (towards the skier is +z is behind). */
function eyes(kit: Kit, head: Object3D, x: number, y: number, z: number, r: number, dir = -1) {
  const white = kit.lit(0xffffff, 0.3);
  const dark = kit.lit(0x1d2a1d, 0.3);
  for (const side of [-1, 1]) {
    blob(kit, head, white, r, side * x, y, z);
    blob(kit, head, dark, r * 0.55, side * (x + r * 0.15), y, z + dir * r * 0.7);
  }
}

// ---------- The Brachiosaurus ----------

function buildNeck(kit: Kit): MegaBuilt {
  const group = new Group();
  const neck = profile(
    kit,
    group,
    neckY,
    NECK.foot,
    NECK.head,
    0.75,
    -1.2,
    NECK.halfWidth,
    GREEN[0],
    GREEN[1],
  );
  const green = kit.lit(GREEN[0], 0.7);
  const belly = kit.lit(0xb7d078, 0.7);
  // The body stands to one side of the course and the neck loops out of it over the water.
  const body = new Group();
  body.position.set(-6.5, 0, -NECK.top);
  group.add(body);
  blob(kit, body, green, 4.2, 0, 3.2, 0, 1, 0.85, 1.4);
  blob(kit, body, belly, 3.4, 0, 2.4, 0, 1, 0.8, 1.3);
  for (const [x, z] of [
    [-2, -3],
    [2, -3],
    [-2, 3],
    [2, 3],
  ]) {
    kit.mesh(new ConeGeometry(1.0, 3.4, 8), green, body, x, 1.2, z).scale.set(1, 1, 1);
  }
  const stub = blob(kit, group, green, 1.9, -3.4, NECK.topY - 0.8, -NECK.top, 2.2, 1, 1);
  stub.rotation.y = 0;
  // The head at the end of the neck, with a sneeze.
  const head = new Group();
  head.position.set(0, 0, -(NECK.head + 1.2));
  group.add(head);
  blob(kit, head, green, 1.5, 0, 0.5, 0, 1, 0.9, 1.15);
  blob(kit, head, green, 0.95, 0, 0.2, -1.3, 1, 0.9, 1.1);
  blob(kit, head, kit.lit(0x2a3a2a, 0.5), 0.12, 0.3, 0.45, -2.25);
  blob(kit, head, kit.lit(0x2a3a2a, 0.5), 0.12, -0.3, 0.45, -2.25);
  eyes(kit, head, 0.9, 1.0, -0.7, 0.28);
  const cream = kit.lit(CREAM, 0.6);
  for (let i = 0; i < 4; i++)
    blob(
      kit,
      group,
      cream,
      0.5,
      -1.2 * (i % 2 ? 1 : -1) * 0.5,
      neckY(6 + i * 4) + 0.3,
      -(6 + i * 4),
      1,
      0.5,
      1,
    );
  const pose = (time: number, bow: number, sneeze: number) => {
    // The neck sags a little as the ski climbs it, and the head jerks back at the sneeze.
    neck.scale.y = 1 - 0.1 * bow;
    head.position.y = neckY(NECK.head) * (1 - 0.1 * bow) + 0.1 * Math.sin(time * 1.6) * (1 - bow);
    head.rotation.x = 0.7 * sneeze + 0.05 * Math.sin(time * 1.3);
    body.scale.y = 1 + 0.02 * Math.sin(time * 1.8);
  };
  return {
    group,
    update(outcome, t) {
      const bow = outcome === 'clear' ? Math.max(0, 1 - Math.abs(t - T_CREST) / 0.7) : 0;
      // A wind-up back, a snap forward, then it settles.
      const sneeze =
        outcome === 'fail'
          ? prog(t, T_SNEEZE - 0.3, T_SNEEZE, 'o') -
            1.2 * prog(t, T_SNEEZE, T_SNEEZE + 0.35, 'o') +
            0.2 * prog(t, T_SNEEZE + 0.35, T_SNEEZE + 0.9)
          : 0;
      pose(t, bow, sneeze);
    },
    ambient: (time) => pose(time, 0, 0),
    reset: () => pose(0, 0, 0),
  };
}

// ---------- The Stegosaurus ----------

function buildStego(kit: Kit): MegaBuilt {
  const group = new Group();
  profile(
    kit,
    group,
    stegoRampY,
    STEGO.foot,
    STEGO.back,
    0.75,
    -1.2,
    STEGO.halfWidth,
    0x7c9a4a,
    0x93b060,
  );
  const green = kit.lit(0x7c9a4a, 0.7);
  const orange = kit.lit(0xf08a3a, 0.6);
  const cream = kit.lit(CREAM, 0.6);
  // The back, from the neck to the tail, and the head at the water's edge at the near end.
  blob(kit, group, green, 1, 0, 0.5, -17.5, 2.2, 1.5, 9);
  blob(kit, group, green, 1.0, 0, 0.5, -(STEGO.foot - 1.2), 1.1, 0.9, 1.4);
  eyes(kit, group, 0.55, 1.0, -(STEGO.foot - 2.0), 0.18, 1);
  // The tail trails off with two pairs of spikes.
  const tail = new Group();
  tail.position.set(0, 0.8, -26.5);
  group.add(tail);
  kit.mesh(new ConeGeometry(1.1, 7.5, 8), green, tail, 0, 0, -3.2).rotation.x = -Math.PI / 2 - 0.1;
  for (const side of [-1, 1]) {
    for (const z of [-5.6, -6.8]) {
      kit.mesh(new ConeGeometry(0.28, 1.6, 5), cream, tail, side * 0.7, 0.8, z).rotation.z =
        -side * 0.5;
    }
  }
  // Three big plates on the back.
  const plates = STEGO.plates.map((p) => {
    const plate = new Group();
    plate.position.set(0, p.y - 1.5, -p.d);
    group.add(plate);
    const m = blob(kit, plate, orange, 1, 0, 0.75, 0, 0.3, p.y > 3.5 ? 1.6 : 1.4, 1.45);
    blob(kit, plate, cream, 1, 0, 0.75, 0, 0.32, 0.3, 0.5).position.y = 1.2;
    return { plate, base: p.y - 1.5, m };
  });
  const pose = (outcome: 'clear' | 'fail', t: number, time: number) => {
    plates.forEach((p, i) => {
      let dip = 0;
      let tilt = 0;
      const since = t - T_PLATE[i];
      if (since > 0 && (outcome === 'clear' || i === 0)) {
        dip = 0.35 * Math.exp(-6 * since) * (1 + Math.cos(since * 14)) * 0.5;
      }
      if (outcome === 'fail' && i === 1 && t > T_CLIP) {
        const s = t - T_CLIP;
        tilt = 0.25 * Math.exp(-2.5 * s) * Math.sin(s * 12);
        dip = 0.2 * Math.exp(-5 * s);
      }
      p.plate.position.y = p.base - dip + 0.03 * Math.sin(time * 1.5 + i);
      p.plate.rotation.x = tilt;
    });
    tail.rotation.y = 0.12 * Math.sin(time * 1.4);
  };
  return {
    group,
    update: (outcome, t) => pose(outcome, t, t),
    ambient: (time) => pose('clear', -1, time),
    reset: () => pose('clear', -1, 0),
  };
}

// ---------- The T. rex ----------

const REX_SKIN = 0xb86b3e;
const REX_STRIPE = 0x7a3d24;
const REX_BELLY = 0xf2dfae;
const REX_MOUTH = 0xa82a38;
const REX_TONGUE = 0xe8707e;
const REX_TOOTH = 0xfffaf0;
const REX_CLAW = 0x3a2a22;

/** An element-local point from a side position, a height and a distance along the course. */
const sd = (s: number, y: number, d: number): [number, number, number] => [s, y, -d];
const ring = (s: number, y: number, d: number, rx: number, ry: number): LoftRing => ({
  at: sd(s, y, d),
  rx,
  ry,
});
const fract = (n: number) => n - Math.floor(n);

/**
 * The head from the jaw hinge forwards (+z, towards the skier), one row per cross-section: z,
 * centre height, half width, half height. The upper head (the skull and snout) sits on the mouth
 * line y = 0 with a big boxy back and a tapering snout; the lower jaw hangs under it.
 */
const UPPER_HEAD = [
  [-1.1, 1.5, 0.9, 1.0],
  [-0.5, 1.95, 1.6, 1.95],
  [0.6, 1.9, 1.65, 1.9],
  [2.0, 1.6, 1.45, 1.6],
  [3.4, 1.38, 1.28, 1.38],
  [4.8, 1.2, 1.15, 1.22],
  [5.9, 1.05, 1.05, 1.08],
  [6.6, 0.85, 0.7, 0.8],
  [6.85, 0.8, 0.35, 0.4],
] as const;
const LOWER_JAW = [
  [-0.9, -0.55, 0.95, 0.6],
  [-0.3, -0.85, 1.45, 0.95],
  [1.5, -0.75, 1.35, 0.82],
  [3.5, -0.62, 1.18, 0.68],
  [5.2, -0.5, 1.02, 0.55],
  [6.2, -0.4, 0.7, 0.42],
  [6.5, -0.3, 0.35, 0.25],
] as const;

/** Column `col` (1 centre height, 2 half width, 3 half height) of a head table at `z`. */
function headAt(rows: readonly (readonly number[])[], z: number, col: number): number {
  for (let i = 1; i < rows.length; i++) {
    if (z <= rows[i][0]) {
      const k = Math.max(0, (z - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]));
      return lerp(rows[i - 1][col], rows[i][col], k);
    }
  }
  return rows[rows.length - 1][col];
}

const headRings = (rows: readonly (readonly number[])[]): LoftRing[] =>
  rows.map(([z, cy, rx, ry]) => ({ at: [0, cy, z], rx, ry }));

/**
 * A rust-red T. rex with tiger stripes, standing in the shallows just off the course and leaning
 * in: a heavy body on drumstick legs, a long swaying tail, tiny two-fingered arms and a huge boxy
 * head turned to the course with its jaws towards the skier. The whole skull lifts with the upper
 * jaw, so opening the mouth reads as a roar.
 */
function buildRex(kit: Kit): MegaBuilt {
  const group = new Group();
  profile(
    kit,
    group,
    rexRampY,
    REX.foot,
    REX.lip,
    0.75,
    -1.4,
    REX.rampHalfWidth,
    0x8a6a3a,
    0xe3cf9a,
  );
  const painted = ribbonMaterial(kit);
  const skin = kit.lit(REX_SKIN, 0.7);
  const stripe = kit.lit(REX_STRIPE, 0.7);
  const mouth = kit.lit(REX_MOUTH, 0.6);
  const toothMat = kit.lit(REX_TOOTH, 0.35);
  const claw = kit.lit(REX_CLAW, 0.4);
  const coat =
    (stripes: number, to: number) =>
    (u: number, up: number): number =>
      up < -0.3
        ? REX_BELLY
        : up > 0.1 && u > 0.06 && u < to && fract(u * stripes) < 0.38
          ? REX_STRIPE
          : REX_SKIN;
  const claws = (parent: Object3D, x: number, y: number, z: number, r: number, tilt: number) => {
    const m = kit.mesh(new ConeGeometry(r, r * 4, 6), claw, parent, x, y, z);
    m.rotation.x = Math.PI / 2 + tilt;
  };

  // The body leans in from the side of the course: hips out at s = -4.6, the chest closer, and the
  // neck curving in to the head over the middle of the course.
  loft(
    kit,
    group,
    painted,
    [
      ring(-5.3, 6.4, 38.6, 1.5, 1.7),
      ring(-4.7, 6.9, 35.8, 2.5, 2.8),
      ring(-3.9, 6.5, 33.2, 2.65, 3.0),
      ring(-3.0, 6.7, 30.8, 2.2, 2.6),
      ring(-1.9, 7.0, 29.2, 1.6, 1.9),
      ring(-0.8, 6.4, 28.1, 1.4, 1.6),
      ring(-0.1, 5.5, 27.0, 1.15, 1.3),
      ring(0, 5.3, 26.5, 1.0, 1.1),
    ],
    coat(8, 0.72),
  );
  // The tail, swaying from the hips.
  const tail = new Group();
  tail.position.set(...sd(-5.0, 6.5, 37.5));
  group.add(tail);
  loft(
    kit,
    tail,
    painted,
    [
      { at: [0, 0, 0], rx: 1.75, ry: 1.95 },
      { at: [-0.4, -0.3, -3], rx: 1.35, ry: 1.45 },
      { at: [-1.1, -1.0, -6], rx: 0.9, ry: 0.95 },
      { at: [-1.9, -1.9, -9], rx: 0.5, ry: 0.5 },
      { at: [-2.6, -2.6, -11.6], rx: 0.12, ry: 0.12 },
    ],
    coat(6, 0.85),
  );
  // Two big drumstick legs, knee forward, three clawed toes.
  for (const side of [1, -1]) {
    const s = -4.6 + 1.75 * side;
    loft(
      kit,
      group,
      painted,
      [
        ring(s, 6.2, 35.6, 1.5, 1.7),
        ring(s + 0.15 * side, 4.6, 34.6, 1.35, 1.5),
        ring(s, 3.0, 33.7, 0.95, 1.0),
        ring(s, 1.4, 35.0, 0.65, 0.7),
        ring(s, 0.35, 34.2, 0.6, 0.5),
      ],
      () => REX_SKIN,
    );
    blob(kit, group, skin, 1.75, s + 0.15 * side, 4.9, -34.9, 0.75, 1.2, 1.05);
    for (const k of [-1, 0, 1]) {
      blob(kit, group, skin, 0.35, s + k * 0.42, 0.3, -(33.6 + Math.abs(k) * 0.2), 0.8, 0.6, 1.6);
      claws(group, s + k * 0.42, 0.3, -(33.0 + Math.abs(k) * 0.2), 0.13, 0);
    }
  }
  // Tiny arms with two fingers, waving.
  const arms = [1, -1].map((side) => {
    const arm = new Group();
    arm.position.set(...sd(-3.0 + 1.65 * side, 5.4, 30.3));
    group.add(arm);
    const x = 0.4 * side;
    loft(
      kit,
      arm,
      painted,
      [
        { at: [-0.2 * side, 0.3, 0], rx: 0.45, ry: 0.45 },
        { at: [0, 0, 0], rx: 0.4, ry: 0.42 },
        { at: [x, -0.7, 0.3], rx: 0.3, ry: 0.3 },
        { at: [x + 0.1 * side, -0.6, 0.85], rx: 0.24, ry: 0.24 },
      ],
      () => REX_SKIN,
      { steps: 16, sides: 12 },
    );
    for (const k of [-1, 1]) claws(arm, x + 0.1 * side + k * 0.1, -0.68, 1.1, 0.09, 0.5);
    return arm;
  });

  // The head turns on the hinge; the skull and snout lift with the upper jaw.
  const head = new Group();
  head.position.set(0, REX.hinge.y, -REX.hinge.d);
  group.add(head);
  blob(kit, head, mouth, 1.0, 0, 0, -0.4, 1.2, 1.1, 1.0);
  for (const side of [-1, 1]) blob(kit, head, skin, 0.8, side * 1.05, 0.05, -0.55, 0.7, 1.15, 1.1);
  const tooth = (parent: Object3D, x: number, y: number, z: number, h: number, down: boolean) => {
    const m = kit.mesh(
      new ConeGeometry(0.14 + 0.06 * h, h, 6),
      toothMat,
      parent,
      x,
      down ? y - h / 2 : y + h / 2,
      z,
    );
    if (down) m.rotation.x = Math.PI;
  };

  const upper = new Group();
  head.add(upper);
  loft(
    kit,
    upper,
    painted,
    headRings(UPPER_HEAD),
    (u, up) =>
      up < -0.9
        ? REX_MOUTH
        : up > 0.4 && u > 0.08 && u < 0.5 && fract(u * 9) < 0.4
          ? REX_STRIPE
          : REX_SKIN,
    { square: 2.6 },
  );
  [0.55, 0.8, 0.95, 0.8, 0.9, 0.7, 0.55].forEach((h, i) => {
    const z = 0.9 + i * 0.85;
    const y = headAt(UPPER_HEAD, z, 1) - 0.8 * headAt(UPPER_HEAD, z, 3);
    const x = 0.68 * headAt(UPPER_HEAD, z, 2);
    for (const side of [-1, 1]) tooth(upper, side * x, y, z, h, true);
  });
  for (const side of [-1, 1]) tooth(upper, side * 0.32, 0.2, 6.3, 0.6, true);
  // Eyes high on the skull under a heavy brow, and nostrils at the tip of the snout.
  const iris = kit.lit(0xffc93a, 0.3);
  const pupil = kit.lit(0x111111, 0.3);
  const glint = kit.basic(0xffffff);
  for (const side of [-1, 1]) {
    blob(kit, upper, iris, 0.38, side * 1.4, 2.55, 0.9);
    blob(kit, upper, pupil, 0.38, side * 1.5, 2.55, 0.95, 0.4, 0.85, 0.32);
    blob(kit, upper, glint, 0.08, side * 1.76, 2.7, 1.05);
    const brow = blob(kit, upper, stripe, 0.55, side * 1.38, 3.0, 0.85, 0.55, 0.32, 1.25);
    brow.rotation.x = 0.3;
    blob(kit, upper, stripe, 0.14, side * 0.42, 1.95, 6.15, 1, 0.7, 1.2);
  }

  const lower = new Group();
  head.add(lower);
  loft(
    kit,
    lower,
    painted,
    headRings(LOWER_JAW),
    (_u, up) => (up > 0.9 ? REX_MOUTH : up < -0.3 ? REX_BELLY : REX_SKIN),
    { square: 2.6 },
  );
  blob(kit, lower, kit.lit(REX_TONGUE, 0.5), 1, 0, 0.08, 2.4, 0.75, 0.22, 2.0);
  [0.5, 0.7, 0.8, 0.7, 0.6, 0.5].forEach((h, i) => {
    const z = 1.1 + i * 0.9;
    const y = headAt(LOWER_JAW, z, 1) + 0.8 * headAt(LOWER_JAW, z, 3);
    const x = 0.68 * headAt(LOWER_JAW, z, 2);
    for (const side of [-1, 1]) tooth(lower, side * x, y, z, h, false);
  });

  const pose = (open: number, time: number, wave: number, shake = 0) => {
    // Opened about the hinge (x axis): the upper jaw tips up, the lower one down.
    upper.rotation.x = -REX.upperOpen * open;
    lower.rotation.x = REX.lowerOpen * open;
    head.rotation.z = 0.03 * Math.sin(time * 1.5) + shake;
    tail.rotation.y = 0.12 * Math.sin(time * 1.3);
    tail.rotation.x = 0.03 * Math.sin(time * 1.3 + 1);
    arms.forEach((arm, i) => (arm.rotation.x = 0.3 * Math.sin(time * wave + i * 1.4)));
  };
  const clearOpen = (t: number) => 0.85 + 0.15 * Math.sin(t * 9);
  /** How far open the jaws stay with the ski caught between the teeth. */
  const HOLD = 0.75;
  return {
    group,
    update(outcome, t) {
      if (outcome === 'clear') {
        pose(clearOpen(t), t, 12);
        return;
      }
      // Wide open as the ski comes in, snapped on it, shaken, then opened to spit it out.
      const shut = prog(t, T_CHOMP - 0.15, T_CHOMP, 'i');
      const spit = prog(t, T_SPIT, T_SPIT + 0.2, 'o');
      const shake = t > T_CHOMP && t < T_SPIT ? 0.06 * Math.sin((t - T_CHOMP) * 50) : 0;
      pose(1 - (1 - HOLD) * (shut - spit), t, 8, shake);
    },
    ambient: (time) => pose(0.9 + 0.1 * Math.sin(time * 2.2), time, 2.5),
    reset: () => pose(0.9, 0, 2.5),
  };
}

export function buildRaptorRapidsProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildNeck(kit), buildStego(kit), buildRex(kit)];
}
