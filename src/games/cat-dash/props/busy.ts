/**
 * The 12 busy obstacles (grocery, library, fish market, construction site) as meshes. Each
 * builder returns a `Prop` whose `update(outcome, variant, t)` poses it at the same time as the
 * cat's move (`moves/busy.ts`); with a null outcome it is the idle motion before the answer,
 * driven by the clock.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { clamp01, lerp, smooth, type Kit, type Prop } from '../kit';
import {
  BEAM,
  CART_TOP,
  HANG_DY,
  HOOK_PIVOT,
  STACKS,
  barrelPose,
  beamAngle,
  bagUp,
  bookCartX,
  booksDrop,
  boxDrop,
  cartX,
  coverAngle,
  crateFall,
  crateShake,
  crateX,
  drumSpin,
  fishDrop,
  hookPos,
  ladderTip,
  ladderX,
  lidX,
  pourAmount,
  stackFall,
  towerTilt,
} from '../moves/busy';
import { createFrame, moveFrame } from '../moves';
import { beam, cyl, hash, makeProp as prop, sphere } from './parts';

const WOOD = 0x9a6a3c;
const BOOK_COLORS = [0xd9534f, 0x3f8fd8, 0xf2c14a, 0x5cb85c, 0x9b59b6, 0xff9f43];

/** A stack of books with their spines to the camera. */
function bookStack(kit: Kit, parent: Group, x: number, h: number, seed: number) {
  const g = new Group();
  g.position.set(x, 0, 0.1);
  parent.add(g);
  let y = 0;
  let i = 0;
  while (y < h - 0.01) {
    const bh = Math.min(0.3 + hash(seed + i) * 0.12, h - y);
    kit.box(
      1.0 - hash(seed + i + 9) * 0.12,
      bh,
      0.7,
      kit.lit(BOOK_COLORS[(seed + i) % BOOK_COLORS.length], 0.7),
      g,
      (hash(seed + i + 3) - 0.5) * 0.1,
      y + bh / 2,
      0,
    );
    kit.box(0.96, bh * 0.4, 0.02, kit.lit(0xfff3d0, 0.8), g, 0, y + bh / 2, 0.36);
    y += bh;
    i++;
  }
  return g;
}

/** A crate: an open box of slats. */
function crate(kit: Kit, parent: Group, w = 1.1, h = 1.2): Group {
  const g = new Group();
  parent.add(g);
  const wood = kit.lit(0xc9a15a, 0.85);
  const dark = kit.lit(0x8a6a38, 0.9);
  kit.box(w, 0.12, 0.7, dark, g, 0, 0.06, 0);
  for (const sz of [-1, 1]) {
    for (const y of [0.2, 0.55, 0.9]) {
      if (y + 0.12 < h) kit.box(w, 0.28, 0.06, wood, g, 0, y, sz * 0.32);
    }
  }
  for (const sx of [-1, 1]) kit.box(0.08, h, 0.7, dark, g, sx * (w / 2 - 0.04), h / 2, 0);
  return g;
}

/** A silvery fish lying flat (for crates and barrels). */
function fishShape(kit: Kit, parent: Group, scale = 1, color = 0xb9c6d4): Group {
  const g = new Group();
  parent.add(g);
  sphere(kit, 0.3 * scale, kit.lit(color, 0.35), g).scale.set(1.6, 0.6, 0.6);
  const tail = kit.mesh(
    new CylinderGeometry(0, 0.22 * scale, 0.3 * scale, 3),
    kit.lit(color, 0.4),
    g,
  );
  tail.position.x = -0.5 * scale;
  tail.rotation.z = Math.PI / 2;
  sphere(kit, 0.04 * scale, kit.lit(0x111111), g, 0.36 * scale, 0.06 * scale, 0.14 * scale);
  return g;
}

// ---------- Grocery ----------

