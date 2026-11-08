/**
 * The props of Penguin Parade: an ice floe with a row of penguins who hop as the ski goes over (and
 * tip over like dominoes on a miss), an iceberg with a chute and a snow bank, and a giant ice arch
 * with cheering penguins and the ice cube that freezes the rider. Painted primitives, built once
 * and only moved.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  type Mesh,
  type Object3D,
} from 'three';
import { clamp01, createFrame, prog, resetFrame, sitOnSki, type Def } from '../anim';
import type { Kit } from '../kit';
import {
  ARCH,
  BERG,
  BUMP,
  FLOE,
  FREEZE,
  PENGUIN_PARADE,
  SKID,
  bergY,
  floeY,
  rampY,
} from './penguin-parade';
import { profile, type MegaBuilt } from './props-kit';

const probe = createFrame();

/** The ski (and, for the ice cube, the rider) at `t` of an element's animation, for reacting props. */
function frameOf(element: 0 | 1 | 2, outcome: 'clear' | 'fail', t: number) {
  const def: Def = PENGUIN_PARADE.elements[element][outcome];
  resetFrame(probe);
  def.at(Math.min(Math.max(t, 0), def.duration), probe);
  if (probe.rider.mode === 'seated') sitOnSki(probe);
  return probe;
}

const ICE = [0xf4fbff, 0xcdeaf8];
const ICE_DEEP = [0xe2f4ff, 0xa9d6ee];

interface Penguin {
  root: Group;
  /** Idle sway, kept apart from the pose so ambient motion never undoes a stunt pose. */
  sway: Group;
  flippers: [Mesh, Mesh];
}

/** A cartoon penguin facing +z: a navy body with a white belly, an orange beak and feet, ~1.45 u tall. */
function makePenguin(kit: Kit, parent: Object3D, d: number, s: number, y: number): Penguin {
  const root = new Group();
  root.position.set(s, y, -d);
  parent.add(root);
  const sway = new Group();
  root.add(sway);
  const body = new Group();
  body.scale.setScalar(0.85);
  sway.add(body);
  const navy = kit.lit(0x1f2a44, 0.7);
  const white = kit.lit(0xfafcff, 0.7);
  const orange = kit.lit(0xff9a1f, 0.6);
  kit.mesh(new SphereGeometry(0.5, 14, 12), navy, body, 0, 0.7, 0).scale.set(0.95, 1.3, 0.85);
  kit.mesh(new SphereGeometry(0.44, 14, 12), white, body, 0, 0.64, 0.14).scale.set(0.9, 1.2, 0.8);
  kit.mesh(new SphereGeometry(0.3, 14, 12), navy, body, 0, 1.4, 0.02);
  for (const side of [-1, 1]) {
    kit.mesh(new SphereGeometry(0.075, 8, 6), white, body, side * 0.12, 1.46, 0.24);
    kit.mesh(new SphereGeometry(0.04, 8, 6), navy, body, side * 0.12, 1.46, 0.3);
    kit.box(0.2, 0.06, 0.34, orange, body, side * 0.14, 0.03, 0.12);
  }
  const beak = kit.mesh(new ConeGeometry(0.09, 0.24, 8), orange, body, 0, 1.36, 0.34);
  beak.rotation.x = Math.PI / 2;
  const flippers = [-1, 1].map((side) => {
    const pivot = new Group();
    pivot.position.set(side * 0.46, 0.95, 0);
    body.add(pivot);
    const flipper = kit.mesh(new SphereGeometry(0.16, 8, 6), navy, pivot, side * 0.06, -0.3, 0);
    flipper.scale.set(0.45, 1.9, 0.9);
    return pivot as unknown as Mesh;
  }) as [Mesh, Mesh];
  return { root, sway, flippers };
}

