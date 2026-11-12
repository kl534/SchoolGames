/**
 * The props of Ice Slide: a glossy ice ramp with a snowbank at its foot, a wall of three snowmen
 * (the last one a giant in the crash) and an igloo to jump over onto an ice rink. Pale blue and
 * white with a few warm accents (red scarves, orange carrots); everything is built once and only
 * moved. Snow drifts down in all three.
 */
import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { ribbon, type Kit } from '../kit';
import { bump } from './anim';
import {
  BANK,
  BLOCK,
  ICE_SLIDE,
  IGLOO,
  iceBlockAt,
  iceSurface,
  iglooSurface,
  KICK,
  RINK_FROM,
  snowPieceAt,
} from './ice-slide';
import type { MegaBuilt } from './triple-loop-props';

const RAMP_CRASH = ICE_SLIDE.elements[0].crash;
const IGLOO_CRASH = ICE_SLIDE.elements[2].crash;

const SNOW = 0xffffff;
const ICE = 0xc4ecff;
const ICE_2 = 0xa6dcf7;
const COAL = 0x23262e;

/** A glossy vertex-coloured material for the ice. */
function iceMaterial(kit: Kit): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.12,
    metalness: 0.1,
    side: DoubleSide,
  });
  kit.materials.push(m);
  return m;
}

/** A mound of snow: the top half of a ball, squashed to `h` tall, `w` wide, `d` deep. */
function mound(kit: Kit, parent: Group, x: number, z: number, w: number, h: number, d: number) {
  const m = kit.mesh(
    new SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    kit.lit(SNOW, 0.9),
    parent,
    x,
    0,
    z,
  );
  m.scale.set(w, h, d);
  return m;
}

/** A snowy pine: a trunk and three cones, each capped with white. */
function pine(kit: Kit, parent: Group, x: number, z: number, h: number): void {
  kit.mesh(
    new CylinderGeometry(0.12, 0.16, h * 0.25, 6),
    kit.lit(0x6a4a34, 0.9),
    parent,
    x,
    h * 0.12,
    z,
  );
  const green = kit.lit(0x2f7a58, 0.8);
  const cap = kit.lit(SNOW, 0.9);
  for (let i = 0; i < 3; i++) {
    const r = h * (0.34 - i * 0.08);
    const y = h * (0.3 + i * 0.22);
    kit.mesh(new ConeGeometry(r, h * 0.36, 8), green, parent, x, y + h * 0.1, z);
    kit.mesh(new ConeGeometry(r * 0.62, h * 0.2, 8), cap, parent, x, y + h * 0.19, z + 0.02);
  }
}

/** Snowflakes drifting down over `width` units: returns the idle motion. */
function snowfall(kit: Kit, parent: Group, width: number): (time: number) => void {
  const mat = kit.basic(SNOW);
  const geo = new SphereGeometry(0.07, 6, 4);
  kit.geometries.push(geo);
  const flakes = Array.from({ length: 14 }, (_, i) => {
    const m = new Mesh(geo, mat);
    parent.add(m);
    return { m, x: (i * 7.3) % width, z: -2.2 + ((i * 5) % 7) * 0.55, phase: (i * 0.37) % 1 };
  });
  return (time) => {
    for (const f of flakes) {
      const u = (time * 0.12 + f.phase) % 1;
      f.m.position.set(f.x + 0.5 * Math.sin(time * 0.8 + f.phase * 9), 6.2 - u * 6.0, f.z);
    }
  };
}

// ---------- Element 1: Ice Ramp ----------

