/**
 * Mega course 1, the Lagoon's Whale of a Time: jump a palm-tree sandbar island, bounce off a
 * whale's back and ride a second whale's spout sky-high into a triple backflip. Pure animation
 * data like `tricks.ts`: element-local coordinates, `d` = 0 at the element's entry line, `y` up
 * from the water, `s` sideways (+ is the rider's right).
 *
 * Every element starts as the arrival pose (on the water, level, seated, ENTRY_SPEED) and a
 * cleared one ends riding on the water at its `length`, so the three chain. A fail comes to rest
 * with the rider floating (he is always fine).
 */
import {
  TAU,
  arc,
  lerp,
  prog,
  seatAtTime,
  setFree,
  smooth,
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

// ---------- Element 1: the palm-tree sandbar ----------

/** The island: a beach up to the plateau (with palms), then a beach down the far side. */
export const SANDBAR = {
  foot: 7,
  lip: 13,
  top: 2.4,
  plateauEnd: 22,
  end: 26,
  halfWidth: 6,
  /** Palm trees on the plateau: [d, s]. None is on the middle line the ski flies along. */
  palms: [
    [16.5, -3.8],
    [18.5, 4.2],
    [20.5, 3.5],
    [14.5, 3.9],
  ] as readonly (readonly [number, number])[],
};
export const PALM_HEIGHT = 4.2;

/** Height of the island's surface on its middle line at `d`. */
export function sandbarY(d: number): number {
  const { foot, lip, top, plateauEnd, end } = SANDBAR;
  if (d <= foot) return 0;
  if (d <= lip) return top * ((d - foot) / (lip - foot)) ** 1.5;
  if (d <= plateauEnd) return top;
  if (d < end) return top * (1 - smooth((d - plateauEnd) / (end - plateauEnd)));
  return 0;
}

const T_LIP1 = SANDBAR.lip / SPEED;
const AIR1 = 1.75;
const LAND1 = 34;
const T_LAND1 = T_LIP1 + AIR1;
const LENGTH1 = 40;
const PEAK1 = 5.0;

const sandClear: Def = (() => {
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    const u = Math.min(Math.max((t - T_LIP1) / AIR1, 0), 1);
    if (t <= T_LIP1) {
      k.d = SPEED * t;
      k.y = sandbarY(k.d);
      k.pitch = Math.atan(slopeAt(sandbarY, Math.min(k.d, SANDBAR.lip - 0.02)));
      k.wet = k.d < SANDBAR.foot;
      f.rider.pose = 'ride';
    } else if (t < T_LAND1) {
      k.d = lerp(SANDBAR.lip, LAND1, u);
      k.y = arc(SANDBAR.top, 0, PEAK1, u);
      const lipPitch = Math.atan(slopeAt(sandbarY, SANDBAR.lip - 0.02));
      k.pitch = lipPitch * (1 - smooth(u / 0.4)) + 0.2 * Math.sin(TAU * u);
      k.wet = false;
      f.rider.pose = 'fistPump';
    } else {
      k.d = Math.min(LAND1 + SPEED * (t - T_LAND1), LENGTH1);
      k.y = 0;
      f.rider.pose = 'ride';
    }
  };
  const mid = T_LIP1 + AIR1 / 2;
  return {
    duration: T_LAND1 + (LENGTH1 - LAND1) / SPEED,
    length: LENGTH1,
    word: 'ISLAND HOP!',
    at,
    events: () => [
      [T_LIP1 - 0.2, 'sfx:whoosh', SANDBAR.lip - 2, SANDBAR.top],
      [T_LIP1, 'spray', SANDBAR.lip, SANDBAR.top],
      [mid, 'word', lerp(SANDBAR.lip, LAND1, 0.5), 6.6],
      [T_LAND1, 'splash', LAND1, 0],
      [T_LAND1, 'sfx:splash', LAND1, 0],
      [T_LAND1 + 0.2, 'cheer', LAND1 + 2, 1],
    ],
  };
})();

/** The fail: a pathetic hop, a skid into a palm tree, the rider tangled in its fronds. */
export const TANGLE = { tree: [20.5, 3.5] as const, crown: [21.2, 3.6, 5.6] as const };

