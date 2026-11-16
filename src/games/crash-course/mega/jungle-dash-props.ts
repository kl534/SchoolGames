/**
 * The props of Jungle Dash: a log kicker, a big tree with a vine over a mud pit and a cheeky
 * monkey; a river with three friendly crocodiles; a log ramp, a roaring T. rex and a jungle
 * temple. Deep greens with warm accents (red and yellow flowers, orange parrot). Everything is
 * built once and only moved; in all three the leaves sway and a butterfly or parrot flits about.
 */
import {
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  DoubleSide,
  MeshStandardMaterial,
  type Object3D,
} from 'three';
import { ribbon, ribbonMaterial, type Kit } from '../kit';
import { DEFAULT_STYLE } from '../rider';
import { bump } from './anim';
import {
  CROC_LEN,
  CROC_TOP,
  CROC_X,
  crocDip,
  crocJaw,
  crocX,
  JUNGLE_DASH,
  LOG_KICK,
  logKickerSurface,
  logRamp,
  monkeyAt,
  MONKEY_REST,
  MUD_FROM,
  MUD_TO,
  MUD_Y,
  REX,
  REX_ARMS,
  REX_HEAD,
  rexHead,
  RIVER_FROM,
  RIVER_TO,
  RIVER_Y,
  stolenHelmetAt,
  VINE_LEN,
  VINE_PIVOT,
  vineAngle,
} from './jungle-dash';
import type { MegaBuilt } from './triple-loop-props';

const MUD_CLEAR = JUNGLE_DASH.elements[0];
const CHOMP_AT = JUNGLE_DASH.elements[1].crash.beats.chomp;

const LEAF = 0x2e8b3d;
const LEAF_2 = 0x1f6f34;
const LEAF_3 = 0x4fae45;
const BARK = 0x6a4a2f;
const MUD_BROWN = 0x6b4a2b;
const SPLASH_BROWN = 0x7a5532;

/** A function of time that moves a prop. */
type Idle = (time: number) => void;

// ---------- The jungle (every element) ----------

/** A palm: a leaning trunk and a crown of drooping fronds. Returns the crown, to sway. */
function palm(kit: Kit, parent: Group, x: number, z: number, h: number, lean: number): Group {
  const tree = new Group();
  tree.position.set(x, 0, z);
  parent.add(tree);
  const trunk = kit.mesh(
    new CylinderGeometry(0.1, 0.2, h, 8),
    kit.lit(BARK, 0.9),
    tree,
    lean * h * 0.5,
    h / 2,
    0,
  );
  trunk.rotation.z = -lean;
  const crown = new Group();
  crown.position.set(lean * h, h, 0);
  tree.add(crown);
  const frond = kit.lit(LEAF, 0.7);
  const frond2 = kit.lit(LEAF_2, 0.7);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const pivot = new Group();
    pivot.rotation.y = a;
    crown.add(pivot);
    const blade = kit.mesh(
      new ConeGeometry(0.22, 1.5, 4),
      i % 2 ? frond : frond2,
      pivot,
      0.7,
      -0.2,
      0,
    );
    blade.rotation.z = -Math.PI / 2 - 0.45;
    blade.scale.z = 0.3;
  }
  kit.mesh(new SphereGeometry(0.16, 8, 6), kit.lit(0x7a5230, 0.8), crown, 0, -0.05, 0);
  return crown;
}

/** A broad-leaf tree: a trunk and a heap of leafy blobs. Returns the crown, to sway. */
function broadleaf(kit: Kit, parent: Group, x: number, z: number, h: number): Group {
  const tree = new Group();
  tree.position.set(x, 0, z);
  parent.add(tree);
  kit.mesh(new CylinderGeometry(0.16, 0.26, h * 0.7, 8), kit.lit(BARK, 0.9), tree, 0, h * 0.35, 0);
  const crown = new Group();
  crown.position.set(0, h * 0.62, 0);
  tree.add(crown);
  [
    [0, 0.3, 0, 1.0, LEAF],
    [-0.7, 0, 0.1, 0.75, LEAF_2],
    [0.7, 0.05, -0.1, 0.8, LEAF_3],
    [0.1, 0.75, 0, 0.7, LEAF_3],
  ].forEach(([cx, cy, cz, r, color]) => {
    const blob = kit.mesh(
      new SphereGeometry(r * (h / 4.5), 12, 8),
      kit.lit(color, 0.75),
      crown,
      cx * (h / 4.5),
      cy * (h / 4.5),
      cz,
    );
    blob.scale.y = 0.75;
  });
  return crown;
}

/** A fern: five long leaves fanning out from the ground. Returns the group, to sway. */
function fern(kit: Kit, parent: Group, x: number, z: number, size = 1): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  parent.add(g);
  const mat = kit.lit(LEAF_3, 0.7);
  for (let i = 0; i < 5; i++) {
    const pivot = new Group();
    pivot.rotation.z = (i - 2) * 0.42;
    g.add(pivot);
    const leaf = kit.mesh(
      new ConeGeometry(0.1 * size, 0.9 * size, 4),
      mat,
      pivot,
      0,
      0.45 * size,
      0,
    );
    leaf.scale.z = 0.3;
  }
  return g;
}

