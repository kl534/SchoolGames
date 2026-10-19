/**
 * Mega course 3: Volcano Rush. A leap over a lava lake, a run through rolling boulders and the
 * volcano that fires the bike into the sky. Pure animation data like stunts.ts: element-local
 * coordinates (x = 0 at the element's entry line, the road at y = 0).
 *
 * Every element starts as the standard arrival pose and a cleared one ends riding on the road at
 * its `length`, so the three chain. A crash comes to rest (the rider is always fine).
 */
import {
  arc,
  BIKE_Y,
  createFrame,
  hipOf,
  ride,
  rearRide,
  REAR,
  rideW,
  setFree,
  settleAt,
  smooth,
  TAU,
  track,
  trail,
  type Def,
  type Frame,
  type Pos,
  type Surface,
} from '../stunts';
import { bump, flipEase, route } from './anim';
import type { MegaSpec } from './mega';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

// ---------- Element 1: Lava Leap ----------

/** The lava lake: the cut in the road, the lava's surface and the bottom of the lake. */
export const LAVA_FROM = 5;
export const LAVA_TO = 17;
export const LAVA_Y = -1.3;
export const LAVA_FLOOR = -2.6;

const kicker = (x: number, h: number, len: number) => {
  const v = clamp01(x / len);
  return h * (0.5 * v + 0.5 * v * v);
};
/** The road over the lake: the stone ramp, the lake (a long way down) and the far bank. */
export const leapSurface: Surface = (x) => {
  if (x <= 1) return 0;
  if (x <= LAVA_FROM) return kicker(x - 1, 1.4, 4);
  if (x < LAVA_TO) return -9;
  if (x <= 20.5) return (20.5 - x) / 3.5;
  return 0;
};

const LEAP_X0 = 4.2; // the bike's middle when its front wheel reaches the lip
const leapLaunch = (() => {
  const f = createFrame();
  ride(f, leapSurface, LEAP_X0);
  return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
})();

