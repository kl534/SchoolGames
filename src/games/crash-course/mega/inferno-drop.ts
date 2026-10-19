/**
 * Mega course 4: Inferno Drop. The bike climbs a giant scaffold ramp, flies off it in one long
 * jump and drops through three flaming rings (9.6, 7.0 and 4.4 u up), with slow motion at each.
 * Pure animation data like stunts.ts: element-local coordinates in the Defs (x = 0 at the
 * element's entry line, the road at y = 0), course-local ones (`X`) everywhere else.
 *
 * Unlike the other courses the three elements are windows onto ONE flight: a cleared element 1 or
 * 2 ends mid-air and the next one carries on from there (see `airborne` in mega.ts).
 */
import {
  BIKE_Y,
  createFrame,
  EASE,
  hipOf,
  ride,
  REAR,
  rideW,
  setFree,
  settleAt,
  smooth,
  TAU,
  track,
  trail,
  WHEEL_R,
  type Def,
  type Ev,
  type Frame,
  type Pos,
  type Surface,
} from '../stunts';
import { bump, flipEase, heading, pchip, route } from './anim';
import type { MegaSpec } from './mega';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- Geometry (course-local) ----------

/** The foot, the lip and the height at the lip of the big scaffold ramp. */
export const RAMP_FROM = 2;
export const RAMP_LIP = 14;
export const RAMP_TOP = 9.0;
/** Radius of all three rings (to the middle of the flames). */
export const RING_R = 1.8;
/** The ring centres. */
export const RINGS: readonly { x: number; y: number }[] = [
  { x: 23, y: 9.6 },
  { x: 32, y: 7.0 },
  { x: 41, y: 4.4 },
];
/** The air cushion under ring 1, on the road. */
export const CUSHION = { from: 20, to: 26, top: 2.5 };
/** The foam pit (a cut in the road), the top of the foam and the bottom of the pit. */
export const FOAM_FROM = 42.5;
export const FOAM_TO = 46;
export const FOAM_Y = -0.15;
export const FOAM_FLOOR = -2.4;
/** The landing ramp: a vertical face at LAND_FROM rising to LAND_TOP, sloping down to the road. */
export const LAND_FROM = 46;
export const LAND_TO = 54;
export const LAND_TOP = 2.4;
/** Horizontal speed (u/s) through the whole flight. */
export const VX = 12;
/** The top of the flight. */
export const PEAK = { x: 17.5, y: 10.4 };
/** Where the bike's middle comes down on the landing ramp. */
export const X_TOUCH = 49;
/** The end of the course. */
const X_END = 62;

/** The scaffold ramp: flat, then a curve up to RAMP_TOP at the lip, then thin air. */
export const towerRamp: Surface = (X) => {
  if (X <= RAMP_FROM) return 0;
  if (X <= RAMP_LIP + 1e-9) {
    const v = Math.min((X - RAMP_FROM) / (RAMP_LIP - RAMP_FROM), 1);
    return RAMP_TOP * (0.6 * v + 0.4 * v * v);
  }
  return -20;
};

/** The road past the ramp: the foam pit (a long way down), the landing ramp and the road again. */
export const landingSurface: Surface = (X) => {
  if (X < FOAM_FROM) return 0;
  if (X < LAND_FROM) return -9;
  if (X <= LAND_TO) return (LAND_TOP * (LAND_TO - X)) / (LAND_TO - LAND_FROM);
  return 0;
};

// ---------- The one flight ----------

/** The front wheel reaches the lip of the ramp. */
export const T_LIP = 1.6;

const launch = (() => {
  const f = createFrame();
  ride(f, towerRamp, RAMP_LIP - REAR);
  return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
})();

/** The wheelie touchdown on the landing ramp. */
const touch = (() => {
  const f = createFrame();
  rideW(f, landingSurface, X_TOUCH, 0.35);
  return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
})();

/** Course time at which the flight is above course x `X`. */
const timeAt = (X: number) => T_LIP + (X - launch.x) / VX;
export const T_RING: readonly [number, number, number] = [
  timeAt(RINGS[0].x),
  timeAt(RINGS[1].x),
  timeAt(RINGS[2].x),
];
/** The boundaries between the three elements, in course time. */
export const T_B1 = timeAt(26);
export const T_B2 = timeAt(35);
const T_TOUCH = timeAt(touch.x);