const sandFail: Def = (() => {
  const HOP = 0.29;
  const tLand = T_LIP1 + HOP;
  const landD = SANDBAR.lip + SPEED * HOP;
  const tHit = tLand + 0.45;
  const [treeD, treeS] = TANGLE.tree;
  const skiD = track([
    [tLand, landD],
    [tHit, treeD + 0.3, 'o'],
    [tHit + 0.8, 25.6, 'o'],
  ]);
  const skiS = track([
    [tLand, 0],
    [tHit, treeS, 'io'],
    [tHit + 0.8, treeS + 0.7, 'o'],
  ]);
  const skiYaw = track([
    [tLand, 0],
    [tHit, -0.8, 'io'],
  ]);
  const skiRoll = track([
    [tLand, 0],
    [tHit, 0.15],
    [tHit + 0.8, Math.PI, 'io'],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP1) {
      k.d = SPEED * t;
      k.y = sandbarY(k.d);
      k.pitch = Math.atan(slopeAt(sandbarY, Math.min(k.d, SANDBAR.lip - 0.02)));
      k.wet = k.d < SANDBAR.foot;
    } else if (t < tLand) {
      const u = (t - T_LIP1) / HOP;
      k.d = lerp(SANDBAR.lip, landD, u);
      k.y = arc(SANDBAR.top, SANDBAR.top, SANDBAR.top + 0.5, u);
      const lipPitch = Math.atan(slopeAt(sandbarY, SANDBAR.lip - 0.02));
      k.pitch = lipPitch * (1 - smooth(u));
      k.wet = false;
    } else {
      k.d = skiD(t);
      k.s = skiS(t);
      k.yaw = skiYaw(t);
      k.roll = skiRoll(t);
      k.y = sandbarY(k.d);
      k.pitch = 0;
      k.wet = t > tHit + 0.7;
    }
  };
  const s0 = seatAtTime(skiAt, tHit);
  const [crownD, crownS, crownY] = TANGLE.crown;
  const hangEnd = tHit + 0.5 + 0.9;
  const dropEnd = hangEnd + 0.8;
  const waterD = 27.2;
  const waterS = 4.6;
  const popEnd = dropEnd + 0.5;
  const settle = popEnd + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < tHit) return;
    f.rider.props.seaweed = true;
    if (t < tHit + 0.5) {
      const u = (t - tHit) / 0.5;
      setFree(
        f,
        lerp(s0.d, crownD, u),
        arc(s0.y, crownY, crownY + 0.9, u),
        lerp(s0.s, crownS, u),
        lerp(s0.pitch, 0, u),
        0,
        0,
        'flail',
        'scared',
      );
    } else if (t < hangEnd) {
      setFree(
        f,
        crownD,
        crownY + 0.12 * Math.sin((t - tHit) * 9),
        crownS,
        0.2 * Math.sin((t - tHit) * 6),
        0,
        0,
        'flail',
        'scared',
      );
    } else if (t < dropEnd) {
      const u = (t - hangEnd) / 0.8;
      setFree(
        f,
        lerp(crownD, waterD, u),
        arc(crownY, FLAT_Y, crownY + 0.2, u),
        lerp(crownS, waterS, u),
        0,
        0,
        0,
        'flail',
        'scared',
      );
    } else {
      const up = prog(t, dropEnd, popEnd, 'o');
      setFree(f, waterD, lerp(FLAT_Y, FLOAT_Y, up), waterS, 0, 0, 0, 'float', 'soaked');
    }
  };
  return {
    duration: settle + 1.0,
    word: 'TANGLED!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [T_LIP1 - 0.2, 'sfx:whoosh', SANDBAR.lip - 2, SANDBAR.top],
      [T_LIP1, 'spray', SANDBAR.lip, SANDBAR.top],
      [tHit, 'sfx:bump', treeD, 3],
      [tHit, 'stars', treeD, 4.5, treeS],
      [tHit + 0.1, 'sfx:slideWhistle', crownD, crownY],
      ...trail(dropEnd - 0.5, dropEnd - 0.1, 0.2, 'drips', rider),
      [tHit + 0.8, 'splash', ski(tHit + 0.8).d, 0.2, ski(tHit + 0.8).s],
      [dropEnd, 'bigSplash', waterD, 0.2, waterS],
      [dropEnd, 'sfx:splat', waterD, 0, waterS],
      [dropEnd, 'sfx:splash', waterD, 0, waterS],
      [dropEnd, 'groan', waterD, 1, waterS],
      [dropEnd + 0.1, 'word', waterD, 3.2, waterS],
      [popEnd, 'drips', waterD, 0.6, waterS],
    ],
  };
})();

// ---------- Element 2: bounce off a whale's back ----------

/** The whale lies across the course, head to the left, with its tail (to the right) out of the water. */
export const WHALE = { d: 11, top: 2.2, half: 3.6, headS: -9, tailS: 8.5 };

