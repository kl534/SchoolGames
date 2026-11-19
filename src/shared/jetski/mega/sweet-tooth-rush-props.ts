/**
 * The props of Sweet Tooth Rush: a giant red gummy bear whose belly squashes and boings, a floating
 * pink-iced donut with sprinkles, and a waffle-cone ramp with a glass sundae, a cherry that pops
 * and a splash of whipped cream. Painted primitives, built once and only moved.
 */
import {
  CylinderGeometry,
  Group,
  SphereGeometry,
  TorusGeometry,
  type Mesh,
  type Object3D,
} from 'three';
import { TAU, clamp01, prog } from '../anim';
import type { Kit } from '../kit';
import {
  BEAR,
  DONUT,
  GLAZE,
  MELT,
  SUNDAE,
  SUNDAE_OVER,
  T_BOING,
  T_LOW,
  T_MELT,
  bearY,
  bellySquash,
  coneY,
  donutRampY,
} from './sweet-tooth-rush';
import { profile, type MegaBuilt } from './props-kit';

const GUMMY = [0xe8283c, 0xff5468];
const SPRINKLES = [0xffd23f, 0x4fd6c4, 0xffffff, 0x7a5cff, 0xff4f6f];

/** A ball scaled into an ellipsoid. */
function blob(
  kit: Kit,
  parent: Object3D,
  material: ReturnType<Kit['lit']>,
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

function buildBear(kit: Kit): MegaBuilt {
  const group = new Group();
  const belly = profile(
    kit,
    group,
    bearY,
    BEAR.foot,
    BEAR.end,
    0.8,
    -1.2,
    BEAR.halfWidth,
    GUMMY[0],
    GUMMY[1],
  );
  const red = kit.lit(GUMMY[0], 0.25);
  const light = kit.lit(0xff8a99, 0.3);
  const dark = kit.lit(0x3a1218, 0.4);
  // The bear lies on its back, head down the course, arms and feet out to the sides.
  const head = new Group();
  head.position.set(0, 1.5, -(BEAR.end + 2.2));
  group.add(head);
  blob(kit, head, red, 1.7, 0, 0, 0);
  for (const side of [-1, 1]) {
    blob(kit, head, red, 0.65, side * 1.25, 1.35, 0);
    blob(kit, head, light, 0.38, side * 1.25, 1.35, 0.3);
    blob(kit, head, dark, 0.2, side * 0.6, 0.45, 1.5);
  }
  blob(kit, head, light, 0.75, 0, -0.35, 1.35, 1, 0.8, 0.8);
  blob(kit, head, dark, 0.22, 0, -0.1, 2.0);
  const arms = [-1, 1].map((side) => {
    const arm = new Group();
    arm.position.set(side * 3.5, 1.2, -(BEAR.top + 0.8));
    group.add(arm);
    blob(kit, arm, red, 1.0, 0, 0, 0, 0.8, 1, 1.5);
    return arm;
  });
  for (const side of [-1, 1]) {
    blob(kit, group, red, 1.2, side * 3.1, 0.9, -(BEAR.foot + 1.5), 1, 1, 1.3);
    blob(kit, group, light, 0.65, side * 3.1, 1.05, -(BEAR.foot + 0.3), 1, 1, 0.5);
  }
  const pose = (squash: number, time: number, wave: number) => {
    belly.scale.y = squash;
    head.rotation.z = 0.05 * Math.sin(time * 1.8);
    arms.forEach(
      (arm, i) => (arm.rotation.z = (i ? 1 : -1) * (0.25 * Math.sin(time * 2 + i) + wave)),
    );
  };
  return {
    group,
    update(outcome, t) {
      const hit = outcome === 'clear' ? T_BOING : T_LOW;
      pose(bellySquash(t, hit), t, prog(t, hit, hit + 0.3, 'o') * 0.8);
    },
    ambient: (time) => pose(1, time, 0),
    reset: () => pose(1, 0, 0),
  };
}

function buildDonut(kit: Kit): MegaBuilt {
  const group = new Group();
  profile(
    kit,
    group,
    donutRampY,
    DONUT.rampFoot,
    DONUT.lip,
    0.75,
    -1.4,
    DONUT.rampHalfWidth,
    0xff9ccf,
    0xffffff,
  );
  const mid = (DONUT.outer + DONUT.hole) / 2;
  const tube = (DONUT.outer - DONUT.hole) / 2;
  const ring = new Group();
  ring.position.set(0, DONUT.cy, -DONUT.d);
  group.add(ring);
  const dough = kit.lit(0xe8b26a, 0.7);
  const icing = kit.lit(0xff8fc7, 0.35);
  kit.mesh(new TorusGeometry(mid, tube, 12, 28), dough, ring);
  // The icing covers the face towards the ski.
  const iced = kit.mesh(new TorusGeometry(mid, tube * 1.04, 12, 28), icing, ring, 0, 0, 0.3);
  iced.scale.z = 0.6;
  const colors = SPRINKLES.map((c) => kit.lit(c, 0.5));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + (i % 3) * 0.07;
    const r = mid + (((i * 37) % 11) - 5) * 0.12;
    const bit = kit.box(
      0.5,
      0.14,
      0.14,
      colors[i % colors.length],
      ring,
      Math.cos(a) * r,
      Math.sin(a) * r,
      tube * 0.75,
    );
    bit.rotation.z = a + (i % 5);
  }
  const idle = (time: number, wobble: number) => {
    ring.rotation.z = 0.25 * time;
    ring.position.y = DONUT.cy + 0.1 * Math.sin(time * 1.6);
    ring.rotation.x = wobble;
  };
  return {
    group,
    update(outcome, t) {
      // A clipped donut rocks back and forth and settles.
      const since = t - GLAZE.at;
      const wobble =
        outcome === 'fail' && since > 0 ? 0.3 * Math.exp(-2.2 * since) * Math.sin(since * 11) : 0;
      idle(t, wobble);
    },
    ambient: (time) => idle(time, 0),
    reset: () => idle(0, 0),
  };
}

