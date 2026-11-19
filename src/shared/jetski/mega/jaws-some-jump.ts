/**
 * Mega course 5, Shark Reef's Jaws-Some Jump: jump a goofy shark in sunglasses (who plays fetch with
 * the ski if you miss), carve through the curl of a giant wave, then launch off a pirate ship's plank
 * through two holes in its sails into a double backflip. Pure animation data like
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
const PI = Math.PI;

// ---------- Element 1: the shark in sunglasses ----------

/** The shark lies along the middle line, nose towards the ski, dorsal fin on its back. */
export const SHARK = {
  nose: 13,
  centerD: 18.5,
  /** Half its length (nose to tail is twice this). */
  half: 5.5,
  backY: 1.7,
  finD: 19.5,
  finTop: 3.1,
  halfWidth: 1.8,
  /** The foam ramp the ski launches off. */
  rampFoot: 4,
  lip: 10,
  lipY: 2.0,
};

/** Height of the foam ramp on the middle line at `d`. */
export function rampY(d: number): number {
  if (d <= SHARK.rampFoot) return 0;
  return d <= SHARK.lip
    ? SHARK.lipY * ((d - SHARK.rampFoot) / (SHARK.lip - SHARK.rampFoot)) ** 1.5
    : 0;
}

const T_LIP1 = SHARK.lip / SPEED;
const LENGTH1 = 40;
const rampLipPitch = Math.atan(slopeAt(rampY, SHARK.lip - 0.02));

const rampRide = (t: number, f: Frame) => {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = rampY(k.d);
  k.pitch = Math.atan(slopeAt(rampY, Math.min(k.d, SHARK.lip - 0.02)));
  k.wet = k.d < SHARK.rampFoot;
};

const sharkClear: Def = (() => {
  const air = 1.875;
  const land = 32.5;
  const tLand = T_LIP1 + air;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP1) {
      rampRide(t, f);
      f.rider.pose = 'ride';
    } else if (t < tLand) {
      const u = (t - T_LIP1) / air;
      k.d = lerp(SHARK.lip, land, u);
      k.y = arc(SHARK.lipY, 0, 6.2, u);
      k.pitch = rampLipPitch * (1 - prog(u, 0, 0.4)) + 0.2 * Math.sin(TAU * u);
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
    word: 'SHARK JUMP!',
    at,
    events: () => [
      [T_LIP1 - 0.2, 'sfx:whoosh', SHARK.lip - 2, SHARK.lipY],
      [T_LIP1, 'spray', SHARK.lip, SHARK.lipY],
      [T_LIP1, 'sfx:boing', SHARK.lip, SHARK.lipY],
      [mid, 'word', lerp(SHARK.lip, land, 0.5), 8.0],
      [tLand, 'splash', land, 0],
      [tLand, 'sfx:splash', land, 0],
      [tLand + 0.2, 'cheer', land + 2, 1],
    ],
  };
})();

/** The fail: the shark leaps, catches the ski in its jaws, shakes it about and tosses it away. */
export const FETCH = {
  catchAt: T_LIP1 + 0.3,
  tossAt: T_LIP1 + 0.3 + 0.9,
  /** Where the tossed ski comes down, and where the rider is flung. */
  skiLand: [25, -2.6] as const,
  riderLand: [21.5, 3.0] as const,
};

/** How the shark moves: lifted up out of the water, nose up, swinging its head. */
export interface SharkPose {
  lift: number;
  pitch: number;
  yaw: number;
  roll: number;
}

/** The shark's pose at time `t` of the element: still when the ski jumps it, a leap when it fetches. */
export function sharkPose(outcome: 'clear' | 'fail', t: number): SharkPose {
  if (outcome === 'clear') return { lift: 0, pitch: 0, yaw: 0, roll: 0 };
  const { catchAt, tossAt } = FETCH;
  const up = prog(t, catchAt - 0.3, catchAt, 'o') * (1 - prog(t, tossAt, tossAt + 0.8));
  const thrash = Math.sin(14 * (t - catchAt)) * prog(t, catchAt, catchAt + 0.1) * up;
  return { lift: 1.3 * up, pitch: 0.4 * up, yaw: 0.3 * thrash, roll: 0.12 * thrash };
}

