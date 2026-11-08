/**
 * Mega course 2, Harbour City's Harbour Havoc: leap a ferry's deck while the passengers duck,
 * grind the pier railing, then launch off the rising drawbridge through the fireworks. Pure
 * animation data like `whale-of-a-time.ts`: element-local coordinates, `d` = 0 at the element's
 * entry line, `y` up from the water, `s` sideways (+ is the rider's right).
 */
import {
  TAU,
  arc,
  lerp,
  prog,
  seatAtTime,
  setFree,
  track,
  trail,
  type Def,
  type Frame,
} from '../anim';
import { ENTRY_SPEED } from '../rules';
import { flipEase, slopeAt } from './anim';
import type { MegaSpec } from './mega';

const SPEED = ENTRY_SPEED;
const FLOAT_Y = -0.3;
const FLAT_Y = -0.05;
const PI = Math.PI;

// ---------- Element 1: the ferry ----------

/** The ferry lies along the course: a bow ramp up to an open deck, then a cabin and two funnels. */
export const FERRY = {
  foot: 6,
  lip: 12,
  deckY: 2.6,
  end: 26,
  halfWidth: 3,
  cabinFrom: 22,
  cabinTop: 4.2,
  funnelS: 2.4,
  funnelD: 24,
  funnelTop: 6.4,
  /** Passengers on the open deck: [d, s]. None is on the middle line. */
  passengers: [
    [13.6, -1.5],
    [15.4, 1.6],
    [17.2, -1.7],
    [19.0, 1.5],
    [20.6, -1.4],
  ] as readonly (readonly [number, number])[],
  passengerHeight: 1.5,
  /** The lifeboat floating beyond the stern. */
  boatD: 31,
};

/** Height of the ferry's bow ramp and deck on the middle line at `d`. */
export function ferryY(d: number): number {
  const { foot, lip, deckY, end } = FERRY;
  if (d <= foot) return 0;
  if (d <= lip) return deckY * ((d - foot) / (lip - foot)) ** 1.5;
  return d <= end ? deckY : 0;
}

const T_LIP1 = FERRY.lip / SPEED;
const LENGTH1 = 40;

const ferryRide = (t: number, f: Frame) => {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = ferryY(k.d);
  k.pitch = Math.atan(slopeAt(ferryY, Math.min(k.d, FERRY.lip - 0.02)));
  k.wet = k.d < FERRY.foot;
};
const ferryLipPitch = Math.atan(slopeAt(ferryY, FERRY.lip - 0.02));

const ferryClear: Def = (() => {
  const air = 2.0;
  const land = 36;
  const tLand = T_LIP1 + air;
  const peak = 6.0;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP1) {
      ferryRide(t, f);
      f.rider.pose = 'ride';
    } else if (t < tLand) {
      const u = (t - T_LIP1) / air;
      k.d = lerp(FERRY.lip, land, u);
      k.y = arc(FERRY.deckY, 0, peak, u);
      k.pitch = ferryLipPitch * (1 - prog(u, 0, 0.4)) + 0.25 * Math.sin(TAU * u);
      k.wet = false;
      f.rider.pose = 'fistPump';
    } else {
      k.d = Math.min(land + SPEED * (t - tLand), LENGTH1);
      k.y = 0;
      f.rider.pose = 'ride';
    }
  };
  const mid = T_LIP1 + air / 2;
  return {
    duration: tLand + (LENGTH1 - land) / SPEED,
    length: LENGTH1,
    word: 'FERRY LEAP!',
    at,
    events: () => [
      [T_LIP1 - 0.2, 'sfx:whoosh', FERRY.lip - 2, FERRY.deckY],
      [T_LIP1, 'spray', FERRY.lip, FERRY.deckY],
      [mid, 'word', lerp(FERRY.lip, land, 0.5), 7.6],
      [tLand, 'splash', land, 0],
      [tLand, 'sfx:splash', land, 0],
      [tLand + 0.2, 'cheer', land + 2, 1],
    ],
  };
})();

/** The fail: a short leap that lands in the lifeboat, which tips them both out. */
export const LIFEBOAT = { landD: FERRY.boatD, tipAt: 3.5 };

