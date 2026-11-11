/**
 * The animation toolkit: keyframe tracks and easing, the water's chop, the frame a trick fills in
 * and the shared run-up/arc/landing shape every trick starts from. Pure data and maths: no three.js
 * and no DOM, so the sampler is easy to test and the trick lab can play any moment of any trick.
 *
 * Coordinates are launcher-local (see `tricks.ts`): `d` metres forward of the launcher's entry
 * line, `y` up from the water's rest surface, `s` sideways (+ is the rider's right). Angles:
 * `pitch` + noses up, `roll` + dips the right side, `yaw` + turns left; full turns add 2π.
 */
import { ENTRY_SPEED, type LauncherKind } from './rules';

export const TAU = Math.PI * 2;

// ---------- Keyframes and easing ----------

export type Ease = 'l' | 'i' | 'o' | 'q' | 'io';

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
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

export const smooth = (u: number) => EASE.io(clamp01(u));

/** The small chop of the water at world (x, z) and time t: what the ski bobs on and the mesh shows. */
export function swell(x: number, z: number, t: number): number {
  return 0.08 * Math.sin(0.35 * x + 1.1 * t) + 0.06 * Math.sin(0.22 * z - 0.9 * t);
}

// ---------- The frame ----------

export type PoseName =
  | 'ride'
  | 'wave'
  | 'armsUp'
  | 'flail'
  | 'superman'
  | 'dizzy'
  | 'thumbs'
  | 'fistPump'
  | 'stand'
  | 'tuck'
  | 'frisbee'
  | 'float'
  | 'climb';
export type FaceName = 'happy' | 'scared' | 'dizzy' | 'soaked' | 'sooty';

export interface SkiFrame {
  d: number;
  y: number;
  s: number;
  pitch: number;
  roll: number;
  yaw: number;
  visible: boolean;
  /** On the water or a launcher (it bobs and trails a wake), not in the air. */
  wet: boolean;
}

export interface RiderFrame {
  /** Seated: sits on the ski (the transform below is the ski's seat). Free: on its own. */
  mode: 'seated' | 'free';
  /** The hips, and the body's turn about them. */
  d: number;
  y: number;
  s: number;
  pitch: number;
  roll: number;
  yaw: number;
  pose: PoseName;
  face: FaceName;
  visible: boolean;
  /** Gag props worn: seaweed on the helmet, a fish in the mouth. */
  props: { seaweed: boolean; fish: boolean };
}

export interface DolphinFrame {
  d: number;
  y: number;
  s: number;
  /** The leap, 0 (diving in) to 1 (diving back). */
  phase: number;
  visible: boolean;
}

export interface CloudFrame {
  d: number;
  y: number;
  s: number;
  /** 0 (not there) to 1 (full size). */
  scale: number;
  visible: boolean;
}

export interface TailFrame {
  d: number;
  y: number;
  s: number;
  /** 0 = hidden under the water, 1 = fully up (about 3 u tall). */
  rise: number;
  /** Swat swing, -1 (back) to 1 (forward past the ski). */
  swing: number;
  visible: boolean;
}

export interface EggFrame {
  d: number;
  y: number;
  s: number;
  /** 0..1 size. */
  scale: number;
  /** 0..1 crack lines and wobble. */
  crack: number;
  /** 0..1 the baby dino popping out of the top. */
  hatch: number;
  /** 0..1 the two shell halves closing on the ski (fail). */
  shut: number;
  visible: boolean;
}

export interface Frame {
  ski: SkiFrame;
  rider: RiderFrame;
  dolphins: [DolphinFrame, DolphinFrame];
  cloud: CloudFrame;
  tail: TailFrame;
  egg: EggFrame;
}

/** Where a seated rider's hips are in the ski's own space: up from the waterline and back from the middle. */
export const SEAT = { up: 0.55, back: 0.2 };
/** Half the ski's length. */
export const SKI_HALF = 1.3;

export function createFrame(): Frame {
  return {
    ski: { d: 0, y: 0, s: 0, pitch: 0, roll: 0, yaw: 0, visible: true, wet: true },
    rider: {
      mode: 'seated',
      d: 0,
      y: SEAT.up,
      s: 0,
      pitch: 0,
      roll: 0,
      yaw: 0,
      pose: 'ride',
      face: 'happy',
      visible: true,
      props: { seaweed: false, fish: false },
    },
    dolphins: [
      { d: 0, y: -5, s: 0, phase: 0, visible: false },
      { d: 0, y: -5, s: 0, phase: 0, visible: false },
    ],
    cloud: { d: 0, y: -5, s: 0, scale: 0, visible: false },
    tail: { d: 0, y: -5, s: 0, rise: 0, swing: 0, visible: false },
    egg: { d: 0, y: -5, s: 0, scale: 0, crack: 0, hatch: 0, shut: 0, visible: false },
  };
}

