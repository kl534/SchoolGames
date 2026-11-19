/**
 * The props of Harbour Havoc: a ferry with ducking passengers and a lifeboat astern, a pier with a
 * railing and a stack of crab pots, and a drawbridge that rises (and, on a miss, drops). Bright
 * painted primitives; everything is built once and only moved.
 */
import {
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  SphereGeometry,
  Vector3,
  type Mesh,
  type Object3D,
} from 'three';
import { clamp01, createFrame, prog, resetFrame } from '../anim';
import type { Kit } from '../kit';
import {
  BRIDGE,
  CRASH,
  FERRY,
  HARBOUR_HAVOC,
  LEAF_REST,
  LIFEBOAT,
  PIER,
  ferryY,
  leafAngle,
  railY,
} from './harbour-havoc';
import { profile, type MegaBuilt } from './props-kit';

const probe = createFrame();

/** Where the ski is at `t` of an element's animation, for props that react to it. */
function skiAt(element: 0 | 1 | 2, outcome: 'clear' | 'fail', t: number) {
  resetFrame(probe);
  HARBOUR_HAVOC.elements[element][outcome].at(t, probe);
  return probe.ski;
}

const PEOPLE = [0xe8403a, 0x2fa4e7, 0xffd43b, 0x7be07b, 0xff8fd0, 0xff9f1c];

/** A little cartoon person: a capsule body, a round head and two arms. */
function makePerson(kit: Kit, parent: Object3D, colour: number, d: number, s: number, y: number) {
  const root = new Group();
  root.position.set(s, y, -d);
  parent.add(root);
  const arms: Mesh[] = [];
  kit.mesh(new CapsuleGeometry(0.22, 0.5, 4, 8), kit.lit(colour, 0.7), root, 0, 0.5, 0);
  kit.mesh(new SphereGeometry(0.2, 10, 8), kit.lit(0xf1b48a, 0.75), root, 0, 1.1, 0);
  for (const side of [-1, 1]) {
    const arm = kit.mesh(
      new CapsuleGeometry(0.06, 0.4, 3, 6),
      kit.lit(0xf1b48a, 0.75),
      root,
      side * 0.3,
      0.6,
      0,
    );
    arms.push(arm);
  }
  return { root, arms };
}

