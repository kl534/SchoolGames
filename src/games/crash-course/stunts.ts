/**
 * The 28 stunts as authored animations: keyframe tracks in obstacle-local coordinates (x = 0 at
 * the obstacle's entry line, y up, the road's top surface at y = 0). Pure data and maths, no
 * three.js and no DOM, so the sampler is easy to test and the stunt lab can play any moment of
 * any stunt. `stuntFrame(kind, outcome, variant, t)` says where the bike and the rider are.
 */
import { ENTRY_SPEED, type ObstacleKind, type Outcome, type Variant } from './rules';

export { ENTRY_SPEED };

export const BIKE_LEN = 2.2;
export const WHEEL_R = 0.42;
/** The bike frame's origin (between the wheels, at axle height) when on the road. */
export const BIKE_Y = WHEEL_R;
/** The wheels sit this far in front of and behind the frame's origin. */
export const REAR = 0.8;
/** Where a seated rider's hips are, from the bike frame's origin. */
export const SEAT = { x: -0.2, y: 0.6 };

export const TAU = Math.PI * 2;

export type PoseName =
  | 'ride'
  | 'wheelie'
  | 'wave'
  | 'armsUp'
  | 'balance'
  | 'duck'
  | 'surf'
  | 'flail'
  | 'dangle'
  | 'splat'
  | 'sit'
  | 'dizzy'
  | 'run'
  | 'thumbs';
export type FaceName = 'happy' | 'scared' | 'dizzy' | 'sooty';

export interface Frame {
  bike: {
    /** The frame origin, obstacle-local. */
    x: number;
    y: number;
    /** Radians, positive noses up; full flips add 2π. */
    pitch: number;
    /** Radians about the forward axis (the corkscrew). */
    roll: number;
    /** Depth offset, 0 on the road, negative is away from the camera. */
    z: number;
    /** 1 = normal; below 1 squashed along its length. */
    squash: number;
    visible: boolean;
    /** True while the wheels are on a surface, so they spin with the bike's speed. */
    grounded: boolean;
  };
  rider: {
    mode: 'seated' | 'free';
    /**
     * For `free`: the rider's hips (the pivot the body turns about), rotation (radians, positive
     * tips the head back) and nothing else; the pose says what the limbs do.
     */
    x: number;
    y: number;
    rot: number;
    pose: PoseName;
    face: FaceName;
    visible: boolean;
  };
}

export type StuntEventType =
  | 'dust'
  | 'splash'
  | 'spark'
  | 'flame'
  | 'smoke'
  | 'debris'
  | 'confetti'
  | 'stars'
  | 'sweat'
  | 'poof'
  | 'cheer'
  | 'groan'
  | 'word'
  | 'sfx:boing'
  | 'sfx:splat'
  | 'sfx:slideWhistle'
  | 'sfx:honk'
  | 'sfx:crash'
  | 'sfx:boom'
  | 'sfx:whoosh'
  | 'sfx:bump'
  | 'sfx:fizz'
  | 'sfx:chime'
  | 'sfx:pins';

export interface StuntEvent {
  /** Seconds into the stunt. */
  at: number;
  type: StuntEventType;
  /** Obstacle-local position of the effect. */
  x: number;
  y: number;
  /** An optional colour for particles (pink cotton candy, for one). */
  color?: number;
}

export interface StuntSpec {
  kind: ObstacleKind;
  /** x of the end of the obstacle: a cleared stunt finishes here, riding on the road. */
  length: number;
  /** The lowest y the bike or rider may reach (0 on the road, below zero in a pit). */
  floorY: number;
  /** Tallest point of the geometry above the road, for fitting the view. */
  height: number;
}

export const SPECS: Record<ObstacleKind, StuntSpec> = {
  loop: { kind: 'loop', length: 8, floorY: 0, height: 6 },
  ramp: { kind: 'ramp', length: 18, floorY: -3.4, height: 4.4 },
  ring: { kind: 'ring', length: 14, floorY: 0, height: 4.5 },
  crates: { kind: 'crates', length: 12, floorY: 0, height: 4 },
  bridge: { kind: 'bridge', length: 18, floorY: -5, height: 1.4 },
  seesaw: { kind: 'seesaw', length: 14, floorY: 0, height: 3.6 },
  coaster: { kind: 'coaster', length: 24, floorY: 0, height: 5.6 },
};

// ---------- Keyframes and easing ----------

export type Ease = 'l' | 'i' | 'o' | 'q' | 'io';

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Linear, accelerating, braking (cubic), braking (quadratic) and smooth in and out. */
const EASE: Record<Ease, (u: number) => number> = {
  l: (u) => u,
  i: (u) => u * u,
  o: (u) => 1 - (1 - u) ** 3,
  q: (u) => 1 - (1 - u) ** 2,
  io: (u) => u * u * (3 - 2 * u),
};

/** One key: at time `t` the value is `v`, reached from the previous key with the easing `e`. */
export type Key = readonly [t: number, v: number, e?: Ease];

/** Builds a function of time from keys (sorted by time); it holds the first and last values. */
export function track(keys: readonly Key[]): (t: number) => number {
  const last = keys[keys.length - 1];
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const key = keys[i];
      if (t <= key[0]) {
        const from = keys[i - 1];
        const span = key[0] - from[0];
        const u = span > 0 ? (t - from[0]) / span : 1;
        return from[1] + (key[1] - from[1]) * EASE[key[2] ?? 'io'](u);
      }
    }
    return last[1];
  };
}

/** The value of the latest key at or before `t` (poses and faces change in steps). */
export function steps<T>(keys: readonly (readonly [number, T])[]): (t: number) => T {
  return (t) => {
    let value = keys[0][1];
    for (const key of keys) {
      if (key[0] <= t) value = key[1];
      else break;
    }
    return value;
  };
}

/** Eased progress of `t` between `a` and `b`, from 0 to 1. */
export const prog = (t: number, a: number, b: number, e: Ease = 'io'): number =>
  EASE[e](clamp01((t - a) / (b - a)));

/**
 * A ballistic hop: height at progress `u` (0 to 1) from `from` to `to` that tops out at exactly
 * `peak` (raised to the higher end if it is lower).
 */
export function arc(from: number, to: number, peak: number, u: number): number {
  const top = Math.max(peak, from, to) + 1e-9;
  const up = Math.sqrt(top - from) / (Math.sqrt(top - from) + Math.sqrt(top - to));
  const k = (top - from) / (up * up);
  return top - k * (u - up) ** 2;
}

/** Height of something thrown up at `vy` from `y0` under gravity `g`, `t` seconds later. */
export const fall = (y0: number, vy: number, g: number, t: number): number =>
  y0 + vy * t - 0.5 * g * t * t;

// ---------- Frames ----------

export function createFrame(): Frame {
  return {
    bike: {
      x: 0,
      y: BIKE_Y,
      pitch: 0,
      roll: 0,
      z: 0,
      squash: 1,
      visible: true,
      grounded: true,
    },
    rider: { mode: 'seated', x: 0, y: 0, rot: 0, pose: 'ride', face: 'happy', visible: true },
  };
}

function resetFrame(f: Frame): Frame {
  const b = f.bike;
  b.x = 0;
  b.y = BIKE_Y;
  b.pitch = b.roll = b.z = 0;
  b.squash = 1;
  b.visible = b.grounded = true;
  const r = f.rider;
  r.mode = 'seated';
  r.x = r.y = r.rot = 0;
  r.pose = 'ride';
  r.face = 'happy';
  r.visible = true;
  return f;
}

type Surface = (x: number) => number;

/** Both wheels on a surface: the bike lies along the chord between them. `settle` eases in. */
function ride(f: Frame, surf: Surface, x: number, settle = 1): void {
  const a = surf(x - REAR);
  const b = surf(x + REAR);
  const pitch = Math.atan2(b - a, 2 * REAR) * settle;
  f.bike.pitch = pitch;
  f.bike.x = x - WHEEL_R * Math.sin(pitch);
  f.bike.y = lerp(BIKE_Y, (a + b) / 2 + WHEEL_R * Math.cos(pitch), settle);
}

/** Only the rear wheel on the surface, at `rx`, with the nose `w` radians above the slope. */
function rearRide(f: Frame, surf: Surface, rx: number, w: number): void {
  const slope = Math.atan2(surf(rx + 0.25) - surf(rx - 0.25), 0.5);
  const p = slope + w;
  const axleX = rx - WHEEL_R * Math.sin(slope);
  const axleY = surf(rx) + WHEEL_R * Math.cos(slope);
  f.bike.x = axleX + REAR * Math.cos(p);
  f.bike.y = axleY + REAR * Math.sin(p);
  f.bike.pitch = p;
}

/**
 * Rear wheel on the surface at x - REAR with the nose `w` radians up; as `w` shrinks to zero the
 * front wheel comes down too, so it blends into the ordinary both-wheels ride.
 */
function rideW(f: Frame, surf: Surface, x: number, w: number): void {
  rearRide(f, surf, x - REAR, w);
  const k = clamp01(1 - w / 0.2);
  if (k <= 0) return;
  const bx = f.bike.x;
  const by = f.bike.y;
  const bp = f.bike.pitch;
  ride(f, surf, x);
  f.bike.x = lerp(bx, f.bike.x, k);
  f.bike.y = lerp(by, f.bike.y, k);
  f.bike.pitch = lerp(bp, f.bike.pitch, k);
}

const seat = { x: 0, y: 0 };
/** Where a rider's hips are when seated on a bike at this pose (into `seat`). */
function hipOf(bx: number, by: number, pitch: number, roll = 0): typeof seat {
  const up = SEAT.y * Math.cos(roll);
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  seat.x = bx + SEAT.x * c - up * s;
  seat.y = by + SEAT.x * s + up * c;
  return seat;
}

function setFree(
  f: Frame,
  x: number,
  y: number,
  rot: number,
  pose: PoseName,
  face: FaceName = 'happy',
): void {
  f.rider.mode = 'free';
  f.rider.x = x;
  f.rider.y = y;
  f.rider.rot = rot;
  f.rider.pose = pose;
  f.rider.face = face;
}

const smooth = (u: number) => EASE.io(clamp01(u));
const settleAt = (t: number) => smooth(t / 0.2);

// ---------- Stunt definitions ----------

type Ev = readonly [at: number, type: StuntEventType, x: number, y: number, color?: number];

interface Pos {
  x: number;
  y: number;
}

interface Def {
  duration: number;
  word: string;
  /** Named moments (seconds) that the props follow. */
  beats: Record<string, number>;
  at(t: number, f: Frame): void;
  /** The events, given samplers for where the bike and the rider are at a time. */
  events(bike: (t: number) => Pos, rider: (t: number) => Pos): Ev[];
}

type Pair<T> = readonly [T, T];
type Table = Record<ObstacleKind, Record<Outcome, Pair<Def>>>;

/** Events along a stretch of time, at the bike (or rider) position. */
function trail(
  from: number,
  to: number,
  every: number,
  type: StuntEventType,
  where: (t: number) => Pos,
  dy = 0,
): Ev[] {
  const out: Ev[] = [];
  for (let t = from; t <= to + 1e-9; t += every) {
    const p = where(t);
    out.push([t, type, p.x, p.y + dy]);
  }
  return out;
}

// ----- Loop-the-loop -----

export const LOOP_R = 3;
export const LOOP_CX = 3.5;
export const LOOP_CY = 3;
const LOOP_LEAD = 3.5;
const LOOP_ARC = TAU * LOOP_R;
const LOOP_EXIT = 4.5;
/** Track distance at which the bike leaves the circle. */
const LOOP_S_OUT = LOOP_LEAD + LOOP_ARC;
const LOOP_S_END = LOOP_S_OUT + LOOP_EXIT;

/** The ring track is drawn at z = -0.5; the bike eases onto it over the first 12% of the circle. */
const loopZ = (phi: number) => -0.5 * smooth(Math.min(phi, TAU - phi) / (0.12 * TAU));

/** The bike on the inside of the circle at angle `phi` from the bottom, going anticlockwise. */
function loopPhi(f: Frame, phi: number): void {
  const rr = LOOP_R - WHEEL_R;
  f.bike.x = LOOP_CX + rr * Math.sin(phi);
  f.bike.y = LOOP_CY - rr * Math.cos(phi);
  f.bike.pitch = phi;
  f.bike.z = loopZ(phi);
}

