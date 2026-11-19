/**
 * Mega course 4, Volcano Island's Geyser Blast: leap a lava-rock arch, weave between falling
 * coconut-boulders, then ride a steam geyser up into a double corkscrew. Pure animation data like
 * `harbour-havoc.ts`: element-local coordinates, `d` = 0 at the element's entry line, `y` up from
 * the water, `s` sideways (+ is the rider's right).
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

// ---------- Element 1: the lava-rock arch ----------

/** The arch: a natural bridge of black rock to ride over, with a vent that blows soot on its crown. */
export const LAVA = {
  foot: 4,
  crown: 14,
  lipD: 24,
  crownY: 3.4,
  lipY: 2.6,
  halfWidth: 2.4,
  vent: 19.5,
};

/** Height of the arch's top on the middle line at `d` (it ends in a cliff at the lip). */
export function lavaY(d: number): number {
  const { foot, crown, lipD, crownY, lipY } = LAVA;
  if (d <= foot) return 0;
  if (d <= crown) return crownY * smooth((d - foot) / (crown - foot));
  if (d <= lipD) return lerp(crownY, lipY, smooth((d - crown) / (lipD - crown)));
  return 0;
}

const T_LIP1 = LAVA.lipD / SPEED;
const T_VENT = LAVA.vent / SPEED;
const LENGTH1 = 44;

const lavaPitch = (d: number) =>
  d <= LAVA.foot ? 0 : Math.atan(slopeAt(lavaY, Math.min(d, LAVA.lipD - 0.02)));

const lavaRide = (t: number, f: Frame) => {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = lavaY(k.d);
  k.pitch = lavaPitch(k.d);
  k.wet = k.d < LAVA.foot;
};

const lavaClear: Def = (() => {
  const air = 1.2;
  const land = 38;
  const tLand = T_LIP1 + air;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP1) {
      lavaRide(t, f);
      f.rider.pose = t < LAVA.crown / SPEED - 0.4 ? 'ride' : 'armsUp';
    } else if (t < tLand) {
      const u = (t - T_LIP1) / air;
      k.d = lerp(LAVA.lipD, land, u);
      k.y = arc(LAVA.lipY, 0, 5.0, u);
      k.pitch = 0.22 * Math.sin(TAU * u);
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
    word: 'LAVA LEAP!',
    at,
    events: (ski) => [
      [LAVA.crown / SPEED - 0.8, 'sfx:whoosh', LAVA.crown - 6, 2],
      [LAVA.crown / SPEED, 'sfx:boing', LAVA.crown, LAVA.crownY],
      ...trail(LAVA.crown / SPEED + 0.1, T_LIP1 - 0.1, 0.16, 'spray', ski, 0.1),
      [T_LIP1, 'sfx:boing', LAVA.lipD, LAVA.lipY],
      [mid, 'word', lerp(LAVA.lipD, land, 0.5), 7.0],
      [tLand, 'splash', land, 0],
      [tLand, 'sfx:splash', land, 0],
      [tLand + 0.2, 'cheer', land + 2, 1],
    ],
  };
})();

/** The fail: the vent on the crown blasts soot in the rider's face and the blind ski veers off. */
export const SOOT = { at: T_VENT, offAt: T_VENT + 0.95 };

