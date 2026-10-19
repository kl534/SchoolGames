/**
 * The props of Volcano Rush: a stone ramp over a bubbling lava lake, a rocky hillside with three
 * big boulders that roll down it, and a cone volcano that erupts (a lava column, flying blobs and
 * smoke) or only burps. Bright painted primitives like obstacles.ts; everything is built once and
 * only moved.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { clamp01, ribbon, ribbonMaterial, smooth, type Kit } from '../kit';
import {
  boulderAt,
  BOULDER_R,
  HILL,
  hillY,
  LAVA_FLOOR,
  LAVA_FROM,
  LAVA_TO,
  LAVA_Y,
  leapSurface,
  VOLCANO,
  VOLCANO_RUSH,
  volcanoSurface,
} from './volcano-rush';
import type { MegaBuilt } from './triple-loop-props';

const VOLCANO_CLEAR = VOLCANO_RUSH.elements[2].clear;
const VOLCANO_CRASH = VOLCANO_RUSH.elements[2].crash;
const LEAP_CRASH = VOLCANO_RUSH.elements[0].crash;

const STONE = 0x8d8a96;
const STONE_2 = 0x77747f;
const LAVA = 0xff5a1f;
const LAVA_HOT = 0xffc247;

/** A cone of rock standing behind the road, for the look of the place. */
function crag(kit: Kit, parent: Group, x: number, z: number, h: number, r: number): void {
  kit.mesh(new ConeGeometry(r, h, 7), kit.lit(0x6b5b5f, 0.9), parent, x, h / 2, z);
}

// ---------- Element 1: Lava Leap ----------

function buildLeap(kit: Kit): MegaBuilt {
  const group = new Group();
  const rib = ribbonMaterial(kit);
  kit.mesh(ribbon(leapSurface, 1, LAVA_FROM, 0.5, 0, 1.5, STONE, STONE_2), rib, group);
  kit.mesh(ribbon(leapSurface, LAVA_TO, 20.5, 0.5, 0, 1.5, STONE_2, STONE), rib, group);
  const width = LAVA_TO - LAVA_FROM;
  const mid = (LAVA_FROM + LAVA_TO) / 2;
  // The lake: dark rock behind and under it, then the glowing lava.
  kit.box(width, 14, 0.2, kit.lit(0x4a3a3e, 1), group, mid, -7.5, -3.0);
  kit.box(width, 0.4, 4.2, kit.lit(0x2e2226, 1), group, mid, LAVA_FLOOR - 0.2, -0.9);
  kit.box(
    width,
    LAVA_Y - LAVA_FLOOR,
    4.2,
    kit.basic(LAVA),
    group,
    mid,
    (LAVA_Y + LAVA_FLOOR) / 2,
    -0.9,
  );
  const crust = kit.mesh(
    new CylinderGeometry(1, 1, 0.02, 24),
    kit.basic(LAVA_HOT),
    group,
    mid,
    LAVA_Y + 0.011,
    -0.9,
  );
  crust.scale.set(width / 2 - 0.1, 1, 2.0);
  // Rock pillars behind.
  crag(kit, group, 3.4, -2.4, 4.4, 1.1);
  crag(kit, group, 10.5, -2.6, 3.4, 1.0);
  crag(kit, group, 14.6, -2.5, 4.4, 1.3);
  crag(kit, group, 19.5, -2.4, 3.2, 0.9);
  // Bubbles on the lava.
  const bubbleMat = kit.basic(LAVA_HOT);
  const burstMat = kit.basic(0xfff3b0);
  const bubbles: { mesh: Mesh; x: number; z: number; phase: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const x = LAVA_FROM + 1.1 + i * 1.4;
    const z = -0.2 + ((i * 5) % 4) * 0.4 - 0.6;
    const mesh = kit.mesh(new SphereGeometry(0.4, 10, 8), bubbleMat, group, x, LAVA_Y, z);
    bubbles.push({ mesh, x, z, phase: (i * 0.37) % 1 });
  }
  // The splash when the bike drops in.
  const splash = kit.mesh(
    new SphereGeometry(0.8, 12, 10),
    kit.basic(LAVA),
    group,
    15.1,
    LAVA_Y,
    -0.2,
  );
  splash.visible = false;

  /** When the cleared leap passes over x (the flight is steady in x). */
  const passAt = (x: number) => 0.4 + ((x - 4.2) / 14) * 1.2;
  const idle = (time: number) => {
    for (const b of bubbles) {
      const u = (time * 0.6 + b.phase) % 1;
      const s = u < 0.8 ? 0.3 + 0.7 * (u / 0.8) : 1.2 * (1 - (u - 0.8) / 0.2);
      b.mesh.material = u < 0.8 ? bubbleMat : burstMat;
      b.mesh.scale.setScalar(Math.max(s, 0.01));
      b.mesh.position.y = LAVA_Y + 0.1 * s;
    }
  };
  let playing = false;
  return {
    group,
    update(outcome, t) {
      playing = true;
      splash.visible = false;
      const hit = outcome === 'crash' ? LEAP_CRASH.beats.fall : 0;
      for (const b of bubbles) {
        // They pop one after the other as the bike flies over.
        const at = outcome === 'clear' ? passAt(b.x) : passAt(b.x) + 0.1;
        const u = (t - at) / 0.5;
        if (u < 0) {
          b.mesh.material = bubbleMat;
          b.mesh.scale.setScalar(0.6 + 0.4 * clamp01(1 + u * 1.2));
          b.mesh.position.y = LAVA_Y + 0.1;
        } else {
          b.mesh.material = burstMat;
          const up = Math.sin(Math.PI * clamp01(u));
          b.mesh.scale.setScalar(Math.max(0.2 + 1.0 * up, 0.01));
          b.mesh.position.y = LAVA_Y + 0.2 + 1.3 * up;
        }
      }
      if (outcome === 'crash' && t >= hit) {
        const u = (t - hit) / 0.8;
        splash.visible = u < 1;
        splash.scale.set(0.8, 0.2 + 1.5 * Math.sin(Math.PI * clamp01(u)), 0.8);
        splash.position.y = LAVA_Y + 0.5 * Math.sin(Math.PI * clamp01(u));
      }
    },
    ambient(time) {
      if (!playing) idle(time);
    },
    reset() {
      playing = false;
      splash.visible = false;
    },
  };
}