/** The bike at distance `s` along the loop track: lead-in, circle, then the exit road. */
function loopAt(f: Frame, s: number): void {
  if (s <= LOOP_LEAD) {
    f.bike.x = s;
  } else if (s <= LOOP_S_OUT) {
    loopPhi(f, (s - LOOP_LEAD) / LOOP_R);
  } else {
    f.bike.x = LOOP_LEAD + (s - LOOP_S_OUT);
    f.bike.pitch = TAU;
  }
}

const loopClear0: Def = (() => {
  const duration = 2.7;
  const s = track([
    [0, 0],
    [duration, LOOP_S_END, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    const d = s(t);
    loopAt(f, d);
    if (d > LOOP_S_OUT) {
      // A small wheelie-hop on the way out.
      const u = (d - LOOP_S_OUT) / LOOP_EXIT;
      const hop = Math.sin(Math.PI * Math.min(u, 1));
      f.bike.y = BIKE_Y + 0.22 * hop;
      f.bike.pitch = TAU + 0.25 * hop;
    }
  };
  const top = LOOP_S_END ? duration * ((LOOP_LEAD + LOOP_ARC / 2) / LOOP_S_END) : 0;
  return {
    duration,
    word: 'WHOOSH!',
    beats: { top },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 3.5, 0.5],
      ...trail(0.45, 2.3, 0.12, 'spark', bike),
      [top, 'word', 3.5, 5.6],
      [duration * 0.7, 'cheer', 6, 2],
    ],
  };
})();

const loopClear1: Def = (() => {
  const duration = 2.9;
  const s = track([
    [0, 0],
    [duration, LOOP_S_END, 'l'],
  ]);
  const waveA = LOOP_LEAD + 0.75 * Math.PI * LOOP_R;
  const waveB = LOOP_LEAD + 1.3 * Math.PI * LOOP_R;
  // The wheelie out of the loop: up over half a unit, held for a unit, then down.
  const wheelie = track([
    [0, 0],
    [0.5, 0.45],
    [1.5, 0.45, 'l'],
    [2.0, 0],
    [LOOP_EXIT, 0],
  ]);
  const squash = track([
    [1.9, 1],
    [2.3, 0.85],
    [2.9, 1, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    const d = s(t);
    loopAt(f, d);
    if (d > waveA && d < waveB) f.rider.pose = 'wave';
    if (d > LOOP_S_OUT) {
      const e = d - LOOP_S_OUT;
      const w = wheelie(e);
      f.bike.pitch = TAU + w;
      f.bike.y = BIKE_Y + REAR * Math.sin(w);
      f.bike.squash = squash(e);
      if (e > 0.4 && e < 2.2) f.rider.pose = 'wheelie';
    }
  };
  const top = duration * ((LOOP_LEAD + LOOP_ARC / 2) / LOOP_S_END);
  return {
    duration,
    word: 'WHEEE!',
    beats: { top },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 3.5, 0.5],
      ...trail(0.5, 2.0, 0.2, 'spark', bike),
      [top, 'word', 3.5, 5.6],
      [top, 'confetti', 3.5, 5.6],
      [duration * 0.7, 'cheer', 6, 2],
      [duration * 0.8, 'dust', 5.5, 0],
    ],
  };
})();

const loopCrash0: Def = (() => {
  const duration = 3.4;
  const phiHang = Math.PI + 0.12;
  const tLead = 0.25;
  const tTop = 1.05;
  const tDrop = 1.55;
  const tLand = 1.85;
  const hang = (() => {
    const f = createFrame();
    loopPhi(f, phiHang);
    return { x: f.bike.x, y: f.bike.y };
  })();
  const landX = 3.4;
  const phi = track([
    [tLead, 0],
    [tTop, phiHang, 'q'],
  ]);
  const dropT = (t: number) => prog(t, tDrop, tLand, 'l');
  const squash = track([
    [tLand, 0.7],
    [tLand + 0.3, 1, 'o'],
  ]);
  // The rider flops over the bars, then sits up dizzy.
  const flopX = track([
    [tLand, 3.2],
    [tLand + 0.3, 4.9, 'o'],
  ]);
  const flopY = track([
    [tLand, 1.0],
    [tLand + 0.14, 1.2, 'q'],
    [tLand + 0.3, 0.3, 'i'],
    [2.4, 0.2],
  ]);
  const flopRot = track([
    [tLand, 0],
    [tLand + 0.3, -1.5, 'o'],
    [2.15, -1.5],
    [2.4, 0],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLead) {
      f.bike.x = t * (LOOP_LEAD / tLead);
    } else if (t < tDrop) {
      loopPhi(f, phi(t));
      if (t > tTop) {
        // Stuck at the top: wheels turning, a little sway.
        f.bike.grounded = false;
        f.bike.pitch += 0.03 * Math.sin((t - tTop) * 14);
        f.bike.y += 0.04 * Math.sin((t - tTop) * 17);
      }
    } else {
      const u = dropT(t);
      f.bike.x = lerp(hang.x, landX, u);
      f.bike.y = lerp(hang.y, BIKE_Y, u * u);
      f.bike.pitch = lerp(phiHang, TAU, EASE.io(u));
      f.bike.z = lerp(loopZ(phiHang), 0, u);
      f.bike.grounded = t >= tLand;
      f.bike.squash = squash(t);
    }
    // The rider.
    if (t >= tTop && t < tLand) {
      f.rider.pose = 'dangle';
      f.rider.face = 'scared';
    } else if (t >= tLand) {
      const sitting = t >= 2.15;
      setFree(f, flopX(t), flopY(t), flopRot(t), sitting ? 'sit' : 'flail', 'dizzy');
    }
  };
  return {
    duration,
    word: 'UH-OH!',
    beats: { stall: tTop, drop: tDrop, land: tLand },
    at,
    events: () => [
      [tTop, 'word', hang.x, hang.y],
      ...[1.12, 1.26, 1.4].map((a): Ev => [a, 'sweat', hang.x, hang.y - 0.6]),
      [tDrop, 'sfx:slideWhistle', hang.x, hang.y],
      [tLand, 'groan', landX, 1],
      [tLand, 'dust', landX, 0.1],
      [2.4, 'stars', 4.9, 1.6],
    ],
  };
})();

const loopCrash1: Def = (() => {
  const duration = 3.6;
  const s = track([
    [0, 0],
    [0.35, LOOP_LEAD, 'l'],
    [2.0, LOOP_S_OUT, 'l'],
    [2.35, LOOP_S_END, 'l'],
  ]);
  const tOff = 0.35 + (1.65 * (Math.PI / 2)) / TAU;
  const start = (() => {
    const f = createFrame();
    loopPhi(f, Math.PI / 2);
    const h = hipOf(f.bike.x, f.bike.y, Math.PI / 2);
    return { x: h.x, y: h.y };
  })();
  const hayX = 12.2;
  const tLand = 2.3;
  const riderX = track([
    [tOff, start.x],
    [tLand, hayX, 'l'],
    [2.6, hayX + 2.3, 'o'],
  ]);
  const riderRot = track([
    [tOff, Math.PI / 2],
    [tLand, -Math.PI, 'l'],
    [2.6, -TAU, 'io'],
  ]);
  const riderY = (t: number) =>
    t < tLand
      ? arc(start.y, 2.2, 7.2, prog(t, tOff, tLand, 'l'))
      : lerp(2.2, 0.25, prog(t, tLand + 0.05, 2.6, 'i'));
  const bikeX = track([
    [2.35, 8],
    [2.6, 10.8, 'q'],
  ]);
  const at = (t: number, f: Frame) => {
    const d = s(t);
    loopAt(f, d);
    if (t > tOff) {
      // Without its rider the bike wobbles along and tips over past the end of the loop.
      f.rider.visible = false;
      f.bike.roll = 0.12 * Math.sin((t - tOff) * 9) * smooth((t - tOff) / 0.4);
    }
    if (t >= 2.35) {
      f.bike.x = bikeX(t);
      f.bike.roll = lerp(f.bike.roll, Math.PI / 2, prog(t, 2.35, 2.6, 'i'));
      f.bike.y = lerp(BIKE_Y, 0.34, prog(t, 2.35, 2.6, 'i'));
      f.bike.pitch = TAU;
    }
    f.bike.grounded = t < 2.35;
    // The rider shoots up out of the loop, then lands head first in the haystack.
    if (t >= tOff) {
      f.rider.visible = true;
      const flying = t < tLand;
      const sitting = t >= 2.6;
      setFree(
        f,
        riderX(t),
        riderY(t),
        riderRot(t),
        sitting ? 'sit' : 'flail',
        sitting ? 'dizzy' : 'scared',
      );
      if (!flying && !sitting) f.rider.face = 'scared';
    }
  };
  return {
    duration,
    word: 'WHEEE-OOPS!',
    beats: { eject: tOff, land: tLand, hay: 0.2 },
    at,
    events: () => [
      [tOff, 'sfx:whoosh', 6, 3],
      [tOff, 'word', 6, 4],
      [tLand, 'groan', hayX, 2],
      [tLand, 'sfx:splat', hayX, 1.5],
      [tLand, 'dust', hayX, 1.4],
      [2.5, 'dust', 10.4, 0.2],
      [2.7, 'stars', hayX + 2.3, 1.6],
    ],
  };
})();

// ----- Ramp over the shark pool -----

const kicker = (x: number, h: number, len: number) => {
  const v = clamp01(x / len);
  return h * (0.5 * v + 0.5 * v * v);
};
/** The road over the pool: the kicker, the pit (a long way down), then the landing ramp. */
export function rampSurface(x: number): number {
  if (x <= 0) return 0;
  if (x <= 4) return kicker(x, 1.6, 4);
  if (x < 13) return -9;
  if (x <= 17) return kicker(17 - x, 1.2, 4);
  return 0;
}
export const POOL_FROM = 4;
export const POOL_TO = 13;
export const WATER_Y = -1.6;
export const POOL_FLOOR = -3.4;

const RAMP_X0 = 3.2; // the bike's middle when its front wheel reaches the lip
const rampLaunch = (() => {
  const f = createFrame();
  ride(f, rampSurface, RAMP_X0);
  return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
})();