const clear1: Def = (() => {
  const duration = 2.3;
  const tLip = 0.4;
  const tLand = 1.6;
  const xLand = 18.2;
  const land = (() => {
    const f = createFrame();
    ride(f, leapSurface, xLand);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const midX = track([
    [0, 0, 'l'],
    [tLip, LEAP_X0, 'l'],
  ]);
  const flightPitch = track([
    [tLip, leapLaunch.pitch],
    [0.8, 0.35],
    [1.2, 0.1],
    [tLand, land.pitch],
  ]);
  const xm = track([
    [tLand, xLand],
    [duration, 22, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, leapSurface, midX(t), settleAt(t));
    } else if (t < tLand) {
      const u = (t - tLip) / (tLand - tLip);
      f.bike.x = lerp(leapLaunch.x, land.x, u);
      f.bike.y = arc(leapLaunch.y, land.y, 4.0, u);
      f.bike.pitch = flightPitch(t);
      f.bike.grounded = false;
      if (t > 0.7 && t < 1.35) f.rider.pose = 'balance';
    } else {
      ride(f, leapSurface, xm(t));
      f.bike.squash = 1 - 0.15 * bump(t, tLand + 0.05, 0.1);
    }
  };
  return {
    duration,
    word: 'HOT HOT HOT!',
    beats: { launch: tLip, peak: 1.0, land: tLand },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [0.8, 'flame', 8.5, LAVA_Y],
      [1.0, 'word', 11.2, 5.0],
      [1.0, 'smoke', 11.5, LAVA_Y],
      [1.15, 'flame', 13.5, LAVA_Y],
      ...trail(tLip + 0.1, tLand - 0.1, 0.18, 'spark', bike),
      [tLand, 'dust', xLand, 0.9],
      [tLand, 'sfx:chime', xLand, 1],
      [duration * 0.93, 'cheer', 21, 2],
    ],
  };
})();

const crash1: Def = (() => {
  const duration = 4.0;
  const tLip = 0.4;
  const tHit = 1.45;
  const tFall = 2.15;
  const tSink = 2.4;
  const tFloat = 2.95;
  // The front wheel strikes the face of the far bank, just under its lip.
  const p = 0.5;
  const hit = (() => {
    const axleX = LAVA_TO - 0.05;
    const axleY = 0.75 + 0.42;
    return { x: axleX - REAR * Math.cos(p), y: axleY - REAR * Math.sin(p) };
  })();
  const midX = track([
    [0, 0, 'l'],
    [tLip, LEAP_X0, 'l'],
  ]);
  const bounce = { x: hit.x - 0.7, y: 1.7 };
  const afloat = { x: 15.1, y: LAVA_Y + 0.25 };
  const path = route([
    [tLip, leapLaunch.x, leapLaunch.y],
    [tHit, hit.x, hit.y, 3.6],
    [1.75, bounce.x, bounce.y, 2.0],
    [tFall, afloat.x, LAVA_Y + 0.15, bounce.y],
    [tSink, afloat.x, LAVA_Y - 0.6, undefined, 'o'],
    [tFloat, afloat.x, afloat.y, undefined, 'io'],
  ]);
  const pitch = track([
    [tLip, leapLaunch.pitch],
    [1.0, 0.4],
    [tHit, p],
    [tFall, -1.0, 'io'],
    [tSink, -0.6],
    [tFloat, 0.3, 'io'],
  ]);
  // The rider shoots over the handlebars onto the far bank and sits there, sooty.
  const seat = hipOf(hit.x, hit.y, p);
  const hips0 = { x: seat.x, y: seat.y };
  const tSit = 2.35;
  const sit = { x: 19.4, y: 0.56 };
  const rider = route([
    [tHit, hips0.x, hips0.y],
    [tSit, sit.x, sit.y, 3.9],
  ]);
  const riderRot = track([
    [tHit, 0],
    [tSit, -TAU, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, leapSurface, midX(t), settleAt(t));
    } else {
      const q = path(t);
      f.bike.x = q.x;
      f.bike.y = q.y;
      f.bike.pitch = pitch(t);
      f.bike.grounded = false;
      if (t > tHit) f.bike.squash = 1 - 0.2 * bump(t, tHit + 0.05, 0.1);
    }
    if (t >= tHit - 0.2) f.rider.face = 'scared';
    if (t >= tHit) {
      const r = rider(t);
      const landed = t >= tSit;
      setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'sooty' : 'scared');
    }
  };
  return {
    duration,
    word: 'SIZZLE!',
    beats: { launch: tLip, hit: tHit, fall: tFall, float: tFloat },
    at,
    events: () => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [tHit, 'groan', hit.x, hit.y],
      [tHit, 'sfx:bump', LAVA_TO, 0.9],
      [tHit, 'debris', LAVA_TO, 0.9],
      [tFall, 'word', afloat.x, LAVA_Y + 1.2],
      [tFall, 'smoke', afloat.x, LAVA_Y],
      [tFall + 0.05, 'flame', afloat.x - 0.5, LAVA_Y],
      [tFall + 0.1, 'sfx:splat', afloat.x, LAVA_Y],
      [tSit, 'dust', sit.x, sit.y],
      [tSit + 0.2, 'stars', sit.x, sit.y + 1.5],
      [2.6, 'smoke', afloat.x, LAVA_Y + 0.3],
      [2.85, 'smoke', afloat.x + 0.3, LAVA_Y + 0.6],
      [3.1, 'smoke', afloat.x, LAVA_Y + 0.9],
    ],
  };
})();

// ---------- Element 2: Boulder Run ----------

export const BOULDER_R = 1.0;
/** The rocky hillside behind the road that the boulders roll down. */
export const HILL = { foot: 19.5, top: 22.2, height: 3.6, end: 26.8 };
export const hillY = (x: number): number =>
  x <= HILL.foot
    ? 0
    : x >= HILL.top
      ? HILL.height
      : (HILL.height * (x - HILL.foot)) / (HILL.top - HILL.foot);
/** Where the three boulders wait on top of the hill, and the depth they roll at up there. */
export const BOULDER_PARK: readonly [number, number, number] = [22.9, 24.5, 26.1];
export const BOULDER_HILL_Z = -1.6;
const PARK_Y = HILL.height + BOULDER_R;
const R = BOULDER_R;

/** A boulder at some moment: where, how far it has turned, and the depth it rolls at. */
export interface Boulder {
  x: number;
  y: number;
  z: number;
  rot: number;
}

