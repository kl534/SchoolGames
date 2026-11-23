/**
 * The 6 toy store and pirate ship obstacles (toy-train, blocks, ball-pit, cannon, rigging, chest)
 * as meshes. Each builder returns a `Prop` whose `update(outcome, variant, t)` poses it at the
 * same time as the cat's move (`moves/toys-pirates.ts`, which owns the shared motions); with a
 * null outcome it is the idle motion, driven by the clock.
 */
import {
  CylinderGeometry,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  type Material,
  type Mesh,
} from 'three';
import { type Kit, type Prop } from '../kit';
import {
  ROPE,
  TOWER,
  ballBounce,
  bigBallSquash,
  cannonRecoil,
  coinSpray,
  lidAngle,
  ropeSwing,
  sailFlap,
  topBlockFall,
  towerTopple,
  trainX,
} from '../moves/toys-pirates';
import { beam, cyl, hash, makeProp as prop, sphere } from './parts';

/** A wheel (a disc with a spoke) that spins about the z axis. */
function wheel(kit: Kit, parent: Group, r: number, mat: Material, x: number, y: number, z: number) {
  const g = new Group();
  g.position.set(x, y, z);
  parent.add(g);
  const disc = kit.mesh(new CylinderGeometry(r, r, 0.1, 14), mat, g);
  disc.rotation.x = Math.PI / 2;
  kit.box(r * 1.6, 0.05, 0.14, kit.lit(0xf2f2f2, 0.5), g, 0, 0, 0);
  return g;
}

// ---------- Toy store ----------

function toyTrain(): Prop {
  return prop((kit, root) => {
    // The little track.
    const rail = kit.lit(0x6b6f78, 0.4);
    const sleeper = kit.lit(0x8a5a2a, 0.9);
    kit.box(9.4, 0.04, 0.1, rail, root, 7.6, 0.1, 0.0);
    kit.box(9.4, 0.04, 0.1, rail, root, 7.6, 0.1, 0.6);
    for (let i = 0; i < 18; i++) kit.box(0.14, 0.05, 0.9, sleeper, root, 3.2 + i * 0.52, 0.04, 0.3);

    const train = new Group();
    train.position.z = 0.3;
    root.add(train);
    const black = kit.lit(0x2a2a2e, 0.5);
    const wheels: Group[] = [];
    const car = (x: number, body: number, roof: number) => {
      kit.box(1.5, 0.75, 0.9, kit.lit(body, 0.5), train, x, 0.575, 0);
      kit.box(1.6, 0.08, 1.0, kit.lit(roof, 0.5), train, x, 0.97, 0);
      kit.box(0.5, 0.3, 0.05, kit.lit(0xfff0b8, 0.4), train, x - 0.35, 0.65, 0.47);
      kit.box(0.5, 0.3, 0.05, kit.lit(0xfff0b8, 0.4), train, x + 0.35, 0.65, 0.47);
      for (const dx of [-0.5, 0.5]) wheels.push(wheel(kit, train, 0.22, black, x + dx, 0.22, 0.45));
    };
    // Caboose (x = 0 is its centre), a car, and the engine at the front.
    car(0, 0xd8402e, 0x8a2a1e);
    kit.box(0.6, 0.32, 0.6, kit.lit(0xd8402e, 0.5), train, 0, 1.17, 0);
    car(1.7, 0x3f8fd8, 0x2a5f9a);
    kit.box(0.6, 0.3, 0.6, kit.lit(0xf2c230, 0.5), train, 1.7, 1.15, 0);
    kit.box(0.4, 0.3, 0.6, kit.lit(0x9b59b6, 0.5), train, 1.9, 1.15, 0.1);
    kit.box(0.35, 0.06, 0.06, black, train, 0.85, 0.35, 0);
    const engine = kit.lit(0x5cb85c, 0.45);
    kit.box(1.1, 0.75, 0.9, kit.lit(0xf2c230, 0.5), train, 3.5, 0.575, 0);
    kit.box(1.2, 0.08, 1.0, kit.lit(0x8a6a10, 0.5), train, 3.5, 0.97, 0);
    kit.mesh(new CylinderGeometry(0.4, 0.4, 1.5, 16), engine, train, 4.4, 0.65, 0).rotation.z =
      Math.PI / 2;
    cyl(kit, 0.18, 0.12, 0.5, kit.lit(0xd8402e, 0.5), train, 4.7, 1.2, 0);
    sphere(kit, 0.1, kit.lit(0xf2c230, 0.4), train, 5.15, 0.65, 0);
    kit.box(0.35, 0.06, 0.06, black, train, 2.55, 0.35, 0);
    for (const dx of [3.3, 4.2, 4.9]) wheels.push(wheel(kit, train, 0.26, black, dx, 0.26, 0.45));
    const puffs = [0, 1, 2].map((i) =>
      sphere(kit, 0.2, kit.basic(0xffffff, 0.8), train, 4.7, 1.6 + i * 0.3, 0),
    );
    return (outcome, variant, t) => {
      const x = trainX(outcome, variant, t);
      train.position.x = x;
      for (const w of wheels) w.rotation.z = -x * 4;
      puffs.forEach((p, i) => {
        const k = (t * 0.9 + i / 3) % 1;
        p.position.set(4.7 - k * 0.5, 1.5 + k * 1.0, 0);
        p.scale.setScalar(0.5 + k);
      });
    };
  });
}

