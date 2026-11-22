/**
 * The 12 adventure obstacles (beach, snowy forest, desert, space station) as meshes. Each
 * builder returns a `Prop` whose `update(outcome, variant, t)` poses it at the same time as the
 * cat's move (`moves/adventure.ts`); with a null outcome it is the idle motion before the answer,
 * driven by the clock.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  Shape,
  SphereGeometry,
  type Material,
} from 'three';
import { clamp01, lerp, smooth, type Kit, type Prop } from '../kit';
import {
  BEAMS_X,
  DUNE,
  FLOAT_BOXES,
  LOG_R,
  SNOW_R,
  TUMBLE_R,
  WAVE,
  boxCentre,
  boxSpin,
  castleBurst,
  chunkFall,
  clawFlick,
  clawOpen,
  doorLift,
  duneY,
  iceState,
  laserOn,
  logX,
  moundSize,
  snowGone,
  snowX,
  tumbleGone,
  tumbleX,
  waveScale,
  waveY,
} from '../moves/adventure';
import { createFrame, moveFrame } from '../moves';
import { cyl, hash, makeProp as prop, sphere } from './parts';

/** A solid slab whose side is a profile `y(x)`, extruded along z from `z0` to `z1`. */
function profileSlab(
  kit: Kit,
  mat: Material,
  parent: Group,
  x0: number,
  x1: number,
  height: (x: number) => number,
  z0: number,
  z1: number,
): Mesh {
  const shape = new Shape();
  shape.moveTo(x0, 0);
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const x = lerp(x0, x1, i / steps);
    shape.lineTo(x, height(x));
  }
  shape.lineTo(x1, 0);
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false });
  const m = kit.mesh(geo, mat, parent, 0, 0, z0);
  return m;
}

// ---------- Beach ----------

function sandcastle(): Prop {
  return prop((kit, root) => {
    const sand = kit.lit(0xe6cf93, 0.95);
    const dark = kit.lit(0xc9ae6c, 0.95);
    const parts: { g: Group; x: number; rest: number; spin: number }[] = [];
    const tower = (x: number, w: number, h: number, flag: boolean, rest: number, spin: number) => {
      const g = new Group();
      g.position.set(x, 0, -0.2);
      root.add(g);
      kit.box(w, h, 0.9, sand, g, 0, h / 2, 0);
      for (let i = 0; i < 3; i++)
        kit.box(w / 4, 0.3, 0.9, sand, g, -w / 2 + w / 6 + (i * w) / 2.6, h + 0.15, 0);
      kit.box(w * 0.4, 0.5, 0.02, dark, g, 0, h * 0.55, 0.46);
      if (flag) {
        kit.box(0.05, 0.9, 0.05, kit.lit(0x8a6a38), g, 0, h + 0.55, 0);
        kit.box(0.5, 0.3, 0.03, kit.lit(0xe0504a, 0.6), g, 0.25, h + 0.85, 0);
      }
      parts.push({ g, x, rest, spin });
      return g;
    };
    tower(5.0, 0.9, 2.0, false, 4.4, 0.5);
    tower(6.0, 1.4, 3.2, true, 6.2, -0.3);
    tower(7.0, 0.9, 2.0, false, 7.8, -0.6);
    tower(6.0, 3.0, 1.0, false, 6.0, 0.1).position.z = -0.5;
    // The bucket that tops the keep, and the sand that falls on the cat (fail 1).
    const bucket = new Group();
    bucket.position.set(6, 3.2, -0.2);
    root.add(bucket);
    kit.mesh(
      new CylinderGeometry(0.17, 0.27, 0.34, 14),
      kit.lit(0x3f8fd8, 0.5),
      bucket,
      0,
      0.17,
      0,
    );
    const chunk = sphere(kit, 0.35, sand, root, 5, 2, 0.1);
    chunk.visible = false;
    return (outcome, variant, t) => {
      const f = castleBurst(outcome, variant, t);
      parts.forEach((p, i) => {
        p.g.position.x = lerp(p.x, p.rest, f);
        p.g.scale.set(1 - 0.5 * f, 1 - 0.8 * f, 1 - 0.5 * f);
        p.g.rotation.z = p.spin * f * (i === 3 ? 0.2 : 1);
      });
      bucket.visible = f < 0.05;
      const u = chunkFall(outcome, variant, t);
      chunk.visible = u > 0 && u < 1;
      chunk.position.set(lerp(5, 4.3, u), lerp(2.2, 0.9, u * u), 0.1);
    };
  });
}

