/**
 * Victory dances as pure pose maths: no three.js and no DOM. Every game's `Pose` has these ten
 * fields, so `writeDance` writes into any of them by structural typing.
 *
 * Rig conventions: `raise` swings a limb forward (PI/2 straight ahead, PI straight up, negative
 * behind); `out` swings it sideways away from the body (negative crosses in front); `bend` is the
 * elbow or knee. Facing +z, the person's left is +x; positive `twist` turns the chest to their left,
 * positive `roll` tips them to their left and positive `headPitch` looks up.
 */

export type DanceId =
  | 'floss'
  | 'dab'
  | 'robot'
  | 'disco'
  | 'running-man'
  | 'sprinkler'
  | 'chicken'
  | 'raise-the-roof'
  | 'cabbage-patch'
  | 'twist';

export const DANCES: readonly DanceId[] = [
  'floss',
  'dab',
  'robot',
  'disco',
  'running-man',
  'sprinkler',
  'chicken',
  'raise-the-roof',
  'cabbage-patch',
  'twist',
];

/** Seconds of one full loop of each dance. */
export const DANCE_PERIOD: Record<DanceId, number> = {
  floss: 0.8,
  dab: 1.4,
  robot: 1.6,
  disco: 1.0,
  'running-man': 0.6,
  sprinkler: 2.0,
  chicken: 1.0,
  'raise-the-roof': 0.5,
  'cabbage-patch': 0.8,
  twist: 0.5,
};

/** How long the dance shows before the results card. */
export const DANCE_SECONDS = 4;
/** How long a rig eases from what it was doing into the dance (animator transition). */
export const DANCE_EASE = 0.2;

export interface DanceLimb {
  raise: number;
  out: number;
  bend: number;
}

export interface DancePose {
  lift: number;
  lean: number;
  twist: number;
  headPitch: number;
  headYaw: number;
  roll: number;
  armL: DanceLimb;
  armR: DanceLimb;
  legL: DanceLimb;
  legR: DanceLimb;
}

const TAU = Math.PI * 2;

const set = (to: DanceLimb, raise: number, out: number, bend: number) => {
  to.raise = raise;
  to.out = out;
  to.bend = bend;
};

const copy = (to: DanceLimb, from: DanceLimb) => set(to, from.raise, from.out, from.bend);

const mix = (to: DanceLimb, a: DanceLimb, b: DanceLimb, k: number) =>
  set(
    to,
    a.raise + (b.raise - a.raise) * k,
    a.out + (b.out - a.out) * k,
    a.bend + (b.bend - a.bend) * k,
  );

const limb = (raise: number, out: number, bend: number): DanceLimb => ({ raise, out, bend });

/** Smooth 0..1 ease of a 0..1 progress. */
const ease = (k: number) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};

/** Time inside one loop, in 0..period. */
const loop = (t: number, period: number) => ((t % period) + period) % period;

function rest(into: DancePose): void {
  into.lift = 0;
  into.lean = 0;
  into.twist = 0;
  into.headPitch = 0;
  into.headYaw = 0;
  into.roll = 0;
  set(into.armL, 0, 0.08, 0.1);
  set(into.armR, 0, 0.08, 0.1);
  set(into.legL, 0, 0.06, 0.05);
  set(into.legR, 0, 0.06, 0.05);
}

function floss(p: DancePose, t: number) {
  const w = (TAU / DANCE_PERIOD.floss) * t;
  const x = Math.sin(w);
  const d = Math.cos(w);
  set(p.armL, 0.55 * d, 0.15 + 0.6 * x, 0.1);
  set(p.armR, 0.55 * d, 0.15 - 0.6 * x, 0.1);
  p.roll = -0.12 * x;
  p.legL.out = 0.08 - 0.1 * x;
  p.legR.out = 0.08 + 0.1 * x;
  p.lift = 0.02 * Math.abs(Math.sin(2 * w));
}