/** A flower on a stem. */
function flower(kit: Kit, parent: Group, x: number, z: number, color: number, h = 0.5): void {
  kit.mesh(new CylinderGeometry(0.02, 0.025, h, 5), kit.lit(LEAF_2, 0.8), parent, x, h / 2, z);
  kit.mesh(new SphereGeometry(0.1, 8, 6), kit.lit(color, 0.5), parent, x, h + 0.04, z);
  kit.mesh(new SphereGeometry(0.045, 6, 4), kit.lit(0xfff1a0, 0.5), parent, x, h + 0.06, z + 0.07);
}

/** A hanging vine with a leaf or two. */
function hangingVine(kit: Kit, parent: Group, x: number, y: number, len: number, z: number): Group {
  const g = new Group();
  g.position.set(x, y, z);
  parent.add(g);
  kit.mesh(new CylinderGeometry(0.03, 0.03, len, 5), kit.lit(0x3d7a35, 0.8), g, 0, -len / 2, 0);
  const leaf = kit.mesh(new SphereGeometry(0.14, 8, 6), kit.lit(LEAF, 0.7), g, 0.1, -len * 0.7, 0);
  leaf.scale.set(1, 0.5, 0.4);
  return g;
}

/** A butterfly (or a parrot, bigger and orange) that flits about a point. */
function flitter(
  kit: Kit,
  parent: Group,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  color: number,
  size = 1,
  speed = 0.6,
  phase = 0,
): Idle {
  const g = new Group();
  parent.add(g);
  const mat = new MeshStandardMaterial({ color, roughness: 0.6, side: DoubleSide });
  kit.materials.push(mat);
  const wings = [-1, 1].map((side) => {
    const w = kit.mesh(new PlaneGeometry(0.3 * size, 0.22 * size), mat, g);
    w.position.x = side * 0.15 * size;
    return { w, side };
  });
  kit.mesh(new SphereGeometry(0.05 * size, 6, 4), kit.lit(0x2a2a2a, 0.8), g);
  return (time) => {
    const a = time * speed + phase;
    g.position.set(
      cx + r * Math.sin(a) * 1.4,
      cy + 0.35 * r * Math.sin(a * 1.9 + 1),
      cz + 0.4 * Math.cos(a * 0.7),
    );
    g.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    const flap = Math.sin(time * 18 + phase) * 0.9;
    for (const { w, side } of wings) {
      w.rotation.z = side * flap;
      w.rotation.x = -0.4;
    }
  };
}

interface Scenery {
  palms?: readonly [x: number, z: number, h: number, lean: number][];
  trees?: readonly [x: number, z: number, h: number][];
  ferns?: readonly [x: number, z: number][];
  flowers?: readonly [x: number, z: number, color: number][];
  vines?: readonly [x: number, y: number, len: number][];
  /** [x, y, color, size] of the butterflies and parrots. */
  flitters?: readonly [x: number, y: number, color: number, size: number][];
}

const RED = 0xe8403a;
const YELLOW = 0xffcf3a;

/** The jungle behind and beside the lane; returns the idle motion (leaves sway, wings flap). */
function jungle(kit: Kit, parent: Group, plan: Scenery): Idle {
  const sways: { g: Object3D; phase: number; amp: number }[] = [];
  let n = 0;
  const add = (g: Object3D, amp: number) => sways.push({ g, phase: n++ * 1.3, amp });
  for (const [x, z, h, lean] of plan.palms ?? []) add(palm(kit, parent, x, z, h, lean), 0.05);
  for (const [x, z, h] of plan.trees ?? []) add(broadleaf(kit, parent, x, z, h), 0.025);
  for (const [x, z] of plan.ferns ?? []) add(fern(kit, parent, x, z, 1 + (n % 3) * 0.2), 0.07);
  (plan.flowers ?? []).forEach(([x, z, c]) => flower(kit, parent, x, z, c));
  for (const [x, y, len] of plan.vines ?? []) add(hangingVine(kit, parent, x, y, len, -2.2), 0.08);
  const flits = (plan.flitters ?? []).map(([x, y, color, size], i) =>
    flitter(
      kit,
      parent,
      x,
      y,
      -1.4 - 0.3 * i,
      size > 1 ? 1.6 : 1.1,
      color,
      size,
      0.5 + 0.2 * i,
      i * 2,
    ),
  );
  return (time) => {
    for (const s of sways) s.g.rotation.z = s.amp * Math.sin(time * 1.3 + s.phase);
    for (const f of flits) f(time);
  };
}

// ---------- Element 1: Vine Swing ----------