/** Height of the whale's back on the middle line at `d` (it rises and falls like a rounded hump). */
export function whaleY(d: number): number {
  const x = (d - WHALE.d) / WHALE.half;
  if (Math.abs(x) >= 1) return 0;
  return WHALE.top * Math.cos((Math.PI / 2) * x) ** 1.3;
}
/** How high the back is at side position `s` (it narrows towards the tail and the head). */
export const whaleBackAt = (s: number): number => WHALE.top * Math.max(0, 1 - (s / 11) ** 2);

const T_BOUNCE = WHALE.d / SPEED;
const AIR2 = 1.55;
const LAND2 = 30;
const T_LAND2 = T_BOUNCE + AIR2;
const LENGTH2 = 36;
const PEAK2 = 7.0;
/** Time the tail whips up, on a fail. */
export const T_FLICK = 1.7;

/** Time and place the ski rides up the whale's near side (on the middle line). */
function whaleRide(t: number, f: Frame): void {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = whaleY(k.d);
  k.pitch = Math.atan(slopeAt(whaleY, Math.min(k.d, WHALE.d)));
  k.wet = k.d < WHALE.d - WHALE.half;
}

const whaleClear: Def = (() => {
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_BOUNCE) {
      whaleRide(t, f);
      f.rider.pose = 'ride';
    } else if (t < T_LAND2) {
      const u = (t - T_BOUNCE) / AIR2;
      k.d = lerp(WHALE.d, LAND2, u);
      k.y = arc(WHALE.top, 0, PEAK2, u);
      k.pitch = (1 - smooth(u / 0.1)) * 0.5 + TAU * flipEase((u - 0.08) / 0.84);
      k.wet = false;
      f.rider.pose = u < 0.15 || u > 0.85 ? 'fistPump' : 'tuck';
    } else {
      k.d = Math.min(LAND2 + SPEED * (t - T_LAND2), LENGTH2);
      k.y = 0;
      k.pitch = TAU;
      f.rider.pose = 'ride';
    }
  };
  const mid = T_BOUNCE + AIR2 / 2;
  return {
    duration: T_LAND2 + (LENGTH2 - LAND2) / SPEED,
    length: LENGTH2,
    word: 'WHALE BOUNCE!',
    at,
    events: () => [
      [T_BOUNCE - 0.15, 'sfx:whoosh', WHALE.d - 2, 1],
      [T_BOUNCE, 'sfx:boing', WHALE.d, WHALE.top],
      [T_BOUNCE, 'bigSplash', WHALE.d + 1, WHALE.top],
      [mid, 'word', lerp(WHALE.d, LAND2, 0.5), 8.6],
      [T_LAND2, 'splash', LAND2, 0],
      [T_LAND2, 'sfx:splash', LAND2, 0],
      [T_LAND2 + 0.2, 'cheer', LAND2 + 2, 1],
    ],
  };
})();

/** The fail: the whale flicks the ski and the rider away with its tail. */
export const FLICK = { skiLand: [17, 11.5] as const, riderLand: [19.5, 14.5] as const };

