/**
 * Mega course 3, Iceberg Bay's Penguin Parade: hop a row of penguins on an ice floe, slide up an
 * iceberg and down its icy chute, then fly through a giant ice arch in a spin. Pure animation data
 * like `harbour-havoc.ts`: element-local coordinates, `d` = 0 at the element's entry line, `y` up
 * from the water, `s` sideways (+ is the rider's right).
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

// ---------- Element 1: the penguin floe ----------

/** The floe: a short ramp up to a flat shelf of ice with a row of penguins down its middle line. */
export const FLOE = {
  foot: 5,
  lip: 11,
  deckY: 1.3,
  end: 29,
  halfWidth: 3.4,
  /** The penguins stand in a row on the middle line: their d. */
  penguins: [15.5, 17.5, 19.5, 21.5, 23.5] as readonly number[],
  penguinHeight: 1.45,
};

/** Height of the floe's ramp and shelf on the middle line at `d`. */
export function floeY(d: number): number {
  const { foot, lip, deckY, end } = FLOE;
  if (d <= foot) return 0;
  if (d <= lip) return deckY * ((d - foot) / (lip - foot)) ** 1.4;
  return d <= end ? deckY : 0;
}

const T_LIP1 = FLOE.lip / SPEED;
const LENGTH1 = 40;
const floeLipPitch = Math.atan(slopeAt(floeY, FLOE.lip - 0.02));

const floeRide = (t: number, f: Frame) => {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = floeY(k.d);
  k.pitch = Math.atan(slopeAt(floeY, Math.min(k.d, FLOE.lip - 0.02)));
  k.wet = k.d < FLOE.foot;
};

const floeClear: Def = (() => {
  const air = 1.85;
  const land = 33;
  const tLand = T_LIP1 + air;
  const peak = 5.2;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP1) {
      floeRide(t, f);
      f.rider.pose = 'ride';
    } else if (t < tLand) {
      const u = (t - T_LIP1) / air;
      k.d = lerp(FLOE.lip, land, u);
      k.y = arc(FLOE.deckY, 0, peak, u);
      k.pitch = floeLipPitch * (1 - prog(u, 0, 0.4)) + 0.2 * Math.sin(TAU * u);
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
    word: 'PENGUIN HOP!',
    at,
    events: () => [
      [T_LIP1 - 0.2, 'sfx:whoosh', FLOE.lip - 2, FLOE.deckY],
      [T_LIP1, 'spray', FLOE.lip, FLOE.deckY],
      [T_LIP1, 'sfx:boing', FLOE.lip, FLOE.deckY],
      [mid, 'word', lerp(FLOE.lip, land, 0.5), 7.0],
      [tLand, 'splash', land, 0],
      [tLand, 'sfx:splash', land, 0],
      [tLand + 0.2, 'cheer', land + 2, 1],
    ],
  };
})();

/** The fail: a feeble hop onto the first penguins, who bump the ski one way and the rider the other. */
export const BUMP = { hop: 0.3, landD: FLOE.lip + SPEED * 0.3, at: T_LIP1 + 0.3 + 0.12 };