const lavaFail: Def = (() => {
  const { at: tVent, offAt: tOff } = SOOT;
  const slideEnd = tVent + 1.0;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= tVent) {
      lavaRide(t, f);
      return;
    }
    const fall = prog(t, tVent + 0.1, tVent + 0.95, 'io');
    k.d = lerp(LAVA.vent, 23.2, prog(t, tVent, slideEnd, 'q'));
    k.s = lerp(0, 3.2, fall);
    k.y = lerp(lavaY(k.d), 0.1, prog(Math.abs(k.s), 1.5, 2.8, 'l'));
    k.pitch =
      lavaPitch(k.d) * (1 - prog(t, tVent, tVent + 0.4)) +
      0.3 * prog(t, tVent, tVent + 0.15, 'o') * (1 - prog(t, tVent + 0.15, tVent + 0.6));
    k.yaw = -0.7 * fall;
    k.roll = 0.9 * prog(t, tVent + 0.4, slideEnd);
    k.wet = Math.abs(k.s) > 2.6;
  };
  const s0 = seatAtTime(skiAt, tOff);
  const flyT = 0.9;
  const splat = tOff + flyT;
  const riderD = 27.4;
  const riderS = 4.4;
  const popEnd = splat + 0.5;
  const settle = popEnd + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < tVent + 0.05) return;
    if (t < tOff) {
      f.rider.face = 'sooty';
      f.rider.pose = 'flail';
      return;
    }
    if (t < splat) {
      const u = (t - tOff) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, s0.y + 1.2, u),
        lerp(s0.s, riderS, u),
        lerp(s0.pitch, -TAU, flipEase(u)),
        0,
        0,
        u < 0.75 ? 'flail' : 'float',
        'sooty',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), riderS, -TAU, 0, 0, 'float', 'sooty');
  };
  return {
    duration: settle + 1.0,
    word: 'SOOT FACE!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [LAVA.crown / SPEED - 0.8, 'sfx:whoosh', LAVA.crown - 6, 2],
      [LAVA.crown / SPEED, 'sfx:boing', LAVA.crown, LAVA.crownY],
      ...trail(LAVA.crown / SPEED + 0.1, tVent - 0.1, 0.16, 'spray', ski, 0.1),
      [tVent, 'sfx:bump', LAVA.vent, lavaY(LAVA.vent) + 0.5],
      [tVent, 'spray', LAVA.vent, lavaY(LAVA.vent) + 0.4],
      [tVent + 0.05, 'sfx:slideWhistle', LAVA.vent, lavaY(LAVA.vent) + 2],
      [tOff - 0.15, 'splash', ski(tOff - 0.15).d, 0.2, ski(tOff - 0.15).s],
      ...trail(tOff + 0.1, splat - 0.2, 0.3, 'drips', rider),
      [splat, 'bigSplash', riderD, 0.2, riderS],
      [splat, 'sfx:splat', riderD, 0, riderS],
      [splat, 'sfx:splash', riderD, 0, riderS],
      [splat, 'groan', riderD, 1, riderS],
      [splat + 0.1, 'word', riderD, 3.2, riderS],
      [popEnd, 'drips', riderD, 0.6, riderS],
    ],
  };
})();

// ---------- Element 2: the falling coconut-boulders ----------

/** Four coconut-boulders drop one after another where the ski would be, each on the side it is not. */
export const BOULDERS = {
  radius: 1.15,
  /** Seconds a boulder takes to fall (from `DROP_Y`). */
  fall: 0.75,
  /** d and s where each lands, and the time it hits the water. */
  list: [
    { d: 13, s: 0.6 },
    { d: 19, s: -0.6 },
    { d: 25, s: 0.6 },
    { d: 31, s: -0.6 },
  ] as const,
  dropY: 16,
  /** How far the ski keeps to the other side. */
  swing: 2.7,
};
/** When boulder `i` hits the water: just before the ski reaches its d. */
export const boulderLandAt = (i: number) => BOULDERS.list[i].d / SPEED - 0.3;

const LENGTH2 = 42;

/** The ski's side-to-side path through the boulders (a function of time). */
const weave = track([
  [0, 0],
  [13 / SPEED, -BOULDERS.swing],
  [19 / SPEED, BOULDERS.swing],
  [25 / SPEED, -BOULDERS.swing],
  [31 / SPEED, BOULDERS.swing],
  [37 / SPEED, 0],
]);

/** Leans into the turn: the heading from the side speed, and the bank. */
function lean(path: (t: number) => number, t: number, f: Frame) {
  const k = f.ski;
  const side = (path(t + 0.02) - path(t - 0.02)) / 0.04;
  k.yaw = -0.8 * Math.atan2(side, SPEED);
  k.roll = 0.04 * side;
}

const boulderClear: Def = (() => {
  const duration = LENGTH2 / SPEED;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    k.d = SPEED * t;
    k.y = 0;
    k.s = weave(t);
    lean(weave, t, f);
    k.wet = true;
    f.rider.pose = t > 31 / SPEED + 0.2 ? 'fistPump' : 'ride';
  };
  const mid = 21 / SPEED;
  return {
    duration,
    length: LENGTH2,
    word: 'COCONUT WEAVE!',
    at,
    events: (ski) => [
      ...BOULDERS.list.flatMap(({ d, s }, i): ReturnType<Def['events']> => [
        [boulderLandAt(i), 'bigSplash', d, 0.3, s],
        [boulderLandAt(i), 'sfx:splash', d, 0, s],
      ]),
      ...trail(0.3, duration - 0.4, 0.2, 'spray', ski, 0.1),
      [mid, 'word', 21, 6.2],
      [duration - 0.3, 'cheer', LENGTH2 - 2, 1],
    ],
  };
})();

