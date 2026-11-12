/**
 * Mega course 5: Ice Slide. A glassy ice ramp where the bike drifts, a wall of three snowmen to
 * smash through and a jump over an igloo onto an ice rink. Pure animation data like stunts.ts:
 * element-local coordinates (x = 0 at the element's entry line, the road at y = 0).
 *
 * Every element starts as the standard arrival pose and a cleared one ends riding on the road at
 * its `length`, so the three chain. A crash comes to rest (the rider is always fine). Slow motion
 * (`slow`) at the drift, the first smash, the igloo peak and the crashes' worst moments.
 */
import {
  arc,
  BIKE_Y,
  createFrame,
  fly,
  hipOf,
  prog,
  ride,
  rideW,
  setFree,
  settleAt,
  TAU,
  track,
  trail,
  type Def,
  type Ev,
  type Frame,
  type Piece,
  type Surface,
} from '../stunts';
import { bump, flipEase, pchip, route } from './anim';
import type { MegaSpec } from './mega';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const WHITE = 0xffffff;
const ICE_BLUE = 0xbfeaff;

/** The same events in white (snow), for a stretch of white dust behind the bike. */
const white = (events: Ev[]): Ev[] => events.map(([at, type, x, y]) => [at, type, x, y, WHITE]);

// ---------- Element 1: Ice Ramp ----------

/** The top of the ice ramp, where the crest is. */
export const ICE_TOP = 2.4;
/** The ramp: flat, up to the crest at x = 9, a smooth slope down to the road at x = 16. */
export const iceSurface: Surface = (x) => {
  if (x <= 2) return 0;
  if (x <= 9) {
    const v = (x - 2) / 7;
    return ICE_TOP * (0.5 * v + 0.5 * v * v);
  }
  if (x < 16) return (ICE_TOP * (1 + Math.cos((Math.PI * (x - 9)) / 7))) / 2;
  return 0;
};
/** The crest, where the clear drifts and the crash loses its grip. */
export const ICE_CREST = 9;
/** The snowbank at the end of the ramp that the crashed bike ploughs into (always there). */
export const BANK = { x: 21.2, halfW: 2.2, h: 1.6 };