/** A little brown monkey with a long curly tail: the origin is its seat. */
function buildMonkey(kit: Kit): {
  group: Group;
  rig: Group;
  armL: Group;
  armR: Group;
  tail: Group;
} {
  const group = new Group();
  const rig = new Group();
  group.add(rig);
  const fur = kit.lit(0x7a4a28, 0.85);
  const tan = kit.lit(0xe3b585, 0.8);
  const dark = kit.lit(0x24160c, 0.6);
  const body = kit.mesh(new SphereGeometry(0.3, 14, 10), fur, rig, 0, 0.32, 0);
  body.scale.set(1, 1.15, 0.9);
  kit.mesh(new SphereGeometry(0.2, 12, 8), tan, rig, 0, 0.3, 0.14).scale.set(1, 1.1, 0.6);
  const head = new Group();
  head.position.set(0, 0.82, 0);
  rig.add(head);
  kit.mesh(new SphereGeometry(0.24, 14, 10), fur, head);
  kit.mesh(new SphereGeometry(0.16, 12, 8), tan, head, 0, -0.04, 0.12).scale.set(1.1, 0.9, 0.7);
  for (const s of [-1, 1]) {
    kit.mesh(new SphereGeometry(0.1, 8, 6), tan, head, s * 0.26, 0.02, 0).scale.set(0.5, 1, 1);
    kit.mesh(new SphereGeometry(0.05, 8, 6), kit.lit(0xffffff, 0.4), head, s * 0.09, 0.08, 0.2);
    kit.mesh(new SphereGeometry(0.028, 6, 4), dark, head, s * 0.09, 0.08, 0.25);
  }
  kit.mesh(new SphereGeometry(0.035, 6, 4), dark, head, 0, -0.02, 0.23);
  const arm = (side: number) => {
    const pivot = new Group();
    pivot.position.set(side * 0.3, 0.55, 0.02);
    rig.add(pivot);
    kit.mesh(new CapsuleGeometry(0.07, 0.4, 4, 8), fur, pivot, 0, -0.22, 0);
    kit.mesh(new SphereGeometry(0.09, 8, 6), tan, pivot, 0, -0.5, 0);
    return pivot;
  };
  const armL = arm(-1);
  const armR = arm(1);
  for (const s of [-1, 1]) {
    kit.mesh(new CapsuleGeometry(0.08, 0.2, 4, 8), fur, rig, s * 0.16, 0.04, 0.1).rotation.x = 1.3;
  }
  // The curly tail.
  const tail = new Group();
  tail.position.set(0, 0.1, -0.2);
  rig.add(tail);
  const curl = kit.mesh(
    new TorusGeometry(0.28, 0.05, 6, 16, Math.PI * 1.6),
    fur,
    tail,
    0.3,
    0.1,
    0,
  );
  curl.rotation.z = Math.PI * 0.7;
  group.scale.setScalar(1.3);
  return { group, rig, armL, armR, tail };
}

/** The helmet the monkey steals: a copy of the rider's, with no stickers. */
function buildHelmetCopy(kit: Kit): Group {
  const g = new Group();
  const mat = kit.lit(DEFAULT_STYLE.helmet, 0.3);
  kit.mesh(new SphereGeometry(0.26, 16, 10, 0, Math.PI * 2, 0, 1.78), mat, g);
  const peak = kit.box(0.3, 0.03, 0.12, mat, g, 0, 0.08, 0.28);
  peak.rotation.x = 0.35;
  g.visible = false;
  return g;
}