function crab(): Prop {
  return prop((kit, root) => {
    const shell = kit.lit(0xe0502a, 0.5);
    const g = new Group();
    g.position.set(6.5, 0, -0.5);
    root.add(g);
    sphere(kit, 1, shell, g, 0, 2.0, 0).scale.set(1.5, 0.75, 0.9);
    // Eyes on stalks.
    for (const x of [-0.5, 0.5]) {
      kit.box(0.06, 0.4, 0.06, shell, g, x, 2.75, 0.3);
      sphere(kit, 0.16, kit.lit(0xffffff, 0.3), g, x, 3.0, 0.3);
      sphere(kit, 0.07, kit.lit(0x111111), g, x, 3.0, 0.45);
    }
    // Legs: three a side, bent.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const z = -0.2 + i * 0.25;
        kit.box(0.5, 0.08, 0.08, shell, g, s * 1.3, 1.6 - i * 0.05, z).rotation.z = s * -0.5;
        kit.box(0.08, 1.4, 0.08, shell, g, s * 1.7, 0.7, z);
      }
    }
    // Arms with claws, raised.
    const claws = [-1, 1].map((s) => {
      const arm = new Group();
      arm.position.set(s * 1.2, 2.0, 0.35);
      g.add(arm);
      kit.box(0.14, 1.0, 0.14, shell, arm, s * 0.5, 0.5, 0).rotation.z = s * -0.5;
      const claw = new Group();
      claw.position.set(s * 0.95, 1.1, 0);
      arm.add(claw);
      const upper = kit.mesh(new SphereGeometry(0.32, 12, 8), shell, claw);
      upper.scale.set(0.8, 1.2, 0.6);
      const jaw = new Group();
      jaw.position.set(0, 0.1, 0);
      claw.add(jaw);
      kit
        .mesh(new SphereGeometry(0.28, 12, 8), kit.lit(0xc03a1a, 0.5), jaw, 0, 0.25, 0)
        .scale.set(0.5, 1.2, 0.5);
      return { arm, jaw, s };
    });
    return (outcome, variant, t) => {
      g.position.y = outcome === null ? 0.05 * Math.sin(t * 2) : 0;
      const open = clawOpen(outcome, variant, t);
      const flick = clawFlick(outcome, variant, t);
      claws.forEach(({ arm, jaw, s }) => {
        jaw.rotation.z = s * (0.15 + 0.45 * open);
        arm.rotation.z = s === -1 ? -flick * 1.3 : 0;
      });
    };
  });
}

function wave(): Prop {
  return prop((kit, root) => {
    const water = kit.glass(0x5fd0ff, 0.92);
    const body = new Group();
    root.add(body);
    profileSlab(kit, water, body, WAVE.x0, WAVE.x1, waveY, -0.9, 0.6);
    const foam = kit.lit(0xffffff, 0.4);
    for (let i = 0; i < 12; i++) {
      const x = lerp(WAVE.x0 + 0.3, WAVE.x1 - 0.3, i / 11);
      sphere(kit, 0.2 + 0.1 * hash(i), foam, body, x, waveY(x) + 0.05, 0.4);
    }
    const board = kit.box(1.3, 0.08, 0.5, kit.lit(0xff6f91, 0.5), root, 5, 1, 0.1);
    board.visible = false;
    const weed = sphere(kit, 0.25, kit.lit(0x2f8a46, 0.8), root, 6.6, 2.6, 0.2);
    weed.scale.set(1.4, 0.6, 1);
    weed.visible = false;
    const f = createFrame();
    return (outcome, variant, t) => {
      body.scale.y = waveScale(outcome, variant, t);
      const surf = outcome === 'clear' && variant === 0 && t >= 0.5 && t <= 1.25;
      board.visible = surf;
      if (surf) {
        moveFrame('wave', 'clear', 0, t, f);
        board.position.set(f.x, f.y - 0.02, 0.1);
        board.rotation.z = (waveY(f.x + 0.3) - waveY(f.x - 0.3)) / 1.0;
      }
      const flyU = outcome === 'fail' && variant === 1 ? clamp01((t - 0.5) / 0.35) : 0;
      weed.visible = flyU > 0 && flyU < 1;
      if (weed.visible) {
        moveFrame('wave', 'fail', 1, 0.85, f);
        weed.position.set(
          lerp(6.6, f.x, flyU),
          lerp(2.8, f.y + 1.0, flyU) + Math.sin(Math.PI * flyU) * 0.6,
          0.2,
        );
      }
    };
  });
}