function buildFloe(kit: Kit): MegaBuilt {
  const group = new Group();
  profile(kit, group, floeY, FLOE.foot, FLOE.lip, 0.75, -1.4, FLOE.halfWidth, ICE[0], ICE[1]);
  profile(kit, group, floeY, FLOE.lip, FLOE.end, 1.5, -1.4, FLOE.halfWidth, ICE[0], ICE[1]);
  // Lumps of ice around the edge of the floe, and a few snowy humps.
  const lump = kit.lit(0xe2f4ff, 0.5);
  const snow = kit.lit(0xffffff, 0.9);
  for (const [d, s, r] of [
    [9, -3.4, 0.9],
    [13, 3.8, 1.1],
    [19, -3.9, 1.2],
    [24, 3.7, 0.9],
    [27, -3.2, 0.8],
  ] as const) {
    kit.mesh(new IcosahedronGeometry(r, 0), lump, group, s, FLOE.deckY * 0.5, -d);
  }
  for (const [d, s] of [
    [24.5, 2.4],
    [26.5, -1.4],
  ] as const) {
    kit
      .mesh(new SphereGeometry(0.8, 10, 8), snow, group, s, FLOE.deckY + 0.05, -d)
      .scale.set(1.2, 0.45, 1);
  }
  const row = FLOE.penguins.map((d) => ({ d, ...makePenguin(kit, group, d, 0, FLOE.deckY) }));
  const pose = (outcome: 'clear' | 'fail', t: number, time: number) => {
    const ski = frameOf(0, outcome, t).ski;
    row.forEach((p, i) => {
      let hop = 0;
      let tip = 0;
      let flap = Math.sin(t * 3 + i * 1.7) * 0.15;
      if (outcome === 'clear' && ski.y > FLOE.deckY + 0.5) {
        // They hop and wave as the ski goes over their heads.
        const near = clamp01(1 - Math.abs(p.d - ski.d) / 5);
        hop = 0.45 * near * Math.abs(Math.sin(time * 11 + i));
        flap = 1.3 * near * Math.sin(time * 14 + i);
      } else if (outcome === 'fail') {
        // A bump, then they topple over one after another.
        tip = prog(t, BUMP.at + 0.12 * i, BUMP.at + 0.12 * i + 0.5, 'o');
        hop = 0.5 * Math.max(0, 1 - Math.abs(t - BUMP.at - 0.12 * i - 0.1) / 0.12);
      }
      p.root.position.y = FLOE.deckY + hop;
      p.root.rotation.x = -tip * 1.45;
      p.flippers[0].rotation.z = 0.25 + flap;
      p.flippers[1].rotation.z = -0.25 - flap;
    });
  };
  return {
    group,
    update: (outcome, t) => pose(outcome, t, t),
    ambient: (time) => row.forEach((p, i) => (p.sway.rotation.z = 0.04 * Math.sin(time * 1.5 + i))),
    reset: () => pose('clear', 0, 0),
  };
}

// The snow bank: lumps that get thrown about when the ski ploughs in: [dx, ds, radius, [vd, vs, vy]].
const LUMPS: [number, number, number, [number, number, number]][] = [
  [-0.3, -0.5, 0.85, [3.5, 1.0, 5.0]],
  [0.5, 0.2, 0.75, [5.5, 2.5, 4.0]],
  [-0.1, 0.7, 0.8, [4.0, 3.5, 5.5]],
  [0.2, -1.0, 0.65, [2.5, 0.5, 4.5]],
  [0.9, -0.4, 0.55, [6.5, 1.5, 4.0]],
  [-0.7, 0.1, 0.9, [3.0, 2.0, 6.0]],
];