function cart(): Prop {
  return prop((kit, root) => {
    const steel = kit.lit(0xc9d1d8, 0.35);
    const red = kit.lit(0xe0504a, 0.6);
    const c = new Group();
    root.add(c);
    kit.box(2.0, 0.08, 0.8, steel, c, 0, 0.62, 0.1);
    kit.box(2.2, 0.06, 0.06, steel, c, 0, CART_TOP, 0.46);
    kit.box(2.2, 0.06, 0.06, steel, c, 0, CART_TOP, -0.26);
    for (const z of [0.46, -0.26])
      for (const y of [0.9, 1.2]) kit.box(2.1, 0.04, 0.04, steel, c, 0, y, z);
    for (const x of [-1.05, 1.05]) {
      for (const z of [0.46, -0.26]) kit.box(0.05, 0.9, 0.05, steel, c, x, 1.05, z);
    }
    for (const x of [-0.8, 0.8]) kit.box(0.05, 0.9, 0.05, steel, c, x, 1.05, 0.46);
    beam(kit, steel, c, [-1.05, 1.5], [-1.5, 1.85], 0.06, 0.1);
    kit.box(0.06, 0.06, 0.9, red, c, -1.5, 1.85, 0.1);
    const wheels: Mesh[] = [];
    for (const [x, z] of [
      [-0.8, 0.4],
      [0.8, 0.4],
      [-0.8, -0.2],
      [0.8, -0.2],
    ] as const) {
      const w = cyl(kit, 0.16, 0.16, 0.08, kit.lit(0x222222, 0.7), c, x, 0.3, z);
      w.rotation.x = Math.PI / 2;
      wheels.push(w);
    }
    // Apples in the basket.
    const apple = kit.lit(0xe03a3a, 0.5);
    for (let i = 0; i < 5; i++) sphere(kit, 0.17, apple, c, -0.7 + i * 0.35, 0.8, 0.1);
    // The display of apples behind the cart's path.
    const display = new Group();
    display.position.set(9.6, 0, -1.0);
    root.add(display);
    kit.box(1.6, 0.5, 0.8, kit.lit(WOOD, 0.8), display, 0, 0.25, 0);
    const apples: { m: Mesh; x: number; y: number; vx: number; vy: number }[] = [];
    let n = 0;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4 - row; i++) {
        const x = -0.45 + row * 0.22 + i * 0.3;
        const y = 0.65 + row * 0.26;
        const m = sphere(kit, 0.15, kit.lit(n % 3 ? 0xe03a3a : 0x7ac943, 0.5), display, x, y, 0);
        apples.push({ m, x, y, vx: 1 + hash(n) * 2.4, vy: 2 + hash(n + 5) * 2.5 });
        n++;
      }
    }
    return (outcome, variant, t) => {
      const x = cartX(outcome, variant, t);
      c.position.set(x, 0, 0);
      c.rotation.z = outcome === 'fail' && variant === 1 && t > 1.25 ? 0.12 : 0;
      wheels.forEach((w) => (w.rotation.y = x * 3));
      const dt = outcome === 'fail' && variant === 1 ? Math.max(0, t - 1.25) : 0;
      apples.forEach((a) => {
        a.m.position.set(
          a.x + a.vx * dt,
          Math.max(0.15, a.y + a.vy * dt - 9 * dt * dt),
          hash(a.vx * 7) * dt,
        );
      });
    };
  });
}

function cereal(): Prop {
  return prop((kit, root) => {
    const tower = new Group();
    tower.position.set(5.6, 0, -0.5);
    root.add(tower);
    for (const x of [-0.55, 0.55])
      kit.box(0.3, 1.0, 0.5, kit.lit(0xb5543a, 0.8), tower, x, 0.5, -0.05);
    const colors = [0xf2c14a, 0xe0504a, 0x3f8fd8, 0x5cb85c, 0xff9f43];
    const rows: Group[] = [];
    for (let r = 0; r < 3; r++) {
      const g = new Group();
      g.position.y = 1.0 + 1.07 * r + 0.535;
      tower.add(g);
      kit.box(1.5, 1.05, 0.7, kit.lit(colors[(r * 2) % 5], 0.6), g, 0, 0, 0);
      kit.box(1.2, 0.7, 0.02, kit.lit(0xffffff, 0.6), g, 0, 0, 0.36);
      sphere(kit, 0.22, kit.lit(colors[(r * 2 + 1) % 5], 0.5), g, 0, 0, 0.38);
      rows.push(g);
    }
    // The cereal box that falls on the cat.
    const drop = kit.box(0.8, 0.9, 0.6, kit.lit(0xe0504a, 0.6), root, 5, 4, 0.1);
    drop.visible = false;
    return (outcome, variant, t) => {
      tower.rotation.z = towerTilt(outcome, variant, t);
      const fail1 = outcome === 'fail' && variant === 1;
      rows[2].visible = true;
      const u = fail1 ? boxDrop(t) : 0;
      drop.visible = fail1 && u > 0 && u < 1;
      drop.position.set(lerp(5.2, 4.9, u), lerp(4.2, 1.3, u * u), 0.1);
      drop.rotation.z = u * 1.2;
    };
  });
}

