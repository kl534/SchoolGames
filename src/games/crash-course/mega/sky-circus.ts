/**
 * Mega course 2: the Sky Circus under the big top. A human cannon shoots the bike onto three
 * balloons, the third gives a big bounce into a gondola of a tall Ferris wheel, and the wheel
 * turns it up and flings it off in a double backflip. Pure animation data like stunts.ts:
 * element-local coordinates in the Defs (x = 0 at the element's entry line, the road at y = 0),
 * course-local ones in `circusClear`.
 *
 * Like Inferno Drop the three elements are windows onto ONE flight (`circusClear`): a cleared
 * element 1 or 2 ends mid-air and the next one carries on from there (see `airborne` in mega.ts).
 * The bike touches the road only in the cannon and after the finale. A crash plays the flight up
 * to where it goes wrong, then comes to rest (the rider is always fine).
 */
import {
  BIKE_Y,
  hipOf,
  setFree,
  smooth,
  TAU,
  track,
  trail,
  type Def,
  type Ev,
  type Frame,
  type Pos,
} from '../stunts';
import { bump, flipEase, heading, lean, route, windowDef, type Stop } from './anim';
import type { MegaSpec } from './mega';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- Element 1: the Human Cannon ----------

/** The striped cannon: its barrel climbs at `angle`; the bike rides up inside it. */
export const CANNON = {
  angle: 0.52,
  /** x where the bike's middle reaches the mouth, on the road. */
  entryX: 3.4,
  /** The barrel's radius and length along its axis. */
  radius: 1.45,
  length: 4.8,
  /** The bike rides this far below the barrel's axis. */
  below: 1.0,
};
const CAN_C = Math.cos(CANNON.angle);
const CAN_S = Math.sin(CANNON.angle);
/** The middle of the mouth (the axis starts here). */
export const CANNON_MOUTH: Pos = {
  x: CANNON.entryX - CANNON.below * CAN_S,
  y: BIKE_Y + CANNON.below * CAN_C,
};
/** The middle of the muzzle (the other end of the axis). */
export const CANNON_MUZZLE: Pos = {
  x: CANNON_MOUTH.x + CANNON.length * CAN_C,
  y: CANNON_MOUTH.y + CANNON.length * CAN_S,
};
/** The bike's middle after riding `s` units up inside the barrel. */
const inBarrel = (s: number): Pos => ({
  x: CANNON.entryX + CAN_C * s,
  y: BIKE_Y + CAN_S * s,
});
/** A point on the barrel's axis `s` units from the mouth. */
const onAxis = (s: number): Pos => ({
  x: CANNON_MOUTH.x + CAN_C * s,
  y: CANNON_MOUTH.y + CAN_S * s,
});

const CAN_IN = 0.34; // the bike's middle reaches the mouth
const CAN_DEEP = 2.2; // how far in before it stops to wait for the fuse