const ferryFail: Def = (() => {
  const landD = LIFEBOAT.landD;
  const air = (landD - FERRY.lip) / SPEED;
  const tLand = T_LIP1 + air;
  const seatY = 0.55;
  const tTip = LIFEBOAT.tipAt;
  const out = track([
    [tTip, 0],
    [tTip + 0.8, -2.6, 'o'],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP1) {
      ferryRide(t, f);
    } else if (t < tLand) {
      const u = (t - T_LIP1) / air;
      k.d = lerp(FERRY.lip, landD, u);
      k.y = arc(FERRY.deckY, seatY, 5.2, u);
      k.pitch = ferryLipPitch * (1 - prog(u, 0, 0.4)) - 0.3 * prog(u, 0.6, 1);
      k.wet = false;
    } else if (t < tTip) {
      // In the boat, rocking.
      const r = t - tLand;
      k.d = landD + 0.4 * (1 - Math.exp(-3 * r));
      k.y = seatY;
      k.roll = 0.28 * Math.sin(r * 5) * Math.exp(-r * 0.8);
      k.pitch = -0.3 * (1 - prog(r, 0, 0.4));
      k.wet = false;
    } else {
      // The boat tips: the ski rolls over and slides into the water.
      const u = prog(t, tTip, tTip + 0.8, 'o');
      k.d = landD + 0.4 + 0.6 * u;
      k.s = out(t);
      k.y = lerp(seatY, 0, prog(t, tTip, tTip + 0.7));
      k.roll = PI * u;
      k.wet = t > tTip + 0.6;
    }
  };
  const s0 = seatAtTime(skiAt, tTip);
  const splat = tTip + 0.6;
  const riderS = 3.6;
  const riderD = landD + 1.0;
  const popEnd = splat + 0.5;
  const settle = Math.max(popEnd, tTip + 0.8) + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < tLand) return;
    if (t < tTip) {
      f.rider.face = 'dizzy';
      f.rider.pose = t < tLand + 0.9 ? 'dizzy' : 'stand';
      return;
    }
    if (t < splat) {
      const u = (t - tTip) / 0.6;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, s0.y + 0.9, u),
        lerp(s0.s, riderS, u),
        0,
        lerp(0, 0.6, u),
        0,
        'flail',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), riderS, 0, 0.6, 0, 'float', 'soaked');
  };
  return {
    duration: settle + 1.0,
    word: 'LIFEBOAT!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: () => [
      [T_LIP1 - 0.2, 'sfx:whoosh', FERRY.lip - 2, FERRY.deckY],
      [T_LIP1, 'spray', FERRY.lip, FERRY.deckY],
      [tLand, 'sfx:bump', landD, 1],
      [tLand, 'splash', landD, 0.2],
      [tLand + 0.1, 'stars', landD, 2.4],
      [tTip - 0.3, 'sfx:slideWhistle', landD, 1.6],
      [splat, 'bigSplash', riderD, 0.2, riderS],
      [splat, 'sfx:splat', riderD, 0, riderS],
      [splat, 'sfx:splash', riderD, 0, riderS],
      [splat, 'groan', riderD, 1, riderS],
      [splat + 0.1, 'word', riderD, 3.2, riderS],
      [popEnd, 'drips', riderD, 0.6, riderS],
    ],
  };
})();

// ---------- Element 2: the pier railing ----------

/** The pier: a deck to the ski's right with a railing along its left edge, and a stack of crab pots. */
export const PIER = {
  rampFoot: 5,
  railFrom: 9,
  railTo: 30,
  railY: 1.6,
  deckY: 1.1,
  deckFrom: 3,
  deckTo: 33,
  deckS: [0.6, 7.5] as const,
  crab: { d: 22.5, s: 3.0 },
};

/** Height of the railing's top (and the ramp up to it) on the middle line at `d`. */
export function railY(d: number): number {
  if (d <= PIER.rampFoot) return 0;
  if (d <= PIER.railFrom)
    return PIER.railY * ((d - PIER.rampFoot) / (PIER.railFrom - PIER.rampFoot)) ** 1.5;
  return d <= PIER.railTo ? PIER.railY : 0;
}

const T_RAIL0 = PIER.railFrom / SPEED;
const T_RAIL1 = PIER.railTo / SPEED;
const LENGTH2 = 40;
const RAMP_PITCH = Math.atan(slopeAt(railY, PIER.railFrom - 0.02));

