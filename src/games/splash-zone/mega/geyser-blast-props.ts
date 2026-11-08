/**
 * The props of Geyser Blast: a black lava-rock arch over a river of lava with a vent that puffs soot,
 * four coconut-boulders that drop out of the sky, and a steam geyser that shoots up (and, on a miss,
 * surges and fires the rider into a seaweed parachute). Painted primitives, built once and moved.
 */
import {
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import { clamp01, createFrame, lerp, prog, resetFrame, sitOnSki } from '../anim';
import type { Kit } from '../kit';
import {
  BONK,
  BOULDERS,
  CHUTE,
  GEYSER,
  GEYSER_BLAST,
  LAVA,
  SOOT,
  boulderLandAt,
  geyserRise,
  geyserY,
  lavaY,
} from './geyser-blast';
import { profile, type MegaBuilt } from './props-kit';

const probe = createFrame();

/** The rider (seated or free) at `t` of an element's animation, for props that follow him. */
function frameOf(element: 0 | 1 | 2, outcome: 'clear' | 'fail', t: number) {
  const def = GEYSER_BLAST.elements[element][outcome];
  resetFrame(probe);
  def.at(Math.min(Math.max(t, 0), def.duration), probe);
  if (probe.rider.mode === 'seated') sitOnSki(probe);
  return probe;
}

// ---------- Element 1: the lava arch ----------

function buildLavaArch(kit: Kit): MegaBuilt {
  const group = new Group();
  const a = 0x2b2630;
  const b = 0x3d3643;
  const pillarTo = LAVA.foot + 4.2;
  const pillarFrom = LAVA.lipD - 3.6;
  // The slab: a thick pillar at each end and a thin span between them, so the arch has a hole.
  const bottom = (d: number) => (d < pillarTo || d > pillarFrom ? -1.6 : lavaY(d) - 1.2);
  profile(kit, group, lavaY, LAVA.foot, LAVA.lipD, 0.8, bottom, LAVA.halfWidth, a, b);
  // Lava glowing along both edges of the crown, and running down the pillars.
  const glow = kit.basic(0xff6a1a);
  const hot = kit.basic(0xffa02e);
  for (let d = LAVA.foot + 1; d < LAVA.lipD - 0.5; d += 1.6) {
    for (const side of [-1, 1]) {
      kit.box(
        0.22,
        0.07,
        1.0,
        d % 3.2 < 1.6 ? glow : hot,
        group,
        side * (LAVA.halfWidth - 0.12),
        lavaY(d) + 0.04,
        -d,
      );
    }
  }
  for (const [d, h] of [
    [LAVA.foot + 2, 2.2],
    [LAVA.foot + 3.3, 1.4],
    [LAVA.lipD - 1.6, 2.4],
    [LAVA.lipD - 0.6, 1.5],
  ] as const) {
    kit.box(0.4, h, 0.12, hot, group, LAVA.halfWidth + 0.02, h / 2 - 0.4, -d);
  }
  // The river of lava under the arch, bubbling, with a few dark rocks standing in it.
  const river = kit.mesh(
    new CylinderGeometry(1, 1, 0.05, 20),
    glow,
    group,
    0,
    0.11,
    -(LAVA.foot + LAVA.lipD) / 2,
  );
  river.scale.set(LAVA.halfWidth + 2.0, 1, (LAVA.lipD - LAVA.foot) / 2 + 2);
  const rock = kit.lit(0x2b2630, 0.8);
  for (const [d, s, r] of [
    [10, -3.9, 0.8],
    [15, 4.1, 0.9],
    [21, -4.2, 0.7],
    [27, 3.6, 0.9],
  ] as const) {
    kit.mesh(new IcosahedronGeometry(r, 0), rock, group, s, 0.3, -d);
  }
  // The vent on the crown: a dark ring with a hot centre.
  const ventY = lavaY(LAVA.vent);
  kit.mesh(
    new TorusGeometry(0.55, 0.16, 8, 16),
    rock,
    group,
    0,
    ventY + 0.05,
    -LAVA.vent,
  ).rotation.x = Math.PI / 2;
  kit.mesh(new CylinderGeometry(0.5, 0.5, 0.04, 14), glow, group, 0, ventY + 0.06, -LAVA.vent);
  // Puffs of soot, each with its own material so it can fade.
  const puffs: { mesh: Mesh; material: MeshBasicMaterial }[] = [];
  for (let i = 0; i < 6; i++) {
    const material = kit.basic(i % 2 ? 0x1c1819 : 0x2c2627, 0.9);
    const mesh = kit.mesh(new SphereGeometry(0.75, 10, 8), material, group, 0, ventY, -LAVA.vent);
    mesh.visible = false;
    puffs.push({ mesh, material });
  }
  const pose = (outcome: 'clear' | 'fail', t: number) => {
    puffs.forEach((p, i) => {
      const tau = t - SOOT.at - 0.07 * i;
      if (outcome !== 'fail' || tau < 0 || tau > 1.8) {
        p.mesh.visible = false;
        return;
      }
      p.mesh.visible = true;
      p.mesh.scale.setScalar(0.5 + 1.5 * tau);
      p.mesh.position.set(((i % 3) - 1) * 0.5, ventY + 0.4 + 2.6 * tau, -(LAVA.vent + 0.8 * tau));
      p.material.opacity = 0.9 * (1 - tau / 1.8);
    });
  };
  return {
    group,
    update: pose,
    ambient() {},
    reset: () => pose('clear', 0),
  };
}

// ---------- Element 2: the coconut-boulders ----------

function buildBoulders(kit: Kit): MegaBuilt {
  const group = new Group();
  const brown = kit.lit(0x6b4a2b, 0.85);
  const fibre = kit.lit(0x8a6238, 0.9);
  const dark = kit.lit(0x24180f, 0.7);
  const boulders = BOULDERS.list.map(() => {
    const root = new Group();
    group.add(root);
    kit.mesh(new IcosahedronGeometry(BOULDERS.radius, 1), brown, root);
    // A coconut's three dark eyes and a tuft of fibre.
    for (const [x, y, z] of [
      [-0.35, 0.45, 0.95],
      [0.35, 0.45, 0.95],
      [0.0, 0.0, 1.12],
    ] as const) {
      kit.mesh(new SphereGeometry(0.17, 8, 6), dark, root, x, y, z);
    }
    kit.mesh(new SphereGeometry(0.4, 8, 6), fibre, root, 0, 1.1, -0.1).scale.set(1, 0.6, 1);
    return root;
  });
  // A couple of tall palms on the far side the coconuts fall from.
  const trunk = kit.lit(0x8a5a2f, 0.85);
  const leaf = kit.lit(0x2f9d4a, 0.8);
  for (const [d, s] of [
    [9, -8.6],
    [23, -9.4],
  ] as const) {
    const palm = new Group();
    palm.position.set(s, 0, -d);
    group.add(palm);
    kit.mesh(new CylinderGeometry(0.22, 0.42, 9, 8), trunk, palm, 0.3, 4.5, 0).rotation.z = -0.08;
    kit.mesh(new CylinderGeometry(3.2, 3.6, 0.7, 10), kit.lit(0x2a2830, 0.8), palm, 0, -0.2, 0);
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2;
      const frond = kit.mesh(
        new IcosahedronGeometry(1, 0),
        leaf,
        palm,
        0.6 + Math.cos(ang) * 1.5,
        9.1 - 0.2,
        Math.sin(ang) * 1.5,
      );
      frond.scale.set(1.9, 0.18, 0.5);
      frond.rotation.y = -ang;
      frond.rotation.z = -0.35;
    }
  }
  const place = (outcome: 'clear' | 'fail', t: number) => {
    boulders.forEach((root, i) => {
      const { d, s } = BOULDERS.list[i];
      const bonk = outcome === 'fail' && i === 1;
      const landAt = bonk ? BONK.at : boulderLandAt(i);
      const targetD = bonk ? BONK.d + 0.2 : d;
      const targetS = bonk ? BONK.s : s;
      const dropAt = landAt - BOULDERS.fall;
      if (t < dropAt) {
        root.visible = false;
        return;
      }
      root.visible = true;
      // The one that bonks hits the rider's head, then bounces on down the course and settles.
      const restY = 0.4;
      const hitY = bonk ? 2.7 : restY;
      if (t < landAt) {
        const u = (t - dropAt) / BOULDERS.fall;
        root.position.set(targetS, lerp(BOULDERS.dropY, hitY, u * u), -targetD);
        root.rotation.set(u * 5, u * 3, 0);
        return;
      }
      const tau = t - landAt;
      if (bonk) {
        const y = Math.max(hitY + 4.5 * tau - 9 * tau * tau, restY);
        const on = tau < 0.8;
        root.position.set(
          targetS,
          y + (on ? 0 : 0.07 * Math.sin(t * 2.2)),
          -(targetD + 4.5 * Math.min(tau, 0.8)),
        );
        root.rotation.set(5 + tau * (on ? 4 : 0), 3, 0);
        return;
      }
      // A splash, then it bobs on the water.
      root.position.set(
        targetS,
        restY + 0.08 * Math.sin(t * 2.2 + i) - 0.5 * Math.exp(-tau * 6) * 0,
        -targetD,
      );
      root.rotation.set(5, 3 + 0.05 * Math.sin(t + i), 0.05 * Math.sin(t * 1.3 + i));
    });
  };
  return {
    group,
    update: place,
    ambient() {},
    reset: () => place('clear', -10),
  };
}