function milk(): Prop {
  return prop((kit, root) => {
    const white = kit.lit(0xfdfdf5, 0.3);
    const puddle = cyl(kit, 1, 1, 0.03, white, root, 6.2, 0.02, 0.2);
    puddle.scale.set(2.8, 1, 1.6);
    cyl(kit, 1, 1, 0.03, white, root, 4.3, 0.02, 0.5).scale.set(0.8, 1, 0.6);
    cyl(kit, 1, 1, 0.03, white, root, 8.4, 0.02, 0.4).scale.set(0.9, 1, 0.7);
    // The tipped-over carton behind the puddle.
    const carton = new Group();
    carton.position.set(8.7, 0.45, -0.7);
    carton.rotation.z = 1.2;
    root.add(carton);
    kit.box(0.8, 1.4, 0.8, kit.lit(0x3f8fd8, 0.6), carton);
    kit.box(0.82, 0.5, 0.82, kit.lit(0xffffff, 0.6), carton, 0, 0.1, 0);
    kit.mesh(new BoxGeometry(0.8, 0.4, 0.8), kit.lit(0xffffff, 0.6), carton, 0, 0.9, 0);
    // The lid the cat surfs on.
    const lid = cyl(kit, 0.5, 0.5, 0.08, kit.lit(0xe0504a, 0.4), root, 4, 0.08, 0.2);
    return (outcome, variant, t) => {
      lid.position.x = lidX(outcome, variant, t);
      lid.position.y = 0.08 + (outcome === null ? 0.02 * Math.sin(t * 3) : 0);
    };
  });
}

// ---------- Library ----------

function books(): Prop {
  return prop((kit, root) => {
    const stacks = STACKS.map((s, i) => bookStack(kit, root, s.x, s.h, i * 11 + 2));
    // The big book that claps shut.
    const base = new Group();
    base.position.set(8.8, 0, 0.3);
    root.add(base);
    kit.box(1.0, 0.1, 0.8, kit.lit(0xfff3d0, 0.8), base, 0.5, 0.06, 0);
    const hinge = new Group();
    base.add(hinge);
    const cover = kit.box(1.0, 0.1, 0.84, kit.lit(0x8f3a3a, 0.7), hinge, 0.5, 0.05, 0);
    kit.box(0.7, 0.02, 0.5, kit.lit(0xf2c14a, 0.5), hinge, 0.5, 0.11, 0);
    void cover;
    return (outcome, variant, t) => {
      const fall = stackFall(outcome, variant, t);
      stacks.forEach((g, i) => {
        g.rotation.z = -1.25 * fall * (0.7 + 0.1 * i);
        g.position.x = STACKS[i].x - fall * 0.2 * i;
        g.position.y = fall * 0.05;
      });
      hinge.rotation.z = coverAngle(outcome, variant, t) * 1.0;
    };
  });
}