/** How far below a ring's centre the bike's middle passes. */
const BELOW = 0.45;

const flightY = pchip(
  [launch.x, PEAK.x, RINGS[0].x, RINGS[1].x, RINGS[2].x, touch.x],
  [launch.y, PEAK.y, ...RINGS.map((r) => r.y - BELOW), touch.y],
);
const flightX = (T: number) => launch.x + VX * (T - T_LIP);
const flightPos = (T: number): Pos => {
  const x = flightX(T);
  return { x, y: flightY(x) };
};

/** The ride-out after the touchdown: speed falls linearly from VX to 6 u/s over D seconds. */
const OUT_SPEED = 6;
const T_OUT = (2 * (X_END - X_TOUCH)) / (VX + OUT_SPEED);
export const T_END = T_TOUCH + T_OUT;
const outX = (u: number) => X_TOUCH + VX * u - ((VX - OUT_SPEED) / (2 * T_OUT)) * u * u;
const wheelie = track([
  [0, 0.35],
  [0.55, 0, 'l'],
]);

const midX = track([
  [0, 0, 'l'],
  [T_LIP, RAMP_LIP - REAR, 'l'],
]);

/** The bike's pitch in the air before the backflip: nose up off the ramp, then along the path. */
function airPitch(T: number): number {
  const h = heading(flightPos, T);
  return lerp(launch.pitch, 0.75 * h, smooth((T - T_LIP) / 0.3));
}

const FLIP_FROM = T_RING[2] + 0.12;
const FLIP_TO = T_TOUCH - 0.05;

/** The rider's pose in the air. The windows stop short of the element boundaries. */
function airPose(T: number): Frame['rider']['pose'] {
  if (T >= T_RING[0] - 0.3 && T <= T_RING[0] + 0.2) return 'armsUp';
  if (T >= T_RING[1] - 0.3 && T <= T_RING[1] + 0.2) return 'superman';
  if (Math.abs(T - T_RING[2]) <= 0.2) return 'duck';
  if (T > T_RING[2] + 0.2 && T < FLIP_TO) return 'armsUp';
  return 'ride';
}

/**
 * The whole cleared course as one function of course time `T`, into `f` (course-local). The
 * three cleared elements are windows onto it.
 */
function infernoClear(T: number, f: Frame): void {
  if (T < T_LIP) {
    ride(f, towerRamp, midX(T), settleAt(T));
    f.rider.pose = T > 1.2 ? 'duck' : 'ride';
  } else if (T < T_TOUCH) {
    const p = flightPos(T);
    f.bike.x = p.x;
    f.bike.y = p.y;
    let pitch = airPitch(T);
    if (T > FLIP_FROM) {
      pitch += TAU * flipEase((T - FLIP_FROM) / (FLIP_TO - FLIP_FROM));
      pitch = lerp(pitch, TAU + touch.pitch, smooth((T - (T_TOUCH - 0.25)) / 0.25));
    }
    f.bike.pitch = pitch;
    f.bike.grounded = false;
    f.rider.pose = airPose(T);
  } else {
    const u = T - T_TOUCH;
    const w = wheelie(u);
    rideW(f, landingSurface, outX(Math.min(u, T_OUT)), w);
    f.bike.pitch += TAU;
    f.bike.squash = 1 - 0.15 * bump(T, T_TOUCH + 0.05, 0.1);
    f.bike.grounded = w < 0.05;
    if (w > 0.2) f.rider.pose = 'wheelie';
    else if (u < 0.314 + 0.5) f.rider.pose = 'thumbs';
  }
}

// ---------- The three cleared elements ----------

export const OFFSETS = [0, 26, 35] as const;

/** A cleared element: a window of the flight, shifted to the element's own coordinates. */
function windowDef(
  from: number,
  to: number,
  offset: number,
  word: string,
  beats: Record<string, number>,
  slow: readonly number[],
  events: Def['events'],
): Def {
  return {
    duration: to - from,
    word,
    beats,
    slow,
    at(t, f) {
      infernoClear(from + t, f);
      f.bike.x -= offset;
      if (f.rider.mode === 'free') f.rider.x -= offset;
    },
    events,
  };
}