const DAB_ARM_FACE = limb(1.9, -0.5, 1.9);
const DAB_ARM_UP = limb(1.3, 1.3, 0);

function dab(p: DancePose, t: number) {
  const u = loop(t, DANCE_PERIOD.dab) / DANCE_PERIOD.dab;
  // 1 is the dab to their left, -1 the mirrored one.
  let s: number;
  if (u < 0.15) s = -1 + 2 * ease(u / 0.15);
  else if (u < 0.5) s = 1;
  else if (u < 0.65) s = 1 - 2 * ease((u - 0.5) / 0.15);
  else s = -1;
  const k = (s + 1) / 2;
  // Left dab: right arm across the face, left arm up and out. The mirror swaps them.
  mix(p.armR, DAB_ARM_UP, DAB_ARM_FACE, k);
  mix(p.armL, DAB_ARM_UP, DAB_ARM_FACE, 1 - k);
  p.headPitch = -0.45;
  p.headYaw = 0.35 * s;
  p.twist = 0.25 * s;
  p.lean = 0.15;
}

const ROBOT_FORE = limb(0.1, 0.1, 1.57);
const ROBOT_UP = limb(1.57, 0, 1.57);
const ROBOT_STRAIGHT = limb(1.57, 0, 0);

function robot(p: DancePose, t: number) {
  const step = loop(t, DANCE_PERIOD.robot) / 0.4;
  const index = Math.min(3, Math.floor(step));
  const since = (step - index) * 0.4;
  if (since < 0.08) p.lift = -0.03;
  p.legL.bend = 0.05;
  p.legR.bend = 0.05;
  if (index === 0) {
    copy(p.armL, ROBOT_FORE);
    copy(p.armR, ROBOT_FORE);
  } else if (index === 1) {
    copy(p.armL, ROBOT_UP);
    copy(p.armR, ROBOT_FORE);
    p.headYaw = 0.5;
  } else if (index === 2) {
    copy(p.armL, ROBOT_FORE);
    copy(p.armR, ROBOT_UP);
    p.headYaw = -0.5;
  } else {
    copy(p.armL, ROBOT_STRAIGHT);
    copy(p.armR, ROBOT_STRAIGHT);
    p.twist = 0.3;
  }
}

const DISCO_HIGH = limb(2.7, -0.3, 0.05);
const DISCO_LOW = limb(0.5, 0.7, 0.05);

function disco(p: DancePose, t: number) {
  const u = loop(t, DANCE_PERIOD.disco);
  const high = u < 0.5;
  const since = high ? u : u - 0.5;
  const k = ease(since / 0.12);
  // 1 = pointing high, -1 = pointing low.
  const point = high ? -1 + 2 * k : 1 - 2 * k;
  set(p.armL, 0.25, 0.6, 1.9);
  mix(p.armR, DISCO_LOW, DISCO_HIGH, (point + 1) / 2);
  p.roll = 0.1 * point;
  p.headPitch = 0.25 * point;
  const low = (1 - point) / 2;
  set(p.legR, 0.25 * low, 0.06 + (-0.15 - 0.06) * low, 0.05 + 0.45 * low);
}

function runningMan(p: DancePose, t: number) {
  const s = Math.sin((TAU / DANCE_PERIOD['running-man']) * t);
  const leg = (to: DanceLimb, v: number) =>
    set(to, Math.max(0, v) * 1.1 - Math.max(0, -v) * 0.3, 0.05, 0.2 + Math.max(0, v) * 1.3);
  leg(p.legL, s);
  leg(p.legR, -s);
  p.lift = -0.04 + 0.04 * Math.abs(s);
  set(p.armL, 0.9 - 0.5 * s, 0.1, 1.6);
  set(p.armR, 0.9 + 0.5 * s, 0.1, 1.6);
  p.lean = 0.12;
}