const floeFail: Def = (() => {
  const { landD, at: tBump } = BUMP;
  const tLand = T_LIP1 + BUMP.hop;
  const skiEndD = 19.5;
  const skiEndS = -4.2;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP1) {
      floeRide(t, f);
    } else if (t < tLand) {
      const u = (t - T_LIP1) / BUMP.hop;
      k.d = lerp(FLOE.lip, landD, u);
      k.y = arc(FLOE.deckY, FLOE.deckY, FLOE.deckY + 0.55, u);
      k.pitch = floeLipPitch * (1 - smooth(u));
      k.wet = false;
    } else if (t < tBump) {
      k.d = landD + 1.2 * (t - tLand);
      k.y = FLOE.deckY;
      k.wet = false;
    } else {
      const u = prog(t, tBump, tBump + 1.0, 'o');
      k.d = lerp(landD + 0.15, skiEndD, u);
      k.s = lerp(0, skiEndS, prog(t, tBump, tBump + 1.0, 'q'));
      k.y = lerp(FLOE.deckY, 0, prog(Math.abs(k.s), 3.0, 4.0, 'l'));
      k.yaw = 1.6 * u;
      k.roll = PI * prog(t, tBump + 0.3, tBump + 1.0);
      k.wet = t > tBump + 0.9;
    }
  };
  const s0 = seatAtTime(skiAt, tBump);
  const flyT = 1.1;
  const splat = tBump + flyT;
  const riderD = 18.5;
  const riderS = 4.4;
  const popEnd = splat + 0.5;
  const settle = Math.max(popEnd, tBump + 1.0) + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < tBump) {
      if (t >= tLand) f.rider.face = 'scared';
      return;
    }
    if (t < splat) {
      const u = (t - tBump) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, 4.2, u),
        lerp(s0.s, riderS, u),
        lerp(s0.pitch, -2 * TAU, flipEase(u)),
        0,
        0,
        u < 0.2 ? 'flail' : u < 0.85 ? 'tuck' : 'float',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), riderS, -2 * TAU, 0, 0, 'float', 'soaked');
  };
  return {
    duration: settle + 1.0,
    word: 'PENGUIN BUMP!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [T_LIP1 - 0.2, 'sfx:whoosh', FLOE.lip - 2, FLOE.deckY],
      [T_LIP1, 'spray', FLOE.lip, FLOE.deckY],
      [tLand, 'sfx:bump', landD, FLOE.deckY + 1],
      [tBump, 'sfx:boing', landD + 1, FLOE.deckY + 1],
      [tBump, 'stars', landD + 1, FLOE.deckY + 2.2],
      [tBump + 0.1, 'sfx:slideWhistle', landD + 2, 3],
      ...trail(tBump + 0.3, splat - 0.2, 0.3, 'drips', rider),
      [tBump + 0.85, 'splash', ski(tBump + 0.85).d, 0.2, ski(tBump + 0.85).s],
      [splat, 'bigSplash', riderD, 0.2, riderS],
      [splat, 'sfx:splat', riderD, 0, riderS],
      [splat, 'sfx:splash', riderD, 0, riderS],
      [splat, 'groan', riderD, 1, riderS],
      [splat + 0.1, 'word', riderD, 3.2, riderS],
      [popEnd, 'drips', riderD, 0.6, riderS],
    ],
  };
})();

// ---------- Element 2: the iceberg and its chute ----------

/** The iceberg: a smooth climb to the summit, then a long icy chute down to a low lip. */
export const BERG = {
  foot: 4,
  summit: 16,
  chuteEnd: 31,
  summitY: 4.4,
  lipY: 0.9,
  halfWidth: 2.6,
  /** The snow bank beside the chute's foot that the wipeout ploughs into. */
  bank: { d: 26.5, s: 3.6 },
};

/** Height of the iceberg's riding surface on the middle line at `d`. */
export function bergY(d: number): number {
  const { foot, summit, chuteEnd, summitY, lipY } = BERG;
  if (d <= foot) return 0;
  if (d <= summit) return summitY * smooth((d - foot) / (summit - foot));
  if (d <= chuteEnd) return lerp(summitY, lipY, smooth((d - summit) / (chuteEnd - summit)));
  return 0;
}

const T_SUMMIT = BERG.summit / SPEED;
const T_CHUTE_END = BERG.chuteEnd / SPEED;
const LENGTH2 = 44;

const bergPitch = (d: number) =>
  Math.atan(slopeAt(bergY, Math.min(Math.max(d, BERG.foot + 0.02), BERG.chuteEnd - 0.02)));

const bergRide = (t: number, f: Frame) => {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = bergY(k.d);
  k.pitch = bergPitch(k.d);
  k.wet = k.d < BERG.foot;
};