export function resetFrame(f: Frame): Frame {
  const k = f.ski;
  k.d = k.y = k.s = k.pitch = k.roll = k.yaw = 0;
  k.visible = k.wet = true;
  const r = f.rider;
  r.mode = 'seated';
  r.d = r.s = r.pitch = r.roll = r.yaw = 0;
  r.y = SEAT.up;
  r.pose = 'ride';
  r.face = 'happy';
  r.visible = true;
  r.props.seaweed = r.props.fish = false;
  for (const dolphin of f.dolphins) {
    dolphin.d = dolphin.s = dolphin.phase = 0;
    dolphin.y = -5;
    dolphin.visible = false;
  }
  const c = f.cloud;
  c.d = c.s = c.scale = 0;
  c.y = -5;
  c.visible = false;
  const tl = f.tail;
  tl.d = tl.s = tl.rise = tl.swing = 0;
  tl.y = -5;
  tl.visible = false;
  const e = f.egg;
  e.d = e.s = e.scale = e.crack = e.hatch = e.shut = 0;
  e.y = -5;
  e.visible = false;
  return f;
}

export interface Pos {
  d: number;
  y: number;
  s: number;
}

/**
 * Turns the ski-space point (x right, y up, z back) by the Euler angles the meshes use
 * (yaw about up, then pitch, then roll about the forward axis) and adds it to (d, y, s).
 */
export function turned(
  out: Pos,
  x: number,
  y: number,
  z: number,
  pitch: number,
  roll: number,
  yaw: number,
): Pos {
  const cz = Math.cos(-roll);
  const sz = Math.sin(-roll);
  const x1 = x * cz - y * sz;
  const y1 = x * sz + y * cz;
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  const y2 = y1 * cx - z * sx;
  const z2 = y1 * sx + z * cx;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x3 = x1 * cy + z2 * sy;
  const z3 = -x1 * sy + z2 * cy;
  out.s = x3;
  out.y = y2;
  out.d = -z3;
  return out;
}

const scratch: Pos = { d: 0, y: 0, s: 0 };

/** The ski's seat (where a seated rider's hips are) in launcher-local coordinates, into `out`. */
export function seatOf(ski: SkiFrame, out: Pos = { d: 0, y: 0, s: 0 }): Pos {
  turned(scratch, 0, SEAT.up, SEAT.back, ski.pitch, ski.roll, ski.yaw);
  out.d = ski.d + scratch.d;
  out.y = ski.y + scratch.y;
  out.s = ski.s + scratch.s;
  return out;
}

/**
 * The point `back` behind and `up` above the ski's seat, turned with the ski (into `out`): where a
 * rider hovers when stretched out flat behind the bars.
 */
export function hoverOf(
  ski: SkiFrame,
  back: number,
  up: number,
  out: Pos = { d: 0, y: 0, s: 0 },
): Pos {
  turned(scratch, 0, SEAT.up + up, SEAT.back + back, ski.pitch, ski.roll, ski.yaw);
  out.d = ski.d + scratch.d;
  out.y = ski.y + scratch.y;
  out.s = ski.s + scratch.s;
  return out;
}

/** A seated rider takes the ski's seat and angles: call after the ski is posed. */
export function sitOnSki(f: Frame): void {
  const r = f.rider;
  seatOf(f.ski, scratch);
  r.d = scratch.d;
  r.y = scratch.y;
  r.s = scratch.s;
  r.pitch = f.ski.pitch;
  r.roll = f.ski.roll;
  r.yaw = f.ski.yaw;
}

const probe = createFrame();

/** The seat's position and the ski's angles at time `t` of a ski motion, for a rider who leaves it. */
export function seatAtTime(
  skiAt: (t: number, f: Frame) => void,
  t: number,
): Pos & { pitch: number; roll: number; yaw: number } {
  resetFrame(probe);
  skiAt(t, probe);
  const p = seatOf(probe.ski);
  return { ...p, pitch: probe.ski.pitch, roll: probe.ski.roll, yaw: probe.ski.yaw };
}

/** The rider leaves the seat: free, at this spot with these angles. */
export function setFree(
  f: Frame,
  d: number,
  y: number,
  s: number,
  pitch: number,
  roll: number,
  yaw: number,
  pose: PoseName,
  face: FaceName,
): void {
  const r = f.rider;
  r.mode = 'free';
  r.d = d;
  r.y = y;
  r.s = s;
  r.pitch = pitch;
  r.roll = roll;
  r.yaw = yaw;
  r.pose = pose;
  r.face = face;
}

// ---------- Launchers ----------