const rampClear0: Def = (() => {
  const duration = 2.5;
  const tLip = 0.32;
  const tLand = 1.62;
  const rxLand = 13.7;
  const land = (() => {
    const f = createFrame();
    rearRide(f, rampSurface, rxLand, 0.5);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const midX = track([
    [0, 0],
    [tLip, RAMP_X0, 'l'],
  ]);
  const flightPitch = track([
    [tLip, rampLaunch.pitch],
    [0.8, 0.4],
    [1.2, 0.2],
    [tLand, land.pitch],
  ]);
  const rx = track([
    [tLand, rxLand],
    [duration, 17.2, 'l'],
  ]);
  const w = track([
    [tLand, 0.5],
    [2.15, 0.45, 'l'],
    [2.4, 0],
  ]);
  const squash = track([
    [2.4, 1],
    [2.44, 0.85],
    [duration, 1, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, rampSurface, midX(t), settleAt(t));
    } else if (t < tLand) {
      const u = (t - tLip) / (tLand - tLip);
      f.bike.x = lerp(rampLaunch.x, land.x, u);
      f.bike.y = arc(rampLaunch.y, land.y, 4.0, u);
      f.bike.pitch = flightPitch(t);
      f.bike.grounded = false;
    } else {
      rideW(f, rampSurface, rx(t) + REAR, w(t));
      f.bike.squash = squash(t);
      if (t < 2.4) f.rider.pose = 'wheelie';
    }
  };
  return {
    duration,
    word: 'WHEEE!',
    beats: { launch: tLip, snap: 0.95, land: tLand },
    at,
    events: () => [
      [0.95, 'word', 9, 3],
      [0.95, 'splash', 8.5, WATER_Y],
      [tLand, 'sfx:chime', 14, 1],
      [tLand, 'dust', 14, 0.9],
      [duration * 0.7, 'cheer', 15, 2],
    ],
  };
})();

const rampClear1: Def = (() => {
  const duration = 2.4;
  const tLip = 0.32;
  const tLand = 1.52;
  const xmLand = 14.6;
  const land = (() => {
    const f = createFrame();
    ride(f, rampSurface, xmLand);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const midX = track([
    [0, 0],
    [tLip, RAMP_X0, 'l'],
  ]);
  const xm = track([
    [tLand, xmLand],
    [duration, 18, 'l'],
  ]);
  const squash = track([
    [tLand, 1],
    [tLand + 0.1, 0.8],
    [tLand + 0.5, 1, 'o'],
  ]);
  const pose = steps<PoseName>([
    [0, 'ride'],
    [0.45, 'duck'],
    [1.0, 'armsUp'],
    [tLand + 0.3, 'ride'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, rampSurface, midX(t), settleAt(t));
    } else if (t < tLand) {
      const u = (t - tLip) / (tLand - tLip);
      f.bike.x = lerp(rampLaunch.x, land.x, u);
      f.bike.y = arc(rampLaunch.y, land.y, 4.0, u);
      // A full backflip: nose up and over, finishing the turn as the wheels meet the ramp.
      f.bike.pitch = lerp(rampLaunch.pitch, TAU + land.pitch, EASE.io(u));
      f.bike.grounded = false;
    } else {
      ride(f, rampSurface, xm(t));
      f.bike.pitch += TAU;
      f.bike.squash = squash(t);
    }
    f.rider.pose = pose(t);
  };
  return {
    duration,
    word: 'BACKFLIP!',
    beats: { launch: tLip, snap: 0.9, land: tLand },
    at,
    events: () => [
      [0.9, 'word', 9, 4],
      [0.9, 'splash', 8.5, WATER_Y],
      [0.9, 'confetti', 9, 4],
      [tLand, 'sfx:boing', 14.6, 1],
      [tLand, 'dust', 14.6, 0.5],
      [duration * 0.7, 'cheer', 16, 2],
    ],
  };
})();

const rampCrash0: Def = (() => {
  const duration = 3.4;
  const tLip = 0.32;
  const tSplash = 0.95;
  const xHit = 8.6;
  const sunkY = -2.98;
  const midX = track([
    [0, 0],
    [tLip, RAMP_X0, 'l'],
  ]);
  const flightPitch = track([
    [tLip, rampLaunch.pitch],
    [0.6, 0.15],
    [tSplash, -0.05],
  ]);
  const sinkY = track([
    [tSplash, WATER_Y + 0.2],
    [1.8, sunkY, 'q'],
  ]);
  const sinkPitch = track([
    [tSplash, -0.05],
    [1.8, 0.35, 'q'],
  ]);
  const riderX = track([
    [tSplash, xHit],
    [1.4, xHit - 0.8, 'o'],
    [2.2, xHit - 1.0, 'io'],
  ]);
  const riderY = track([
    [tSplash, 0.2],
    [1.05, -0.8, 'o'],
    [1.4, WATER_Y + 0.55, 'io'],
    [1.7, WATER_Y + 0.45, 'io'],
  ]);
  const bikeStart = (() => {
    const f = createFrame();
    f.bike.x = lerp(rampLaunch.x, xHit, 1);
    return f.bike.x;
  })();
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, rampSurface, midX(t), settleAt(t));
    } else if (t < tSplash) {
      const u = (t - tLip) / (tSplash - tLip);
      f.bike.x = lerp(rampLaunch.x, bikeStart, u);
      f.bike.y = arc(rampLaunch.y, WATER_Y + 0.2, 3.1, u);
      f.bike.pitch = flightPitch(t);
      f.bike.grounded = false;
    } else {
      f.bike.x = bikeStart + 0.4 * prog(t, tSplash, 1.8, 'q');
      f.bike.y = sinkY(t);
      f.bike.pitch = sinkPitch(t);
      f.bike.grounded = false;
    }
    if (t >= tSplash - 0.12) f.rider.face = 'scared';
    if (t >= tSplash) {
      const sit = t >= 1.4;
      setFree(f, riderX(t), riderY(t), 0, sit ? 'sit' : 'flail', t >= 1.6 ? 'dizzy' : 'scared');
    }
  };
  return {
    duration,
    word: 'SPLOOSH!',
    beats: { splash: tSplash, shark: 1.5, duck: 1.4, sunk: 1.8 },
    at,
    events: () => [
      [tSplash, 'word', xHit, 0],
      [tSplash, 'splash', xHit, WATER_Y],
      [tSplash, 'groan', xHit, 0],
      [tSplash, 'sfx:splat', xHit, WATER_Y],
      [1.05, 'splash', xHit - 0.5, WATER_Y],
      [1.4, 'sfx:honk', xHit - 0.9, WATER_Y + 0.5],
      [1.5, 'splash', xHit, WATER_Y],
      [2.0, 'stars', xHit - 1.0, WATER_Y + 1.7],
    ],
  };
})();

const rampCrash1: Def = (() => {
  const duration = 3.4;
  const tLip = 0.32;
  const tCatch = 0.95;
  const tHang = 1.2;
  const tSlide = 1.8;
  const tWater = 2.1;
  const catchBike = (() => {
    const f = createFrame();
    const p = 1.3;
    // Front wheel on the far edge (13, 1.2), nose up.
    f.bike.x = 13 - REAR * Math.cos(p) - 0.2;
    f.bike.y = 1.2 + WHEEL_R - REAR * Math.sin(p);
    return { x: f.bike.x, y: f.bike.y, pitch: p };
  })();
  const midX = track([
    [0, 0],
    [tLip, RAMP_X0, 'l'],
  ]);
  const pitch = track([
    [tLip, rampLaunch.pitch],
    [0.7, 0.4],
    [tCatch, 0.6],
    [tHang, catchBike.pitch, 'o'],
    [tSlide, catchBike.pitch],
    [tWater, 0.9, 'io'],
    [2.35, 0.2, 'o'],
  ]);
  const bx = track([
    [tCatch, catchBike.x],
    [tSlide, catchBike.x],
    [tWater, catchBike.x - 1.0, 'i'],
    [2.35, catchBike.x - 0.7, 'o'],
  ]);
  const by = track([
    [tCatch, catchBike.y],
    [tSlide, catchBike.y],
    [tWater, WATER_Y + 0.1, 'i'],
    [2.35, -2.95, 'o'],
  ]);
  const riderY = track([
    [tWater, WATER_Y + 0.9],
    [2.35, WATER_Y + 0.5, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, rampSurface, midX(t), settleAt(t));
    } else if (t < tCatch) {
      const u = (t - tLip) / (tCatch - tLip);
      f.bike.x = lerp(rampLaunch.x, catchBike.x, u);
      f.bike.y = arc(rampLaunch.y, catchBike.y, 3.3, u);
      f.bike.pitch = pitch(t);
      f.bike.grounded = false;
    } else {
      f.bike.x = bx(t);
      f.bike.y = by(t);
      f.bike.pitch = pitch(t);
      f.bike.grounded = false;
    }
    if (t >= tCatch - 0.25) f.rider.face = 'scared';
    if (t >= tHang && t < tWater) f.rider.pose = 'dangle';
    if (t >= tWater) {
      const h = hipOf(catchBike.x - 1.0, WATER_Y + 0.1, 0.9);
      const x = lerp(h.x, 12.0, prog(t, tWater, 2.35, 'o'));
      setFree(
        f,
        x,
        t < 2.35 ? lerp(h.y, riderY(t), prog(t, tWater, 2.35, 'o')) : riderY(t),
        0,
        'thumbs',
        'dizzy',
      );
    }
  };
  return {
    duration,
    word: 'NOOOO!',
    beats: { snap: 0.7, catch: tCatch, slide: tSlide, water: tWater },
    at,
    events: () => [
      [tCatch, 'word', catchBike.x, catchBike.y],
      [tCatch, 'groan', catchBike.x, catchBike.y],
      [tCatch, 'sfx:bump', 13, 1.2],
      [tSlide, 'sfx:slideWhistle', 12.8, 1],
      [tWater, 'splash', 12, WATER_Y],
      [2.8, 'stars', 12, WATER_Y + 1.6],
    ],
  };
})();

// ----- Ring of fire -----

export const ringKicker: Surface = (x) => (x <= 0 ? 0 : x <= 3 ? kicker(x, 1.0, 3) : 0);
export const RING_X = 7;
export const RING_Y = 2.6;
export const RING_R = 1.7;
const RING_X0 = 2.2; // the bike's middle when its front wheel reaches the lip
const ringLaunch = (() => {
  const f = createFrame();
  ride(f, ringKicker, RING_X0);
  return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
})();

const ringClear0: Def = (() => {
  const duration = 1.9;
  const tLip = 0.25;
  const tLand = 1.2;
  const xLand = 12;
  const tPass = lerp(tLip, tLand, (RING_X - ringLaunch.x) / (xLand - ringLaunch.x));
  const midX = track([
    [0, 0],
    [tLip, RING_X0, 'l'],
  ]);
  const xm = track([
    [tLand, xLand],
    [duration, 14, 'l'],
  ]);
  const squash = track([
    [tLand, 1],
    [tLand + 0.08, 0.88],
    [tLand + 0.4, 1, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, ringKicker, midX(t), settleAt(t));
    } else if (t < tLand) {
      const u = (t - tLip) / (tLand - tLip);
      f.bike.x = lerp(ringLaunch.x, xLand, u);
      f.bike.y = arc(ringLaunch.y, BIKE_Y, 2.35, u);
      f.bike.pitch = lerp(ringLaunch.pitch, 0, EASE.io(u));
      f.bike.grounded = false;
    } else {
      f.bike.x = xm(t);
      f.bike.squash = squash(t);
    }
    if (t > 0.45 && t < 1.5) f.rider.pose = 'armsUp';
  };
  return {
    duration,
    word: 'HOT STUFF!',
    beats: { pass: tPass, land: tLand },
    at,
    events: () => [
      [tPass, 'word', RING_X, RING_Y],
      [tPass, 'flame', RING_X, RING_Y],
      [tPass + 0.05, 'flame', RING_X, RING_Y + 0.8],
      [tLand, 'dust', xLand, 0.1],
      [duration * 0.7, 'cheer', 13, 2],
    ],
  };
})();

const ringClear1: Def = (() => {
  const duration = 2.2;
  const tLip = 0.25;
  const tLand = 1.3;
  const xLand = 12;
  const tPass = lerp(tLip, tLand, (RING_X - ringLaunch.x) / (xLand - ringLaunch.x));
  const midX = track([
    [0, 0],
    [tLip, RING_X0, 'l'],
  ]);
  const xm = track([
    [tLand, xLand],
    [duration, 14, 'l'],
  ]);
  const squash = track([
    [tLand, 1],
    [tLand + 0.08, 0.88],
    [tLand + 0.4, 1, 'o'],
  ]);
  const pose = steps<PoseName>([
    [0, 'ride'],
    [0.4, 'duck'],
    [tLand, 'ride'],
    [1.5, 'armsUp'],
    [1.85, 'thumbs'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, ringKicker, midX(t), settleAt(t));
    } else if (t < tLand) {
      const u = (t - tLip) / (tLand - tLip);
      f.bike.x = lerp(ringLaunch.x, xLand, u);
      f.bike.y = arc(ringLaunch.y, BIKE_Y, 2.35, u);
      // A full forward flip through the ring.
      f.bike.pitch = lerp(ringLaunch.pitch, -TAU, EASE.io(u));
      f.bike.grounded = false;
    } else {
      f.bike.x = xm(t);
      f.bike.pitch = -TAU;
      f.bike.squash = squash(t);
    }
    f.rider.pose = pose(t);
  };
  return {
    duration,
    word: 'FLIP-TASTIC!',
    beats: { pass: tPass, land: tLand },
    at,
    events: () => [
      [tPass, 'word', RING_X, RING_Y],
      [tPass, 'flame', RING_X, RING_Y],
      [tPass + 0.05, 'flame', RING_X, RING_Y + 0.8],
      [tLand, 'confetti', xLand, 1.5],
      [tLand + 0.2, 'confetti', xLand + 0.6, 2],
      [duration * 0.7, 'cheer', 13, 2],
    ],
  };
})();

const ringCrash0: Def = (() => {
  const duration = 3.4;
  const tLip = 0.25;
  const tHit = 0.7;
  const hit = { x: 5.7, y: 1.5 };
  const tLandBike = 1.05;
  const tFlyEnd = 1.2;
  const tRun = 1.2;
  const tJump = 1.95;
  const tTub = 2.35;
  const midX = track([
    [0, 0],
    [tLip, RING_X0, 'l'],
  ]);
  const seatAtHit = (() => {
    const h = hipOf(hit.x, hit.y, 0.2);
    return { x: h.x, y: h.y };
  })();
  const bikeY = track([
    [tHit, hit.y],
    [tLandBike, BIKE_Y, 'i'],
  ]);
  const bikePitch = track([
    [tHit, 0.2],
    [tLandBike, -0.25, 'i'],
    [1.3, 0.05],
  ]);
  const riderFly = (t: number) => prog(t, tHit, tFlyEnd, 'l');
  const runX = (t: number) => 9.0 + 1.5 * Math.sin((TAU * (t - tRun)) / 0.8);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, ringKicker, midX(t), settleAt(t));
    } else if (t < tHit) {
      const u = (t - tLip) / (tHit - tLip);
      f.bike.x = lerp(ringLaunch.x, hit.x, u);
      f.bike.y = arc(ringLaunch.y, hit.y, 1.7, u);
      f.bike.pitch = lerp(ringLaunch.pitch, 0.2, u);
      f.bike.grounded = false;
    } else {
      f.bike.x = hit.x - 0.25 * prog(t, tHit, tLandBike, 'o');
      f.bike.y = bikeY(t);
      f.bike.pitch = bikePitch(t);
      f.bike.grounded = t >= tLandBike;
      f.bike.squash = t < tHit + 0.1 ? 0.8 : lerp(0.8, 0.95, prog(t, tHit + 0.1, 1.3, 'o'));
    }
    if (t >= tHit - 0.15) f.rider.face = 'scared';
    if (t >= tHit) {
      let x: number;
      let y: number;
      let rot: number;
      let pose: PoseName;
      if (t < tRun) {
        const u = riderFly(t);
        x = lerp(seatAtHit.x, 9.0, u);
        y = arc(seatAtHit.y, 0.68, 3.6, u);
        rot = lerp(0.2, -TAU, EASE.io(u));
        pose = 'flail';
      } else if (t < tJump) {
        x = runX(t);
        y = 0.68;
        rot = -TAU;
        pose = 'run';
      } else if (t < tTub) {
        const u = prog(t, tJump, tTub, 'l');
        x = lerp(runX(tJump), 13, u);
        y = arc(0.68, 0.95, 2.8, u);
        rot = lerp(-TAU, -TAU - 0.3, u);
        pose = 'flail';
      } else {
        x = 13;
        y = 0.95;
        rot = -TAU;
        pose = 'sit';
      }
      setFree(f, x, y, rot, pose, t >= tTub ? 'dizzy' : 'scared');
    }
  };
  return {
    duration,
    word: 'OUCH!',
    beats: { hit: tHit, run: tRun, jump: tJump, tub: tTub },
    at,
    events: (_bike, rider) => [
      [tHit, 'word', hit.x, hit.y + 1],
      [tHit, 'groan', hit.x, hit.y],
      [tHit, 'sfx:crash', 6.5, 1.2],
      [tHit, 'flame', 6.8, 1.2],
      ...trail(tRun + 0.1, tJump, 0.15, 'flame', rider, -0.2),
      [tTub, 'sfx:splat', 13, 1],
      [tTub, 'splash', 13, 1],
      [2.4, 'smoke', 13, 1.6],
      [2.6, 'smoke', 13, 2.0],
    ],
  };
})();