const crash1: Def = (() => {
  const duration = 4.4;
  const tDeep = CAN_IN + 0.22;
  const tFire = 0.7;
  const tOut = 0.86;
  const tApex = 1.45;
  const tHang = 1.8;
  const tFall = 2.4;
  const tSlide = 2.65;
  const deep = inBarrel(CAN_DEEP);
  const exit = inBarrel(CANNON.length);
  const mouth = { x: CANNON_MUZZLE.x + 0.15, y: CANNON_MUZZLE.y + 0.25 };
  const rest = onAxis(3.2);
  const apex = { x: 8.4, y: 5.1 };
  const path = route([
    [0, 0, BIKE_Y],
    [CAN_IN, CANNON.entryX, BIKE_Y],
    [tDeep, deep.x, deep.y],
    [tFire, deep.x, deep.y],
    [tOut, exit.x, exit.y],
    [tApex, apex.x, apex.y, apex.y],
    [tHang, apex.x + 0.1, apex.y - 0.1, undefined, 'io'],
    [tFall, mouth.x, mouth.y, apex.y - 0.1],
    [tSlide, rest.x, rest.y, undefined, 'o'],
  ]);
  const pitch = track([
    [CAN_IN, 0],
    [CAN_IN + 0.15, CANNON.angle],
    [tOut, CANNON.angle],
    [tApex, Math.PI / 2, 'o'],
    [tHang, Math.PI / 2],
    [tFall, CANNON.angle + Math.PI, 'io'],
  ]);
  // The rider is shot out too, spins over the top and lands sitting on the barrel.
  const seat = hipOf(exit.x, exit.y, CANNON.angle);
  const hips0 = { x: seat.x, y: seat.y };
  const tSit = 2.5;
  const sit = { x: 4.0, y: 3.85 };
  const apexR = { x: 9.9, y: 5.4 };
  const rider = route([
    [tOut, hips0.x, hips0.y],
    [1.5, apexR.x, apexR.y, apexR.y],
    [tSit, sit.x, sit.y, apexR.y],
  ]);
  const riderRot = track([
    [tOut, 0],
    [tSit, TAU + CANNON.angle, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    const p = path(t);
    f.bike.x = p.x;
    f.bike.y = p.y;
    f.bike.pitch = pitch(t);
    if (t > tDeep && t < tFire) {
      f.bike.x += 0.03 * Math.sin(t * 45);
      f.bike.y += 0.03 * Math.sin(t * 52);
    }
    if (t > tApex && t < tHang) f.bike.pitch += 0.12 * Math.sin((t - tApex) * 14);
    f.bike.grounded = t < CAN_IN;
    if (t >= tOut) {
      const r = rider(t);
      const landed = t >= tSit;
      setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'sooty' : 'scared');
    } else if (t >= tFire) {
      f.rider.face = 'scared';
    }
  };
  return {
    duration,
    word: 'FIZZLE!',
    beats: { fire: tFire, out: tOut, apex: tApex, fall: tFall, sit: tSit },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [tFire, 'sfx:boom', CANNON_MUZZLE.x, CANNON_MUZZLE.y],
      [tFire, 'flame', CANNON_MUZZLE.x, CANNON_MUZZLE.y],
      [tFire, 'smoke', CANNON_MUZZLE.x, CANNON_MUZZLE.y],
      ...trail(tOut + 0.05, tApex, 0.15, 'smoke', bike),
      [1.5, 'word', apex.x, apex.y + 0.3],
      [tHang, 'sweat', apex.x, apex.y - 0.6],
      [tFall, 'groan', mouth.x, mouth.y],
      [tFall + 0.05, 'sfx:fizz', mouth.x, mouth.y],
      [2.75, 'smoke', 3.5, 0.9],
      [2.95, 'smoke', 3.4, 1.0],
      [3.15, 'smoke', 3.5, 1.1],
      [tSit, 'sfx:splat', sit.x, sit.y - 0.3],
      [tSit, 'poof', sit.x, sit.y],
      [tSit + 0.25, 'stars', sit.x + 0.2, sit.y + 1.3],
    ],
  };
})();

// ---------- Geometry ----------

/** Balloon Hop, element-local (course 21, 24.6, 28.2). */
export const BALLOON_X: readonly [number, number, number] = [2, 5.6, 9.2];
export const BALLOON_Y = 2.1;
export const BALLOON_R = 1.25;
/** The top of a balloon, and the height of the bike's middle when it bounces on it. */
export const BALLOON_TOP = BALLOON_Y + BALLOON_R;
const BOUNCE_Y = BALLOON_TOP + 0.37;
/** The hay pit fills the whole Balloon Hop element. */
export const BALLOON_PIT: readonly [number, number] = [0, 12];
/** The hay pile in the pit: its top is here, and the rider sits at `BALLOON_SIT` after POP!. */
export const HAY_TOP = -1.15;
export const BALLOON_SIT: Pos = { x: BALLOON_X[1] + 1.2, y: HAY_TOP + 0.25 };

