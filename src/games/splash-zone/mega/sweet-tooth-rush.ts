/**
 * Mega course 6, Candy Cove's Sweet Tooth Rush: boing off a giant gummy bear's belly, fly through
 * the hole of a floating pink donut, then do a double backflip over a glass sundae. Every wipeout
 * ends in a big splash. Pure animation data like `penguin-parade.ts`: element-local coordinates,
 * `d` = 0 at the element's entry line, `y` up from the water, `s` sideways (+ is the rider's right).
 */
import {
  TAU,
  arc,
  lerp,
  prog,
  seatAtTime,
  setFree,
  smooth,
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

// ---------- Element 1: the gummy bear's belly ----------

/** The bear lies on its back: the ski rides up its belly (a soft mound), which boings it away. */
export const BEAR = {
  foot: 4,
  /** d and height of the top of the belly, where the clear boings off. */
  top: 10,
  topY: 1.9,
  end: 15,
  halfWidth: 2.4,
  /** The clear lands here, about 14 u on from the boing. */
  land: 24,
  /** The wipeout hits the belly low down, here. */
  lowHit: 8.4,
};

/** Height of the belly on the middle line at `d`. */
export function bearY(d: number): number {
  const { foot, top, topY, end } = BEAR;
  if (d <= foot) return 0;
  if (d <= top) return topY * smooth((d - foot) / (top - foot));
  return d <= end ? lerp(topY, 0.9, smooth((d - top) / (end - top))) : 0;
}

export const T_BOING = BEAR.top / SPEED;
export const T_LOW = BEAR.lowHit / SPEED;
const LENGTH1 = 40;

/** How squashed the belly is at `t` when the ski hits it at `hit`: 1 = not at all, 0.7 = flat. */
export function bellySquash(t: number, hit: number): number {
  if (t <= hit) return 1 - 0.3 * prog(t, hit - 0.12, hit);
  return 0.7 + 0.42 * prog(t, hit, hit + 0.2, 'o') - 0.12 * prog(t, hit + 0.2, hit + 0.5);
}

const bearRide = (t: number, f: Frame, hit: number) => {
  const k = f.ski;
  k.d = SPEED * t;
  const squash = bellySquash(t, hit);
  k.y = bearY(k.d) * squash;
  k.pitch = Math.atan(slopeAt(bearY, Math.min(k.d, BEAR.end - 0.02)));
  k.wet = k.d < BEAR.foot;
};

const bearClear: Def = (() => {
  const air = 1.3;
  const land = BEAR.land;
  const tLand = T_BOING + air;
  const y0 = BEAR.topY * 0.7;
  const peak = 6.6;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_BOING) {
      bearRide(t, f, T_BOING);
      f.rider.pose = 'ride';
    } else if (t < tLand) {
      const u = (t - T_BOING) / air;
      k.d = lerp(BEAR.top, land, u);
      k.y = arc(y0, 0, peak, u);
      k.pitch = 0.25 * Math.sin(TAU * u);
      k.wet = false;
      f.rider.pose = 'fistPump';
    } else {
      k.d = Math.min(land + SPEED * (t - tLand), LENGTH1);
      k.y = 0;
      f.rider.pose = 'ride';
    }
  };
  const mid = T_BOING + air / 2;
  return {
    duration: tLand + (LENGTH1 - land) / SPEED,
    length: LENGTH1,
    word: 'GUMMY BOUNCE!',
    at,
    events: () => [
      [T_BOING - 0.3, 'sfx:whoosh', BEAR.top - 3, 1],
      [T_BOING, 'sfx:boing', BEAR.top, y0],
      [T_BOING, 'spray', BEAR.top, y0],
      [mid, 'word', lerp(BEAR.top, land, 0.5), 8.2],
      [tLand, 'splash', land, 0],
      [tLand, 'sfx:splash', land, 0],
      [tLand + 0.2, 'cheer', land + 2, 1],
    ],
  };
})();