function ladder(): Prop {
  return prop((kit, root) => {
    // The rail along the shelves at the back.
    kit.box(14, 0.14, 0.14, kit.lit(0x5a3a24, 0.7), root, 6, 4.4, -0.9);
    const g = new Group();
    root.add(g);
    const wood = kit.lit(0xb98a5e, 0.7);
    for (const x of [-0.45, 0.45]) kit.box(0.12, 4.0, 0.14, wood, g, x, 2.0, 0);
    for (let y = 0.5; y < 4.0; y += 0.45) kit.box(0.9, 0.08, 0.1, wood, g, 0, y, 0);
    const wheels: Mesh[] = [];
    for (const x of [-0.45, 0.45]) {
      const w = cyl(kit, 0.14, 0.14, 0.1, kit.lit(0x333333, 0.6), g, x, 0.14, 0);
      w.rotation.x = Math.PI / 2;
      wheels.push(w);
    }
    kit.box(0.3, 0.2, 0.3, kit.lit(0x333333, 0.5), g, 0, 4.0, -0.5);
    return (outcome, variant, t) => {
      const x = ladderX(outcome, variant, t);
      g.position.x = x + (outcome === null ? 0.25 * Math.sin(t * 1.2) : 0);
      g.rotation.z = -ladderTip(outcome, variant, t);
      wheels.forEach((w) => (w.rotation.y = x * 4));
    };
  });
}

function bookCart(): Prop {
  return prop((kit, root) => {
    const c = new Group();
    root.add(c);
    const wood = kit.lit(0x8a5a3c, 0.7);
    kit.box(2.0, 0.1, 0.8, wood, c, 0, 0.5, 0);
    kit.box(2.0, 0.1, 0.8, wood, c, 0, 1.2, 0);
    kit.box(2.0, 0.1, 0.8, wood, c, 0, 1.9, 0);
    for (const x of [-0.95, 0.95]) kit.box(0.1, 1.5, 0.8, wood, c, x, 1.2, 0);
    for (const [y, seed] of [
      [0.65, 3],
      [1.35, 8],
    ] as const) {
      for (let i = 0; i < 6; i++) {
        kit.box(
          0.24,
          0.5,
          0.6,
          kit.lit(BOOK_COLORS[(seed + i) % 6], 0.7),
          c,
          -0.75 + i * 0.3,
          y + 0.25,
          0,
        );
      }
    }
    const wheels: Mesh[] = [];
    for (const x of [-0.75, 0.75]) {
      const w = cyl(kit, 0.18, 0.18, 0.1, kit.lit(0x222222, 0.7), c, x, 0.2, 0.35);
      w.rotation.x = Math.PI / 2;
      wheels.push(w);
    }
    // Books on top of the cart; in fail 1 they fall on the cat.
    const loose = [0, 1, 2].map((i) =>
      kit.box(
        0.7,
        0.18,
        0.5,
        kit.lit(BOOK_COLORS[i * 2], 0.7),
        root,
        5.6 + i * 0.4,
        2.1 + i * 0.2,
        0.1,
      ),
    );
    return (outcome, variant, t) => {
      const x = bookCartX(outcome, variant, t);
      c.position.x = x;
      wheels.forEach((w) => (w.rotation.y = x * 3));
      const u = booksDrop(outcome, variant, t);
      loose.forEach((b, i) => {
        if (outcome === 'fail' && variant === 1) {
          b.position.set(
            lerp(5.6 + i * 0.4, 4.0 + i * 0.35, u),
            lerp(2.1 + i * 0.2, 0.1 + i * 0.12, u * u),
            0.1,
          );
          b.rotation.z = u * (0.8 - i * 0.6);
        } else {
          b.position.set(x - 0.4 + i * 0.4, 2.1 + i * 0.2, 0.1);
          b.rotation.z = 0;
        }
      });
    };
  });
}

// ---------- Fish market ----------

const CRATE_REST = [
  { x: 6.4, y: 0.35, r: 0.5 },
  { x: 8.1, y: 0.3, r: -0.3 },
];