const edge = [HILL.top, PARK_Y] as const;
const bouldersClear = [
  route([
    [0, BOULDER_PARK[0], PARK_Y],
    [0.12, edge[0], PARK_Y],
    [0.4, HILL.foot, R, undefined, 'i'],
    [1.07, 10, R],
    [3.0, -6, R],
  ]),
  route([
    [0, BOULDER_PARK[1], PARK_Y],
    [0.45, BOULDER_PARK[1], PARK_Y],
    [0.6, edge[0], PARK_Y],
    [0.95, HILL.foot, R, undefined, 'i'],
    [1.22, 17.0, R],
    [1.5, 14.2, 4.3, 4.3],
    [1.85, 11.2, R, 4.3],
    [3.0, -3, R],
  ]),
  route([
    [0, BOULDER_PARK[2], PARK_Y],
    [1.0, BOULDER_PARK[2], PARK_Y],
    [1.1, edge[0], PARK_Y],
    [1.45, HILL.foot, R],
    [1.9, 17.0, R],
    [3.0, 8.0, R],
  ]),
] as const;

/** When the third boulder meets the bike in the crash, and when the bike drops off it. */
const BONK = { hit: 1.9, drop: 2.75 };
/** How far in front of the boulder's middle (in depth) the stuck bike is held. */
const STICK_Z = BOULDER_R + 0.3;
/** In the crash the third boulder meets the bike a little further along. */
const boulderCrashC = route([
  [0, BOULDER_PARK[2], PARK_Y],
  [1.0, BOULDER_PARK[2], PARK_Y],
  [1.1, edge[0], PARK_Y],
  [1.45, HILL.foot, R],
  [1.9, 18.4, R],
  [BONK.drop, 11.6, R],
  // After it drops the bike it bounces away over the road, high above the rider.
  [BONK.drop + 0.65, 6.0, 3.8, 3.8],
  [BONK.drop + 1.5, -6, R, 3.8],
]);

const boulderZ = (x: number, road: number): number =>
  x >= HILL.foot ? BOULDER_HILL_Z : lerp(BOULDER_HILL_Z, road, smooth((HILL.foot - x) / 3));

/** The boulder `index` (0 to 2) at time t of the clear or the crash of Boulder Run. */
export function boulderAt(
  outcome: 'clear' | 'crash',
  index: 0 | 1 | 2,
  t: number,
  out: Boulder = { x: 0, y: 0, z: 0, rot: 0 },
): Boulder {
  const path = index === 2 && outcome === 'crash' ? boulderCrashC : bouldersClear[index];
  const p = path(t);
  const road = index === 2 && outcome === 'clear' ? 0.35 : 0;
  out.x = p.x;
  out.y = p.y;
  out.z = boulderZ(p.x, road);
  out.rot = (BOULDER_PARK[index] - p.x) / R;
  return out;
}

const bikeX2 = track([
  [0, 0, 'l'],
  [1.07, 10, 'l'],
  [1.5, 14, 'l'],
  [1.9, 17, 'l'],
  [2.9, 24, 'l'],
]);

const clear2: Def = (() => {
  const duration = 2.9;
  const hopFrom = 0.85;
  const hopTo = 1.3;
  const duckFrom = 1.3;
  const duckTo = 1.75;
  const asideFrom = 1.65;
  const asideTo = 2.2;
  const at = (t: number, f: Frame) => {
    f.bike.x = bikeX2(t);
    if (t > hopFrom && t < hopTo) {
      const u = (t - hopFrom) / (hopTo - hopFrom);
      f.bike.y = BIKE_Y + 2.6 * Math.sin(Math.PI * u);
      f.bike.pitch = 0.4 * Math.sin(Math.PI * u);
      f.bike.grounded = false;
      f.rider.pose = 'wheelie';
    }
    if (t >= duckFrom && t < duckTo) f.rider.pose = 'duck';
    if (t > asideFrom && t < asideTo) {
      const u = (t - asideFrom) / (asideTo - asideFrom);
      f.bike.z = -1.2 * Math.sin(Math.PI * u);
      f.bike.roll = 0.18 * Math.sin(2 * Math.PI * u);
    }
    if (t >= asideTo && t < duration - 0.2) f.rider.pose = 'thumbs';
  };
  return {
    duration,
    word: 'WHOA!',
    beats: { a: 1.07, b: 1.5, c: 1.9, hop: hopFrom },
    at,
    events: () => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [1.07, 'sfx:whoosh', 10, 1.5],
      [hopTo, 'dust', 12.2, 0.1],
      [hopTo, 'word', 12.2, 4.4],
      [1.22, 'dust', 17, 0.1],
      [1.85, 'sfx:bump', 11.2, 0.2],
      [1.85, 'dust', 11.2, 0.1],
      [1.9, 'sfx:whoosh', 17, 1],
      [duration * 0.95, 'cheer', 23, 2],
    ],
  };
})();