/** The colours of the toy blocks. */
const BLOCK_COLOURS = [0xe0504a, 0x3f8fd8, 0xf2c230, 0x5cb85c, 0xff9f43, 0x9b59b6];

function blocks(): Prop {
  return prop((kit, root) => {
    // A few lettered faces (one painted texture each), shared by every block.
    const faces = ['A', 'B', 'C', 'D'].map((letter, i) => {
      const tex = kit.paint(64, 64, (g) => {
        g.fillStyle = '#fff7dc';
        g.fillRect(4, 4, 56, 56);
        g.fillStyle = ['#e0504a', '#3f8fd8', '#2f9a4a', '#9b59b6'][i];
        g.font = 'bold 44px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(letter, 32, 36);
      });
      if (!tex) return kit.lit(0xfff7dc, 0.6);
      const m = new MeshBasicMaterial({ map: tex });
      kit.materials.push(m);
      return m;
    });
    const block = (parent: Group, x: number, y: number, w: number, h: number, i: number) => {
      kit.box(w, h, 0.8, kit.lit(BLOCK_COLOURS[i % BLOCK_COLOURS.length], 0.55), parent, x, y, 0);
      kit.box(Math.min(w, h) * 0.72, Math.min(w, h) * 0.72, 0.03, faces[i % 4], parent, x, y, 0.41);
    };
    // The staircase tower: column i is a stack of i + 1 blocks, pivoting at its foot.
    const columns: Group[] = [];
    let n = 0;
    for (let i = 0; i < TOWER.columns; i++) {
      const col = new Group();
      col.position.set(TOWER.x + i * TOWER.stair, 0, -0.6);
      root.add(col);
      for (let k = 0; k <= i; k++) block(col, 0, (k + 0.5) * TOWER.step, 0.65, TOWER.step, n++);
      columns.push(col);
    }
    // The top block of the last column is its own piece so it can fall off.
    const lastCol = columns[TOWER.columns - 1];
    const top = lastCol.children.slice(-2);
    const topPiece = new Group();
    topPiece.position.y = (TOWER.columns - 0.5) * TOWER.step;
    lastCol.add(topPiece);
    for (const m of top) {
      m.position.y -= topPiece.position.y;
      topPiece.add(m);
    }
    // The block bridge beside the tower.
    const bridge = new Group();
    bridge.position.z = -0.3;
    root.add(bridge);
    for (const px of [8.2, 10.6]) {
      block(bridge, px, 0.33, 0.7, 0.66, n++);
      block(bridge, px, 0.99, 0.7, 0.66, n++);
    }
    for (let i = 0; i < 4; i++) block(bridge, 8.2 + 0.7 + i * 0.67 + 0.2, 1.6, 0.8, 0.6, n++);
    return (outcome, variant, t) => {
      const fall = towerTopple(outcome, variant, t);
      columns.forEach((col, i) => {
        const f = i === 0 ? 0 : fall;
        col.rotation.z = f * (1.5 + 0.05 * (i % 3));
        col.position.y = f * 0.33;
        col.position.z = -0.6 + f * 0.1 * i;
      });
      const p = topBlockFall(outcome, variant, t);
      topPiece.position.set(2.5 * p, (TOWER.columns - 0.5) * TOWER.step - 2.75 * p ** 1.6, p * 0.5);
      topPiece.rotation.z = -p * 2.2;
    };
  });
}

