/**
 * The props of Inferno Drop: a tall red-and-white scaffold ramp, three flaming rings on circus
 * poles, a striped air cushion under the first, a foam pit before the landing ramp. Bright painted
 * primitives like obstacles.ts; everything is built once and only moved.
 */
import { ConeGeometry, CylinderGeometry, Group, Mesh, TorusGeometry, type Vector3 } from 'three';
import { clamp01, lerp, ribbon, ribbonMaterial, smooth, type Kit } from '../kit';
import { TAU } from '../stunts';
import {
  CUSHION,
  FOAM_FLOOR,
  FOAM_FROM,
  FOAM_TO,
  FOAM_Y,
  INFERNO_DROP,
  LAND_FROM,
  LAND_TO,
  landingSurface,
  OFFSETS,
  RAMP_FROM,
  RAMP_LIP,
  RAMP_TOP,
  RING_R,
  RINGS,
  towerRamp,
} from './inferno-drop';
import type { MegaBuilt } from './triple-loop-props';

const RED = 0xe8403a;
const WHITE = 0xf6f6f6;
const GOLD = 0xffcf33;
const STEEL = 0x8791a8;

const [EL1, EL2, EL3] = INFERNO_DROP.elements;

/** How high the flames of a ring flare as the bike passes, and how long they take to settle. */
const FLARE = 0.6;
const FLARE_SETTLE = 0.5;

/** 0 before the beat, a quick rise to 1, then a smooth settle to 0 within `span` seconds. */
const flareAt = (s: number, span: number): number => {
  if (s <= 0 || s >= span) return 0;
  const rise = Math.min(0.06, span / 2);
  return s < rise ? s / rise : 1 - smooth((s - rise) / (span - rise));
};

/** A ring of fire on a striped pole with an arm, in element-local coordinates. */
interface RingProp {
  /** Rocks the ring on its arm (radians about z). */
  rock(angle: number): void;
  /** Flame size: 1 is normal. */
  setFire(fire: number): void;
  flicker(time: number): void;
  reset(): void;
}

function buildRing(kit: Kit, parent: Group, i: 0 | 1 | 2): RingProp {
  const cx = RINGS[i].x - OFFSETS[i];
  const cy = RINGS[i].y;
  // The pole: alternating red and white 0.8 u pieces, behind the road.
  const poleH = cy + RING_R + 0.6;
  const count = Math.ceil(poleH / 0.8);
  const h = poleH / count;
  for (let k = 0; k < count; k++) {
    kit.mesh(
      new CylinderGeometry(0.18, 0.18, h, 10),
      kit.lit(k % 2 ? WHITE : RED, 0.5),
      parent,
      cx,
      h * (k + 0.5),
      -2.0,
    );
  }
  kit.mesh(new CylinderGeometry(0.7, 0.8, 0.2, 16), kit.lit(0x394057, 0.7), parent, cx, 0.1, -2.0);
  // The arm from the pole to the back of the top of the ring.
  kit.box(0.16, 0.16, 1.95, kit.lit(STEEL, 0.5), parent, cx, cy + RING_R + 0.3, -1.03);

  const pivot = new Group();
  pivot.position.set(cx, cy + RING_R, 0);
  parent.add(pivot);
  const root = new Group();
  root.position.y = -RING_R;
  pivot.add(root);
  const yaw = new Group();
  yaw.rotation.y = 0.5;
  root.add(yaw);
  kit.mesh(new TorusGeometry(RING_R - 0.26, 0.26, 12, 40), kit.lit(GOLD, 0.25), yaw);
  const outer = kit.basic(0xff7a1a, 0.9);
  const inner = kit.basic(0xffd84a, 0.95);
  const flames: Mesh[] = [];
  const FLAMES = 22;
  for (let k = 0; k < FLAMES; k++) {
    const a = (k / FLAMES) * TAU;
    const big = k % 2 === 0;
    const flame = kit.mesh(
      new ConeGeometry(big ? 0.28 : 0.2, big ? 1.0 : 0.7, 6),
      big ? outer : inner,
      yaw,
    );
    const r = RING_R - 0.05;
    flame.position.set(-Math.sin(a) * r, Math.cos(a) * r, 0);
    flame.rotation.z = a;
    flame.userData.base = flame.scale.clone();
    flames.push(flame);
  }
  let fire = 1;
  let time = 0;
  const apply = () => {
    flames.forEach((flame, k) => {
      const base = flame.userData.base as Vector3;
      const flick =
        0.75 + 0.35 * Math.sin(time * 11 + k * 1.7) + 0.15 * Math.sin(time * 23 + k * 3.1);
      flame.scale.set(
        base.x * (0.6 + 0.4 * fire),
        base.y * flick * fire,
        base.z * (0.6 + 0.4 * fire),
      );
    });
  };
  return {
    rock: (angle) => (pivot.rotation.z = angle),
    setFire(f) {
      fire = f;
      apply();
    },
    flicker(t) {
      time = t;
      apply();
    },
    reset() {
      pivot.rotation.z = 0;
      fire = 1;
      apply();
    },
  };
}