const crash2: Def = (() => {
  const duration = 4.2;
  const { hit, drop } = BONK;
  const hopFrom = 0.85;
  const hopTo = 1.3;
  const duckFrom = 1.3;
  const duckTo = 1.75;
  const scratch: Boulder = { x: 0, y: 0, z: 0, rot: 0 };
  const rollOf = (t: number) => boulderAt('crash', 2, t, scratch).rot;
  const hitRot = rollOf(hit);
  const STUCK = BOULDER_R + 0.4;
  /** The bike stuck to the third boulder's left side: where it is at time t. */
  const stuck = (t: number, out: Pos): number => {
    const c = boulderAt('crash', 2, t, scratch);
    const phi = Math.PI + (c.rot - hitRot);
    out.x = c.x + STUCK * Math.cos(phi);
    out.y = c.y + STUCK * Math.sin(phi);
    return phi - Math.PI;
  };
  const here: Pos = { x: 0, y: 0 };
  const stuckAtDrop = { x: 0, y: 0, pitch: 0 };
  stuckAtDrop.pitch = stuck(drop, here);
  stuckAtDrop.x = here.x;
  stuckAtDrop.y = here.y;
  const restX = stuckAtDrop.x - 1.1;
  const fall = route([
    [drop, stuckAtDrop.x, stuckAtDrop.y],
    [drop + 0.25, restX, BIKE_Y, stuckAtDrop.y],
  ]);
  const squash = track([
    [hit, 1],
    [hit + 0.08, 0.3, 'o'],
    [drop + 0.2, 0.3],
    [drop + 0.4, 1, 'o'],
  ]);
  // The rider is shot over the handlebars, over the boulder, and sits down on the road behind it.
  const seat = hipOf(bikeX2(hit), BIKE_Y, 0);
  const hips0 = { x: seat.x, y: seat.y };
  const tSit = 2.9;
  const sit = { x: 6.6, y: 0.25 };
  const rider = route([
    [hit, hips0.x, hips0.y],
    [tSit, sit.x, sit.y, 5.0],
  ]);
  const riderRot = track([
    [hit, 0],
    [tSit, -TAU, 'io'],
  ]);
  const lift = track([
    [hit, BIKE_Y],
    [hit + 0.15, 1.0, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < hit) {
      f.bike.x = bikeX2(t);
      if (t > hopFrom && t < hopTo) {
        const u = (t - hopFrom) / (hopTo - hopFrom);
        f.bike.y = BIKE_Y + 2.6 * Math.sin(Math.PI * u);
        f.bike.pitch = 0.4 * Math.sin(Math.PI * u);
        f.bike.grounded = false;
        f.rider.pose = 'wheelie';
      }
      if (t >= duckFrom && t < duckTo) f.rider.pose = 'duck';
    } else if (t < drop) {
      const pitchNow = stuck(t, here);
      const u = clamp01((t - hit) / 0.15);
      f.bike.x = lerp(bikeX2(hit), here.x, u);
      f.bike.y = Math.max(t < hit + 0.15 ? lift(t) + (here.y - 1.0) * u : here.y, 0.75);
      f.bike.pitch = pitchNow * u;
      // Stuck to the front of the boulder like a sticker.
      f.bike.z = STICK_Z * smooth((t - hit) / 0.2);
      f.bike.grounded = false;
    } else {
      const q = fall(t);
      f.bike.x = q.x;
      f.bike.y = q.y;
      f.bike.pitch = lerp(stuckAtDrop.pitch, TAU, smooth((t - drop) / 0.25));
      f.bike.z = STICK_Z * (1 - smooth((t - drop) / 0.25));
      f.bike.grounded = t >= drop + 0.25;
    }
    if (t >= hit) f.bike.squash = squash(t);
    if (t >= hit) {
      const r = rider(t);
      const landed = t >= tSit;
      setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'dizzy' : 'scared');
    } else if (t > hit - 0.3) {
      f.rider.face = 'scared';
    }
  };
  return {
    duration,
    word: 'BONK!',
    beats: { a: 1.07, b: 1.5, hit, drop, sit: tSit },
    at,
    events: () => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [hopTo, 'dust', 12.2, 0.1],
      [1.22, 'dust', 17, 0.1],
      [1.85, 'sfx:bump', 11.2, 0.2],
      [hit, 'groan', 17.4, 1.2],
      [hit, 'sfx:crash', 17.4, 1.2],
      [hit, 'debris', 17.4, 1.2],
      [hit + 0.05, 'word', 16.6, 3.6],
      [drop, 'sfx:bump', stuckAtDrop.x, 0.6],
      [drop + 0.2, 'dust', restX, 0.1],
      [tSit, 'sfx:splat', sit.x, 0.4],
      [tSit, 'poof', sit.x, 0.6],
      [tSit + 0.2, 'stars', sit.x, 1.9],
    ],
  };
})();