const bergClear: Def = (() => {
  const air = 0.62;
  const land = 38.4;
  const tLand = T_CHUTE_END + air;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_CHUTE_END) {
      bergRide(t, f);
      f.rider.pose = t < T_SUMMIT - 0.4 ? 'ride' : 'armsUp';
    } else if (t < tLand) {
      const u = (t - T_CHUTE_END) / air;
      k.d = lerp(BERG.chuteEnd, land, u);
      k.y = arc(BERG.lipY, 0, BERG.lipY + 1.7, u);
      k.pitch = 0.2 * Math.sin(TAU * u);
      k.wet = false;
      f.rider.pose = 'fistPump';
    } else {
      k.d = Math.min(land + SPEED * (t - tLand), LENGTH2);
      k.y = 0;
      f.rider.pose = 'ride';
    }
  };
  const mid = (T_SUMMIT + T_CHUTE_END) / 2;
  return {
    duration: tLand + (LENGTH2 - land) / SPEED,
    length: LENGTH2,
    word: 'ICE SLIDE!',
    at,
    events: (ski) => [
      [T_SUMMIT - 1.0, 'sfx:whoosh', BERG.summit - 8, 3],
      [T_SUMMIT, 'sfx:boing', BERG.summit, BERG.summitY],
      ...trail(T_SUMMIT + 0.1, T_CHUTE_END - 0.1, 0.14, 'spray', ski, 0.1),
      [mid, 'word', ski(mid).d, 6.0],
      [tLand, 'splash', land, 0],
      [tLand, 'sfx:splash', land, 0],
      [tLand + 0.2, 'cheer', land + 2, 1],
    ],
  };
})();

/** The fail: the ski skids off the chute and ploughs into the snow bank beside its foot. */
export const SKID = { startAt: 1.95, hitAt: 2.5 };

const bergFail: Def = (() => {
  const { startAt, hitAt } = SKID;
  const { bank } = BERG;
  const startD = SPEED * startAt;
  const hitD = bank.d;
  const hitS = bank.s - 0.5;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= startAt) {
      bergRide(t, f);
    } else if (t <= hitAt) {
      const u = prog(t, startAt, hitAt, 'l');
      k.d = lerp(startD, hitD, prog(t, startAt, hitAt, 'o'));
      k.s = lerp(0, hitS, prog(t, startAt, hitAt, 'io'));
      k.y = lerp(bergY(k.d), 0.25, prog(Math.abs(k.s), 1.4, 2.8, 'l'));
      k.pitch = bergPitch(k.d) * (1 - u);
      k.yaw = -0.8 * u;
      k.roll = 0.5 * u;
      k.wet = false;
    } else {
      const u = prog(t, hitAt, hitAt + 0.5, 'o');
      k.d = lerp(hitD, hitD + 0.8, u);
      k.s = lerp(hitS, hitS + 0.35, u);
      k.y = lerp(0.25, 0.35, u);
      k.pitch = 0.55 * u;
      k.yaw = lerp(-0.8, -0.5, u);
      k.roll = lerp(0.5, 0.35, u);
      k.wet = false;
    }
  };
  const s0 = seatAtTime(skiAt, hitAt);
  const flyT = 1.0;
  const splat = hitAt + flyT;
  const riderD = 32.5;
  const riderS = -2.2;
  const popEnd = splat + 0.5;
  const settle = popEnd + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < startAt) return;
    if (t < hitAt) {
      f.rider.face = 'scared';
      f.rider.pose = 'flail';
      return;
    }
    if (t < splat) {
      const u = (t - hitAt) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, 4.6, u),
        lerp(s0.s, riderS, u),
        lerp(s0.pitch, -2 * TAU, flipEase(u)),
        0,
        0,
        u < 0.2 ? 'flail' : u < 0.85 ? 'tuck' : 'float',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), riderS, -2 * TAU, 0, 0, 'float', 'soaked');
  };
  return {
    duration: settle + 1.0,
    word: 'SNOW BANK!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [T_SUMMIT - 1.0, 'sfx:whoosh', BERG.summit - 8, 3],
      [T_SUMMIT, 'sfx:boing', BERG.summit, BERG.summitY],
      ...trail(T_SUMMIT + 0.1, startAt - 0.1, 0.14, 'spray', ski, 0.1),
      [startAt, 'sfx:slideWhistle', startD, bergY(startD) + 1],
      [hitAt, 'sfx:bump', hitD, 1.2, hitS],
      [hitAt, 'bigSplash', hitD, 1.2, hitS],
      [hitAt, 'stars', hitD, 2.6, hitS],
      ...trail(hitAt + 0.3, splat - 0.2, 0.3, 'drips', rider),
      [splat, 'bigSplash', riderD, 0.2, riderS],
      [splat, 'sfx:splat', riderD, 0, riderS],
      [splat, 'sfx:splash', riderD, 0, riderS],
      [splat, 'groan', riderD, 1, riderS],
      [splat + 0.1, 'word', riderD, 3.2, riderS],
      [popEnd, 'drips', riderD, 0.6, riderS],
    ],
  };
})();