const ringCrash1: Def = (() => {
  const duration = 3.0;
  const tLip = 0.25;
  const tHit = 0.6;
  const hit = { x: 6.2, y: 0.9 };
  const tFlyEnd = 1.1;
  const tRing = 1.0;
  const sitX = 7.9;
  const midX = track([
    [0, 0],
    [tLip, RING_X0, 'l'],
  ]);
  const seatAtHit = (() => {
    const h = hipOf(hit.x, hit.y, 0.1);
    return { x: h.x, y: h.y };
  })();
  const bikeY = track([
    [tHit, hit.y],
    [0.9, BIKE_Y, 'i'],
  ]);
  const bikePitch = track([
    [tHit, 0.1],
    [0.9, -0.15, 'i'],
    [1.1, 0.0],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, ringKicker, midX(t), settleAt(t));
    } else if (t < tHit) {
      const u = (t - tLip) / (tHit - tLip);
      f.bike.x = lerp(ringLaunch.x, hit.x, u);
      f.bike.y = arc(ringLaunch.y, hit.y, 1.2, u);
      f.bike.pitch = lerp(ringLaunch.pitch, 0.1, u);
      f.bike.grounded = false;
    } else {
      f.bike.x = hit.x - 0.2 * prog(t, tHit, 0.9, 'o');
      f.bike.y = bikeY(t);
      f.bike.pitch = bikePitch(t);
      f.bike.grounded = t >= 0.9;
      f.bike.squash = t < tHit + 0.1 ? 0.75 : lerp(0.75, 0.9, prog(t, tHit + 0.1, 1.1, 'o'));
    }
    if (t >= tHit - 0.12) f.rider.face = 'scared';
    if (t >= tHit) {
      if (t < tFlyEnd) {
        const u = prog(t, tHit, tFlyEnd, 'l');
        setFree(
          f,
          lerp(seatAtHit.x, sitX, u),
          arc(seatAtHit.y, 0.22, 2.6, u),
          lerp(0.1, -TAU, EASE.io(u)),
          'flail',
          'scared',
        );
      } else {
        setFree(f, sitX, 0.22, -TAU, 'sit', t >= tRing + 0.5 ? 'sooty' : 'scared');
      }
    }
  };
  return {
    duration,
    word: 'TOASTY!',
    beats: { hit: tHit, ring: tRing, ringDown: tRing + 0.55 },
    at,
    events: () => [
      [tHit, 'word', hit.x, hit.y + 1],
      [tHit, 'groan', hit.x, hit.y],
      [tHit, 'sfx:boom', 7, 1.2],
      [tHit, 'flame', 7, 1.5],
      [tRing + 0.5, 'sfx:fizz', sitX, 0.8],
      [tRing + 0.55, 'smoke', sitX, 0.8],
      [tRing + 0.7, 'smoke', sitX, 1.2],
      [1.9, 'smoke', sitX, 2.0],
      [2.0, 'stars', sitX, 1.8],
    ],
  };
})();

// ----- Wall of crates -----

/** A crate (or other tumbling prop) at some moment: where, how turned, how big, and whether to draw it. */
export interface Piece {
  x: number;
  y: number;
  rot: number;
  scale: number;
  visible: boolean;
}

export const CRATE_COUNT = 9;
/** The tower is 2 crates wide and 4 high; crate `i` has this spot (centre) in it. */
export const crateHome = (i: number): Pos => ({ x: 5.5 + (i % 2), y: 0.5 + Math.floor(i / 2) });
const CRATE_G = 20;

/**
 * One tumbling thing thrown from (x0, y0) with velocity (vx, vy) that spins and bounces once on a
 * floor at `floor` (its centre's lowest height), then lies still. Writes into `out`.
 */
export function fly(
  x0: number,
  y0: number,
  vx: number,
  vy: number,
  rot0: number,
  spin: number,
  floor: number,
  t: number,
  out: Piece,
  g = CRATE_G,
): Piece {
  const dt = Math.max(t, 0);
  // First flight, down to the floor.
  const disc = vy * vy + 2 * g * (y0 - floor);
  const t1 = (vy + Math.sqrt(Math.max(disc, 0))) / g;
  if (dt <= t1) {
    out.x = x0 + vx * dt;
    out.y = y0 + vy * dt - 0.5 * g * dt * dt;
    out.rot = rot0 + spin * dt;
    return out;
  }
  // One bounce, losing most of the speed, then at rest.
  const vyHit = vy - g * t1;
  const vyUp = -vyHit * 0.3;
  const x1 = x0 + vx * t1;
  const rot1 = rot0 + spin * t1;
  const t2 = (2 * vyUp) / g;
  const d2 = Math.min(dt - t1, t2);
  out.x = x1 + vx * 0.4 * d2;
  out.y = floor + vyUp * d2 - 0.5 * g * d2 * d2;
  out.rot = rot1 + spin * 0.25 * d2;
  return out;
}

/** The home spot of crate `i`, tipped about the tower's base at (5, 0) by `angle` (towards -x). */
function crateTipped(i: number, angle: number, out: Piece): Piece {
  const h = crateHome(i);
  const dx = h.x - 5;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out.x = 5 + dx * c - h.y * s;
  out.y = dx * s + h.y * c;
  out.rot = angle;
  return out;
}

function crateHomePiece(i: number, out: Piece): Piece {
  const h = crateHome(i);
  out.x = h.x;
  out.y = h.y;
  out.rot = 0;
  return out;
}

/** Where the crates end up after "Surf" (a staircase) and "Splat" (a heap around the rider). */
const STAIRS: readonly (readonly [number, number, number])[] = [
  [4.5, 0.5, 0.1],
  [5.5, 0.5, -0.06],
  [6.5, 0.5, 0.04],
  [7.5, 0.5, -0.1],
  [5.0, 1.5, 0.15],
  [6.0, 1.5, -0.1],
  [7.0, 1.5, 0.08],
  [8.5, 0.5, 0.35],
];
const HEAP: readonly (readonly [number, number, number])[] = [
  [3.2, 0.5, 0.05],
  [4.2, 0.5, -0.08],
  [5.4, 0.5, 0.1],
  [6.4, 0.5, -0.05],
  [3.7, 1.5, 0.15],
  [5.9, 1.45, -0.2],
  [7.4, 0.5, 0.2],
  [2.5, 0.5, -0.3],
];

const CRATES = {
  smashHit: 0.57,
  smashHead: 1.25,
  surfTip: 0.4,
  surfSettle: 0.85,
  splatHit: 0.5,
  splatCollapse: 1.9,
  splatLand: 2.3,
  accHit: 0.5,
};
const SMASH_HEAD = { x: 8.4, y: 2.6 };

const scratch: Piece = { x: 0, y: 0, rot: 0, scale: 1, visible: true };