function ballPit(): Prop {
  return prop((kit, root) => {
    // The bin: a blue base, a tall back and a low front.
    const blue = kit.lit(0x3f8fd8, 0.5);
    const white = kit.lit(0xffffff, 0.5);
    kit.box(5.0, 0.12, 1.6, blue, root, 6.5, 0.06, -0.1);
    kit.box(5.2, 1.0, 0.14, blue, root, 6.5, 0.5, -0.85);
    kit.box(5.2, 0.7, 0.14, blue, root, 6.5, 0.35, 0.7);
    for (const s of [-1, 1]) kit.box(0.14, 1.0, 1.6, blue, root, 6.5 + s * 2.6, 0.5, -0.1);
    kit.box(5.0, 0.16, 0.16, white, root, 6.5, 0.45, 0.78);
    // About 30 balls in 5 colours: shared geometry, one material per colour.
    const geometry = new SphereGeometry(0.32, 14, 10);
    kit.geometries.push(geometry);
    const mats = [0xe0504a, 0xf2c230, 0x3f8fd8, 0x5cb85c, 0xff7ab8].map((c) => kit.lit(c, 0.3));
    const balls: { mesh: Mesh; y: number }[] = [];
    const ball = (x: number, y: number, z: number, i: number) => {
      const mesh = kit.mesh(geometry, mats[i % mats.length], root, x, y, z);
      balls.push({ mesh, y });
    };
    let i = 0;
    for (let c = 0; c < 7; c++)
      for (const z of [-0.5, 0.05, 0.5]) ball(4.5 + c * 0.66, 0.4, z, i++);
    for (let c = 0; c < 6; c++)
      for (const z of [-0.2, 0.3]) ball(4.83 + c * 0.66, 0.95, z, i++ + 2);
    // The one big bouncy ball the cat bounces off.
    const big = sphere(kit, 0.5, kit.lit(0xff7ab8, 0.25), root, 5.4, 1.0, 0.1);
    return (outcome, variant, t) => {
      balls.forEach((b, k) => {
        b.mesh.position.y = b.y + ballBounce(outcome, variant, t, k);
      });
      const sq = bigBallSquash(outcome, variant, t);
      big.scale.set(1 + 0.25 * sq, 1 - 0.4 * sq, 1 + 0.25 * sq);
      big.position.y = 1.0 - 0.2 * sq;
    };
  });
}

// ---------- Pirate ship ----------

