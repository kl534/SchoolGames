/**
 * The 12 town obstacles (backyard, park, street, rooftops) as meshes. Each builder returns a
 * `Prop` whose `update(outcome, variant, t)` poses it at the same time as the cat's move
 * (`moves/town.ts`); with a null outcome it is the idle motion before the answer, driven by the
 * clock.
 */
import { CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Material } from 'three';
import { Kit, lerp, type Prop } from '../kit';
import {
  CAN_R,
  SNAP_AT,
  SWING,
  antennaBend,
  awningSquash,
  canX,
  duckTip,
  duckUp,
  farSwingAngle,
  flagUp,
  padX,
  puffSize,
  skateX,
  snapAngle,
  swingAngle,
} from '../moves/town';
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

/** A tidy pseudo-random number from an index. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A pole from one point to another in the xy plane. */
function beam(
  kit: Kit,
  mat: Material,
  parent: Group,
  from: [number, number],
  to: [number, number],
  w: number,
  z = 0,
) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const m = kit.box(len, w, w, mat, parent, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z);
  m.rotation.z = Math.atan2(to[1] - from[1], to[0] - from[0]);
  return m;
}

const WOOD = 0x9a6a3c;

// ---------- Backyard ----------

function fence(): Prop {
  return prop((kit, root) => {
    const board = kit.wood(0xf3ead8);
    const rail = kit.wood(0xd9c9a8);
    for (let i = 0; i < 8; i++) {
      kit.box(0.45, 3, 0.12, board, root, 4.25 + i * 0.5, 1.5, 0.1);
      const tip = kit.box(0.32, 0.32, 0.12, board, root, 4.25 + i * 0.5, 3.0, 0.1);
      tip.rotation.z = Math.PI / 4;
      tip.scale.set(0.8, 0.8, 1);
    }
    for (const y of [0.8, 2.1]) kit.box(4.2, 0.16, 0.14, rail, root, 6, y, -0.02);
    for (const x of [4.0, 8.0]) kit.box(0.28, 3.2, 0.28, rail, root, x, 1.6, 0);
    return () => {};
  });
}

function sprinkler(): Prop {
  return prop((kit, root) => {
    const metal = kit.metal(0x4d8fe0);
    cyl(kit, 0.3, 0.4, 0.2, kit.lit(0x888888, 0.5), root, 6, 0.1, 0.2);
    sphere(kit, 0.28, metal, root, 6, 0.28, 0.2);
    const water = kit.glass(0x7fd0ff, 0.55);
    const arcs: Mesh[] = [];
    for (const x of [4.5, 7.5]) {
      const arc = kit.mesh(new TorusGeometry(1.5, 0.08, 6, 28, Math.PI), water, root, x, 0.3, 0.2);
      arcs.push(arc);
    }
    // Drops under each arc.
    const drops: Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      drops.push(sphere(kit, 0.09, water, root, 3.1 + hash(i) * 5.8, 0.3, 0.2));
    }
    return (_outcome, _variant, t) => {
      arcs.forEach((a, i) => {
        a.scale.y = 1.5 + 0.35 * Math.sin(t * 5 + i * Math.PI);
      });
      drops.forEach((d, i) => {
        const k = (t * 1.6 + hash(i + 9)) % 1;
        d.position.y = 0.3 + 1.9 * Math.sin(Math.PI * k);
        d.position.x = 3.1 + hash(i) * 5.8;
      });
    };
  });
}