function buildVine(kit: Kit): MegaBuilt {
  const group = new Group();
  // The kicker of logs and the far bank.
  kit.mesh(
    ribbon(logKickerSurface, LOG_KICK.from, LOG_KICK.to + 0.5, 0.5, 0, 1.5, 0x8a5a33, 0x6f4526),
    ribbonMaterial(kit),
    group,
  );
  // The mud pit: a slab of mud over a dark pit, with bubbles.
  const width = MUD_TO - MUD_FROM;
  const mid = (MUD_FROM + MUD_TO) / 2;
  kit.box(width, 8, 0.2, kit.lit(0x3a2a1c, 1), group, mid, -4, -3.0);
  const slabH = MUD_Y - MUD_CLEAR.floorY;
  kit.box(width, slabH, 3.2, kit.lit(MUD_BROWN, 0.5), group, mid, MUD_Y - slabH / 2, 0);
  const mudMat = kit.lit(0x8a6238, 0.35);
  const bubbles = [9.2, 10.6, 12.1, 13.4, 14.8].map((x, i) => {
    const m = kit.mesh(
      new SphereGeometry(0.22, 10, 6),
      mudMat,
      group,
      x,
      MUD_Y,
      -0.5 + (i % 3) * 0.5,
    );
    return { m, x, phase: i * 0.43 };
  });
  // The splash when something drops in.
  const splashMat = kit.lit(SPLASH_BROWN, 0.5);
  const splash = Array.from({ length: 6 }, () =>
    kit.mesh(new SphereGeometry(0.22, 8, 6), splashMat, group),
  );
  splash.forEach((m) => (m.visible = false));
  // The big tree, its branch out to the vine and the vine itself.
  kit.mesh(new CylinderGeometry(0.4, 0.62, 5.6, 10), kit.lit(BARK, 0.9), group, 13.5, 2.8, -1.2);
  const crown = new Group();
  crown.position.set(13.5, 5.4, -1.2);
  group.add(crown);
  [
    [0, 0, 1.15, LEAF],
    [-1.0, -0.15, 0.85, LEAF_2],
    [1.0, -0.1, 0.9, LEAF_3],
  ].forEach(([x, y, r, c]) => {
    kit.mesh(new SphereGeometry(r, 12, 8), kit.lit(c, 0.75), crown, x, y, 0).scale.set(1, 0.65, 1);
  });
  // The branch: a few segments along an arch from the trunk to the vine's pivot.
  const bark = kit.lit(BARK, 0.9);
  const arch = (u: number) => ({
    x: 13.2 + (VINE_PIVOT.x - 13.2) * u,
    y: 5.0 + (VINE_PIVOT.y - 0.1 - 5.0) * u + 0.5 * Math.sin(Math.PI * u),
  });
  for (let i = 0; i < 5; i++) {
    const a = arch(i / 5);
    const b = arch((i + 1) / 5);
    const seg = kit.mesh(
      new CylinderGeometry(
        0.12 - i * 0.012,
        0.15 - i * 0.012,
        Math.hypot(b.x - a.x, b.y - a.y) + 0.05,
        6,
      ),
      bark,
      group,
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      -1.0,
    );
    seg.rotation.z = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
  }
  const pivot = new Group();
  pivot.position.set(VINE_PIVOT.x, VINE_PIVOT.y, 0);
  group.add(pivot);
  kit.mesh(
    new CylinderGeometry(0.045, 0.05, VINE_LEN, 6),
    kit.lit(0x3d7a35, 0.8),
    pivot,
    0,
    -VINE_LEN / 2,
    0,
  );
  for (const y of [-0.8, -2.0]) {
    const leaf = kit.mesh(new SphereGeometry(0.16, 8, 6), kit.lit(LEAF, 0.7), pivot, 0.12, y, 0);
    leaf.scale.set(1, 0.5, 0.4);
  }
  kit.mesh(new SphereGeometry(0.09, 8, 6), kit.lit(0x2e5a28, 0.8), pivot, 0, -VINE_LEN, 0);
  const monkey = buildMonkey(kit);
  group.add(monkey.group);
  const helmet = buildHelmetCopy(kit);
  group.add(helmet);
  const air = jungle(kit, group, {
    palms: [
      [1.5, -2.6, 5.4, 0.1],
      [6.5, -3.2, 6.0, -0.08],
      [19.5, -2.8, 5.6, 0.1],
      [23.0, -3.2, 5.0, -0.1],
    ],
    trees: [
      [4.0, -3.0, 4.6],
      [17.5, -3.2, 5.2],
    ],
    ferns: [
      [1, -1.8],
      [7.2, -1.8],
      [16.4, -1.8],
      [18.6, -1.8],
      [21.5, -1.8],
    ],
    flowers: [
      [3.0, -1.7, RED],
      [3.6, -1.9, YELLOW],
      [17.0, -1.6, YELLOW],
      [20.2, -1.8, RED],
      [22.4, -1.7, YELLOW],
    ],
    vines: [
      [5.0, 6.2, 3.4],
      [18.2, 6.2, 4.2],
    ],
    flitters: [
      [7, 4.2, 0xff9a2a, 1],
      [20, 3.4, 0xff5a3a, 1.6],
    ],
  });
  let playing = false;
  const rest = () => {
    pivot.rotation.z = 0;
    monkey.group.position.set(MONKEY_REST.x, MONKEY_REST.y, 0);
    monkey.group.rotation.z = 0;
    helmet.visible = false;
    splash.forEach((m) => (m.visible = false));
    monkey.armL.rotation.set(0, 0, 2.9);
    monkey.armR.rotation.set(0, 0, -0.2);
  };
  rest();
  const clapAt = (time: number) => {
    const c = 0.5 + 0.5 * Math.sin(time * 9);
    monkey.armL.rotation.set(0, 0, 2.9);
    monkey.armR.rotation.set(0, 0, -1.2 - 0.9 * c);
  };
  return {
    group,
    update(outcome, t) {
      playing = true;
      const a = vineAngle(outcome, t);
      pivot.rotation.z = a;
      const m = monkeyAt(outcome, t);
      monkey.group.position.set(m.x, m.y, 0);
      monkey.group.rotation.z = m.rot;
      const hanging = Math.abs(m.x - MONKEY_REST.x) + Math.abs(m.y - MONKEY_REST.y) > 0.02;
      const beats = MUD_CLEAR.crash.beats;
      if (outcome === 'clear') {
        clapAt(t);
      } else if (hanging) {
        // Holding the vine with one hand, reaching for the helmet with the other.
        monkey.armL.rotation.set(0, 0, 2.9);
        const reach = t >= beats.grab - 0.3 ? 1 : 0;
        monkey.armR.rotation.set(0, 0, reach ? -1.9 : 2.9);
        monkey.tail.rotation.z = 0.3 * Math.sin(t * 8);
      } else if (t >= 2.4 && t < beats.toss) {
        // Waving the helmet.
        monkey.armR.rotation.set(0, 0, -2.4 + 0.3 * Math.sin(t * 14));
        monkey.armL.rotation.set(0, 0, 2.9);
      } else {
        monkey.armR.rotation.set(0, 0, -0.9 - 0.4 * bump(t, beats.toss + 0.05, 0.2));
      }
      const h = stolenHelmetAt(outcome, t);
      helmet.visible = h.visible;
      helmet.position.set(h.x, h.y, 0.1);
      helmet.rotation.z = h.rot;
      // The splash of mud where the bike and rider drop in.
      const since = outcome === 'crash' ? t - beats.mud : -1;
      splash.forEach((m, i) => {
        const u = since / 0.9;
        m.visible = since >= 0 && u < 1;
        if (!m.visible) return;
        const dir = (i - 2.5) * 0.45;
        m.position.set(
          11.0 + dir * u * 2.2,
          MUD_Y + 3.0 * u * (1 - u) * (1 + (i % 2)),
          0.3 + 0.1 * i,
        );
        m.scale.setScalar(Math.max(1 - u, 0.05));
      });
    },
    ambient(time) {
      air(time);
      for (const b of bubbles) {
        const u = (time * 0.7 + b.phase) % 1;
        b.m.scale.set(1, Math.max(0.05, Math.sin(Math.PI * u)), 1);
        b.m.position.y = MUD_Y + 0.05 * Math.sin(Math.PI * u);
      }
      if (!playing) {
        pivot.rotation.z = 0.04 * Math.sin(time * 1.1);
        clapAt(time * 0.4);
      }
    },
    reset() {
      playing = false;
      rest();
    },
  };
}