// ---------- Element 3: Eruption Launch (the finale) ----------

/** The volcano: its feet, its crater rim, the depth of the bowl and the height of the rim. */
export const VOLCANO = {
  footL: 6.5,
  rimL: 11.8,
  rimR: 15.2,
  footR: 22,
  height: 3.8,
  bowl: 1.0,
  /** x of the middle of the crater. */
  cx: 13.5,
};

/** The ride over the volcano: up the near slope, into the crater and down the far slope. */
export const volcanoSurface: Surface = (x) => {
  const V = VOLCANO;
  if (x <= V.footL) return 0;
  if (x <= V.rimL) return (V.height * (x - V.footL)) / (V.rimL - V.footL);
  if (x <= V.rimR)
    return V.height - V.bowl * Math.sin((Math.PI * (x - V.rimL)) / (V.rimR - V.rimL));
  if (x <= V.footR) return (V.height * (V.footR - x)) / (V.footR - V.rimR);
  return 0;
};

/** The bike's middle as it climbs to the crater (the same in the clear and the crash). */
const climbX = track([
  [0, 0, 'l'],
  [0.65, 6.5, 'l'],
  [1.3, 11.8, 'l'],
  [1.75, VOLCANO.cx, 'q'],
]);
const T_CHARGE = 1.75;

const bowlBike = (() => {
  const f = createFrame();
  ride(f, volcanoSurface, VOLCANO.cx);
  return { x: f.bike.x, y: f.bike.y };
})();

/** Riding up the slope and shivering in the crater until the volcano goes off at `blast`. */
function climb(t: number, f: Frame, blast: number): void {
  ride(f, volcanoSurface, climbX(t), settleAt(t));
  if (t > T_CHARGE && t < blast) {
    const k = (t - T_CHARGE) / (blast - T_CHARGE);
    f.bike.x += 0.05 * k * Math.sin(t * 55);
    f.bike.y += 0.05 * k * Math.sin(t * 61);
    f.bike.grounded = false;
    f.rider.face = 'scared';
  }
}

