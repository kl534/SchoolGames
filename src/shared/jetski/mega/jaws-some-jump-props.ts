/**
 * The props of Jaws-Some Jump: a goofy shark in sunglasses (who leaps and plays fetch with the ski
 * on a miss), a giant translucent wave with a curling crest that collapses on a miss, and a pirate
 * ship with two holed sails, a crew that cheers and the tangle of sail that wraps the rider.
 * Painted primitives, built once and only moved.
 */
import {
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  MeshStandardMaterial,
  Path,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  type Mesh,
  type Object3D,
} from 'three';
import { createFrame, prog, resetFrame, sitOnSki } from '../anim';
import type { Kit } from '../kit';
import {
  FETCH,
  JAWS_SOME_JUMP,
  SHARK,
  SHIP,
  TANGLE,
  TUMBLE,
  WAVE,
  plankY,
  rampY,
  sharkPose,
  waveLevel,
} from './jaws-some-jump';
import { profile, type MegaBuilt } from './props-kit';

const probe = createFrame();

/** The ski and rider at `t` of an element's animation, for props that react to them. */
function frameOf(element: 0 | 1 | 2, outcome: 'clear' | 'fail', t: number) {
  const def = JAWS_SOME_JUMP.elements[element][outcome];
  resetFrame(probe);
  def.at(Math.min(Math.max(t, 0), def.duration), probe);
  if (probe.rider.mode === 'seated') sitOnSki(probe);
  return probe;
}

const WOOD = [0xb07a45, 0x9a6a3a];

// ---------- Element 1: the shark ----------