// ---------- Element 2: Boulder Run ----------

function buildBoulders(kit: Kit): MegaBuilt {
  const group = new Group();
  const rib = ribbonMaterial(kit);
  // The hillside the boulders roll down, with a rocky mass behind it.
  kit.mesh(ribbon(hillY, HILL.foot, HILL.end, 0.3, 0, 1.0, 0x8a5a45, 0x7a4c3a, -1.6), rib, group);
  kit.box(
    HILL.end - HILL.foot + 0.5,
    HILL.height + 1.2,
    0.3,
    kit.lit(0x6a4a3a, 1),
    group,
    (HILL.foot + HILL.end) / 2,
    (HILL.height + 1.2) / 2,
    -2.8,
  );
  crag(kit, group, HILL.top + 1.0, -2.6, HILL.height + 1.6, 1.3);
  crag(kit, group, HILL.top + 3.4, -2.6, HILL.height + 0.8, 1.1);
  crag(kit, group, 4.5, -2.5, 3.2, 1.0);
  crag(kit, group, 9.0, -2.7, 2.4, 0.9);
  // A rockfall warning sign at the start.
  const yellow = kit.lit(0xffd43b, 0.5);
  kit.box(0.12, 2.2, 0.12, kit.lit(0x444444, 0.8), group, 3.0, 1.1, -1.4);
  const sign = kit.mesh(new ConeGeometry(0.9, 0.8, 3), yellow, group, 3.0, 2.55, -1.3);
  sign.rotation.x = Math.PI / 2;
  kit.mesh(new SphereGeometry(0.18, 8, 6), kit.lit(0x333333, 0.6), group, 3.0, 2.5, -0.9);

  const boulders: Mesh[] = [];
  const rock = new MeshStandardMaterial({ color: 0x9a97a3, roughness: 0.9, flatShading: true });
  kit.materials.push(rock);
  const dark = kit.lit(0x6c6a75, 0.9);
  for (let i = 0; i < 3; i++) {
    const m = kit.mesh(new IcosahedronGeometry(BOULDER_R, 1), rock, group);
    // Dark patches that make the spin readable.
    for (let k = 0; k < 4; k++) {
      const a = k * 1.6 + i;
      kit.mesh(
        new SphereGeometry(0.22, 8, 6),
        dark,
        m,
        Math.cos(a) * 0.8,
        Math.sin(a) * 0.8,
        0.45 - 0.2 * k,
      );
    }
    boulders.push(m);
  }
  const place = (outcome: 'clear' | 'crash', t: number) => {
    boulders.forEach((m, i) => {
      const b = boulderAt(outcome, i as 0 | 1 | 2, t);
      m.position.set(b.x, b.y, b.z);
      m.rotation.z = b.rot;
    });
  };
  place('clear', 0);
  return {
    group,
    update(outcome, t) {
      place(outcome, t);
    },
    ambient() {},
    reset() {
      place('clear', 0);
    },
  };
}