// ---------- Snowy forest ----------

function log(): Prop {
  return prop((kit, root) => {
    const g = new Group();
    root.add(g);
    const bark = kit.lit(0x7a5230, 0.95);
    const ring = kit.lit(0xd9b27a, 0.8);
    const body = cyl(kit, LOG_R, LOG_R, 1.4, bark, g);
    body.rotation.x = Math.PI / 2;
    for (const [r, c] of [
      [0.78, 0xd9b27a],
      [0.55, 0xb88a52],
      [0.32, 0xd9b27a],
      [0.12, 0xb88a52],
    ] as const) {
      const disc = cyl(kit, r, r, 0.02, kit.lit(c, 0.8), g, 0, 0, 0.71);
      disc.rotation.x = Math.PI / 2;
    }
    void ring;
    kit.box(0.5, 0.06, 0.06, kit.lit(0x5a3a1a, 0.9), g, 0.5, 0.5, 0.3).rotation.z = 0.5;
    const snow = sphere(kit, 0.5, kit.lit(0xffffff, 0.9), root, 6, 1.75, 0.0);
    snow.scale.set(1.3, 0.25, 1);
    return (outcome, variant, t) => {
      const x = logX(outcome, variant, t);
      g.position.set(x, LOG_R, 0.1);
      g.rotation.z = (6 - x) / LOG_R;
      snow.visible = x > 5.99;
    };
  });
}

function snowball(): Prop {
  return prop((kit, root) => {
    const ball = new Group();
    root.add(ball);
    const white = kit.lit(0xf4f8ff, 0.9);
    sphere(kit, SNOW_R, white, ball);
    for (let i = 0; i < 9; i++) {
      const a = hash(i) * Math.PI * 2;
      const b = (hash(i + 4) - 0.5) * 2.4;
      sphere(
        kit,
        0.18,
        kit.lit(i % 2 ? 0xc9d8ea : 0x7a7f87, 0.9),
        ball,
        Math.cos(a) * 0.95 * Math.cos(b),
        Math.sin(b) * 0.95,
        Math.sin(a) * 0.95 * Math.cos(b),
      );
    }
    const trail = kit.box(2.2, 0.04, 1.2, kit.lit(0xe4ecf7, 0.9), root, 6, 0.03, 0.1);
    void trail;
    return (outcome, variant, t) => {
      const x = snowX(outcome, variant, t);
      ball.visible = !snowGone(outcome, variant, t);
      ball.position.set(x, SNOW_R, 0.1);
      ball.rotation.z = (7.6 - x) / SNOW_R;
      ball.scale.z = outcome === 'fail' && variant === 0 && t > 0.6 ? 0.7 : 1;
    };
  });
}