function buildShark(kit: Kit): MegaBuilt {
  const group = new Group();
  // The foam ramp the ski launches from, with a few coral boulders beside it.
  profile(kit, group, rampY, SHARK.rampFoot, SHARK.lip, 0.6, -1.0, 1.9, 0xffffff, 0x9fe6f0);
  const coral = [0xff6f61, 0xff8fb1, 0xffc247, 0xc77dff];
  [
    [6, -3.4],
    [9, 3.6],
    [27, -4.2],
    [30, 4.4],
  ].forEach(([d, s], i) => {
    const lump = kit.mesh(
      new SphereGeometry(1.1, 10, 8),
      kit.lit(coral[i % 4], 0.8),
      group,
      s,
      0.2,
      -d,
    );
    lump.scale.set(1, 0.8, 1);
  });

  const pivot = new Group();
  pivot.position.set(0, 0.25, -SHARK.centerD);
  group.add(pivot);
  const bob = new Group();
  pivot.add(bob);
  const grey = kit.lit(0x6f93b8, 0.5);
  const belly = kit.lit(0xf1f5fa, 0.55);
  const dark = kit.lit(0x16161c, 0.3);
  const body = kit.mesh(new SphereGeometry(1, 24, 16), grey, bob, 0, 0.3, 0);
  body.scale.set(SHARK.halfWidth, 1.25, SHARK.half + 0.2);
  kit
    .mesh(new SphereGeometry(1, 20, 12), belly, bob, 0, -0.1, 0.2)
    .scale.set(SHARK.halfWidth - 0.15, 0.9, SHARK.half - 0.4);
  // The snout.
  kit
    .mesh(new SphereGeometry(1, 16, 12), grey, bob, 0, 0.45, SHARK.half - 0.9)
    .scale.set(1.3, 0.9, 1.5);
  // The dorsal fin, tilted back, and the pectoral fin that waves.
  const fin = kit.mesh(
    new ConeGeometry(0.62, 1.9, 4),
    grey,
    bob,
    0,
    2.2,
    -(SHARK.finD - SHARK.centerD),
  );
  fin.rotation.set(-0.35, Math.PI / 4, 0);
  fin.scale.set(0.45, 1, 1);
  const wave = new Group();
  wave.position.set(1.5, 0.1, 1.4);
  bob.add(wave);
  const pectoral = kit.mesh(new ConeGeometry(0.5, 2.0, 4), grey, wave, 0.7, -0.4, 0);
  pectoral.rotation.z = -1.1;
  pectoral.scale.set(1, 1, 0.3);
  // The tail: an upright fin and a fluke.
  const tail = kit.mesh(new ConeGeometry(0.9, 2.6, 4), grey, bob, 0, 1.0, -SHARK.half - 1.0);
  tail.rotation.set(-0.5, Math.PI / 4, 0);
  tail.scale.set(0.3, 1, 1);
  kit
    .mesh(new ConeGeometry(0.6, 1.6, 4), grey, bob, 0, 0.0, -SHARK.half - 0.7)
    .scale.set(1.6, 1, 0.3);
  // Sunglasses: two dark lenses, a bridge over the snout and a glint on each.
  for (const side of [-1, 1]) {
    kit
      .mesh(new SphereGeometry(1, 14, 10), dark, bob, side * 1.6, 1.05, 3.5)
      .scale.set(0.16, 0.5, 0.7);
    kit.mesh(new SphereGeometry(0.1, 8, 6), kit.basic(0xffffff), bob, side * 1.75, 1.25, 3.3);
    kit.box(0.08, 0.1, 1.3, dark, bob, side * 1.55, 1.35, 2.6);
  }
  kit.box(3.3, 0.14, 0.16, dark, bob, 0, 1.55, 3.5);
  // A goofy grin: the lower jaw hinges under the snout, with a row of teeth and a tongue.
  const jaw = new Group();
  jaw.position.set(0, -0.15, SHARK.half - 1.4);
  bob.add(jaw);
  kit.mesh(new SphereGeometry(1, 16, 10), belly, jaw, 0, -0.1, 1.1).scale.set(1.15, 0.38, 1.5);
  kit
    .mesh(new SphereGeometry(1, 12, 8), kit.lit(0x8a1f2e, 0.7), bob, 0, -0.05, SHARK.half - 0.5)
    .scale.set(1.0, 0.3, 1.2);
  const white = kit.lit(0xffffff, 0.4);
  for (let i = -3; i <= 3; i++) {
    const tooth = kit.mesh(
      new ConeGeometry(0.11, 0.3, 4),
      white,
      jaw,
      i * 0.28,
      0.14,
      2.35 - Math.abs(i) * 0.1,
    );
    tooth.rotation.x = Math.PI;
  }
  for (let i = -2; i <= 2; i++) {
    kit.mesh(
      new ConeGeometry(0.11, 0.3, 4),
      white,
      bob,
      i * 0.3,
      -0.12,
      SHARK.half + 0.1 - Math.abs(i) * 0.12,
    );
  }
  kit
    .mesh(new SphereGeometry(0.34, 8, 6), kit.lit(0xff7a9a, 0.6), jaw, 0.45, 0.0, 2.35)
    .scale.set(1, 0.4, 1.4);

  const pose = (outcome: 'clear' | 'fail', t: number) => {
    const p = sharkPose(outcome, t);
    pivot.position.y = 0.25 + p.lift;
    pivot.rotation.set(-p.pitch, p.yaw, p.roll);
    const { catchAt, tossAt } = FETCH;
    let open = 0.1;
    if (outcome === 'fail') {
      // Jaws wide as it leaps, snapping shut on the ski, then a big grin for the toss.
      open =
        0.75 *
        prog(t, catchAt - 0.35, catchAt - 0.05, 'o') *
        (1 - prog(t, catchAt - 0.05, catchAt + 0.05));
      open +=
        0.35 * prog(t, tossAt - 0.1, tossAt + 0.1) * (1 - prog(t, tossAt + 0.3, tossAt + 0.8));
      open = Math.max(open, 0.1);
    }
    jaw.rotation.x = open;
    // The pectoral fin waves as the ski sails over.
    const ski = frameOf(0, outcome, t).ski;
    const near = outcome === 'clear' && Math.abs(ski.d - SHARK.centerD) < 9 && ski.y > 1 ? 1 : 0.15;
    wave.rotation.z =
      0.5 * near * Math.sin(t * 12) + (outcome === 'fail' ? 0.6 * Math.sin(t * 9) : 0);
  };
  const idle = (time: number) => {
    bob.position.y = 0.06 * Math.sin(time * 1.7);
    bob.rotation.z = 0.025 * Math.sin(time * 1.3);
  };
  return {
    group,
    update(outcome, t) {
      pose(outcome, t);
      idle(t);
    },
    ambient: idle,
    reset: () => pose('clear', 0),
  };
}

// ---------- Element 2: the giant wave ----------