// ---------- Element 3: the volcano ----------

/** Lava blobs thrown out when the volcano goes off: their speeds are fixed so it is repeatable. */
const BLOBS: readonly (readonly [number, number])[] = [
  [-4.5, 11],
  [-3.2, 13],
  [-2.2, 9.5],
  [-1.2, 12.5],
  [-0.4, 14],
  [0.6, 10.5],
  [1.5, 13],
  [2.4, 9],
  [3.3, 12],
  [4.4, 10],
  [5.4, 11.5],
  [-5.6, 9.5],
];

function buildVolcano(kit: Kit): MegaBuilt {
  const group = new Group();
  const cone = new Group();
  group.add(cone);
  const rib = ribbonMaterial(kit);
  kit.mesh(
    ribbon(volcanoSurface, VOLCANO.footL, VOLCANO.footR, 0.3, 0, 1.5, 0x8a5a3c, 0x774a30),
    rib,
    cone,
  );
  // Lava streaks down the front of both slopes.
  const streak = kit.basic(LAVA);
  const nearAngle = Math.atan2(VOLCANO.height, VOLCANO.rimL - VOLCANO.footL);
  const farAngle = -Math.atan2(VOLCANO.height, VOLCANO.footR - VOLCANO.rimR);
  const streaks: [number, number, number][] = [
    [VOLCANO.rimL - 1.1, 1.2, nearAngle],
    [VOLCANO.rimL - 2.6, 0.9, nearAngle],
    [VOLCANO.rimR + 1.2, 1.4, farAngle],
    [VOLCANO.rimR + 2.9, 1.0, farAngle],
    [VOLCANO.rimR + 4.4, 0.8, farAngle],
  ];
  for (const [x, len, angle] of streaks) {
    const s = kit.box(0.22, len, 0.06, streak, cone, x, volcanoSurface(x) - 0.1, 1.52);
    s.rotation.z = angle - Math.PI / 2;
  }
  // The glow of the crater behind the bike.
  const glowMat = kit.basic(LAVA);
  const glow = kit.mesh(
    new SphereGeometry(1, 16, 10),
    glowMat,
    cone,
    VOLCANO.cx,
    VOLCANO.height - 0.4,
    -1.1,
  );
  glow.scale.set(1.8, 0.7, 0.2);
  crag(kit, group, 8.0, -2.6, 3.0, 1.1);
  crag(kit, group, 19.5, -2.6, 3.0, 1.2);
  crag(kit, group, 24.2, -2.5, 2.4, 1.0);
  // The eruption: a lava column, thrown blobs and smoke.
  const lavaMat = kit.basic(LAVA);
  const hotMat = kit.basic(LAVA_HOT);
  const column = kit.mesh(
    new CylinderGeometry(0.55, 0.9, 1, 12),
    lavaMat,
    group,
    VOLCANO.cx,
    VOLCANO.height,
    -0.4,
  );
  column.visible = false;
  const blobs = BLOBS.map((_, i) => {
    const m = kit.mesh(
      new SphereGeometry(0.24, 8, 6),
      i % 2 ? lavaMat : hotMat,
      group,
      VOLCANO.cx,
      VOLCANO.height,
      -0.3,
    );
    m.visible = false;
    return m;
  });
  const smokeMat = kit.basic(0x6b6b75, 0.85);
  const puffs = [0, 1, 2, 3, 4].map((i) => {
    const m = kit.mesh(
      new SphereGeometry(0.8, 10, 8),
      smokeMat,
      group,
      VOLCANO.cx,
      VOLCANO.height,
      -0.6 - i * 0.1,
    );
    m.visible = false;
    return m;
  });
  // A heap of ash for the rider in the crash.
  const ash = new Group();
  ash.position.set(3.6, 0, 0);
  group.add(ash);
  const ashMat = kit.lit(0x8a8a92, 1);
  [
    [0, 0.35, 0.9],
    [-0.8, 0.25, 0.6],
    [0.8, 0.25, 0.65],
    [0.1, 0.8, 0.5],
  ].forEach(([x, y, r]) => {
    kit.mesh(new SphereGeometry(r, 12, 8), ashMat, ash, x, y - 0.2, 0.1).scale.y = 0.7;
  });
  ash.visible = false;

  const GRAVITY = 14;
  const hide = () => {
    column.visible = false;
    blobs.forEach((b) => (b.visible = false));
    puffs.forEach((p) => (p.visible = false));
    ash.visible = false;
    glow.scale.set(1.8, 0.7, 0.2);
  };
  let playing = false;
  const erupt = (since: number, power: number) => {
    // Column: shoots up and sinks back.
    const u = since / 1.0;
    column.visible = u > 0 && u < 1;
    if (column.visible) {
      const h = Math.max(0.1, 3.2 * power * Math.sin(Math.PI * Math.min(u * 1.2, 1)));
      column.scale.set(power, h, power);
      column.position.y = VOLCANO.height + h / 2 - 0.4;
    }
    blobs.forEach((b, i) => {
      const [vx, vy] = BLOBS[i];
      const y = VOLCANO.height + vy * power * since - 0.5 * GRAVITY * since * since;
      b.visible = since > 0 && y > 0.3;
      b.position.set(VOLCANO.cx + vx * power * since, y, -0.3 - (i % 3) * 0.2);
    });
    puffs.forEach((p, i) => {
      const v = (since - i * 0.1) / 1.6;
      p.visible = v > 0 && v < 1;
      if (p.visible) {
        p.position.set(VOLCANO.cx + (i - 2) * 0.6 * v * 2, VOLCANO.height + 1 + v * 3.2, -0.6);
        p.scale.setScalar((0.6 + v * 1.6) * (0.6 + 0.4 * power));
      }
    });
  };
  return {
    group,
    update(outcome, t) {
      playing = true;
      hide();
      const clear = outcome === 'clear';
      const beats = clear ? VOLCANO_CLEAR.beats : VOLCANO_CRASH.beats;
      const go = clear ? beats.blast : beats.burp;
      // The crater glows brighter and the cone shakes while it charges.
      const charge = clamp01((t - beats.charge) / (go - beats.charge));
      if (t > beats.charge && t < go) {
        cone.position.y = 0.04 * charge * Math.sin(t * 60);
        glow.scale.set(1.8 + 0.5 * charge, 0.7 + 0.3 * charge, 0.2);
      } else {
        cone.position.y = 0;
      }
      if (t >= go) erupt(t - go, clear ? 1 : 0.45);
      if (!clear && t >= beats.land - 0.1) {
        ash.visible = true;
        const grow = smooth((t - (beats.land - 0.1)) / 0.3);
        ash.scale.set(grow, grow, grow);
      }
    },
    ambient(time) {
      if (playing) return;
      // A lazy wisp of smoke rises from the crater.
      for (let i = 0; i < 3; i++) {
        const v = (time * 0.25 + i / 3) % 1;
        puffs[i].visible = true;
        puffs[i].position.set(
          VOLCANO.cx + 0.3 * Math.sin(time + i),
          VOLCANO.height + 0.5 + v * 2.4,
          -0.6,
        );
        puffs[i].scale.setScalar(0.3 + 0.6 * v);
      }
      for (let i = 3; i < 5; i++) puffs[i].visible = false;
      glowMat.color.setHex(Math.sin(time * 3) > 0 ? LAVA : 0xff7a2f);
    },
    reset() {
      playing = false;
      hide();
      cone.position.y = 0;
    },
  };
}

/** The three elements of Volcano Rush, in order. */
export function buildVolcanoRushProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildLeap(kit), buildBoulders(kit), buildVolcano(kit)];
}