function flowers(): Prop {
  return prop((kit, root) => {
    kit.box(4, 0.3, 1.2, kit.wood(0x6b4a2b), root, 6, 0.15, -0.3);
    const stem = kit.foliage(0x3e9a4a);
    const colors = [0xff6f91, 0xf2d34a, 0xffffff, 0xb36bff, 0xff9f43];
    for (let i = 0; i < 18; i++) {
      const x = 4.1 + (i % 9) * 0.45 + hash(i) * 0.1;
      const z = -0.6 + Math.floor(i / 9) * 0.4 - 0.2;
      const h = 0.7 + hash(i + 4) * 0.5;
      kit.box(0.05, h, 0.05, stem, root, x, 0.3 + h / 2, z);
      sphere(kit, 0.17, kit.lit(colors[i % colors.length], 0.6), root, x, 0.3 + h, z);
      sphere(kit, 0.07, kit.lit(0xf2b134, 0.6), root, x, 0.3 + h, z + 0.12);
    }
    // Stepping stones across the front of the bed.
    const stone = kit.stone(0xb8b8b0);
    for (const x of [4.4, 5.6, 6.8, 8.0]) cyl(kit, 0.4, 0.45, 0.12, stone, root, x, 0.06, 0.4);
    const bee = new Group();
    bee.visible = false;
    root.add(bee);
    sphere(kit, 0.14, kit.lit(0xf2c14a, 0.5), bee).scale.set(1.3, 1, 1);
    kit.box(0.04, 0.1, 0.22, kit.lit(0x222222), bee, 0.02, 0.02, 0);
    for (const z of [-0.12, 0.12])
      kit.box(0.14, 0.02, 0.1, kit.glass(0xffffff, 0.7), bee, 0, 0.14, z);
    const f = createFrame();
    return (outcome, variant, t) => {
      const chase = outcome === 'fail' && variant === 1 && t > 0.8;
      bee.visible = chase;
      if (chase) {
        moveFrame('flowers', 'fail', 1, t, f);
        bee.position.set(
          f.x - 0.7 + 0.15 * Math.sin(t * 20),
          f.y + 1.4 + 0.12 * Math.sin(t * 14),
          0.2,
        );
      }
    };
  });
}

// ---------- Park ----------

function slide(): Prop {
  return prop((kit, root) => {
    const blue = kit.metal(0x3f8fd8);
    const yellow = kit.lit(0xf2c14a, 0.5);
    // The ladder, the platform and the legs.
    for (const z of [-0.4, 0.4]) kit.box(0.1, 3.4, 0.1, blue, root, 3.3, 1.7, z);
    for (let y = 0.4; y < 3.3; y += 0.5) kit.box(0.08, 0.08, 0.8, kit.wood(WOOD), root, 3.3, y, 0);
    kit.box(1.6, 0.18, 1.2, yellow, root, 4.2, 3.3, 0);
    for (const z of [-0.5, 0.5]) kit.box(0.12, 3.3, 0.12, blue, root, 4.8, 1.65, z);
    for (const z of [-0.55, 0.55]) kit.box(1.6, 0.8, 0.08, blue, root, 4.2, 3.8, z);
    // The ramp from (5, 3.4) to (9, 0.3).
    const dx = 4;
    const dy = -3.1;
    const ramp = kit.box(Math.hypot(dx, dy), 0.14, 1.0, kit.lit(0xe0504a, 0.3), root, 7, 1.85, 0);
    ramp.rotation.z = Math.atan2(dy, dx);
    for (const z of [-0.5, 0.5]) {
      const rail = kit.box(Math.hypot(dx, dy), 0.22, 0.08, yellow, root, 7, 1.95, z);
      rail.rotation.z = Math.atan2(dy, dx);
    }
    // The sandbox past the end of the slide.
    kit.box(2.6, 0.3, 1.8, kit.wood(WOOD), root, 10.6, 0.15, 0.1);
    kit.box(2.3, 0.2, 1.5, kit.lit(0xe6cf93, 1), root, 10.6, 0.22, 0.1);
    return () => {};
  });
}

function pond(): Prop {
  return prop((kit, root) => {
    kit.box(5.6, 0.06, 2.6, kit.glass(0x4fb3e8, 0.85), root, 6.25, 0.03, 0.2);
    const rock = kit.stone(0x9a9a92);
    for (let i = 0; i < 9; i++) {
      sphere(
        kit,
        0.22 + hash(i) * 0.12,
        rock,
        root,
        3.6 + i * 0.67,
        0.12,
        -1.0 - hash(i + 2) * 0.2,
      );
    }
    const stone = kit.stone(0xb8b8b0);
    for (const x of [4.4, 5.6, 6.8]) cyl(kit, 0.4, 0.45, 0.35, stone, root, x, 0.175, 0.2);
    // The lily pad.
    const pad = new Group();
    root.add(pad);
    cyl(kit, 0.6, 0.6, 0.08, kit.lit(0x3e9a4a, 0.7), pad, 0, 0.1, 0);
    sphere(kit, 0.12, kit.lit(0xff9fc0, 0.5), pad, 0.2, 0.2, 0.1);
    // The duck that pops up (fail 1).
    const duck = new Group();
    duck.visible = false;
    root.add(duck);
    const yellow = kit.lit(0xffd43b, 0.5);
    sphere(kit, 0.55, yellow, duck, 0, 0, 0).scale.set(1.2, 0.9, 0.9);
    sphere(kit, 0.3, yellow, duck, 0.6, 0.5, 0);
    const beak = kit.mesh(
      new CylinderGeometry(0.02, 0.12, 0.28, 24),
      kit.lit(0xff9f1c),
      duck,
      0.95,
      0.45,
      0,
    );
    beak.rotation.z = -Math.PI / 2;
    sphere(kit, 0.05, kit.lit(0x222222), duck, 0.78, 0.62, 0.22);
    return (outcome, variant, t) => {
      pad.position.set(padX(outcome, variant, t), 0, 0.2);
      pad.rotation.y = 0.2 * Math.sin(t * 1.3);
      const up = outcome === 'fail' && variant === 1 ? duckUp(t) : 0;
      duck.visible = up > 0.02;
      duck.position.set(5.6, lerp(-0.7, 0.75, up), 0.2);
      duck.rotation.z = outcome === 'fail' && variant === 1 ? duckTip(t) : 0;
    };
  });
}