function buildWave(kit: Kit): MegaBuilt {
  const group = new Group();
  const R = WAVE.radius;
  const length = WAVE.to - WAVE.from;
  const mid = (WAVE.from + WAVE.to) / 2;
  const shell = new Group();
  shell.position.set(WAVE.axisS, 0, -mid);
  group.add(shell);
  const thetaStart = ((WAVE.lipAngle + 90) * Math.PI) / 180;
  const thetaLength = ((WAVE.bottomAngle - WAVE.lipAngle) * Math.PI) / 180;
  const skin = (color: number, opacity: number) => {
    const m = new MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.15,
      side: DoubleSide,
      depthWrite: false,
    });
    kit.materials.push(m);
    return m;
  };
  const cy = R - 0.3;
  const outer = kit.mesh(
    new CylinderGeometry(R, R, length, 30, 1, true, thetaStart, thetaLength),
    skin(0x28cfe6, 0.72),
    shell,
    0,
    cy,
    0,
  );
  outer.rotation.x = Math.PI / 2;
  const inner = kit.mesh(
    new CylinderGeometry(
      R - 0.35,
      R - 0.35,
      length,
      30,
      1,
      true,
      thetaStart + 0.12,
      thetaLength - 0.2,
    ),
    skin(0x0f86b3, 0.85),
    shell,
    0,
    cy,
    0,
  );
  inner.rotation.x = Math.PI / 2;
  // Foam along the curling crest, and along the foot of the wall.
  const foam = kit.basic(0xf6fdff);
  const crest: Mesh[] = [];
  const lipA = (WAVE.lipAngle * Math.PI) / 180;
  for (let z = -length / 2 + 0.5; z <= length / 2; z += 1.1) {
    const ball = kit.mesh(
      new SphereGeometry(0.62, 10, 8),
      foam,
      shell,
      Math.cos(lipA) * R,
      cy + Math.sin(lipA) * R,
      z,
    );
    crest.push(ball);
  }
  // The wash left when the wave comes down.
  const wash = kit.mesh(
    new SphereGeometry(1, 16, 8),
    kit.basic(0xf6fdff, 0.8),
    group,
    WAVE.axisS,
    0.12,
    -mid,
  );
  wash.scale.set(R + 0.5, 0.12, length / 2);
  wash.visible = false;
  const pose = (outcome: 'clear' | 'fail', t: number, time: number) => {
    const level = waveLevel(outcome, t);
    shell.scale.y = Math.max(level, 0.05);
    shell.visible = level > 0.22;
    crest.forEach((ball, i) => ball.scale.setScalar(1 + 0.12 * Math.sin(time * 5 + i)));
    const washed = outcome === 'fail' ? prog(t, TUMBLE.at + 0.15, TUMBLE.at + 0.6, 'o') : 0;
    wash.visible = washed > 0.01;
    wash.scale.y = 0.12 + 0.1 * Math.sin(time * 3);
    wash.scale.x = (R + 0.5) * washed;
    wash.scale.z = (length / 2) * washed;
  };
  return {
    group,
    update: (outcome, t) => pose(outcome, t, t),
    ambient() {},
    reset: () => pose('clear', 0, 0),
  };
}

// ---------- Element 3: the pirate ship ----------

/** A little cartoon pirate: striped shirt, a round head and a black hat. */
function makePirate(kit: Kit, parent: Object3D, x: number, y: number, z: number) {
  const root = new Group();
  root.position.set(x, y, z);
  parent.add(root);
  const arms: Mesh[] = [];
  kit.mesh(new CapsuleGeometry(0.24, 0.5, 4, 8), kit.lit(0xe8403a, 0.7), root, 0, 0.55, 0);
  kit.mesh(new SphereGeometry(0.22, 10, 8), kit.lit(0xf1b48a, 0.75), root, 0, 1.15, 0);
  kit.mesh(new CylinderGeometry(0.3, 0.3, 0.07, 12), kit.lit(0x16161c, 0.5), root, 0, 1.3, 0);
  kit.mesh(new ConeGeometry(0.2, 0.28, 10), kit.lit(0x16161c, 0.5), root, 0, 1.48, 0);
  for (const side of [-1, 1]) {
    arms.push(
      kit.mesh(
        new CapsuleGeometry(0.06, 0.4, 3, 6),
        kit.lit(0xf1b48a, 0.75),
        root,
        side * 0.34,
        0.65,
        0,
      ),
    );
  }
  return { root, arms };
}