/** The fail: the ski drifts under the second boulder, which bonks the rider; he sees stars and tips off. */
export const BONK = { at: 1.55, d: 12 * 1.55, s: -0.7, tipAt: 1.55 + 1.45 };

const boulderFail: Def = (() => {
  const { at: tBonk, tipAt } = BONK;
  const route = track([
    [0, 0],
    [13 / SPEED, -BOULDERS.swing],
    [tBonk, BONK.s],
    [tBonk + 0.7, -1.0, 'o'],
  ]);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= tBonk) {
      k.d = SPEED * t;
      k.s = route(t);
      lean(route, t, f);
    } else {
      const u = prog(t, tBonk, tBonk + 0.7, 'o');
      k.d = lerp(BONK.d, BONK.d + 1.8, u);
      k.s = route(t);
      const settle = Math.exp(-3 * (t - tBonk));
      k.roll = 0.12 * Math.sin(7 * (t - tBonk)) * settle;
      k.pitch = -0.2 * prog(t, tBonk, tBonk + 0.1, 'o') * (1 - prog(t, tBonk + 0.1, tBonk + 0.6));
      k.yaw = 0.15 * Math.sin(4 * (t - tBonk)) * settle;
    }
    k.y = 0;
    k.wet = true;
  };
  const s0 = seatAtTime(skiAt, tipAt);
  const flyT = 0.6;
  const splat = tipAt + flyT;
  const riderD = 19.2;
  const riderS = 2.0;
  const popEnd = splat + 0.5;
  const settle = popEnd + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < tBonk) return;
    if (t < tipAt) {
      f.rider.pose = 'dizzy';
      f.rider.face = 'dizzy';
      return;
    }
    if (t < splat) {
      const u = (t - tipAt) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, s0.y + 0.7, u),
        lerp(s0.s, riderS, u),
        lerp(s0.pitch, 0.4, u),
        lerp(s0.roll, 0.6, u),
        0,
        u < 0.7 ? 'flail' : 'float',
        'dizzy',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), riderS, 0.4, 0.6, 0, 'float', 'dizzy');
  };
  return {
    duration: settle + 1.0,
    word: 'BOULDER BONK!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [boulderLandAt(0), 'bigSplash', BOULDERS.list[0].d, 0.3, BOULDERS.list[0].s],
      [boulderLandAt(0), 'sfx:splash', BOULDERS.list[0].d, 0, BOULDERS.list[0].s],
      [tBonk, 'sfx:bump', BONK.d, 2.2, BONK.s],
      [tBonk, 'stars', BONK.d, 2.8, BONK.s],
      [tBonk + 0.05, 'sfx:slideWhistle', BONK.d, 2, BONK.s],
      ...trail(tBonk + 0.3, tipAt - 0.1, 0.25, 'stars', rider, 1.0),
      ...[2, 3].map(
        (i) =>
          [boulderLandAt(i), 'bigSplash', BOULDERS.list[i].d, 0.3, BOULDERS.list[i].s] as const,
      ),
      [tipAt, 'splash', ski(tipAt).d, 0.2, ski(tipAt).s],
      [splat, 'bigSplash', riderD, 0.2, riderS],
      [splat, 'sfx:splat', riderD, 0, riderS],
      [splat, 'sfx:splash', riderD, 0, riderS],
      [splat, 'groan', riderD, 1, riderS],
      [splat + 0.1, 'word', riderD, 3.2, riderS],
      [popEnd, 'drips', riderD, 0.6, riderS],
    ],
  };
})();

// ---------- Element 3: the steam geyser ----------

/** The geyser: a jet of steam the ski rides up from the foot to the crown, then the finale. */
export const GEYSER = { foot: 8, crownD: 15.5, crownY: 8.6 };

/** Height of the steam jet's riding surface at `d` (from the foot to the crown). */
export function geyserY(d: number): number {
  const u = Math.min(Math.max((d - GEYSER.foot) / (GEYSER.crownD - GEYSER.foot), 0), 1);
  return GEYSER.crownY * u ** 1.35;
}