function buildSundae(kit: Kit): MegaBuilt {
  const group = new Group();
  // The waffle-cone ramp, with a scoop on each side of its foot.
  profile(
    kit,
    group,
    coneY,
    SUNDAE.rampFoot,
    SUNDAE.lip,
    0.75,
    -1.4,
    SUNDAE.rampHalfWidth,
    0xe3a857,
    0xc98a3e,
  );
  const pink = kit.lit(0xff8fc7, 0.4);
  const mint = kit.lit(0x8ff0dc, 0.4);
  blob(kit, group, pink, 1.2, 3.3, 1.1, -(SUNDAE.rampFoot + 2));
  blob(kit, group, mint, 1.1, -3.3, 1.0, -(SUNDAE.rampFoot + 4));
  const sundae = new Group();
  sundae.position.set(0, 0, -SUNDAE.d);
  group.add(sundae);
  const glass = kit.glass(0xbfeaff, 0.45);
  const cream = kit.lit(0xfffaf5, 0.6);
  kit.mesh(new CylinderGeometry(1.7, 1.9, 0.3, 18), glass, sundae, 0, 0.15, 0);
  kit.mesh(new CylinderGeometry(0.45, 0.6, 1.5, 12), glass, sundae, 0, 0.9, 0);
  kit.mesh(
    new SphereGeometry(SUNDAE.radius, 20, 12, 0, TAU, Math.PI / 2, Math.PI / 2),
    glass,
    sundae,
    0,
    3.8,
    0,
  );
  blob(kit, sundae, kit.lit(0xff8fc7, 0.5), 1.45, -1.0, 3.9, 0.3);
  blob(kit, sundae, kit.lit(0x8ff0dc, 0.5), 1.45, 1.0, 3.9, -0.3);
  blob(kit, sundae, kit.lit(0x8a5a3c, 0.5), 1.4, 0, 4.9, 0);
  blob(kit, sundae, cream, 1.5, 0, 5.6, 0, 1, 0.55, 1);
  blob(kit, sundae, cream, 1.0, 0, 6.1, 0, 1, 0.6, 1);
  const cherryHome = SUNDAE.cherryY - 0.5;
  const cherry = new Group();
  sundae.add(cherry);
  blob(kit, cherry, kit.lit(0xd81a35, 0.2), 0.5, 0, 0, 0);
  kit.mesh(
    new CylinderGeometry(0.04, 0.04, 0.6, 6),
    kit.lit(0x3d7a33, 0.6),
    cherry,
    0.1,
    0.55,
    0,
  ).rotation.z = -0.4;
  cherry.position.y = cherryHome;
  // The whipped cream that splashes: blobs thrown out from a spot, in the splash's own group.
  const splash = new Group();
  group.add(splash);
  const puffs = Array.from({ length: 8 }, (_, i) => ({
    mesh: blob(kit, splash, cream, 0.5, 0, 0, 0),
    angle: (i / 8) * TAU,
    speed: 2.5 + (i % 3) * 0.9,
    lift: 4.5 + (i % 4) * 0.7,
  }));
  const puff = (tau: number, floor: number) => {
    puffs.forEach((p) => {
      const y = p.lift * tau - 9 * tau * tau;
      const live = tau >= 0 && tau < 1.2 && y > floor;
      p.mesh.visible = live;
      if (live) {
        p.mesh.position.set(
          Math.cos(p.angle) * p.speed * tau,
          y,
          Math.sin(p.angle) * p.speed * tau,
        );
        p.mesh.scale.setScalar(1 - 0.5 * clamp01(tau / 1.2));
      }
    });
  };
  const place = (outcome: 'clear' | 'fail', t: number, time: number) => {
    sundae.rotation.z = 0.02 * Math.sin(time * 1.5);
    cherry.position.set(0, cherryHome, 0);
    cherry.visible = true;
    if (outcome === 'clear') {
      // The cherry pops up as the ski flies over and drops back before it lands.
      const x = clamp01((t - SUNDAE_OVER) / 1.2);
      cherry.position.y = cherryHome + (x > 0 && x < 1 ? 3.4 * 4 * x * (1 - x) : 0);
      splash.position.set(0, 0, -SUNDAE.land);
      puff(t - (SUNDAE_OVER + 1.3), 0);
    } else {
      // Clipped: the glass rocks, the cherry is flung off and the cream flies up.
      const hit = T_MELT;
      const since = t - hit;
      if (since > 0) {
        sundae.rotation.z += 0.12 * Math.exp(-3 * since) * Math.sin(since * 12);
        const k = Math.min(since, 1.5);
        cherry.position.set(0.8 * k * 2, Math.max(cherryHome + 4.5 * k - 9 * k * k, 0.2), k * 4);
      }
      splash.position.set(0, MELT.hitY - 0.6, -SUNDAE.d);
      puff(since, -3);
    }
  };
  return {
    group,
    update: (outcome, t) => place(outcome, t, t),
    ambient: (time) => {
      sundae.rotation.z = 0.02 * Math.sin(time * 1.5);
    },
    reset: () => {
      place('clear', 0, 0);
    },
  };
}

export function buildSweetToothRushProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildBear(kit), buildDonut(kit), buildSundae(kit)];
}