function swings(): Prop {
  return prop((kit, root) => {
    const metal = kit.metal(0xd9534f);
    kit.box(5.0, 0.2, 0.2, metal, root, 5.9, SWING.y + 0.1, 0);
    for (const [x, s] of [
      [3.4, -1],
      [8.4, 1],
    ] as const) {
      for (const z of [-0.5, 0.5])
        beam(kit, metal, root, [x + s * 0.5, 0], [x, SWING.y + 0.1], 0.18, z);
    }
    const seatMat = kit.lit(0xf2c14a, 0.6);
    const chain = kit.metal(0x888888);
    const makeSeat = (pivotX: number) => {
      const pivot = new Group();
      pivot.position.set(pivotX, SWING.y, 0);
      root.add(pivot);
      for (const z of [-0.35, 0.35])
        kit.box(0.04, SWING.len, 0.04, chain, pivot, 0, -SWING.len / 2, z);
      kit.box(1.0, 0.12, 0.8, seatMat, pivot, 0, -SWING.len, 0);
      return pivot;
    };
    const near = makeSeat(SWING.x);
    const far = makeSeat(SWING.farX);
    return (outcome, variant, t) => {
      near.rotation.z = swingAngle(outcome, variant, t);
      far.rotation.z = farSwingAngle(t);
    };
  });
}

// ---------- Street ----------

function mailbox(): Prop {
  return prop((kit, root) => {
    const blue = kit.metal(0x3f6fd8);
    kit.box(0.28, 1.7, 0.28, kit.wood(WOOD), root, 5.5, 0.85, 0);
    const body = cyl(kit, 0.5, 0.5, 1.8, blue, root, 5.5, 2.15, 0);
    body.rotation.z = Math.PI / 2;
    kit.box(1.8, 0.45, 0.95, blue, root, 5.5, 1.95, 0);
    // The slot on the front.
    kit.box(0.05, 0.28, 0.6, kit.lit(0x111111), root, 4.58, 2.15, 0.05);
    kit.box(0.4, 0.14, 0.04, kit.lit(0xffffff, 0.5), root, 5.4, 2.4, 0.5);
    // The flag.
    const flag = new Group();
    flag.position.set(6.2, 2.45, 0.52);
    root.add(flag);
    kit.box(0.08, 0.8, 0.06, kit.lit(0xe0504a, 0.5), flag, 0, 0.4, 0);
    kit.box(0.4, 0.26, 0.06, kit.lit(0xe0504a, 0.5), flag, 0.2, 0.7, 0);
    return (outcome, variant, t) => {
      const up = flagUp(outcome, variant, t);
      flag.rotation.z = -1.5 * (1 - up) + 0.1 * Math.sin(t * 30) * up * (t < 1.3 ? 1 : 0);
    };
  });
}

