/**
 * The 40 stunts as authored animations: keyframe tracks in obstacle-local coordinates (x = 0 at
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
  | 'thumbs'
  | 'superman';
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
  halfpipe: { kind: 'halfpipe', length: 18, floorY: 0, height: 5.6 },
  penguins: { kind: 'penguins', length: 16, floorY: 0, height: 3.0 },
  wrecker: { kind: 'wrecker', length: 18, floorY: 0, height: 5.5 },
};

// ---------- Keyframes and easing ----------

export type Ease = 'l' | 'i' | 'o' | 'q' | 'io';

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Linear, accelerating, braking (cubic), braking (quadratic) and smooth in and out. */
export const EASE: Record<Ease, (u: number) => number> = {
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

export function resetFrame(f: Frame): Frame {
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

export type Surface = (x: number) => number;

/** Both wheels on a surface: the bike lies along the chord between them. `settle` eases in. */
export function ride(f: Frame, surf: Surface, x: number, settle = 1): void {
  const a = surf(x - REAR);
  const b = surf(x + REAR);
  const pitch = Math.atan2(b - a, 2 * REAR) * settle;
  f.bike.pitch = pitch;
  f.bike.x = x - WHEEL_R * Math.sin(pitch);
  f.bike.y = lerp(BIKE_Y, (a + b) / 2 + WHEEL_R * Math.cos(pitch), settle);
}

/** Only the rear wheel on the surface, at `rx`, with the nose `w` radians above the slope. */
export function rearRide(f: Frame, surf: Surface, rx: number, w: number): void {
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
export function rideW(f: Frame, surf: Surface, x: number, w: number): void {
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
export function hipOf(bx: number, by: number, pitch: number, roll = 0): typeof seat {
  const up = SEAT.y * Math.cos(roll);
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  seat.x = bx + SEAT.x * c - up * s;
  seat.y = by + SEAT.x * s + up * c;
  return seat;
}

export function setFree(
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

export const smooth = (u: number) => EASE.io(clamp01(u));
export const settleAt = (t: number) => smooth(t / 0.2);

// ---------- Stunt definitions ----------

export type Ev = readonly [at: number, type: StuntEventType, x: number, y: number, color?: number];

export interface Pos {
  x: number;
  y: number;
}

export interface Def {
  duration: number;
  word: string;
  /** Named moments (seconds) that the props follow. */
  beats: Record<string, number>;
  /** Local times (s) at which playback slows right down (Mega slow motion), if any. */
  slow?: readonly number[];
  at(t: number, f: Frame): void;
  /** The events, given samplers for where the bike and the rider are at a time. */
  events(bike: (t: number) => Pos, rider: (t: number) => Pos): Ev[];
}

type Pair<T> = readonly [T, T];
type Table = Record<ObstacleKind, Record<Outcome, Pair<Def>>>;

/** Events along a stretch of time, at the bike (or rider) position. */
export function trail(
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

// ----- Shared by the three newest stunts -----

const flatRoad: Surface = () => 0;

/** A walk along a surface by distance, so a ride keeps its speed up and down the curved walls. */
interface Walk {
  length: number;
  xAt(s: number): number;
  sAt(x: number): number;
}

function walkAlong(surf: Surface, x0: number, x1: number, n = 320): Walk {
  const xs: number[] = [];
  const ss: number[] = [];
  let total = 0;
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    if (i > 0) total += Math.hypot(x - xs[i - 1], surf(x) - surf(xs[i - 1]));
    xs.push(x);
    ss.push(total);
  }
  const find = (list: number[], v: number): number => {
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (list[mid] <= v) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  return {
    length: total,
    xAt(s) {
      if (s <= 0) return x0;
      if (s >= total) return x1;
      const i = find(ss, s);
      return lerp(xs[i], xs[i + 1], (s - ss[i]) / (ss[i + 1] - ss[i] || 1));
    },
    sAt(x) {
      if (x <= x0) return 0;
      if (x >= x1) return total;
      const i = find(xs, x);
      return lerp(ss[i], ss[i + 1], (x - xs[i]) / (xs[i + 1] - xs[i] || 1));
    },
  };
}

/** The bike's frame origin when its front wheel stands on the road at `fx`, nose pitched `p`. */
const onFrontWheel = (f: Frame, fx: number, p: number): void => {
  f.bike.x = fx - REAR * Math.cos(p);
  f.bike.y = WHEEL_R - REAR * Math.sin(p);
  f.bike.pitch = p;
};

// ----- Skate half-pipe -----

export const HP_R = 3.2;
/** The walls are a circle of radius HP_R, ridden up to this angle from the bottom (66 degrees). */
const HP_THETA = 1.15;
export const HP_WX = HP_R * Math.sin(HP_THETA);
export const HP_WH = HP_R * (1 - Math.cos(HP_THETA));
export const HP_KICK_LEN = 2.4;
const HP_KICK_H = 0.8;
/** The left lip deck (where the bike drops in from) and the right one (where it takes off). */
export const HP_DECK_L0 = 3.2;
export const HP_DECK_L1 = 4.7;
export const HP_CXL = HP_DECK_L1 + HP_WX;
export const HP_CXR = HP_CXL + 6;
export const HP_LIP = HP_CXR + HP_WX;
export const HP_DECK_R1 = HP_LIP + 0.3;
const hpWall = (dx: number) => HP_R - Math.sqrt(Math.max(HP_R * HP_R - dx * dx, 0));

/** The kicker, the left deck, the U (floor at road level) and the right deck. */
export function halfpipeSurface(x: number): number {
  if (x <= 0) return 0;
  if (x <= HP_KICK_LEN) return kicker(x, HP_KICK_H, HP_KICK_LEN);
  if (x < HP_DECK_L0) return 0;
  if (x <= HP_DECK_L1) return HP_WH;
  if (x < HP_CXL) return hpWall(HP_CXL - x);
  if (x <= HP_CXR) return 0;
  if (x < HP_LIP) return hpWall(x - HP_CXR);
  if (x <= HP_DECK_R1) return HP_WH;
  return 0;
}

const HP_X0 = HP_KICK_LEN - REAR;
const HP_T_KICK = 0.18;
const HP_T_HOP = 0.5;
const HP_LAND = { x: 4.0, y: HP_WH + BIKE_Y };
const HP_X_END = HP_LIP - REAR;
const hpLaunch = (() => {
  const f = createFrame();
  ride(f, halfpipeSurface, HP_X0);
  return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
})();
const hpTake = (() => {
  const f = createFrame();
  ride(f, halfpipeSurface, HP_X_END);
  return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
})();
const hpPipe = walkAlong(halfpipeSurface, HP_LAND.x, HP_X_END);
const HP_END_X = 17.7;

/** The run-up: along the kicker, then a hop onto the left deck. True while it placed the bike. */
function hpIntro(t: number, f: Frame): boolean {
  if (t < HP_T_KICK) {
    ride(f, halfpipeSurface, lerp(0, HP_X0, t / HP_T_KICK), settleAt(t));
    return true;
  }
  if (t < HP_T_HOP) {
    const u = (t - HP_T_KICK) / (HP_T_HOP - HP_T_KICK);
    f.bike.x = lerp(hpLaunch.x, HP_LAND.x, u);
    f.bike.y = arc(hpLaunch.y, HP_LAND.y, 3.4, u);
    f.bike.pitch = lerp(hpLaunch.pitch, 0, EASE.io(u));
    f.bike.grounded = false;
    return true;
  }
  return false;
}

/** A small squash as the bike drops onto the deck. */
const hpDropSquash = track([
  [HP_T_HOP, 1],
  [HP_T_HOP + 0.06, 0.88],
  [HP_T_HOP + 0.3, 1, 'o'],
]);

/** A clear: the whole run, the air off the right lip (a spin or a back flip) and the landing. */
function halfpipeClear(variant: Variant): Def {
  // The flip is a slower, higher show than the spin.
  const tTake = variant === 0 ? 1.9 : 2.1;
  const tLand = tTake + (variant === 0 ? 0.95 : 1.05);
  const duration = tLand + 0.35;
  const peak = variant === 0 ? 5.2 : 5.4;
  const s = track([
    [HP_T_HOP, 0],
    [tTake, hpPipe.length, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    if (hpIntro(t, f)) return;
    if (t < tTake) {
      ride(f, halfpipeSurface, hpPipe.xAt(s(t)));
      f.bike.squash = hpDropSquash(t);
    } else if (t < tLand) {
      const u = (t - tTake) / (tLand - tTake);
      f.bike.x = lerp(hpTake.x, HP_END_X, u);
      f.bike.y = arc(hpTake.y, BIKE_Y, peak, u);
      f.bike.grounded = false;
      if (variant === 0) {
        // A 360 corkscrew with the arms up.
        f.bike.pitch = lerp(hpTake.pitch, 0, EASE.io(u));
        f.bike.roll = TAU * EASE.io(u);
      } else {
        // A no-handed back flip.
        f.bike.pitch = lerp(hpTake.pitch, TAU, EASE.io(u));
      }
    } else {
      f.bike.x = lerp(HP_END_X, 18, prog(t, tLand, duration, 'l'));
      f.bike.pitch = variant === 0 ? 0 : TAU;
      f.bike.roll = variant === 0 ? TAU : 0;
      const k = t - tLand;
      f.bike.squash =
        k < 0.08
          ? lerp(1, 0.86, k / 0.08)
          : lerp(0.86, 1, prog(t, tLand + 0.08, duration - 0.1, 'o'));
    }
    if (t > tTake + 0.1 && t < tLand) f.rider.pose = variant === 0 ? 'armsUp' : 'thumbs';
    else if (t > 1.2 && t < 1.55) f.rider.pose = variant === 0 ? 'wave' : 'duck';
  };
  const tPeak = tTake + (tLand - tTake) * 0.5;
  return {
    duration,
    word: variant === 0 ? 'AIR TIME!' : 'NO HANDS!',
    beats: { drop: HP_T_HOP, take: tTake, land: tLand },
    at,
    events: (bike) => [
      [HP_T_HOP, 'dust', HP_LAND.x, HP_WH],
      [HP_T_HOP + 0.1, 'sfx:whoosh', 5.5, 2],
      ...trail(0.9, tTake - 0.1, 0.2, 'spark', bike, -0.3),
      [tTake, 'sfx:boing', HP_LIP, HP_WH],
      [tPeak, 'word', hpTake.x + 0.6, peak + 0.5],
      [tLand, 'dust', HP_END_X, 0.1],
      [tLand, variant === 0 ? 'spark' : 'confetti', HP_END_X, 1.2],
      [tLand + 0.12, 'cheer', HP_END_X + 0.5, 2],
    ],
  };
}

const halfpipeClear0: Def = halfpipeClear(0);
const halfpipeClear1: Def = halfpipeClear(1);

/** Too slow: stalls near the top of the right wall and slides back down backwards. */
const halfpipeCrash0: Def = (() => {
  const duration = 3.9;
  const sStall = hpPipe.length - 1.2;
  const sMid = sStall - 1.4;
  const tClimb = 1.35;
  const tStall = 1.75;
  const tHang = 1.85;
  const tFloor = 2.5;
  const tLap = 2.8;
  const sFloor = hpPipe.sAt(11.0);
  const s = track([
    [HP_T_HOP, 0],
    [tClimb, sMid, 'l'],
    [tStall, sStall, 'o'],
    [tHang, sStall],
    [tFloor, sFloor, 'io'],
  ]);
  const floorBike = (() => {
    const f = createFrame();
    ride(f, halfpipeSurface, 11.0);
    return { x: f.bike.x, y: f.bike.y };
  })();
  const hipsAt = hipOf(floorBike.x, floorBike.y, 0);
  const hips = { x: hipsAt.x, y: hipsAt.y };
  const lap = { x: 10.75, y: 0.85, pitch: 0.25 };
  const sit = { x: 10.2, y: 0.2 };
  const at = (t: number, f: Frame) => {
    if (hpIntro(t, f)) return;
    const k = prog(t, tFloor, tLap, 'o');
    ride(f, halfpipeSurface, hpPipe.xAt(s(t)));
    f.bike.squash = hpDropSquash(t);
    if (t >= tStall && t < tHang) {
      f.bike.grounded = false;
      f.bike.pitch += 0.05 * Math.sin((t - tStall) * 40);
    } else if (t >= tHang && t < tFloor) {
      f.bike.grounded = false;
    }
    if (t >= tFloor) {
      f.bike.x = lerp(floorBike.x, lap.x, k);
      f.bike.y = lerp(floorBike.y, lap.y, k);
      f.bike.pitch = lerp(0, lap.pitch, k);
      f.bike.squash = lerp(1, 0.75, k);
      f.bike.grounded = false;
      setFree(
        f,
        lerp(hips.x, sit.x, k),
        lerp(hips.y, sit.y, k),
        0,
        'sit',
        t > tLap ? 'dizzy' : 'scared',
      );
    } else if (t >= tStall - 0.25) {
      f.rider.face = 'scared';
    }
  };
  const stallX = hpPipe.xAt(sStall);
  return {
    duration,
    word: 'STALLED!',
    beats: { stall: tStall, floor: tFloor },
    at,
    events: (bike) => [
      [HP_T_HOP, 'dust', HP_LAND.x, HP_WH],
      [tClimb - 0.2, 'sweat', stallX - 0.8, 3],
      [tStall, 'groan', stallX, 2.4],
      [tStall + 0.05, 'word', stallX, 3.6],
      [tStall + 0.05, 'sfx:fizz', stallX, 2.2],
      ...trail(tHang + 0.1, tFloor - 0.1, 0.2, 'dust', bike, -0.3),
      [tFloor, 'sfx:bump', floorBike.x, 0.3],
      [tFloor, 'dust', floorBike.x, 0.1],
      [tLap + 0.1, 'stars', sit.x, 1.7],
    ],
  };
})();

/** Far too fast: over the lip, the rider lands on his head and the bike spins on its front wheel. */
const halfpipeCrash1: Def = (() => {
  const duration = 4.0;
  const tTake = 1.65;
  const tLand = 2.3;
  const tSpin = 2.7;
  const tTip = 3.0;
  const s = track([
    [HP_T_HOP, 0],
    [tTake, hpPipe.length, 'l'],
  ]);
  const frontX = 19.0;
  const pitchLand = -1.35;
  const landBike = (() => {
    const f = createFrame();
    onFrontWheel(f, frontX, pitchLand);
    return { x: f.bike.x, y: f.bike.y };
  })();
  const restBike = { x: 19.7, y: 0.34 };
  const hip0 = (() => {
    const h = hipOf(hpTake.x, hpTake.y, hpTake.pitch);
    return { x: h.x, y: h.y };
  })();
  const riderLand = { x: 17.3, y: 0.4 };
  const sit = { x: 17.5, y: 0.2 };
  const at = (t: number, f: Frame) => {
    if (hpIntro(t, f)) return;
    if (t < tTake) {
      ride(f, halfpipeSurface, hpPipe.xAt(s(t)));
      f.bike.squash = hpDropSquash(t);
    } else if (t < tLand) {
      const u = (t - tTake) / (tLand - tTake);
      f.bike.x = lerp(hpTake.x, landBike.x, u);
      f.bike.y = arc(hpTake.y, landBike.y, 6.0, u);
      f.bike.pitch = lerp(hpTake.pitch, pitchLand, EASE.io(u));
      f.bike.grounded = false;
    } else if (t < tSpin) {
      // Spinning like a top on the front wheel.
      onFrontWheel(f, frontX, pitchLand);
      f.bike.roll = TAU * prog(t, tLand, tSpin, 'l');
      f.bike.grounded = false;
    } else {
      const k = prog(t, tSpin, tTip, 'io');
      onFrontWheel(f, frontX, lerp(pitchLand, 0, k));
      f.bike.x = lerp(f.bike.x, restBike.x, k);
      f.bike.y = lerp(f.bike.y, restBike.y, k * k);
      f.bike.roll = TAU + 1.5 * k;
      f.bike.grounded = false;
      f.bike.squash = 1 - 0.1 * prog(t, tTip - 0.1, tTip, 'o');
    }
    if (t >= tTake - 0.1) f.rider.face = 'scared';
    if (t >= tTake && t < tLand) {
      const u = (t - tTake) / (tLand - tTake);
      setFree(
        f,
        lerp(hip0.x, riderLand.x, u),
        arc(hip0.y, riderLand.y, 5.2, u),
        lerp(hpTake.pitch, -Math.PI, EASE.io(u)),
        'flail',
        'scared',
      );
    } else if (t >= tLand) {
      // Lands on his head, then topples over to sit up dizzy.
      const k = prog(t, tLand + 0.15, tLand + 0.5, 'io');
      setFree(
        f,
        lerp(riderLand.x, sit.x, k),
        lerp(riderLand.y, sit.y, k),
        lerp(-Math.PI, -TAU, k),
        k > 0.7 ? 'sit' : 'flail',
        'dizzy',
      );
    }
  };
  return {
    duration,
    word: 'OVERCOOKED!',
    beats: { take: tTake, land: tLand, spin: tLand },
    at,
    events: (bike) => [
      [HP_T_HOP, 'dust', HP_LAND.x, HP_WH],
      ...trail(1.1, tTake - 0.05, 0.15, 'spark', bike, -0.3),
      [tTake, 'sfx:slideWhistle', HP_LIP, HP_WH + 0.5],
      [tLand, 'groan', riderLand.x, 0.6],
      [tLand, 'word', riderLand.x, 2.0],
      [tLand, 'sfx:bump', riderLand.x, 0.2],
      [tLand, 'dust', frontX, 0.1],
      [tLand, 'dust', riderLand.x, 0.1],
      [tTip, 'sfx:crash', restBike.x, 0.3],
      [tTip, 'dust', restBike.x, 0.1],
      [tLand + 0.6, 'stars', sit.x, 1.8],
      ...trail(tSpin - 0.3, tSpin, 0.15, 'spark', () => ({ x: frontX, y: 0.5 })),
    ],
  };
})();

// ----- Penguin pond -----

export const PG_ICE_FROM = 2;
export const PG_ICE_TO = 15.2;
export const PG_HOOP_X = 8;
/** The penguins stand behind the bike's lane, so the bike passes in front of them. */
export const PG_LANE_Z = -1.4;
export const PENGUIN_COUNT = 7;
/** Two flank the hoop; five stand in a row at the far end for the bike to bowl through. */
export const PENGUIN_HOME: readonly number[] = [6.7, 9.3, 10.9, 11.8, 12.7, 13.6, 14.5];
const PG_X0 = 2.4;
const PG_ENTER = 0.26;

/** How squashed a bike looks while it turns about the vertical, for a yaw (radians). */
const yawSquash = (yaw: number) => 0.45 + 0.55 * Math.abs(Math.cos(yaw));

const penguinPiece = (out: Piece, i: number): Piece => {
  out.x = PENGUIN_HOME[i];
  out.y = 0;
  out.rot = 0;
  out.scale = 1;
  out.visible = true;
  return out;
};

/** Penguins clapping: little hops, each out of step with the next, once the bike has passed. */
const clap = (out: Piece, i: number, t: number, from: number): Piece => {
  if (t > from) out.y = 0.16 * Math.abs(Math.sin((t - from) * 9 + i * 1.7));
  return out;
};

const penguinsClear0: Def = (() => {
  const duration = 2.6;
  const tSlide0 = PG_ENTER;
  const tSlide1 = 1.85;
  const tOut = 2.4;
  const x = track([
    [0, 0],
    [tSlide0, PG_X0, 'l'],
    [tSlide1, 13.6, 'l'],
    [tOut, 16, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    const u = prog(t, tSlide0, tSlide1, 'l');
    const yaw = TAU * prog(t, tSlide0, tSlide1, 'io');
    ride(f, flatRoad, x(t));
    f.bike.z = 0.8 * Math.sin(TAU * u);
    f.bike.roll = 0.25 * Math.sin(TAU * 1.5 * u);
    f.bike.squash = t > tSlide0 && t < tSlide1 ? yawSquash(yaw) : 1;
    if (t > tSlide0 && t < tSlide1) {
      f.rider.pose = 'balance';
      f.bike.grounded = false;
    }
  };
  return {
    duration,
    word: 'ICE ICE BABY!',
    beats: { slide: tSlide0, out: tSlide1 },
    at,
    events: (bike) => [
      [tSlide0, 'sfx:whoosh', PG_X0, 0.5],
      ...trail(tSlide0 + 0.1, tSlide1, 0.15, 'spark', bike, -0.2),
      [1.0, 'word', 8, 3],
      [tSlide1, 'dust', 13.6, 0.1],
      [tOut - 0.1, 'cheer', 15, 2],
    ],
  };
})();

const PG_END_1 = 2.3;
const pgX1 = track([
  [0, 0],
  [PG_ENTER, PG_X0, 'l'],
  [PG_END_1, 16, 'l'],
]);
const pgW1 = track([
  [0, 0],
  [0.45, 0.5],
  [1.95, 0.5, 'l'],
  [PG_END_1, 0],
]);
/** The wheelie across the ice. */
function pgWheelie(t: number, f: Frame): void {
  if (t < PG_ENTER) ride(f, flatRoad, pgX1(t));
  else rideW(f, flatRoad, pgX1(t), pgW1(t));
  f.bike.grounded = pgW1(t) < 0.05;
  if (pgW1(t) > 0.2) f.rider.pose = 'wheelie';
}

const pgScratch = createFrame();
/** Where a penguin sits on the back of the wheelie at a moment. */
function penguinRack(t: number, out: { x: number; y: number }): void {
  const f = resetFrame(pgScratch);
  pgWheelie(t, f);
  const c = Math.cos(f.bike.pitch);
  const s = Math.sin(f.bike.pitch);
  out.x = f.bike.x - 0.75 * c - 0.45 * s;
  out.y = f.bike.y - 0.75 * s + 0.45 * c;
}

/** When the first penguin hops on the back of the wheelie (as the bike passes it) and off again. */
const PG_RIDE = (() => {
  const p = { x: 0, y: 0 };
  let on = 0.7;
  for (let t = 0.5; t < 2; t += 0.005) {
    penguinRack(t, p);
    if (p.x >= PENGUIN_HOME[0]) {
      on = t;
      break;
    }
  }
  return { on, off: 1.95, hop: 0.3, land: 0.35 };
})();

const penguinsClear1: Def = (() => {
  const duration = 2.9;
  return {
    duration,
    word: 'PENGUIN POWER!',
    beats: { on: PG_RIDE.on, off: PG_RIDE.off },
    at: pgWheelie,
    events: (bike) => [
      [0.5, 'sfx:whoosh', PG_X0, 0.5],
      [PG_RIDE.on, 'poof', PENGUIN_HOME[0], 0.8],
      [PG_RIDE.on, 'sfx:boing', PENGUIN_HOME[0], 0.8],
      [PG_RIDE.on + 0.1, 'word', PENGUIN_HOME[0], 3],
      ...trail(1.0, PG_RIDE.off, 0.2, 'spark', bike, -0.2),
      [PG_RIDE.off, 'sfx:boing', 12, 0.8],
      [PG_END_1 + 0.1, 'cheer', 16, 2],
    ],
  };
})();

const penguinsCrash0: Def = (() => {
  const duration = 3.6;
  const tStrike = 1.45;
  const tFly = 2.25;
  const x = track([
    [0, 0],
    [PG_ENTER, PG_X0, 'l'],
    [tStrike, 10.7, 'l'],
    [2.1, 12.3, 'o'],
  ]);
  const zLane = track([
    [0.5, 0],
    [1.4, PG_LANE_Z * 0.9, 'io'],
  ]);
  const hip = (() => {
    const h = hipOf(10.7, BIKE_Y, 0);
    return { x: h.x, y: h.y };
  })();
  const sit = { x: 14.9, y: 0.2 };
  const at = (t: number, f: Frame) => {
    ride(f, flatRoad, x(t));
    const yaw = TAU * 2 * prog(t, PG_ENTER, tStrike, 'l');
    f.bike.z = zLane(t);
    if (t < tStrike) {
      f.bike.squash = t > PG_ENTER ? yawSquash(yaw) : 1;
      f.bike.grounded = t < PG_ENTER;
      if (t > tStrike - 0.5) f.rider.face = 'scared';
    } else {
      f.bike.squash = lerp(0.8, 1, prog(t, tStrike, 1.9, 'o'));
      const k = prog(t, 1.7, 2.1, 'io');
      f.bike.roll = 1.4 * k;
      f.bike.y = lerp(BIKE_Y, 0.34, k);
      f.bike.grounded = false;
      const u = prog(t, tStrike, tFly, 'l');
      if (t < tFly)
        setFree(f, lerp(hip.x, sit.x, u), arc(hip.y, sit.y, 2.8, u), -TAU * u, 'flail', 'scared');
      else setFree(f, sit.x, sit.y, -TAU, 'sit', 'dizzy');
    }
  };
  return {
    duration,
    word: 'STRIKE!',
    beats: { strike: tStrike, fly: tFly, hat: tFly + 0.05 },
    at,
    events: (bike) => [
      [PG_ENTER, 'dust', PG_X0, 0.1],
      [PG_ENTER + 0.05, 'sfx:slideWhistle', PG_X0, 0.8],
      ...trail(PG_ENTER + 0.1, tStrike, 0.15, 'spark', bike, -0.2),
      [tStrike, 'groan', 11, 1],
      [tStrike, 'word', 11.5, 2.4],
      [tStrike, 'sfx:pins', 11.5, 0.8],
      [tStrike, 'poof', 11.8, 1],
      [tStrike + 0.1, 'poof', 13, 1],
      [tFly + 0.1, 'sfx:bump', sit.x, 0.3],
      [tFly + 0.3, 'stars', sit.x, 1.9],
    ],
  };
})();

const penguinsCrash1: Def = (() => {
  const duration = 3.6;
  const tTip = 0.4;
  const tBank = 1.95;
  const tSnow = 2.2;
  const bankX = 13.4;
  const x = track([
    [0, 0],
    [PG_ENTER, PG_X0, 'l'],
    [tBank, bankX, 'q'],
  ]);
  const hip = (() => {
    const h = hipOf(PG_X0 + 1.6, BIKE_Y, 0);
    return { x: h.x, y: h.y };
  })();
  const at = (t: number, f: Frame) => {
    const k = prog(t, tTip, tTip + 0.3, 'io');
    ride(f, flatRoad, x(t));
    f.bike.roll = 1.4 * k;
    f.bike.y = lerp(BIKE_Y, 0.34, k);
    f.bike.grounded = t < tTip;
    if (t >= tTip - 0.1) f.rider.face = 'scared';
    if (t >= tTip) {
      // Face down beside the bike, sliding on into the bank.
      const bx = x(t);
      const j = prog(t, tTip, tTip + 0.6, 'o');
      setFree(
        f,
        lerp(hip.x, bx + 1.2, j) + (t > tBank ? Math.min(1, (t - tBank) * 3) * 0.3 : 0),
        lerp(hip.y, 0.32, j),
        lerp(0, -Math.PI / 2, j),
        j > 0.5 ? 'splat' : 'flail',
        'scared',
      );
    }
  };
  return {
    duration,
    word: 'BRRR!',
    beats: { tip: tTip, bank: tBank, snow: tSnow },
    at,
    events: (bike) => [
      [tTip, 'groan', PG_X0 + 1.6, 0.6],
      [tTip, 'word', 5, 2.4],
      [tTip, 'sfx:slideWhistle', PG_X0 + 1.5, 0.8],
      ...trail(tTip + 0.1, tBank - 0.2, 0.15, 'dust', bike, -0.1),
      [tBank, 'sfx:bump', bankX + 1.2, 0.5],
      [tBank, 'poof', bankX + 1.5, 1],
      [tSnow + 0.2, 'sfx:splat', bankX + 1.3, 1.4],
      [tSnow + 0.2, 'poof', bankX + 1.3, 1.6],
      [tSnow + 0.5, 'stars', bankX + 1.3, 2],
    ],
  };
})();

/** One penguin at a moment of a penguin stunt: where it is, how it is turned and whether to draw it. */
export function penguinAt(
  outcome: Outcome,
  variant: Variant,
  i: number,
  t: number,
  out: Piece = { x: 0, y: 0, rot: 0, scale: 1, visible: true },
): Piece {
  penguinPiece(out, i);
  const rack = { x: 0, y: 0 };
  if (outcome === 'clear' && variant === 0) return clap(out, i, t, 1.0);
  if (outcome === 'clear' && variant === 1) {
    if (i !== 0) return clap(out, i, t, 1.2);
    const { on, off, hop, land } = PG_RIDE;
    if (t < on - hop) return out;
    if (t < on) {
      penguinRack(on, rack);
      const u = (t - (on - hop)) / hop;
      out.x = lerp(PENGUIN_HOME[0], rack.x, u);
      out.y = arc(0, rack.y, 1.4, u);
      return out;
    }
    if (t < off) {
      penguinRack(t, rack);
      out.x = rack.x;
      out.y = rack.y;
      out.rot = 0.1 * Math.sin((t - on) * 12);
      return out;
    }
    penguinRack(off, rack);
    const stand = rack.x - 1.2;
    if (t < off + land) {
      const u = (t - off) / land;
      out.x = lerp(rack.x, stand, u);
      out.y = arc(rack.y, 0, rack.y + 0.6, u);
      return out;
    }
    out.x = stand;
    return clap(out, i, t, off + land);
  }
  if (outcome === 'crash' && variant === 0) {
    const tStrike = 1.45;
    if (i < 2) return t > tStrike ? clap(out, i, t, tStrike + 0.2) : out;
    if (t < tStrike) return out;
    const dt = t - tStrike;
    const home = PENGUIN_HOME[i];
    fly(
      home,
      0,
      4 + (i - 2) * 1.1,
      5.5 + ((i * 7) % 3) * 0.8,
      0,
      (i % 2 ? 1 : -1) * (7 + i),
      0,
      dt,
      out,
      18,
    );
    if (i === 6) {
      // The last one lands on the rider's helmet.
      const tHat = 2.3;
      if (t >= tHat) {
        fly(
          home,
          0,
          4 + (i - 2) * 1.1,
          5.5 + ((i * 7) % 3) * 0.8,
          0,
          11 * -1,
          0,
          tHat - tStrike,
          out,
          18,
        );
        const k = prog(t, tHat, tHat + 0.3, 'io');
        out.x = lerp(out.x, 14.9, k);
        out.y = lerp(out.y, 1.3, k);
        out.rot = lerp(out.rot, -TAU * Math.round(out.rot / -TAU), k);
      }
    }
    return out;
  }
  // Crash 1: the penguins look on, jumping at the snow.
  return t > 2.2 ? clap(out, i, t, 2.2) : out;
}

/** How far toward the camera a penguin stands (the helmet one moves up to the rider). */
export function penguinLane(outcome: Outcome, variant: Variant, i: number, t: number): number {
  if (outcome === 'clear' && variant === 1 && i === 0) {
    const u =
      prog(t, PG_RIDE.on - PG_RIDE.hop, PG_RIDE.on, 'io') -
      prog(t, PG_RIDE.off, PG_RIDE.off + PG_RIDE.land, 'io');
    return lerp(PG_LANE_Z, 0, Math.max(0, u));
  }
  if (outcome === 'crash' && variant === 0 && i === 6)
    return lerp(PG_LANE_Z, 0, prog(t, 2.3, 2.6, 'io'));
  return PG_LANE_Z;
}

// ----- Wrecking balls -----

export const WR_PX: readonly number[] = [4.5, 9, 13.5];
/** Height of the gantry beam the chains hang from. */
export const WR_TOP = 5.5;
export const WR_L = 3.2;
export const WR_R = 0.8;
/** The balls swing a little behind the bike's lane. */
export const WR_Z = -0.6;
const WR_A = 0.55;
const WR_W = 2.6;

/** Where the centre of ball `i` is when its chain is `angle` radians from straight down. */
export function wreckerBall(i: number, angle: number, out: Pos = { x: 0, y: 0 }): Pos {
  out.x = WR_PX[i] + WR_L * Math.sin(angle);
  out.y = WR_TOP - WR_L * Math.cos(angle);
  return out;
}

interface Swing {
  amp: number;
  w: number;
  phase: number;
}
/** A swing that is at its right extreme (1), left extreme (-1) or lowest going forward (0) at `t`. */
const swingAt = (t: number, where: -1 | 0 | 1, w = WR_W, amp = WR_A): Swing => ({
  amp,
  w,
  phase: where === 0 ? -w * t : (where * Math.PI) / 2 - w * t,
});

/** The first time the bike (a function of time) is at x. */
function whenAt(x: (t: number) => number, target: number, from = 0): number {
  for (let t = from; t < 6; t += 0.002) if (x(t) >= target) return t;
  return 6;
}

// Clear 0: slow wheelie, speed up, duck under the middle ball, hop past the third.
const wrX0 = track([
  [0, 0],
  [0.45, 4.0, 'l'],
  [1.25, 7.0, 'l'],
  [1.8, 11.5, 'l'],
  [2.9, 18, 'l'],
]);
const wrW0 = track([
  [0.55, 0],
  [0.8, 0.45],
  [1.1, 0.45, 'l'],
  [1.3, 0],
]);
const WR_DUCK = [1.35, 1.7] as const;
const WR_HOP = [1.95, 2.4] as const;
function wrecker0At(t: number, f: Frame): void {
  const w = wrW0(t);
  if (w > 0) rideW(f, flatRoad, wrX0(t), w);
  else ride(f, flatRoad, wrX0(t));
  if (t >= WR_HOP[0] && t <= WR_HOP[1]) {
    const u = (t - WR_HOP[0]) / (WR_HOP[1] - WR_HOP[0]);
    f.bike.y += 1.1 * Math.sin(Math.PI * u);
    f.bike.pitch = 0.2 * Math.cos(Math.PI * u);
    f.bike.grounded = false;
  }
  if (w > 0.2) f.rider.pose = 'wheelie';
  else if (t > WR_DUCK[0] && t < WR_DUCK[1]) f.rider.pose = 'duck';
  else if (t >= 2.6) f.rider.pose = 'thumbs';
}

// Clear 1: hop on the middle ball at its back extreme, ride half a swing, hop off.
const WR_ON = 1.0;
const WR_OFF = WR_ON + Math.PI / WR_W;
const WR_JUMP = 0.65;
const wr1Swing = swingAt(WR_ON, -1);
const wr1Ball = (t: number): Pos =>
  wreckerBall(1, wr1Swing.amp * Math.sin(wr1Swing.w * t + wr1Swing.phase));
const WR_LAND_1 = 14.2;
const WR_END_1 = 2.6;
const wr1Run = track([
  [0, 0],
  [0.5, 4.5, 'l'],
  [WR_JUMP, 5.5, 'l'],
]);
function wrecker1At(t: number, f: Frame): void {
  const top = WR_R + WHEEL_R - 0.4;
  if (t < WR_JUMP) {
    ride(f, flatRoad, wr1Run(t));
  } else if (t < WR_ON) {
    const u = (t - WR_JUMP) / (WR_ON - WR_JUMP);
    const b = wr1Ball(WR_ON);
    f.bike.x = lerp(5.5, b.x, u);
    f.bike.y = arc(BIKE_Y, b.y + top, 5.2, u);
    f.bike.pitch = 0.5 * Math.sin(Math.PI * u);
    f.bike.grounded = false;
  } else if (t < WR_OFF) {
    const b = wr1Ball(t);
    f.bike.x = b.x;
    f.bike.y = b.y + top;
    f.bike.pitch = 0;
    f.rider.pose = 'balance';
  } else if (t < WR_END_1) {
    const u = (t - WR_OFF) / (WR_END_1 - WR_OFF);
    const b = wr1Ball(WR_OFF);
    f.bike.x = lerp(b.x, WR_LAND_1, u);
    f.bike.y = arc(b.y + top, BIKE_Y, 5.3, u);
    f.bike.pitch = -0.4 * Math.sin(Math.PI * u);
    f.bike.grounded = false;
  } else {
    f.bike.x = lerp(WR_LAND_1, 18, prog(t, WR_END_1, WR_END_1 + 0.7, 'l'));
    const k = t - WR_END_1;
    f.bike.squash =
      k < 0.08
        ? lerp(1, 0.88, k / 0.08)
        : lerp(0.88, 1, prog(t, WR_END_1 + 0.08, WR_END_1 + 0.5, 'o'));
    if (t > WR_END_1 + 0.2) f.rider.pose = 'armsUp';
  }
}

// Crash: ball 0 swings through the bike at its lowest point, at this moment.
const WR_HIT = 0.55;
const WR_HIT_X = 3.9;
const wrHitRide = track([
  [0, 0],
  [WR_HIT, WR_HIT_X, 'l'],
]);

const wrecker2Land = { x: 10.6, y: 0.6 };
const wrecker2Sit = { x: 9.9, y: 0.55 };
const WR_LAND_2 = 1.7;
const wrecker2Hip = (() => {
  const h = hipOf(wrecker2Land.x, wrecker2Land.y, 0);
  return { x: h.x, y: h.y };
})();
function wreckerCrash0At(t: number, f: Frame): void {
  const hipAtLand = wrecker2Hip;
  if (t < WR_HIT) {
    ride(f, flatRoad, wrHitRide(t));
  } else if (t < WR_LAND_2) {
    const u = (t - WR_HIT) / (WR_LAND_2 - WR_HIT);
    f.bike.x = lerp(WR_HIT_X, wrecker2Land.x, u);
    f.bike.y = arc(0.9, wrecker2Land.y, 5.9, u);
    f.bike.pitch = lerp(0.3, -TAU, EASE.io(u));
    f.bike.grounded = false;
  } else {
    f.bike.x = wrecker2Land.x;
    f.bike.y = wrecker2Land.y;
    f.bike.pitch = -TAU;
    f.bike.squash = lerp(1, 0.8, prog(t, WR_LAND_2, WR_LAND_2 + 0.15, 'o'));
    f.bike.grounded = false;
  }
  if (t >= WR_HIT - 0.15) f.rider.face = 'scared';
  if (t >= WR_LAND_2) {
    const k = prog(t, WR_LAND_2, WR_LAND_2 + 0.35, 'o');
    setFree(
      f,
      lerp(hipAtLand.x, wrecker2Sit.x, k),
      lerp(hipAtLand.y, wrecker2Sit.y, k),
      lerp(-TAU, -TAU - 0.0, k),
      'sit',
      t > WR_LAND_2 + 0.3 ? 'dizzy' : 'scared',
    );
  }
}

// Crash 1: the rider flies off and sticks to ball 1, which swings faster.
const WR_STICK = 1.1;
const WR_C1_W = 7;
const WR_DROP = WR_STICK + (1.5 * TAU) / WR_C1_W;
const WR_LAND_C1 = WR_DROP + 0.5;
const wrC1Swing = swingAt(WR_STICK, -1, WR_C1_W);
const wrC1Ball = (t: number): Pos =>
  wreckerBall(1, wrC1Swing.amp * Math.sin(wrC1Swing.w * t + wrC1Swing.phase));
const wrC1Bike = track([
  [0, 0],
  [WR_HIT, WR_HIT_X, 'l'],
  [1.5, 7.4, 'q'],
]);
function wreckerCrash1At(t: number, f: Frame): void {
  const tip = prog(t, 1.5, 1.8, 'io');
  ride(f, flatRoad, wrC1Bike(t));
  if (t >= WR_HIT) {
    f.bike.pitch = 0.08 * Math.sin((t - WR_HIT) * 9) * (1 - tip);
    f.bike.roll = 1.5 * tip;
    f.bike.y = lerp(BIKE_Y, 0.34, tip);
    f.bike.grounded = t < 1.5;
  }
  if (t >= WR_HIT - 0.15) f.rider.face = 'scared';
  if (t < WR_HIT) return;
  const hip = hipOf(WR_HIT_X, BIKE_Y, 0);
  if (t < WR_STICK) {
    const u = (t - WR_HIT) / (WR_STICK - WR_HIT);
    const b = wrC1Ball(WR_STICK);
    setFree(
      f,
      lerp(hip.x, b.x + 0.2, u),
      arc(hip.y, b.y - 0.1, 4.6, u),
      -TAU * u * 0.5,
      'flail',
      'scared',
    );
  } else if (t < WR_DROP) {
    const b = wrC1Ball(t);
    setFree(
      f,
      b.x + 0.2,
      b.y - 0.1,
      -TAU * 0.5 + 0.3 * Math.sin((t - WR_STICK) * WR_C1_W),
      'flail',
      'scared',
    );
  } else {
    const b = wrC1Ball(WR_DROP);
    const u = prog(t, WR_DROP, WR_LAND_C1, 'l');
    setFree(
      f,
      lerp(b.x + 0.2, b.x + 1.1, u),
      arc(b.y - 0.1, 0.2, b.y + 0.4, u),
      lerp(-TAU * 0.5, -TAU, u),
      t < WR_LAND_C1 ? 'flail' : 'sit',
      t < WR_LAND_C1 ? 'scared' : 'dizzy',
    );
  }
}

const SWINGS: Record<string, readonly Swing[]> = (() => {
  const p0 = whenAt(wrX0, WR_PX[0]);
  const p1 = whenAt(wrX0, WR_PX[1]);
  const p2 = whenAt(wrX0, WR_PX[2]);
  return {
    clear0: [swingAt(p0, 1), swingAt(p1, 0), swingAt(p2, -1)],
    clear1: [swingAt(0.5, 1), wr1Swing, swingAt(WR_OFF, 1)],
    crash0: [swingAt(WR_HIT, 0), swingAt(1.1, 1), swingAt(2.3, -1)],
    crash1: [swingAt(WR_HIT, 0), wrC1Swing, swingAt(1.0, 1)],
  };
})();

/** The angle of the chain of ball `i` (radians from straight down, positive swings forward). */
export function wreckerAngle(outcome: Outcome, variant: Variant, i: number, t: number): number {
  const s = SWINGS[`${outcome}${variant}`][i];
  return s.amp * Math.sin(s.w * t + s.phase);
}

const wreckerClear0: Def = (() => {
  const duration = 3.1;
  return {
    duration,
    word: 'NEAT MOVES!',
    beats: { duck: WR_DUCK[0], hop: WR_HOP[0] },
    at: wrecker0At,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 3, 0.5],
      [0.8, 'sfx:boing', 5.5, 0.5],
      [WR_DUCK[0] + 0.05, 'word', 9, 3.6],
      [WR_DUCK[0], 'sweat', 8.5, 1.6],
      ...trail(1.4, 1.8, 0.2, 'dust', bike, -0.3),
      [WR_HOP[0], 'sfx:whoosh', 12.5, 0.8],
      [WR_HOP[1], 'dust', 14.8, 0.1],
      [duration - 0.15, 'cheer', 17, 2],
    ],
  };
})();

const wreckerClear1: Def = (() => {
  const duration = 3.3;
  return {
    duration,
    word: 'HITCHHIKER!',
    beats: { on: WR_ON, off: WR_OFF },
    at: wrecker1At,
    events: () => [
      [0.5, 'sfx:whoosh', 4.5, 0.5],
      [WR_JUMP, 'sfx:boing', 5.5, 0.6],
      [WR_ON, 'sfx:chime', wr1Ball(WR_ON).x, wr1Ball(WR_ON).y + 1],
      [WR_ON + 0.2, 'word', 9, 5.4],
      [WR_OFF, 'sfx:boing', wr1Ball(WR_OFF).x, wr1Ball(WR_OFF).y + 1],
      [WR_END_1, 'dust', WR_LAND_1, 0.1],
      [WR_END_1 + 0.2, 'confetti', 15.5, 1.8],
      [WR_END_1 + 0.5, 'cheer', 16.5, 2],
    ],
  };
})();

const wreckerCrash0: Def = (() => {
  const duration = 3.5;
  const hitBall = wreckerBall(0, 0);
  return {
    duration,
    word: 'BASHED!',
    beats: { hit: WR_HIT, land: WR_LAND_2 },
    at: wreckerCrash0At,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [WR_HIT, 'groan', hitBall.x, 1.2],
      [WR_HIT, 'sfx:crash', hitBall.x, 1.2],
      [WR_HIT, 'debris', hitBall.x, 1.2],
      [WR_HIT + 0.05, 'word', 5, 5.0],
      ...trail(WR_HIT + 0.1, WR_LAND_2 - 0.1, 0.2, 'stars', bike),
      [WR_LAND_2, 'sfx:splat', wrecker2Land.x, 0.6],
      [WR_LAND_2, 'poof', wrecker2Land.x, 1],
      [WR_LAND_2 + 0.2, 'stars', wrecker2Sit.x, 1.8],
    ],
  };
})();

const wreckerCrash1: Def = (() => {
  const duration = 4.0;
  const hitBall = wreckerBall(0, 0);
  return {
    duration,
    word: 'SWING AND A MISS!',
    beats: { hit: WR_HIT, stick: WR_STICK, drop: WR_DROP, land: WR_LAND_C1 },
    at: wreckerCrash1At,
    events: (_bike, rider) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [WR_HIT, 'groan', hitBall.x, 1.4],
      [WR_HIT, 'sfx:crash', hitBall.x, 1.2],
      [WR_STICK, 'word', 7, 4.4],
      [WR_STICK, 'sfx:boing', 6.7, 3],
      ...trail(WR_STICK + 0.2, WR_DROP - 0.1, 0.25, 'sweat', rider, 0.5),
      [1.55, 'sfx:bump', 7.4, 0.2],
      [1.55, 'dust', 7.4, 0.1],
      [WR_DROP, 'sfx:slideWhistle', 11.3, 3],
      [WR_LAND_C1, 'sfx:bump', 12.4, 0.2],
      [WR_LAND_C1, 'dust', 12.4, 0.1],
      [WR_LAND_C1 + 0.3, 'stars', 12.4, 1.7],
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
  halfpipe: { clear: [halfpipeClear0, halfpipeClear1], crash: [halfpipeCrash0, halfpipeCrash1] },
  penguins: { clear: [penguinsClear0, penguinsClear1], crash: [penguinsCrash0, penguinsCrash1] },
  wrecker: { clear: [wreckerClear0, wreckerClear1], crash: [wreckerCrash0, wreckerCrash1] },
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
  if (outcome === 'clear' && time >= d.duration) settleClear(out, SPECS[kind].length);
  return out;
}

/**
 * Landed and riding on: normalise away any rounding so the next stretch starts clean. The bike
 * ends on the road at `length`, whole turns kept, and the rider is seated and happy again.
 */
export function settleClear(out: Frame, length: number): Frame {
  const b = out.bike;
  b.x = length;
  b.y = BIKE_Y;
  b.pitch = TAU * Math.round(b.pitch / TAU);
  b.roll = TAU * Math.round(b.roll / TAU);
  b.z = 0;
  b.squash = 1;
  b.visible = b.grounded = true;
  resetRider(out);
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