function cannon(): Prop {
  return prop((kit, root) => {
    const wood = kit.lit(0x8a5a2a, 0.85);
    const iron = kit.lit(0x2e3036, 0.4);
    const rope = kit.lit(0xd9b877, 0.9);
    // A coil of rope on the deck (the cat lands in it when shot out).
    const coil = kit.lit(0xd9b877, 0.9);
    for (const r of [0.55, 0.38]) {
      kit.mesh(new TorusGeometry(r, 0.12, 8, 18), coil, root, 10.2, 0.14, 0.1).rotation.x =
        Math.PI / 2;
    }
    const gun = new Group();
    root.add(gun);
    kit.box(2.4, 0.5, 0.9, wood, gun, 5.4, 0.8, 0);
    kit.box(2.0, 0.12, 1.0, kit.lit(0x6b4220, 0.85), gun, 5.5, 1.1, 0);
    const wheels = [4.5, 6.3].map((x) => wheel(kit, gun, 0.5, wood, x, 0.5, 0.5));
    for (const x of [4.5, 6.3]) kit.box(0.14, 0.14, 0.2, iron, gun, x, 0.5, 0.6);
    // The barrel points up and forward from the breech (4.6, 1.0) to the mouth (7.0, 2.5).
    const ang = Math.atan2(1.5, 2.4);
    const barrel = kit.mesh(new CylinderGeometry(0.3, 0.42, 2.9, 18), iron, gun, 5.8, 1.75, 0);
    barrel.rotation.z = ang - Math.PI / 2;
    const mouth = kit.mesh(new CylinderGeometry(0.34, 0.34, 0.12, 18), iron, gun, 7.0, 2.5, 0);
    mouth.rotation.z = ang - Math.PI / 2;
    sphere(kit, 0.44, iron, gun, 4.55, 0.98, 0);
    for (const t of [0.35, 0.6]) {
      kit
        .mesh(
          new TorusGeometry(0.4 - t * 0.12, 0.05, 6, 16),
          kit.lit(0xf2c230, 0.4),
          gun,
          4.6 + 2.4 * t,
          1.0 + 1.5 * t,
          0,
        )
        .rotation.set(0, Math.PI / 2, ang - Math.PI / 2 + Math.PI / 2);
    }
    // Cannonballs and a rope fuse.
    for (const [x, y] of [
      [3.6, 0.22],
      [3.95, 0.22],
      [3.78, 0.6],
    ] as const)
      sphere(kit, 0.18, iron, root, x, y, 0.2);
    beam(kit, rope, gun, [4.5, 1.1], [4.3, 0.8], 0.04, 0.1);
    return (outcome, variant, t) => {
      const rec = cannonRecoil(outcome, variant, t);
      gun.position.x = -rec * 0.9;
      for (const w of wheels) w.rotation.z = rec * 2;
    };
  });
}

function rigging(): Prop {
  return prop((kit, root) => {
    const wood = kit.lit(0x8a5a2a, 0.85);
    const rope = kit.lit(0xd9b877, 0.9);
    // The mast, its yard (the spar the sail hangs from) and a flag on top.
    cyl(kit, 0.17, 0.2, 5.8, wood, root, 6.6, 2.9, -0.9);
    kit.box(4.2, 0.14, 0.14, wood, root, 8.1, 5.0, -0.9);
    kit.box(0.7, 0.45, 0.04, kit.lit(0x222222, 0.7), root, 7.0, 5.65, -0.9);
    // The rope net from the deck up to the mast head: a slanted edge, ratlines across it.
    const edge = (y: number) => 3.6 + (y * (6.5 - 3.6)) / 5.0;
    beam(kit, rope, root, [3.6, 0], [6.5, 5.0], 0.07, -0.85);
    beam(kit, rope, root, [4.1, 0], [6.5, 4.5], 0.05, -0.85);
    beam(kit, rope, root, [4.6, 0], [6.5, 3.7], 0.05, -0.85);
    for (let y = 0.6; y < 4.8; y += 0.6) {
      const x = edge(y);
      beam(kit, rope, root, [x, y], [6.5, y], 0.05, -0.85);
    }
    // The sail: a triangle hanging from the yard, its top edge a slope the cat slides down.
    const sail = new Group();
    sail.position.set(6.7, 4.9, -0.6);
    root.add(sail);
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(3.2, -3.7);
    shape.lineTo(0, -3.7);
    shape.lineTo(0, 0);
    const geometry = new ShapeGeometry(shape);
    kit.geometries.push(geometry);
    const cloth = new MeshBasicMaterial({ color: 0xfff5e0, side: DoubleSide });
    kit.materials.push(cloth);
    kit.mesh(geometry, cloth, sail);
    const slope = Math.atan2(-3.7, 3.2);
    const spar = kit.box(4.9, 0.12, 0.12, wood, sail, 1.6, -1.85, 0.02);
    spar.rotation.z = slope;
    // The hanging rope with a knot.
    const swing = new Group();
    swing.position.set(ROPE.x, ROPE.top, -0.3);
    root.add(swing);
    kit.box(0.1, 0.16, 0.1, wood, root, ROPE.x, ROPE.top + 0.05, -0.3);
    cyl(kit, 0.06, 0.06, ROPE.length, rope, swing, 0, -ROPE.length / 2, 0);
    sphere(kit, 0.16, rope, swing, 0, -ROPE.length - 0.05, 0);
    return (outcome, variant, t) => {
      sail.rotation.z = sailFlap(outcome, variant, t);
      swing.rotation.z = -ropeSwing(outcome, variant, t);
    };
  });
}