const whaleFail: Def = (() => {
  const slideEnd = 1.55;
  const slide = track([
    [T_BOUNCE, 0],
    [slideEnd, 6.2, 'io'],
  ]);
  const [skiLandD, skiLandS] = FLICK.skiLand;
  const flightT = 1.5;
  const tLand = T_FLICK + flightT;
  const slideY = (s: number) => whaleBackAt(s) - 0.05;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_BOUNCE) {
      whaleRide(t, f);
    } else if (t < T_FLICK) {
      k.d = WHALE.d;
      k.s = slide(t);
      k.y = slideY(k.s);
      k.roll = 0.35 * prog(t, T_BOUNCE, slideEnd);
      k.wet = false;
    } else if (t < tLand) {
      const u = (t - T_FLICK) / flightT;
      const s0 = slide(T_FLICK);
      k.d = lerp(WHALE.d, skiLandD, u);
      k.s = lerp(s0, skiLandS, u);
      k.y = arc(slideY(s0), 0, 7.2, u);
      k.roll = lerp(0.35, 7 * Math.PI, flipEase(u));
      k.pitch = 0.3 * Math.sin(TAU * u);
      k.wet = false;
    } else {
      k.d = skiLandD + 1.0 * prog(t, tLand, tLand + 0.8, 'o');
      k.s = skiLandS + 0.8 * prog(t, tLand, tLand + 0.8, 'o');
      k.y = 0;
      k.roll = 7 * Math.PI;
      k.wet = true;
    }
  };
  const tFree = T_FLICK + 0.05;
  const s0 = seatAtTime(skiAt, tFree);
  const [riderD, riderS] = FLICK.riderLand;
  const flyT = 1.6;
  const splat = tFree + flyT;
  const popEnd = splat + 0.5;
  const settle = Math.max(popEnd, tLand + 0.8) + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < tFree) return;
    if (t < splat) {
      const u = (t - tFree) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, 9.5, u),
        lerp(s0.s, riderS, u),
        lerp(s0.pitch, -2.5 * TAU, flipEase(u)),
        0,
        0,
        u < 0.2 ? 'flail' : u < 0.85 ? 'tuck' : 'float',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), riderS, -2.5 * TAU, 0, 0, 'float', 'soaked');
  };
  return {
    duration: settle + 1.0,
    word: 'TAIL SLAP!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (_ski, rider) => [
      [T_BOUNCE - 0.15, 'sfx:whoosh', WHALE.d - 2, 1],
      [T_BOUNCE, 'sfx:boing', WHALE.d, WHALE.top],
      [T_FLICK, 'sfx:bump', WHALE.d, 2, WHALE.tailS - 2],
      [T_FLICK, 'bigSplash', WHALE.d, 1.5, WHALE.tailS],
      [T_FLICK + 0.1, 'sfx:slideWhistle', WHALE.d, 4, 7],
      ...trail(tFree + 0.4, splat - 0.2, 0.3, 'drips', rider),
      [tLand, 'splash', skiLandD, 0, skiLandS],
      [tLand, 'sfx:splash', skiLandD, 0, skiLandS],
      [splat, 'bigSplash', riderD, 0.2, riderS],
      [splat, 'sfx:splat', riderD, 0, riderS],
      [splat, 'sfx:splash', riderD, 0, riderS],
      [splat, 'groan', riderD, 1, riderS],
      [splat + 0.1, 'word', riderD, 3.2, riderS],
      [popEnd, 'drips', riderD, 0.6, riderS],
    ],
  };
})();

// ---------- Element 3: the spout ----------

/** The spout: a jet of water the ski rides up from the foot to the crown, then the finale. */
export const SPOUT = { foot: 8, crownD: 15.5, crownY: 8.0, whaleD: 9 };

/** Height of the water jet's riding surface at `d` (from the foot to the crown). */
export function spoutY(d: number): number {
  const u = Math.min(Math.max((d - SPOUT.foot) / (SPOUT.crownD - SPOUT.foot), 0), 1);
  return SPOUT.crownY * u ** 1.35;
}

const T_FOOT3 = SPOUT.foot / SPEED;
const T_CROWN3 = T_FOOT3 + 0.7;
const AIR3 = 2.3;
const LAND3 = 43;
const T_LAND3 = T_CROWN3 + AIR3;
const LENGTH3 = 49;
const PEAK3 = 12;

/** The spout's height as a fraction of full: it shoots up before the ski arrives. */
export const spoutRise = track([
  [0, 0],
  [0.55, 1, 'o'],
]);

const spoutClimb = (t: number, f: Frame) => {
  const k = f.ski;
  const u = Math.min(Math.max((t - T_FOOT3) / (T_CROWN3 - T_FOOT3), 0), 1);
  k.d = lerp(SPOUT.foot, SPOUT.crownD, u);
  k.y = spoutY(k.d);
  k.pitch = Math.atan(
    slopeAt(spoutY, Math.min(Math.max(k.d, SPOUT.foot + 0.05), SPOUT.crownD - 0.05)),
  );
  k.wet = false;
};

const spoutClear: Def = (() => {
  const lipPitch = Math.atan(slopeAt(spoutY, SPOUT.crownD - 0.05));
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t < T_FOOT3) {
      k.d = SPEED * t;
      k.y = 0;
      f.rider.pose = 'ride';
    } else if (t <= T_CROWN3) {
      spoutClimb(t, f);
      f.rider.pose = 'ride';
    } else if (t < T_LAND3) {
      const u = (t - T_CROWN3) / AIR3;
      k.d = lerp(SPOUT.crownD, LAND3, u);
      k.y = arc(SPOUT.crownY, 0, PEAK3, u);
      k.pitch = (1 - smooth(u / 0.12)) * lipPitch + 3 * TAU * flipEase((u - 0.04) / 0.86);
      k.wet = false;
      f.rider.pose = u > 0.9 ? 'armsUp' : u > 0.06 ? 'tuck' : 'fistPump';
    } else {
      k.d = Math.min(LAND3 + SPEED * (t - T_LAND3), LENGTH3);
      k.y = 0;
      k.pitch = 3 * TAU;
      f.rider.pose = 'ride';
    }
  };
  const mid = T_CROWN3 + AIR3 / 2;
  return {
    duration: T_LAND3 + (LENGTH3 - LAND3) / SPEED,
    length: LENGTH3,
    word: 'TRIPLE BACKFLIP!',
    slow: [mid],
    at,
    events: () => [
      [T_FOOT3 - 0.3, 'sfx:whoosh', SPOUT.foot - 3, 0.5],
      [T_FOOT3, 'bigSplash', SPOUT.foot, 0.2],
      [T_CROWN3, 'sfx:boing', SPOUT.crownD, SPOUT.crownY],
      [T_CROWN3, 'spray', SPOUT.crownD, SPOUT.crownY],
      [mid, 'word', lerp(SPOUT.crownD, LAND3, 0.5), 14.2],
      [T_LAND3, 'bigSplash', LAND3, 0],
      [T_LAND3, 'sfx:splash', LAND3, 0],
      [T_LAND3 + 0.15, 'cheer', LAND3 + 2, 1],
      [T_LAND3 + 0.15, 'confetti', LAND3 + 3, 2],
    ],
  };
})();

