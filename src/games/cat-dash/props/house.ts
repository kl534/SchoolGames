/**
 * The 12 house obstacles as meshes. Each builder returns a `Prop` whose `update(outcome, variant,
 * t)` poses it at the same time as the cat's move (`moves/house.ts`); with a null outcome it is
 * the idle motion before the answer, driven by the clock.
 */
import { CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Material } from 'three';
import { Kit, clamp01, lerp, smooth, type Prop } from '../kit';
import {
  MOP,
  ROLL_R,
  SHELF_TIP,
  TOWEL,
  basketTumbleX,
  closetDoor,
  mopAngle,
  rollX,
  shelfAngle,
  towelAngle,
  yarnX,
} from '../moves/house';
import { createFrame, moveFrame } from '../moves';
import type { Outcome, Variant } from '../rules';

type Pose = (outcome: Outcome | null, variant: Variant, t: number) => void;

/** Wraps a builder: it fills `root` with meshes and returns the function that poses them. */
function prop(setup: (kit: Kit, root: Group) => Pose): Prop {
  const kit = new Kit();
  const object = new Group();
  const pose = setup(kit, object);
  return {
    object,
    update: pose,
    reset: () => pose(null, 0, 0),
    dispose: () => {
      kit.dispose();
      object.removeFromParent();
    },
  };
}

const sphere = (kit: Kit, r: number, mat: Material, parent: Group, x = 0, y = 0, z = 0) =>
  kit.mesh(new SphereGeometry(r, 28, 20), mat, parent, x, y, z);
const cyl = (
  kit: Kit,
  rt: number,
  rb: number,
  h: number,
  mat: Material,
  parent: Group,
  x = 0,
  y = 0,
  z = 0,
) => kit.mesh(new CylinderGeometry(rt, rb, h, 24), mat, parent, x, y, z);

/** 0 to 1 and back: a dip of width `w` centred on each time in `times`. */
const dip = (t: number, times: readonly number[], w = 0.14) =>
  times.reduce((m, at) => Math.max(m, Math.sin(Math.PI * clamp01((t - at + w / 2) / w))), 0);