function crates(): Prop {
  return prop((kit, root) => {
    const a = crate(kit, root);
    a.position.set(4.5, 0, 0.1);
    const b1 = crate(kit, root);
    b1.position.set(5.7, 0, 0.1);
    const b2 = crate(kit, root);
    b2.position.set(5.7, 1.2, 0.1);
    const c = crate(kit, root);
    c.position.set(6.9, 0, 0.1);
    for (const g of [a, b1, b2, c]) {
      for (let i = 0; i < 3; i++) {
        fishShape(kit, g, 0.7, i % 2 ? 0xb9c6d4 : 0xf2a65a).position.set(
          -0.25 + i * 0.25,
          1.0 + i * 0.01,
          0.0,
        );
        g.children[g.children.length - 1].rotation.y = i * 0.5;
      }
    }
    return (outcome, variant, t) => {
      const f = crateFall(outcome, variant, t);
      b2.position.set(
        lerp(5.7, CRATE_REST[0].x, f),
        lerp(1.2, CRATE_REST[0].y, f) + Math.sin(Math.PI * f) * 0.8,
        0.1,
      );
      b2.rotation.z = f * CRATE_REST[0].r;
      c.position.set(
        outcome === 'fail' && variant === 0
          ? lerp(6.9, CRATE_REST[1].x, f)
          : crateX(outcome, variant, t),
        outcome === 'fail' && variant === 0 ? lerp(0, CRATE_REST[1].y - 0.3, f) : 0,
        0.1,
      );
      c.rotation.z =
        outcome === 'fail' && variant === 0 ? f * CRATE_REST[1].r : crateShake(outcome, variant, t);
      if (outcome === 'fail' && variant === 1 && t > 1.45)
        c.rotation.z = -0.5 * smooth((t - 1.45) / 0.2);
    };
  });
}

function barrels(): Prop {
  return prop((kit, root) => {
    const blue = kit.lit(0x3f7fd8, 0.6);
    const band = kit.lit(0x9aa5ad, 0.4);
    const make = (x: number) => {
      const g = new Group();
      g.position.set(x, 0.75, 0.1);
      root.add(g);
      const body = cyl(kit, 0.6, 0.6, 1.5, blue, g);
      body.scale.z = 1;
      for (const y of [-0.5, 0.5]) cyl(kit, 0.62, 0.62, 0.1, band, g, 0, y, 0);
      cyl(kit, 0.5, 0.5, 0.04, kit.lit(0xb9c6d4, 0.35), g, 0, 0.74, 0);
      return g;
    };
    make(4.6);
    const mid = make(5.8);
    mid.children[3].visible = false;
    // Fish heaped in the open barrel.
    for (let i = 0; i < 4; i++) {
      fishShape(kit, mid, 0.6, i % 2 ? 0xb9c6d4 : 0xf2a65a).position.set(
        -0.25 + i * 0.18,
        0.72,
        0.0,
      );
      mid.children[mid.children.length - 1].rotation.y = i * 0.7;
    }
    const third = make(7.0);
    // The fish the cat carries off in its mouth (fail 0).
    const fish = fishShape(kit, root, 0.7, 0xf2a65a);
    fish.visible = false;
    const f = createFrame();
    return (outcome, variant, t) => {
      const p = barrelPose(outcome, variant, t);
      third.position.set(p.x, lerp(0.75, 0.62, p.tip), 0.1);
      third.rotation.set(
        0,
        outcome === 'clear' ? p.roll : 0,
        p.tip * (-Math.PI / 2) + (outcome === 'fail' ? p.roll : 0),
      );
      const on = outcome === 'fail' && variant === 0 && t >= 1.05;
      fish.visible = on;
      if (on) {
        moveFrame('barrels', 'fail', 0, t, f);
        fish.position.set(f.x + 0.85, f.y + 0.5, 0.2);
        fish.rotation.z = 0.5 + 0.15 * Math.sin(t * 14);
      }
    };
  });
}