/** The fail: hits the belly too low, is boinged backwards and flips off into the syrup. */
export const FLOP = { bounce: 1.1, skiD: 3.2, riderD: 1.6, riderS: 2.6, flyT: 1.15 };

const bearFail: Def = (() => {
  const tLand = T_LOW + FLOP.bounce;
  const y0 = bearY(BEAR.lowHit) * bellySquash(T_LOW, T_LOW);
  const pitch0 = Math.atan(slopeAt(bearY, BEAR.lowHit - 0.02));
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LOW) {
      bearRide(t, f, T_LOW);
    } else if (t < tLand) {
      const u = (t - T_LOW) / FLOP.bounce;
      k.d = lerp(BEAR.lowHit, FLOP.skiD, prog(u, 0, 1, 'o'));
      k.y = arc(y0, 0, 5.4, u);
      k.pitch = pitch0 * (1 - prog(u, 0, 0.3)) + TAU * prog(u, 0.1, 0.95);
      k.wet = false;
    } else {
      const r = prog(t, tLand, tLand + 0.6, 'o');
      k.d = lerp(FLOP.skiD, FLOP.skiD - 0.6, r);
      k.s = lerp(0, -1.2, r);
      k.y = 0;
      k.pitch = TAU;
      k.roll = PI * r;
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, T_LOW);
  const splat = T_LOW + FLOP.flyT;
  const popEnd = splat + 0.5;
  const settle = Math.max(popEnd, tLand + 0.6) + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < T_LOW) {
      if (t >= T_LOW - 0.15) f.rider.face = 'scared';
      return;
    }
    if (t < splat) {
      const u = (t - T_LOW) / FLOP.flyT;
      setFree(
        f,
        lerp(s0.d, FLOP.riderD, u),
        arc(s0.y, FLAT_Y, 5.2, u),
        lerp(s0.s, FLOP.riderS, u),
        lerp(s0.pitch, 2 * TAU, flipEase(u)),
        0,
        0,
        u < 0.2 ? 'flail' : u < 0.85 ? 'tuck' : 'float',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(
      f,
      FLOP.riderD,
      lerp(FLAT_Y, FLOAT_Y, up),
      FLOP.riderS,
      2 * TAU,
      0,
      0,
      'float',
      'soaked',
    );
  };
  return {
    duration: settle + 1.0,
    word: 'BELLY FLOP!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (_ski, rider) => [
      [T_LOW - 0.3, 'sfx:whoosh', BEAR.lowHit - 3, 1],
      [T_LOW, 'sfx:boing', BEAR.lowHit, y0],
      [T_LOW, 'stars', BEAR.lowHit, y0 + 1.6],
      [T_LOW + 0.1, 'sfx:slideWhistle', BEAR.lowHit - 2, 3],
      ...trail(T_LOW + 0.3, splat - 0.2, 0.3, 'drips', rider),
      [tLand, 'splash', FLOP.skiD, 0.2],
      [splat, 'bigSplash', FLOP.riderD, 0.2, FLOP.riderS],
      [splat, 'sfx:splat', FLOP.riderD, 0, FLOP.riderS],
      [splat, 'sfx:splash', FLOP.riderD, 0, FLOP.riderS],
      [splat, 'groan', FLOP.riderD, 1, FLOP.riderS],
      [splat + 0.1, 'word', FLOP.riderD, 3.4, FLOP.riderS],
      [popEnd, 'drips', FLOP.riderD, 0.6, FLOP.riderS],
    ],
  };
})();

// ---------- Element 2: the donut hole ----------

/** A pink-iced donut stands on its edge across the course; the ski flies through its hole. */
export const DONUT = {
  d: 26,
  /** The centre of the hole, up from the water. */
  cy: 4.5,
  outer: 4.5,
  hole: 2.2,
  rampFoot: 5,
  lip: 14,
  lipY: 3.0,
  rampHalfWidth: 2.2,
  land: 38,
  /** The wipeout clips the icing here. */
  clipD: 24.8,
  clipY: 1.6,
};