function trashCan(): Prop {
  return prop((kit, root) => {
    const can = new Group();
    root.add(can);
    const metal = kit.metal(0x9aa5ad);
    cyl(kit, CAN_R, CAN_R, 1.3, metal, can).rotation.x = Math.PI / 2;
    for (const z of [0.66, -0.66]) {
      cyl(kit, CAN_R * 1.04, CAN_R * 1.04, 0.1, kit.lit(0x6f7b83, 0.4), can, 0, 0, z).rotation.x =
        Math.PI / 2;
    }
    // Ribs, a handle and a dent so the turning shows.
    for (const a of [0, 1.05, 2.1, 3.15, 4.2, 5.25]) {
      const rib = kit.box(
        0.08,
        0.5,
        1.34,
        kit.lit(0x7a858d, 0.5),
        can,
        Math.cos(a) * CAN_R,
        Math.sin(a) * CAN_R,
        0,
      );
      rib.rotation.z = a;
    }
    kit.box(0.7, 0.12, 0.08, kit.lit(0x333333), can, 0, 0.2, 0.7);
    // The banana peel on the pavement.
    const peel = new Group();
    peel.position.set(8.2, 0.05, 0.3);
    root.add(peel);
    const yellow = kit.lit(0xffd93b, 0.6);
    for (const a of [0, 1, 2]) {
      const flap = kit.box(0.5, 0.05, 0.16, yellow, peel);
      flap.rotation.y = (a * Math.PI) / 3;
    }
    return (outcome, variant, t) => {
      const x = outcome === null ? 7.6 + 0.15 * Math.sin(t * 1.4) : canX(outcome, variant, t);
      can.position.set(x, CAN_R, 0.1);
      can.rotation.z = (7.6 - x) / CAN_R;
      peel.visible = !(outcome === 'fail' && variant === 1 && t > 1.4);
    };
  });
}

function hopscotch(): Prop {
  return prop((kit, root) => {
    const colors = [0xff6f91, 0xf2d34a, 0x6bd37a, 0x6bb8ff, 0xb36bff, 0xff9f43];
    colors.forEach((c, i) => {
      kit.box(0.92, 0.02, 0.92, kit.lit(c, 0.9), root, 3.5 + i, 0.02, 0.2);
      const line = kit.lit(0xffffff, 0.9);
      kit.box(0.98, 0.025, 0.04, line, root, 3.5 + i, 0.025, -0.28);
      kit.box(0.98, 0.025, 0.04, line, root, 3.5 + i, 0.025, 0.68);
      kit.box(0.04, 0.025, 0.96, line, root, 3.0 + i, 0.025, 0.2);
    });
    kit.box(0.04, 0.025, 0.96, kit.lit(0xffffff, 0.9), root, 9.0, 0.025, 0.2);
    // The skateboard (fail 1).
    const board = new Group();
    board.visible = false;
    root.add(board);
    kit.box(1.5, 0.1, 0.5, kit.lit(0xe0504a, 0.5), board, 0, 0.17, 0.3);
    for (const x of [-0.5, 0.5]) {
      for (const z of [0.12, 0.48]) {
        cyl(kit, 0.1, 0.1, 0.08, kit.lit(0xf2f2f2, 0.5), board, x, 0.1, z).rotation.x = Math.PI / 2;
      }
    }
    return (outcome, variant, t) => {
      const on = outcome === 'fail' && variant === 1;
      board.visible = on;
      if (on) board.position.set(skateX(t), 0, 0);
    };
  });
}

// ---------- Rooftops ----------

function chimney(): Prop {
  return prop((kit, root) => {
    const brick = kit.stone(0xb5543a);
    kit.box(2, 4.5, 1.2, brick, root, 5.6, 2.25, -0.2);
    const mortar = kit.stone(0xe8d6c4);
    for (let y = 0.5; y < 4.4; y += 0.5) kit.box(2.02, 0.05, 1.22, mortar, root, 5.6, y, -0.2);
    for (let y = 0.25, row = 0; y < 4.4; y += 0.5, row++) {
      for (let x = row % 2 ? 4.9 : 5.3; x < 6.5; x += 0.8)
        kit.box(0.05, 0.5, 1.22, mortar, root, x, y, -0.2);
    }
    kit.box(2.4, 0.3, 1.6, kit.lit(0x6f6f78, 0.5), root, 5.6, 4.65, -0.2);
    kit.box(1.5, 0.1, 0.8, kit.lit(0x111111), root, 5.6, 4.82, -0.2);
    const puff = new Group();
    root.add(puff);
    const smoke = kit.lit(0xe6e6ea, 0.9);
    for (const [x, y, r] of [
      [0, 0, 0.6],
      [0.5, 0.2, 0.5],
      [-0.5, 0.15, 0.45],
      [0.1, 0.6, 0.5],
    ] as const) {
      sphere(kit, r, smoke, puff, x, y, 0.3);
    }
    return (outcome, variant, t) => {
      if (outcome === 'fail' && variant === 1) {
        const s = Math.max(0.01, puffSize(t));
        puff.position.set(5.0, 4.9, 0);
        puff.scale.setScalar(0.4 + 2.0 * s);
      } else {
        puff.position.set(5.6 + 0.2 * Math.sin(t * 1.1), 5.3 + 0.2 * Math.sin(t * 2), 0);
        puff.scale.setScalar(0.4 + 0.08 * Math.sin(t * 2));
      }
    };
  });
}