// ---------- Element 2: Croc River ----------

interface Croc {
  group: Group;
  jaw: Group;
  eyes: Mesh[];
}

/** A friendly green crocodile facing -x: big eyes, a bumpy back and a hinged upper jaw. */
function buildCroc(kit: Kit): Croc {
  const group = new Group();
  const skin = kit.lit(0x4aa84a, 0.7);
  const dark = kit.lit(0x2f7f3a, 0.7);
  const belly = kit.lit(0xc9e07a, 0.7);
  const white = kit.lit(0xffffff, 0.4);
  const black = kit.lit(0x16161a, 0.5);
  const half = CROC_LEN / 2;
  // The body (top of the back at CROC_TOP) and the tail tapering to +x.
  const body = kit.mesh(new SphereGeometry(1, 16, 10), skin, group, 0.1, CROC_TOP - 0.3, 0);
  body.scale.set(1.3, 0.3, 0.6);
  const tail = kit.mesh(new ConeGeometry(0.4, 1.2, 8), skin, group, half - 0.1, CROC_TOP - 0.3, 0);
  tail.rotation.z = -Math.PI / 2;
  tail.scale.z = 0.7;
  kit
    .mesh(new SphereGeometry(1, 12, 6), belly, group, 0.1, CROC_TOP - 0.38, 0.05)
    .scale.set(1.2, 0.2, 0.6);
  for (let i = 0; i < 5; i++) {
    kit.mesh(new ConeGeometry(0.1, 0.22, 5), dark, group, -0.6 + i * 0.4, CROC_TOP + 0.02, 0);
  }
  // The head: a fixed lower jaw and an upper jaw that hinges open.
  const hinge = -0.9;
  kit.box(1.1, 0.2, 0.95, skin, group, hinge - 0.5, CROC_TOP - 0.25, 0.1);
  const jaw = new Group();
  jaw.position.set(hinge, CROC_TOP - 0.18, 0);
  group.add(jaw);
  kit.box(1.2, 0.3, 0.95, skin, jaw, -0.6, 0.12, 0.1);
  for (let i = 0; i < 4; i++) {
    const tooth = kit.mesh(
      new ConeGeometry(0.05, 0.14, 4),
      white,
      jaw,
      -0.25 - i * 0.28,
      -0.04,
      0.34,
    );
    tooth.rotation.z = Math.PI;
  }
  for (let i = 0; i < 4; i++) {
    kit.mesh(
      new ConeGeometry(0.05, 0.14, 4),
      white,
      group,
      hinge - 0.2 - i * 0.28,
      CROC_TOP - 0.1,
      0.34,
    );
  }
  kit.mesh(new SphereGeometry(0.06, 6, 4), black, jaw, -1.1, 0.17, 0.2);
  const eyes: Mesh[] = [];
  for (const z of [0.34, -0.14]) {
    const eye = kit.mesh(
      new SphereGeometry(0.2, 12, 8),
      white,
      group,
      hinge - 0.1,
      CROC_TOP + 0.24,
      z,
    );
    kit.mesh(new SphereGeometry(0.1, 8, 6), black, eye, -0.06, 0, 0.14);
    eyes.push(eye);
  }
  group.position.z = -0.3;
  return { group, jaw, eyes };
}