/** The flare of ring `i` for a cleared element at local time t. */
const clearFire = (beat: number, duration: number, t: number): number =>
  1 + FLARE * flareAt(t - beat, Math.min(FLARE_SETTLE, duration - beat));

// ---------- Element 1: the tower ramp, ring 1 and the air cushion ----------

function buildTop(kit: Kit): MegaBuilt {
  const group = new Group();
  const rib = ribbonMaterial(kit);
  const deckBottom = (x: number) => towerRamp(x) - 0.4;
  kit.mesh(ribbon(towerRamp, RAMP_FROM, RAMP_LIP, 0.4, deckBottom, 1.5, RED, WHITE), rib, group);
  // The scaffold under the deck: grey posts every 2 u, front and back, with cross braces.
  const steel = kit.lit(STEEL, 0.5);
  const posts: number[] = [];
  for (let x = RAMP_FROM + 2; x < RAMP_LIP; x += 2) posts.push(x);
  posts.push(RAMP_LIP - 0.2);
  for (const z of [-1.3, 1.3]) {
    posts.forEach((x, k) => {
      const top = towerRamp(x) - 0.4;
      kit.box(0.2, top, 0.2, steel, group, x, top / 2, z);
      if (k > 0) {
        // A cross brace from the foot of the last post to near the top of this one.
        const px = posts[k - 1];
        const dx = x - px;
        const dy = top - 0.3 - 0.3;
        const brace = kit.box(
          0.1,
          Math.hypot(dx, dy),
          0.1,
          steel,
          group,
          (x + px) / 2,
          0.3 + dy / 2,
          z,
        );
        brace.rotation.z = -Math.atan2(dx, dy);
      }
    });
  }
  // The vertical back face at the lip, with a red band, and two pennants.
  kit.box(
    0.2,
    RAMP_TOP - 0.4,
    3.0,
    kit.lit(0x5c6578, 0.6),
    group,
    RAMP_LIP + 0.1,
    (RAMP_TOP - 0.4) / 2,
    0,
  );
  kit.box(0.22, 0.6, 3.02, kit.lit(RED, 0.5), group, RAMP_LIP + 0.1, RAMP_TOP - 1.2, 0);
  for (const z of [-1.4, 1.4]) {
    kit.mesh(
      new CylinderGeometry(0.04, 0.04, 1.6, 6),
      kit.lit(WHITE, 0.5),
      group,
      RAMP_LIP - 0.4,
      RAMP_TOP + 0.8,
      z,
    );
    const flag = kit.mesh(
      new ConeGeometry(0.28, 0.8, 3),
      kit.lit(0xffd43b, 0.5),
      group,
      RAMP_LIP - 0.1,
      RAMP_TOP + 1.3,
      z,
    );
    flag.rotation.z = -Math.PI / 2;
  }
  const ring = buildRing(kit, group, 0);

  // The air cushion: stripes of yellow and blue shaped like a dome, squashed from the road.
  const cushion = new Group();
  cushion.position.x = (CUSHION.from + CUSHION.to) / 2;
  group.add(cushion);
  const slices = 12;
  const half = (CUSHION.to - CUSHION.from) / 2;
  for (let k = 0; k < slices; k++) {
    const u = ((k + 0.5) / slices) * 2 - 1;
    const h = CUSHION.top * Math.sqrt(Math.max(1 - u ** 4, 0.04));
    kit.box(
      (2 * half) / slices,
      h,
      3.2,
      kit.lit(k % 2 ? 0x2f7de1 : 0xffd43b, 0.45),
      cushion,
      u * half,
      h / 2,
      0,
    );
  }

  const crash = EL1.crash.beats;
  const clearRing = EL1.clear.beats.ring;
  const idle = () => {
    ring.reset();
    cushion.scale.y = 1;
  };
  return {
    group,
    update(outcome, t) {
      idle();
      if (outcome === 'clear') {
        ring.setFire(clearFire(clearRing, EL1.clear.duration, t));
        return;
      }
      const s = t - crash.hook;
      if (s > 0) {
        ring.setFire(1 + 0.3 * flareAt(s, 0.6));
        ring.rock(0.15 * Math.exp(-s / 0.9) * Math.sin(12 * s));
      }
      const squash = Math.max(
        1 - Math.abs(t - crash.land1) / 0.15,
        1 - Math.abs(t - crash.land2) / 0.12,
        0,
      );
      cushion.scale.y = 1 - 0.25 * squash;
    },
    ambient: (time) => ring.flicker(time),
    reset: idle,
  };
}

// ---------- Element 2: ring 2 ----------