function ice(): Prop {
  return prop((kit, root) => {
    kit.box(4.6, 0.04, 2.6, kit.lit(0x7fc8f0, 0.2), root, 6.2, 0.03, 0.0);
    for (let i = 0; i < 6; i++) {
      kit.box(
        0.6 + hash(i) * 0.6,
        0.01,
        0.05,
        kit.lit(0xffffff, 0.3),
        root,
        4.6 + i * 0.65,
        0.06,
        -0.6 + hash(i + 3) * 1.4,
      );
    }
    // Snowy bank around the pond.
    for (const x of [3.9, 8.5])
      sphere(kit, 0.35, kit.lit(0xffffff, 0.9), root, x, 0.1, -0.2).scale.set(1.2, 0.5, 1.4);
    const dark = kit.lit(0x1d4a78, 0.4);
    const water = kit.box(1.7, 0.02, 1.6, dark, root, 5.9, 0.07, 0.1);
    water.visible = false;
    const cracks: Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const c = kit.box(
        1.0,
        0.012,
        0.06,
        kit.lit(0x35618f, 0.4),
        root,
        5.9,
        0.075,
        -0.4 + i * 0.25,
      );
      c.rotation.y = (hash(i) - 0.5) * 2;
      cracks.push(c);
    }
    const shards = [0, 1, 2, 3].map((i) =>
      kit.box(
        0.5,
        0.05,
        0.4,
        kit.lit(0xe8f6ff, 0.3),
        root,
        5.3 + i * 0.5,
        0.1,
        -0.2 + hash(i) * 0.6,
      ),
    );
    return (outcome, variant, t) => {
      const s = iceState(outcome, variant, t);
      cracks.forEach((c, i) => {
        c.visible = s.crack > i / 6;
      });
      water.visible = s.broken;
      shards.forEach((m, i) => {
        m.visible = s.broken;
        m.rotation.y = i + 0.3 * Math.sin(t * 2 + i);
      });
    };
  });
}

// ---------- Desert ----------

function cactus(): Prop {
  return prop((kit, root) => {
    const green = kit.lit(0x3e9a4a, 0.8);
    const dark = kit.lit(0x2f7a3a, 0.8);
    const white = kit.lit(0xfff6d8, 0.6);
    const tube = (x0: number, y0: number, x1: number, y1: number, r: number, z: number) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const m = cyl(kit, r, r, len, green, root, (x0 + x1) / 2, (y0 + y1) / 2, z);
      m.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
      sphere(kit, r, green, root, x1, y1, z);
    };
    tube(6.0, 0, 6.0, 3.3, 0.45, -0.9);
    tube(6.0, 1.15, 4.5, 1.15, 0.24, -0.55);
    tube(4.5, 1.15, 4.5, 2.4, 0.24, -0.55);
    tube(6.0, 2.0, 7.4, 2.0, 0.24, -0.55);
    tube(7.4, 2.0, 7.4, 3.0, 0.24, -0.55);
    for (let i = 0; i < 14; i++) {
      const y = 0.3 + hash(i) * 2.9;
      const s = kit.mesh(
        new CylinderGeometry(0, 0.03, 0.22, 4),
        white,
        root,
        6 + (hash(i + 7) - 0.5) * 0.7,
        y,
        -0.45,
      );
      s.rotation.x = Math.PI / 2;
    }
    sphere(kit, 0.2, kit.lit(0xff6f91, 0.6), root, 6, 3.75, -0.9);
    // The small barrel cactus after the arch.
    const barrel = sphere(kit, 0.5, dark, root, 8.4, 0.4, 0.1);
    barrel.scale.set(1, 0.85, 1);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      kit.mesh(
        new CylinderGeometry(0, 0.025, 0.2, 4),
        white,
        root,
        8.4 + Math.cos(a) * 0.45,
        0.4 + Math.sin(a) * 0.38,
        0.1 + 0.18,
      ).rotation.z = a - Math.PI / 2;
    }
    sphere(kit, 0.14, kit.lit(0xf2c230, 0.6), root, 8.4, 0.88, 0.1);
    return () => {};
  });
}