/** Where the shark's jaws are (what the ski is held by). */
export function sharkMouth(
  outcome: 'clear' | 'fail',
  t: number,
): { d: number; y: number; s: number } {
  const p = sharkPose(outcome, t);
  return {
    d: SHARK.centerD - SHARK.half * Math.cos(p.pitch) * Math.cos(p.yaw),
    y: 0.25 + p.lift + SHARK.half * Math.sin(p.pitch) + 0.7,
    s: SHARK.half * Math.sin(p.yaw) * Math.cos(p.pitch),
  };
}

const sharkFail: Def = (() => {
  const { catchAt, tossAt, skiLand, riderLand } = FETCH;
  const [skiD, skiS] = skiLand;
  const tLand = tossAt + 1.2;
  const mouthAt = (t: number) => sharkMouth('fail', t);
  const m0 = mouthAt(catchAt);
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP1) {
      rampRide(t, f);
    } else if (t < catchAt) {
      const u = (t - T_LIP1) / (catchAt - T_LIP1);
      k.d = lerp(SHARK.lip, m0.d + 0.4, u);
      k.y = arc(SHARK.lipY, m0.y, 3.6, u);
      k.pitch = rampLipPitch * (1 - prog(u, 0, 0.5)) + 0.5 * prog(u, 0.5, 1);
      k.wet = false;
    } else if (t < tossAt) {
      // Held in the jaws and shaken about like a fetch toy.
      const m = mouthAt(t);
      const p = sharkPose('fail', t);
      k.d = m.d + 0.4;
      k.y = m.y;
      k.s = m.s;
      k.pitch = 0.5 + p.pitch;
      k.yaw = p.yaw * 2 * (1 - prog(t, tossAt - 0.2, tossAt));
      k.roll = 0.5 * Math.sin(14 * (t - catchAt)) * (1 - prog(t, tossAt - 0.2, tossAt));
      k.wet = false;
    } else if (t < tLand) {
      const m = mouthAt(tossAt);
      const u = (t - tossAt) / (tLand - tossAt);
      k.d = lerp(m.d + 0.4, skiD, u);
      k.s = lerp(m.s, skiS, u);
      k.y = arc(m.y, 0, 7.5, u);
      k.pitch = lerp(0.5 + sharkPose('fail', tossAt).pitch, 0, smooth(u));
      k.roll = 3 * TAU * flipEase(u);
      k.wet = false;
    } else {
      const u = prog(t, tLand, tLand + 0.8, 'o');
      k.d = skiD + 1.0 * u;
      k.s = skiS - 0.5 * u;
      k.y = 0;
      k.roll = 3 * TAU;
      k.wet = true;
    }
  };
  const tFree = catchAt + 0.02;
  const s0 = seatAtTime(skiAt, tFree);
  const [riderD, riderS] = riderLand;
  const flyT = 1.3;
  const splat = tFree + flyT;
  const popEnd = splat + 0.5;
  const settle = Math.max(popEnd, tLand + 0.8) + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < tFree) {
      if (t > T_LIP1) f.rider.face = 'scared';
      return;
    }
    if (t < splat) {
      const u = (t - tFree) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, 6.0, u),
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
    word: 'SHARK FETCH!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (_ski, rider) => [
      [T_LIP1 - 0.2, 'sfx:whoosh', SHARK.lip - 2, SHARK.lipY],
      [T_LIP1, 'spray', SHARK.lip, SHARK.lipY],
      [catchAt - 0.3, 'bigSplash', SHARK.nose + 1, 0.3],
      [catchAt, 'sfx:bump', m0.d, m0.y],
      [catchAt, 'stars', m0.d, m0.y + 1.2],
      [catchAt + 0.1, 'sfx:slideWhistle', m0.d + 2, m0.y + 1],
      ...trail(catchAt + 0.2, tossAt - 0.1, 0.25, 'drips', (t) => mouthAt(t), 0.2),
      [tossAt, 'sfx:boing', m0.d, m0.y],
      ...trail(tFree + 0.4, splat - 0.2, 0.3, 'drips', rider),
      [tLand, 'bigSplash', skiD, 0.2, skiS],
      [tLand, 'sfx:splash', skiD, 0, skiS],
      [splat, 'bigSplash', riderD, 0.2, riderS],
      [splat, 'sfx:splat', riderD, 0, riderS],
      [splat, 'sfx:splash', riderD, 0, riderS],
      [splat, 'groan', riderD, 1, riderS],
      [splat + 0.1, 'word', riderD, 3.2, riderS],
      [popEnd, 'drips', riderD, 0.6, riderS],
    ],
  };
})();