function buildFerry(kit: Kit): MegaBuilt {
  const group = new Group();
  // The bow ramp (red and white stripes) and the hull and deck behind it.
  profile(
    kit,
    group,
    ferryY,
    FERRY.foot,
    FERRY.lip,
    0.75,
    -1.5,
    FERRY.halfWidth,
    0xe8403a,
    0xffffff,
  );
  profile(kit, group, ferryY, FERRY.lip, FERRY.end, 1.0, -1.5, FERRY.halfWidth, 0x1e5fb3, 0x2a6bc4);
  const grey = kit.lit(0xd6dbe4, 0.7);
  kit.box(
    FERRY.halfWidth * 2 - 0.2,
    0.08,
    FERRY.end - FERRY.lip,
    grey,
    group,
    0,
    FERRY.deckY + 0.04,
    -(FERRY.lip + FERRY.end) / 2,
  );
  // Rails along both sides of the open deck.
  const white = kit.lit(0xf6f6f6, 0.5);
  for (const side of [-1, 1]) {
    kit.box(
      0.1,
      0.1,
      FERRY.cabinFrom - FERRY.lip,
      white,
      group,
      side * 2.85,
      FERRY.deckY + 0.75,
      -(FERRY.lip + FERRY.cabinFrom) / 2,
    );
    for (let d = FERRY.lip + 0.5; d < FERRY.cabinFrom; d += 2) {
      kit.box(0.08, 0.7, 0.08, white, group, side * 2.85, FERRY.deckY + 0.4, -d);
    }
  }
  // The cabin at the stern with a strip of windows, a red roof and two funnels.
  const cabinLen = FERRY.end - FERRY.cabinFrom;
  const cabinH = FERRY.cabinTop - FERRY.deckY;
  const cz = -(FERRY.cabinFrom + FERRY.end) / 2;
  kit.box(
    FERRY.halfWidth * 2 - 0.5,
    cabinH,
    cabinLen,
    white,
    group,
    0,
    FERRY.deckY + cabinH / 2,
    cz,
  );
  const glass = kit.lit(0x1a2f55, 0.3);
  for (const side of [-1, 1]) {
    kit.box(
      0.05,
      0.6,
      cabinLen - 0.7,
      glass,
      group,
      side * (FERRY.halfWidth - 0.24),
      FERRY.deckY + 0.95,
      cz,
    );
  }
  kit.box(
    FERRY.halfWidth * 2 - 0.3,
    0.16,
    cabinLen + 0.2,
    kit.lit(0xe8403a, 0.6),
    group,
    0,
    FERRY.cabinTop + 0.08,
    cz,
  );
  const red = kit.lit(0xe8403a, 0.6);
  const black = kit.lit(0x22262e, 0.6);
  for (const side of [-1, 1]) {
    const h = FERRY.funnelTop - FERRY.cabinTop;
    kit.mesh(
      new CylinderGeometry(0.55, 0.65, h, 14),
      red,
      group,
      side * FERRY.funnelS,
      FERRY.cabinTop + h / 2,
      -FERRY.funnelD,
    );
    kit.mesh(
      new CylinderGeometry(0.58, 0.58, 0.35, 14),
      black,
      group,
      side * FERRY.funnelS,
      FERRY.funnelTop - 0.1,
      -FERRY.funnelD,
    );
  }
  // The passengers on the open deck, who duck as the ski goes over.
  const people = FERRY.passengers.map(([d, s], i) => ({
    d,
    ...makePerson(kit, group, PEOPLE[i % PEOPLE.length], d, s, FERRY.deckY + 0.05),
  }));
  const pose = (duck: (d: number) => number, time: number) => {
    for (const p of people) {
      const k = duck(p.d);
      p.root.scale.y = 1 - 0.5 * k;
      p.root.position.y = FERRY.deckY + 0.05 - 0.12 * k;
      p.arms.forEach((arm, i) => {
        // Waving when watching, hands over the head when ducking.
        const wave = Math.sin(time * 5 + p.d + i * 2) * 0.4;
        arm.rotation.z = (i === 0 ? 1 : -1) * (0.3 + 1.7 * (1 - k) * 0.5 + wave * (1 - k));
      });
    }
  };
  // The lifeboat astern: an open orange boat that bobs.
  const boat = new Group();
  boat.position.set(0, 0, -FERRY.boatD);
  group.add(boat);
  const orange = kit.lit(0xff7a1a, 0.55);
  kit.box(1.9, 0.14, 3.8, orange, boat, 0, 0.05, 0);
  for (const side of [-1, 1]) {
    kit.box(0.14, 0.62, 3.8, orange, boat, side * 0.95, 0.3, 0);
    kit.box(0.16, 0.14, 3.8, white, boat, side * 0.95, 0.62, 0);
  }
  for (const end of [-1, 1]) {
    kit.box(1.9, 0.62, 0.14, orange, boat, 0, 0.3, end * 1.9);
    kit.box(1.9, 0.14, 0.16, white, boat, 0, 0.62, end * 1.9);
  }
  kit.box(1.5, 0.08, 0.3, kit.lit(0xc99a5b, 0.7), boat, 0, 0.32, 0.9);
  const poseBoat = (outcome: 'clear' | 'fail', t: number, time: number) => {
    let dip = 0;
    let roll = 0;
    if (outcome === 'fail') {
      const hit = Math.max(0, 1 - Math.abs(t - LIFEBOAT.landAt - 0.1) / 0.3);
      dip = -0.28 * hit * (t >= LIFEBOAT.landAt ? 1 : 0);
      const tip = prog(t, LIFEBOAT.tipAt - 0.1, LIFEBOAT.tipAt + 0.35, 'o');
      roll = -0.75 * tip * (1 - prog(t, LIFEBOAT.tipAt + 0.5, LIFEBOAT.tipAt + 1.3));
      if (t >= LIFEBOAT.landAt && t < LIFEBOAT.tipAt) {
        const r = t - LIFEBOAT.landAt;
        roll = 0.28 * Math.sin(r * 5) * Math.exp(-r * 0.8) * 0.6;
      }
    }
    boat.position.y = dip + 0.06 * Math.sin(time * 1.8);
    boat.rotation.z = roll + 0.03 * Math.sin(time * 1.5);
  };
  return {
    group,
    update(outcome, t) {
      const ski = skiAt(0, outcome, t);
      pose((d) => (ski.y > 2.8 ? clamp01(1 - Math.abs(d - ski.d) / 5) : 0), t);
      poseBoat(outcome, t, t);
    },
    ambient(time) {
      pose(() => 0, time);
      poseBoat('clear', 0, time);
    },
    reset() {
      pose(() => 0, 0);
      poseBoat('clear', 0, 0);
    },
  };
}