function tumbleweed(): Prop {
  return prop((kit, root) => {
    const ball = new Group();
    root.add(ball);
    const wire = new MeshBasicMaterial({ color: 0x9a7a4a, wireframe: true });
    kit.materials.push(wire);
    kit.mesh(new IcosahedronGeometry(TUMBLE_R, 1), wire, ball);
    kit.mesh(new IcosahedronGeometry(TUMBLE_R * 0.7, 0), wire, ball).rotation.set(0.5, 0.3, 0);
    for (let i = 0; i < 8; i++) {
      const s = kit.box(2 * TUMBLE_R * 0.9, 0.03, 0.03, kit.lit(0x7a5a2a, 0.9), ball);
      s.rotation.set(hash(i) * 3, hash(i + 2) * 3, hash(i + 5) * 3);
    }
    return (outcome, variant, t) => {
      const x = tumbleX(outcome, variant, t);
      ball.visible = !tumbleGone(outcome, variant, t);
      ball.position.set(x, TUMBLE_R, 0.1);
      ball.rotation.z = (7.6 - x) / TUMBLE_R;
    };
  });
}

function dune(): Prop {
  return prop((kit, root) => {
    profileSlab(kit, kit.lit(0xe6c06a, 0.95), root, DUNE.x0, DUNE.x1, duneY, -1.6, -0.3);
    // Ripples along the front face.
    for (let i = 0; i < 6; i++) {
      const x = DUNE.x0 + 0.6 + i * 0.85;
      const h = duneY(x);
      if (h > 0.3) kit.box(0.7, 0.03, 0.02, kit.lit(0xc9a24a, 0.9), root, x, h * 0.55, -0.28);
    }
    const board = kit.box(1.2, 0.06, 0.4, kit.lit(0x2fb6a8, 0.5), root, 6, 3, 0.0);
    board.visible = false;
    const mound = sphere(kit, 0.9, kit.lit(0xe6c06a, 0.95), root, 8.6, 0, 0.1);
    mound.visible = false;
    const f = createFrame();
    return (outcome, variant, t) => {
      let on = false;
      if (outcome !== null) {
        moveFrame('dune', outcome, variant, Math.min(t, 2.5), f);
        on = f.pose === 'surf' && f.visible;
      }
      board.visible = on;
      if (on) {
        board.position.set(f.x, f.y - 0.02, 0.0);
        board.rotation.z = (duneY(f.x + 0.3) - duneY(f.x - 0.3)) / 0.6;
      }
      const m = moundSize(outcome, variant, t);
      mound.visible = m > 0.02;
      mound.scale.set(m * 1.2, m * 0.8, m);
    };
  });
}

// ---------- Space station ----------

function boxes(): Prop {
  return prop((kit, root) => {
    const metal = kit.lit(0xb8c4d6, 0.35);
    const stripe = kit.lit(0xf2c230, 0.5);
    const glow = kit.basic(0x5ce1ff);
    const items = FLOAT_BOXES.map(() => {
      const g = new Group();
      root.add(g);
      kit.box(1.0, 1.0, 0.9, metal, g);
      kit.box(1.04, 0.14, 0.94, stripe, g, 0, 0.3, 0);
      kit.box(1.04, 0.14, 0.94, stripe, g, 0, -0.3, 0);
      kit.box(0.2, 0.2, 0.02, glow, g, 0.25, 0, 0.46);
      return g;
    });
    return (outcome, variant, t) => {
      items.forEach((g, i) => {
        const c = boxCentre(i, outcome, variant, t);
        g.position.set(c.x, c.y, 0.1);
        g.rotation.z = boxSpin(i, t);
      });
    };
  });
}