function buildRiver(kit: Kit): MegaBuilt {
  const group = new Group();
  const width = RIVER_TO - RIVER_FROM;
  const mid = (RIVER_FROM + RIVER_TO) / 2;
  const floorY = JUNGLE_DASH.elements[1].floorY;
  kit.box(width, 8, 0.2, kit.lit(0x1d4a3a, 1), group, mid, -3.6, -3.0);
  kit.box(width, 0.3, 3.2, kit.lit(0x24402e, 1), group, mid, floorY - 0.15, 0);
  const water = kit.glass(0x2f9fa0, 0.82);
  kit.box(width, RIVER_Y - floorY, 3.2, water, group, mid, (RIVER_Y + floorY) / 2, 0);
  const sparkle = kit.basic(0xc8fff4);
  const ripples = Array.from({ length: 7 }, (_, i) => {
    const m = kit.mesh(
      new TorusGeometry(0.28, 0.02, 4, 20),
      sparkle,
      group,
      5.5 + i * 2,
      RIVER_Y + 0.01,
      0.9 - (i % 3) * 0.35,
    );
    m.rotation.x = Math.PI / 2;
    return { m, phase: i * 0.31 };
  });
  // Reedy banks.
  const reed = kit.lit(0x6f9f3a, 0.8);
  const cattail = kit.lit(0x6b3f1f, 0.8);
  [3.6, 3.9, 4.2, 18.0, 18.3, 18.6].forEach((x, i) => {
    const h = 0.9 + (i % 3) * 0.3;
    const stem = kit.mesh(
      new CylinderGeometry(0.02, 0.03, h, 5),
      reed,
      group,
      x,
      h / 2 + RIVER_Y,
      1.0 - (i % 2) * 2.0,
    );
    stem.rotation.z = (i % 2 ? 1 : -1) * 0.1;
    if (i % 2)
      kit.mesh(
        new CylinderGeometry(0.05, 0.05, 0.3, 6),
        cattail,
        group,
        x,
        h + RIVER_Y,
        1.0 - (i % 2) * 2.0,
      );
  });
  const crocs = CROC_X.map(() => {
    const c = buildCroc(kit);
    group.add(c.group);
    return c;
  });
  const air = jungle(kit, group, {
    palms: [
      [2.0, -2.6, 5.6, 0.1],
      [8.5, -3.4, 6.0, -0.1],
      [14.5, -3.2, 5.0, 0.08],
      [20.0, -2.8, 5.8, -0.1],
    ],
    trees: [
      [5.0, -3.2, 4.4],
      [11.5, -3.4, 5.4],
      [17.0, -3.0, 4.6],
    ],
    ferns: [
      [1.0, -1.8],
      [3.0, -2.0],
      [19.0, -1.9],
      [21.0, -1.8],
    ],
    flowers: [
      [2.4, -1.7, RED],
      [2.9, -1.8, YELLOW],
      [19.6, -1.7, RED],
      [20.4, -1.9, YELLOW],
    ],
    vines: [
      [7.0, 6.2, 3.8],
      [15.5, 6.2, 3.2],
    ],
    flitters: [
      [10, 3.6, 0xff5a8a, 1],
      [17, 4.2, 0x3a9aff, 1],
    ],
  });
  const place = (outcome: 'clear' | 'crash', t: number) => {
    crocs.forEach((c, i) => {
      c.group.position.x = crocX(outcome, i, t);
      c.group.position.y = -crocDip(outcome, i, t);
      c.jaw.rotation.z = -crocJaw(outcome, i, t);
    });
  };
  place('clear', 0);
  let playing = false;
  return {
    group,
    update(outcome, t) {
      playing = true;
      place(outcome, t);
      // Eyes goggle at the chomp.
      crocs.forEach((c, i) => {
        const wide = outcome === 'crash' && i === 1 && t >= CHOMP_AT ? 1.25 : 1;
        c.eyes.forEach((e) => e.scale.setScalar(wide));
      });
    },
    ambient(time) {
      air(time);
      for (const r of ripples) {
        const u = (time * 0.4 + r.phase) % 1;
        r.m.scale.setScalar(0.4 + u);
        r.m.visible = u < 0.9;
      }
      if (!playing) {
        crocs.forEach((c, i) => {
          c.group.position.y = 0.04 * Math.sin(time * 1.6 + i * 2);
          c.eyes.forEach((e) =>
            e.scale.setScalar(1 - 0.9 * Math.max(0, Math.sin(time * 0.9 + i) - 0.97) * 30),
          );
        });
      }
    },
    reset() {
      playing = false;
      place('clear', 0);
      crocs.forEach((c) => c.eyes.forEach((e) => e.scale.setScalar(1)));
    },
  };
}