/** The Ferris wheel, element-local to Ferris Launch (course cx = 39.5). Positive turn = clockwise. */
export const FERRIS = { cx: 8.5, cy: 6.4, r: 4.0, drop: 0.4, gondolas: 8 };
/** The loading gondola (index 0) waits at 9 o'clock when the wheel has not turned. */
export const CATCH_ANGLE = Math.PI;
/** How far the wheel turns the loaded gondola: from 9 o'clock to the top. */
export const TOP_TURN = Math.PI / 2;
/** Cotton candy pile of DIZZY!, element-local. */
export const CANDY = { x: 17.5, top: 1.5, halfW: 2.2 };
/** Where the cleared finale touches the road, element-local (course 53); the yellow pad is here. */
export const X_LAND = 22;

/** Where gondola pivots are when the wheel has turned `theta` (gondola 0 starts at 9 o'clock). */
export function ferrisPivot(theta: number, index = 0): Pos {
  const a = CATCH_ANGLE - theta + (index * TAU) / FERRIS.gondolas;
  return { x: FERRIS.cx + FERRIS.r * Math.cos(a), y: FERRIS.cy + FERRIS.r * Math.sin(a) };
}
/** The bike's middle in the loading gondola, whose floor is tilted by `tilt` about the pivot. */
function carried(theta: number, tilt: number): Pos {
  const p = ferrisPivot(theta);
  return { x: p.x + FERRIS.drop * Math.sin(tilt), y: p.y - FERRIS.drop * Math.cos(tilt) };
}

/** The x of each element's entry line, course-local (equals `megaOffsets('sky-circus')`). */
export const OFFSETS = [0, 19, 31] as const;

// ---------- The one flight: timing ----------

const CONTACT = 0.14;
/** The cannon fires and the bike leaves the barrel. */
const T_FIRE = 0.96;
const T_OUT = 1.14;
/** The boundaries between the three elements, in course time. */
export const T_B1 = 2.42;
export const T_B2 = 4.75;
/** When the bike lands on each balloon. */
export const T_HIT = [2.65, 3.39, 4.13] as const;
/** The bike drops into the waiting gondola; the wheel reaches the top; the gondola tips. */
export const T_CATCH = 5.55;
export const T_TOP = 6.95;
export const T_TIP = 7.25;
/** The finale touches the road, and the course ends. */
export const T_LAND = 8.75;
export const T_END = 9.5;
/** In DIZZY! (Ferris Launch local time) the wheel has spun two turns and a quarter by now. */
export const T_FLING_CRASH = 2.8;
const CRASH3_END = 4.7;

/** How far the loading gondola tips at the top, and its sway after the catch. */
const TIP = 0.5;
const sway = (T: number): number => {
  if (T < T_CATCH) return 0;
  const s = T - T_CATCH;
  return 0.12 * Math.sin(10 * s) * Math.exp(-3 * s);
};
const tipTrack = track([
  [T_TOP, 0],
  [T_TIP, TIP, 'io'],
  [T_TIP + 0.5, 0, 'io'],
]);
/** The wheel turns the bike up to the top, then holds while the gondola tips and turns on slowly. */
const turnClear = track([
  [T_CATCH, 0],
  [T_TOP, TOP_TURN, 'io'],
  [T_TIP, TOP_TURN, 'l'],
  [T_END, TOP_TURN + 0.6, 'l'],
]);
const turnCrash = track([
  [T_CATCH - T_B2, 0],
  [T_FLING_CRASH, 2 * TAU + TOP_TURN, 'io'],
  [CRASH3_END, 2 * TAU + TOP_TURN + 1.2, 'o'],
]);

/** How far the Ferris wheel has turned at time t (Ferris Launch local) of the clear or the crash. */
export function ferrisTurn(outcome: 'clear' | 'crash', t: number): number {
  return outcome === 'clear' ? turnClear(t + T_B2) : turnCrash(t);
}
/** The loading gondola's tilt at time t (Ferris Launch local): the sway, and the tip in the clear. */
export function ferrisTilt(outcome: 'clear' | 'crash', t: number): number {
  const T = t + T_B2;
  return outcome === 'clear' ? sway(T) + tipTrack(T) : sway(T);
}

// ---------- The one flight: the path ----------