// ---------- Element 2: the giant wave's curl ----------

/** The wave: a barrel along the course, open to the right, its crest curling over from the left. */
export const WAVE = {
  from: 10,
  to: 31,
  radius: 3.6,
  /** The barrel's axis is this far to the right of the middle line. */
  axisS: 0.4,
  /** The shell covers these angles round the axis (degrees up from the right-hand side). */
  lipAngle: 50,
  bottomAngle: 270,
};

/** The ski's side path through the barrel, as a function of time. */
const carve = track([
  [0, 0],
  [9 / SPEED, 0],
  [14 / SPEED, -1.4],
  [20 / SPEED, 0.3],
  [25 / SPEED, -1.2],
  [30 / SPEED, 0],
]);
const LENGTH2 = 40;

/** Rides the carve: up the left wall and back, leaning into it, heading along the path. */
function carving(path: (t: number) => number, t: number, f: Frame) {
  const k = f.ski;
  const side = (path(t + 0.02) - path(t - 0.02)) / 0.04;
  k.s = path(t);
  k.y = 0.65 * Math.max(0, -k.s);
  k.yaw = -0.8 * Math.atan2(side, SPEED);
  k.roll = 0.42 * k.s;
  k.wet = true;
}

const waveClear: Def = (() => {
  const duration = LENGTH2 / SPEED;
  const at = (t: number, f: Frame) => {
    f.ski.d = SPEED * t;
    carving(carve, t, f);
    f.rider.pose = t > 31 / SPEED ? 'fistPump' : t > 9 / SPEED ? 'armsUp' : 'ride';
  };
  const mid = 20 / SPEED;
  return {
    duration,
    length: LENGTH2,
    word: 'WAVE CURL!',
    at,
    events: (ski) => [
      [WAVE.from / SPEED - 0.4, 'sfx:whoosh', WAVE.from - 4, 1],
      ...trail(WAVE.from / SPEED, WAVE.to / SPEED, 0.14, 'spray', ski, 0.1),
      [mid, 'word', 20, 5.4],
      [duration - 0.35, 'splash', LENGTH2 - 3, 0],
      [duration - 0.35, 'sfx:splash', LENGTH2 - 3, 0],
      [duration - 0.3, 'cheer', LENGTH2 - 2, 1],
    ],
  };
})();

/** The fail: the curl comes down on the ski in the middle of the barrel and tumbles it and the rider. */
export const TUMBLE = { at: 1.75 };

/** How built the wave is (a swell at first, 1 a full barrel) by time; on a miss it collapses at `TUMBLE.at`. */
export function waveLevel(outcome: 'clear' | 'fail', t: number): number {
  const rise = 0.2 + 0.8 * prog(t, 0, 0.8, 'o');
  if (outcome === 'clear') return rise;
  return rise * (1 - 0.88 * prog(t, TUMBLE.at, TUMBLE.at + 0.4, 'o'));
}