function buildBerg(kit: Kit): MegaBuilt {
  const group = new Group();
  // The riding surface: a climb to the summit and the long chute down, in stripes of ice.
  profile(
    kit,
    group,
    bergY,
    BERG.foot,
    BERG.summit,
    0.8,
    -1.6,
    BERG.halfWidth,
    ICE_DEEP[0],
    ICE_DEEP[1],
  );
  profile(
    kit,
    group,
    bergY,
    BERG.summit,
    BERG.chuteEnd,
    0.8,
    -1.6,
    BERG.halfWidth,
    ICE_DEEP[0],
    ICE_DEEP[1],
  );
  // Crags either side make it a real iceberg: tall pale shards beside the climb and the chute.
  const crag = kit.lit(0xdff1fb, 0.55);
  const shade = kit.lit(0xb7dcee, 0.55);
  for (const [d, s, h, r] of [
    [9, -4.2, 5.2, 2.0],
    [14, -4.6, 7.4, 2.4],
    [19, -4.4, 5.0, 2.0],
    [24.5, -4.2, 3.2, 1.6],
    [10, 4.9, 2.0, 1.1],
    [21, 4.8, 1.8, 1.0],
  ] as const) {
    const cone = kit.mesh(
      new ConeGeometry(r, h, 5),
      (d * 7) % 2 > 1 ? crag : shade,
      group,
      s,
      h / 2 - 0.4,
      -d,
    );
    cone.rotation.y = d;
  }
  // The snow bank beside the chute's foot.
  const white = kit.lit(0xffffff, 0.9);
  const lumps = LUMPS.map(([, , r], i) => {
    const m = kit.mesh(new SphereGeometry(r, 12, 10), white, group);
    m.scale.set(1, 0.8, 1);
    m.rotation.y = i;
    return m;
  });
  const placeLumps = (t: number | null) => {
    lumps.forEach((lump, i) => {
      const [dx, ds, r, v] = LUMPS[i];
      const homeY = r * 0.8 * 0.9;
      if (t === null || t < SKID.hitAt) {
        lump.position.set(BERG.bank.s + ds, homeY, -(BERG.bank.d + dx));
        lump.rotation.set(0, i, 0);
        return;
      }
      const tau = t - SKID.hitAt;
      const y = Math.max(homeY + v[2] * tau - 8 * tau * tau, 0.1);
      const afloat = y <= 0.12;
      const slide = afloat ? 0.25 : 1;
      lump.position.set(
        BERG.bank.s + ds + v[1] * tau * slide,
        y,
        -(BERG.bank.d + dx + v[0] * tau * slide),
      );
      lump.rotation.set(tau * (i % 2 ? 3 : -2) * slide, i, 0);
    });
  };
  return {
    group,
    update: (outcome, t) => placeLumps(outcome === 'fail' ? t : null),
    ambient() {},
    reset: () => placeLumps(null),
  };
}