/** Crate `i` (0 to 7, or 8 for the one that ends up as a hat) at time `t` of the stunt. */
export function crateAt(
  outcome: Outcome,
  variant: Variant,
  i: number,
  t: number,
  out: Piece = { x: 0, y: 0, rot: 0, scale: 1, visible: true },
): Piece {
  out.scale = 1;
  out.visible = i < 8;
  const home = (): Piece => crateHomePiece(i, out);
  if (outcome === 'clear' && variant === 0) {
    // Smash: the bike ploughs through and the crates fly forward and up.
    if (t < CRATES.smashHit) return home();
    const dt = t - CRATES.smashHit;
    const h = crateHome(i);
    if (i === 6) {
      // This one flies up and drops on the rider's head, then bounces on ahead.
      const dtHead = CRATES.smashHead - CRATES.smashHit;
      const vx = (SMASH_HEAD.x - h.x) / dtHead;
      const vy = (SMASH_HEAD.y - h.y + 0.5 * CRATE_G * dtHead * dtHead) / dtHead;
      if (dt <= dtHead) {
        out.x = h.x + vx * dt;
        out.y = h.y + vy * dt - 0.5 * CRATE_G * dt * dt;
        out.rot = 2 * dt;
        return out;
      }
      return fly(
        SMASH_HEAD.x,
        SMASH_HEAD.y,
        7.5,
        4.5,
        2 * dtHead,
        5,
        0.5,
        t - CRATES.smashHead,
        out,
      );
    }
    const col = i % 2;
    const row = Math.floor(i / 2);
    const vx = 5 + col * 1.5 + row * 1.2 + (i % 3);
    const vy = 5 + row * 1.3 + (i % 3) * 1.2;
    const spin = (i % 2 === 0 ? 1 : -1) * (4 + (i % 4) * 1.5);
    return fly(h.x, h.y, vx, vy, 0, spin, 0.5, dt, out);
  }
  if (outcome === 'clear') {
    // Surf: the tower topples towards the bike and tumbles into a staircase.
    if (i >= 8) return out;
    const tip = prog(t, 0, CRATES.surfTip, 'i');
    crateTipped(i, 1.2 * tip, out);
    if (t > CRATES.surfTip) {
      const u = prog(t, CRATES.surfTip + 0.02 * i, CRATES.surfSettle, 'o');
      const target = STAIRS[i];
      const from = crateTipped(i, 1.2, scratch);
      out.x = lerp(from.x, target[0], u);
      out.y = lerp(from.y, target[1], u) + 0.6 * Math.sin(Math.PI * u) * (1 - u);
      out.rot = lerp(from.rot, target[2], u);
      // The clatter once the bike has passed.
      const late = t - 1.9;
      if (late > 0) out.rot += 0.07 * Math.sin(late * 28) * Math.exp(-late * 6) * (i % 2 ? 1 : -1);
    }
    return out;
  }
  if (variant === 0) {
    // Splat: the tower holds, then collapses over the rider and the bike into a heap.
    if (i === 8) {
      const hatT = CRATES.splatLand + 0.1;
      out.visible = t > CRATES.splatCollapse + 0.2;
      out.scale = 0.55;
      const u = prog(t, CRATES.splatCollapse + 0.2, hatT, 'i');
      out.x = 4.85;
      out.y = lerp(4.2, 2.1, u);
      out.rot = lerp(0.9, 0.22, u);
      return out;
    }
    const start = CRATES.splatCollapse + 0.03 * i;
    if (t < start) return home();
    const h = crateHome(i);
    const target = HEAP[i];
    const u = prog(t, start, CRATES.splatLand, 'i');
    out.x = lerp(h.x, target[0], u);
    out.y = lerp(h.y, target[1], u);
    out.rot =
      lerp(0, target[2] - 0.5 * (1 - u) * (i % 2 ? 1 : -1), u) +
      0.3 * Math.sin(Math.PI * u) * (i % 2 ? 1 : -1);
    return out;
  }
  // Accordion: the tower shakes and the top crates fall off.
  if (i >= 8) return out;
  if (t < CRATES.accHit) return home();
  const dt = t - CRATES.accHit;
  if (i >= 6 && dt > 0.4) {
    const h = crateHome(i);
    const wob = Math.exp(-3 * 0.4) * 0.05 * Math.sin(0.4 * 25);
    return fly(h.x, h.y, 2.5 + (i - 6) * 1.6, 1.5, wob, (i === 6 ? 1 : -1) * 4, 0.5, dt - 0.4, out);
  }
  home();
  out.rot = 0.05 * Math.sin(dt * 25) * Math.exp(-3 * dt) * (i % 2 ? 1 : -1);
  return out;
}

/** Where the bike rides over the staircase of "Surf": up the steps and across the top. */
const stairsSurface: Surface = (x) => {
  if (x <= 3.3) return 0;
  if (x <= 5.0) return 1.98 * smooth((x - 3.3) / 1.7);
  return 1.98;
};