/** Height of the sprinkle ramp on the middle line at `d`. */
export function donutRampY(d: number): number {
  if (d <= DONUT.rampFoot) return 0;
  return d <= DONUT.lip
    ? DONUT.lipY * ((d - DONUT.rampFoot) / (DONUT.lip - DONUT.rampFoot)) ** 1.5
    : 0;
}

const T_LIP2 = DONUT.lip / SPEED;
const LENGTH2 = 44;
const donutLipPitch = Math.atan(slopeAt(donutRampY, DONUT.lip - 0.02));

const donutRide = (t: number, f: Frame) => {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = donutRampY(k.d);
  k.pitch = Math.atan(slopeAt(donutRampY, Math.min(k.d, DONUT.lip - 0.02)));
  k.wet = k.d < DONUT.rampFoot;
};

const donutClear: Def = (() => {
  const air = 2.0;
  const tLand = T_LIP2 + air;
  const tPass = T_LIP2 + air * ((DONUT.d - DONUT.lip) / (DONUT.land - DONUT.lip));
  const peak = 4.2;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP2) {
      donutRide(t, f);
      f.rider.pose = 'ride';
    } else if (t < tLand) {
      const u = (t - T_LIP2) / air;
      k.d = lerp(DONUT.lip, DONUT.land, u);
      k.y = arc(DONUT.lipY, 0, peak, u);
      k.pitch = donutLipPitch * (1 - prog(u, 0, 0.35)) + 0.1 * Math.sin(TAU * u);
      k.roll = TAU * prog(u, 0.28, 0.76);
      k.wet = false;
      f.rider.pose = u < 0.25 ? 'fistPump' : u < 0.8 ? 'tuck' : 'armsUp';
    } else {
      k.d = Math.min(DONUT.land + SPEED * (t - tLand), LENGTH2);
      k.y = 0;
      k.roll = TAU;
      f.rider.pose = 'ride';
    }
  };
  return {
    duration: tLand + (LENGTH2 - DONUT.land) / SPEED,
    length: LENGTH2,
    word: 'DONUT DASH!',
    at,
    events: (ski) => [
      [T_LIP2 - 0.3, 'sfx:whoosh', DONUT.lip - 3, 1],
      [T_LIP2, 'sfx:boing', DONUT.lip, DONUT.lipY],
      [T_LIP2, 'spray', DONUT.lip, DONUT.lipY],
      ...trail(tPass - 0.35, tPass + 0.45, 0.1, 'confetti', ski),
      [tPass, 'word', DONUT.d, 9.8],
      [tLand, 'splash', DONUT.land, 0],
      [tLand, 'sfx:splash', DONUT.land, 0],
      [tLand + 0.2, 'cheer', DONUT.land + 2, 1],
    ],
  };
})();

/** The fail: clips the icing, bounces off the ring and drops into the water; the rider is thrown aside. */
export const GLAZE = {
  hop: 0.9,
  bounce: 0.8,
  at: T_LIP2 + 0.9,
  riderD: 23,
  riderS: 4.6,
  flyT: 1.0,
};