function sprinkler(p: DancePose, t: number) {
  const u = loop(t, DANCE_PERIOD.sprinkler);
  set(p.armL, 2.6, 0.9, 2.3);
  let out: number;
  if (u < 1.4) {
    const tick = Math.min(5, Math.floor(u / (1.4 / 6)));
    out = -0.3 + (1.4 * tick) / 5;
    if (u - tick * (1.4 / 6) < 0.08) p.lift = -0.03;
  } else {
    out = 1.1 - 1.4 * ease((u - 1.4) / 0.6);
  }
  set(p.armR, 1.5, out, 0.1);
  p.twist = 0.35 * out;
}

function chicken(p: DancePose, t: number) {
  const u = loop(t, DANCE_PERIOD.chicken);
  if (u < 0.5) {
    const flap = 0.25 + 0.6 * Math.abs(Math.sin((4 * Math.PI * u) / 0.5));
    set(p.armL, 0.35, flap, 2.4);
    set(p.armR, 0.35, flap, 2.4);
  } else {
    set(p.armL, 0.35, 0.25, 2.4);
    set(p.armR, 0.35, 0.25, 2.4);
    p.lift = -0.07 * Math.abs(Math.sin(4 * Math.PI * u));
  }
  set(p.legL, 0.3, 0.1, 0.6);
  set(p.legR, 0.3, 0.1, 0.6);
  p.headPitch = 0.15 * Math.sin(8 * Math.PI * u);
  p.lean = 0.15;
}

function raiseTheRoof(p: DancePose, t: number) {
  const q = Math.abs(Math.sin((Math.PI * t) / 0.5));
  set(p.armL, 2.4 + 0.3 * q, 0.5, 1.4 - 1.0 * q);
  set(p.armR, 2.4 + 0.3 * q, 0.5, 1.4 - 1.0 * q);
  p.lift = 0.05 * q;
  p.headPitch = 0.1 + 0.1 * q;
  set(p.legL, 0.15, 0.08, 0.3 * (1 - q));
  set(p.legR, 0.15, 0.08, 0.3 * (1 - q));
}

function cabbagePatch(p: DancePose, t: number) {
  const w = (TAU / DANCE_PERIOD['cabbage-patch']) * t;
  const raise = 1.3 + 0.3 * Math.sin(w);
  const out = -0.2 + 0.25 * Math.cos(w);
  set(p.armL, raise, out, 1.6);
  set(p.armR, raise, out, 1.6);
  p.twist = 0.2 * Math.cos(w);
  p.lift = -0.04 + 0.02 * Math.sin(2 * w);
  set(p.legL, 0.25, 0.08, 0.5);
  set(p.legR, 0.25, 0.08, 0.5);
}

function twist(p: DancePose, t: number) {
  const s = Math.sin((TAU / DANCE_PERIOD.twist) * t);
  p.lift = -0.08;
  set(p.legL, 0.35, 0.1, 0.7);
  set(p.legR, 0.35, 0.1, 0.7);
  p.twist = 0.6 * s;
  p.headYaw = -0.4 * s;
  set(p.armL, 0.6 - 0.4 * s, 0.5, 1.4);
  set(p.armR, 0.6 + 0.4 * s, 0.5, 1.4);
  p.roll = 0.05 * s;
}

const WRITERS: Record<DanceId, (p: DancePose, t: number) => void> = {
  floss,
  dab,
  robot,
  disco,
  'running-man': runningMan,
  sprinkler,
  chicken,
  'raise-the-roof': raiseTheRoof,
  'cabbage-patch': cabbagePatch,
  twist,
};

/** Writes every one of the ten fields of `into` (limbs in place) for `id`, `t` s into the dance. Loops. */
export function writeDance(into: DancePose, id: DanceId, t: number): void {
  rest(into);
  WRITERS[id](into, t);
}

/** A random dance. */
export function pickDance(random: () => number = Math.random): DanceId {
  return DANCES[Math.min(DANCES.length - 1, Math.floor(random() * DANCES.length))];
}

/** Yaw (about y) that turns a rig facing +z at yaw 0 to look from `from` towards `to`. */
export function yawToward(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}