/** A tidy pseudo-random number from an index. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const WOOD = 0x9a6a3c;
const DARK_WOOD = 0x6b4526;

// ---------- Living room ----------

function couch(): Prop {
  return prop((kit, root) => {
    const red = kit.fabric(0xb5483a);
    const darkRed = kit.fabric(0x8e3328);
    kit.box(4.4, 0.55, 1.2, darkRed, root, 6, 0.275, 0);
    const cushionA = new Group();
    cushionA.position.set(4.9, 0.55, 0);
    root.add(cushionA);
    kit.box(2.1, 0.35, 1.1, red, cushionA, 0, 0.175, 0);
    const cushionB = new Group();
    cushionB.position.set(7.1, 0.55, 0);
    root.add(cushionB);
    kit.box(2.1, 0.35, 1.1, red, cushionB, 0, 0.175, 0);
    kit.box(0.8, 1.3, 1.3, darkRed, root, 3.4, 0.65, 0);
    kit.box(0.8, 1.3, 1.3, darkRed, root, 8.6, 0.65, 0);
    kit.box(6, 1.4, 0.45, red, root, 6, 1.2, -0.7);
    for (const x of [3.2, 8.8]) {
      for (const z of [-0.5, 0.5]) kit.box(0.15, 0.2, 0.15, kit.lit(DARK_WOOD), root, x, 0.1, z);
    }
    return (outcome, variant, t) => {
      cushionA.scale.y = 1;
      cushionA.position.x = 4.9;
      cushionB.scale.set(1, 1, 1);
      cushionB.position.x = 7.1;
      cushionB.visible = true;
      if (outcome === 'clear' && variant === 0) cushionA.scale.y = 1 - 0.45 * dip(t, [0.5], 0.2);
      if (outcome === 'fail' && variant === 0) {
        // The cat sinks between the cushions, then the second one ends up on its head.
        const sink = smooth((t - 0.5) / 0.2) * (1 - smooth((t - 1.35) / 0.3));
        cushionA.position.x = 4.9 - 0.35 * sink;
        cushionA.scale.y = 1 - 0.3 * sink;
        cushionB.position.x = 7.1 + 0.35 * sink;
        cushionB.visible = t < 1.45;
      }
      if (outcome === 'fail' && variant === 1) cushionA.scale.y = 1 - 0.4 * dip(t, [0.6], 0.2);
    };
  });
}

function bookshelf(): Prop {
  return prop((kit, root) => {
    const wood = kit.wood(WOOD);
    const dark = kit.wood(DARK_WOOD);
    // Everything hangs on `shelf`, which pivots about its bottom right corner when it tips.
    const shelf = new Group();
    shelf.position.set(SHELF_TIP.pivotX, 0, 0);
    root.add(shelf);
    const cx = -1.2; // the middle of the shelf relative to the pivot
    kit.box(0.16, 5, 1.0, wood, shelf, cx - 1.12, 2.5, 0);
    kit.box(0.16, 5, 1.0, wood, shelf, cx + 1.12, 2.5, 0);
    kit.box(2.4, 5, 0.08, dark, shelf, cx, 2.5, -0.46);
    for (const y of [0.1, 1.2, 2.5, 3.8, 4.95]) kit.box(2.4, 0.14, 1.0, wood, shelf, cx, y, 0);
    const colors = [0xd64550, 0x3f8fd8, 0xf2b134, 0x4cae6b, 0x8a5fc4, 0xe0793a];
    interface Book {
      mesh: Mesh;
      home: { x: number; y: number };
      end: { x: number; z: number; rot: number };
      delay: number;
    }
    const books: Book[] = [];
    let n = 0;
    for (const shelfY of [1.27, 2.57, 3.87]) {
      for (let i = 0; i < 6; i++) {
        const h = 0.55 + hash(n) * 0.35;
        const mesh = kit.box(0.26, h, 0.5, kit.lit(colors[(n + i) % colors.length], 0.7), shelf);
        const x = cx - 0.95 + i * 0.32;
        mesh.position.set(x, shelfY + h / 2, -0.15);
        books.push({
          mesh,
          home: { x, y: shelfY + h / 2 },
          end: {
            x: -0.6 + hash(n + 9) * 1.6 - cx + cx,
            z: hash(n + 4) * 0.6 - 0.2,
            rot: hash(n + 2) * 3,
          },
          delay: 0.55 + hash(n + 1) * 0.3,
        });
        n++;
      }
    }
    return (outcome, variant, t) => {
      shelf.rotation.z = outcome === 'fail' && variant === 1 ? -shelfAngle(t) : 0;
      for (const b of books) {
        const falling = outcome === 'fail' && variant === 0 && t > b.delay;
        if (!falling) {
          b.mesh.position.set(b.home.x, b.home.y, -0.15);
          b.mesh.rotation.set(0, 0, 0);
          continue;
        }
        const dt = t - b.delay;
        const toX = -0.6 + hash(b.delay * 50) * 1.7 - 0.6; // spread over the pile in front of the shelf
        const fallY = Math.max(0.15 + hash(b.delay * 80) * 0.5, b.home.y - 6 * dt * dt);
        b.mesh.position.set(lerp(b.home.x, toX + cx, clamp01(dt / 0.5)), fallY, b.end.z);
        b.mesh.rotation.z = b.end.rot * clamp01(dt / 0.5);
      }
    };
  });
}

function basket(): Prop {
  return prop((kit, root) => {
    const body = new Group();
    root.add(body);
    const white = kit.fabric(0xf4f1e8);
    const wall = kit.mesh(
      new CylinderGeometry(1.0, 0.85, 1.3, 20, 1, true),
      white,
      body,
      0,
      0.65,
      0,
    );
    wall.material = kit.lit(0xe8e2d2, 0.8);
    cyl(kit, 0.85, 0.85, 0.06, white, body, 0, 0.03, 0);
    const rim = kit.mesh(new TorusGeometry(1.0, 0.06, 8, 24), white, body, 0, 1.3, 0);
    rim.rotation.x = Math.PI / 2;
    const clothes: Mesh[] = [];
    [0xe0504a, 0x4d8fe0, 0xf2c14a, 0x6bbf7a].forEach((c, i) => {
      const m = sphere(kit, 0.5, kit.lit(c, 0.9), body, -0.55 + i * 0.4, 1.25 + (i % 2) * 0.15, 0);
      m.scale.set(1, 0.7, 1);
      clothes.push(m);
    });
    const wrapper = new Group();
    wrapper.position.set(4.5, 0, 0);
    root.add(wrapper);
    wrapper.add(body);
    return (outcome, variant, t) => {
      wrapper.position.set(4.5, 0, 0);
      wrapper.rotation.z = 0;
      body.position.set(0, 0, 0);
      body.scale.set(1, 1, 1);
      if (outcome === 'clear' && variant === 1) body.scale.y = 1 - 0.14 * dip(t, [0.8], 0.2);
      if (outcome === 'fail' && variant === 0) body.scale.y = 1 - 0.1 * dip(t, [0.6], 0.2);
      if (outcome === 'fail' && variant === 1 && t > 0.75) {
        // Tips over and tumbles along the floor with the cat inside.
        const x = basketTumbleX(t);
        wrapper.position.set(x, 0.75, 0);
        body.position.y = -0.65;
        wrapper.rotation.z = -(x - 4.5) / 1.0 - smooth((t - 0.75) / 0.1) * 0.6;
      }
    };
  });
}

// ---------- Kitchen ----------

function counter(): Prop {
  return prop((kit, root) => {
    const cabinet = kit.wood(0xd9b98a);
    const top = kit.stone(0x6f7d86);
    kit.box(5.2, 1.5, 1.3, cabinet, root, 6, 0.75, -0.1);
    kit.box(5.4, 0.12, 1.4, top, root, 6, 1.54, -0.1);
    for (const x of [4.5, 6, 7.5]) {
      kit.box(1.2, 1.1, 0.04, kit.wood(0xc4a270), root, x, 0.8, 0.57);
      sphere(kit, 0.06, kit.lit(0x444444), root, x + 0.4, 0.8, 0.62);
    }
    // The stool.
    cyl(kit, 0.45, 0.45, 0.1, kit.lit(0xc0392b, 0.7), root, 2.4, 0.78, 0);
    for (const dx of [-0.3, 0.3])
      cyl(kit, 0.04, 0.04, 0.75, kit.lit(0x888888), root, 2.4 + dx, 0.38, 0);
    // Butter and the flour bag on the counter.
    kit.box(0.6, 0.16, 0.4, kit.lit(0xffe27a, 0.5), root, 5.6, 1.68, 0.1);
    const bag = new Group();
    bag.position.set(6.6, 1.6, -0.1);
    root.add(bag);
    const sack = kit.box(0.8, 0.95, 0.5, kit.lit(0xf4eedc, 0.9), bag, 0, 0.475, 0);
    kit.box(0.5, 0.3, 0.52, kit.lit(0x3f8fd8, 0.8), bag, 0, 0.5, 0);
    void sack;
    // A stack of pots at the far end.
    const pots: { g: Group; y: number }[] = [];
    [
      [9.3, 0.4, 0.55, 0x9aa5ad],
      [9.3, 1.1, 0.45, 0xc0392b],
    ].forEach(([x, y, r, c]) => {
      const g = new Group();
      g.position.set(x, y, 0);
      root.add(g);
      cyl(kit, r, r * 0.9, 0.7, kit.lit(c, 0.4), g);
      pots.push({ g, y });
    });
    return (outcome, variant, t) => {
      bag.rotation.z = 0;
      bag.position.set(6.6, 1.6, -0.1);
      pots.forEach((p, i) => {
        p.g.position.set(9.3, p.y, 0);
        p.g.rotation.z = 0;
        if (outcome === 'fail' && variant === 0 && t > 1.7) {
          const k = clamp01((t - 1.7) / 0.5);
          if (i === 1) {
            p.g.position.set(9.3 + 1.6 * k, lerp(p.y, 0.45, k * k), 0);
            p.g.rotation.z = -1.5 * k;
          } else p.g.rotation.z = 0.1 * Math.sin(t * 30) * (1 - k);
        }
      });
      if (outcome === 'fail' && variant === 1 && t > 1.05) {
        const k = clamp01((t - 1.05) / 0.3);
        bag.rotation.z = -1.45 * k;
        bag.position.x = 6.6 + 0.5 * k;
        bag.position.y = 1.6 + 0.0 * k;
      }
    };
  });
}

function mop(): Prop {
  return prop((kit, root) => {
    kit.box(0.5, 0.15, 0.5, kit.lit(0x888888), root, MOP.x, MOP.y + 0.1, 0);
    const pivot = new Group();
    pivot.position.set(MOP.x, MOP.y, 0);
    root.add(pivot);
    cyl(kit, 0.06, 0.06, 2.9, kit.wood(0xc9a15a), pivot, 0, -1.45, 0);
    kit.box(1.5, 0.28, 0.5, kit.lit(0x8f8f98, 0.7), pivot, 0, -2.95, 0);
    const mat = kit.fabric(0xe8e4d6);
    for (let i = 0; i < 9; i++) {
      kit.box(0.14, 0.5, 0.45, mat, pivot, -0.65 + i * 0.163, -3.28, 0);
    }
    // The wet floor and its sign.
    const puddle = cyl(kit, 2.0, 2.0, 0.02, kit.glass(0x6bb8ff, 0.55), root, 5.5, 0.015, 0.2);
    puddle.scale.z = 0.4;
    const sign = new Group();
    sign.position.set(9.2, 0, 0.2);
    root.add(sign);
    const yellow = kit.lit(0xffd43b, 0.6);
    for (const s of [-1, 1]) {
      const leg = kit.box(0.55, 1.0, 0.06, yellow, sign, s * 0.18, 0.5, 0);
      leg.rotation.z = s * -0.25;
    }
    return (outcome, _variant, t) => {
      pivot.rotation.z = mopAngle(t);
      void outcome;
    };
  });
}

function sink(): Prop {
  return prop((kit, root) => {
    const cab = kit.wood(0xe6dfcf);
    const top = kit.stone(0x6f7d86);
    for (const [x, w] of [
      [3.4, 2.0],
      [8.4, 2.0],
    ]) {
      kit.box(w, 0.95, 1.3, cab, root, x, 0.475, -0.1);
      kit.box(w + 0.1, 0.1, 1.4, top, root, x, 1.0, -0.1);
    }
    // The basin: the gap between the counters, full of bubbles.
    kit.box(3.0, 0.5, 1.2, kit.lit(0xbfe4f5, 0.5), root, 5.9, 0.25, -0.05);
    const foamMat = kit.lit(0xffffff, 0.3);
    const foam: Mesh[] = [];
    for (let i = 0; i < 14; i++) {
      const m = sphere(
        kit,
        0.22 + hash(i) * 0.22,
        foamMat,
        root,
        4.6 + hash(i + 3) * 2.6,
        0.55 + hash(i + 7) * 0.12,
        hash(i + 5) * 0.6 - 0.35,
      );
      foam.push(m);
    }
    const bubbles: Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const m = sphere(
        kit,
        0.12 + hash(i + 11) * 0.1,
        kit.glass(0xdff6ff, 0.5),
        root,
        4.8 + i * 0.55,
        1.1,
        0.5,
      );
      bubbles.push(m);
    }
    // The tap: a riser at the back of the right counter, a neck over the basin, a nozzle.
    const metal = kit.metal(0xcfd6dc);
    cyl(kit, 0.12, 0.12, 1.3, metal, root, 7.6, 1.65, -0.4);
    const neck = cyl(kit, 0.1, 0.1, 2.4, metal, root, 6.4, 2.3, -0.4);
    neck.rotation.z = Math.PI / 2;
    cyl(kit, 0.1, 0.1, 0.45, metal, root, 5.3, 2.1, -0.4);
    sphere(kit, 0.13, metal, root, 7.6, 2.3, -0.4);
    const jet = cyl(kit, 0.07, 0.07, 1.3, kit.glass(0x6bb8ff, 0.7), root, 5.3, 1.35, -0.2);
    jet.visible = false;
    return (outcome, variant, t) => {
      jet.visible = outcome === 'fail' && variant === 1 && t > 0.75 && t < 1.15;
      bubbles.forEach((b, i) => (b.position.y = 1.1 + 0.15 * Math.sin(t * 2.5 + i * 1.7)));
      foam.forEach((f, i) => (f.scale.y = 1 + 0.05 * Math.sin(t * 3 + i)));
      void outcome;
    };
  });
}

// ---------- Bathroom ----------

function bathtub(): Prop {
  return prop((kit, root) => {
    const white = kit.lit(0xf4f7f9, 0.4);
    const inner = kit.lit(0xdfe7ec, 0.5);
    kit.box(5, 1.2, 0.5, white, root, 6, 0.6, 0.75);
    kit.box(5, 1.35, 0.3, white, root, 6, 0.675, -0.8);
    kit.box(0.3, 1.2, 1.9, white, root, 3.65, 0.6, 0);
    kit.box(0.3, 1.2, 1.9, white, root, 8.35, 0.6, 0);
    kit.box(4.6, 0.1, 1.5, inner, root, 6, 0.3, 0);
    const water = kit.box(4.5, 0.7, 1.4, kit.glass(0x7fd0ff, 0.7), root, 6, 0.65, 0);
    water.position.y = 0.65;
    for (const x of [3.9, 8.1]) {
      for (const z of [-0.6, 0.6]) sphere(kit, 0.2, kit.lit(0xc9a15a, 0.3), root, x, 0.15, z);
    }
    const bubbles: Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      bubbles.push(
        sphere(
          kit,
          0.14 + hash(i) * 0.12,
          kit.lit(0xffffff, 0.3),
          root,
          4.2 + i * 0.6,
          1.0,
          hash(i + 1) * 0.8 - 0.4,
        ),
      );
    }
    const duck = new Group();
    duck.position.set(6.4, 1.1, 0.1);
    root.add(duck);
    const yellow = kit.lit(0xffd43b, 0.5);
    sphere(kit, 0.28, yellow, duck, 0, 0.1, 0).scale.set(1.2, 0.9, 1);
    sphere(kit, 0.17, yellow, duck, 0.25, 0.4, 0);
    kit.mesh(
      new CylinderGeometry(0.05, 0.08, 0.16, 24),
      kit.lit(0xff9f1c),
      duck,
      0.45,
      0.38,
      0,
    ).rotation.z = -Math.PI / 2;
    const soap = kit.box(0.5, 0.18, 0.3, kit.lit(0xf6a5b8, 0.4), root, 5.0, 1.29, 0.7);
    return (outcome, variant, t) => {
      duck.visible = !(outcome === 'fail' && variant === 0 && t > 1.15);
      duck.position.y = 1.1 + 0.05 * Math.sin(t * 3);
      bubbles.forEach((b, i) => (b.position.y = 1.0 + 0.06 * Math.sin(t * 2 + i)));
      soap.position.set(5.0, 1.29, 0.7);
      if (outcome === 'fail' && variant === 1 && t > 0.9) {
        const k = t - 0.9;
        const x = 5.0 + 5 * k;
        soap.position.set(
          Math.min(x, 10.5),
          x < 8.4 ? 1.0 : Math.max(0.09, 1.0 - 6 * (x - 8.4) ** 2 * 0.3),
          0,
        );
      }
    };
  });
}

function paperRoll(): Prop {
  return prop((kit, root) => {
    const roll = new Group();
    root.add(roll);
    const paper = kit.lit(0xfdfdfb, 0.9);
    const core = kit.lit(0xb98c5a, 0.8);
    cyl(kit, ROLL_R, ROLL_R, 1.2, paper, roll).rotation.x = Math.PI / 2;
    // The end of the roll faces the camera: rings, a cardboard core and a tear line to show it turn.
    for (const r of [0.95, 0.78, 0.62]) {
      const ring = kit.mesh(
        new TorusGeometry(r, 0.012, 6, 36),
        kit.lit(0xd8d8d4, 0.9),
        roll,
        0,
        0,
        0.61,
      );
      ring.rotation.z = 0;
    }
    cyl(kit, 0.4, 0.4, 1.24, core, roll).rotation.x = Math.PI / 2;
    kit.box(0.6, 0.05, 0.02, kit.lit(0xc8c8c4, 0.9), roll, 0.7, 0, 0.62);
    kit.box(0.06, 0.4, 0.02, kit.lit(0xc8c8c4, 0.9), roll, 0.4, -0.1, 0.62);
    // A streamer tying the cat up (fail 1).
    const streamer = kit.box(1, 0.1, 0.04, paper, root, 0, 0, 0.5);
    streamer.visible = false;
    const f = createFrame();
    return (outcome, variant, t) => {
      let x: number;
      if (outcome === null) x = 7.6 + 0.15 * Math.sin(t * 1.4);
      else x = rollX(outcome, variant, t);
      roll.position.set(x, ROLL_R, 0.1);
      roll.rotation.z = (7.6 - x) / ROLL_R;
      const tied = outcome === 'fail' && variant === 1 && t > 0.5 && t < 1.9;
      streamer.visible = tied;
      if (tied) {
        moveFrame('paper-roll', 'fail', 1, t, f);
        const ax = x;
        const ay = ROLL_R;
        const bx = f.x;
        const by = f.y + 0.5;
        const dx = bx - ax;
        const dy = by - ay;
        streamer.position.set((ax + bx) / 2, (ay + by) / 2, 0.55);
        streamer.scale.x = Math.hypot(dx, dy);
        streamer.rotation.z = Math.atan2(dy, dx);
      }
    };
  });
}

function towel(): Prop {
  return prop((kit, root) => {
    const metal = kit.metal(0xcfd6dc);
    const rail = cyl(kit, 0.07, 0.07, 5.2, metal, root, 6, TOWEL.y + 0.05, -0.3);
    rail.rotation.z = Math.PI / 2;
    for (const x of [3.5, 8.5]) kit.box(0.2, 0.25, 0.6, metal, root, x, TOWEL.y + 0.05, -0.4);
    const pivot = new Group();
    pivot.position.set(TOWEL.x, TOWEL.y + 0.05, -0.2);
    root.add(pivot);
    const teal = kit.fabric(0x3fb8af);
    kit.box(0.95, TOWEL.len, 0.1, teal, pivot, 0, -TOWEL.len / 2, 0);
    kit.box(0.95, 0.12, 0.12, kit.lit(0xffffff, 0.9), pivot, 0, -TOWEL.len + 0.35, 0.01);
    const puddle = cyl(kit, 2.1, 2.1, 0.02, kit.glass(0x6bb8ff, 0.55), root, 6, 0.015, 0.2);
    puddle.scale.z = 0.35;
    return (outcome, variant, t) => {
      const a = outcome === null ? 0.12 * Math.sin(t * 1.6) : towelAngle(outcome, variant, t);
      pivot.position.set(TOWEL.x, TOWEL.y + 0.05, -0.2);
      pivot.rotation.z = a;
      if (outcome === 'fail' && variant === 0 && t > 1.1) {
        // The towel comes off the rail and lands, wrapped, in the puddle.
        const k = clamp01((t - 1.1) / 0.35);
        pivot.position.y = lerp(TOWEL.y + 0.05, 0.25, k * k);
        pivot.position.x = TOWEL.x + 0.6 * k;
        pivot.rotation.z = lerp(a, Math.PI / 2 - 0.1, k);
      }
    };
  });
}

// ---------- Bedroom ----------

function bed(): Prop {
  return prop((kit, root) => {
    const wood = kit.wood(0x8a5a33);
    kit.box(0.3, 1.6, 1.5, wood, root, 3.15, 0.8, 0);
    kit.box(0.4, 2.2, 1.5, wood, root, 8.8, 1.1, 0);
    for (const x of [3.5, 8.4])
      for (const z of [-0.6, 0.6]) kit.box(0.14, 0.75, 0.14, wood, root, x, 0.375, z);
    kit.box(5.2, 0.14, 1.4, wood, root, 5.95, 0.82, 0);
    const mattress = new Group();
    mattress.position.set(0, 0.9, 0);
    root.add(mattress);
    kit.box(5.3, 0.3, 1.4, kit.fabric(0x7fb4e8), mattress, 5.95, 0.15, 0);
    kit.box(3.0, 0.08, 1.46, kit.fabric(0xe8737b), mattress, 4.9, 0.3, 0);
    const pillows: Mesh[] = [];
    for (const x of [7.45, 8.25]) {
      const p = sphere(kit, 0.5, kit.fabric(0xffffff), root, x, 1.2, 0);
      p.scale.set(1.0, 0.32, 1.2);
      pillows.push(p);
    }
    const bunnyMat = kit.fabric(0xb8b3ad);
    const bunnies = [4.8, 5.7, 6.6, 7.4].map((x, i) => ({
      mesh: sphere(kit, 0.2, bunnyMat, root, x, 0.2, 0.1 * (i % 2)),
      x,
    }));
    return (outcome, variant, t) => {
      const landings =
        outcome === 'clear' && variant === 0
          ? [0.53, 0.8, 1.07, 1.34]
          : outcome === 'fail' && variant === 0
            ? [0.5, 0.77]
            : [];
      mattress.scale.y = 1 - 0.3 * dip(t, landings, 0.2);
      pillows.forEach((p, i) => {
        const hit =
          outcome === 'fail' && variant === 0 && t > 1.12 ? Math.max(0, 1 - (t - 1.12) * 2) : 0;
        p.position.y = 1.2 + 0.3 * hit * (i + 1) * 0.5;
        p.scale.y = 0.32 * (1 - 0.5 * hit * (1 - i * 0.5));
      });
      bunnies.forEach((b, i) => {
        const scatter = outcome === 'fail' && variant === 1 && t > 0.5 + i * 0.1;
        if (!scatter) {
          b.mesh.position.set(b.x, 0.2, 0.1 * (i % 2));
          b.mesh.visible = true;
          return;
        }
        const k = t - 0.5 - i * 0.1;
        b.mesh.position.set(b.x + 0.6 * k, 0.2 + 0.7 * Math.abs(Math.sin(k * 6)), 0.1 * (i % 2));
        b.mesh.visible = k < 1.0;
      });
    };
  });
}

function closet(): Prop {
  return prop((kit, root) => {
    const wood = kit.wood(0xa27853);
    const dark = kit.lit(0x3b2b3f, 1);
    const X0 = 4.2;
    kit.box(0.16, 3.6, 1.4, wood, root, X0 + 0.08, 1.8, 0);
    kit.box(0.16, 3.6, 1.4, wood, root, X0 + 3.32, 1.8, 0);
    kit.box(3.4, 0.14, 1.4, wood, root, X0 + 1.7, 3.53, 0);
    kit.box(3.4, 0.12, 1.4, wood, root, X0 + 1.7, 0.06, 0);
    kit.box(3.1, 3.4, 0.08, dark, root, X0 + 1.7, 1.8, -0.62);
    const rail = cyl(kit, 0.04, 0.04, 3.0, kit.lit(0xcfd6dc, 0.25), root, X0 + 1.7, 3.0, -0.4);
    rail.rotation.z = Math.PI / 2;
    // Clothes on the rail; in fail 1 they drop to the floor.
    const colors = [0xe0504a, 0x4d8fe0, 0xf2c14a, 0x6bbf7a, 0xb58ad6];
    const clothes = colors.map((c, i) => {
      const m = kit.box(0.5, 1.1, 0.12, kit.fabric(c), root, X0 + 0.7 + i * 0.5, 2.4, -0.4);
      return { m, x: m.position.x, delay: 0.85 + i * 0.06 };
    });
    const doorHinge = new Group();
    doorHinge.position.set(X0, 0, 0.65);
    root.add(doorHinge);
    const leaf = new Group();
    doorHinge.add(leaf);
    kit.box(3.4, 3.4, 0.1, kit.wood(0x8f6240), leaf, 1.7, 1.8, 0);
    kit.box(2.9, 2.9, 0.04, kit.wood(0x9c6b4a), leaf, 1.7, 1.8, 0.06);
    sphere(kit, 0.1, kit.lit(0xf2c14a, 0.3), leaf, 3.0, 1.7, 0.12);
    return (outcome, variant, t) => {
      leaf.rotation.y = -(outcome === null
        ? closetDoor('clear', 1, t)
        : closetDoor(outcome, variant, t));
      clothes.forEach((c, i) => {
        const falls = outcome === 'fail' && variant === 1 && t > c.delay;
        if (!falls) {
          c.m.position.set(c.x, 2.4, -0.4);
          c.m.rotation.set(0, 0, 0);
          c.m.visible = true;
          return;
        }
        const k = t - c.delay;
        c.m.position.set(
          c.x + (6.0 - c.x) * clamp01(k / 0.4) * 0.6,
          Math.max(0.25 + i * 0.08, 2.4 - 7 * k * k),
          -0.1 + 0.1 * i * 0.2,
        );
        c.m.rotation.z = (i - 2) * 0.5 * clamp01(k / 0.4);
        c.m.visible = !(i === 1 && t > 1.65);
      });
    };
  });
}

function yarn(): Prop {
  return prop((kit, root) => {
    const ball = new Group();
    root.add(ball);
    const pink = kit.fabric(0xe85d9b);
    const dark = kit.fabric(0xb83a78);
    sphere(kit, 0.9, pink, ball);
    for (let i = 0; i < 6; i++) {
      const ring = kit.mesh(new TorusGeometry(0.9, 0.035, 6, 32), dark, ball);
      ring.scale.setScalar(1.005);
      ring.rotation.set(hash(i) * 3, hash(i + 4) * 3, hash(i + 8) * 3);
    }
    // The strand: a chain of short boxes from where it is held to the ball.
    const SEGS = 16;
    const strand = Array.from({ length: SEGS }, () =>
      kit.box(1, 0.07, 0.07, pink, root, 0, 0, 0.2),
    );
    const f = createFrame();
    return (outcome, variant, t) => {
      const x = outcome === null ? 5 + 0.12 * Math.sin(t * 2.2) : yarnX(outcome, variant, t);
      ball.position.set(x, 0.9, 0);
      ball.rotation.z = -(x - 5) / 0.9;
      // Where the strand is held, and how high it whips up.
      let ax = 3.0;
      let ay = 0.06;
      let lift = 0;
      if (outcome === 'fail' && variant === 0 && t > 0.55) {
        moveFrame('yarn', 'fail', 0, t, f);
        ax = f.x;
        ay = f.y + 0.35;
      }
      if (outcome === 'clear' && variant === 1)
        lift = 1.5 * Math.sin(Math.PI * clamp01((t - 0.55) / 0.55));
      if (outcome === 'fail' && variant === 1)
        lift = 0.45 * Math.sin(Math.PI * clamp01((t - 0.55) / 0.5));
      const bx = x - 0.7;
      const by = 0.3;
      let px = ax;
      let py = ay;
      for (let i = 0; i < SEGS; i++) {
        const s = (i + 1) / SEGS;
        const nx = lerp(ax, bx, s);
        const ny = lerp(ay, by, s) + lift * Math.sin(Math.PI * s);
        const seg = strand[i];
        seg.position.set((px + nx) / 2, (py + ny) / 2, 0.25);
        seg.scale.x = Math.max(Math.hypot(nx - px, ny - py), 0.01);
        seg.rotation.z = Math.atan2(ny - py, nx - px);
        px = nx;
        py = ny;
      }
    };
  });
}

/** One builder per obstacle id. */
export const HOUSE_PROPS = {
  couch,
  bookshelf,
  basket,
  counter,
  mop,
  sink,
  bathtub,
  'paper-roll': paperRoll,
  towel,
  bed,
  closet,
  yarn,
} as const;