function buildRamp(kit: Kit): MegaBuilt {
  const group = new Group();
  kit.mesh(ribbon(iceSurface, 2, 16, 0.5, 0, 1.5, ICE, ICE_2), iceMaterial(kit), group);
  // Sparkles on the side of the ice.
  const spark = kit.basic(SNOW);
  const sparkles = [3.4, 5.1, 6.6, 8.2, 10.6, 12.4, 14.0].map((x, i) => {
    const m = kit.box(0.2, 0.2, 0.02, spark, group, x, iceSurface(x) * 0.5 + 0.12, 1.52);
    m.rotation.z = Math.PI / 4;
    return { m, phase: i * 0.7 };
  });
  mound(kit, group, 4, -2.0, 2.4, 1.1, 0.9);
  mound(kit, group, 11.5, -2.3, 3.2, 1.5, 1.0);
  mound(kit, group, 19, -2.2, 2.6, 1.2, 0.9);
  pine(kit, group, 7, -2.4, 3.6);
  pine(kit, group, 14.5, -2.4, 3.0);
  pine(kit, group, 22, -2.5, 3.4);
  // The snowbank at the foot of the ramp: always there, it squashes when the bike ploughs in.
  const bank = mound(kit, group, BANK.x, -0.5, BANK.halfW, BANK.h, 0.8);
  const flakes = snowfall(kit, group, 24);
  let playing = false;
  const twinkle = (time: number) => {
    for (const s of sparkles)
      s.m.scale.setScalar(0.4 + 0.6 * Math.max(0, Math.sin(time * 2.5 + s.phase)));
  };
  return {
    group,
    update(outcome, t) {
      playing = true;
      const hit = RAMP_CRASH.beats.hit;
      const squash = outcome === 'crash' ? bump(t, hit + 0.1, 0.25) : 0;
      bank.scale.set(BANK.halfW * (1 + 0.08 * squash), BANK.h * (1 - 0.12 * squash), 0.8);
    },
    ambient(time) {
      flakes(time);
      if (!playing) twinkle(time);
    },
    reset() {
      playing = false;
      bank.scale.set(BANK.halfW, BANK.h, 0.8);
    },
  };
}

// ---------- Element 2: Snowman Wall ----------

function buildWall(kit: Kit): MegaBuilt {
  const group = new Group();
  mound(kit, group, 3, -2.3, 3.0, 1.3, 1.0);
  mound(kit, group, 14.5, -2.5, 3.6, 1.6, 1.1);
  mound(kit, group, 20.5, -2.2, 2.4, 1.0, 0.9);
  pine(kit, group, 5, -2.4, 3.8);
  pine(kit, group, 19, -2.5, 3.2);
  const snow = kit.lit(SNOW, 0.85);
  const coal = kit.lit(COAL, 0.6);
  const red = kit.lit(0xe8403a, 0.7);
  const orange = kit.lit(0xff8a1f, 0.6);
  const hatMat = kit.lit(0x1c1f27, 0.6);
  // Nine balls of unit radius, sized by the piece's scale; the carrot, hat and scarf ride along.
  const balls = Array.from({ length: 9 }, (_, i) => {
    const k = i % 3;
    const m = kit.mesh(new SphereGeometry(1, 20, 14), snow, group);
    if (k === 1) {
      for (const y of [0.5, 0, -0.5])
        kit.mesh(new SphereGeometry(0.1, 8, 6), coal, m, 0, y, Math.sqrt(1 - y * y * 0.9) - 0.03);
    }
    if (k === 2) {
      for (const x of [-0.3, 0.3]) kit.mesh(new SphereGeometry(0.1, 8, 6), coal, m, x, 0.25, 0.92);
      const nose = kit.mesh(new ConeGeometry(0.13, 0.75, 8), orange, m, 0, 0, 1.2);
      nose.rotation.x = Math.PI / 2;
      kit.mesh(new CylinderGeometry(0.78, 0.78, 0.08, 14), hatMat, m, 0, 0.88, 0);
      kit.mesh(new CylinderGeometry(0.5, 0.52, 0.7, 14), hatMat, m, 0, 1.25, 0);
      const scarf = kit.mesh(new TorusGeometry(0.68, 0.17, 6, 16), red, m, 0, -0.78, 0);
      scarf.rotation.x = Math.PI / 2;
    }
    return m;
  });
  const place = (outcome: 'clear' | 'crash', t: number) => {
    balls.forEach((m, i) => {
      const p = snowPieceAt(outcome, i, t);
      m.position.set(p.x, p.y, 0);
      m.rotation.z = p.rot;
      m.scale.setScalar(p.scale);
    });
  };
  place('clear', 0);
  const flakes = snowfall(kit, group, 22);
  return {
    group,
    update(outcome, t) {
      place(outcome, t);
    },
    ambient(time) {
      flakes(time);
    },
    reset() {
      place('clear', 0);
    },
  };
}