const waveFail: Def = (() => {
  const tCrash = TUMBLE.at;
  const crashD = SPEED * tCrash;
  const skiEndD = 27.5;
  const tumbleEnd = tCrash + 1.5;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= tCrash) {
      k.d = SPEED * t;
      carving(carve, t, f);
      return;
    }
    const u = prog(t, tCrash, tumbleEnd, 'o');
    const s0 = carve(tCrash);
    k.d = lerp(crashD, skiEndD, u);
    k.s = lerp(s0, -1.2, u);
    k.y = -0.7 * Math.sin(PI * prog(t, tCrash, tumbleEnd));
    k.pitch = 0.5 * Math.sin(2 * PI * u) * (1 - u);
    k.roll = lerp(0.42 * s0, 2 * TAU + PI, prog(t, tCrash, tumbleEnd, 'io'));
    k.yaw = 0.4 * u;
    k.wet = true;
  };
  const s0 = seatAtTime(skiAt, tCrash + 0.05);
  const flyT = 1.1;
  const splat = tCrash + 0.05 + flyT;
  const riderD = 29;
  const riderS = 1.5;
  const popEnd = splat + 0.5;
  const settle = Math.max(popEnd, tumbleEnd) + 0.1;
  const riderAt = (t: number, f: Frame) => {
    const tFree = tCrash + 0.05;
    if (t < tFree) {
      if (t > 9 / SPEED) f.rider.pose = 'armsUp';
      if (t > tCrash - 0.1) f.rider.face = 'scared';
      return;
    }
    if (t < splat) {
      const u = (t - tFree) / flyT;
      setFree(
        f,
        lerp(s0.d, riderD, u),
        arc(s0.y, FLAT_Y, s0.y + 2.4, u),
        lerp(s0.s, riderS, u),
        lerp(s0.pitch, -3 * TAU, flipEase(u)),
        0,
        0,
        u < 0.85 ? 'tuck' : 'float',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, riderD, lerp(FLAT_Y, FLOAT_Y, up), riderS, -3 * TAU, 0, 0, 'float', 'soaked');
  };
  return {
    duration: settle + 1.0,
    word: 'WAVE TUMBLE!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (ski, rider) => [
      [WAVE.from / SPEED - 0.4, 'sfx:whoosh', WAVE.from - 4, 1],
      ...trail(WAVE.from / SPEED, tCrash - 0.1, 0.14, 'spray', ski, 0.1),
      [tCrash - 0.1, 'sfx:slideWhistle', crashD, 3],
      [tCrash, 'bigSplash', crashD, 1.2, -1.2],
      [tCrash + 0.1, 'bigSplash', crashD + 2, 0.8, 0.4],
      [tCrash + 0.15, 'sfx:bump', crashD, 1.5],
      [tCrash + 0.3, 'bigSplash', crashD + 4, 0.8, -0.6],
      ...trail(tCrash + 0.4, splat - 0.2, 0.3, 'bubbles', rider, 0.2),
      [tumbleEnd - 0.1, 'splash', skiEndD, 0.2, -1.2],
      [splat, 'bigSplash', riderD, 0.2, riderS],
      [splat, 'sfx:splat', riderD, 0, riderS],
      [splat, 'sfx:splash', riderD, 0, riderS],
      [splat, 'groan', riderD, 1, riderS],
      [splat + 0.1, 'word', riderD, 3.2, riderS],
      [popEnd, 'drips', riderD, 0.6, riderS],
    ],
  };
})();

// ---------- Element 3: the pirate ship ----------

/**
 * The pirate ship lies across the course (turned 45 degrees so the stunt camera sees its sails);
 * its bow ramp is the plank. Two square sails each have a hole in them that the clearing ski flies
 * through: `sails` gives where the middle line meets each sail (d and the height of the hole's
 * middle) and `holeRadius` how big the holes are.
 */
export const SHIP = {
  /** Where the ship's middle is on the middle line (d), and how it is turned (radians). */
  d: 22,
  yaw: PI / 4,
  deckY: 2.6,
  /** The plank: a narrow ramp up to its tip. */
  foot: 5,
  lip: 13,
  lipY: 3.4,
  plankHalfWidth: 1.1,
  sails: [
    { d: 19, y: 7.8, halfHeight: 3.0, halfWidth: 4.6 },
    { d: 26, y: 9.5, halfHeight: 3.3, halfWidth: 5.0 },
  ] as const,
  holeRadius: 1.7,
};

/** Height of the plank on the middle line at `d`. */
export function plankY(d: number): number {
  if (d <= SHIP.foot) return 0;
  return d <= SHIP.lip ? SHIP.lipY * ((d - SHIP.foot) / (SHIP.lip - SHIP.foot)) ** 1.3 : 0;
}

const T_LIP3 = SHIP.lip / SPEED;
const LENGTH3 = 50;
const plankLipPitch = Math.atan(slopeAt(plankY, SHIP.lip - 0.02));

const plankRide = (t: number, f: Frame) => {
  const k = f.ski;
  k.d = SPEED * t;
  k.y = plankY(k.d);
  k.pitch = Math.atan(slopeAt(plankY, Math.min(k.d, SHIP.lip - 0.02)));
  k.wet = k.d < SHIP.foot;
};