const catchP: Pos = (() => {
  const p = carried(0, 0);
  return { x: p.x + OFFSETS[2], y: p.y };
})();

/** Course-local path from the start to the catch: cannon, three balloons, the big bounce. */
const flight = (() => {
  const deep = inBarrel(CAN_DEEP);
  const exit = inBarrel(CANNON.length);
  const x = (k: 0 | 1 | 2) => OFFSETS[1] + BALLOON_X[k];
  const contact = (k: 0 | 1 | 2, dip: number): Stop[] => [
    [T_HIT[k] + CONTACT / 2, x(k) + 0.1, BOUNCE_Y - dip, undefined, 'o'],
    [T_HIT[k] + CONTACT, x(k) + 0.2, BOUNCE_Y, undefined, 'i'],
  ];
  return route([
    [0, 0, BIKE_Y],
    [CAN_IN, CANNON.entryX, BIKE_Y],
    [CAN_IN + 0.22, deep.x, deep.y],
    [T_FIRE, deep.x, deep.y],
    [T_OUT, exit.x, exit.y],
    [T_HIT[0], x(0), BOUNCE_Y, 7.6],
    ...contact(0, 0.35),
    [T_HIT[1], x(1), BOUNCE_Y, 5.0],
    ...contact(1, 0.35),
    [T_HIT[2], x(2), BOUNCE_Y, 5.2],
    ...contact(2, 0.5),
    [T_CATCH, catchP.x, catchP.y, 8.0],
  ]);
})();

/** The leaps between balloons, and the big bounce: the bike leans along its flight. */
const LEGS: readonly (readonly [number, number])[] = [
  [T_HIT[0] + CONTACT, T_HIT[1]],
  [T_HIT[1] + CONTACT, T_HIT[2]],
  [T_HIT[2] + CONTACT, T_CATCH],
];

function pitchAt(T: number): number {
  if (T < CAN_IN) return 0;
  if (T < T_OUT) return CANNON.angle * smooth((T - CAN_IN) / 0.15);
  if (T < T_HIT[0]) {
    const out = lerp(CANNON.angle, heading(flight, T), smooth((T - T_OUT) / 0.25));
    return lerp(out, 0, smooth((T - (T_HIT[0] - 0.2)) / 0.2));
  }
  for (const [a, b] of LEGS) {
    if (T > a && T < b) return lean((T - a) / (b - a), heading(flight, T));
  }
  return 0;
}

/** The finale: out of the gondola at the top, over to the pad, a double backflip on the way. */
const fling = (() => {
  const from = carried(TOP_TURN, TIP);
  return route([
    [T_TIP, from.x + OFFSETS[2], from.y],
    [T_LAND, OFFSETS[2] + X_LAND, BIKE_Y, 11.2],
  ]);
})();
const roll = track([
  [T_LAND, OFFSETS[2] + X_LAND],
  [T_END, OFFSETS[2] + X_LAND + 6, 'l'],
]);

/** The bike's squash: a dip on each balloon, a bump at the catch and at the touchdown. */
function squashAt(T: number): number {
  let squash = 1;
  for (const h of T_HIT) squash -= 0.2 * bump(T, h + CONTACT / 2, CONTACT / 2 + 0.02);
  squash -= 0.2 * bump(T, T_CATCH + 0.03, 0.1);
  squash -= 0.25 * bump(T, T_LAND + 0.05, 0.12);
  return squash;
}

/** The bike in the loading gondola (course-local), tilted and turned. */
function inGondola(turn: number, tilt: number, f: Frame): void {
  const p = carried(turn, tilt);
  f.bike.x = p.x + OFFSETS[2];
  f.bike.y = p.y;
  f.bike.pitch = tilt;
  f.bike.grounded = false;
}

/**
 * The whole cleared course as one function of course time `T`, into `f` (course-local). The three
 * cleared elements are windows onto it.
 */