function buildArch(kit: Kit): MegaBuilt {
  const group = new Group();
  profile(
    kit,
    group,
    rampY,
    ARCH.rampFoot,
    ARCH.lip,
    0.6,
    -1.2,
    ARCH.rampHalfWidth,
    ICE[0],
    ICE_DEEP[1],
  );
  // The arch: half a thick torus standing on two legs, with a snowy cap and icicles inside.
  const ice = kit.lit(0xd2edfb, 0.4);
  const frost = kit.lit(0xffffff, 0.8);
  const tube = ARCH.thick / 2;
  const ring = ARCH.radius + tube;
  const arch = new Group();
  arch.position.set(0, ARCH.cy, -ARCH.d);
  // Turned to face the stunt camera, so the ski is seen flying through the opening.
  arch.rotation.y = Math.PI / 4;
  group.add(arch);
  kit.mesh(new TorusGeometry(ring, tube, 10, 28, Math.PI), ice, arch).scale.set(1, 1, 2.2);
  for (const side of [-1, 1]) {
    kit
      .mesh(
        new CylinderGeometry(tube, tube * 1.25, ARCH.cy + 1.5, 10),
        ice,
        arch,
        side * ring,
        -(ARCH.cy + 1.5) / 2 + 0.2,
        0,
      )
      .scale.set(1, 1, 2.2);
    kit.mesh(
      new IcosahedronGeometry(1.1, 0),
      frost,
      arch,
      side * (ring + 0.6),
      -ARCH.cy + 0.4,
      0.4,
    );
  }
  kit
    .mesh(new SphereGeometry(1.5, 12, 8), frost, arch, 0, ring + tube * 0.3, 0)
    .scale.set(1.3, 0.45, 1.6);
  for (let i = 1; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    const h = 0.7 + 0.55 * Math.abs(Math.sin(i * 2.3));
    const icicle = kit.mesh(
      new ConeGeometry(0.14, h, 6),
      frost,
      arch,
      Math.cos(a) * (ARCH.radius - 0.1),
      Math.sin(a) * (ARCH.radius - 0.1) - h / 2,
      i % 2 ? 0.5 : -0.5,
    );
    icicle.rotation.z = Math.PI;
  }
  // Penguins on little floes beside the arch cheer the finale.
  const cheer: { p: Penguin; platform: Mesh; phase: number }[] = [];
  const spots: [number, number][] = [
    [ARCH.d - 3.5, -7.0],
    [ARCH.d - 1.0, -8.6],
    [ARCH.d + 2.0, -7.4],
    [ARCH.d + 4.5, -9.2],
  ];
  spots.forEach(([d, s], i) => {
    const platform = kit.mesh(new CylinderGeometry(1.0, 1.2, 0.6, 10), ice, group, s, 0.0, -d);
    const p = makePenguin(kit, group, d, s, 0.3);
    p.root.rotation.y = Math.PI / 2;
    cheer.push({ p, platform, phase: i * 1.3 });
  });
  const poseCheer = (amount: number, time: number) => {
    for (const c of cheer) {
      const hop = 0.7 * amount * Math.abs(Math.sin(time * 9 + c.phase));
      const flap = amount * (1.0 + 0.6 * Math.sin(time * 15 + c.phase));
      c.p.root.position.y = 0.3 + hop;
      c.p.flippers[0].rotation.z = 0.25 + flap;
      c.p.flippers[1].rotation.z = -0.25 - flap;
    }
  };
  // The ice cube that forms round the frozen rider: it follows him and bobs where it floats.
  const cubeRoot = new Group();
  const cubeBob = new Group();
  cubeRoot.add(cubeBob);
  cubeRoot.visible = false;
  group.add(cubeRoot);
  kit.mesh(new BoxGeometry(1.75, 1.95, 1.75), kit.glass(0x8fd6ff, 0.62), cubeBob);
  const rim = kit.glass(0xeaf8ff, 0.8);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.box(0.08, 1.95, 0.08, rim, cubeBob, sx * 0.875, 0, sz * 0.875);
    }
  }
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) kit.box(1.75, 0.08, 0.08, rim, cubeBob, 0, sy * 0.975, sz * 0.875);
    for (const sx of [-1, 1]) kit.box(0.08, 0.08, 1.75, rim, cubeBob, sx * 0.875, sy * 0.975, 0);
  }
  const placeCube = (outcome: 'clear' | 'fail', t: number) => {
    if (outcome !== 'fail' || t < FREEZE.at) {
      cubeRoot.visible = false;
      return;
    }
    const f = frameOf(2, 'fail', t);
    cubeRoot.visible = true;
    cubeRoot.position.set(f.rider.s, f.rider.y + 0.3, -f.rider.d);
    cubeRoot.rotation.y = f.rider.mode === 'free' ? f.rider.pitch * 0.25 : 0;
    cubeRoot.scale.setScalar(0.25 + 0.75 * prog(t, FREEZE.at, FREEZE.at + 0.25, 'o'));
  };
  return {
    group,
    update(outcome, t) {
      placeCube(outcome, t);
      const mid = ARCH.lip / 12 + 1.1;
      poseCheer(outcome === 'clear' && t >= mid ? 1 : 0, t);
    },
    ambient(time) {
      cubeBob.position.y = 0.06 * Math.sin(time * 2.4);
      cubeBob.rotation.z = 0.04 * Math.sin(time * 1.9);
      cheer.forEach((c) => (c.p.sway.rotation.z = 0.04 * Math.sin(time * 1.5 + c.phase)));
    },
    reset() {
      cubeRoot.visible = false;
      poseCheer(0, 0);
    },
  };
}

export function buildPenguinParadeProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildFloe(kit), buildBerg(kit), buildArch(kit)];
}