/** The fail: the spout fizzles halfway up and the ski flops back flat. */
export const FIZZLE = { at: 1.15, gone: 1.6, flopD: 16.8 };

const spoutFail: Def = (() => {
  const tClimbEnd = FIZZLE.at;
  const dropEnd = 2.2;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t < T_FOOT3) {
      k.d = SPEED * t;
      k.y = 0;
    } else if (t <= tClimbEnd) {
      spoutClimb(t, f);
    } else if (t < dropEnd) {
      spoutClimb(tClimbEnd, f);
      const d0 = k.d;
      const y0 = k.y;
      const p0 = k.pitch;
      const u = (t - tClimbEnd) / (dropEnd - tClimbEnd);
      k.d = lerp(d0, FIZZLE.flopD, u);
      k.y = arc(y0, 0, y0 + 0.4, u);
      k.pitch = lerp(p0, -0.15, prog(u, 0, 0.7, 'o'));
      k.wet = false;
    } else {
      k.d = FIZZLE.flopD + 1.2 * prog(t, dropEnd, dropEnd + 0.9, 'o');
      k.y = 0;
      k.pitch = -0.15 * (1 - prog(t, dropEnd, dropEnd + 0.6));
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, dropEnd);
  const flyT = 0.55;
  const splat = dropEnd + flyT;
  const riderD = 21.4;
  const popEnd = splat + 0.5;
  const settle = popEnd + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < dropEnd) return;
    if (t < splat) {
      const u = (t - dropEnd) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, s0.y + 0.6, u),
        0.8 * u,
        lerp(s0.pitch, -0.3, u),
        0,
        0,
        'flail',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), 0.8, -0.3, 0, 0, 'float', 'soaked');
  };
  return {
    duration: settle + 1.0,
    word: 'FIZZLE FLOP!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski) => [
      [T_FOOT3 - 0.3, 'sfx:whoosh', SPOUT.foot - 3, 0.5],
      [T_FOOT3, 'bigSplash', SPOUT.foot, 0.2],
      [FIZZLE.at, 'sfx:slideWhistle', ski(FIZZLE.at).d, ski(FIZZLE.at).y],
      [FIZZLE.at, 'drips', ski(FIZZLE.at).d, ski(FIZZLE.at).y + 1],
      [dropEnd, 'bigSplash', FIZZLE.flopD, 0.2],
      [dropEnd, 'sfx:splat', FIZZLE.flopD, 0],
      [dropEnd, 'sfx:splash', FIZZLE.flopD, 0],
      [dropEnd, 'groan', FIZZLE.flopD, 1],
      [dropEnd + 0.1, 'word', FIZZLE.flopD + 1, 3.2],
      [splat, 'splash', riderD, 0.1, 0.8],
      [popEnd, 'drips', riderD, 0.6, 0.8],
    ],
  };
})();

export const WHALE_OF_A_TIME: MegaSpec = {
  id: 'whale-of-a-time',
  title: 'Whale of a Time',
  emoji: '🐳',
  elements: [
    {
      name: 'Sandbar Island',
      length: LENGTH1,
      floorY: -1.2,
      cue: { d: 8, y: 0.8 },
      clear: sandClear,
      fail: sandFail,
    },
    {
      name: 'Whale Bounce',
      length: LENGTH2,
      floorY: -1.2,
      cue: { d: 7.4, y: 0.5 },
      clear: whaleClear,
      fail: whaleFail,
    },
    {
      name: 'Spout Sky-High',
      length: LENGTH3,
      floorY: -1.2,
      cue: { d: 8, y: 0.5 },
      clear: spoutClear,
      fail: spoutFail,
    },
  ],
};