// ---------- Element 3: T. rex Jump ----------

function buildRex(kit: Kit): {
  group: Group;
  head: Group;
  jaw: Group;
  body: Mesh;
  tail: Group;
} {
  const group = new Group();
  group.position.z = REX.z;
  const skin = kit.lit(0x4fae5a, 0.7);
  const dark = kit.lit(0x2f7f3a, 0.7);
  const belly = kit.lit(0xcfe58a, 0.7);
  const white = kit.lit(0xffffff, 0.4);
  const black = kit.lit(0x16161a, 0.5);
  const pink = kit.lit(0xd9586a, 0.6);
  const body = kit.mesh(new SphereGeometry(1, 18, 12), skin, group, 14.7, 1.25, 0);
  body.scale.set(1.65, 1.15, 0.95);
  kit.mesh(new SphereGeometry(1, 14, 10), belly, group, 14.4, 1.0, 0.3).scale.set(1.0, 0.8, 0.7);
  // Two thick legs with feet.
  for (const [z, x] of [
    [0.55, 14.5],
    [-0.5, 15.1],
  ]) {
    kit.mesh(new CylinderGeometry(0.42, 0.5, 1.2, 10), skin, group, x, 0.6, z);
    kit.box(0.95, 0.22, 0.6, dark, group, x - 0.25, 0.11, z);
  }
  // The tail: a cone tapering from the back to 0.8 high at x = 20.
  const tail = new Group();
  tail.position.set(16.0, 1.55, 0);
  group.add(tail);
  const cone = kit.mesh(new ConeGeometry(0.62, 4.1, 10), skin, tail, 2.0, -0.25, 0);
  cone.rotation.z = -Math.PI / 2 - 0.2;
  cone.scale.z = 0.9;
  // Spikes down the back.
  for (let i = 0; i < 6; i++) {
    kit.mesh(
      new ConeGeometry(0.16, 0.34, 5),
      dark,
      group,
      13.8 + i * 0.5,
      2.36 - Math.max(0, i - 4) * 0.2,
      0,
    );
  }
  // The head, hinged at its pivot so it can turn, shake and open its mouth.
  const head = new Group();
  head.position.set(REX_HEAD.x, REX_HEAD.y, 0);
  group.add(head);
  kit.mesh(new SphereGeometry(1, 16, 10), skin, head, -0.15, 0.2, 0).scale.set(0.95, 0.5, 0.75);
  kit.box(0.95, 0.5, 0.8, skin, head, -0.9, 0.1, 0);
  kit.mesh(new SphereGeometry(0.1, 6, 4), black, head, -1.35, 0.25, 0.25);
  kit.mesh(new SphereGeometry(0.1, 6, 4), black, head, -1.35, 0.25, -0.25);
  for (let i = 0; i < 4; i++) {
    const tooth = kit.mesh(
      new ConeGeometry(0.06, 0.16, 4),
      white,
      head,
      -0.55 - i * 0.22,
      -0.2,
      0.36,
    );
    tooth.rotation.z = Math.PI;
  }
  // The eye, brow and the smile.
  const eye = kit.mesh(new SphereGeometry(0.17, 12, 8), white, head, -0.3, 0.42, 0.55);
  kit.mesh(new SphereGeometry(0.09, 8, 6), black, eye, -0.05, 0, 0.12);
  kit.box(0.36, 0.07, 0.1, dark, head, -0.3, 0.64, 0.5).rotation.z = -0.2;
  const smile = kit.mesh(
    new TorusGeometry(0.28, 0.035, 5, 14, Math.PI),
    black,
    head,
    -0.7,
    -0.1,
    0.41,
  );
  smile.rotation.z = Math.PI;
  const jaw = new Group();
  jaw.position.set(-0.2, -0.22, 0);
  head.add(jaw);
  kit.box(1.0, 0.2, 0.76, pink, jaw, -0.5, 0, 0);
  kit.box(1.0, 0.1, 0.8, skin, jaw, -0.5, -0.1, 0);
  for (let i = 0; i < 3; i++) {
    kit.mesh(new ConeGeometry(0.05, 0.14, 4), white, jaw, -0.35 - i * 0.22, 0.13, 0.34);
  }
  // The tiny arms, held out in front.
  for (const z of [0.4, -0.4]) {
    const arm = kit.mesh(
      new CapsuleGeometry(0.1, 0.4, 4, 8),
      skin,
      group,
      REX_ARMS.x + 0.1,
      REX_ARMS.y - 0.25,
      z,
    );
    arm.rotation.z = 0.8;
    kit.mesh(new SphereGeometry(0.1, 8, 6), dark, group, REX_ARMS.x - 0.1, REX_ARMS.y - 0.05, z);
  }
  return { group, head, jaw, body, tail };
}