const clear1: Def = (() => {
  const duration = 3.0;
  const drift = { from: 1.0, to: 2.4 };
  const xs = track([
    [0, 0, 'l'],
    [duration, 24, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    ride(f, iceSurface, xs(t), settleAt(t));
    if (t > drift.from - 0.15 && t < drift.to + 0.15) f.rider.pose = 'balance';
    if (t > drift.from && t < drift.to) {
      const u = (t - drift.from) / (drift.to - drift.from);
      // The back end weaves out one way, then the other, and the bike straightens up again.
      f.bike.z = Math.sin(2 * Math.PI * u) * (u < 0.5 ? 0.5 : 0.4);
      f.bike.pitch += 0.15 * Math.sin(4 * Math.PI * u);
      f.bike.roll = 0.25 * Math.sin(2 * Math.PI * u);
    }
  };
  return {
    duration,
    word: 'SKID-TASTIC!',
    beats: { drift: drift.from, peak: 1.7, off: drift.to },
    slow: [1.7],
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [drift.from, 'sfx:whoosh', 8, 2.6],
      ...trail(drift.from, drift.to, 0.14, 'spark', bike, 0.1),
      ...white(trail(drift.from, drift.to, 0.2, 'dust', bike, -0.2)),
      [1.7, 'word', 12.5, 4.8],
      [duration * 0.95, 'cheer', 23, 2],
    ],
  };
})();

const crash1: Def = (() => {
  const duration = 4.2;
  const tGrip = 1.1;
  const tSpin = 2.1;
  const tHit = 2.95;
  const tSit = 2.6;
  const sit = { x: 18.5, y: 0.5 };
  const xs = track([
    [0, 0, 'l'],
    [tGrip, ICE_CREST, 'l'],
    [tHit + 0.05, 19.6, 'q'],
  ]);
  const base = createFrame();
  ride(base, iceSurface, ICE_CREST);
  const seat = hipOf(base.bike.x, base.bike.y, base.bike.pitch);
  const rider = route([
    [tGrip, seat.x, seat.y],
    [tSit, sit.x, sit.y, 4.0],
  ]);
  const riderRot = track([
    [tGrip, 0],
    [tSit, -TAU, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    ride(f, iceSurface, xs(t), settleAt(t));
    if (t > tGrip - 0.25) f.rider.face = 'scared';
    if (t >= tGrip) {
      // The bike spins on the spot for one and a half turns, then slides on its side.
      f.bike.pitch += 3 * Math.PI * prog(t, tGrip, tSpin);
      f.bike.y += 0.9 * Math.sin(Math.PI * prog(t, tGrip, tSpin, 'l')) - 0.1 * prog(t, 2.7, tHit);
      f.bike.roll = (Math.PI / 2) * prog(t, 1.5, 2.6);
      f.bike.grounded = false;
      f.bike.squash = 1 - 0.2 * bump(t, tHit, 0.12);
      const r = rider(t);
      const landed = t >= tSit;
      setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'dizzy' : 'scared');
    }
  };
  return {
    duration,
    word: 'WIPEOUT!',
    beats: { grip: tGrip, spin: tSpin, hit: tHit, sit: tSit },
    slow: [tGrip + 0.2],
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [tGrip, 'groan', ICE_CREST, 3.2],
      [tGrip + 0.1, 'word', 10.5, 4.6],
      ...white(trail(tGrip, tSpin, 0.15, 'dust', bike, -0.2)),
      [tSit, 'dust', sit.x, 0.4, WHITE],
      [tHit, 'sfx:crash', 19.6, 1],
      [tHit, 'poof', 19.6, 1.0, WHITE],
      [tHit, 'debris', 19.6, 1.0, WHITE],
      [3.3, 'stars', sit.x, 2.3],
    ],
  };
})();

// ---------- Element 2: Snowman Wall ----------

/** Where the three snowmen stand. */
export const SNOWMEN: readonly [number, number, number] = [7, 12, 17];
/** Ball radii (bottom, middle, head) of a snowman and of the giant (snowman 3 in the crash). */
export const SNOW_R: readonly [readonly number[], readonly number[]] = [
  [0.7, 0.5, 0.35],
  [1.4, 1.0, 0.7],
];
/** Where each ball's centre sits, standing. */
export const SNOW_Y: readonly [readonly number[], readonly number[]] = [
  [0.7, 1.85, 2.65],
  [1.4, 2.6, 3.7],
];
/** Speed of the bike through the wall (u/s), the same in the clear and the crash. */
const V2 = 22 / 2.4;
/** The bike's middle when its front meets a snowman's left edge. */
const hitX = (s: number, r: number) => SNOWMEN[s] - r - 1.1;
const GIANT_HIT = hitX(2, SNOW_R[1][0]) / V2;
/** When the bike reaches each snowman, in the clear and in the crash. */
const HITS: Record<'clear' | 'crash', readonly [number, number, number]> = {
  clear: [hitX(0, 0.7) / V2, hitX(1, 0.7) / V2, hitX(2, 0.7) / V2],
  crash: [hitX(0, 0.7) / V2, hitX(1, 0.7) / V2, GIANT_HIT],
};
/** Where the giant's head ends up: a snowball hat on the sitting rider's helmet. */
export const SNOW_HAT = { x: 15.2, y: 1.55, scale: 0.5 };
const HAT_LAND = 2.6;

const giantHead = route([
  [GIANT_HIT + 0.1, SNOWMEN[2], SNOW_Y[1][2]],
  [HAT_LAND, SNOW_HAT.x, SNOW_HAT.y, 5.2],
]);

/**
 * Ball `i` of the wall (0 to 8: snowman `i / 3`, ball `i % 3` from the bottom) at time `t` of the
 * clear or the crash: it stands until the bike reaches its snowman, then flies and tumbles to rest
 * on the road. In the crash the giant stands firm except its head. `scale` is its radius.
 */
export function snowPieceAt(
  outcome: 'clear' | 'crash',
  i: number,
  t: number,
  out: Piece = { x: 0, y: 0, rot: 0, scale: 1, visible: true },
): Piece {
  const s = Math.min(Math.max(Math.floor(i / 3), 0), 2);
  const k = ((i % 3) + 3) % 3;
  const giant = outcome === 'crash' && s === 2;
  const r = SNOW_R[giant ? 1 : 0][k];
  const y = SNOW_Y[giant ? 1 : 0][k];
  out.x = SNOWMEN[s];
  out.y = y;
  out.rot = 0;
  out.scale = r;
  out.visible = true;
  if (giant) {
    if (k === 2 && t > GIANT_HIT + 0.1) {
      const p = giantHead(t);
      const u = Math.min((t - GIANT_HIT - 0.1) / (HAT_LAND - GIANT_HIT - 0.1), 1);
      out.x = p.x;
      out.y = p.y;
      out.rot = 5 * (1 - u) * (t - GIANT_HIT);
      out.scale = lerp(r, SNOW_HAT.scale, u);
    }
    return out;
  }
  const dt = t - HITS[outcome][s] - 0.02 * k;
  if (dt <= 0) return out;
  const side = (i + s) % 2 === 0 ? 1 : -1;
  return fly(SNOWMEN[s], y, 2.2 + 0.8 * k + 0.3 * s, 3 + 1.5 * k, 0, side * (3 + k), r, dt, out);
}

const bikeX2 = track([
  [0, 0, 'l'],
  [22 / V2, 22, 'l'],
]);

const clear2: Def = (() => {
  const duration = 2.4;
  const [h1, h2, h3] = HITS.clear;
  const at = (t: number, f: Frame) => {
    f.bike.x = bikeX2(t);
    f.bike.squash = 1 - 0.1 * Math.max(bump(t, h1, 0.08), bump(t, h2, 0.08), bump(t, h3, 0.08));
    if (t > 0.3 && t < 1.8) f.rider.pose = 'armsUp';
    else if (t >= 1.8 && t < duration - 0.2) f.rider.pose = 'thumbs';
  };
  return {
    duration,
    word: 'SNOW SMASH!',
    beats: { hit1: h1, hit2: h2, hit3: h3 },
    slow: [h1],
    at,
    events: () => [
      [0.2, 'sfx:whoosh', 2, 0.5],
      ...[h1, h2, h3].flatMap((h, s): Ev[] => [
        [h, 'poof', SNOWMEN[s], 1.4, WHITE],
        [h, 'debris', SNOWMEN[s], 1.4, WHITE],
        [h, 'sfx:bump', SNOWMEN[s], 1],
      ]),
      [h2 + 0.05, 'word', 11, 4.6],
      [duration * 0.95, 'cheer', 21, 2],
    ],
  };
})();

const crash2: Def = (() => {
  const duration = 3.8;
  const [h1, h2, h3] = HITS.crash;
  const restX = hitX(2, SNOW_R[1][0]) - 1.1;
  const bike = route([
    [h3, hitX(2, SNOW_R[1][0]), BIKE_Y],
    [h3 + 0.5, restX, BIKE_Y, 1.3],
  ]);
  const squash = track([
    [h3, 1],
    [h3 + 0.06, 0.7, 'o'],
    [h3 + 0.4, 0.9],
    [2.3, 1],
  ]);
  const pitch = track([
    [h3, 0],
    [h3 + 0.3, 0.3, 'o'],
    [h3 + 0.7, 0],
  ]);
  // The rider is thrown into the giant's base and slides down it to sit there.
  const seat = hipOf(hitX(2, SNOW_R[1][0]), BIKE_Y, 0);
  const sitAt = 2.4;
  const rider = route([
    [h3, seat.x, seat.y],
    [1.95, SNOW_HAT.x + 0.2, 1.4, 3.2],
    [sitAt, SNOW_HAT.x, 0.25],
  ]);
  const riderRot = track([
    [h3, 0],
    [sitAt, -TAU, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < h3) {
      f.bike.x = bikeX2(t);
      f.bike.squash = 1 - 0.1 * Math.max(bump(t, h1, 0.08), bump(t, h2, 0.08));
      if (t > 0.3) f.rider.pose = 'duck';
      return;
    }
    const q = bike(t);
    f.bike.x = q.x;
    f.bike.y = q.y;
    f.bike.pitch = pitch(t);
    f.bike.squash = squash(t);
    f.bike.grounded = t >= h3 + 0.5;
    const r = rider(t);
    const landed = t >= sitAt;
    setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'dizzy' : 'scared');
  };
  return {
    duration,
    word: 'SNOWED UNDER!',
    beats: { hit1: h1, hit2: h2, hit3: h3, land: HAT_LAND, sit: sitAt },
    slow: [h3],
    at,
    events: () => [
      [0.2, 'sfx:whoosh', 2, 0.5],
      ...[h1, h2].flatMap((h, s): Ev[] => [
        [h, 'poof', SNOWMEN[s], 1.4, WHITE],
        [h, 'debris', SNOWMEN[s], 1.4, WHITE],
        [h, 'sfx:bump', SNOWMEN[s], 1],
      ]),
      [h3, 'groan', SNOWMEN[2] - 1.5, 1.4],
      [h3, 'sfx:crash', SNOWMEN[2] - 1.5, 1.4],
      [h3, 'poof', SNOWMEN[2] - 1.5, 1.2, WHITE],
      [h3 + 0.05, 'word', 14.5, 4.4],
      [sitAt, 'poof', SNOW_HAT.x, 0.6, WHITE],
      [HAT_LAND, 'sfx:bump', SNOW_HAT.x, SNOW_HAT.y],
      [HAT_LAND + 0.1, 'stars', SNOW_HAT.x, 2.6],
    ],
  };
})();

// ---------- Element 3: Igloo Jump (the finale) ----------

/** The igloo: the middle of its dome and its radius. */
export const IGLOO = { x: 12, r: 3.2 };
/** The kicker: from x = 2 up to 2.0 at x = 7. */
export const KICK = { from: 2, to: 7, h: 2.0 };
/** The ice rink the bike lands on and the finale slides out over. */
export const RINK_FROM = 17.5;

/** The kicker (its lip falls away over half a unit), then the flat road (the igloo's dome is never touched in the clear). */
export const iglooSurface: Surface = (x) => {
  if (x <= KICK.from || x >= KICK.to + 0.5) return 0;
  if (x > KICK.to) return (KICK.h * (KICK.to + 0.5 - x)) / 0.5;
  const v = (x - KICK.from) / (KICK.to - KICK.from);
  return KICK.h * (0.5 * v + 0.5 * v * v);
};
/** The dome's outline, which the crashed bike belly-flops onto. */
export const domeSurface: Surface = (x) => {
  const dx = x - IGLOO.x;
  return Math.abs(dx) < IGLOO.r ? Math.sqrt(IGLOO.r * IGLOO.r - dx * dx) : 0;
};

const LIP_X = 6.2; // the bike's middle when its front wheel reaches the end of the kicker
const T_LIP = 0.8;
const kickLaunch = (() => {
  const f = createFrame();
  ride(f, iglooSurface, LIP_X);
  return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
})();

const clear3: Def = (() => {
  const duration = 3.4;
  const tLand = 2.1;
  const xLand = 18.0;
  const peakY = 4.5;
  const land = (() => {
    const f = createFrame();
    rideW(f, iglooSurface, xLand, 0.35);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const flightY = pchip([kickLaunch.x, IGLOO.x, land.x], [kickLaunch.y, peakY, land.y]);
  const tPeak = T_LIP + ((IGLOO.x - kickLaunch.x) / (land.x - kickLaunch.x)) * (tLand - T_LIP);
  const midX = track([
    [0, 0, 'l'],
    [T_LIP, LIP_X, 'l'],
  ]);
  const xm = track([
    [tLand, xLand],
    [duration, 28, 'l'],
  ]);
  const w = track([
    [tLand, 0.35],
    [2.7, 0.35, 'l'],
    [3.1, 0],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < T_LIP) {
      ride(f, iglooSurface, midX(t), settleAt(t));
    } else if (t < tLand) {
      const u = (t - T_LIP) / (tLand - T_LIP);
      f.bike.x = lerp(kickLaunch.x, land.x, u);
      f.bike.y = flightY(f.bike.x);
      f.bike.pitch = lerp(kickLaunch.pitch, TAU + land.pitch, flipEase(u));
      f.bike.grounded = false;
      f.rider.pose = t > T_LIP + 0.2 ? 'armsUp' : 'duck';
    } else {
      rideW(f, iglooSurface, xm(t), w(t));
      f.bike.pitch += TAU;
      f.bike.squash = 1 - 0.15 * bump(t, tLand + 0.05, 0.1);
      f.bike.grounded = w(t) < 0.05;
      const u = Math.min((t - tLand) / (3.1 - tLand), 1);
      f.bike.z = 0.4 * Math.sin(2 * Math.PI * u);
      if (w(t) > 0.2) f.rider.pose = 'wheelie';
      else if (t < duration - 0.2) f.rider.pose = 'thumbs';
    }
  };
  return {
    duration,
    word: 'ICE COLD!',
    beats: { launch: T_LIP, peak: tPeak, land: tLand },
    slow: [tPeak],
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [T_LIP, 'sfx:whoosh', 7, 2.4],
      ...trail(T_LIP + 0.1, tLand - 0.1, 0.14, 'spark', bike),
      [tPeak, 'word', IGLOO.x + 0.5, 6.0],
      [tLand, 'dust', xLand, 0.1, WHITE],
      [tLand, 'confetti', xLand, 2.0],
      [tLand + 0.1, 'confetti', xLand + 1, 2.4],
      [tLand, 'sfx:chime', xLand, 1],
      [duration * 0.96, 'cheer', 26, 2],
    ],
  };
})();

/** The crash: where the bike belly-flops onto the dome, and when it and the rider arrive. */
const FLOP = { x: 11.4, t: 1.45 };
const T_BLOCK = FLOP.t + 0.1;
/** The ice block from the top of the dome: home, and where it ends up beside the rider. */
export const BLOCK = { x: IGLOO.x, y: IGLOO.r + 0.25, endX: 18.7, endY: 0.28 };
const blockPath = route([
  [T_BLOCK, BLOCK.x, BLOCK.y],
  [T_BLOCK + 0.3, 12.9, 4.5, 4.5],
  [2.4, 14.4, 2.2, 4.5],
  [3.3, BLOCK.endX, BLOCK.endY, 3.0],
]);
/** The top ice block at time `t` of the clear (never moves) or the crash (pops off and slides). */
export function iceBlockAt(
  outcome: 'clear' | 'crash',
  t: number,
  out: Piece = { x: 0, y: 0, rot: 0, scale: 1, visible: true },
): Piece {
  out.scale = 1;
  out.visible = true;
  out.rot = 0;
  out.x = BLOCK.x;
  out.y = BLOCK.y;
  if (outcome === 'crash' && t > T_BLOCK) {
    const p = blockPath(t);
    out.x = p.x;
    out.y = p.y;
    out.rot = 0.2 + 6 * (Math.min(t, 3.3) - T_BLOCK) * (1 - prog(t, T_BLOCK, 3.3, 'o'));
  }
  return out;
}

const crash3: Def = (() => {
  const duration = 4.5;
  const tHop = 2.25;
  const tDown = 2.85;
  const tRider = 3.1;
  const land = (() => {
    const f = createFrame();
    ride(f, domeSurface, FLOP.x);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const topX = track([
    [FLOP.t, FLOP.x],
    [FLOP.t + 0.1, FLOP.x + 0.2, 'o'],
    [tHop, 14.2, 'i'],
  ]);
  const hopFrom = (() => {
    const f = createFrame();
    ride(f, domeSurface, 14.2);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const rinkX = track([
    [tDown, 18.0],
    [3.5, 20.9, 'o'],
  ]);
  const midX = track([
    [0, 0, 'l'],
    [T_LIP, LIP_X, 'l'],
  ]);
  // The rider flops belly-down on the dome beside the bike, slides off the far side and sits.
  const seat = hipOf(land.x, land.y, land.pitch);
  const dome = (x: number) => domeSurface(x) + 0.3;
  const riderX = track([
    [FLOP.t, seat.x],
    [FLOP.t + 0.3, 11.9, 'o'],
    [2.5, 13.9, 'i'],
  ]);
  const riderFall = route([
    [2.5, 13.9, dome(13.9)],
    [tRider, 19.6, 0.25, 3.5],
  ]);
  const riderRot = track([
    [2.5, 0],
    [tRider, -TAU, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < T_LIP) {
      ride(f, iglooSurface, midX(t), settleAt(t));
      return;
    }
    if (t < FLOP.t) {
      const u = (t - T_LIP) / (FLOP.t - T_LIP);
      f.bike.x = lerp(kickLaunch.x, land.x, u);
      f.bike.y = arc(kickLaunch.y, land.y, 4.0, u);
      f.bike.pitch = lerp(kickLaunch.pitch, land.pitch, prog(t, T_LIP, FLOP.t));
      f.bike.grounded = false;
      f.rider.face = 'scared';
      return;
    }
    if (t < tHop) {
      ride(f, domeSurface, topX(t));
      f.bike.squash = 1 - 0.2 * bump(t, FLOP.t + 0.05, 0.12);
      f.bike.grounded = false;
    } else if (t < tDown) {
      const u = (t - tHop) / (tDown - tHop);
      f.bike.x = lerp(hopFrom.x, 18.0, u);
      f.bike.y = arc(hopFrom.y, BIKE_Y - 0.02, 3.4, u);
      f.bike.pitch = lerp(hopFrom.pitch, 0, prog(t, tHop, tDown));
      f.bike.grounded = false;
    } else {
      f.bike.x = rinkX(t);
      f.bike.y = BIKE_Y - 0.02;
      f.bike.grounded = false;
      f.bike.squash = 1 - 0.15 * bump(t, tDown + 0.05, 0.1);
    }
    f.bike.roll = (Math.PI / 2) * prog(t, 2.3, 3.2);
    if (t < 2.5) {
      const x = riderX(t);
      setFree(
        f,
        x,
        t < FLOP.t + 0.3 ? lerp(seat.y, dome(x), prog(t, FLOP.t, FLOP.t + 0.3)) : dome(x),
        0,
        'splat',
        'scared',
      );
    } else {
      const r = riderFall(t);
      const landed = t >= tRider;
      setFree(f, r.x, r.y, riderRot(t), landed ? 'sit' : 'flail', landed ? 'dizzy' : 'scared');
    }
  };
  return {
    duration,
    word: 'BELLY FLOP!',
    beats: { launch: T_LIP, flop: FLOP.t, hop: tHop, down: tDown, sit: tRider },
    slow: [FLOP.t],
    at,
    events: () => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [T_LIP, 'sfx:whoosh', 7, 2.4],
      [FLOP.t, 'groan', FLOP.x, 3.4],
      [FLOP.t, 'sfx:splat', FLOP.x, 3.2],
      [FLOP.t, 'poof', FLOP.x, 3.3, WHITE],
      [FLOP.t + 0.05, 'word', 11, 5.6],
      [FLOP.t + 0.1, 'debris', IGLOO.x, 3.3, ICE_BLUE],
      [tDown, 'dust', 18, 0.2, WHITE],
      [tRider, 'poof', 19.6, 0.5, WHITE],
      [3.3, 'sfx:bump', BLOCK.endX, 0.4],
      [3.3, 'debris', BLOCK.endX, 0.4, ICE_BLUE],
      [3.4, 'stars', 19.6, 1.9],
    ],
  };
})();

// ---------- The course ----------

export const ICE_SLIDE: MegaSpec = {
  id: 'ice-slide',
  title: 'Ice Slide',
  emoji: '🧊',
  elements: [
    {
      name: 'Ice Ramp',
      length: 24,
      floorY: 0,
      height: 4.0,
      cuts: [],
      clear: clear1,
      crash: crash1,
    },
    {
      name: 'Snowman Wall',
      length: 22,
      floorY: 0,
      height: 5.2,
      cuts: [],
      clear: clear2,
      crash: crash2,
    },
    {
      name: 'Igloo Jump',
      length: 28,
      floorY: 0,
      height: 4.6,
      cuts: [],
      clear: clear3,
      crash: crash3,
    },
  ],
};