const pierRide = (t: number, f: Frame, wobble: (u: number) => number) => {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = railY(k.d);
  k.wet = k.d < PIER.rampFoot;
  if (t < T_RAIL0) {
    k.pitch = Math.atan(slopeAt(railY, Math.min(k.d, PIER.railFrom - 0.02)));
    return;
  }
  const u = (t - T_RAIL0) / (T_RAIL1 - T_RAIL0);
  k.pitch = RAMP_PITCH * (1 - prog(t, T_RAIL0, T_RAIL0 + 0.2));
  k.roll = wobble(u);
};

const pierClear: Def = (() => {
  const air = 0.55;
  const land = 36.5;
  const tLand = T_RAIL1 + air;
  const wobble = (u: number) => 0.12 * Math.sin(PI * u) * Math.sin(TAU * 2.2 * u);
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_RAIL1) {
      pierRide(t, f, wobble);
      f.rider.pose = t < T_RAIL0 ? 'ride' : 'armsUp';
    } else if (t < tLand) {
      const u = (t - T_RAIL1) / air;
      k.d = lerp(PIER.railTo, land, u);
      k.y = arc(PIER.railY, 0, 2.9, u);
      k.pitch = 0.25 * Math.sin(TAU * u);
      k.wet = false;
      f.rider.pose = 'fistPump';
    } else {
      k.d = Math.min(land + SPEED * (t - tLand), LENGTH2);
      k.y = 0;
      f.rider.pose = 'ride';
    }
  };
  const mid = (T_RAIL0 + T_RAIL1) / 2;
  return {
    duration: tLand + (LENGTH2 - land) / SPEED,
    length: LENGTH2,
    word: 'RAIL GRIND!',
    at,
    events: (ski) => [
      [T_RAIL0 - 0.2, 'sfx:whoosh', PIER.railFrom - 2, 1],
      [T_RAIL0, 'sfx:boing', PIER.railFrom, PIER.railY],
      ...trail(T_RAIL0 + 0.1, T_RAIL1 - 0.1, 0.12, 'spray', ski, 0.1),
      [mid, 'word', ski(mid).d, 3.4],
      [tLand, 'splash', land, 0],
      [tLand, 'sfx:splash', land, 0],
      [tLand + 0.15, 'cheer', land + 2, 1],
    ],
  };
})();

/** The fail: the balance goes, the ski slips onto the deck and ploughs into the crab pots. */
export const CRASH = { slipAt: 1.58, hitAt: 2.05 };

const pierFail: Def = (() => {
  const { slipAt, hitAt } = CRASH;
  const slipD = SPEED * slipAt;
  const wobble = (u: number) => (0.1 + 0.5 * u * u) * Math.sin(PI * 0.15 + TAU * 2.2 * u);
  const wob0 = (t: number) => wobble((t - T_RAIL0) / (T_RAIL1 - T_RAIL0));
  const endAt = hitAt + 1.0;
  const crabD = PIER.crab.d;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= slipAt) {
      pierRide(t, f, (u) => (u <= 0 ? 0 : wobble(u) * prog(u, 0, 0.1)));
    } else if (t <= hitAt) {
      const u = prog(t, slipAt, hitAt, 'io');
      k.d = lerp(slipD, crabD - 0.3, prog(t, slipAt, hitAt, 'l'));
      k.s = lerp(0, PIER.crab.s - 0.4, u);
      k.y = lerp(PIER.railY, PIER.deckY, u);
      k.roll = lerp(wob0(slipAt), 0.25, u);
      k.yaw = -0.4 * u;
      k.pitch = 0;
      k.wet = false;
    } else {
      const u = prog(t, hitAt, endAt, 'o');
      k.d = lerp(crabD - 0.3, crabD + 3.6, u);
      k.s = lerp(PIER.crab.s - 0.4, 9.2, prog(t, hitAt, endAt, 'q'));
      k.y = lerp(PIER.deckY, 0, prog(t, hitAt + 0.45, endAt));
      k.roll = lerp(0.25, PI, prog(t, hitAt + 0.2, endAt));
      k.yaw = -0.4;
      k.pitch = 0;
      k.wet = t > endAt - 0.2;
    }
  };
  const s0 = seatAtTime(skiAt, hitAt);
  const flyT = 1.0;
  const splat = hitAt + flyT;
  const riderD = crabD + 5.5;
  const riderS = 10.5;
  const popEnd = splat + 0.5;
  const settle = popEnd + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < hitAt) return;
    if (t < splat) {
      const u = (t - hitAt) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, 4.4, u),
        lerp(s0.s, riderS, u),
        lerp(s0.pitch, -2 * TAU, u),
        0,
        0,
        u < 0.2 ? 'flail' : u < 0.85 ? 'tuck' : 'float',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), riderS, -2 * TAU, 0, 0, 'float', 'soaked');
    f.rider.props.fish = t > splat + 0.2;
  };
  return {
    duration: Math.max(settle, endAt) + 1.0,
    word: 'CRAB POTS!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [T_RAIL0 - 0.2, 'sfx:whoosh', PIER.railFrom - 2, 1],
      [T_RAIL0, 'sfx:boing', PIER.railFrom, PIER.railY],
      ...trail(T_RAIL0 + 0.1, slipAt - 0.1, 0.12, 'spray', ski, 0.1),
      [slipAt, 'sfx:slideWhistle', slipD, PIER.railY],
      [hitAt, 'sfx:bump', crabD, PIER.deckY + 1, PIER.crab.s],
      [hitAt, 'stars', crabD, PIER.deckY + 2, PIER.crab.s],
      ...trail(hitAt + 0.3, splat - 0.2, 0.3, 'drips', rider),
      [endAt - 0.2, 'splash', crabD + 3.6, 0.2, 9.2],
      [splat, 'bigSplash', riderD, 0.2, riderS],
      [splat, 'sfx:splat', riderD, 0, riderS],
      [splat, 'sfx:splash', riderD, 0, riderS],
      [splat, 'groan', riderD, 1, riderS],
      [splat + 0.1, 'word', riderD, 3.2, riderS],
      [popEnd, 'drips', riderD, 0.6, riderS],
    ],
  };
})();