function buildMiddle(kit: Kit): MegaBuilt {
  const group = new Group();
  const ring = buildRing(kit, group, 1);
  const crash = EL2.crash.beats;
  return {
    group,
    update(outcome, t) {
      ring.reset();
      if (outcome === 'clear') {
        ring.setFire(clearFire(EL2.clear.beats.ring, EL2.clear.duration, t));
        return;
      }
      // The ring shakes while the bike spins in it, and settles after the drop.
      if (t >= crash.catch) {
        ring.setFire(1.3);
        const spinning = t < crash.drop;
        ring.rock(spinning ? 0.1 * Math.sin(TAU * 6 * (t - crash.catch)) : 0);
        if (!spinning) ring.setFire(1);
      }
    },
    ambient: (time) => ring.flicker(time),
    reset: () => ring.reset(),
  };
}

// ---------- Element 3: ring 3, the foam pit and the landing ramp ----------

const PASTELS = [0xff7ab6, 0x7ad3ff, 0xfff176, 0x9ff0c0] as const;
/** Fixed pseudo-random numbers in [0, 1): the foam is the same every time. */
const rand = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

function buildLow(kit: Kit): MegaBuilt {
  const group = new Group();
  const o = OFFSETS[2];
  const ring = buildRing(kit, group, 2);
  const x0 = FOAM_FROM - o;
  const x1 = FOAM_TO - o;
  const mid = (x0 + x1) / 2;
  const width = x1 - x0;
  // The pit: a dark back wall, then an opaque block of foam up to FOAM_Y that hides what sinks in.
  kit.box(width, 3.2, 0.2, kit.lit(0x2e2a3a, 1), group, mid, (FOAM_FLOOR + 0.8) / 2, -3.0);
  kit.box(
    width,
    FOAM_Y - FOAM_FLOOR,
    4.2,
    kit.lit(0xf4c6dc, 0.9),
    group,
    mid,
    (FOAM_Y + FOAM_FLOOR) / 2,
    -0.9,
  );
  const cubes: { mesh: Mesh; x: number; y: number; z: number; jump: number }[] = [];
  const size = 0.35;
  for (let k = 0; k < 30; k++) {
    const front = k >= 22;
    let x = x0 + 0.2 + rand(k * 3 + 1) * (width - 0.4);
    // Keep the top clear of the rider's helmet, which pokes out near x = 9.4.
    if (!front && Math.abs(x - 9.4) < 0.6) x += x < 9.4 ? -0.7 : 0.7;
    const z = front ? 1.25 : -2.4 + rand(k * 3 + 2) * 3.4;
    const y = front
      ? FOAM_FLOOR + 0.3 + rand(k * 3 + 3) * (FOAM_Y - FOAM_FLOOR - 0.6)
      : FOAM_Y + size / 2 - 0.02;
    const mesh = kit.box(size, size, size, kit.lit(PASTELS[k % 4], 0.9), group, x, y, z);
    mesh.rotation.set(rand(k) * 0.8, rand(k + 9) * 3, rand(k + 5) * 0.8);
    cubes.push({ mesh, x, y, z, jump: front ? 0 : k % 4 === 0 ? 1 : 0 });
  }
  // The landing ramp: a wedge with a vertical face at LAND_FROM.
  const rib = ribbonMaterial(kit);
  kit.mesh(
    ribbon((x) => landingSurface(x + o), LAND_FROM - o, LAND_TO - o, 0.5, 0, 1.5, RED, WHITE),
    rib,
    group,
  );
  const crash = EL3.crash.beats;
  const clearRing = EL3.clear.beats.ring;
  const home = () =>
    cubes.forEach((c) => {
      c.mesh.position.set(c.x, c.y, c.z);
    });
  home();
  return {
    group,
    update(outcome, t) {
      ring.reset();
      home();
      if (outcome === 'clear') {
        ring.setFire(clearFire(clearRing, EL3.clear.duration, t));
        return;
      }
      const s = t - crash.clip;
      if (s > 0) {
        ring.setFire(1 + 0.3 * flareAt(s, 0.6));
        ring.rock(-0.25 * Math.exp(-s / 0.5) * Math.sin(9 * s));
      }
      // A few cubes jump up out of the foam when the bike dives in.
      const d = (t - crash.dive) / 0.7;
      if (d > 0 && d < 1) {
        cubes.forEach((c, k) => {
          if (!c.jump) return;
          const lift = Math.sin(Math.PI * d) * (1.2 + 0.4 * (k % 3));
          c.mesh.position.set(c.x + (rand(k) - 0.5) * 1.2 * d, c.y + lift, c.z);
          c.mesh.rotation.z = lerp(0, 3, clamp01(d));
        });
      }
    },
    ambient: (time) => ring.flicker(time),
    reset() {
      ring.reset();
      home();
    },
  };
}

/** The three elements of Inferno Drop, in order. */
export function buildInfernoDropProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildTop(kit), buildMiddle(kit), buildLow(kit)];
}