// The crab pots: where each starts on the pier, and how it is flung when the ski ploughs in.
const POTS: { d: number; s: number; y: number; v: [number, number, number] }[] = [
  { d: PIER.crab.d - 0.8, s: PIER.crab.s - 0.6, y: PIER.deckY, v: [3.5, 4.2, 4.5] },
  { d: PIER.crab.d + 0.8, s: PIER.crab.s - 0.6, y: PIER.deckY, v: [5.5, 5.2, 3.5] },
  { d: PIER.crab.d - 0.8, s: PIER.crab.s + 0.6, y: PIER.deckY, v: [2.5, 6.2, 5.2] },
  { d: PIER.crab.d + 0.8, s: PIER.crab.s + 0.6, y: PIER.deckY, v: [6.5, 5.8, 4.2] },
  { d: PIER.crab.d, s: PIER.crab.s, y: PIER.deckY + 0.85, v: [4.5, 4.6, 7.0] },
];
const POT_H = 0.85;

function buildPier(kit: Kit): MegaBuilt {
  const group = new Group();
  const wood = kit.lit(0xc99a5b, 0.8);
  const plank = kit.lit(0xb08040, 0.8);
  const pile = kit.lit(0x6d5236, 0.85);
  const [s0, s1] = PIER.deckS;
  const len = PIER.deckTo - PIER.deckFrom;
  const mid = -(PIER.deckFrom + PIER.deckTo) / 2;
  kit.box(s1 - s0, 0.25, len, wood, group, (s0 + s1) / 2, PIER.deckY - 0.125, mid);
  for (let d = PIER.deckFrom + 1; d < PIER.deckTo; d += 2) {
    kit.box(s1 - s0, 0.03, 0.12, plank, group, (s0 + s1) / 2, PIER.deckY + 0.01, -d);
  }
  for (let d = PIER.deckFrom + 0.5; d <= PIER.deckTo; d += 5) {
    for (const s of [s0 + 0.4, s1 - 0.4]) {
      kit.mesh(new CylinderGeometry(0.18, 0.18, 2.6, 8), pile, group, s, PIER.deckY - 1.4, -d);
    }
  }
  // The railing: a ramp of hazard stripes up to a long steel rail on posts, along the deck's edge.
  profile(
    kit,
    group,
    railY,
    PIER.rampFoot,
    PIER.railFrom,
    0.5,
    (d) => railY(d) - 0.5,
    0.9,
    0xffd43b,
    0x2b2b35,
  );
  profile(
    kit,
    group,
    railY,
    PIER.railFrom,
    PIER.railTo,
    1.5,
    (d) => railY(d) - 0.3,
    0.3,
    0xe6ecf5,
    0xaab4c4,
  );
  const steel = kit.lit(0x8791a8, 0.4);
  for (let d = PIER.railFrom + 1; d <= PIER.railTo; d += 3) {
    kit.mesh(
      new CylinderGeometry(0.07, 0.07, PIER.railY - PIER.deckY, 8),
      steel,
      group,
      0.3,
      (PIER.railY + PIER.deckY) / 2 - 0.15,
      -d,
    );
  }
  // Lamp posts along the far edge.
  const lamp = kit.basic(0xfff2a8);
  for (const d of [8, 16, 24, 32]) {
    kit.mesh(
      new CylinderGeometry(0.07, 0.09, 3.2, 8),
      steel,
      group,
      s1 - 0.2,
      PIER.deckY + 1.6,
      -d,
    );
    kit.mesh(new SphereGeometry(0.28, 10, 8), lamp, group, s1 - 0.2, PIER.deckY + 3.3, -d);
  }
  // The crab pots: stacked cages with a buoy on top.
  const cage = kit.lit(0x2f9d6a, 0.7);
  const rope = kit.lit(0x1d6a47, 0.7);
  const buoy = kit.lit(0xff7a1a, 0.5);
  const pots = POTS.map((_p, i) => {
    const pot = new Group();
    group.add(pot);
    kit.box(1.4, POT_H, 1.1, cage, pot, 0, POT_H / 2, 0);
    for (const x of [-0.7, 0.7]) kit.box(0.08, POT_H + 0.04, 1.14, rope, pot, x, POT_H / 2, 0);
    kit.box(1.44, 0.08, 0.1, rope, pot, 0, POT_H, 0);
    if (i === POTS.length - 1)
      kit.mesh(new SphereGeometry(0.28, 10, 8), buoy, pot, 0, POT_H + 0.25, 0);
    return pot;
  });
  const placePots = (t: number | null) => {
    pots.forEach((pot, i) => {
      const p = POTS[i];
      if (t === null || t < CRASH.hitAt) {
        pot.position.set(p.s, p.y, -p.d);
        pot.rotation.set(0, 0, 0);
        return;
      }
      const tau = t - CRASH.hitAt;
      const y = Math.max(p.y + p.v[2] * tau - 7 * tau * tau, 0.05);
      const afloat = y <= 0.06;
      pot.position.set(
        p.s + p.v[1] * tau * (afloat ? 0.3 : 1),
        y,
        -(p.d + p.v[0] * tau * (afloat ? 0.3 : 1)),
      );
      pot.rotation.set(
        tau * (i % 2 ? 4 : -3) * (afloat ? 0.2 : 1),
        0,
        tau * (i % 2 ? -5 : 4) * (afloat ? 0.2 : 1),
      );
    });
  };
  return {
    group,
    update(outcome, t) {
      placePots(outcome === 'fail' ? t : null);
    },
    ambient() {},
    reset: () => placePots(null),
  };
}