function buildShip(kit: Kit): MegaBuilt {
  const group = new Group();
  // The plank: a narrow wooden ramp with a rope rail on posts.
  profile(
    kit,
    group,
    plankY,
    SHIP.foot,
    SHIP.lip,
    0.8,
    -0.8,
    SHIP.plankHalfWidth,
    WOOD[0],
    WOOD[1],
  );
  const rope = kit.lit(0xe9dfb8, 0.8);
  for (const side of [-1, 1]) {
    for (let d = SHIP.foot + 1; d <= SHIP.lip - 0.5; d += 2) {
      kit.box(
        0.1,
        1.0,
        0.1,
        kit.lit(0x6a4a2a, 0.8),
        group,
        side * (SHIP.plankHalfWidth + 0.15),
        plankY(d) + 0.5,
        -d,
      );
    }
    kit.box(
      0.05,
      0.05,
      SHIP.lip - SHIP.foot,
      rope,
      group,
      side * (SHIP.plankHalfWidth + 0.15),
      1.7,
      -(SHIP.lip + SHIP.foot) / 2,
    ).rotation.x = -0.28;
  }
  const ship = new Group();
  ship.position.set(0, 0, -SHIP.d);
  ship.rotation.y = SHIP.yaw;
  group.add(ship);
  // The hull, a bow, the deck, a cabin at the stern and the railing.
  const hull = kit.lit(0x7a4a2a, 0.75);
  const deck = kit.lit(0xc99a5b, 0.8);
  const gold = kit.lit(0xe8c24a, 0.5);
  kit.box(3.4, 3.6, 11, hull, ship, 0, 0.8, 0);
  kit.box(3.5, 0.2, 11.1, gold, ship, 0, 0.55, 0);
  kit
    .mesh(new ConeGeometry(1.7, 3.2, 4), hull, ship, 0, 0.8, -7.0)
    .rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  kit.box(3.0, 0.08, 10.6, deck, ship, 0, SHIP.deckY + 0.04, 0);
  kit.box(3.0, 1.7, 2.4, kit.lit(0x6a3d22, 0.8), ship, 0, SHIP.deckY + 0.85, 4.2);
  kit.box(3.2, 0.14, 2.6, kit.lit(0x4a2a16, 0.8), ship, 0, SHIP.deckY + 1.75, 4.2);
  for (const side of [-1, 1]) {
    kit.box(0.1, 0.7, 8.2, hull, ship, side * 1.55, SHIP.deckY + 0.4, -1.0);
    for (let z = -4.6; z <= 3; z += 1.9)
      kit.box(0.14, 0.7, 0.14, hull, ship, side * 1.55, SHIP.deckY + 0.4, z);
    for (const z of [-2, 0.4]) {
      kit.mesh(
        new CylinderGeometry(0.2, 0.26, 0.9, 10),
        kit.lit(0x22262e, 0.4),
        ship,
        side * 1.0,
        SHIP.deckY + 0.3,
        z,
      ).rotation.z = Math.PI / 2;
    }
  }
  // The sails: each hangs from a mast across the ship, with a rope-ringed hole where the middle line
  // of the course meets it.
  const cream = kit.lit(0xf3e7c6, 0.8);
  const canvas = new MeshStandardMaterial({ color: 0xf3e7c6, roughness: 0.85, side: DoubleSide });
  kit.materials.push(canvas);
  const sails = SHIP.sails.map((sail) => {
    const lz = (SHIP.d - sail.d) * Math.cos(SHIP.yaw);
    const lx = -(SHIP.d - sail.d) * Math.sin(SHIP.yaw);
    const g = new Group();
    g.position.set(0, 0, lz);
    ship.add(g);
    const shape = new Shape();
    shape.moveTo(-sail.halfWidth, -sail.halfHeight);
    shape.lineTo(sail.halfWidth, -sail.halfHeight);
    shape.lineTo(sail.halfWidth, sail.halfHeight);
    shape.lineTo(-sail.halfWidth, sail.halfHeight);
    shape.lineTo(-sail.halfWidth, -sail.halfHeight);
    const hole = new Path();
    hole.absarc(lx, 0, SHIP.holeRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new ShapeGeometry(shape, 24);
    const cloth = kit.mesh(geometry, canvas, g, 0, sail.y, 0);
    const mastTop = sail.y + sail.halfHeight + 0.8;
    kit.mesh(
      new CylinderGeometry(0.14, 0.2, mastTop - 0.3, 8),
      kit.lit(0x5a3a22, 0.8),
      g,
      0,
      (mastTop + 0.3) / 2,
      -0.15,
    );
    kit.box(
      sail.halfWidth * 2 + 0.6,
      0.12,
      0.12,
      kit.lit(0x5a3a22, 0.8),
      g,
      0,
      sail.y + sail.halfHeight,
      0,
    );
    kit.box(
      sail.halfWidth * 2 + 0.6,
      0.12,
      0.12,
      kit.lit(0x5a3a22, 0.8),
      g,
      0,
      sail.y - sail.halfHeight,
      0,
    );
    kit.mesh(
      new TorusGeometry(SHIP.holeRadius, 0.07, 6, 28),
      kit.lit(0x8a6a3a, 0.8),
      g,
      lx,
      sail.y,
      0.02,
    );
    // A red band across the sail.
    kit.box(
      sail.halfWidth * 2,
      0.5,
      0.03,
      kit.lit(0xe8403a, 0.7),
      g,
      0,
      sail.y - sail.halfHeight * 0.55,
      0.03,
    );
    return { g, cloth, baseZ: lz, mastTop };
  });
  // The flag on the taller mast.
  const flagMast = sails[1];
  const flag = kit.box(
    1.5,
    1.0,
    0.05,
    kit.lit(0x16161c, 0.6),
    flagMast.g,
    0.8,
    flagMast.mastTop + 0.4,
    -0.15,
  );
  kit.mesh(new CircleGeometry(0.22, 12), kit.basic(0xffffff), flag, 0, 0.06, 0.03);
  // The crew on deck: they cheer when the ski makes it through.
  const crew = [
    makePirate(kit, ship, -0.6, SHIP.deckY + 0.05, -5.0),
    makePirate(kit, ship, 0.7, SHIP.deckY + 0.05, 1.0),
    makePirate(kit, ship, -0.4, SHIP.deckY + 0.05, 5.4),
  ];
  const poseCrew = (cheer: number, time: number) => {
    crew.forEach((p, i) => {
      p.root.position.y = SHIP.deckY + 0.05 + 0.5 * cheer * Math.abs(Math.sin(time * 9 + i * 1.7));
      p.arms.forEach((arm, k) => {
        arm.rotation.z =
          (k === 0 ? 1 : -1) * (0.3 + 2.4 * cheer + 0.4 * cheer * Math.sin(time * 14 + i));
      });
    });
  };
  // The bundle of sail and rope that wraps the tangled rider.
  const bundle = new Group();
  bundle.visible = false;
  group.add(bundle);
  kit.mesh(new SphereGeometry(0.62, 12, 10), cream, bundle, 0, 0.1, 0).scale.set(1, 1.15, 0.9);
  for (const y of [-0.15, 0.25, 0.55]) {
    kit.mesh(
      new TorusGeometry(0.55, 0.05, 6, 16),
      kit.lit(0x8a6a3a, 0.8),
      bundle,
      0,
      y,
      0,
    ).rotation.x = Math.PI / 2;
  }
  const placeBundle = (outcome: 'clear' | 'fail', t: number) => {
    if (outcome !== 'fail' || t < TANGLE.hitAt) {
      bundle.visible = false;
      return;
    }
    const f = frameOf(2, 'fail', t);
    bundle.visible = true;
    bundle.position.set(f.rider.s, f.rider.y + 0.1, -f.rider.d);
    bundle.rotation.set(0, 0, 0);
  };
  const poseSails = (outcome: 'clear' | 'fail', t: number) => {
    // The first sail billows out where the ski hits it and settles.
    const hit =
      outcome === 'fail'
        ? prog(t, TANGLE.hitAt, TANGLE.hitAt + 0.2, 'o') *
          (1 - prog(t, TANGLE.dropAt - 0.2, TANGLE.dropAt + 0.4))
        : 0;
    sails[0].g.position.z = sails[0].baseZ - 0.9 * hit;
    sails[0].g.rotation.x = -0.12 * hit;
  };
  const idle = (time: number) => {
    sails.forEach((s, i) => (s.cloth.rotation.y = 0.03 * Math.sin(time * 1.2 + i)));
    flag.rotation.y = 0.2 * Math.sin(time * 3);
  };
  return {
    group,
    update(outcome, t) {
      poseSails(outcome, t);
      placeBundle(outcome, t);
      const finale = outcome === 'clear' && t > 1.083 + 2.6 * 0.55 ? 1 : 0;
      poseCrew(finale, t);
      idle(t);
    },
    ambient: idle,
    reset() {
      poseSails('clear', 0);
      bundle.visible = false;
      poseCrew(0, 0);
    },
  };
}

export function buildJawsSomeJumpProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildShark(kit), buildWave(kit), buildShip(kit)];
}