export function circusClear(T: number, f: Frame): void {
  if (T < T_CATCH) {
    const p = flight(T);
    f.bike.x = p.x;
    f.bike.y = p.y;
    f.bike.pitch = pitchAt(T);
    if (T > CAN_IN + 0.22 && T < T_FIRE) {
      // Waiting for the fuse: the barrel shivers.
      f.bike.x += 0.03 * Math.sin(T * 45);
      f.bike.y += 0.03 * Math.sin(T * 52);
    }
    f.bike.grounded = T < CAN_IN;
    f.rider.pose =
      T >= T_OUT + 0.05 && T < T_B1 - 0.2
        ? 'superman'
        : T > T_HIT[0] + CONTACT && T < T_HIT[1]
          ? 'wave'
          : 'ride';
  } else if (T < T_TIP) {
    inGondola(turnClear(T), sway(T) + tipTrack(T), f);
    if (T >= T_CATCH + 0.3) f.rider.pose = 'armsUp';
  } else if (T < T_LAND) {
    const p = fling(T);
    f.bike.x = p.x;
    f.bike.y = p.y;
    f.bike.pitch = lerp(TIP, 2 * TAU, flipEase((T - T_TIP) / (T_LAND - T_TIP)));
    f.bike.grounded = false;
    f.rider.pose = 'armsUp';
  } else {
    f.bike.x = roll(T);
    f.bike.pitch = 2 * TAU;
    if (T < T_LAND + 0.4) f.rider.pose = 'thumbs';
  }
  f.bike.squash = squashAt(T);
}

// ---------- The three cleared elements ----------

const clear1: Def = windowDef(
  circusClear,
  0,
  T_B1,
  OFFSETS[0],
  'KABOOM!',
  { in: CAN_IN, fire: T_FIRE, out: T_OUT },
  [T_OUT],
  (bike) => [
    [0.3, 'sfx:whoosh', 2, 0.5],
    [T_FIRE, 'sfx:boom', CANNON_MUZZLE.x, CANNON_MUZZLE.y],
    [T_FIRE, 'flame', CANNON_MUZZLE.x, CANNON_MUZZLE.y],
    [T_FIRE, 'smoke', CANNON_MUZZLE.x, CANNON_MUZZLE.y],
    [T_FIRE + 0.08, 'smoke', CANNON_MUZZLE.x + 0.5, CANNON_MUZZLE.y + 0.5],
    ...trail(T_OUT + 0.05, T_B1 - 0.1, 0.12, 'spark', bike),
    [1.55, 'word', 12, 9.0],
    [T_B1 * 0.93, 'cheer', 17, 2],
  ],
);

const clear2: Def = windowDef(
  circusClear,
  T_B1,
  T_B2,
  OFFSETS[1],
  'BOING!',
  { b1: T_HIT[0] - T_B1, b2: T_HIT[1] - T_B1, b3: T_HIT[2] - T_B1 },
  [],
  () => [
    ...T_HIT.map((h, k): Ev => [h - T_B1, 'sfx:boing', BALLOON_X[k], BOUNCE_Y]),
    [T_HIT[1] - 0.25 - T_B1, 'word', BALLOON_X[1], 6.5],
    [T_HIT[2] - T_B1, 'spark', BALLOON_X[2], BOUNCE_Y],
    [T_HIT[2] + 0.05 - T_B1, 'cheer', BALLOON_X[2], 2],
  ],
);