/** The effects when the bike passes through ring `i`, element-local. */
function ringPass(i: 0 | 1 | 2, from: number, word: boolean): Ev[] {
  const r = RINGS[i];
  const x = r.x - OFFSETS[i];
  const t = T_RING[i] - from;
  return [
    [t - 0.2, 'sfx:whoosh', x, r.y],
    ...(word ? ([[t, 'word', x, r.y + 1.5]] as Ev[]) : []),
    [t, 'flame', x, r.y],
    [t, 'flame', x, r.y + 0.8],
    [t, 'spark', x, r.y],
    [t, 'sfx:chime', x, r.y],
  ];
}

const clear1: Def = (() => {
  const t = T_RING[0];
  const r = RINGS[0];
  return windowDef(0, T_B1, 0, 'RED HOT!', { lip: T_LIP, ring: t }, [t], () => [
    [0.3, 'sfx:whoosh', 2, 0.5],
    [0.25, 'dust', RAMP_FROM, 0.1],
    [T_LIP, 'sfx:whoosh', RAMP_LIP, RAMP_TOP],
    [T_LIP, 'dust', RAMP_LIP, RAMP_TOP],
    ...ringPass(0, 0, true),
    [t + 0.12, 'cheer', r.x, r.y - 1],
  ]);
})();

const clear2: Def = (() => {
  const t = T_RING[1] - T_B1;
  const r = RINGS[1];
  return windowDef(T_B1, T_B2, OFFSETS[1], 'BLAZING!', { ring: t }, [t], () => [
    ...ringPass(1, T_B1, true),
    [t + 0.1, 'cheer', r.x - OFFSETS[1], r.y - 1],
  ]);
})();

const clear3: Def = (() => {
  const t = T_RING[2] - T_B2;
  const flip = FLIP_FROM - T_B2;
  const land = T_TOUCH - T_B2;
  const duration = T_END - T_B2;
  return windowDef(T_B2, T_END, OFFSETS[2], 'INFERNO!', { ring: t, flip, touch: land }, [t], () => [
    ...ringPass(2, T_B2, false),
    [flip, 'sfx:whoosh', RINGS[2].x - OFFSETS[2] + 2, RINGS[2].y],
    [land, 'word', touch.x - OFFSETS[2], touch.y + 2],
    [land, 'dust', touch.x - OFFSETS[2], touch.y],
    [land, 'confetti', touch.x - OFFSETS[2], touch.y + 1.5],
    [land + 0.08, 'confetti', touch.x - OFFSETS[2] + 1, touch.y + 2],
    [land, 'sfx:chime', touch.x - OFFSETS[2], touch.y],
    [duration * 0.96, 'cheer', X_END - OFFSETS[2] - 1, 2],
  ]);
})();

// ---------- Crash 1: hung up on ring 1 (DANGLE!) ----------

/** Where the bike hangs from: the front axle, hooked over the bottom of ring 1 from inside. */
export const HOOK = { x: RINGS[0].x, y: RINGS[0].y - RING_R + WHEEL_R };
/** The handlebars in the bike's own frame (see bike.ts). */
const BARS = { x: 0.5, y: 0.96 };