function net(): Prop {
  return prop((kit, root) => {
    const pole = kit.lit(0x8a6a38, 0.8);
    for (const x of [4.7, 7.3]) kit.box(0.2, 3.5, 0.2, pole, root, x, 1.75, -0.5);
    kit.box(2.9, 0.18, 0.2, pole, root, 6, 3.45, -0.5);
    const rope = kit.lit(0xe8d6a0, 0.9);
    const curtain = new Group();
    root.add(curtain);
    for (let x = 5.1; x <= 6.95; x += 0.25) kit.box(0.04, 2.5, 0.04, rope, curtain, x, 2.2, -0.35);
    for (let y = 1.0; y <= 3.4; y += 0.25) kit.box(1.9, 0.04, 0.04, rope, curtain, 6, y, -0.35);
    for (let i = 0; i < 5; i++)
      sphere(kit, 0.12, kit.lit(0xe0504a, 0.6), curtain, 5.2 + i * 0.4, 0.9, -0.35);
    // The bag the cat is caught in (fail 0).
    const bag = new Mesh(new SphereGeometry(0.9, 12, 8), kit.glass(0xe8d6a0, 0.5));
    kit.geometries.push(bag.geometry);
    bag.visible = false;
    root.add(bag);
    // The big fish that flops down (fail 1).
    const fish = fishShape(kit, root, 1.6, 0x6fa8dc);
    fish.visible = false;
    const f = createFrame();
    return (outcome, variant, t) => {
      curtain.rotation.z = outcome === null ? 0.03 * Math.sin(t * 1.5) : 0;
      const up = outcome === 'fail' && variant === 0 ? bagUp(t) : 0;
      bag.visible = up > 0.02 || (outcome === 'fail' && variant === 0 && t > 0.95 && t < 2.0);
      if (bag.visible) {
        moveFrame('net', 'fail', 0, t, f);
        bag.position.set(f.x, f.y + 0.55, 0.15);
        bag.scale.setScalar(0.7 + 0.3 * smooth((t - 0.9) / 0.2));
      }
      const fl = outcome === 'fail' && variant === 1;
      fish.visible = fl && t > 0.4 && t < 1.85;
      if (fish.visible) {
        const u = fishDrop(t);
        const away = smooth((t - 1.35) / 0.45);
        fish.position.set(lerp(5.0, 5.0, u) + 3 * away, lerp(6, 0.9, u * u) + 5 * away, 0.2);
        fish.rotation.z = t > 0.75 ? 0.5 * Math.sin(t * 18) * (1 - away) : -0.4;
      }
    };
  });
}

// ---------- Construction site ----------

function girder(): Prop {
  return prop((kit, root) => {
    // The pit: a flat dark floor area with hazard edges.
    kit.box(4.2, 0.02, 3.4, kit.lit(0x1b1612, 1), root, 6, 0.03, -0.4);
    for (const x of [3.85, 8.15]) {
      for (let i = 0; i < 8; i++) {
        kit.box(
          0.2,
          0.03,
          0.4,
          kit.lit(i % 2 ? 0xf2c230 : 0x222222, 0.8),
          root,
          x,
          0.04,
          -1.9 + i * 0.4,
        );
      }
    }
    // Sandbags at the bottom of the pit.
    const bag = kit.lit(0xc9b27c, 0.95);
    for (const [x, y] of [
      [5.5, 0.18],
      [6.4, 0.18],
      [5.95, 0.5],
    ] as const) {
      sphere(kit, 0.45, bag, root, x, y, -0.1).scale.set(1.1, 0.6, 0.8);
    }
    // Trestles behind the beam, and the beam itself.
    const steel = kit.lit(0x4a6fa5, 0.45);
    for (const x of [4.3, 7.7]) kit.box(0.3, 1.5, 0.3, kit.lit(0xf2c230, 0.5), root, x, 0.75, -0.7);
    const g = new Group();
    g.position.set(BEAM.x, BEAM.y, 0);
    root.add(g);
    kit.box(2 * BEAM.half, 0.1, 0.5, steel, g, 0, -0.05, 0);
    kit.box(2 * BEAM.half, 0.1, 0.5, steel, g, 0, -0.35, 0);
    kit.box(2 * BEAM.half, 0.3, 0.1, steel, g, 0, -0.2, 0);
    kit.box(0.3, 0.2, 0.3, kit.lit(0xf2c230, 0.5), g, 0, -0.15, -0.3);
    return (outcome, variant, t) => {
      g.rotation.z = beamAngle(outcome, variant, t);
    };
  });
}