const T_FOOT3 = GEYSER.foot / SPEED;
const T_CROWN3 = T_FOOT3 + 0.72;
const AIR3 = 2.4;
const LAND3 = 44;
const T_LAND3 = T_CROWN3 + AIR3;
const LENGTH3 = 50;

/** The jet's height as a fraction of full: it shoots up before the ski arrives. */
export const geyserRise = track([
  [0, 0],
  [0.5, 1, 'o'],
]);

const geyserClimb = (t: number, f: Frame) => {
  const k = f.ski;
  const u = Math.min(Math.max((t - T_FOOT3) / (T_CROWN3 - T_FOOT3), 0), 1);
  k.d = lerp(GEYSER.foot, GEYSER.crownD, u);
  k.y = geyserY(k.d);
  k.pitch = Math.atan(
    slopeAt(geyserY, Math.min(Math.max(k.d, GEYSER.foot + 0.05), GEYSER.crownD - 0.05)),
  );
  k.wet = false;
};

const geyserClear: Def = (() => {
  const lipPitch = Math.atan(slopeAt(geyserY, GEYSER.crownD - 0.05));
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t < T_FOOT3) {
      k.d = SPEED * t;
      k.y = 0;
      f.rider.pose = 'ride';
    } else if (t <= T_CROWN3) {
      geyserClimb(t, f);
      f.rider.pose = 'ride';
    } else if (t < T_LAND3) {
      const u = (t - T_CROWN3) / AIR3;
      k.d = lerp(GEYSER.crownD, LAND3, u);
      k.y = arc(GEYSER.crownY, 0, 13.2, u);
      k.pitch = (1 - smooth(u / 0.14)) * lipPitch;
      k.roll = 2 * TAU * flipEase((u - 0.06) / 0.86);
      k.s = 1.3 * Math.sin(TAU * u);
      k.wet = false;
      f.rider.pose = u > 0.92 ? 'armsUp' : u > 0.06 ? 'tuck' : 'fistPump';
    } else {
      k.d = Math.min(LAND3 + SPEED * (t - T_LAND3), LENGTH3);
      k.y = 0;
      k.roll = 2 * TAU;
      f.rider.pose = 'ride';
    }
  };
  const mid = T_CROWN3 + AIR3 / 2;
  return {
    duration: T_LAND3 + (LENGTH3 - LAND3) / SPEED,
    length: LENGTH3,
    word: 'DOUBLE CORKSCREW!',
    slow: [mid],
    at,
    events: () => [
      [T_FOOT3 - 0.3, 'sfx:whoosh', GEYSER.foot - 3, 0.5],
      [T_FOOT3, 'bigSplash', GEYSER.foot, 0.2],
      [T_CROWN3, 'sfx:boing', GEYSER.crownD, GEYSER.crownY],
      [T_CROWN3, 'spray', GEYSER.crownD, GEYSER.crownY],
      [mid, 'word', lerp(GEYSER.crownD, LAND3, 0.5), 15.2],
      [T_LAND3, 'bigSplash', LAND3, 0],
      [T_LAND3, 'sfx:splash', LAND3, 0],
      [T_LAND3 + 0.15, 'cheer', LAND3 + 2, 1],
      [T_LAND3 + 0.15, 'confetti', LAND3 + 3, 2],
    ],
  };
})();

/**
 * The fail: the geyser surges and shoots the rider up; the ski tumbles down on its own while he
 * opens a seaweed parachute and drifts down.
 */
export const CHUTE = {
  shotAt: T_CROWN3,
  peakAt: T_CROWN3 + 0.75,
  landAt: T_CROWN3 + 0.75 + 2.1,
  peakY: 11,
  /** The jet surges higher than the crown for a moment. */
  surge: 1.35,
};