// ---------- Element 3: the drawbridge ----------

/** The drawbridge leaf is hinged at `hinge` and its free end (the lip) rises as the ski runs in. */
export const BRIDGE = { hinge: 8, lip: 20, halfWidth: 3 };

/** The leaf's angle (radians above the water) by time into element 3, cleared or when it drops. */
export const leafAngle = {
  clear: track([
    [0, 0.28],
    [0.7, 0.44, 'o'],
  ]),
  fail: track([
    [0, 0.28],
    [0.7, 0.44, 'o'],
    [1.4, 0.44],
    [2.35, 0.03, 'i'],
  ]),
};
/** The angle of the leaf before the ski comes (props at rest). */
export const LEAF_REST = 0.28;

const T_HINGE = BRIDGE.hinge / SPEED;
const T_LIP3 = BRIDGE.lip / SPEED;
const AIR3 = 2.6;
const LAND3 = 51;
const T_LAND3 = T_LIP3 + AIR3;
const LENGTH3 = 57;
const PEAK3 = 11.4;
const DROP_AT = 1.4;

const onLeaf = (d: number, angle: number) =>
  Math.max(Math.min(d, BRIDGE.lip) - BRIDGE.hinge, 0) * Math.tan(angle);

const bridgeClear: Def = (() => {
  const lipAngle = leafAngle.clear(T_LIP3);
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP3) {
      k.d = SPEED * t;
      k.y = onLeaf(k.d, leafAngle.clear(t));
      k.pitch = t < T_HINGE ? 0 : leafAngle.clear(t) * prog(t, T_HINGE, T_HINGE + 0.15);
      k.wet = t < T_HINGE;
      f.rider.pose = 'ride';
    } else if (t < T_LAND3) {
      const u = (t - T_LIP3) / AIR3;
      k.d = lerp(BRIDGE.lip, LAND3, u);
      k.y = arc(onLeaf(BRIDGE.lip, lipAngle), 0, PEAK3, u);
      k.pitch = (1 - prog(u, 0, 0.12)) * lipAngle + 2 * TAU * flipEase((u - 0.06) / 0.84);
      k.wet = false;
      f.rider.pose = u > 0.9 ? 'armsUp' : u > 0.06 ? 'tuck' : 'fistPump';
    } else {
      k.d = Math.min(LAND3 + SPEED * (t - T_LAND3), LENGTH3);
      k.y = 0;
      k.pitch = 2 * TAU;
      f.rider.pose = 'ride';
    }
  };
  const mid = T_LIP3 + AIR3 / 2;
  const fw = (a: number, d: number, y: number, s: number) =>
    [mid + a, 'fireworks', d, y, s] as const;
  return {
    duration: T_LAND3 + (LENGTH3 - LAND3) / SPEED,
    length: LENGTH3,
    word: 'BRIDGE BLAST!',
    slow: [mid],
    at,
    events: () => [
      [T_HINGE - 0.3, 'sfx:whoosh', BRIDGE.hinge - 3, 1],
      [T_LIP3, 'sfx:boing', BRIDGE.lip, onLeaf(BRIDGE.lip, lipAngle)],
      [T_LIP3, 'spray', BRIDGE.lip, onLeaf(BRIDGE.lip, lipAngle)],
      fw(-0.55, 30, 13.5, -3.2),
      fw(-0.05, 35.5, 14.6, 3.2),
      fw(0.45, 41, 13.4, 0),
      [mid, 'word', lerp(BRIDGE.lip, LAND3, 0.5), 13.4],
      [T_LAND3, 'bigSplash', LAND3, 0],
      [T_LAND3, 'sfx:splash', LAND3, 0],
      [T_LAND3 + 0.15, 'cheer', LAND3 + 2, 1],
      [T_LAND3 + 0.15, 'confetti', LAND3 + 3, 2],
    ],
  };
})();