const crash1: Def = (() => {
  const duration = 5.0;
  const tHook = T_RING[0];
  const pHook = airPitch(tHook);
  const mid = { x: HOOK.x - REAR * Math.cos(pHook), y: HOOK.y - REAR * Math.sin(pHook) };
  const hookY = pchip([launch.x, PEAK.x, mid.x], [launch.y, PEAK.y, mid.y]);
  const xOf = (t: number) => lerp(launch.x, mid.x, (t - T_LIP) / (tHook - T_LIP));
  const tLetGo = 2.85;
  const tLand1 = 3.35;
  const tLand2 = 3.7;
  const tSit = 3.9;
  const top = CUSHION.top + 0.25;
  const sitX = RINGS[0].x - 0.6;

  /** The pitch of the hanging bike: eases from the flight to nose up, swinging, then still. */
  const swing = (t: number) => {
    const s = t - tHook;
    return 0.5 * Math.exp(-s / 0.45) * Math.sin(5 * s) * (1 - smooth((t - 3.6) / 0.4));
  };
  const pitchAt = (t: number) => lerp(pHook, Math.PI / 2 + swing(t), smooth((t - tHook) / 0.35));
  const midAt = (p: number): Pos => ({
    x: HOOK.x - REAR * Math.cos(p),
    y: HOOK.y - REAR * Math.sin(p),
  });
  /** Where the rider's hips hang: just under the handlebars. */
  const hang = (p: number): Pos => {
    const m = midAt(p);
    const c = Math.cos(p);
    const s = Math.sin(p);
    return {
      x: m.x + BARS.x * c - BARS.y * s,
      y: m.y + BARS.x * s + BARS.y * c - 0.95,
    };
  };
  const seat = hipOf(mid.x, mid.y, pHook);
  const seat0 = { x: seat.x, y: seat.y };
  const hangAt = (t: number): Pos => {
    const h = hang(pitchAt(t));
    const a = smooth((t - tHook) / 0.25);
    return { x: lerp(seat0.x, h.x, a), y: lerp(seat0.y, h.y, a) };
  };
  const dropFrom = (() => hangAt(tLetGo))();

  const at = (t: number, f: Frame) => {
    if (t < T_LIP) {
      infernoClear(t, f);
      return;
    }
    if (t < tHook) {
      const x = xOf(t);
      f.bike.x = x;
      f.bike.y = hookY(x);
      f.bike.pitch = airPitch(t);
      f.bike.grounded = false;
      f.rider.pose = airPose(t);
      if (t > tHook - 0.2) f.rider.face = 'scared';
      return;
    }
    const p = pitchAt(t);
    const m = midAt(p);
    f.bike.x = m.x;
    f.bike.y = m.y;
    f.bike.pitch = p;
    f.bike.z = 0.5 * smooth((t - tHook) / 0.2);
    f.bike.squash = 1 - 0.2 * bump(t, tHook + 0.05, 0.1);
    f.bike.grounded = false;
    let r: Pos;
    let pose: Frame['rider']['pose'] = 'dangle';
    let face: Frame['rider']['face'] = 'scared';
    if (t < tLetGo) {
      r = hangAt(t);
    } else if (t < tLand1) {
      const u = (t - tLetGo) / (tLand1 - tLetGo);
      r = { x: lerp(dropFrom.x, sitX, smooth(u)), y: lerp(dropFrom.y, top, EASE.i(u)) };
      pose = 'flail';
    } else if (t < tLand2) {
      r = { x: sitX, y: top + 1.0 * Math.sin((Math.PI * (t - tLand1)) / (tLand2 - tLand1)) };
      pose = 'flail';
    } else if (t < tSit) {
      r = { x: sitX, y: top + 0.35 * Math.sin((Math.PI * (t - tLand2)) / (tSit - tLand2)) };
      pose = 'flail';
    } else {
      r = { x: sitX, y: top };
      pose = 'dizzy';
      face = 'dizzy';
    }
    setFree(f, r.x, r.y, 0, pose, face);
  };
  return {
    duration,
    word: 'DANGLE!',
    beats: { hook: tHook, letgo: tLetGo, land1: tLand1, land2: tLand2, still: 4.0 },
    slow: [tHook],
    at,
    events: () => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [T_LIP, 'sfx:whoosh', RAMP_LIP, RAMP_TOP],
      [T_LIP, 'dust', RAMP_LIP, RAMP_TOP],
      [tHook - 0.2, 'sfx:whoosh', mid.x, mid.y],
      [tHook, 'groan', HOOK.x, HOOK.y],
      [tHook, 'sfx:bump', HOOK.x, HOOK.y],
      [tHook, 'flame', HOOK.x, HOOK.y],
      [tHook, 'word', HOOK.x, HOOK.y + 1.5],
      [tLand1, 'sfx:boing', sitX, top],
      [tLand1, 'poof', sitX, top],
      [tLand2, 'sfx:boing', sitX, top],
      [4.1, 'stars', sitX, top + 1.5],
    ],
  };
})();

// ---------- Crash 2: spin cycle in ring 2 (SPIN CYCLE!) ----------

/** The radius the bike rides round inside ring 2, and where on it the bike is caught. */
export const SPIN_R = RING_R - 0.15 - WHEEL_R;
export const SPIN_PHI0 = -0.3;