// ---------- Element 3: the giant ice arch ----------

/** The arch stands across the course with the ski's flight path through its opening. */
export const ARCH = {
  d: 26,
  /** The opening is a half circle of this radius, its centre `cy` up from the water. */
  radius: 4.2,
  cy: 3.6,
  thick: 0.95,
  /** The ice ramp the ski launches off. */
  rampFoot: 5,
  lip: 13,
  lipY: 2.6,
  rampHalfWidth: 2.2,
};

/** Height of the ramp on the middle line at `d`. */
export function rampY(d: number): number {
  if (d <= ARCH.rampFoot) return 0;
  return d <= ARCH.lip ? ARCH.lipY * ((d - ARCH.rampFoot) / (ARCH.lip - ARCH.rampFoot)) ** 1.5 : 0;
}

const T_LIP3 = ARCH.lip / SPEED;
const LENGTH3 = 48;
const rampLipPitch = Math.atan(slopeAt(rampY, ARCH.lip - 0.02));

const rampRide = (t: number, f: Frame) => {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = rampY(k.d);
  k.pitch = Math.atan(slopeAt(rampY, Math.min(k.d, ARCH.lip - 0.02)));
  k.wet = k.d < ARCH.rampFoot;
};

const archClear: Def = (() => {
  const air = 2.4;
  const land = 42;
  const tLand = T_LIP3 + air;
  const peak = 5.6;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP3) {
      rampRide(t, f);
      f.rider.pose = 'ride';
    } else if (t < tLand) {
      const u = (t - T_LIP3) / air;
      k.d = lerp(ARCH.lip, land, u);
      k.y = arc(ARCH.lipY, 0, peak, u);
      k.pitch = rampLipPitch * (1 - prog(u, 0, 0.35)) + 0.12 * Math.sin(TAU * u);
      k.roll = 2 * TAU * flipEase((u - 0.1) / 0.8);
      k.wet = false;
      f.rider.pose = u > 0.9 ? 'armsUp' : u > 0.1 ? 'tuck' : 'fistPump';
    } else {
      k.d = Math.min(land + SPEED * (t - tLand), LENGTH3);
      k.y = 0;
      k.roll = 2 * TAU;
      f.rider.pose = 'ride';
    }
  };
  const mid = T_LIP3 + air * 0.45;
  return {
    duration: tLand + (LENGTH3 - land) / SPEED,
    length: LENGTH3,
    word: 'ARCH SPIN!',
    slow: [mid],
    at,
    events: () => [
      [T_LIP3 - 0.3, 'sfx:whoosh', ARCH.lip - 3, 1],
      [T_LIP3, 'sfx:boing', ARCH.lip, ARCH.lipY],
      [T_LIP3, 'spray', ARCH.lip, ARCH.lipY],
      [mid, 'word', ARCH.d, 7.4],
      [tLand, 'bigSplash', land, 0],
      [tLand, 'sfx:splash', land, 0],
      [tLand + 0.15, 'cheer', land + 2, 1],
      [tLand + 0.15, 'confetti', land + 3, 2],
    ],
  };
})();

/** The fail: a weak leap, then the arch's frost freezes the rider into an ice cube. */
export const FREEZE = {
  landD: 19,
  /** When the frost hits (the ski is under the arch) and how long the frozen rider stays seated. */
  at: T_LIP3 + 0.55 + (ARCH.d - 19) / SPEED,
  hold: 0.9,
};