const cratesClear0: Def = (() => {
  const duration = 1.8;
  const xm = track([
    [0, 0],
    [duration, 12, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    f.bike.x = xm(t);
  };
  const hitX = xm(CRATES.smashHit);
  return {
    duration,
    word: 'KABOOM!',
    beats: { hit: CRATES.smashHit, head: CRATES.smashHead },
    at,
    events: () => [
      [CRATES.smashHit, 'word', 5.5, 2.5],
      [CRATES.smashHit, 'debris', 5.8, 2],
      [CRATES.smashHit, 'smoke', 6.5, 1],
      [CRATES.smashHit, 'sfx:crash', hitX + 1, 1],
      [CRATES.smashHit + 0.1, 'debris', 6.5, 3],
      [CRATES.smashHead, 'sfx:bump', SMASH_HEAD.x, SMASH_HEAD.y],
      [duration * 0.7, 'cheer', 10, 2],
    ],
  };
})();

const cratesClear1: Def = (() => {
  const duration = 2.3;
  const tClimb = 0.85;
  const tCrest = 1.45;
  const tLand = 1.95;
  const xmLand = 9.8;
  const crest = (() => {
    const f = createFrame();
    ride(f, stairsSurface, 6.3);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const land = (() => {
    const f = createFrame();
    f.bike.x = xmLand;
    return { x: f.bike.x, y: f.bike.y, pitch: 0 };
  })();
  const xm = track([
    [0, 0],
    [tClimb, 3.3, 'l'],
    [tCrest, 6.3, 'l'],
  ]);
  const xEnd = track([
    [tLand, xmLand],
    [duration, 12, 'l'],
  ]);
  const squash = track([
    [tLand, 1],
    [tLand + 0.06, 0.88],
    [tLand + 0.35, 1, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tCrest) {
      ride(f, stairsSurface, xm(t), settleAt(t));
    } else if (t < tLand) {
      const u = (t - tCrest) / (tLand - tCrest);
      f.bike.x = lerp(crest.x, land.x, u);
      f.bike.y = arc(crest.y, land.y, 2.95, u);
      f.bike.pitch = lerp(crest.pitch, 0, EASE.io(u));
      f.bike.grounded = false;
    } else {
      f.bike.x = xEnd(t);
      f.bike.squash = squash(t);
    }
    if (t > tCrest - 0.2 && t < tLand) f.rider.pose = 'surf';
  };
  return {
    duration,
    word: 'WOO-HOO!',
    beats: { topple: 0, settle: CRATES.surfSettle, crest: tCrest, land: tLand },
    at,
    events: () => [
      [0.1, 'sfx:bump', 5.5, 2],
      [0.3, 'debris', 4.5, 2],
      [CRATES.surfTip, 'dust', 5, 0.5],
      [CRATES.surfTip, 'word', 5.5, 3],
      [CRATES.surfSettle, 'sfx:bump', 6, 0.5],
      [CRATES.surfSettle, 'dust', 6, 0.5],
      [duration * 0.7, 'cheer', 10, 2],
    ],
  };
})();

const cratesCrash0: Def = (() => {
  const duration = 3.4;
  const tHit = CRATES.splatHit;
  const bikeX = 3.78;
  const xm = track([
    [0, 0],
    [tHit, bikeX, 'l'],
  ]);
  const seatAtHit = (() => {
    const h = hipOf(bikeX, BIKE_Y, 0);
    return { x: h.x, y: h.y };
  })();
  const wallX = 4.5;
  const tStick = 0.8;
  const riderX = track([
    [tHit, seatAtHit.x],
    [tStick, wallX, 'o'],
    [1.4, wallX],
    [2.05, wallX + 0.3, 'io'],
    [2.35, 4.8, 'io'],
  ]);
  const riderRot = track([
    [tHit, 0],
    [tStick - 0.1, -0.5],
    [tStick, 0, 'o'],
  ]);
  const riderY = (t: number) => {
    if (t < tStick) return arc(seatAtHit.y, 2.4, 3.2, prog(t, tHit, tStick, 'l'));
    if (t < 1.4) return 2.4;
    if (t < 2.05) return lerp(2.4, 1.0, prog(t, 1.4, 2.05, 'l'));
    return lerp(1.0, 0.75, prog(t, 2.05, 2.35, 'i'));
  };
  const bikeSquash = track([
    [tHit, 1],
    [tHit + 0.08, 0.6, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    f.bike.x = t < tHit ? xm(t) : bikeX;
    f.bike.squash = bikeSquash(t);
    f.bike.grounded = t < tHit;
    if (t >= tHit - 0.1) f.rider.face = 'scared';
    if (t >= tHit) {
      const splat = t < 2.05;
      setFree(
        f,
        riderX(t),
        riderY(t),
        riderRot(t),
        t < tStick ? 'flail' : splat ? 'splat' : 'sit',
        t < tStick ? 'scared' : t < 2.35 ? 'scared' : 'dizzy',
      );
    }
  };
  return {
    duration,
    word: 'SPLAT!',
    beats: {
      hit: tHit,
      stick: tStick,
      slide: 1.4,
      collapse: CRATES.splatCollapse,
      land: CRATES.splatLand,
    },
    at,
    events: () => [
      [tHit, 'word', 4.6, 2.5],
      [tHit, 'groan', 4.2, 1.5],
      [tHit, 'sfx:crash', 5, 1.2],
      [tHit, 'debris', 5, 1.5],
      [tStick, 'sfx:splat', wallX, 2.4],
      [tStick, 'dust', 5, 2.4],
      [1.4, 'sfx:slideWhistle', wallX, 2.4],
      [CRATES.splatCollapse, 'debris', 4.5, 2],
      [CRATES.splatLand, 'dust', 4.5, 0.3],
      [CRATES.splatLand, 'smoke', 4.5, 0.6],
      [2.5, 'stars', 4.85, 2.7],
    ],
  };
})();

const cratesCrash1: Def = (() => {
  const duration = 3.0;
  const tHit = CRATES.accHit;
  const hitX = 3.78;
  const xm = track([
    [0, 0],
    [tHit, hitX, 'l'],
  ]);
  const tLaunch = 0.75;
  const tLand = 1.5;
  const endX = -2.2;
  const squash = track([
    [tHit, 1],
    [tHit + 0.1, 0.45, 'o'],
    [tLaunch, 0.45],
    [tLaunch + 0.1, 1.15, 'o'],
    [tLaunch + 0.25, 1, 'io'],
  ]);
  const seatAtHit = (() => {
    const h = hipOf(hitX, BIKE_Y, 0);
    return { x: h.x, y: h.y };
  })();
  const riderEnd = -3.6;
  const at = (t: number, f: Frame) => {
    f.bike.squash = squash(t);
    if (t < tHit) {
      f.bike.x = xm(t);
    } else if (t < tLaunch) {
      f.bike.x = hitX;
      f.bike.grounded = false;
    } else if (t < tLand) {
      const u = (t - tLaunch) / (tLand - tLaunch);
      f.bike.x = lerp(hitX, endX, EASE.q(u));
      f.bike.y = arc(BIKE_Y, 0.34, 3.2, u);
      f.bike.pitch = lerp(0, TAU, u);
      f.bike.roll = lerp(0, Math.PI / 2, EASE.i(u));
      f.bike.grounded = false;
    } else {
      f.bike.x = endX;
      f.bike.y = 0.34;
      f.bike.pitch = TAU;
      f.bike.roll = Math.PI / 2;
      f.bike.grounded = false;
    }
    if (t >= tHit - 0.1) f.rider.face = 'scared';
    if (t >= tLaunch) {
      const u = (t - tLaunch) / (tLand - tLaunch + 0.1);
      if (t < tLand + 0.1) {
        setFree(
          f,
          lerp(seatAtHit.x, riderEnd, EASE.q(clamp01(u))),
          arc(seatAtHit.y, 0.2, 3.6, clamp01(u)),
          lerp(0, -TAU, clamp01(u)),
          'flail',
          'scared',
        );
      } else {
        setFree(f, riderEnd, 0.2, -TAU, 'sit', 'dizzy');
      }
    }
  };
  return {
    duration,
    word: 'BOINNNG!',
    beats: { hit: tHit, launch: tLaunch, land: tLand, fall: 0.9 },
    at,
    events: (bike) => [
      [tHit, 'word', 4.5, 2],
      [tHit, 'groan', 4.5, 1],
      [tLaunch, 'sfx:boing', hitX, 1],
      ...trail(tLaunch, tLand, 0.12, 'dust', bike),
      [tLand, 'dust', endX, 0.3],
      [tLand + 0.1, 'dust', riderEnd, 0.3],
      [2.0, 'stars', riderEnd, 1.8],
    ],
  };
})();

// ----- Wobbly plank bridge -----

export const BRIDGE_FROM = 3;
export const BRIDGE_TO = 15;
export const BRIDGE_PLANKS = 12;
export const CANYON_FLOOR = -5;

/** How far the planks wave up and down at x at time t (zero at both ends). */
export function bridgeWave(x: number, t: number): number {
  const edge = smooth((x - BRIDGE_FROM) / 1.5) * smooth((BRIDGE_TO - x) / 1.5);
  return edge * 0.25 * (1 + Math.sin(6.5 * t - 0.9 * (x - BRIDGE_FROM)));
}
const bridgeSurface =
  (t: number): Surface =>
  (x) =>
    x <= BRIDGE_FROM || x >= BRIDGE_TO ? 0 : bridgeWave(x, t);

/** How deep the middle of the bridge sags in "Trampoline" at time t. */
export const bridgeSag = track([
  [0.35, 0],
  [0.9, 1.6, 'o'],
  [1.15, 0.2, 'q'],
  [1.4, 1.9, 'i'],
  [1.7, 0.2, 'q'],
  [1.95, 2.1, 'i'],
  [2.4, 0.1, 'q'],
  [3.0, 0, 'io'],
]);
const sagShape = (x: number) =>
  x <= BRIDGE_FROM || x >= BRIDGE_TO ? 0 : Math.sin((Math.PI * (x - BRIDGE_FROM)) / 12);
const sagSurface =
  (t: number): Surface =>
  (x) =>
    -bridgeSag(t) * sagShape(x);

const BRIDGE = {
  missLast: 1.7, // the plank that stays up until it lands on the rider's head
  missHead: 2.3,
  missRiderX: 8.2,
  missRiderY: CANYON_FLOOR + 0.2,
};

/** Plank `i` (0 to 11) of the bridge at time `t`. */
export function plankAt(
  outcome: Outcome,
  variant: Variant,
  i: number,
  t: number,
  out: Piece = { x: 0, y: 0, rot: 0, scale: 1, visible: true },
): Piece {
  const x = BRIDGE_FROM + 0.5 + i;
  out.scale = 1;
  out.visible = true;
  if (outcome === 'clear') {
    out.x = x;
    out.y = bridgeWave(x, t);
    out.rot = Math.atan2(bridgeWave(x + 0.25, t) - bridgeWave(x - 0.25, t), 0.5);
    return out;
  }
  if (variant === 1) {
    out.x = x;
    out.y = sagSurface(t)(x);
    out.rot = Math.atan2(sagSurface(t)(x + 0.25) - sagSurface(t)(x - 0.25), 0.5);
    return out;
  }
  // Missing: the planks drop away one by one, ahead of the bike.
  const fallsAt = i === 5 ? BRIDGE.missLast : 0.2 + 0.12 * i;
  if (t < fallsAt) {
    out.x = x;
    out.y = 0;
    out.rot = 0;
    return out;
  }
  const floor = CANYON_FLOOR + 0.1;
  const spin = (i % 2 ? 1 : -1) * (1.5 + (i % 3));
  if (i === 5) {
    // Drops straight on the rider's head, then bounces off.
    const dt = t - fallsAt;
    const dtHead = BRIDGE.missHead - fallsAt;
    const g = (2 * (0 - (BRIDGE.missRiderY + 1.15))) / (dtHead * dtHead);
    if (dt <= dtHead) {
      out.x = lerp(x, BRIDGE.missRiderX, dt / dtHead);
      out.y = -0.5 * g * dt * dt;
      out.rot = 0.4 * (dt / dtHead);
      return out;
    }
    return fly(
      BRIDGE.missRiderX,
      BRIDGE.missRiderY + 1.15,
      2.2,
      3,
      0.4,
      3,
      floor,
      t - BRIDGE.missHead,
      out,
    );
  }
  const dt = t - fallsAt;
  out.x = x + 0.3 * dt * (i % 2 ? 1 : -1);
  out.y = Math.max(floor, -0.5 * 22 * dt * dt);
  out.rot = spin * Math.min(dt, Math.sqrt((2 * -floor) / 22));
  return out;
}

const bridgeClear0: Def = (() => {
  const duration = 2.6;
  const xm = track([
    [0, 0],
    [duration, 18, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    const x = xm(t);
    const onBridge = x > BRIDGE_FROM - 0.5 && x < BRIDGE_TO + 0.5;
    ride(f, bridgeSurface(t), x, settleAt(t));
    const weight = smooth((x - 2.5) / 1) * smooth((15.5 - x) / 1);
    f.bike.roll = 0.12 * Math.sin(5 * t) * weight;
    // A little wheelie at the far end.
    const u = (x - 15.2) / 1.6;
    if (u > 0 && u < 1) {
      const wp = 0.4 * Math.sin(Math.PI * u);
      f.bike.pitch += wp;
      f.bike.y += REAR * Math.sin(wp);
    }
    if (onBridge && x > 2.8 && x < 15.2) f.rider.pose = 'balance';
  };
  return {
    duration,
    word: 'PHEW!',
    beats: { start: 0 },
    at,
    events: () => [
      [0.9, 'sfx:bump', 5, 0.3],
      [duration * 0.62, 'word', 15.5, 1.5],
      [duration * 0.64, 'dust', 15.8, 0.1],
      [duration * 0.7, 'cheer', 16.5, 2],
    ],
  };
})();

const bridgeClear1: Def = (() => {
  const duration = 3.0;
  const xm = track([
    [0, 0],
    [duration, 18, 'l'],
  ]);
  const wheelie = (x: number) => 0.5 * smooth((x - 1.8) / 1.2) * smooth((15.7 - x) / 1.0);
  const squash = track([
    [2.5, 1],
    [2.58, 0.85],
    [2.95, 1, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    const x = xm(t);
    rideW(f, bridgeSurface(t), x, wheelie(x));
    f.bike.roll = 0.08 * Math.sin(5 * t) * smooth((x - 3) / 1) * smooth((15 - x) / 1);
    f.bike.squash = squash(t);
    f.bike.grounded = wheelie(x) < 0.45;
    if (x > 3 && x <= 6.5) f.rider.pose = 'wheelie';
    else if (x > 6.5 && x < 11.5) f.rider.pose = 'wave';
    else if (x >= 11.5 && x < 15.4) f.rider.pose = 'wheelie';
  };
  return {
    duration,
    word: 'WOBBLE-WOW!',
    beats: { start: 0, drop: 2.55 },
    at,
    events: () => [
      [1.2, 'word', 8, 2],
      [2.58, 'sfx:boing', 15.8, 0.4],
      [2.58, 'confetti', 15.8, 1.2],
      [2.6, 'dust', 15.6, 0.1],
      [duration * 0.7, 'cheer', 16.5, 2],
    ],
  };
})();

const bridgeCrash0: Def = (() => {
  const duration = 3.6;
  const tDip = 0.55;
  const tLand = 1.4;
  const dipX = 4.5;
  const floorBike = CANYON_FLOOR + BIKE_Y;
  const xm = track([
    [0, 0],
    [tDip, dipX, 'l'],
  ]);
  const landX = 7.6;
  const pitch = track([
    [tDip, 0],
    [0.8, -0.5, 'i'],
    [tLand - 0.1, -1.2],
    [tLand, -0.15, 'i'],
    [tLand + 0.3, 0.0, 'o'],
  ]);
  const dipY = BIKE_Y + bridgeSurface(tDip)(dipX);
  const riderX = track([
    [tLand, landX - 0.1],
    [1.9, BRIDGE.missRiderX, 'o'],
  ]);
  const riderY = track([
    [tLand, floorBike + SEAT.y],
    [1.9, BRIDGE.missRiderY, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tDip) {
      ride(f, bridgeSurface(t), xm(t), settleAt(t));
    } else if (t < tLand) {
      const u = (t - tDip) / (tLand - tDip);
      f.bike.x = lerp(dipX, landX, u);
      // Slow to start, then a quick drop.
      f.bike.y = lerp(dipY, floorBike, u * u * (0.5 + 0.5 * u));
      f.bike.pitch = pitch(t);
      f.bike.grounded = false;
      f.bike.squash = 1;
    } else {
      f.bike.x = landX;
      f.bike.y = floorBike + 0.14 * Math.max(0, 1 - (t - tLand) / 0.2) ** 2;
      f.bike.pitch = pitch(t);
      f.bike.squash = t < tLand + 0.4 ? lerp(0.8, 1, prog(t, tLand, tLand + 0.4, 'o')) : 1;
    }
    if (t >= tDip - 0.1 && t < 1.9) f.rider.face = 'scared';
    if (t >= tDip + 0.1 && t < tLand) f.rider.pose = 'flail';
    if (t >= tLand) {
      const h = hipOf(landX, floorBike, 0);
      const k = prog(t, tLand, 1.9, 'o');
      setFree(
        f,
        lerp(h.x, riderX(t), k),
        lerp(h.y, riderY(t), k),
        0,
        t < 1.9 ? 'sit' : 'wave',
        t < 1.9 ? 'scared' : 'dizzy',
      );
    }
  };
  return {
    duration,
    word: 'UH-OH!',
    beats: { dip: tDip, land: tLand, head: BRIDGE.missHead },
    at,
    events: () => [
      [tDip, 'word', dipX + 1, 1],
      [tDip, 'groan', dipX, 0.5],
      [0.7, 'sfx:slideWhistle', 6, 0],
      ...[0.3, 0.45, 0.6, 0.75, 0.9].map((a): Ev => [a, 'debris', 4 + (a - 0.3) * 6, 0]),
      [tLand, 'dust', landX, CANYON_FLOOR + 0.2],
      [BRIDGE.missHead, 'debris', BRIDGE.missRiderX, CANYON_FLOOR + 1.2],
      [BRIDGE.missHead, 'stars', BRIDGE.missRiderX, CANYON_FLOOR + 1.8],
    ],
  };
})();

const bridgeCrash1: Def = (() => {
  const duration = 4.0;
  const [c1, a1, c2, a2, c3, a3] = [0.95, 1.2, 1.4, 1.65, 1.95, 2.25];
  const tFloor = 2.6;
  const xm = track([
    [0, 0],
    [0.45, BRIDGE_FROM, 'l'],
    [c1, 9.0, 'l'],
    [c3, 9.4, 'l'],
    [tFloor, 10.6, 'io'],
  ]);
  const contactY = (t: number) => BIKE_Y + sagSurface(t)(xm(t));
  const y = track([
    [0.45, BIKE_Y],
    [c1, contactY(c1)],
    [a1, 1.5, 'o'],
    [c2, contactY(c2), 'i'],
    [a2, 3.0, 'o'],
    [c3, contactY(c3), 'i'],
    [a3, 5.0, 'o'],
    [tFloor, CANYON_FLOOR + BIKE_Y, 'i'],
  ]);
  const squash = track([
    [c1 - 0.05, 1],
    [c1, 0.85],
    [c1 + 0.1, 1],
    [c2 - 0.05, 1],
    [c2, 0.85],
    [c2 + 0.1, 1],
    [c3 - 0.05, 1],
    [c3, 0.85],
    [c3 + 0.1, 1],
    [tFloor, 1],
    [tFloor + 0.1, 0.8],
    [tFloor + 0.35, 1, 'o'],
  ]);
  const pitch = track([
    [a3, 0],
    [tFloor, -0.5, 'io'],
    [tFloor + 0.35, 0.1, 'o'],
  ]);
  const farX = 16.5;
  const tRiderLand = 2.85;
  const at = (t: number, f: Frame) => {
    if (t < 0.45) {
      ride(f, bridgeSurface(t), xm(t), settleAt(t));
    } else {
      f.bike.x = xm(t);
      f.bike.y = y(t);
      f.bike.pitch = pitch(t);
      f.bike.squash = squash(t);
      f.bike.grounded = (t > c1 - 0.03 && t < c1 + 0.05) || (t > c2 - 0.03 && t < c2 + 0.05);
    }
    if (t >= c1 - 0.2) f.rider.face = 'scared';
    if (t >= c1 && t < c3) f.rider.pose = 'flail';
    if (t >= c3) {
      const u = prog(t, c3, tRiderLand, 'l');
      const h = hipOf(9.4, contactY(c3), 0);
      const landed = t >= tRiderLand;
      setFree(
        f,
        lerp(h.x, farX, landed ? 1 : u),
        landed ? 0.22 : arc(h.y, 0.22, 7.2, u),
        landed ? -TAU : lerp(0, -TAU, u),
        landed ? 'sit' : 'flail',
        landed ? 'dizzy' : 'scared',
      );
    }
  };
  return {
    duration,
    word: 'BOING-BOING-BOING!',
    beats: { sag: 0.35, c1, c2, c3, launch: c3, floor: tFloor },
    at,
    events: () => [
      [c1, 'sfx:boing', 9, -1],
      [c1, 'word', 9, 1],
      [c1, 'groan', 9, 0],
      [c2, 'sfx:boing', 9.2, -1],
      [c3, 'sfx:boing', 9.4, -1],
      [c1, 'dust', 9, 0.2],
      [c2, 'dust', 9, 0.2],
      [c3, 'dust', 9.4, 0.2],
      [tFloor, 'dust', 10.6, CANYON_FLOOR + 0.2],
      [tRiderLand, 'dust', farX, 0.1],
      [tRiderLand + 0.1, 'stars', farX, 1.7],
    ],
  };
})();

// ----- See-saw -----

export const SEESAW_FROM = 2;
export const SEESAW_TO = 12;
export const SEESAW_PIVOT_X = 7;
export const SEESAW_PIVOT_Y = 1.2;
/** The plank's tilt (radians, positive when the far end is up) when it starts. */
export const SEESAW_TILT = Math.atan2(2.4, 10);

/** The top of the plank at x when it is tilted by `tilt`, or the road beside it. */
function seesawSurface(tilt: number): Surface {
  const slope = Math.tan(tilt);
  return (x) => {
    if (x < SEESAW_FROM || x > SEESAW_TO) return 0;
    return Math.max(0, SEESAW_PIVOT_Y + slope * (x - SEESAW_PIVOT_X));
  };
}

const SEE = {
  tipStart: 1.25,
  tipEnd: 1.75,
  hopSlam: 1.0,
  rockStart: 0.6,
  launch: 1.3,
};

/** The plank's tilt at time `t` of the stunt. */
export function seesawAngle(outcome: Outcome, variant: Variant, t: number): number {
  const a = SEESAW_TILT;
  if (outcome === 'clear' && variant === 0) {
    return track([
      [SEE.tipStart, a],
      [SEE.tipEnd, -a],
    ])(t);
  }
  if (outcome === 'clear') {
    return track([
      [0.55, a],
      [SEE.hopSlam, -a, 'i'],
      [SEE.hopSlam + 0.12, -a * 0.55, 'o'],
      [SEE.hopSlam + 0.3, -a, 'i'],
    ])(t);
  }
  if (variant === 0) {
    const d = (deg: number) => (deg * Math.PI) / 180;
    return track([
      [SEE.rockStart, a],
      [SEE.rockStart + 0.12, -d(8)],
      [SEE.rockStart + 0.24, d(8)],
      [SEE.rockStart + 0.38, -d(14)],
      [SEE.rockStart + 0.52, d(14)],
      [SEE.rockStart + 0.68, -d(20)],
      [SEE.launch - 0.04, d(20)],
      [SEE.launch + 0.08, -a * 1.4, 'o'],
      [SEE.launch + 0.5, -a, 'io'],
    ])(t);
  }
  // Wrong way: the plank digs in under the stalled bike, then slams back once it has slid off.
  return track([
    [0.3, a],
    [0.65, a + 0.12],
    [1.3, a + 0.12],
    [1.45, a * 0.4, 'i'],
    [1.6, a * 0.6, 'o'],
    [1.8, a * 0.5],
  ])(t);
}

const seesawClear0: Def = (() => {
  const duration = 2.2;
  const xm = track([
    [0, 0],
    [0.7, 6.6, 'l'],
    [1.2, 7.1, 'l'],
    [1.5, 7.4, 'l'],
    [2.05, 12.2, 'i'],
    [duration, 14, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    ride(f, seesawSurface(seesawAngle('clear', 0, t)), xm(t), settleAt(t));
    if (t > 0.6 && t < 1.7) f.rider.pose = 'balance';
    f.bike.grounded = true;
  };
  return {
    duration,
    word: 'PERFECT!',
    beats: { tipStart: SEE.tipStart, tipEnd: SEE.tipEnd },
    at,
    events: () => [
      [SEE.tipStart, 'sfx:bump', SEESAW_PIVOT_X, SEESAW_PIVOT_Y],
      [SEE.tipEnd, 'word', 10.5, 1.5],
      [SEE.tipEnd, 'sfx:bump', 11.8, 0.2],
      [SEE.tipEnd, 'dust', 11.8, 0.1],
      [duration * 0.7, 'cheer', 12.5, 2],
    ],
  };
})();

const seesawClear1: Def = (() => {
  const duration = 2.4;
  const xm = track([
    [0, 0],
    [0.65, 6.8, 'l'],
    [SEE.hopSlam, 9.2, 'l'],
  ]);
  const tLand = 1.85;
  const xmLand = 13.2;
  const hopFrom = (() => {
    const f = createFrame();
    ride(f, seesawSurface(seesawAngle('clear', 1, SEE.hopSlam)), 9.2);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const xEnd = track([
    [tLand, xmLand],
    [duration, 14, 'l'],
  ]);
  const squash = track([
    [tLand, 1],
    [tLand + 0.06, 0.8],
    [tLand + 0.4, 1, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < SEE.hopSlam) {
      ride(f, seesawSurface(seesawAngle('clear', 1, t)), xm(t), settleAt(t));
    } else if (t < tLand) {
      const u = (t - SEE.hopSlam) / (tLand - SEE.hopSlam);
      f.bike.x = lerp(hopFrom.x, xmLand, u);
      f.bike.y = arc(hopFrom.y, BIKE_Y, 3.2, u);
      f.bike.pitch = lerp(hopFrom.pitch, 0, EASE.io(u));
      f.bike.grounded = false;
    } else {
      f.bike.x = xEnd(t);
      f.bike.squash = squash(t);
    }
    if (t > SEE.hopSlam && t < tLand + 0.2) f.rider.pose = 'armsUp';
  };
  return {
    duration,
    word: 'BOING!',
    beats: { slam: SEE.hopSlam, land: tLand },
    at,
    events: () => [
      [SEE.hopSlam, 'sfx:boing', 11, 0.5],
      [SEE.hopSlam, 'word', 10, 3],
      [SEE.hopSlam, 'dust', 11.8, 0.1],
      [tLand, 'dust', xmLand, 0.1],
      [duration * 0.7, 'cheer', 14, 2],
    ],
  };
})();

const seesawCrash0: Def = (() => {
  const duration = 3.8;
  const tStop = 0.6;
  const tLand = 2.4;
  const flight = SEE.launch - 0.04;
  const xmStop = 7.0;
  const xm = track([
    [0, 0],
    [tStop - 0.05, xmStop - 0.1, 'l'],
    [tStop, xmStop],
  ]);
  const launchFrom = (() => {
    const f = createFrame();
    ride(f, seesawSurface(seesawAngle('crash', 0, flight)), xmStop);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const bikeLand = { x: 12.6, y: 1.0 };
  const riderLand = { x: 12.0, y: 0.32 };
  const hip0 = (() => {
    const h = hipOf(launchFrom.x, launchFrom.y, launchFrom.pitch);
    return { x: h.x, y: h.y };
  })();
  const bikeRoll = track([
    [flight, 0],
    [tLand, Math.PI, 'io'],
  ]);
  const bikePitch = track([
    [flight, launchFrom.pitch],
    [tLand, 0.3, 'io'],
  ]);
  const settle = track([
    [tLand, 1],
    [tLand + 0.3, 0, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < flight) {
      ride(f, seesawSurface(seesawAngle('crash', 0, t)), t < tStop ? xm(t) : xmStop, settleAt(t));
      f.bike.grounded = true;
    } else if (t < tLand) {
      const u = (t - flight) / (tLand - flight);
      f.bike.x = lerp(launchFrom.x, bikeLand.x, u);
      f.bike.y = arc(launchFrom.y, bikeLand.y, 7.4, u);
      f.bike.pitch = bikePitch(t);
      f.bike.roll = bikeRoll(t);
      f.bike.grounded = false;
    } else {
      f.bike.x = bikeLand.x;
      f.bike.y = bikeLand.y;
      f.bike.pitch = bikePitch(tLand);
      f.bike.roll = Math.PI;
      f.bike.grounded = false;
      f.bike.squash = 1 - 0.15 * settle(t);
    }
    if (t >= tStop - 0.1) f.rider.face = 'scared';
    if (t >= flight && t < tLand) {
      // Both fly up together; the rider peels away at the top and lands first.
      const u = (t - flight) / (tLand - flight);
      setFree(
        f,
        lerp(hip0.x, riderLand.x, u),
        arc(hip0.y, riderLand.y, 7.0, u),
        lerp(launchFrom.pitch, -TAU - Math.PI / 2, u),
        'flail',
        'scared',
      );
    } else if (t >= tLand) {
      setFree(f, riderLand.x, riderLand.y, -TAU - Math.PI / 2, 'splat', 'dizzy');
    }
  };
  return {
    duration,
    word: 'CATAPULT!',
    beats: { stop: tStop, rock: SEE.rockStart, launch: flight, land: tLand },
    at,
    events: (bike) => [
      [SEE.rockStart + 0.12, 'sfx:bump', SEESAW_PIVOT_X, SEESAW_PIVOT_Y],
      [SEE.rockStart + 0.38, 'sfx:bump', SEESAW_PIVOT_X, SEESAW_PIVOT_Y],
      [SEE.rockStart + 0.68, 'sfx:bump', SEESAW_PIVOT_X, SEESAW_PIVOT_Y],
      [flight, 'word', 8, 3],
      [flight, 'sfx:slideWhistle', 8, 3],
      [flight, 'dust', 7.5, 1.4],
      ...trail(flight + 0.1, flight + 0.9, 0.2, 'sweat', bike),
      [tLand, 'groan', 12.3, 0.6],
      [tLand, 'sfx:splat', 12.3, 0.4],
      [tLand, 'dust', 12.3, 0.1],
      [2.6, 'stars', 12.2, 1.4],
    ],
  };
})();

const seesawCrash1: Def = (() => {
  const duration = 2.8;
  const tStall = 0.6;
  const tOff = 1.2;
  const tFall = 1.4;
  const xm = track([
    [0, 0],
    [0.25, 2.2, 'l'],
    [tStall, 4.4, 'q'],
    [tOff, 1.0, 'i'],
    [tFall, -0.1, 'o'],
  ]);
  const bikeRest = { x: 0.7, y: 0.34 };
  const fallPitch = track([
    [tOff, 0],
    [tFall - 0.05, -0.5],
    [tFall + 0.2, 0, 'i'],
  ]);
  const roll = track([
    [tFall, 0],
    [tFall + 0.3, Math.PI / 2, 'i'],
  ]);
  const sitSpot = { x: -0.2, y: 0.2 };
  const at = (t: number, f: Frame) => {
    const surf = seesawSurface(seesawAngle('crash', 1, t));
    if (t < tFall) {
      ride(f, surf, xm(t), settleAt(t));
      f.bike.grounded = true;
      if (t > tOff - 0.1) f.bike.pitch += fallPitch(t);
    } else {
      const k = prog(t, tFall, tFall + 0.35, 'o');
      f.bike.x = lerp(-0.1, bikeRest.x, k);
      f.bike.y = lerp(BIKE_Y, bikeRest.y, k);
      f.bike.roll = roll(t);
      f.bike.pitch = fallPitch(t);
      f.bike.grounded = false;
    }
    if (t >= tStall - 0.2) f.rider.face = 'scared';
    if (t >= tFall) {
      const h = hipOf(-0.1, BIKE_Y, 0);
      const k = prog(t, tFall, tFall + 0.3, 'o');
      setFree(
        f,
        lerp(h.x, sitSpot.x, k),
        lerp(h.y, sitSpot.y, k),
        0,
        'sit',
        t > 1.9 ? 'dizzy' : 'scared',
      );
    }
  };
  return {
    duration,
    word: 'WHOOPS!',
    beats: { stall: tStall, off: tOff, fall: tFall },
    at,
    events: () => [
      [tStall, 'word', 4.4, 2.2],
      [tStall, 'groan', 4.4, 1.5],
      [0.9, 'sweat', 3.5, 1.5],
      [tOff, 'sfx:bump', 1.5, 0.2],
      [tFall, 'dust', 0.4, 0.1],
      [tFall + 0.1, 'sweat', -0.2, 1.4],
    ],
  };
})();

// ----- Rollercoaster with a corkscrew -----

const HILLS = [2.4, 4.0, 2.4] as const;
/** Height of the coaster track at x: three smooth hills over 0 to 24. */
export function coasterSurface(x: number): number {
  if (x <= 0 || x >= 24) return 0;
  const k = Math.min(Math.floor(x / 8), 2);
  const u = (x - 8 * k) / 8;
  return (HILLS[k] * (1 - Math.cos(TAU * u))) / 2;
}
const CREST_XS = [4, 12, 20] as const;
const hopAt = (x: number) => {
  let h = 0;
  for (const c of CREST_XS) {
    const d = Math.abs(x - c);
    if (d < 1.2) h = Math.max(h, 0.5 * ((1 + Math.cos((Math.PI * d) / 1.2)) / 2));
  }
  return h;
};
const ROLL_FROM = 9.9;
const ROLL_TO = 14.1;
/** The barrel roll over the middle hill: a full turn, a little gentler than a smooth step. */
const rollAt = (x: number) => {
  const u = clamp01((x - ROLL_FROM) / (ROLL_TO - ROLL_FROM));
  return TAU * (0.7 * u + 0.3 * smooth(u));
};

function coasterAt(f: Frame, x: number, t: number, barrel = true): void {
  // The track flattens out at x = 24; ease the bike level so it arrives riding straight.
  ride(f, coasterSurface, x, Math.min(settleAt(t), smooth((24 - x) / 0.8)));
  const hop = hopAt(x);
  f.bike.y += hop;
  f.bike.grounded = hop < 0.08;
  const roll = barrel ? rollAt(x) : 0;
  f.bike.roll = roll;
  f.bike.z = 0.7 * Math.sin(roll);
}

const coasterClear0: Def = (() => {
  const duration = 3.0;
  const xm = track([
    [0, 0],
    [duration, 24, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    const x = xm(t);
    coasterAt(f, x, t);
    if ((x > 4.6 && x < 7.8) || (x > 14.4 && x < 18)) f.rider.pose = 'armsUp';
  };
  return {
    duration,
    word: 'WHEEEE!',
    beats: { roll: duration * (ROLL_FROM / 24), crest: duration * (12 / 24) },
    at,
    events: (bike) => [
      ...trail(0.4, 2.8, 0.18, 'spark', bike),
      [duration * (11.5 / 24), 'word', 12, 5],
      [duration * (12 / 24), 'confetti', 12, 4.5],
      [duration * 0.7, 'cheer', 18, 3],
    ],
  };
})();

const coasterClear1: Def = (() => {
  const duration = 3.2;
  const xm = track([
    [0, 0],
    [duration, 24, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    const x = xm(t);
    coasterAt(f, x, t);
    if (x > 8.5 && x < 15.5) f.rider.pose = 'surf';
  };
  return {
    duration,
    word: 'RAD!',
    beats: { roll: duration * (ROLL_FROM / 24), crest: duration * (12 / 24) },
    at,
    events: (bike) => [
      ...trail(0.4, 3.0, 0.2, 'spark', bike),
      [duration * (11.5 / 24), 'word', 12, 5],
      [duration * 0.7, 'cheer', 18, 3],
    ],
  };
})();

const coasterCrash0: Def = (() => {
  const duration = 3.6;
  const tCrest = 1.3;
  const tLand = 2.3;
  const standX = 20.4;
  const xm = track([
    [0, 0],
    [tCrest, 12, 'l'],
  ]);
  const crest = (() => {
    const f = createFrame();
    coasterAt(f, 12, 1, false);
    return { x: f.bike.x, y: f.bike.y };
  })();
  const land = { x: standX, y: 1.5 };
  const pitch = track([
    [tCrest, 0],
    [1.7, 0.25, 'o'],
    [tLand, -0.9, 'i'],
    [tLand + 0.25, -1.1, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tCrest) {
      coasterAt(f, xm(t), t, false);
    } else if (t < tLand) {
      const u = (t - tCrest) / (tLand - tCrest);
      f.bike.x = lerp(crest.x, land.x, u);
      f.bike.y = arc(crest.y, land.y, 6.5, u);
      f.bike.pitch = pitch(t);
      f.bike.grounded = false;
    } else {
      f.bike.x = land.x + 0.2 * prog(t, tLand, tLand + 0.25, 'o');
      f.bike.y = land.y - 0.2 * prog(t, tLand, tLand + 0.25, 'o');
      f.bike.pitch = pitch(t);
      f.bike.grounded = false;
    }
    if (t >= tCrest - 0.1) f.rider.face = 'scared';
    if (t >= tCrest && t < tLand) f.rider.pose = 'flail';
    if (t >= tLand) {
      const k = prog(t, tLand, tLand + 0.3, 'o');
      const h = hipOf(land.x, land.y, -0.9);
      setFree(
        f,
        lerp(h.x, standX - 0.3, k),
        lerp(h.y, 1.3, k),
        0,
        'sit',
        t > 2.6 ? 'dizzy' : 'scared',
      );
    }
  };
  return {
    duration,
    word: 'WHEEE-OOPS!',
    beats: { derail: tCrest, land: tLand, stand: tLand },
    at,
    events: (bike) => [
      [tCrest, 'word', 12, 5],
      [tCrest, 'groan', 12, 4],
      [tCrest, 'sfx:whoosh', 13, 4.5],
      ...trail(1.4, 2.2, 0.2, 'sweat', bike),
      [tLand, 'sfx:splat', standX, 1.8],
      [tLand, 'poof', standX, 2, 0xff9fcf],
      [tLand + 0.05, 'poof', standX - 0.6, 2.3, 0xffc4e1],
      [tLand + 0.1, 'poof', standX + 0.6, 2.2, 0xff7fbf],
      [tLand + 0.35, 'poof', standX - 0.4, 2.6, 0xffc4e1],
      [2.7, 'stars', standX - 0.3, 2.9],
    ],
  };
})();

const coasterCrash1: Def = (() => {
  const duration = 3.6;
  const tOff = 1.5;
  // Without its rider the bike is lighter and bolts along the rest of the track.
  const xm = track([
    [0, 0],
    [tOff, 12, 'l'],
    [2.3, 24, 'l'],
    [2.5, 25.2, 'o'],
  ]);
  const roll = track([
    [tOff, Math.PI],
    [2.0, TAU],
  ]);
  const duckX = 15.6;
  const duckTop = 2.55;
  const offX = 12;
  const hip0 = (() => {
    const f = createFrame();
    coasterAt(f, offX, 1);
    f.bike.roll = Math.PI;
    const h = hipOf(f.bike.x, f.bike.y, f.bike.pitch, Math.PI);
    return { x: h.x, y: h.y };
  })();
  const c1 = 1.85;
  const c2 = 2.25;
  const c3 = 2.55;
  const riderX = track([
    [tOff, hip0.x],
    [c1, duckX - 0.2, 'o'],
    [c3, duckX - 0.3],
  ]);
  const riderY = track([
    [tOff, hip0.y],
    [c1, duckTop + 0.2, 'i'],
    [1.99, duckTop + 1.5, 'o'],
    [c2, duckTop + 0.2, 'i'],
    [2.4, duckTop + 0.8, 'o'],
    [c3, duckTop + 0.2, 'i'],
  ]);
  const riderRot = track([
    [tOff, 0],
    [c1, -TAU * 0.75, 'l'],
    [c3, -TAU, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    const x = xm(t);
    coasterAt(f, x, t);
    if (t >= tOff) {
      f.bike.roll = roll(t);
      f.bike.z = 0.7 * Math.sin(f.bike.roll);
    }
    if (t > 2.3) {
      // Past the end of the track the bike wobbles on, then tips over.
      const k = prog(t, 2.3, 2.55, 'i');
      f.bike.roll = TAU + (Math.PI / 2) * k;
      f.bike.y = lerp(BIKE_Y, 0.34, k);
      f.bike.grounded = false;
    }
    if (t >= tOff - 0.2) f.rider.face = 'scared';
    if (t >= tOff) {
      const sitting = t >= c3;
      setFree(
        f,
        riderX(t),
        riderY(t),
        riderRot(t),
        sitting ? 'sit' : 'flail',
        sitting ? 'dizzy' : 'scared',
      );
    }
  };
  return {
    duration,
    word: 'SPLAT-OOPS!',
    beats: { fall: tOff, c1, c2, c3 },
    at,
    events: () => [
      [tOff, 'word', offX, 5],
      [tOff, 'groan', offX, 4],
      [tOff, 'sfx:whoosh', offX, 4],
      [c1, 'sfx:boing', duckX, duckTop],
      [c2, 'sfx:boing', duckX, duckTop],
      [c3, 'sfx:honk', duckX, duckTop],
      [c1, 'poof', duckX, duckTop],
      [2.3, 'dust', 25.4, 0.2],
      [2.7, 'stars', duckX - 0.3, duckTop + 1.9],
    ],
  };
})();

// ---------- The table and the public API ----------

const TABLE: Table = {
  loop: { clear: [loopClear0, loopClear1], crash: [loopCrash0, loopCrash1] },
  ramp: { clear: [rampClear0, rampClear1], crash: [rampCrash0, rampCrash1] },
  ring: { clear: [ringClear0, ringClear1], crash: [ringCrash0, ringCrash1] },
  crates: { clear: [cratesClear0, cratesClear1], crash: [cratesCrash0, cratesCrash1] },
  bridge: { clear: [bridgeClear0, bridgeClear1], crash: [bridgeCrash0, bridgeCrash1] },
  seesaw: { clear: [seesawClear0, seesawClear1], crash: [seesawCrash0, seesawCrash1] },
  coaster: { clear: [coasterClear0, coasterClear1], crash: [coasterCrash0, coasterCrash1] },
};

const def = (kind: ObstacleKind, outcome: Outcome, variant: Variant): Def =>
  TABLE[kind][outcome][variant];

export function stuntDuration(kind: ObstacleKind, outcome: Outcome, variant: Variant): number {
  return def(kind, outcome, variant).duration;
}

/** The comic word shown on screen for this stunt, e.g. 'SPLAT!'. */
export function stuntWord(kind: ObstacleKind, outcome: Outcome, variant: Variant): string {
  return def(kind, outcome, variant).word;
}

/** Named moments (seconds into the stunt) that the props follow, such as the impact. */
export function stuntBeats(
  kind: ObstacleKind,
  outcome: Outcome,
  variant: Variant,
): Readonly<Record<string, number>> {
  return def(kind, outcome, variant).beats;
}

const eventCache = new Map<Def, StuntEvent[]>();
const probeFrame = createFrame();

/** The effects to fire during the stunt, sorted by time. */
export function stuntEvents(kind: ObstacleKind, outcome: Outcome, variant: Variant): StuntEvent[] {
  const d = def(kind, outcome, variant);
  let events = eventCache.get(d);
  if (!events) {
    const sample = (t: number, rider: boolean): Pos => {
      const f = resetFrame(probeFrame);
      stuntFrame(kind, outcome, variant, t, f);
      return rider && f.rider.mode === 'free'
        ? { x: f.rider.x, y: f.rider.y }
        : { x: f.bike.x, y: f.bike.y };
    };
    const list = d.events(
      (t) => sample(t, false),
      (t) => sample(t, true),
    );
    events = list
      .map(([at, type, x, y, color]) => {
        const e: StuntEvent = { at: Math.min(Math.max(at, 0), d.duration), type, x, y };
        if (color !== undefined) e.color = color;
        return e;
      })
      .sort((a, b) => a.at - b.at);
    eventCache.set(d, events);
  }
  return events;
}

/**
 * The bike and rider at time `t` of a stunt (clamped to its duration), into `out` when given.
 * A cleared stunt ends exactly at the obstacle's `length`, on the road, riding.
 */
export function stuntFrame(
  kind: ObstacleKind,
  outcome: Outcome,
  variant: Variant,
  t: number,
  out: Frame = createFrame(),
): Frame {
  const d = def(kind, outcome, variant);
  const time = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), d.duration);
  resetFrame(out);
  d.at(time, out);
  if (outcome === 'clear' && time >= d.duration) {
    // Landed and riding on: normalise away any rounding so the next stretch starts clean.
    const b = out.bike;
    b.x = SPECS[kind].length;
    b.y = BIKE_Y;
    b.pitch = TAU * Math.round(b.pitch / TAU);
    b.roll = TAU * Math.round(b.roll / TAU);
    b.z = 0;
    b.squash = 1;
    b.visible = b.grounded = true;
    resetRider(out);
  }
  return out;
}

function resetRider(f: Frame): void {
  const r = f.rider;
  r.mode = 'seated';
  r.x = r.y = r.rot = 0;
  r.pose = 'ride';
  r.face = 'happy';
  r.visible = true;
}