function mixer(): Prop {
  return prop((kit, root) => {
    const orange = kit.lit(0xf2832e, 0.5);
    const grey = kit.lit(0x6f7580, 0.5);
    // The frame and the wheels.
    kit.box(2.4, 0.2, 0.9, grey, root, 6, 0.35, 0);
    for (const x of [5.2, 6.8])
      cyl(kit, 0.3, 0.3, 0.2, kit.lit(0x222222, 0.7), root, x, 0.3, 0.4).rotation.x = Math.PI / 2;
    beam(kit, grey, root, [5.3, 0.4], [6.0, 1.5], 0.16, 0.2);
    beam(kit, grey, root, [6.7, 0.4], [6.0, 1.5], 0.16, 0.2);
    // The tilted drum; the inside group spins.
    const tilt = new Group();
    tilt.position.set(6, 1.55, 0.1);
    tilt.rotation.z = 0.5;
    root.add(tilt);
    const spin = new Group();
    tilt.add(spin);
    kit.mesh(new CylinderGeometry(0.55, 1.0, 1.0, 20), orange, spin, 0, 0.6, 0);
    kit.mesh(new CylinderGeometry(1.0, 0.7, 0.8, 20), orange, spin, 0, -0.3, 0);
    kit.mesh(new CylinderGeometry(0.7, 0.5, 0.5, 20), orange, spin, 0, -0.95, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      kit.box(
        0.12,
        1.4,
        0.06,
        kit.lit(0xffffff, 0.5),
        spin,
        Math.cos(a) * 0.95,
        0.1,
        Math.sin(a) * 0.95,
      ).rotation.y = -a;
    }
    // The cement poured out of the drum (fail 0).
    const stream = cyl(kit, 0.12, 0.2, 1, kit.lit(0x9a9a9a, 0.8), root, 4.6, 0.5, 0.2);
    const puddle = cyl(kit, 0.6, 0.6, 0.06, kit.lit(0x9a9a9a, 0.8), root, 4.4, 0.04, 0.3);
    return (outcome, variant, t) => {
      spin.rotation.y = drumSpin(outcome, variant, t);
      const p = pourAmount(outcome, variant, t);
      stream.visible = p > 0.02;
      stream.scale.y = Math.max(0.01, p * 1.1);
      stream.position.y = 0.95 - 0.45 * p;
      puddle.scale.set(p * 1.4 + 0.01, 1, p * 1.1 + 0.01);
    };
  });
}

function craneHook(): Prop {
  return prop((kit, root) => {
    const yellow = kit.lit(0xf2c230, 0.5);
    const dark = kit.lit(0x3a3a40, 0.5);
    // The rail and its mast at the back.
    kit.box(10, 0.3, 0.3, yellow, root, 6, 5.35, -0.7);
    kit.box(0.4, 5.4, 0.4, yellow, root, 10.6, 2.7, -0.9);
    kit.box(1.0, 0.5, 0.5, dark, root, HOOK_PIVOT.x, 5.0, -0.5);
    const cable = kit.box(0.06, 1, 0.06, dark, root, 6, 3, -0.4);
    const hook = new Group();
    root.add(hook);
    kit.box(0.5, 0.3, 0.3, yellow, hook, 0, -0.15, 0);
    kit.mesh(
      new TorusGeometry(0.28, 0.07, 8, 16, Math.PI * 1.4),
      dark,
      hook,
      0,
      -0.62,
      0,
    ).rotation.z = Math.PI * 0.8;
    return (outcome, variant, t) => {
      const h = hookPos(outcome, variant, outcome === null ? t : t);
      hook.position.set(h.x, h.y, 0);
      const dx = h.x - HOOK_PIVOT.x;
      const dy = HOOK_PIVOT.y - 0.2 - h.y;
      const len = Math.hypot(dx, dy);
      cable.scale.x = 1;
      cable.scale.y = len;
      cable.position.set((h.x + HOOK_PIVOT.x) / 2, (h.y + HOOK_PIVOT.y - 0.2) / 2, -0.4);
      cable.rotation.z = Math.atan2(dx, dy);
    };
  });
}

void [clamp01, HANG_DY];

/** One builder per obstacle id. */
export const BUSY_PROPS = {
  cart,
  cereal,
  milk,
  books,
  ladder,
  'book-cart': bookCart,
  crates,
  barrels,
  net,
  girder,
  mixer,
  'crane-hook': craneHook,
} as const;