export interface LauncherGeometry {
  kind: LauncherKind;
  /** The width of the launcher across (u). */
  width: number;
  /** The lip: where the ski leaves (d, y) and the angle it leaves at (radians). */
  lipD: number;
  lipY: number;
  lipAngle: number;
}

const DEG = Math.PI / 180;

export const LAUNCHERS: Record<LauncherKind, LauncherGeometry> = {
  wave: { kind: 'wave', width: 16, lipD: 5, lipY: 1.4, lipAngle: 0 },
  kicker: { kind: 'kicker', width: 4, lipD: 6, lipY: 2.0, lipAngle: 18 * DEG },
  'mega-ramp': { kind: 'mega-ramp', width: 5, lipD: 10, lipY: 4.2, lipAngle: 32 * DEG },
};

/** Height of the launcher's surface at `d` (0 before it, the lip's height at and after the lip). */
export function surfaceY(kind: LauncherKind, d: number): number {
  const g = LAUNCHERS[kind];
  const x = Math.min(Math.max(d, 0), g.lipD);
  switch (kind) {
    case 'wave':
      return 1.4 * Math.sin((Math.PI * x) / 10) ** 2;
    case 'kicker':
      return (2.0 * x) / 6;
    default:
      return 4.2 * (x / 10) ** 1.6;
  }
}

function surfaceSlope(kind: LauncherKind, d: number): number {
  const h = 0.01;
  return (surfaceY(kind, d + h) - surfaceY(kind, d - h)) / (2 * h);
}

/** The ski's pitch when riding up the launcher at `d` (0 at the foot, the lip angle at the lip). */
export function surfacePitch(kind: LauncherKind, d: number): number {
  const g = LAUNCHERS[kind];
  const x = Math.min(Math.max(d, 0), g.lipD);
  const angle = Math.atan(surfaceSlope(kind, x));
  if (kind === 'wave') return angle;
  const atLip = Math.atan(surfaceSlope(kind, g.lipD - 0.02));
  return (angle * g.lipAngle) / atLip;
}

// ---------- The run-up, the arc and the landing ----------

/** How fast and how long a cleared trick rides on after the landing. */
export const OUT_SPEED = 10;
export const OUT_TIME = 1.0;

/** The run-up to the lip, the arc through the air and where it comes down. */
export interface Launch {
  kind: LauncherKind;
  lipD: number;
  lipY: number;
  lipAngle: number;
  /** Time the ski leaves the lip, and the air time. */
  tLip: number;
  air: number;
  tLand: number;
  /** Where it comes down (d) and how high above the lip it peaks. */
  land: number;
  peak: number;
}

/**
 * A launch off `kind`: the ski rides up at ENTRY_SPEED, flies for `air` seconds covering the same
 * speed along d, peaking `peak` above the lip. `land` is where it comes down (defaults to the
 * distance an ENTRY_SPEED ski covers in `air`).
 */
export function launch(
  kind: LauncherKind,
  air: number,
  peak: number,
  land = LAUNCHERS[kind].lipD + ENTRY_SPEED * air,
): Launch {
  const g = LAUNCHERS[kind];
  const tLip = g.lipD / ENTRY_SPEED;
  return {
    kind,
    lipD: g.lipD,
    lipY: g.lipY,
    lipAngle: g.lipAngle,
    tLip,
    air,
    tLand: tLip + air,
    land,
    peak,
  };
}

/** Progress through the air: 0 at the lip, 1 at the landing (clamped). */
export const airU = (L: Launch, t: number): number => clamp01((t - L.tLip) / L.air);

/** The ski's d and y on the run-up and in the air (y on the water once down), into `out`. */
export function flight(L: Launch, t: number, out: { d: number; y: number }): void {
  if (t <= L.tLip) {
    out.d = (L.lipD * Math.max(t, 0)) / L.tLip;
    out.y = surfaceY(L.kind, out.d);
    return;
  }
  const u = airU(L, t);
  out.d = lerp(L.lipD, L.land, u);
  out.y = arc(L.lipY, 0, L.lipY + L.peak, u);
}

/**
 * The ski's pitch for the run-up and the air before any trick adds its own: the slope of the
 * launcher (eased in over the first 0.25 s), then the lip angle settling to level in the air.
 */
export function basePitch(L: Launch, t: number): number {
  if (t <= L.tLip) {
    const d = (L.lipD * Math.max(t, 0)) / L.tLip;
    return surfacePitch(L.kind, d) * smooth(t / 0.25);
  }
  if (t >= L.tLand) return 0;
  return L.lipAngle * (1 - smooth(airU(L, t) / 0.4));
}

// ---------- Trick definitions ----------