function roofGap(): Prop {
  return prop((kit, root) => {
    // The gap: a dark pit across the roof and over the front of the slab.
    const dark = kit.lit(0x1b1722, 1);
    kit.box(3.6, 0.04, 4.2, dark, root, 5.8, 0.02, -0.55);
    kit.box(3.6, 6, 0.1, dark, root, 5.8, -3, 1.46);
    // The awning that catches a falling cat.
    const awning = new Group();
    awning.position.set(5.8, 0.12, 0.1);
    root.add(awning);
    for (let i = 0; i < 6; i++) {
      kit.box(0.4, 0.1, 1.4, kit.fabric(i % 2 ? 0xffffff : 0xe0504a), awning, -1 + i * 0.4, 0, 0);
    }
    // The taller building: a ledge the cat jumps to.
    kit.box(2.0, 1.6, 1.8, kit.stone(0x8a8f99), root, 8.6, 0.8, -0.9);
    kit.box(2.2, 0.16, 2.0, kit.stone(0x6f737d), root, 8.6, 1.68, -0.9);
    // The antenna on the near edge.
    const antenna = new Group();
    antenna.position.set(4.2, 0, 0);
    root.add(antenna);
    const metal = kit.metal(0x666666);
    kit.box(0.1, 3.4, 0.1, metal, antenna, 0, 1.7, 0);
    for (const [y, w] of [
      [3.3, 1.2],
      [2.8, 1.0],
      [2.3, 0.8],
    ] as const) {
      kit.box(w, 0.06, 0.06, metal, antenna, 0, y, 0);
    }
    return (outcome, variant, t) => {
      antenna.rotation.z = antennaBend(outcome, variant, t);
      const squash = outcome === 'fail' && variant === 0 ? awningSquash(t) : 0;
      awning.scale.y = 1 - 0.7 * squash;
      awning.rotation.z = -0.12;
    };
  });
}

function clothesline(): Prop {
  return prop((kit, root) => {
    const metal = kit.metal(0x666666);
    for (const x of [4.0, 8.0]) {
      kit.box(0.14, 3.6, 0.14, metal, root, x, 1.8, 0);
      kit.box(0.5, 0.1, 0.1, metal, root, x, 3.55, 0);
    }
    // The line pivots about the right pole so it can snap and fall.
    const line = new Group();
    line.position.set(8.0, 3.4, 0);
    root.add(line);
    kit.box(4, 0.04, 0.04, kit.lit(0xdddddd, 0.6), line, -2, 0, 0);
    const sock = new Group();
    sock.position.set(-1.8, 0, 0);
    line.add(sock);
    kit.box(0.28, 0.6, 0.1, kit.fabric(0xe0504a), sock, 0, -0.3, 0);
    kit.box(0.28, 0.14, 0.12, kit.fabric(0xffffff), sock, 0, -0.04, 0);
    const shirt = kit.box(0.8, 0.8, 0.06, kit.fabric(0x4d8fe0), line, -0.9, -0.4, 0);
    void shirt;
    const sheet = kit.box(1.1, 1.0, 0.05, kit.fabric(0xffffff), line, -2.9, -0.5, 0);
    return (outcome, variant, t) => {
      line.rotation.z = snapAngle(outcome, variant, t);
      sheet.visible = !(outcome === 'fail' && variant === 1 && t > SNAP_AT + 0.1);
    };
  });
}

/** One builder per obstacle id. */
export const TOWN_PROPS = {
  fence,
  sprinkler,
  flowers,
  slide,
  pond,
  swings,
  mailbox,
  'trash-can': trashCan,
  hopscotch,
  chimney,
  'roof-gap': roofGap,
  clothesline,
} as const;