const clear3: Def = (() => {
  const duration = 4.3;
  const blast = 2.05;
  const tLand = 3.3;
  const rxLand = 18.6;
  const wLand = 0.35;
  const land = (() => {
    const f = createFrame();
    rearRide(f, volcanoSurface, rxLand, wLand);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const rx = track([
    [tLand, rxLand],
    [duration, 25.2, 'l'],
  ]);
  const w = track([
    [tLand, wLand],
    [3.85, wLand, 'l'],
    [4.2, 0],
  ]);
  const flips = 3 * TAU;
  const at = (t: number, f: Frame) => {
    if (t < blast) {
      climb(t, f, blast);
    } else if (t < tLand) {
      const u = (t - blast) / (tLand - blast);
      f.bike.x = lerp(bowlBike.x, land.x, u);
      f.bike.y = arc(bowlBike.y, land.y, 5.8, u);
      f.bike.pitch = lerp(0, flips + land.pitch, flipEase(u));
      f.bike.grounded = false;
      f.rider.pose = 'armsUp';
    } else {
      rideW(f, volcanoSurface, rx(t) + REAR, w(t));
      f.bike.pitch += flips;
      f.bike.squash = 1 - 0.15 * bump(t, tLand + 0.05, 0.1);
      f.bike.grounded = w(t) < 0.05;
      if (w(t) > 0.2) f.rider.pose = 'wheelie';
    }
  };
  return {
    duration,
    word: 'ERUPTION!',
    beats: { charge: T_CHARGE, blast, peak: 2.65, land: tLand },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [T_CHARGE, 'smoke', VOLCANO.cx, VOLCANO.height],
      [1.9, 'smoke', VOLCANO.cx + 0.4, VOLCANO.height + 0.3],
      [blast, 'sfx:boom', VOLCANO.cx, VOLCANO.height],
      [blast, 'flame', VOLCANO.cx, VOLCANO.height],
      [blast, 'debris', VOLCANO.cx, VOLCANO.height],
      [blast + 0.05, 'smoke', VOLCANO.cx, VOLCANO.height + 0.5],
      ...trail(blast + 0.1, tLand - 0.4, 0.12, 'flame', bike),
      [2.65, 'word', 15.4, 6.2],
      [2.65, 'confetti', 15.4, 5.8],
      [2.72, 'spark', 14.2, 5.0],
      [2.8, 'confetti', 16.6, 5.4],
      [tLand, 'dust', rxLand, 1.9],
      [tLand, 'smoke', rxLand, 2.0],
      [tLand, 'sfx:chime', rxLand, 2],
      [tLand + 0.1, 'confetti', rxLand + 1, 2.6],
      [duration * 0.96, 'cheer', 25, 2],
    ],
  };
})();

const crash3: Def = (() => {
  const duration = 4.6;
  const burp = 2.05;
  const tLand = 3.5;
  const foot = { x: 5.8, y: BIKE_Y };
  const nearSlope = { x: 9.6, y: 2.7 };
  const cork = route([
    [burp, bowlBike.x, bowlBike.y],
    [2.35, 13.0, 4.9, 4.9],
    [2.9, nearSlope.x, nearSlope.y, 4.9],
    [tLand, foot.x, foot.y],
  ]);
  const spin = track([
    [burp, 0],
    [tLand, 2 * TAU, 'io'],
  ]);
  const seat = hipOf(bowlBike.x, bowlBike.y, 0);
  const hips0 = { x: seat.x, y: seat.y };
  const tSit = 3.45;
  const sit = { x: 3.6, y: 0.25 };
  const rider = route([
    [burp, hips0.x, hips0.y],
    [2.5, 12.0, 5.4, 5.4],
    [tSit, sit.x, sit.y, 5.4],
  ]);
  const riderRot = track([
    [burp, 0],
    [tSit, -2 * TAU, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < burp) {
      climb(t, f, burp);
    } else {
      const p = cork(t);
      f.bike.x = p.x;
      f.bike.y = p.y;
      f.bike.pitch = spin(t);
      f.bike.grounded = t >= tLand - 0.05;
      f.bike.squash = 1 - 0.2 * bump(t, tLand, 0.1);
      const r = rider(t);
      const landed = t >= tSit;
      setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'sooty' : 'scared');
    }
  };
  return {
    duration,
    word: 'COUGH!',
    beats: { charge: T_CHARGE, burp, tumble: 2.9, land: tLand },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [T_CHARGE, 'smoke', VOLCANO.cx, VOLCANO.height],
      [burp, 'groan', VOLCANO.cx, VOLCANO.height],
      [burp, 'sfx:boing', VOLCANO.cx, VOLCANO.height],
      [burp, 'smoke', VOLCANO.cx, VOLCANO.height + 0.4],
      [burp + 0.1, 'smoke', VOLCANO.cx + 0.5, VOLCANO.height + 0.8],
      [burp + 0.2, 'debris', VOLCANO.cx, VOLCANO.height],
      [2.1, 'word', 13.3, 5.4],
      ...trail(2.45, 2.85, 0.2, 'smoke', bike),
      [2.9, 'sfx:bump', nearSlope.x, nearSlope.y],
      [2.9, 'dust', nearSlope.x, nearSlope.y - 0.3],
      [tSit, 'sfx:splat', sit.x, 0.4],
      [tSit, 'poof', sit.x, 0.6, 0x8a8a92],
      [tLand, 'dust', foot.x, 0.1],
      [tLand + 0.2, 'stars', sit.x, 1.9],
    ],
  };
})();

// ---------- The course ----------

export const VOLCANO_RUSH: MegaSpec = {
  id: 'volcano-rush',
  title: 'Volcano Rush',
  emoji: '🌋',
  elements: [
    {
      name: 'Lava Leap',
      length: 22,
      floorY: LAVA_FLOOR,
      height: 4.4,
      cuts: [[LAVA_FROM, LAVA_TO]],
      clear: clear1,
      crash: crash1,
    },
    {
      name: 'Boulder Run',
      length: 24,
      floorY: 0,
      height: 5.2,
      cuts: [],
      clear: clear2,
      crash: crash2,
    },
    {
      name: 'Eruption Launch',
      length: 26,
      floorY: 0,
      height: 6.4,
      cuts: [],
      clear: clear3,
      crash: crash3,
    },
  ],
};