export type EventType =
  | 'splash'
  | 'bigSplash'
  | 'spray'
  | 'bubbles'
  | 'stars'
  | 'drips'
  | 'confetti'
  | 'cheer'
  | 'groan'
  | 'word'
  | 'sfx:splash'
  | 'sfx:boing'
  | 'sfx:splat'
  | 'sfx:slideWhistle'
  | 'sfx:whoosh'
  | 'sfx:bump'
  | 'fireworks';

/** An effect or sound at a time (seconds into the trick) and a launcher-local spot. */
export type Ev = readonly [at: number, type: EventType, d: number, y: number, s?: number];

export interface TrickEvent {
  at: number;
  type: EventType;
  d: number;
  y: number;
  s: number;
}

export interface Def {
  duration: number;
  /** Where a trick that lands ends (d); undefined for a fail. */
  length?: number;
  word: string;
  /** Stunt times (s) at which playback slows right down (tier 3 only). */
  slow?: readonly number[];
  at(t: number, f: Frame): void;
  /** The events, given samplers for where the ski and the rider are at a time. */
  events(ski: (t: number) => Pos, rider: (t: number) => Pos): Ev[];
}

/** Events along a stretch of time, at the ski (or rider) position. */
export function trail(
  from: number,
  to: number,
  every: number,
  type: EventType,
  where: (t: number) => Pos,
  dy = 0,
): Ev[] {
  const out: Ev[] = [];
  for (let t = from; t <= to + 1e-9; t += every) {
    const p = where(t);
    out.push([t, type, p.d, p.y + dy, p.s]);
  }
  return out;
}

/** What a trick that clears is built from: the launch, and what it adds on top. */
export interface ClearSpec {
  launcher: LauncherKind;
  air: number;
  peak: number;
  word: string;
  /** Extra pitch, roll, yaw and side-to-side by progress through the air (u from 0 to 1). */
  pitch?(u: number): number;
  roll?(u: number): number;
  yaw?(u: number): number;
  side?(u: number): number;
  /** The rider's pose at a time (seated on the ski). */
  pose?(t: number, L: Launch): PoseName;
  /** Lets a trick put the rider somewhere other than the seat (after the ski and pose are set). */
  rider?(t: number, L: Launch, f: Frame): void;
  /** Slow motion at the peak (tier 3). */
  slow?: boolean;
  /** Further events. */
  extra?(L: Launch, ski: (t: number) => Pos): Ev[];
}

/** The ski's end d for a clear: where it lands plus the ride out. */
export const clearLength = (L: Launch): number => L.land + OUT_SPEED * OUT_TIME;

/**
 * A trick that lands: the ski rides up, flies the arc doing the spec's turns, lands, rides on for
 * OUT_TIME and finishes level at `clearLength`.
 */
export function clearDef(spec: ClearSpec): Def {
  const L = launch(spec.launcher, spec.air, spec.peak);
  const duration = L.tLand + OUT_TIME;
  const out = { d: 0, y: 0 };
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    flight(L, t, out);
    const u = airU(L, t);
    const inAir = t > L.tLip && t < L.tLand;
    k.d = t >= L.tLand ? L.land + OUT_SPEED * (t - L.tLand) : out.d;
    k.y = t >= L.tLand ? 0 : out.y;
    k.pitch = basePitch(L, t) + (spec.pitch?.(u) ?? 0);
    k.roll = spec.roll?.(u) ?? 0;
    k.yaw = spec.yaw?.(u) ?? 0;
    k.s = spec.side?.(u) ?? 0;
    k.wet = !inAir;
    f.rider.pose = spec.pose?.(t, L) ?? (inAir ? 'fistPump' : 'ride');
    f.rider.face = 'happy';
    spec.rider?.(t, L, f);
  };
  const mid = L.tLip + L.air / 2;
  return {
    duration,
    length: clearLength(L),
    word: spec.word,
    slow: spec.slow ? [mid] : undefined,
    at,
    events: (ski) => [
      [L.tLip - 0.2, 'sfx:whoosh', L.lipD - 2, L.lipY],
      [L.tLip, 'spray', L.lipD, L.lipY],
      ...(spec.launcher === 'wave' ? [] : ([[L.tLip, 'sfx:boing', L.lipD, L.lipY]] as Ev[])),
      [mid, 'word', ski(mid).d, ski(mid).y + 1.6, ski(mid).s],
      [L.tLand, 'splash', L.land, 0],
      [L.tLand, 'sfx:splash', L.land, 0],
      [L.tLand + 0.2, 'cheer', L.land + 2, 1],
      ...(spec.launcher === 'mega-ramp'
        ? ([[L.tLand + 0.2, 'confetti', L.land + 3, 1.5]] as Ev[])
        : []),
      ...(spec.extra?.(L, ski) ?? []),
    ],
  };
}