const crash2: Def = (() => {
  const duration = 5.0;
  const o = OFFSETS[1];
  const c = RINGS[1];
  const catchP = { x: c.x + SPIN_R * Math.sin(SPIN_PHI0), y: c.y - SPIN_R * Math.cos(SPIN_PHI0) };
  const tCatch = (catchP.x - 26) / VX;
  const bend = catchP.y - flightY(catchP.x);
  const w0 = VX / SPIN_R;
  const turns = 2 * TAU;
  const spin = (2 * (turns - SPIN_PHI0)) / w0;
  const tDrop = tCatch + spin;
  const phiAt = (s: number) => SPIN_PHI0 + w0 * s - (w0 * s * s) / (2 * spin);
  const bottom = c.y - SPIN_R;
  const tFall = Math.sqrt((bottom - BIKE_Y) / 10);
  const tLand = tDrop + tFall;
  const tRider = tDrop + 0.75;
  const sit = { x: c.x + 1.6, y: 0.25 };
  const seat = hipOf(c.x, bottom, 0);
  const hips0 = { x: seat.x, y: seat.y };
  const rider = route([
    [tDrop, hips0.x, hips0.y],
    [tRider, sit.x, sit.y, hips0.y + 0.8],
  ]);
  const riderRot = track([
    [tDrop, 0],
    [tRider, -TAU, 'io'],
  ]);

  const at = (t: number, f: Frame) => {
    const T = T_B1 + t;
    if (t < tCatch) {
      const X = 26 + VX * t;
      f.bike.x = X - o;
      f.bike.y = flightY(X) + bend * smooth((X - 26) / (catchP.x - 26));
      f.bike.pitch = lerp(airPitch(T), SPIN_PHI0, smooth(t / tCatch));
      f.bike.grounded = false;
      if (t > tCatch - 0.2) f.rider.face = 'scared';
    } else if (t < tDrop) {
      const phi = phiAt(t - tCatch);
      f.bike.x = c.x + SPIN_R * Math.sin(phi) - o;
      f.bike.y = c.y - SPIN_R * Math.cos(phi);
      f.bike.pitch = phi;
      f.bike.grounded = false;
      f.rider.face = phi > TAU - SPIN_PHI0 ? 'dizzy' : 'scared';
    } else {
      const s = t - tDrop;
      f.bike.x = c.x - o;
      f.bike.y = Math.max(bottom - 10 * s * s, BIKE_Y);
      const rattle = s < tFall ? 0.1 * Math.sin(40 * s) * (1 - s / tFall) : 0;
      f.bike.pitch = turns + rattle;
      f.bike.grounded = s >= tFall;
      f.bike.squash = 1 - 0.2 * bump(t, tLand + 0.05, 0.1);
      const landed = t >= tRider;
      const r = rider(t);
      setFree(
        f,
        r.x - o,
        r.y,
        riderRot(t),
        landed ? 'dizzy' : 'flail',
        landed ? 'dizzy' : 'scared',
      );
    }
  };
  return {
    duration,
    word: 'SPIN CYCLE!',
    beats: { catch: tCatch, drop: tDrop, land: tLand, sit: tRider },
    slow: [tCatch],
    at,
    events: (bike) => [
      [tCatch - 0.2, 'sfx:whoosh', catchP.x - o, catchP.y],
      [tCatch, 'groan', catchP.x - o, catchP.y],
      [tCatch, 'sfx:crash', catchP.x - o, catchP.y],
      [tCatch, 'flame', catchP.x - o, catchP.y],
      [tCatch, 'word', c.x - o, c.y + 1.5],
      ...trail(tCatch + 0.1, tDrop - 0.1, 0.25, 'spark', bike),
      [tLand, 'sfx:bump', c.x - o, BIKE_Y],
      [tLand, 'dust', c.x - o, 0.1],
      [tRider, 'sfx:splat', sit.x - o, 0.4],
      [tRider, 'poof', sit.x - o, 0.6],
      [tRider + 0.2, 'stars', sit.x - o, 1.9],
    ],
  };
})();

// ---------- Crash 3: nose-dive into the foam pit (FLOOMP!) ----------

