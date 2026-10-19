/**
 * Mega course 2: the Sky Circus under the big top. A human cannon, three balloons over a hay pit
 * and a Ferris wheel that launches the bike. Pure animation data like stunts.ts: element-local
 * coordinates (x = 0 at the element's entry line, the road at y = 0).
 *
 * Every element starts as the standard arrival pose and a cleared one ends riding on the road at
 * its `length`, so the three chain. A crash comes to rest (the rider is always fine).
 */
import {
  BIKE_Y,
  hipOf,
  ride,
  setFree,
  smooth,
  TAU,
  track,
  trail,
  type Def,
  type Ev,
  type Frame,
  type Pos,
  type Surface,
} from '../stunts';
import { bump, flipEase, heading, lean, route, type Stop } from './anim';
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

const clear1: Def = (() => {
  const duration = 3.0;
  const tDeep = CAN_IN + 0.22;
  const tFire = 0.96;
  const tOut = 1.14;
  const tLand = 2.3;
  const xLand = 15.6;
  const deep = inBarrel(CAN_DEEP);
  const exit = inBarrel(CANNON.length);
  const path = route([
    [0, 0, BIKE_Y],
    [CAN_IN, CANNON.entryX, BIKE_Y],
    [tDeep, deep.x, deep.y],
    [tFire, deep.x, deep.y],
    [tOut, exit.x, exit.y],
    [tLand, xLand, BIKE_Y, 5.0],
    [duration, 20, BIKE_Y],
  ]);
  const pitchAt = (t: number): number => {
    if (t < CAN_IN) return 0;
    if (t < tOut) return CANNON.angle * smooth((t - CAN_IN) / 0.15);
    const out = lerp(CANNON.angle, heading(path, t), smooth((t - tOut) / 0.25));
    return lerp(out, 0, smooth((t - (tLand - 0.4)) / 0.4));
  };
  const at = (t: number, f: Frame) => {
    const p = path(t);
    f.bike.x = p.x;
    f.bike.y = p.y;
    f.bike.pitch = pitchAt(t);
    if (t > tDeep && t < tFire) {
      // Waiting for the fuse: the barrel shivers.
      f.bike.x += 0.03 * Math.sin(t * 45);
      f.bike.y += 0.03 * Math.sin(t * 52);
    }
    f.bike.grounded = t < CAN_IN || t >= tLand;
    f.bike.squash = 1 - 0.15 * bump(t, tLand + 0.04, 0.1);
    f.rider.pose = t >= tOut && t < tLand + 0.35 ? 'armsUp' : 'ride';
  };
  return {
    duration,
    word: 'KABOOM!',
    beats: { in: CAN_IN, fire: tFire, out: tOut, land: tLand },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [tFire, 'sfx:boom', CANNON_MUZZLE.x, CANNON_MUZZLE.y],
      [tFire, 'flame', CANNON_MUZZLE.x, CANNON_MUZZLE.y],
      [tFire, 'smoke', CANNON_MUZZLE.x, CANNON_MUZZLE.y],
      [tFire + 0.08, 'smoke', CANNON_MUZZLE.x + 0.5, CANNON_MUZZLE.y + 0.5],
      ...trail(tOut + 0.05, tLand - 0.1, 0.12, 'spark', bike),
      [1.55, 'word', 10.6, 5.6],
      [tLand, 'dust', xLand, 0.1],
      [tLand, 'sfx:chime', xLand, 1],
      [duration * 0.93, 'cheer', 19, 2],
    ],
  };
})();

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

// ---------- Element 2: Balloon Hop ----------