const donutFail: Def = (() => {
  const { hop, bounce, at: tHit } = GLAZE;
  const tWater = tHit + bounce;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP2) {
      donutRide(t, f);
    } else if (t < tHit) {
      const u = (t - T_LIP2) / hop;
      k.d = lerp(DONUT.lip, DONUT.clipD, u);
      k.y = arc(DONUT.lipY, DONUT.clipY, 3.3, u);
      k.pitch = donutLipPitch * (1 - prog(u, 0, 0.5)) - 0.15 * prog(u, 0.6, 1);
      k.wet = false;
    } else if (t < tWater) {
      const u = (t - tHit) / bounce;
      k.d = lerp(DONUT.clipD, 21.6, prog(u, 0, 1, 'o'));
      k.s = lerp(0, -3.6, prog(u, 0, 1, 'io'));
      k.y = arc(DONUT.clipY, 0, 3.4, u);
      k.pitch = -0.15 - 0.4 * u;
      k.roll = -PI * prog(u, 0.2, 1);
      k.wet = false;
    } else {
      const r = prog(t, tWater, tWater + 0.6, 'o');
      k.d = lerp(21.6, 21.0, r);
      k.s = lerp(-3.6, -4.0, r);
      k.y = 0;
      k.pitch = -0.55;
      k.roll = -PI;
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, tHit);
  const splat = tHit + GLAZE.flyT;
  const popEnd = splat + 0.5;
  const settle = Math.max(popEnd, tWater + 0.6) + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < tHit) {
      if (t >= T_LIP2 + 0.3) f.rider.face = 'scared';
      return;
    }
    if (t < splat) {
      const u = (t - tHit) / GLAZE.flyT;
      setFree(
        f,
        lerp(s0.d, GLAZE.riderD, u),
        arc(s0.y, FLAT_Y, s0.y + 1.3, u),
        lerp(s0.s, GLAZE.riderS, u),
        lerp(s0.pitch, -TAU, flipEase(u)),
        0,
        0,
        u < 0.2 ? 'flail' : u < 0.85 ? 'tuck' : 'float',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(
      f,
      GLAZE.riderD,
      lerp(FLAT_Y, FLOAT_Y, up),
      GLAZE.riderS,
      -TAU,
      0,
      0,
      'float',
      'soaked',
    );
  };
  return {
    duration: settle + 1.0,
    word: 'GLAZED!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [T_LIP2 - 0.3, 'sfx:whoosh', DONUT.lip - 3, 1],
      [T_LIP2, 'spray', DONUT.lip, DONUT.lipY],
      [tHit, 'sfx:bump', DONUT.clipD, DONUT.clipY],
      [tHit, 'stars', DONUT.clipD, DONUT.clipY + 1.4],
      [tHit + 0.05, 'sfx:boing', DONUT.clipD - 0.5, DONUT.clipY],
      ...trail(tHit + 0.1, tWater - 0.1, 0.15, 'drips', ski),
      [tWater, 'splash', 21.6, 0.2, -3.6],
      [tWater, 'sfx:splash', 21.6, 0, -3.6],
      ...trail(tHit + 0.3, splat - 0.2, 0.3, 'drips', rider),
      [splat, 'splash', GLAZE.riderD, 0.2, GLAZE.riderS],
      [splat, 'sfx:splat', GLAZE.riderD, 0, GLAZE.riderS],
      [splat, 'groan', GLAZE.riderD, 1, GLAZE.riderS],
      [splat + 0.1, 'word', GLAZE.riderD, 3.4, GLAZE.riderS],
      [popEnd, 'drips', GLAZE.riderD, 0.6, GLAZE.riderS],
    ],
  };
})();

// ---------- Element 3: the sundae ----------

/** A waffle-cone ramp, a tall glass sundae to fly over, and the whipped cream where the ski lands. */
export const SUNDAE = {
  d: 30,
  /** The glass bowl's radius, the top of the whipped cream and of the cherry. */
  radius: 2.8,
  creamY: 6.4,
  cherryY: 7.4,
  rampFoot: 5,
  lip: 15,
  lipY: 2.8,
  rampHalfWidth: 2.4,
  land: 45,
};

/** Height of the waffle-cone ramp on the middle line at `d`. */
export function coneY(d: number): number {
  if (d <= SUNDAE.rampFoot) return 0;
  return d <= SUNDAE.lip
    ? SUNDAE.lipY * ((d - SUNDAE.rampFoot) / (SUNDAE.lip - SUNDAE.rampFoot)) ** 1.5
    : 0;
}