const geyserFail: Def = (() => {
  const { shotAt, peakAt, landAt, peakY } = CHUTE;
  const skiLandD = 21;
  const skiFly = 1.5;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t < T_FOOT3) {
      k.d = SPEED * t;
      k.y = 0;
    } else if (t <= shotAt) {
      geyserClimb(t, f);
    } else if (t < shotAt + skiFly) {
      const u = (t - shotAt) / skiFly;
      k.d = lerp(GEYSER.crownD, skiLandD, u);
      k.y = arc(GEYSER.crownY, 0, 7.4, u);
      k.pitch = lerp(1.0, 0, smooth(u / 0.5));
      k.roll = 2 * TAU * flipEase(u);
      k.wet = false;
    } else {
      k.d = skiLandD + 1.2 * prog(t, shotAt + skiFly, shotAt + skiFly + 0.8, 'o');
      k.y = 0;
      k.roll = 2 * TAU;
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, shotAt);
  const driftD = 17;
  const landD = 25.5;
  const riderS = 0.9;
  const popEnd = landAt + 0.5;
  const settle = popEnd + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < shotAt) return;
    if (t < peakAt) {
      const u = prog(t, shotAt, peakAt, 'o');
      setFree(
        f,
        lerp(s0.d, driftD, u),
        lerp(s0.y, peakY, u),
        lerp(s0.s, riderS, u),
        lerp(s0.pitch, -TAU, u),
        0,
        0,
        'flail',
        'scared',
      );
      return;
    }
    if (t < landAt) {
      const u = (t - peakAt) / (landAt - peakAt);
      setFree(
        f,
        lerp(driftD, landD, smooth(u)),
        lerp(peakY, FLAT_Y, u),
        lerp(riderS, riderS + 1.2, u),
        -TAU,
        0.12 * Math.sin(4 * (t - peakAt)),
        0,
        'armsUp',
        'happy',
      );
      return;
    }
    const up = prog(t, landAt, popEnd, 'o');
    setFree(f, landD, lerp(FLAT_Y, FLOAT_Y, up), riderS + 1.2, -TAU, 0, 0, 'float', 'soaked');
    f.rider.props.seaweed = true;
  };
  return {
    duration: settle + 1.0,
    word: 'UP AND AWAY!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (_ski, rider) => [
      [T_FOOT3 - 0.3, 'sfx:whoosh', GEYSER.foot - 3, 0.5],
      [T_FOOT3, 'bigSplash', GEYSER.foot, 0.2],
      [shotAt, 'sfx:slideWhistle', GEYSER.crownD, GEYSER.crownY],
      [shotAt, 'bigSplash', GEYSER.crownD, GEYSER.crownY],
      [shotAt, 'spray', GEYSER.crownD, GEYSER.crownY + 1],
      [peakAt, 'sfx:boing', driftD, peakY],
      ...trail(peakAt + 0.3, landAt - 0.3, 0.4, 'drips', rider),
      [shotAt + skiFly, 'splash', skiLandD, 0.1],
      [shotAt + skiFly, 'sfx:splash', skiLandD, 0],
      [landAt, 'bigSplash', landD, 0.2, riderS + 1.2],
      [landAt, 'sfx:splat', landD, 0, riderS + 1.2],
      [landAt, 'sfx:splash', landD, 0, riderS + 1.2],
      [landAt, 'groan', landD, 1, riderS + 1.2],
      [landAt + 0.1, 'word', landD, 3.2, riderS + 1.2],
      [popEnd, 'drips', landD, 0.6, riderS + 1.2],
    ],
  };
})();

export const GEYSER_BLAST: MegaSpec = {
  id: 'geyser-blast',
  title: 'Geyser Blast',
  emoji: '🌋',
  elements: [
    {
      name: 'Lava Rock Arch',
      length: LENGTH1,
      floorY: -1.2,
      cue: { d: 8, y: 1.0 },
      anchor: { d: 15, y: LAVA.crownY },
      extent: [6, 24],
      clear: lavaClear,
      fail: lavaFail,
    },
    {
      name: 'Coconut Boulders',
      length: LENGTH2,
      floorY: -1.2,
      cue: { d: 6, y: 0.6 },
      anchor: { d: 22, y: 2.0 },
      extent: [13, 31],
      clear: boulderClear,
      fail: boulderFail,
    },
    {
      name: 'Steam Geyser',
      length: LENGTH3,
      floorY: -1.2,
      cue: { d: 8, y: 0.6 },
      anchor: { d: (GEYSER.foot + GEYSER.crownD) / 2, y: GEYSER.crownY / 2 },
      extent: [GEYSER.foot, GEYSER.crownD],
      clear: geyserClear,
      fail: geyserFail,
    },
  ],
};