const clear3: Def = (() => {
  const duration = T_END - T_B2;
  const catchT = T_CATCH - T_B2;
  const tip = T_TIP - T_B2;
  const land = T_LAND - T_B2;
  const gondola = carried(0, 0);
  const top = carried(TOP_TURN, TIP);
  return windowDef(
    circusClear,
    T_B2,
    T_END,
    OFFSETS[2],
    'SKY HIGH!',
    { catch: catchT, top: T_TOP - T_B2, tip, land },
    [catchT],
    (bike) => {
      const peak = bike(tip + 0.7);
      return [
        [catchT, 'sfx:bump', gondola.x, gondola.y],
        [catchT, 'sfx:chime', gondola.x, gondola.y],
        [catchT, 'dust', gondola.x, gondola.y - 0.4],
        [tip, 'sfx:whoosh', top.x, top.y],
        [tip, 'sfx:boing', top.x, top.y],
        ...trail(tip + 0.1, land - 0.1, 0.12, 'spark', bike),
        [tip + 0.7, 'word', peak.x, peak.y + 1.6],
        [tip + 0.7, 'confetti', peak.x, peak.y + 1.4],
        [tip + 0.77, 'confetti', peak.x - 1.4, peak.y + 1.0],
        [land, 'dust', X_LAND, 0.1],
        [land, 'confetti', X_LAND + 0.5, 2],
        [land + 0.12, 'confetti', X_LAND + 1.8, 2.4],
        [land, 'sfx:chime', X_LAND, 1],
        [duration * 0.96, 'cheer', X_LAND + 3, 2],
      ];
    },
  );
})();

// ---------- Crash 2: POP! (lands on balloon 1, pops balloon 2, falls into the hay) ----------

const crash2: Def = (() => {
  const duration = 3.6;
  const b1 = T_HIT[0] - T_B1;
  const hop = b1 + CONTACT;
  const tHit = 0.85;
  const tHay = 1.48;
  const tSink = 1.73;
  const tRest = 2.13;
  const tSit = 1.63;
  const hit = { x: BALLOON_X[1] - 1.25, y: 3.0 };
  const hayX = BALLOON_X[1] - 0.6;
  const path = route([
    [hop, BALLOON_X[0] + 0.2, BOUNCE_Y],
    [tHit, hit.x, hit.y, 5.0],
    [tHay, hayX, HAY_TOP + 0.5, hit.y],
    [tSink, hayX + 0.1, HAY_TOP - 0.4, undefined, 'o'],
  ]);
  const seat = hipOf(hit.x, hit.y, 0);
  const hips0 = { x: seat.x, y: seat.y };
  const sit = BALLOON_SIT;
  const rider = route([
    [tHit, hips0.x, hips0.y],
    [tSit, sit.x, sit.y, 5.2],
  ]);
  const riderRot = track([
    [tHit, 0],
    [tSit, -TAU, 'io'],
  ]);
  const pitch = track([
    [hop, 0],
    [tHit, -0.1],
    [tHay, -0.6, 'i'],
    [tRest, 1.1, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t <= hop) {
      // Still the one flight: down on balloon 1.
      circusClear(T_B1 + t, f);
      f.bike.x -= OFFSETS[1];
      return;
    }
    const p = path(t);
    f.bike.x = p.x;
    f.bike.y = p.y;
    f.bike.pitch = t < tHit ? lean((t - hop) / (tHit - hop), heading(path, t), 0.3) : pitch(t);
    f.bike.squash = Math.max(
      1 - 0.3 * bump(t, tHay + 0.05, 0.15) - 0.2 * bump(t, b1 + CONTACT / 2, 0.09),
      0.5,
    );
    f.bike.grounded = t >= tHay && t < tRest;
    if (t >= tHit) {
      const r = rider(t);
      const landed = t >= tSit;
      setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'dizzy' : 'scared');
    } else {
      f.rider.face = 'scared';
    }
  };
  return {
    duration,
    word: 'POP!',
    beats: { b1, pop: tHit, hay: tHay, sit: tSit },
    at,
    events: () => [
      [b1 + 0.02, 'sfx:boing', BALLOON_X[0], BOUNCE_Y],
      [tHit, 'poof', BALLOON_X[1] - 1.0, 3.0],
      [tHit, 'sfx:boing', hit.x, hit.y],
      [tHit, 'word', hit.x, 4.3],
      [tHay, 'groan', hayX, HAY_TOP + 0.5],
      [tHay, 'dust', hayX, HAY_TOP + 0.2],
      [tHay, 'sfx:splat', hayX, HAY_TOP + 0.5],
      [tSit, 'dust', sit.x, HAY_TOP + 0.2],
      [tSit + 0.3, 'stars', sit.x, sit.y + 1.5],
    ],
  };
})();