const T_LIP3 = SUNDAE.lip / SPEED;
const LENGTH3 = 52;
const coneLipPitch = Math.atan(slopeAt(coneY, SUNDAE.lip - 0.02));
/** Seconds of flight in the clear, and when the ski is over the glass. */
export const SUNDAE_AIR = 2.6;
export const SUNDAE_OVER =
  T_LIP3 + SUNDAE_AIR * ((SUNDAE.d - SUNDAE.lip) / (SUNDAE.land - SUNDAE.lip));

const coneRide = (t: number, f: Frame) => {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = coneY(k.d);
  k.pitch = Math.atan(slopeAt(coneY, Math.min(k.d, SUNDAE.lip - 0.02)));
  k.wet = k.d < SUNDAE.rampFoot;
};

const sundaeClear: Def = (() => {
  const air = SUNDAE_AIR;
  const tLand = T_LIP3 + air;
  const peak = 10.0;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP3) {
      coneRide(t, f);
      f.rider.pose = 'ride';
    } else if (t < tLand) {
      const u = (t - T_LIP3) / air;
      k.d = lerp(SUNDAE.lip, SUNDAE.land, u);
      k.y = arc(SUNDAE.lipY, 0, peak, u);
      k.pitch = coneLipPitch * (1 - prog(u, 0, 0.12)) + 2 * TAU * flipEase((u - 0.08) / 0.84);
      k.wet = false;
      f.rider.pose = u > 0.92 ? 'armsUp' : u > 0.08 ? 'tuck' : 'fistPump';
    } else {
      k.d = Math.min(SUNDAE.land + SPEED * (t - tLand), LENGTH3);
      k.y = 0;
      k.pitch = 2 * TAU;
      f.rider.pose = 'ride';
    }
  };
  const mid = T_LIP3 + air * 0.45;
  return {
    duration: tLand + (LENGTH3 - SUNDAE.land) / SPEED,
    length: LENGTH3,
    word: 'SUNDAE SPLASH!',
    slow: [mid],
    at,
    events: () => [
      [T_LIP3 - 0.3, 'sfx:whoosh', SUNDAE.lip - 3, 1],
      [T_LIP3, 'sfx:boing', SUNDAE.lip, SUNDAE.lipY],
      [T_LIP3, 'spray', SUNDAE.lip, SUNDAE.lipY],
      [mid, 'word', SUNDAE.d, 11.2],
      [tLand, 'bigSplash', SUNDAE.land, 0],
      [tLand, 'sfx:splash', SUNDAE.land, 0],
      [tLand + 0.1, 'fireworks', SUNDAE.land, 6],
      [tLand + 0.2, 'cheer', SUNDAE.land + 2, 1],
      [tLand + 0.2, 'confetti', SUNDAE.land + 3, 2],
    ],
  };
})();

/** The fail: clips the cherry, comes up short and plunges into the whipped cream, then drops off. */
export const MELT = {
  air: 1.55,
  plunge: 0.9,
  hitD: 30,
  hitY: 6.6,
  skiD: 32.5,
  skiS: -3.4,
  riderD: 35.5,
  riderS: 2.2,
  flyT: 1.1,
};

/** When the wipeout hits the cherry. */
export const T_MELT = T_LIP3 + MELT.air;