function chest(): Prop {
  return prop((kit, root) => {
    const wood = kit.lit(0x8a4f22, 0.8);
    const dark = kit.lit(0x4a2a12, 0.9);
    const gold = kit.lit(0xf2c230, 0.3);
    // The body, with gold bands and a lock.
    kit.box(2.0, 0.9, 1.1, wood, root, 6.0, 0.45, -0.2);
    for (const x of [5.2, 6.8]) kit.box(0.14, 0.92, 1.14, gold, root, x, 0.45, -0.2);
    kit.box(0.3, 0.3, 0.06, gold, root, 6.0, 0.7, 0.37);
    // The coins heaped inside.
    for (let i = 0; i < 9; i++) {
      sphere(kit, 0.18, gold, root, 5.3 + hash(i) * 1.4, 0.92, -0.5 + hash(i + 5) * 0.6).scale.y =
        0.5;
    }
    // The lid hinges at the back right (x = 7): half a drum, wider than it is tall.
    const lid = new Group();
    lid.position.set(7.0, 0.9, -0.2);
    root.add(lid);
    const drum = kit.mesh(
      new CylinderGeometry(0.5, 0.5, 1.1, 20, 1, false, -Math.PI / 2, Math.PI),
      wood,
      lid,
      -1.0,
      0,
      0,
    );
    drum.rotation.x = -Math.PI / 2;
    drum.scale.x = 2;
    kit.box(2.0, 0.06, 1.1, dark, lid, -1.0, 0.03, 0);
    for (const x of [-1.8, -0.2]) kit.box(0.14, 1.0, 1.14, gold, lid, x, 0.12, 0).scale.y = 0.55;
    // Thrown coins.
    const coins = Array.from({ length: 14 }, () => {
      const c = cyl(kit, 0.16, 0.16, 0.04, gold, root, 6, 1, 0.2);
      c.rotation.x = Math.PI / 2;
      c.visible = false;
      return c;
    });
    return (outcome, variant, t) => {
      lid.rotation.z = -lidAngle(outcome, variant, t);
      const p = coinSpray(outcome, variant, t);
      coins.forEach((c, i) => {
        c.visible = p >= 0;
        if (p < 0) return;
        const tau = p;
        c.position.set(
          6.0 + (hash(i + 7) - 0.5) * 4.2 * tau,
          1.0 + (3.4 + hash(i) * 2.2) * tau - 4.6 * tau * tau,
          0.2 + (hash(i + 3) - 0.5) * 0.6,
        );
        c.rotation.z = tau * 9 * (hash(i + 1) + 0.5);
      });
    };
  });
}

/** One builder per obstacle id. */
export const TOYS_PIRATES_PROPS = {
  'toy-train': toyTrain,
  blocks,
  'ball-pit': ballPit,
  cannon,
  rigging,
  chest,
} as const;