/** The fail: the bridge drops under the ski, which slides down it and off the end. */
const bridgeFail: Def = (() => {
  const slide = track([
    [DROP_AT, SPEED * DROP_AT],
    [2.4, 22.6, 'o'],
  ]);
  const tOff = 2.2;
  const tFree = 2.35;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    const angle = leafAngle.fail(t);
    if (t <= DROP_AT) {
      k.d = SPEED * t;
      k.y = onLeaf(k.d, angle);
      k.pitch = t < T_HINGE ? 0 : angle * prog(t, T_HINGE, T_HINGE + 0.15);
      k.wet = t < T_HINGE;
    } else {
      k.d = slide(t);
      const off = prog(k.d, BRIDGE.lip, BRIDGE.lip + 1.6);
      k.y = onLeaf(k.d, angle) * (1 - off) + 0.0 * off;
      k.pitch = angle - 0.55 * prog(t, tOff, tOff + 0.5);
      k.roll = PI * prog(t, tFree + 0.1, tFree + 0.8, 'o');
      k.wet = t > tOff + 0.4;
    }
  };
  const s0 = seatAtTime(skiAt, tFree);
  const flyT = 0.8;
  const splat = tFree + flyT;
  const riderD = 30;
  const popEnd = splat + 0.5;
  const settle = popEnd + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < tFree) return;
    if (t < splat) {
      const u = (t - tFree) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, s0.y + 1.2, u),
        0.6 * u,
        lerp(s0.pitch, 0, u),
        0,
        0,
        u < 0.7 ? 'flail' : 'float',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), 0.6, 0, 0, 0, 'float', 'soaked');
  };
  return {
    duration: settle + 1.0,
    word: 'BRIDGE OUT!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski) => [
      [T_HINGE - 0.3, 'sfx:whoosh', BRIDGE.hinge - 3, 1],
      [DROP_AT, 'sfx:slideWhistle', ski(DROP_AT).d, ski(DROP_AT).y],
      [DROP_AT + 0.2, 'sfx:bump', BRIDGE.hinge + 6, 1],
      [tOff, 'splash', 23.5, 0.2],
      [tOff, 'sfx:splash', 23.5, 0],
      [splat, 'bigSplash', riderD, 0.2, 0.6],
      [splat, 'sfx:splat', riderD, 0, 0.6],
      [splat, 'sfx:splash', riderD, 0, 0.6],
      [splat, 'groan', riderD, 1, 0.6],
      [splat + 0.1, 'word', riderD, 3.2, 0.6],
      [popEnd, 'drips', riderD, 0.6, 0.6],
    ],
  };
})();

export const HARBOUR_HAVOC: MegaSpec = {
  id: 'harbour-havoc',
  title: 'Harbour Havoc',
  emoji: '🌉',
  elements: [
    {
      name: 'Ferry Leap',
      length: LENGTH1,
      floorY: -1.2,
      cue: { d: 8, y: 1.0 },
      clear: ferryClear,
      fail: ferryFail,
    },
    {
      name: 'Pier Grind',
      length: LENGTH2,
      floorY: -1.2,
      cue: { d: 6, y: 0.6 },
      clear: pierClear,
      fail: pierFail,
    },
    {
      name: 'Drawbridge',
      length: LENGTH3,
      floorY: -1.2,
      cue: { d: 8, y: 0.6 },
      clear: bridgeClear,
      fail: bridgeFail,
    },
  ],
};