// ---------- Element 3: Igloo Jump ----------

function buildIgloo(kit: Kit): MegaBuilt {
  const group = new Group();
  kit.mesh(
    ribbon(iglooSurface, KICK.from, KICK.to, 0.5, 0, 1.5, ICE, ICE_2),
    iceMaterial(kit),
    group,
  );
  // The dome, with rings of ice blocks, and its entrance with the dark door.
  const domeGroup = new Group();
  domeGroup.position.set(IGLOO.x, 0, 0);
  group.add(domeGroup);
  const dome = kit.mesh(
    new SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    kit.lit(0xe8f7ff, 0.35),
    domeGroup,
  );
  dome.scale.set(IGLOO.r, IGLOO.r, IGLOO.r * 0.5);
  const seam = kit.lit(0x9ccbe6, 0.5);
  for (const y of [0.55, 1.15, 1.75, 2.35, 2.9]) {
    const rho = Math.sqrt(IGLOO.r * IGLOO.r - y * y);
    const ring = kit.mesh(new TorusGeometry(rho, 0.035, 5, 48), seam, domeGroup, 0, y, 0);
    ring.rotation.x = Math.PI / 2;
    ring.scale.y = 0.5;
  }
  kit.box(2.2, 1.6, 1.0, kit.lit(0xe8f7ff, 0.35), domeGroup, 0, 0.8, 1.45);
  kit.box(1.3, 1.1, 0.06, kit.lit(0x28496a, 0.6), domeGroup, 0, 0.55, 1.97);
  kit.mesh(
    new CircleGeometry(0.65, 16, 0, Math.PI),
    kit.lit(0x28496a, 0.6),
    domeGroup,
    0,
    1.1,
    1.99,
  );
  // The block on top that pops off in the crash.
  const block = kit.box(1.0, 0.5, 0.8, kit.lit(0xd5efff, 0.3), group, BLOCK.x, BLOCK.y, 0);
  // The rink: pale ice with a few skid marks.
  const rinkW = ICE_SLIDE.elements[2].length - RINK_FROM;
  kit.box(rinkW, 0.04, 3.2, kit.lit(0xdaf3ff, 0.12), group, RINK_FROM + rinkW / 2, 0, 0.1);
  const skid = kit.lit(0x8fbfe0, 0.4);
  [
    [20.5, 0.5, 0.1, 2.6],
    [22.8, -0.4, -0.12, 3.0],
    [25.2, 0.7, 0.08, 2.4],
  ].forEach(([x, z, a, len]) => {
    kit.box(len, 0.01, 0.07, skid, group, x, 0.025, z).rotation.y = a;
  });
  mound(kit, group, 4, -2.2, 2.8, 1.2, 1.0);
  mound(kit, group, 20, -2.4, 3.4, 1.6, 1.1);
  mound(kit, group, 26, -2.2, 2.4, 1.0, 0.9);
  pine(kit, group, 9, -2.5, 3.4);
  pine(kit, group, 16, -2.5, 3.8);
  pine(kit, group, 24, -2.5, 3.0);
  const flakes = snowfall(kit, group, 28);
  const put = (outcome: 'clear' | 'crash', t: number) => {
    const p = iceBlockAt(outcome, t);
    block.position.set(p.x, p.y, 0);
    block.rotation.z = p.rot;
    const flop = outcome === 'crash' ? bump(t, IGLOO_CRASH.beats.flop + 0.05, 0.2) : 0;
    domeGroup.scale.y = 1 - 0.03 * flop;
  };
  return {
    group,
    update: put,
    ambient: flakes,
    reset() {
      put('clear', 0);
    },
  };
}

/** The three elements of Ice Slide, in order. */
export function buildIceSlideProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildRamp(kit), buildWall(kit), buildIgloo(kit)];
}