function lasers(): Prop {
  return prop((kit, root) => {
    const steel = kit.lit(0x6a7488, 0.4);
    for (const x of [4.9, 7.7]) kit.box(0.3, 3.8, 0.3, steel, root, x, 1.9, -0.6);
    kit.box(3.1, 0.3, 0.3, steel, root, 6.3, 3.75, -0.4);
    const red = kit.basic(0xff2a2a);
    const halo = kit.basic(0xff7a7a, 0.4);
    const rays = BEAMS_X.map((x) => {
      const g = new Group();
      root.add(g);
      kit.box(0.1, 0.1, 0.1, kit.lit(0x333a48, 0.4), g, x, 3.55, -0.4);
      kit.box(0.06, 2.55, 0.06, red, g, x, 2.25, -0.4);
      kit.box(0.2, 2.55, 0.1, halo, g, x, 2.25, -0.4);
      return g;
    });
    const dot = sphere(kit, 0.1, red, root, 8, 0.05, 0);
    dot.visible = false;
    const f = createFrame();
    return (outcome, variant, t) => {
      rays.forEach((g, i) => {
        g.visible = laserOn(i, outcome, variant, t);
      });
      const chase = outcome === 'fail' && variant === 1 && t > 0.25 && t < 1.85;
      dot.visible = chase;
      if (chase) {
        moveFrame('lasers', 'fail', 1, Math.min(t, 1.0), f);
        if (t < 1.0) dot.position.set(f.x + 1.3, 0.05, f.z);
        else dot.position.set(f.x + 0.5, 1.2 + 0.3 * Math.sin(t * 9), -2.6);
      }
    };
  });
}

function airlock(): Prop {
  return prop((kit, root) => {
    const slabMat = kit.lit(0xd9dde6, 0.4);
    const stripe = kit.lit(0xe0504a, 0.5);
    kit.box(3.2, 0.6, 1.4, kit.lit(0x4a5470, 0.5), root, 6.1, 4.1, -0.2);
    kit.box(0.3, 3.8, 0.3, kit.lit(0x4a5470, 0.5), root, 4.6, 1.9, -0.9);
    kit.box(0.3, 3.8, 0.3, kit.lit(0x4a5470, 0.5), root, 7.6, 1.9, -0.9);
    const doors = [5.2, 7.0].map((x) => {
      const g = new Group();
      g.position.set(x, 0, 0.1);
      root.add(g);
      const slab = kit.box(0.5, 3.8, 1.6, slabMat, g, 0, 1.9, 0);
      for (let i = 0; i < 5; i++)
        kit.box(0.54, 0.28, 1.6, i % 2 ? slabMat : stripe, g, 0, 0.3 + i * 0.62, 0);
      sphere(kit, 0.16, kit.basic(0x5cff8a), g, 0, 3.95, 0.8);
      return { g, slab };
    });
    // The bubble (clear 1) and the pile of boxes in the chamber (fail 1).
    const bubble = new Mesh(new SphereGeometry(1.1, 16, 12), kit.glass(0xbfe9ff, 0.35));
    kit.geometries.push(bubble.geometry);
    bubble.visible = false;
    root.add(bubble);
    const metal = kit.lit(0xb8c4d6, 0.4);
    for (const [x, y, z] of [
      [8.9, 0.45, -1.0],
      [9.8, 0.45, -1.0],
      [10.7, 0.45, -1.0],
      [9.35, 1.3, -1.0],
      [10.25, 1.3, -1.0],
    ] as const) {
      kit.box(0.9, 0.9, 0.9, metal, root, x, y, z);
      kit.box(0.94, 0.12, 0.94, kit.lit(0xf2c230, 0.5), root, x, y + 0.2, z);
    }
    const f = createFrame();
    return (outcome, variant, t) => {
      doors.forEach((d, i) => {
        const open = doorLift(i as 0 | 1, outcome, variant, t);
        const h = 3.8 * (1 - 0.92 * open);
        d.g.scale.y = 1 - 0.92 * open;
        d.g.position.y = 3.8 - 3.8 * (1 - 0.92 * open);
        void h;
      });
      const on = outcome === 'clear' && variant === 1 && t >= 0.3 && t <= 1.35;
      bubble.visible = on;
      if (on) {
        moveFrame('airlock', 'clear', 1, t, f);
        bubble.position.set(f.x, f.y + 0.55, 0.1);
        bubble.scale.setScalar(1 + 0.04 * Math.sin(t * 8));
      }
    };
  });
}

void [smooth, BoxGeometry];

/** One builder per obstacle id. */
export const ADVENTURE_PROPS = {
  sandcastle,
  crab,
  wave,
  log,
  snowball,
  ice,
  cactus,
  tumbleweed,
  dune,
  boxes,
  lasers,
  airlock,
} as const;