// ---------- Element 3: the steam geyser ----------

/** The geyser's jet as a fraction of its full height by time into the element. */
export function geyserLevel(outcome: 'clear' | 'fail', t: number): number {
  const rise = geyserRise(t);
  if (outcome === 'clear') return rise;
  // On a miss it surges past the crown as it shoots the rider up, then sags back.
  const surge =
    prog(t, CHUTE.shotAt, CHUTE.shotAt + 0.25, 'o') *
    (1 - prog(t, CHUTE.peakAt, CHUTE.peakAt + 0.8));
  return (
    rise * (1 + (CHUTE.surge - 1) * surge) * (1 - 0.45 * prog(t, CHUTE.peakAt, CHUTE.peakAt + 0.8))
  );
}

function buildGeyser(kit: Kit): MegaBuilt {
  const group = new Group();
  // The vent: a mound of black rock with a glowing rim.
  const rock = kit.lit(0x2b2630, 0.8);
  const mound = kit.mesh(
    new CylinderGeometry(2.0, 3.2, 1.3, 12),
    rock,
    group,
    0,
    0.1,
    -(GEYSER.foot + 0.4),
  );
  mound.scale.set(1, 1, 1);
  kit.mesh(
    new TorusGeometry(2.0, 0.22, 8, 20),
    kit.basic(0xff6a1a),
    group,
    0,
    0.78,
    -(GEYSER.foot + 0.4),
  ).rotation.x = Math.PI / 2;
  for (const [d, s, r] of [
    [5.5, -3.8, 1.0],
    [11, 4.4, 1.2],
    [8, 5.4, 0.8],
    [18, -4.5, 1.0],
  ] as const) {
    kit.mesh(new IcosahedronGeometry(r, 0), rock, group, s, 0.4, -d);
  }
  // The jet: a fat curved pipe of steam from the foot up to the crown, with a puffy head.
  const jet = new Group();
  group.add(jet);
  const steam = kit.lit(0xf1f4f7, 0.9);
  const points: Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const d = lerp(GEYSER.foot, GEYSER.crownD, i / 12);
    points.push(new Vector3(0, geyserY(d) - 1.0, -d));
  }
  kit.mesh(new TubeGeometry(new CatmullRomCurve3(points), 28, 1.1, 12), steam, jet);
  const plume = new Group();
  plume.position.set(0, GEYSER.crownY, -GEYSER.crownD);
  group.add(plume);
  const balls: Mesh[] = [];
  const puff = kit.lit(0xe4e8ee, 0.95);
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    balls.push(
      kit.mesh(
        new SphereGeometry(0.95, 12, 8),
        puff,
        plume,
        Math.cos(ang) * 1.3,
        0.2 + (i % 2) * 0.6,
        Math.sin(ang) * 1.3,
      ),
    );
  }
  balls.push(kit.mesh(new SphereGeometry(1.5, 12, 8), puff, plume, 0, 0.9, 0));
  let last = 0;
  const pose = (level: number, time: number) => {
    last = level;
    jet.scale.y = Math.max(level, 0.001);
    jet.visible = level > 0.01;
    plume.visible = level > 0.01;
    plume.scale.setScalar(Math.max(Math.min(level, 1.2), 0.001));
    plume.position.y = GEYSER.crownY * level;
    balls.forEach((b, i) => b.scale.setScalar(1 + 0.1 * Math.sin(time * 7 + i)));
  };
  // The seaweed parachute: a green canopy with frilly edges and strings down to the rider.
  const chute = new Group();
  chute.visible = false;
  group.add(chute);
  const weed = kit.lit(0x2f9d4a, 0.8);
  const weedDark = kit.lit(0x1f7a38, 0.8);
  const canopy = new Group();
  canopy.position.y = 2.4;
  chute.add(canopy);
  kit
    .mesh(new SphereGeometry(1.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), weed, canopy)
    .scale.set(1, 0.7, 1);
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const frill = kit.mesh(
      new SphereGeometry(0.34, 8, 6),
      i % 2 ? weedDark : weed,
      canopy,
      Math.cos(ang) * 1.85,
      0.05,
      Math.sin(ang) * 1.85,
    );
    frill.scale.set(1, 0.6, 1.4);
  }
  const string = kit.lit(0xe9dfb8, 0.8);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const rx = Math.cos(ang) * 1.7;
    const rz = Math.sin(ang) * 1.7;
    const len = Math.hypot(2.2, Math.hypot(rx, rz));
    const line = kit.mesh(
      new CylinderGeometry(0.025, 0.025, len, 4),
      string,
      chute,
      rx / 2,
      1.2,
      rz / 2,
    );
    line.rotation.set(rz / 2.2, 0, -rx / 2.2);
  }
  const poseChute = (outcome: 'clear' | 'fail', t: number) => {
    if (outcome !== 'fail' || t < CHUTE.peakAt - 0.1) {
      chute.visible = false;
      return;
    }
    const f = frameOf(2, 'fail', t);
    chute.visible = true;
    const open = prog(t, CHUTE.peakAt - 0.1, CHUTE.peakAt + 0.3, 'o');
    const down = clamp01((t - CHUTE.landAt) / 0.6);
    chute.position.set(
      f.rider.s + 0.5 * down,
      f.rider.y * (1 - down) + 0.1 * down,
      -(f.rider.d + 1.2 * down),
    );
    chute.rotation.z = f.rider.roll * (1 - down);
    chute.scale.set(open * (1 + 0.5 * down), open * (1 - 0.7 * down), open * (1 + 0.5 * down));
    chute.children.forEach((c, i) => {
      if (i > 0) c.visible = down < 0.3;
    });
  };
  return {
    group,
    update(outcome, t) {
      pose(geyserLevel(outcome, t), t);
      poseChute(outcome, t);
    },
    ambient(time) {
      if (jet.visible) pose(last, time);
    },
    reset() {
      pose(0, 0);
      chute.visible = false;
    },
  };
}

export function buildGeyserBlastProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildLavaArch(kit), buildBoulders(kit), buildGeyser(kit)];
}