const shipClear: Def = (() => {
  const air = 2.6;
  const land = 44;
  const tLand = T_LIP3 + air;
  const peak = 9.0;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP3) {
      plankRide(t, f);
      f.rider.pose = 'ride';
    } else if (t < tLand) {
      const u = (t - T_LIP3) / air;
      k.d = lerp(SHIP.lip, land, u);
      k.y = arc(SHIP.lipY, 0, peak, u);
      k.pitch = plankLipPitch * (1 - prog(u, 0, 0.35)) + 2 * TAU * flipEase((u - 0.45) / 0.46);
      k.wet = false;
      f.rider.pose = u > 0.92 ? 'armsUp' : u > 0.45 ? 'tuck' : 'fistPump';
    } else {
      k.d = Math.min(land + SPEED * (t - tLand), LENGTH3);
      k.y = 0;
      k.pitch = 2 * TAU;
      f.rider.pose = 'ride';
    }
  };
  const mid = T_LIP3 + air * 0.68;
  const fw = (a: number, d: number, y: number, s: number) =>
    [mid + a, 'fireworks', d, y, s] as const;
  return {
    duration: tLand + (LENGTH3 - land) / SPEED,
    length: LENGTH3,
    word: 'PIRATE FLIP!',
    slow: [mid],
    at,
    events: () => [
      [T_LIP3 - 0.3, 'sfx:whoosh', SHIP.lip - 3, 1],
      [T_LIP3, 'sfx:boing', SHIP.lip, SHIP.lipY],
      [T_LIP3, 'spray', SHIP.lip, SHIP.lipY],
      fw(-0.5, 34, 11.5, -3.2),
      fw(0, 38.5, 12.6, 3.2),
      fw(0.5, 43, 11.4, 0),
      [mid, 'word', 36, 11.6],
      [tLand, 'bigSplash', land, 0],
      [tLand, 'sfx:splash', land, 0],
      [tLand + 0.15, 'cheer', land + 2, 1],
      [tLand + 0.15, 'confetti', land + 3, 2],
    ],
  };
})();

/** The fail: a short leap into the first sail, where the rider gets tangled until it all comes down. */
export const TANGLE = {
  hitAt: T_LIP3 + 5.5 / SPEED,
  /** Where the ski meets the canvas, where the rider hangs and where it all drops. */
  hit: [18.5, 4.7] as const,
  hang: [19.3, 4.9] as const,
  dropAt: T_LIP3 + 5.5 / SPEED + 1.0,
  land: [22.5, -0.8] as const,
};