// ---------- Crash 3: DIZZY! (caught in the gondola, spun round twice, flung into the candy) ----------

const crash3: Def = (() => {
  const duration = CRASH3_END;
  const catchT = T_CATCH - T_B2;
  const flingT = T_FLING_CRASH;
  const tLand = 3.65;
  const tSit = 3.7;
  const gondola = carried(0, 0);
  const start = carried(2 * TAU + TOP_TURN, 0);
  const bikeEnd = { x: CANDY.x - 0.2, y: CANDY.top + 0.55 };
  const flightPath = route([
    [flingT, start.x, start.y],
    [tLand, bikeEnd.x, bikeEnd.y, 10.6],
    [tSit, bikeEnd.x + 0.05, bikeEnd.y - 0.5, undefined, 'o'],
  ]);
  const seat = hipOf(start.x, start.y, 0);
  const hips0 = { x: seat.x, y: seat.y };
  const sit = { x: CANDY.x + 1.8, y: CANDY.top + 0.3 };
  const rider = route([
    [flingT, hips0.x, hips0.y],
    [tSit, sit.x, sit.y, 11.3],
  ]);
  const riderRot = track([
    [flingT, 0],
    [tSit, -TAU, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    const T = T_B2 + t;
    if (t < catchT) {
      circusClear(T, f);
      f.bike.x -= OFFSETS[2];
      return;
    }
    if (t < flingT) {
      inGondola(turnCrash(t), sway(T), f);
      f.bike.x -= OFFSETS[2];
      f.bike.squash = 1 - 0.2 * bump(T, T_CATCH + 0.03, 0.1);
      if (t >= 1.2) {
        f.rider.pose = 'flail';
        f.rider.face = t >= 1.8 ? 'dizzy' : 'scared';
      }
      return;
    }
    const p = flightPath(t);
    f.bike.x = p.x;
    f.bike.y = p.y;
    f.bike.pitch = lerp(0, TAU + 0.4, flipEase((t - flingT) / (tLand - flingT)));
    f.bike.grounded = false;
    f.bike.squash = 1 - 0.25 * bump(t, tLand + 0.02, 0.03);
    const r = rider(t);
    const landed = t >= tSit;
    setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'dizzy' : 'scared');
  };
  return {
    duration,
    word: 'DIZZY!',
    beats: { catch: catchT, fling: flingT, land: tLand },
    slow: [catchT],
    at,
    events: (bike) => [
      [catchT, 'sfx:bump', gondola.x, gondola.y],
      [catchT, 'dust', gondola.x, gondola.y - 0.4],
      ...trail(1.3, flingT - 0.1, 0.2, 'sweat', bike, 0.8),
      [flingT, 'word', 14, 10.4],
      [flingT, 'sfx:slideWhistle', start.x, start.y],
      [tLand, 'groan', bikeEnd.x, bikeEnd.y],
      [tLand, 'sfx:splat', bikeEnd.x, bikeEnd.y],
      [tLand, 'poof', bikeEnd.x, bikeEnd.y + 0.4, 0xff8fc7],
      [tSit, 'poof', sit.x, sit.y + 0.2, 0xff8fc7],
      [tSit + 0.25, 'stars', sit.x, sit.y + 1.5],
    ],
  };
})();

// ---------- The course ----------

export const SKY_CIRCUS: MegaSpec = {
  id: 'sky-circus',
  title: 'Sky Circus',
  emoji: '🎪',
  airborne: true,
  rise: 6.6,
  elements: [
    {
      name: 'Human Cannon',
      length: 19,
      floorY: 0,
      height: 5.0,
      cuts: [],
      clear: clear1,
      crash: crash1,
    },
    {
      name: 'Balloon Hop',
      length: 12,
      floorY: -2.5,
      height: 5.8,
      cuts: [BALLOON_PIT],
      clear: clear2,
      crash: crash2,
    },
    {
      name: 'Ferris Launch',
      length: 28,
      floorY: 0,
      height: 11.2,
      cuts: [],
      clear: clear3,
      crash: crash3,
    },
  ],
};