const archFail: Def = (() => {
  const hop = 0.55;
  const tLand = T_LIP3 + hop;
  const { landD, at: tFreeze, hold } = FREEZE;
  const tOff = tFreeze + hold;
  const skiEnd = 30;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP3) {
      rampRide(t, f);
    } else if (t < tLand) {
      const u = (t - T_LIP3) / hop;
      k.d = lerp(ARCH.lip, landD, u);
      k.y = arc(ARCH.lipY, 0, 3.4, u);
      k.pitch = rampLipPitch * (1 - prog(u, 0, 0.5)) - 0.15 * prog(u, 0.6, 1);
      k.wet = false;
    } else if (t < tFreeze) {
      k.d = landD + SPEED * (t - tLand);
      k.y = 0;
      k.pitch = -0.15 * (1 - prog(t, tLand, tLand + 0.4));
      k.wet = true;
    } else {
      const slow = prog(t, tFreeze, tFreeze + 1.3, 'o');
      k.d = lerp(ARCH.d, skiEnd, slow);
      k.y = 0;
      k.roll = 0.1 * Math.sin((t - tFreeze) * 9) * (1 - slow);
      k.yaw = -0.5 * prog(t, tOff, tOff + 0.9, 'o');
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, tOff);
  const flyT = 0.8;
  const splat = tOff + flyT;
  const riderD = 32;
  const riderS = 1.8;
  const popEnd = splat + 0.5;
  const settle = Math.max(popEnd, tOff + 1.3) + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < tFreeze) {
      if (t >= tLand) f.rider.face = 'scared';
      return;
    }
    if (t < tOff) {
      // Frozen stiff on the seat, arms up.
      f.rider.pose = 'flail';
      f.rider.face = 'scared';
      return;
    }
    if (t < splat) {
      const u = (t - tOff) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, s0.y + 1.8, u),
        lerp(s0.s, riderS, u),
        lerp(s0.pitch, -TAU, flipEase(u)),
        0,
        0,
        'tuck',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), riderS, -TAU, 0, 0, 'float', 'scared');
  };
  return {
    duration: settle + 1.0,
    word: 'ICE CUBE!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [T_LIP3 - 0.3, 'sfx:whoosh', ARCH.lip - 3, 1],
      [T_LIP3, 'spray', ARCH.lip, ARCH.lipY],
      [tLand, 'splash', landD, 0.1],
      [tLand, 'sfx:bump', landD, 0.5],
      [tFreeze, 'sfx:slideWhistle', ARCH.d, 3],
      [tFreeze, 'stars', ski(tFreeze).d, 2.6],
      [tFreeze + 0.15, 'stars', ski(tFreeze).d + 0.6, 2.2],
      ...trail(tOff + 0.1, splat - 0.1, 0.25, 'drips', rider),
      [splat, 'bigSplash', riderD, 0.2, riderS],
      [splat, 'sfx:splat', riderD, 0, riderS],
      [splat, 'sfx:splash', riderD, 0, riderS],
      [splat, 'groan', riderD, 1, riderS],
      [splat + 0.1, 'word', riderD, 3.2, riderS],
      [popEnd, 'drips', riderD, 0.6, riderS],
    ],
  };
})();

export const PENGUIN_PARADE: MegaSpec = {
  id: 'penguin-parade',
  title: 'Penguin Parade',
  emoji: '🐧',
  elements: [
    {
      name: 'Penguin Floe',
      length: LENGTH1,
      floorY: -1.2,
      cue: { d: 8, y: 1.0 },
      anchor: { d: 19.5, y: FLOE.deckY },
      extent: [11, 28],
      clear: floeClear,
      fail: floeFail,
    },
    {
      name: 'Iceberg Slide',
      length: LENGTH2,
      floorY: -1.2,
      cue: { d: 6, y: 0.8 },
      anchor: { d: 16, y: BERG.summitY },
      extent: [7, 25],
      clear: bergClear,
      fail: bergFail,
    },
    {
      name: 'Giant Ice Arch',
      length: LENGTH3,
      floorY: -1.2,
      cue: { d: 8, y: 0.8 },
      anchor: { d: ARCH.d, y: ARCH.cy + 1 },
      extent: [18, 34],
      clear: archClear,
      fail: archFail,
    },
  ],
};