const crash3: Def = (() => {
  const duration = 3.4;
  const o = OFFSETS[2];
  const tClip = T_RING[2] - T_B2;
  const pitClip = { x: RINGS[2].x - o, y: flightY(RINGS[2].x) - 0.6 };
  const pClip = airPitch(T_RING[2]);
  const tDive = 0.85;
  const tSink = 1.3;
  const bikePath = route([
    [tClip, pitClip.x, pitClip.y],
    [tDive, 8.5, FOAM_Y - 0.1, pitClip.y],
    [tSink, 8.7, FOAM_FLOOR + 0.5, undefined, 'o'],
  ]);
  const pitch = track([
    [tClip, pClip],
    [tClip + 0.25, -1.2, 'o'],
    [tSink, -1.35],
  ]);
  const seat = hipOf(pitClip.x, pitClip.y, pClip);
  const hips0 = { x: seat.x, y: seat.y };
  const tIn = 0.95;
  const tUp = 1.6;
  /** Hips of the rider when only the top of the helmet shows. */
  const bobY = FOAM_Y - 0.62;
  const riderPath = route([
    [tClip, hips0.x, hips0.y],
    [tIn, 9.3, FOAM_Y, hips0.y + 0.3],
    [1.15, 9.4, FOAM_Y - 1.6, undefined, 'o'],
    [tUp, 9.4, bobY, undefined, 'io'],
  ]);
  const riderRot = track([
    [tClip, 0],
    [tIn, -1.3, 'io'],
    [tUp, 0, 'io'],
  ]);

  const at = (t: number, f: Frame) => {
    const T = T_B2 + t;
    if (t < tClip) {
      const X = 35 + VX * t;
      f.bike.x = X - o;
      f.bike.y = flightY(X) - 0.6 * smooth((X - 35) / (RINGS[2].x - 35));
      f.bike.pitch = airPitch(T);
      f.bike.grounded = false;
      if (t > tClip - 0.2) f.rider.face = 'scared';
      return;
    }
    const p = bikePath(t);
    f.bike.x = p.x;
    f.bike.y = p.y;
    f.bike.pitch = pitch(t);
    f.bike.grounded = false;
    f.bike.squash = 1 - 0.2 * bump(t, tClip + 0.05, 0.1);
    const r = riderPath(t);
    const settled = t >= tUp;
    const wobble = settled ? 0.1 * (1 - smooth((t - tUp) / 0.6)) * Math.sin(10 * (t - tUp)) : 0;
    setFree(
      f,
      r.x,
      r.y + wobble,
      riderRot(t),
      settled ? 'sit' : 'flail',
      settled ? 'dizzy' : 'scared',
    );
  };
  return {
    duration,
    word: 'FLOOMP!',
    beats: { clip: tClip, dive: tDive, sink: tSink, up: tUp },
    slow: [tClip],
    at,
    events: () => [
      [tClip - 0.2, 'sfx:whoosh', pitClip.x - 2, pitClip.y],
      [tClip, 'groan', pitClip.x, pitClip.y],
      [tClip, 'sfx:bump', pitClip.x, pitClip.y],
      [tClip, 'flame', pitClip.x, pitClip.y],
      [tDive, 'word', 8.5, FOAM_Y + 1.8],
      [tDive, 'sfx:splat', 8.5, FOAM_Y],
      [tDive, 'confetti', 8.5, FOAM_Y + 0.4, 0xff7ab6],
      [tDive + 0.05, 'confetti', 9.3, FOAM_Y + 0.4, 0x7ad3ff],
      [tDive, 'poof', 8.9, FOAM_Y + 0.3],
      [1.8, 'stars', 9.4, FOAM_Y + 1.4],
    ],
  };
})();

// ---------- The course ----------

export const INFERNO_DROP: MegaSpec = {
  id: 'inferno-drop',
  title: 'Inferno Drop',
  emoji: '🔥',
  airborne: true,
  rise: 5.6,
  elements: [
    {
      name: 'Top Ring',
      length: 26,
      floorY: 0,
      height: RINGS[0].y + RING_R + 0.6,
      cuts: [],
      clear: clear1,
      crash: crash1,
    },
    {
      name: 'Middle Ring',
      length: 9,
      floorY: 0,
      height: RINGS[1].y + RING_R + 0.6,
      cuts: [],
      clear: clear2,
      crash: crash2,
    },
    {
      name: 'Low Ring',
      length: 27,
      floorY: FOAM_FLOOR,
      height: RINGS[2].y + RING_R + 0.6,
      cuts: [[FOAM_FROM - OFFSETS[2], FOAM_TO - OFFSETS[2]]],
      clear: clear3,
      crash: crash3,
    },
  ],
};