function buildTemple(kit: Kit, parent: Group): void {
  const stone = kit.lit(0x9a9a86, 0.9);
  const stone2 = kit.lit(0x84846f, 0.9);
  const moss = kit.lit(0x4c8a3a, 0.9);
  const z = -2.5;
  [
    [5.4, 1.1, 2.8],
    [4.4, 1.1, 2.4],
    [3.4, 1.1, 2.0],
    [2.4, 1.0, 1.6],
  ].forEach(([w, h, d], i) => {
    const y = [0, 1.1, 2.2, 3.3][i];
    kit.box(w, h, d, i % 2 ? stone2 : stone, parent, 24.5, y + h / 2, z);
  });
  kit.box(1.0, 1.8, 0.1, kit.lit(0x1c1c22, 0.9), parent, 24.5, 0.9, z + 1.45);
  kit.box(1.3, 0.2, 0.2, stone2, parent, 24.5, 1.9, z + 1.45);
  kit.box(0.9, 0.7, 0.1, kit.lit(0x1c1c22, 0.9), parent, 24.5, 3.85, z + 0.85);
  kit.box(1.6, 0.35, 1.2, stone, parent, 24.5, 4.3, z);
  for (const [x, y, w] of [
    [22.4, 1.1, 1.4],
    [26.4, 2.2, 1.2],
    [23.6, 3.3, 0.9],
    [25.8, 0.1, 1.5],
  ]) {
    kit
      .mesh(new SphereGeometry(1, 8, 5), moss, parent, x, y, z + 1.0)
      .scale.set(w * 0.6, 0.25, 0.5);
  }
}

function buildDino(kit: Kit): MegaBuilt {
  const group = new Group();
  kit.mesh(ribbon(logRamp, 2, 8.4, 0.4, 0, 1.5, 0x8a5a33, 0x6f4526), ribbonMaterial(kit), group);
  // The log ends along the front of the ramp.
  const end = kit.lit(0xc79a62, 0.8);
  for (let x = 2.4; x < 8; x += 0.62) {
    const log = kit.mesh(
      new CylinderGeometry(0.26, 0.26, 0.05, 10),
      end,
      group,
      x,
      logRamp(x) * 0.6,
      1.52,
    );
    log.rotation.x = Math.PI / 2;
  }
  buildTemple(kit, group);
  const rex = buildRex(kit);
  group.add(rex.group);
  const air = jungle(kit, group, {
    palms: [
      [3.0, -2.6, 5.8, 0.1],
      [9.0, -3.4, 6.1, -0.08],
      [20.5, -3.0, 5.0, 0.1],
      [28.0, -3.4, 5.5, -0.1],
    ],
    trees: [
      [6.0, -3.2, 5.2],
      [18.0, -3.4, 5.6],
    ],
    ferns: [
      [1.0, -1.8],
      [10.0, -1.9],
      [17.0, -2.0],
      [27.0, -1.8],
    ],
    flowers: [
      [4.0, -1.8, RED],
      [9.6, -1.7, YELLOW],
      [18.8, -1.8, RED],
      [26.0, -1.7, YELLOW],
    ],
    vines: [
      [13.0, 6.2, 3.6],
      [21.0, 6.2, 4.4],
    ],
    flitters: [
      [12, 4.6, 0xff5a8a, 1],
      [22, 3.8, 0xff9a2a, 1.6],
    ],
  });
  const poseHead = (outcome: 'clear' | 'crash', t: number) => {
    const h = rexHead(outcome, t);
    rex.head.rotation.z = -h.turn;
    rex.head.rotation.y = h.shake;
    rex.jaw.rotation.z = h.jaw;
    rex.body.scale.y = 1.15 + 0.04 * (h.jaw / 0.7);
  };
  const rest = () => {
    rex.head.rotation.set(0, 0, 0);
    rex.jaw.rotation.z = 0;
    rex.body.scale.y = 1.15;
    rex.tail.rotation.z = 0;
  };
  rest();
  let playing = false;
  return {
    group,
    update(outcome, t) {
      playing = true;
      poseHead(outcome, t);
      rex.tail.rotation.z = 0.05 * Math.sin(t * 6);
    },
    ambient(time) {
      air(time);
      if (!playing) {
        rex.body.scale.y = 1.15 + 0.02 * Math.sin(time * 1.8);
        rex.tail.rotation.z = 0.06 * Math.sin(time * 1.2);
        rex.jaw.rotation.z = 0.04 + 0.03 * Math.sin(time * 1.8);
      }
    },
    reset() {
      playing = false;
      rest();
    },
  };
}

/** The three elements of Jungle Dash, in order. */
export function buildJungleDashProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildVine(kit), buildRiver(kit), buildDino(kit)];
}