function buildBridge(kit: Kit): MegaBuilt {
  const group = new Group();
  const L = BRIDGE.lip - BRIDGE.hinge;
  const leaf = new Group();
  leaf.position.set(0, 0, -BRIDGE.hinge);
  group.add(leaf);
  const asphalt = kit.lit(0x3a3f4b, 0.85);
  const yellow = kit.lit(0xffd43b, 0.6);
  const white = kit.lit(0xf6f6f6, 0.6);
  kit.box(BRIDGE.halfWidth * 2 - 0.4, 0.4, L, asphalt, leaf, 0, -0.2, -L / 2);
  for (let d = 0.6; d < L; d += 1.6) kit.box(0.18, 0.03, 0.9, yellow, leaf, 0, 0.015, -d);
  for (const side of [-1, 1]) {
    kit.box(0.3, 0.45, L, white, leaf, side * (BRIDGE.halfWidth - 0.35), 0.1, -L / 2);
    kit.box(
      0.3,
      0.45,
      0.3,
      kit.lit(0xe8403a, 0.6),
      leaf,
      side * (BRIDGE.halfWidth - 0.35),
      0.4,
      -L + 0.2,
    );
  }
  // Two stone towers by the hinge, with warning lamps and the lifting cables.
  const stone = kit.lit(0x9aa4b6, 0.8);
  const cap = kit.lit(0x5b6478, 0.8);
  const steel = kit.lit(0x4a5266, 0.5);
  const towerTop = 9;
  const lamps: Mesh[] = [];
  const lampOn = kit.basic(0xff3b3b);
  const cables: Mesh[] = [];
  for (const side of [-1, 1]) {
    const x = side * (BRIDGE.halfWidth + 1.0);
    kit.box(1.3, towerTop, 1.3, stone, group, x, towerTop / 2 - 0.4, -(BRIDGE.hinge - 1));
    kit.box(1.7, 0.5, 1.7, cap, group, x, towerTop - 0.15, -(BRIDGE.hinge - 1));
    lamps.push(
      kit.mesh(
        new SphereGeometry(0.3, 10, 8),
        lampOn,
        group,
        x,
        towerTop + 0.4,
        -(BRIDGE.hinge - 1),
      ),
    );
    cables.push(
      kit.mesh(
        new CylinderGeometry(0.06, 0.06, 1, 6),
        steel,
        group,
        x,
        towerTop / 2,
        -(BRIDGE.hinge - 1),
      ),
    );
  }
  const up = new Vector3(0, 1, 0);
  const from = new Vector3();
  const to = new Vector3();
  const dir = new Vector3();
  const pose = (angle: number) => {
    leaf.rotation.x = angle;
    // Each cable runs from the top of its tower to the free end of the leaf.
    const endY = L * Math.sin(angle);
    const endZ = -BRIDGE.hinge - L * Math.cos(angle);
    cables.forEach((cable, i) => {
      const side = i === 0 ? -1 : 1;
      from.set(side * (BRIDGE.halfWidth + 1.0), towerTop, -(BRIDGE.hinge - 1));
      to.set(side * (BRIDGE.halfWidth - 0.4), endY + 0.3, endZ);
      dir.subVectors(to, from);
      const length = dir.length();
      cable.position.copy(from).addScaledVector(dir, 0.5);
      cable.scale.set(1, length, 1);
      cable.quaternion.setFromUnitVectors(up, dir.normalize());
    });
  };
  const blink = (time: number) => {
    const on = Math.floor(time * 2) % 2 === 0;
    lamps.forEach((lamp, i) => lamp.scale.setScalar(on === (i === 0) ? 1.25 : 0.7));
  };
  return {
    group,
    update(outcome, t) {
      pose(leafAngle[outcome](t));
      blink(t);
    },
    ambient: blink,
    reset: () => pose(LEAF_REST),
  };
}

export function buildHarbourHavocProps(kit: Kit): [MegaBuilt, MegaBuilt, MegaBuilt] {
  return [buildFerry(kit), buildPier(kit), buildBridge(kit)];
}