const shipFail: Def = (() => {
  const { hitAt, hit, hang, dropAt, land } = TANGLE;
  const air = hitAt - T_LIP3;
  const fallEnd = hitAt + 0.12 + 0.65;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP3) {
      plankRide(t, f);
    } else if (t < hitAt) {
      const u = (t - T_LIP3) / air;
      k.d = lerp(SHIP.lip, hit[0], u);
      k.y = arc(SHIP.lipY, hit[1], 5.4, u);
      k.pitch = plankLipPitch * (1 - prog(u, 0, 0.5)) - 0.3 * prog(u, 0.5, 1);
      k.wet = false;
    } else {
      // It stops against the canvas, slides off it and drops into the water, turning over.
      const fall = Math.max(t - hitAt - 0.12, 0);
      const u = Math.min(fall / 0.65, 1);
      k.d = hit[0] + 0.15 * prog(t, hitAt, hitAt + 0.15) + 1.2 * u;
      k.y = lerp(hit[1], 0.05, u * u);
      k.pitch = lerp(-0.3, -1.2, prog(t, hitAt, hitAt + 0.5));
      k.roll = 1.6 * PI * u;
      k.wet = t >= fallEnd;
      if (t >= fallEnd) {
        k.pitch = lerp(-1.2, 0, prog(t, fallEnd, fallEnd + 0.5));
        k.roll = 1.6 * PI + (PI - 1.6 * PI) * prog(t, fallEnd, fallEnd + 0.7);
        k.y = lerp(0.05, 0, prog(t, fallEnd, fallEnd + 0.3));
      }
    }
  };
  const s0 = seatAtTime(skiAt, hitAt);
  const fallT = 0.65;
  const splat = dropAt + fallT;
  const popEnd = splat + 0.5;
  const settle = Math.max(popEnd, fallEnd + 0.7) + 0.1;
  const riderAt = (t: number, f: Frame) => {
    if (t < hitAt) {
      if (t > hitAt - 0.3) f.rider.face = 'scared';
      return;
    }
    if (t < hitAt + 0.15) {
      // Thrown into the canvas.
      const u = (t - hitAt) / 0.15;
      setFree(
        f,
        lerp(s0.d, hang[0], u),
        lerp(s0.y, hang[1], u),
        lerp(s0.s, 0, u),
        s0.pitch,
        0,
        0,
        'flail',
        'scared',
      );
      return;
    }
    if (t < dropAt) {
      // Hanging in the tangle of sail and rope, kicking.
      setFree(
        f,
        hang[0],
        hang[1] + 0.12 * Math.sin((t - hitAt) * 9),
        0.1 * Math.sin((t - hitAt) * 5),
        0.2 * Math.sin((t - hitAt) * 6),
        0.15 * Math.sin((t - hitAt) * 8),
        0,
        'flail',
        'scared',
      );
      return;
    }
    if (t < splat) {
      const u = (t - dropAt) / fallT;
      setFree(
        f,
        lerp(hang[0], land[0], u),
        arc(hang[1], FLAT_Y, hang[1] + 0.2, u),
        lerp(0, land[1], u),
        0,
        0,
        0,
        'flail',
        'scared',
      );
      return;
    }
    const up = prog(t, splat, popEnd, 'o');
    setFree(f, land[0], lerp(FLAT_Y, FLOAT_Y, up), land[1], 0, 0, 0, 'float', 'soaked');
  };
  return {
    duration: settle + 1.0,
    word: 'TANGLED SAILS!',
    at: (t, f) => {
      skiAt(t, f);
      riderAt(t, f);
    },
    events: (_ski, rider) => [
      [T_LIP3 - 0.3, 'sfx:whoosh', SHIP.lip - 3, 1],
      [T_LIP3, 'sfx:boing', SHIP.lip, SHIP.lipY],
      [T_LIP3, 'spray', SHIP.lip, SHIP.lipY],
      [hitAt, 'sfx:bump', hit[0], hit[1]],
      [hitAt, 'stars', hit[0] + 0.5, hit[1] + 1.4],
      [hitAt + 0.15, 'sfx:slideWhistle', hang[0], hang[1]],
      [fallEnd, 'splash', hit[0] + 1.4, 0.2],
      [fallEnd, 'sfx:splash', hit[0] + 1.4, 0],
      ...trail(dropAt + 0.1, splat - 0.1, 0.2, 'drips', rider),
      [splat, 'bigSplash', land[0], 0.2, land[1]],
      [splat, 'sfx:splat', land[0], 0, land[1]],
      [splat, 'groan', land[0], 1, land[1]],
      [splat + 0.1, 'word', land[0], 3.2, land[1]],
      [popEnd, 'drips', land[0], 0.6, land[1]],
    ],
  };
})();

export const JAWS_SOME_JUMP: MegaSpec = {
  id: 'jaws-some-jump',
  title: 'Jaws-Some Jump',
  emoji: '🦈',
  elements: [
    {
      name: 'Sunglasses Shark',
      length: LENGTH1,
      floorY: -1.2,
      cue: { d: 8, y: 1.0 },
      anchor: { d: SHARK.centerD, y: 1.8 },
      extent: [10, 27],
      clear: sharkClear,
      fail: sharkFail,
    },
    {
      name: 'Giant Wave',
      length: LENGTH2,
      floorY: -1.2,
      cue: { d: 6, y: 1.0 },
      anchor: { d: 20.5, y: 2.2 },
      extent: [12, 29],
      clear: waveClear,
      fail: waveFail,
    },
    {
      name: 'Pirate Ship',
      length: LENGTH3,
      floorY: -1.2,
      cue: { d: 8, y: 0.8 },
      anchor: { d: SHIP.d, y: 6.0 },
      extent: [14, 32],
      clear: shipClear,
      fail: shipFail,
    },
  ],
};