/** Where the three big balloons float (x), how high their middles are and how big they are. */
export const BALLOON_X: readonly [number, number, number] = [8.6, 12.2, 15.8];
export const BALLOON_Y = 2.1;
export const BALLOON_R = 1.25;
/** The top of a balloon, and the height of the bike's middle when it bounces on it. */
export const BALLOON_TOP = BALLOON_Y + BALLOON_R;
const BOUNCE_Y = BALLOON_TOP + 0.37;
/** The hay pile in the pit: its top is here, and the rider ends up sitting at `BALLOON_SIT`. */
export const HAY_TOP = -1.15;
export const BALLOON_SIT: Pos = { x: 13.4, y: HAY_TOP + 0.25 };
/** The pit in the road, element-local. */
export const BALLOON_PIT: readonly [number, number] = [6, 18];

/** When the bike lands on each balloon (clear and crash share the first). */
const A_CLEAR = [1.0, 1.74, 2.48] as const;
const CONTACT = 0.14;

const clear2: Def = (() => {
  const duration = 4.0;
  const tFlip = A_CLEAR[2] + CONTACT;
  const tLand = 3.3;
  const stops: Stop[] = [
    [0, 0, BIKE_Y],
    [0.5, 5.0, BIKE_Y],
    [A_CLEAR[0], BALLOON_X[0], BOUNCE_Y, 5.0],
    [A_CLEAR[0] + CONTACT / 2, BALLOON_X[0] + 0.1, BOUNCE_Y - 0.35, undefined, 'o'],
    [A_CLEAR[0] + CONTACT, BALLOON_X[0] + 0.2, BOUNCE_Y, undefined, 'i'],
    [A_CLEAR[1], BALLOON_X[1], BOUNCE_Y, 5.2],
    [A_CLEAR[1] + CONTACT / 2, BALLOON_X[1] + 0.1, BOUNCE_Y - 0.35, undefined, 'o'],
    [A_CLEAR[1] + CONTACT, BALLOON_X[1] + 0.2, BOUNCE_Y, undefined, 'i'],
    [A_CLEAR[2], BALLOON_X[2], BOUNCE_Y, 5.2],
    [A_CLEAR[2] + CONTACT / 2, BALLOON_X[2] + 0.1, BOUNCE_Y - 0.35, undefined, 'o'],
    [tFlip, BALLOON_X[2] + 0.2, BOUNCE_Y, undefined, 'i'],
    [tLand, 19.8, BIKE_Y, 5.6],
    [duration, 24, BIKE_Y],
  ];
  const path = route(stops);
  // The airborne legs: the bike leans along its flight; the last one is the front flip.
  const legs: [number, number][] = [
    [0.5, A_CLEAR[0]],
    [A_CLEAR[0] + CONTACT, A_CLEAR[1]],
    [A_CLEAR[1] + CONTACT, A_CLEAR[2]],
  ];
  const at = (t: number, f: Frame) => {
    const p = path(t);
    f.bike.x = p.x;
    f.bike.y = p.y;
    let pitch = 0;
    for (const [a, b] of legs) {
      if (t > a && t < b) pitch = lean((t - a) / (b - a), heading(path, t));
    }
    if (t >= tFlip) pitch = -TAU * flipEase((t - tFlip) / (tLand - tFlip));
    f.bike.pitch = pitch;
    let squash = 1 - 0.15 * bump(t, tLand + 0.04, 0.1);
    for (const a of A_CLEAR) squash -= 0.2 * bump(t, a + CONTACT / 2, CONTACT / 2 + 0.02);
    f.bike.squash = squash;
    const air = (t > 0.5 && t < A_CLEAR[2] + CONTACT) || (t >= tFlip && t < tLand);
    f.bike.grounded = !air && !(t >= A_CLEAR[0] && t < tFlip);
    f.rider.pose =
      t >= tFlip && t < tLand + 0.3
        ? 'armsUp'
        : t > A_CLEAR[0] + CONTACT && t < A_CLEAR[1]
          ? 'wave'
          : 'ride';
  };
  return {
    duration,
    word: 'BOING!',
    beats: { b1: A_CLEAR[0], b2: A_CLEAR[1], b3: A_CLEAR[2], flip: tFlip, land: tLand },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      ...A_CLEAR.map((a, i): Ev => [a + 0.02, 'sfx:boing', BALLOON_X[i], BOUNCE_Y]),
      [A_CLEAR[1] - 0.25, 'word', BALLOON_X[1], 5.5],
      ...trail(tFlip + 0.05, tLand - 0.05, 0.12, 'spark', bike),
      [tLand, 'dust', 19.8, 0.1],
      [tLand, 'sfx:chime', 19.8, 1],
      [duration * 0.96, 'cheer', 22.5, 2],
    ],
  };
})();