const sundaeFail: Def = (() => {
  const tHit = T_MELT;
  const tWater = tHit + MELT.plunge;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP3) {
      coneRide(t, f);
    } else if (t < tHit) {
      const u = (t - T_LIP3) / MELT.air;
      k.d = lerp(SUNDAE.lip, MELT.hitD, u);
      k.y = arc(SUNDAE.lipY, MELT.hitY, 7.3, u);
      k.pitch = coneLipPitch * (1 - prog(u, 0, 0.3)) + 0.5 * prog(u, 0.5, 1);
      k.wet = false;
    } else if (t < tWater) {
      const u = (t - tHit) / MELT.plunge;
      k.d = lerp(MELT.hitD, MELT.skiD, prog(u, 0, 1, 'o'));
      k.s = lerp(0, MELT.skiS, prog(u, 0, 1, 'io'));
      k.y = arc(MELT.hitY, 0, MELT.hitY + 0.2, u);
      k.pitch = lerp(0.5, -0.4, u);
      k.roll = PI * prog(u, 0.3, 1);
      k.wet = false;
    } else {
      const r = prog(t, tWater, tWater + 0.6, 'o');
      k.d = lerp(MELT.skiD, MELT.skiD + 0.5, r);
      k.s = lerp(MELT.skiS, MELT.skiS - 0.3, r);
      k.y = 0;
      k.pitch = -0.4;
      k.roll = PI;
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, tHit);
  const splat = tHit + MELT.flyT;
  const popEnd = splat + 0.5;
  const settle = Math.max(popEnd, tWater + 0.6) + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < T_LIP3 + 0.2) return;
    if (t < tHit) {
      f.rider.face = 'scared';
      f.rider.pose = 'flail';
      return;
    }
    if (t < splat) {
      const u = (t - tHit) / MELT.flyT;
      setFree(
        f,
        lerp(s0.d, MELT.riderD, u),
        arc(s0.y, FLAT_Y, s0.y + 0.6, u),
        lerp(s0.s, MELT.riderS, u),
        lerp(s0.pitch, -TAU, flipEase(u)),
        0,
        0,
        u < 0.2 ? 'flail' : u < 0.85 ? 'tuck' : 'float',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, MELT.riderD, lerp(FLAT_Y, FLOAT_Y, up), MELT.riderS, -TAU, 0, 0, 'float', 'soaked');
  };
  return {
    duration: settle + 1.0,
    word: 'MELTDOWN!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (_ski, rider) => [
      [T_LIP3 - 0.3, 'sfx:whoosh', SUNDAE.lip - 3, 1],
      [T_LIP3, 'spray', SUNDAE.lip, SUNDAE.lipY],
      [tHit, 'sfx:bump', MELT.hitD, MELT.hitY],
      [tHit, 'bigSplash', MELT.hitD, MELT.hitY - 0.6],
      [tHit, 'stars', MELT.hitD, MELT.hitY + 1.4],
      [tHit + 0.05, 'sfx:slideWhistle', MELT.hitD, MELT.hitY],
      ...trail(tHit + 0.3, splat - 0.2, 0.3, 'drips', rider),
      [tWater, 'splash', MELT.skiD, 0.2, MELT.skiS],
      [splat, 'bigSplash', MELT.riderD, 0.2, MELT.riderS],
      [splat, 'sfx:splat', MELT.riderD, 0, MELT.riderS],
      [splat, 'sfx:splash', MELT.riderD, 0, MELT.riderS],
      [splat, 'groan', MELT.riderD, 1, MELT.riderS],
      [splat + 0.1, 'word', MELT.riderD, 3.4, MELT.riderS],
      [popEnd, 'drips', MELT.riderD, 0.6, MELT.riderS],
    ],
  };
})();

export const SWEET_TOOTH_RUSH: MegaSpec = {
  id: 'sweet-tooth-rush',
  title: 'Sweet Tooth Rush',
  emoji: '🍭',
  elements: [
    {
      name: 'Gummy Bear Bounce',
      length: LENGTH1,
      floorY: -1.2,
      cue: { d: 6, y: 1.0 },
      anchor: { d: BEAR.top, y: 2.5 },
      extent: [3, 17],
      clear: bearClear,
      fail: bearFail,
    },
    {
      name: 'Donut Hole Dash',
      length: LENGTH2,
      floorY: -1.2,
      cue: { d: 8, y: 1.0 },
      anchor: { d: DONUT.d, y: DONUT.cy },
      extent: [17, 35],
      clear: donutClear,
      fail: donutFail,
    },
    {
      name: 'Sundae Splash',
      length: LENGTH3,
      floorY: -1.2,
      cue: { d: 8, y: 1.0 },
      anchor: { d: SUNDAE.d, y: 4.5 },
      extent: [21, 39],
      clear: sundaeClear,
      fail: sundaeFail,
    },
  ],
};