const crash2: Def = (() => {
  const duration = 4.3;
  const tHit = 1.62;
  const tHay = 2.25;
  const tSink = 2.5;
  const tRest = 2.9;
  const hit = { x: 10.95, y: 3.0 };
  const hayX = 11.6;
  const path = route([
    [0, 0, BIKE_Y],
    [0.5, 5.0, BIKE_Y],
    [A_CLEAR[0], BALLOON_X[0], BOUNCE_Y, 5.0],
    [A_CLEAR[0] + CONTACT / 2, BALLOON_X[0] + 0.1, BOUNCE_Y - 0.35, undefined, 'o'],
    [A_CLEAR[0] + CONTACT, BALLOON_X[0] + 0.2, BOUNCE_Y, undefined, 'i'],
    [tHit, hit.x, hit.y, 5.0],
    [tHay, hayX, HAY_TOP + 0.5, hit.y],
    [tSink, hayX + 0.1, HAY_TOP - 0.4, undefined, 'o'],
  ]);
  const seat = hipOf(hit.x, hit.y, 0);
  const hips0 = { x: seat.x, y: seat.y };
  const tSit = 2.4;
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
    [A_CLEAR[0] + CONTACT, 0],
    [tHit, -0.1],
    [tHay, -0.6, 'i'],
    [tRest, 1.1, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    const p = path(t);
    f.bike.x = p.x;
    f.bike.y = p.y;
    const hop = A_CLEAR[0] + CONTACT;
    if (t < 0.5) f.bike.pitch = 0;
    else if (t < A_CLEAR[0]) f.bike.pitch = lean((t - 0.5) / (A_CLEAR[0] - 0.5), heading(path, t));
    else if (t < hop) f.bike.pitch = 0;
    else if (t < tHit) f.bike.pitch = lean((t - hop) / (tHit - hop), heading(path, t), 0.3);
    else f.bike.pitch = pitch(t);
    f.bike.squash = Math.max(
      1 - 0.3 * bump(t, tHay + 0.05, 0.15) - 0.2 * bump(t, A_CLEAR[0] + CONTACT / 2, 0.09),
      0.5,
    );
    f.bike.grounded = t < 0.5 || (t >= tHay && t < tRest);
    if (t >= tHit) {
      const r = rider(t);
      const landed = t >= tSit;
      setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'dizzy' : 'scared');
    } else if (t > A_CLEAR[0] + CONTACT) {
      f.rider.face = 'scared';
    }
  };
  return {
    duration,
    word: 'POP!',
    beats: { b1: A_CLEAR[0], pop: tHit, hay: tHay, sit: tSit },
    at,
    events: () => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [A_CLEAR[0] + 0.02, 'sfx:boing', BALLOON_X[0], BOUNCE_Y],
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

// ---------- Element 3: Ferris Launch (the finale) ----------

/** The Ferris wheel: its middle, radius and how far below a gondola's pivot the bike sits. */
export const FERRIS = { cx: 12.5, cy: 3.9, r: 2.5, drop: 0.4, gondolas: 8 };
/** Where gondola pivots are when the wheel has turned `theta` (the bottom one starts at the foot). */
export function ferrisPivot(theta: number, index = 0): Pos {
  const a = -Math.PI / 2 + theta + (index * TAU) / FERRIS.gondolas;
  return { x: FERRIS.cx + FERRIS.r * Math.cos(a), y: FERRIS.cy + FERRIS.r * Math.sin(a) };
}
/** The bike's middle in the loading gondola, whose floor is tilted by `tilt` about the pivot. */
function carried(theta: number, tilt: number): Pos {
  const p = ferrisPivot(theta);
  return { x: p.x + FERRIS.drop * Math.sin(tilt), y: p.y - FERRIS.drop * Math.cos(tilt) };
}
/** The ramp onto the loading gondola's platform. */
export const FERRIS_RAMP = { from: 8.2, to: 10.8, end: 14.2, height: 0.58 };
export const ferrisSurface: Surface = (x) =>
  x <= FERRIS_RAMP.from || x > FERRIS_RAMP.end
    ? 0
    : x <= FERRIS_RAMP.to
      ? (FERRIS_RAMP.height * (x - FERRIS_RAMP.from)) / (FERRIS_RAMP.to - FERRIS_RAMP.from)
      : FERRIS_RAMP.height;

const F_BOARD = 1.65;
/** Cotton candy pile in the crash: its top and where it sits. */
export const CANDY = { x: 20.8, top: 1.5, halfW: 2.2 };

const boardX = track([
  [0, 0],
  [1.05, 10.5, 'l'],
  [F_BOARD, FERRIS.cx, 'o'],
]);

/** The wheel's turn (radians) and the loading gondola's tilt at time t of the clear or the crash. */
const F_CLEAR = { turn: 3.0, tip: 3.3, land: 4.5, duration: 5.2, theta: 1.9, tilt: 0.5 };
const F_CRASH = { turn: 3.25, duration: 5.0, theta: 2.3 * TAU };
const thetaClear = track([
  [F_BOARD, 0],
  [F_CLEAR.turn, F_CLEAR.theta, 'io'],
  [F_CLEAR.duration, F_CLEAR.theta + 0.7, 'l'],
]);
const tiltClear = track([
  [F_CLEAR.turn, 0],
  [F_CLEAR.tip, F_CLEAR.tilt, 'io'],
  [F_CLEAR.tip + 0.5, 0, 'io'],
]);
const thetaCrash = track([
  [F_BOARD, 0],
  [F_CRASH.turn, F_CRASH.theta, 'io'],
  [F_CRASH.duration, F_CRASH.theta + 1.2, 'o'],
]);

/** How far the Ferris wheel has turned at time t of the clear or the crash, and the gondola tilt. */
export function ferrisTurn(outcome: 'clear' | 'crash', t: number): number {
  return outcome === 'clear' ? thetaClear(t) : thetaCrash(t);
}
export function ferrisTilt(outcome: 'clear' | 'crash', t: number): number {
  return outcome === 'clear' ? tiltClear(t) : 0;
}

const clear3: Def = (() => {
  const { turn, tip, land, duration, theta, tilt } = F_CLEAR;
  const start = carried(theta, tilt);
  const xLand = 22;
  const flight = route([
    [tip, start.x, start.y],
    [land, xLand, BIKE_Y, 5.7],
  ]);
  const roll = track([
    [land, xLand],
    [duration, 26, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < F_BOARD) {
      ride(f, ferrisSurface, boardX(t));
    } else if (t < tip) {
      const p = carried(thetaClear(t), tiltClear(t));
      f.bike.x = p.x;
      f.bike.y = p.y;
      f.bike.pitch = tiltClear(t);
      f.bike.grounded = false;
    } else if (t < land) {
      const p = flight(t);
      f.bike.x = p.x;
      f.bike.y = p.y;
      f.bike.pitch = lerp(tilt, 2 * TAU, flipEase((t - tip) / (land - tip)));
      f.bike.grounded = false;
    } else {
      f.bike.x = roll(t);
      f.bike.pitch = 2 * TAU;
      f.bike.squash = 1 - 0.15 * bump(t, land + 0.05, 0.12);
    }
    if (t >= turn - 0.2 && t < duration - 0.2) f.rider.pose = 'armsUp';
  };
  return {
    duration,
    word: 'SKY HIGH!',
    beats: { board: F_BOARD, turn, tip, launch: tip, land },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [F_BOARD, 'sfx:bump', FERRIS.cx, 0.8],
      [F_BOARD, 'dust', FERRIS.cx - 1, 0.1],
      [tip, 'sfx:whoosh', start.x, start.y],
      [tip, 'sfx:boing', start.x, start.y],
      ...trail(tip + 0.1, land - 0.1, 0.12, 'spark', bike),
      [3.95, 'word', 18.6, 6.0],
      [3.95, 'confetti', 18.6, 5.8],
      [4.02, 'confetti', 17.2, 5.4],
      [3.95, 'sfx:chime', 18.6, 5.8],
      [land, 'dust', xLand, 0.1],
      [land, 'confetti', xLand + 0.5, 2],
      [land + 0.12, 'confetti', xLand + 1.8, 2.4],
      [land + 0.1, 'sfx:chime', xLand, 1],
      [duration * 0.96, 'cheer', 25, 2],
    ],
  };
})();

const crash3: Def = (() => {
  const { turn, duration, theta } = F_CRASH;
  const start = carried(theta, 0);
  const tLand = 3.8;
  const tSit = 3.85;
  const bikeEnd = { x: CANDY.x - 0.2, y: CANDY.top + 0.55 };
  const flight = route([
    [turn, start.x, start.y],
    [tLand, bikeEnd.x, bikeEnd.y, 5.6],
    [tLand + 0.1, bikeEnd.x + 0.05, bikeEnd.y - 0.5, undefined, 'o'],
  ]);
  const seat = hipOf(start.x, start.y, 0);
  const hips0 = { x: seat.x, y: seat.y };
  const sit = { x: CANDY.x + 1.8, y: CANDY.top + 0.3 };
  const rider = route([
    [turn, hips0.x, hips0.y],
    [tSit, sit.x, sit.y, 5.5],
  ]);
  const riderRot = track([
    [turn, 0],
    [tSit, -TAU, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < F_BOARD) {
      ride(f, ferrisSurface, boardX(t));
    } else if (t < turn) {
      const p = carried(thetaCrash(t), 0);
      f.bike.x = p.x;
      f.bike.y = p.y;
      f.bike.grounded = false;
    } else {
      const p = flight(t);
      f.bike.x = p.x;
      f.bike.y = p.y;
      f.bike.pitch = lerp(0, TAU + 0.4, flipEase((t - turn) / (tLand - turn)));
      f.bike.grounded = false;
      f.bike.squash = 1 - 0.25 * bump(t, tLand + 0.04, 0.1);
    }
    if (t >= 2.0 && t < turn) {
      f.rider.pose = 'flail';
      f.rider.face = t >= 2.6 ? 'dizzy' : 'scared';
    }
    if (t >= turn) {
      const r = rider(t);
      const landed = t >= tSit;
      setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'dizzy' : 'scared');
    }
  };
  return {
    duration,
    word: 'DIZZY!',
    beats: { board: F_BOARD, fling: turn, land: tLand },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [F_BOARD, 'sfx:bump', FERRIS.cx, 0.8],
      ...trail(2.3, turn - 0.1, 0.2, 'sweat', bike, 0.8),
      [turn, 'word', 17, 5.6],
      [turn, 'sfx:slideWhistle', start.x, start.y],
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
  elements: [
    {
      name: 'Human Cannon',
      length: 20,
      floorY: 0,
      height: 5.0,
      cuts: [],
      clear: clear1,
      crash: crash1,
    },
    {
      name: 'Balloon Hop',
      length: 24,
      floorY: -2.5,
      height: 5.8,
      cuts: [BALLOON_PIT],
      clear: clear2,
      crash: crash2,
    },
    {
      name: 'Ferris Launch',
      length: 26,
      floorY: 0,
      height: 6.4,
      cuts: [],
      clear: clear3,
      crash: crash3,
    },
  ],
};
