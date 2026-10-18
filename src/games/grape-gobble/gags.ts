import { vec3, type Vec3 } from './ik';
import { GAG_SECONDS, type Gag } from './rules';

// ---------- Where things are (world units; the kid faces +z, so the kid's right is -x) ----------

export const HEAD_REST = vec3(0, 1.58, -0.6);
export const SHOULDER_R = vec3(-0.42, 1.12, -0.6);
export const SHOULDER_L = vec3(0.42, 1.12, -0.6);
export const UPPER_ARM = 0.55;
export const FOREARM = 0.55;
/** Where the right hand grabs a grape from the bowl. */
export const GRAB = vec3(-0.8, 1.0, 0.3);
/** Where the hand holds a grape at the lips. */
export const MOUTH_FRONT = vec3(0, 1.41, -0.06);
export const REST_R = vec3(-0.5, 1.0, 0.2);
export const REST_L = vec3(0.55, 0.9, 0.2);
/** A held grape sits at the hand plus this. */
export const HELD = vec3(0, 0.03, -0.07);
/** Radius of every grape. */
export const GRAPE_R = 0.12;
export const TABLE_Y = 0.8;
/** Height of a grape's centre when it rests on the table. */
export const TABLE_GRAPE_Y = TABLE_Y + GRAPE_R;
/** Where in the bowl the grape for a pick-up comes from (the bunch's near side). */
export const PICK_FROM = vec3(-1.0, 1.15, 0.4);
/** The puppy's mouth, relative to its feet, when it faces +z. */
export const DOG_MOUTH = vec3(0, 0.46, 0.48);

/** Seconds a chew takes, from the grab to being back at rest. */
export const EAT_SECONDS = 0.6;
/** The moment in an eat when the grape goes in (the chomp). */
export const EAT_CHOMP_AT = 0.28;

// ---------- Keyframe tracks ----------

/** Smoothstep: 0 below 0, 1 above 1, eased between. */
export function smooth(x: number): number {
  const c = Math.min(Math.max(x, 0), 1);
  return c * c * (3 - 2 * c);
}

export type Key<T> = readonly [number, T];

/** Samples a track of `[time, value]` keys: held before the first and after the last, eased between. */
export function track(keys: readonly Key<number>[], t: number): number {
  const first = keys[0];
  if (t <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const [tb, b] = keys[i];
    if (t < tb) {
      const [ta, a] = keys[i - 1];
      return a + (b - a) * smooth((t - ta) / (tb - ta));
    }
  }
  return keys[keys.length - 1][1];
}

/** Like `track`, for a point: one track per component. */
export function track3(keys: readonly Key<Vec3>[], t: number): Vec3 {
  return vec3(
    track(
      keys.map(([k, v]) => [k, v.x]),
      t,
    ),
    track(
      keys.map(([k, v]) => [k, v.y]),
      t,
    ),
    track(
      keys.map(([k, v]) => [k, v.z]),
      t,
    ),
  );
}

/** The value of the last key at or before `t` (no easing); the first key's value before that. */
function step<T>(keys: readonly Key<T>[], t: number): T {
  let value = keys[0][1];
  for (const [at, v] of keys) {
    if (t >= at) value = v;
  }
  return value;
}

/** 0 until `a`, 1 from `b`, eased between. */
const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const add = (a: Vec3, b: Vec3): Vec3 => vec3(a.x + b.x, a.y + b.y, a.z + b.z);
const lerp3 = (a: Vec3, b: Vec3, u: number): Vec3 =>
  vec3(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Height along a toss that rises to `apex` and comes down to `y1`; `u` in [0, 1]. */
function lobY(y0: number, apex: number, y1: number, u: number): number {
  const top = Math.max(apex, y0 + 0.01, y1 + 0.01);
  const a = top - y0;
  const b = top - y1;
  const s = Math.sqrt(a) / (Math.sqrt(a) + Math.sqrt(b));
  const c = clamp(u, 0, 1);
  if (c < s) {
    const v = c / s;
    return y0 + a * (1 - (1 - v) * (1 - v));
  }
  const v = (c - s) / (1 - s);
  return top - b * v * v;
}

/** A toss from `from` to `to` that peaks at height `apex`; x and z move evenly. */
function lob(from: Vec3, to: Vec3, apex: number, u: number): Vec3 {
  const c = clamp(u, 0, 1);
  return vec3(
    from.x + (to.x - from.x) * c,
    lobY(from.y, apex, to.y, c),
    from.z + (to.z - from.z) * c,
  );
}

/** A drop from `from` to `to`: starts slowly and speeds up. */
function drop(from: Vec3, to: Vec3, u: number): Vec3 {
  const c = clamp(u, 0, 1);
  return vec3(
    from.x + (to.x - from.x) * c,
    from.y + (to.y - from.y) * c * c,
    from.z + (to.z - from.z) * c,
  );
}

/** Position `u` (0..1) between `a` and `b` over the span `[t0, t1]`. */
const span = (t: number, t0: number, t1: number) => clamp((t - t0) / (t1 - t0), 0, 1);

// ---------- The kid's frame ----------

export type Eyes = 'open' | 'wide' | 'cross' | 'squint' | 'shut' | 'one-shut';

export interface KidFrame {
  handR: Vec3;
  handL: Vec3;
  /** Offset of the head from HEAD_REST, plus its tilt in radians (pitch + is chin down, yaw + turns to +x, roll + tips to +x). */
  head: Vec3;
  pitch: number;
  yaw: number;
  roll: number;
  /** 0 closed .. 1 wide open. */
  mouth: number;
  /** Cheek bulge 0..1 (R is the screen's left). */
  cheekR: number;
  cheekL: number;
  eyes: Eyes;
  /** Where the pupils look: -1..1 each (x + is the screen's right, y + is up). */
  look: { x: number; y: number };
  /** The grape in play. `null` when none is visible. `squash` flattens it (1 = round). */
  grape: { pos: Vec3; squash: number } | null;
  /** The puppy, when it is there. `pos` is where its feet are. */
  dog: { pos: Vec3; yaw: number; mouthOpen: number } | null;
  /** The grape squashed on the face, when it is there: head-local position, size 0..1. */
  faceGrape: { pos: Vec3; size: number } | null;
  /** A dust bunny or a grape lodged in the hair, head-local. */
  hairProp: { kind: 'grape' | 'dust'; pos: Vec3 } | null;
}

export function restFrame(): KidFrame {
  return {
    handR: vec3(REST_R.x, REST_R.y, REST_R.z),
    handL: vec3(REST_L.x, REST_L.y, REST_L.z),
    head: vec3(),
    pitch: 0,
    yaw: 0,
    roll: 0,
    mouth: 0,
    cheekR: 0,
    cheekL: 0,
    eyes: 'open',
    look: { x: 0, y: 0 },
    grape: null,
    dog: null,
    faceGrape: null,
    hairProp: null,
  };
}

/** Keeps the numbers that must stay in range in range. */
function finish(f: KidFrame): KidFrame {
  f.mouth = clamp(f.mouth, 0, 1);
  f.cheekR = clamp(f.cheekR, 0, 1);
  f.cheekL = clamp(f.cheekL, 0, 1);
  f.look.x = clamp(f.look.x, -1, 1);
  f.look.y = clamp(f.look.y, -1, 1);
  if (f.grape) f.grape.squash = clamp(f.grape.squash, 0, 1);
  if (f.faceGrape) f.faceGrape.size = clamp(f.faceGrape.size, 0, 1);
  if (f.dog) f.dog.mouthOpen = clamp(f.dog.mouthOpen, 0, 1);
  return f;
}

/** Every gag starts the same way: hand to the bowl, a grape, up to the lips (0 - 0.3 s). */
const WIND: Key<Vec3>[] = [
  [0, REST_R],
  [0.12, GRAB],
  [0.3, MOUTH_FRONT],
];
const WIND_MOUTH: Key<number>[] = [
  [0, 0],
  [0.15, 0],
  [0.3, 0.3],
];

/** The grape in the hand from the grab until `until`. */
function holdGrape(f: KidFrame, t: number, until: number, squash = 1) {
  if (t <= 0 || t > until) return;
  const held = add(f.handR, HELD);
  f.grape = {
    pos: t < 0.12 ? lerp3(PICK_FROM, held, smooth(t / 0.12)) : held,
    squash,
  };
}

/** Turns a point about the y axis (yaw), the way three.js does. */
export function rotY(v: Vec3, yaw: number): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

// ---------- Cues ----------

export const SFX_NAMES = [
  'boing',
  'splat',
  'slideWhistle',
  'honk',
  'glove',
  'tick',
  'fizz',
  'whoosh',
  'bump',
  'miss',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

export interface Cue {
  at: number;
  sfx?: SfxName;
  pop?: string;
  burst?: { kind: 'juice' | 'dust' | 'stars'; at: Vec3 };
}

export const GAG_CUES: Record<Gag, Cue[]> = {
  forehead: [
    { at: 0.95, sfx: 'boing', pop: 'Bonk!', burst: { kind: 'stars', at: vec3(0, 1.98, -0.3) } },
    { at: 2.0, sfx: 'slideWhistle' },
  ],
  'under-table': [
    { at: 0.5, sfx: 'slideWhistle' },
    { at: 1.5, pop: 'Oops!' },
    { at: 2.6, sfx: 'boing' },
    { at: 3.1, sfx: 'tick', burst: { kind: 'dust', at: vec3(0, 1.95, -0.6) } },
  ],
  dog: [
    { at: 0.5, sfx: 'whoosh' },
    { at: 1.0, sfx: 'glove', pop: 'Chomp!' },
    { at: 1.4, sfx: 'bump', pop: 'Woof!' },
    { at: 2.5, sfx: 'miss' },
  ],
  'face-splat': [
    { at: 1.1, sfx: 'splat', pop: 'Splat!', burst: { kind: 'juice', at: vec3(-0.1, 1.65, -0.2) } },
    { at: 2.3, sfx: 'slideWhistle' },
  ],
  'air-chomp': [
    { at: 0.55, sfx: 'glove', pop: 'Chomp!' },
    { at: 0.9, sfx: 'glove' },
    { at: 1.25, sfx: 'glove' },
    { at: 1.6, sfx: 'tick' },
    { at: 2.5, sfx: 'miss' },
  ],
  cheek: [
    { at: 0.55, sfx: 'boing' },
    { at: 2.3, sfx: 'glove', pop: 'Pop!', burst: { kind: 'stars', at: vec3(0, 1.3, -0.3) } },
    { at: 2.6, sfx: 'tick' },
  ],
  hair: [
    { at: 0.5, sfx: 'whoosh' },
    { at: 0.9, sfx: 'splat', pop: 'Oops!' },
    { at: 2.6, sfx: 'bump' },
  ],
  juice: [
    {
      at: 0.7,
      sfx: 'splat',
      pop: 'Squirt!',
      burst: { kind: 'juice', at: vec3(-0.15, 1.65, -0.2) },
    },
    { at: 1.2, sfx: 'whoosh' },
    { at: 1.5, sfx: 'bump' },
  ],
};

// ---------- The eight gags ----------

/** Where the forehead is when the head is tipped back, for the bonk. */
const BONK = vec3(0, 1.98, -0.38);
/** Where the back wall catches a flying grape. */
const WALL_SPOT = vec3(0.9, 1.5, -2.35);
const SPREAD_R = vec3(-0.9, 1.1, 0.1);
const SPREAD_L = vec3(0.9, 1.1, 0.1);

function forehead(t: number, f: KidFrame) {
  const flick = vec3(-0.12, 1.66, -0.05);
  f.handR = track3(
    [
      ...WIND,
      [0.4, flick],
      [0.55, vec3(-0.35, 1.2, 0)],
      [0.9, REST_R],
      [2.3, REST_R],
      [2.55, SPREAD_R],
      [2.75, SPREAD_R],
      [3.0, REST_R],
    ],
    t,
  );
  f.handL = track3(
    [
      [0, REST_L],
      [2.3, REST_L],
      [2.55, SPREAD_L],
      [2.75, SPREAD_L],
      [3.0, REST_L],
    ],
    t,
  );
  f.pitch = track(
    [
      [0, 0],
      [0.3, 0],
      [0.4, -0.25],
      [0.9, -0.25],
      [0.95, -0.45],
      [1.35, 0],
    ],
    t,
  );
  f.roll = 0.12 * Math.sin(18 * (t - 2.3)) * (t > 2.3 ? 1 - ramp(t, 2.3, 3.0) : 0);
  f.mouth = track([...WIND_MOUTH, [0.4, 1], [0.9, 1], [0.95, 0.5], [1.5, 0.5], [1.8, 0]], t);
  f.eyes = step<Eyes>(
    [
      [0, 'open'],
      [0.95, 'cross'],
      [1.5, 'open'],
    ],
    t,
  );
  f.look.y = track(
    [
      [0, 0],
      [0.4, 0],
      [0.5, 1],
      [0.9, 1],
      [1.0, 0],
      [1.45, 0],
      [2.0, -0.6],
      [2.3, -1],
      [2.5, 0],
    ],
    t,
  );
  const release = flick;
  if (t <= 0.4) {
    holdGrape(f, t, 0.4);
  } else if (t < 0.95) {
    f.grape = { pos: lob(add(release, HELD), BONK, 2.6, (t - 0.4) / 0.55), squash: 1 };
  } else if (t < 1.45) {
    const table = vec3(0, TABLE_GRAPE_Y, 0.1);
    f.grape = { pos: lob(BONK, table, 2.3, (t - 0.95) / 0.5), squash: 1 };
  } else if (t < 2.0) {
    const u = (t - 1.45) / 0.55;
    f.grape = { pos: vec3(0, TABLE_GRAPE_Y, 0.1 + 1.1 * u * u), squash: 1 };
  } else if (t < 2.3) {
    f.grape = {
      pos: drop(vec3(0, TABLE_GRAPE_Y, 1.2), vec3(0, 0.45, 1.3), (t - 2.0) / 0.3),
      squash: 1,
    };
  }
}

function underTable(t: number, f: KidFrame) {
  const slip = vec3(0, 1.35, 0.05);
  const edge = vec3(0.55, 0.86, 0.4);
  const edgeR = vec3(-0.55, 0.86, 0.4);
  const pat = 0.04 * Math.max(0, Math.sin((t - 2.0) * 24)) * (t > 2.0 && t < 2.6 ? 1 : 0);
  f.handR = track3(
    [
      ...WIND,
      [0.5, slip],
      [0.9, vec3(-0.1, 1.2, 0.2)],
      [1.5, vec3(-0.15, 1.1, 0.3)],
      [2.0, edgeR],
      [2.6, edgeR],
      [3.0, vec3(-0.5, 1.0, 0.2)],
      [3.3, REST_R],
    ],
    t,
  );
  f.handR = add(f.handR, vec3(t > 0.3 && t < 0.5 ? 0.03 * Math.sin((t - 0.3) * 60) : 0, pat, 0));
  f.handL = track3(
    [
      [0, REST_L],
      [1.5, REST_L],
      [2.0, edge],
      [2.6, edge],
      [3.0, REST_L],
    ],
    t,
  );
  f.handL = add(f.handL, vec3(0, pat, 0));
  const sway =
    0.15 *
    Math.sin((t - 2.0) * 10.5) *
    (t > 2.0 && t < 2.6 ? Math.sin(((t - 2.0) / 0.6) * Math.PI) : 0);
  f.head = vec3(
    sway,
    track(
      [
        [0, 0],
        [1.5, 0],
        [2.0, -1.05],
        [2.6, -1.05],
        [3.0, 0],
      ],
      t,
    ),
    0,
  );
  f.pitch = track(
    [
      [0, 0],
      [0.6, 0],
      [1.3, 0.22],
      [1.5, 0.22],
      [1.9, 0.5],
      [2.6, 0.5],
      [3.0, 0],
    ],
    t,
  );
  f.roll = 0.08 * Math.sin((t - 3.1) * 18) * (t > 3.1 ? 1 - ramp(t, 3.1, 3.4) : 0);
  f.mouth = track(
    [...WIND_MOUTH, [0.5, 0.7], [1.5, 0.7], [1.9, 0.2], [2.6, 0.2], [3.0, 0.6], [3.3, 0]],
    t,
  );
  f.eyes = step<Eyes>(
    [
      [0, 'open'],
      [0.5, 'wide'],
      [1.9, 'open'],
      [2.6, 'wide'],
      [3.2, 'open'],
    ],
    t,
  );
  f.look.x = track(
    [
      [0, 0],
      [0.6, 0],
      [1.5, 0.5],
      [1.9, 0],
    ],
    t,
  );
  f.look.y = track(
    [
      [0, 0],
      [0.5, 0],
      [0.7, -0.8],
      [1.5, -1],
      [1.9, -0.5],
      [2.6, 0],
    ],
    t,
  );
  const held = add(slip, HELD);
  const onTable = vec3(0, TABLE_GRAPE_Y, 0.1);
  if (t <= 0.5) {
    holdGrape(f, t, 0.5);
  } else if (t < 0.6) {
    f.grape = { pos: drop(held, onTable, (t - 0.5) / 0.1), squash: 1 };
  } else if (t < 1.5) {
    const u = (t - 0.6) / 0.9;
    f.grape = { pos: vec3(0.3 * u, TABLE_GRAPE_Y, 0.1 + 1.1 * u), squash: 1 };
  } else if (t < 1.7) {
    f.grape = {
      pos: drop(vec3(0.3, TABLE_GRAPE_Y, 1.2), vec3(0.3, 0.45, 1.3), (t - 1.5) / 0.2),
      squash: 1,
    };
  }
  if (t >= 2.6 && t < 3.1) f.hairProp = { kind: 'dust', pos: vec3(0, 0.43, -0.05) };
}

function dog(t: number, f: KidFrame) {
  const circle = vec3(0, 1.51, 0.14);
  const fist = 0.06 * Math.sin(Math.PI * span(t, 1.85, 2.5));
  const turn = (t - 1.85) * 18;
  f.handR = track3(
    [...WIND, [1.0, MOUTH_FRONT], [1.7, MOUTH_FRONT], [1.85, circle], [2.5, circle], [3.0, REST_R]],
    t,
  );
  if (t > 1.85 && t < 2.5)
    f.handR = add(f.handR, vec3(fist * Math.cos(turn), fist * Math.sin(turn), 0));
  f.head = vec3(
    0,
    track(
      [
        [0, 0],
        [2.5, 0],
        [2.8, -0.05],
        [3.2, 0],
      ],
      t,
    ),
    track(
      [
        [0, 0],
        [0.9, 0],
        [1.0, 0.1],
        [1.2, 0],
      ],
      t,
    ),
  );
  f.yaw = track(
    [
      [0, 0],
      [0.5, 0],
      [1.0, -0.1],
      [1.5, -0.4],
      [2.0, -0.4],
      [2.4, 0],
    ],
    t,
  );
  f.pitch = track(
    [
      [0, 0],
      [2.5, 0],
      [2.8, 0.15],
      [3.2, 0],
    ],
    t,
  );
  f.mouth = track(
    [...WIND_MOUTH, [0.8, 0.8], [0.99, 0.8], [1.0, 0], [1.1, 0], [1.3, 0.6], [2.5, 0.6], [3.0, 0]],
    t,
  );
  f.eyes = step<Eyes>(
    [
      [0, 'open'],
      [1.1, 'wide'],
      [1.7, 'squint'],
      [2.5, 'open'],
    ],
    t,
  );
  f.look.x = track(
    [
      [0, 0],
      [1.0, 0],
      [1.7, -1],
      [2.2, -1],
      [2.5, 0],
    ],
    t,
  );
  // The puppy runs along the table from the right, leaps at the grape, trots off to the left.
  const snatch = vec3(0.48, 0.98, -0.13);
  const run0 = vec3(1.9, TABLE_Y, 0.5);
  const run1 = vec3(0.95, TABLE_Y, 0.1);
  const land = vec3(0.0, TABLE_Y, 0.55);
  const trot = vec3(-1.8, TABLE_Y, 1.0);
  const away = vec3(-4.6, 0.3, 1.4);
  const faceLeft = -Math.PI / 2;
  if (t >= 0.45 && t < 1.95) {
    let pos: Vec3;
    if (t < 0.75) pos = lerp3(run0, run1, (t - 0.45) / 0.3);
    else if (t < 1.0) pos = lob(run1, snatch, 1.15, (t - 0.75) / 0.25);
    else if (t < 1.15) pos = drop(snatch, land, (t - 1.0) / 0.15);
    else if (t < 1.55) pos = lerp3(land, trot, (t - 1.15) / 0.4);
    else pos = lob(trot, away, 1.2, (t - 1.55) / 0.4);
    const bob =
      (t >= 0.45 && t < 0.75) || (t >= 1.15 && t < 1.55) ? 0.05 * Math.abs(Math.sin(t * 22)) : 0;
    pos.y += bob;
    f.dog = {
      pos,
      yaw: faceLeft,
      mouthOpen: track(
        [
          [0.45, 0],
          [0.7, 0],
          [0.8, 1],
          [0.97, 1],
          [1.0, 0],
        ],
        t,
      ),
    };
  }
  if (t <= 1.0) {
    holdGrape(f, t, 1.0);
  } else if (f.dog) {
    f.grape = { pos: add(f.dog.pos, rotY(DOG_MOUTH, f.dog.yaw)), squash: 1 };
  }
}

function faceSplat(t: number, f: KidFrame) {
  const toss = vec3(0, 1.62, -0.06);
  f.handR = track3([...WIND, [0.45, toss], [0.7, vec3(-0.3, 1.25, 0)], [1.3, REST_R]], t);
  f.head = vec3(
    track(
      [
        [0, 0],
        [0.5, 0],
        [0.8, -0.25],
        [1.1, -0.2],
        [1.4, 0],
      ],
      t,
    ),
    0,
    0,
  );
  f.pitch = track(
    [
      [0, 0],
      [0.3, 0],
      [0.5, -0.5],
      [0.9, -0.5],
      [1.1, -0.1],
      [1.3, 0.05],
      [1.6, 0],
      [2.3, 0],
      [2.5, 0.15],
      [2.8, 0.1],
      [3.0, 0],
    ],
    t,
  );
  f.mouth = track(
    [...WIND_MOUTH, [0.5, 1], [1.1, 1], [1.15, 0.35], [2.3, 0.35], [2.6, 0.1], [2.8, 0]],
    t,
  );
  f.eyes = step<Eyes>(
    [
      [0, 'open'],
      [1.1, 'cross'],
      [2.3, 'open'],
      [2.8, 'shut'],
      [2.95, 'open'],
    ],
    t,
  );
  f.look.y = track(
    [
      [0, 0],
      [1.1, 0],
      [1.3, -1],
      [2.3, -1],
      [2.5, 0],
    ],
    t,
  );
  if (t <= 0.45) {
    holdGrape(f, t, 0.45);
  } else if (t < 1.1) {
    f.grape = {
      pos: lob(add(toss, HELD), vec3(-0.1, 1.7, -0.2), 2.4, (t - 0.45) / 0.65),
      squash: 1,
    };
  } else if (t < 2.3) {
    f.faceGrape = { pos: vec3(0.1, -0.35 * ramp(t, 1.1, 2.3), 0.4), size: 1 };
  } else if (t < 2.65) {
    f.grape = {
      pos: drop(vec3(0.1, 1.23, -0.2), vec3(0.1, 0.5, -0.3), (t - 2.3) / 0.35),
      squash: 1,
    };
  }
}

function airChomp(t: number, f: KidFrame) {
  const left = vec3(0.3, 1.31, -0.06);
  const right = vec3(-0.3, 1.31, -0.06);
  f.handR = track3(
    [
      ...WIND,
      [0.5, MOUTH_FRONT],
      [0.58, left],
      [0.75, MOUTH_FRONT],
      [0.83, MOUTH_FRONT],
      [0.93, right],
      [1.1, MOUTH_FRONT],
      [1.18, MOUTH_FRONT],
      [1.28, left],
      [1.6, left],
      [2.3, vec3(0.25, 1.15, 0.1)],
      [2.5, vec3(0.25, 1.15, 0.1)],
      [2.8, REST_R],
    ],
    t,
  );
  f.head = vec3(
    0,
    0,
    track(
      [
        [0, 0],
        [0.35, 0],
        [0.55, 0.2],
        [1.4, 0.15],
        [1.7, 0],
      ],
      t,
    ),
  );
  const chew = t > 1.6 && t < 2.5 ? Math.sin(Math.PI * span(t, 1.6, 2.5)) : 0;
  f.pitch = 0.1 * chew * Math.sin((t - 1.6) * 9);
  f.mouth = track(
    [
      ...WIND_MOUTH,
      [0.4, 1],
      [0.52, 1],
      [0.55, 0],
      [0.7, 0],
      [0.78, 1],
      [0.87, 1],
      [0.9, 0],
      [1.05, 0],
      [1.13, 1],
      [1.22, 1],
      [1.25, 0],
      [1.6, 0],
      [1.7, 0.15],
      [2.5, 0.15],
      [2.8, 0],
    ],
    t,
  );
  f.cheekR = 0.7 * chew * Math.max(0, Math.sin((t - 1.6) * 8));
  f.cheekL = 0.7 * chew * Math.max(0, -Math.sin((t - 1.6) * 8));
  f.eyes = step<Eyes>(
    [
      [0, 'open'],
      [1.6, 'shut'],
      [2.5, 'one-shut'],
      [2.7, 'open'],
    ],
    t,
  );
  f.look.x = track(
    [
      [0, 0],
      [2.5, 0],
      [2.6, 0.6],
      [2.7, 0],
    ],
    t,
  );
  f.look.y = track(
    [
      [0, 0],
      [2.5, 0],
      [2.6, -0.6],
      [2.75, 0],
    ],
    t,
  );
  const table = vec3(0.3, TABLE_GRAPE_Y, 0.1);
  if (t <= 1.6) {
    holdGrape(f, t, 1.6);
  } else if (t < 1.8) {
    f.grape = { pos: drop(add(left, HELD), table, (t - 1.6) / 0.2), squash: 1 };
  } else if (t < 2.5) {
    f.grape = {
      pos: lerp3(table, vec3(0.5, TABLE_GRAPE_Y, 0.3), smooth((t - 1.8) / 0.4)),
      squash: 1,
    };
  } else if (t < 2.7) {
    const u = (t - 2.5) / 0.2;
    f.grape = { pos: vec3(0.5, TABLE_GRAPE_Y, 0.3 + 0.9 * u), squash: 1 };
  } else if (t < 2.78) {
    f.grape = {
      pos: drop(vec3(0.5, TABLE_GRAPE_Y, 1.2), vec3(0.5, 0.45, 1.3), (t - 2.7) / 0.08),
      squash: 1,
    };
  }
}

function cheek(t: number, f: KidFrame) {
  const mash = vec3(-0.3, 1.52, -0.12);
  f.handR = track3(
    [
      ...WIND,
      [0.55, mash],
      [0.7, mash],
      [1.0, REST_R],
      [2.35, REST_R],
      [2.5, vec3(-0.1, 1.4, -0.04)],
      [2.65, vec3(0.12, 1.4, -0.04)],
      [2.8, vec3(-0.05, 1.4, -0.04)],
      [3.0, REST_R],
    ],
    t,
  );
  // The grape rolls from one cheek to the other, then both puff, then pop.
  const wob = Math.cos(((2 * Math.PI) / 0.5) * (t - 0.55));
  let right = 0.5 + 0.5 * wob;
  let left = 0.5 - 0.5 * wob;
  if (t < 0.55) {
    right = ramp(t, 0.3, 0.55);
    left = 0;
  }
  const puff = ramp(t, 1.8, 2.2);
  right += (1 - right) * puff;
  left += (1 - left) * puff;
  const deflate = t > 2.3 ? 1 - ramp(t, 2.3, 2.4) : 1;
  f.cheekR = right * deflate;
  f.cheekL = left * deflate;
  const rolling = t > 0.55 && t < 2.0 ? 1 : 0;
  f.look.x = -0.8 * (f.cheekR - f.cheekL) * (t < 2.3 ? 1 : 0);
  f.look.y = t > 0.55 && t < 2.3 ? -0.3 : 0;
  f.roll = -0.08 * (f.cheekR - f.cheekL) * (t < 2.3 ? 1 : 0);
  f.pitch = track(
    [
      [0, 0],
      [0.3, 0],
      [0.55, -0.05],
      [2.0, 0],
      [2.25, 0.4],
      [2.3, 0.4],
      [2.6, 0],
    ],
    t,
  );
  f.mouth =
    track(
      [...WIND_MOUTH, [0.55, 0.2], [2.0, 0.2], [2.25, 0.3], [2.3, 1], [2.45, 1], [2.65, 0]],
      t,
    ) +
    0.08 * Math.sin(t * 25) * rolling;
  f.eyes = step<Eyes>(
    [
      [0, 'open'],
      [0.55, 'cross'],
      [2.3, 'open'],
      [2.45, 'shut'],
      [2.6, 'open'],
    ],
    t,
  );
  if (t <= 0.55) {
    holdGrape(f, t, 0.55);
  } else if (t >= 2.3 && t < 2.55) {
    f.grape = {
      pos: lob(vec3(0, 1.3, -0.3), vec3(0, TABLE_GRAPE_Y, 0.5), 1.5, (t - 2.3) / 0.25),
      squash: 1,
    };
  } else if (t >= 2.55 && t < 2.85) {
    f.grape = { pos: vec3(0, TABLE_GRAPE_Y, 0.5 + 0.7 * ((t - 2.55) / 0.3)), squash: 1 };
  } else if (t >= 2.85 && t < 2.98) {
    f.grape = {
      pos: drop(vec3(0, TABLE_GRAPE_Y, 1.2), vec3(0, 0.45, 1.3), (t - 2.85) / 0.13),
      squash: 1,
    };
  }
}

function hair(t: number, f: KidFrame) {
  const behind = vec3(-0.5, 1.9, -0.4);
  f.handR = track3(
    [
      ...WIND,
      [0.45, behind],
      [0.5, vec3(-0.55, 2.0, -0.5)],
      [0.8, vec3(-0.5, 1.5, 0.1)],
      [1.0, REST_R],
      [2.8, REST_R],
      [2.95, SPREAD_R],
      [3.2, REST_R],
    ],
    t,
  );
  const patA = vec3(0.45, 1.5, -0.4);
  const patB = vec3(-0.4, 1.6, -0.4);
  const patC = vec3(0.4, 2.05, -0.5);
  f.handL = track3(
    [
      [0, REST_L],
      [0.9, REST_L],
      [1.05, patA],
      [1.35, patA],
      [1.5, patB],
      [1.8, patB],
      [1.95, patC],
      [2.25, patC],
      [2.45, REST_L],
      [2.8, REST_L],
      [2.95, SPREAD_L],
      [3.2, REST_L],
    ],
    t,
  );
  f.pitch = track(
    [
      [0, 0],
      [2.2, 0],
      [2.45, 0.7],
      [2.6, 0.7],
      [3.0, 0],
    ],
    t,
  );
  f.head = vec3(
    0,
    track(
      [
        [0, 0],
        [2.2, 0],
        [2.45, -0.12],
        [2.7, 0],
      ],
      t,
    ),
    0,
  );
  f.mouth = track([...WIND_MOUTH, [0.5, 0.7], [2.3, 0.5], [2.6, 0.5], [3.0, 0.5], [3.2, 0]], t);
  f.eyes = step<Eyes>(
    [
      [0, 'open'],
      [0.9, 'cross'],
      [2.35, 'open'],
    ],
    t,
  );
  f.look.y = track(
    [
      [0, 0],
      [0.5, 0],
      [0.9, 1],
      [2.2, 1],
      [2.4, 0],
      [2.6, 0],
      [2.8, 0.8],
      [3.1, 0],
    ],
    t,
  );
  const inHair = vec3(0.05, 0.4, -0.1);
  const hairWorld = add(HEAD_REST, inHair);
  const table = vec3(0.1, TABLE_GRAPE_Y, 0.05);
  if (t <= 0.45) {
    holdGrape(f, t, 0.45);
  } else if (t < 0.9) {
    f.grape = { pos: lob(add(behind, HELD), hairWorld, 2.7, (t - 0.45) / 0.45), squash: 1 };
  } else if (t < 2.35) {
    const slide = ramp(t, 2.2, 2.35);
    f.hairProp = { kind: 'grape', pos: lerp3(inHair, vec3(0.05, 0.3, 0.35), slide) };
  } else if (t < 2.55) {
    f.grape = { pos: drop(vec3(0.05, 1.58, -0.14), table, (t - 2.35) / 0.2), squash: 1 };
  } else if (t < 2.7) {
    f.grape = { pos: lob(table, table, 1.05, (t - 2.55) / 0.15), squash: 1 };
  } else if (t < 3.05) {
    const u = (t - 2.7) / 0.35;
    f.grape = { pos: vec3(0.1 + 1.85 * u, TABLE_GRAPE_Y, 0.05 - 0.05 * u), squash: 1 };
  } else if (t < 3.18) {
    f.grape = {
      pos: drop(vec3(1.95, TABLE_GRAPE_Y, 0), vec3(2.1, 0.45, 0.1), (t - 3.05) / 0.13),
      squash: 1,
    };
  }
}

function juice(t: number, f: KidFrame) {
  const lips = MOUTH_FRONT;
  const tremble = t > 0.45 && t < 0.9 ? 0.015 * Math.sin(t * 90) : 0;
  const fumble = vec3(-0.2, 1.15, -0.05);
  f.handR = add(
    track3(
      [
        ...WIND,
        [0.45, lips],
        [0.9, lips],
        [1.5, fumble],
        [2.65, fumble],
        [2.85, SPREAD_R],
        [3.0, REST_R],
      ],
      t,
    ),
    vec3(tremble, tremble * 0.7, 0),
  );
  if (t > 1.5 && t < 2.6)
    f.handR = add(f.handR, vec3(0.03 * Math.sin(t * 14), 0.03 * Math.cos(t * 11), 0));
  const dab = vec3(-0.12, 1.62, -0.1);
  f.handL = track3(
    [
      [0, REST_L],
      [1.45, REST_L],
      [1.7, dab],
      [2.6, dab],
      [2.85, SPREAD_L],
      [3.0, REST_L],
    ],
    t,
  );
  if (t > 1.7 && t < 2.6)
    f.handL = add(f.handL, vec3(0.025 * Math.sin(t * 16), 0.025 * Math.cos(t * 16), 0));
  f.pitch = track(
    [
      [0, 0],
      [0.65, 0],
      [0.7, -0.2],
      [1.5, -0.1],
      [2.6, -0.05],
      [3.0, 0],
    ],
    t,
  );
  f.roll = track(
    [
      [0, 0],
      [0.65, 0],
      [0.72, -0.15],
      [1.5, -0.1],
      [2.6, 0],
    ],
    t,
  );
  f.yaw = track(
    [
      [0, 0],
      [0.9, 0],
      [1.2, 0.35],
      [1.5, 0.35],
      [2.2, 0],
    ],
    t,
  );
  f.mouth = track([...WIND_MOUTH, [0.45, 0.1], [0.7, 0.5], [1.5, 0.3], [2.6, 0.2], [2.9, 0]], t);
  f.eyes = step<Eyes>(
    [
      [0, 'open'],
      [0.45, 'squint'],
      [0.7, 'one-shut'],
      [2.6, 'shut'],
      [2.75, 'open'],
    ],
    t,
  );
  const squash = track(
    [
      [0, 1],
      [0.45, 1],
      [0.7, 0.35],
    ],
    t,
  );
  if (t <= 0.9) {
    holdGrape(f, t, 0.9, squash);
  } else if (t < 1.3) {
    f.grape = { pos: lob(add(lips, HELD), WALL_SPOT, 2.1, (t - 0.9) / 0.4), squash: 0.35 };
  } else if (t < 2.6) {
    f.grape = { pos: vec3(WALL_SPOT.x, WALL_SPOT.y, WALL_SPOT.z), squash: 0.35 };
  } else if (t < 2.95) {
    const u = (t - 2.6) / 0.35;
    f.grape = { pos: vec3(WALL_SPOT.x, WALL_SPOT.y - 1.3 * u * u, WALL_SPOT.z), squash: 0.35 };
  }
}

const GAG_FUNCTIONS: Record<Gag, (t: number, f: KidFrame) => void> = {
  forehead,
  'under-table': underTable,
  dog,
  'face-splat': faceSplat,
  'air-chomp': airChomp,
  cheek,
  hair,
  juice,
};

/** The kid and its props `t` seconds into a gag (clamped to the gag's length). */
export function gagFrame(kind: Gag, t: number): KidFrame {
  const f = restFrame();
  GAG_FUNCTIONS[kind](clamp(t, 0, GAG_SECONDS[kind]), f);
  return finish(f);
}

/**
 * The kid eating a grape `t` seconds in (0 to EAT_SECONDS). `from` is the frame when eating began,
 * so a second grape can start in the middle of a chew.
 */
export function eatFrame(t: number, from: KidFrame): KidFrame {
  const c = clamp(t, 0, EAT_SECONDS);
  const f = restFrame();
  const settle = ramp(c, 0, 0.3);
  const rest = restFrame();
  f.handR = track3(
    [
      [0, from.handR],
      [0.12, GRAB],
      [EAT_CHOMP_AT - 0.04, MOUTH_FRONT],
      [EAT_CHOMP_AT, MOUTH_FRONT],
      [0.56, REST_R],
    ],
    c,
  );
  f.handL = lerp3(from.handL, rest.handL, settle);
  const dip = (a: number, b: number) =>
    c > a && c < b ? 0.03 * Math.sin(Math.PI * ((c - a) / (b - a))) : 0;
  f.head = lerp3(from.head, rest.head, settle);
  f.head.y -= dip(0.28, 0.42) + dip(0.42, 0.56);
  f.pitch = from.pitch * (1 - settle);
  f.yaw = from.yaw * (1 - settle);
  f.roll = from.roll * (1 - settle);
  f.mouth = track(
    [
      [0, from.mouth],
      [0.12, Math.max(from.mouth, 0.3)],
      [0.24, 1],
      [0.279, 1],
      [EAT_CHOMP_AT, 0],
      [0.35, 0.35],
      [0.42, 0],
      [0.49, 0.35],
      [0.56, 0],
    ],
    c,
  );
  const cheeks = track(
    [
      [0, 0],
      [EAT_CHOMP_AT, 0],
      [0.36, 0.8],
      [0.5, 0.8],
      [EAT_SECONDS, 0],
    ],
    c,
  );
  f.cheekR = cheeks;
  f.cheekL = cheeks;
  f.eyes = c >= 0.49 && c < 0.56 ? 'squint' : c < 0.2 ? from.eyes : 'open';
  f.look = { x: from.look.x * (1 - settle), y: from.look.y * (1 - settle) };
  if (c > 0 && c < EAT_CHOMP_AT) {
    const held = add(f.handR, HELD);
    f.grape = { pos: c < 0.12 ? lerp3(PICK_FROM, held, smooth(c / 0.12)) : held, squash: 1 };
  }
  if (c === 0) {
    // Exactly where it was: the same hands and head as the frame it starts from.
    f.handL = vec3(from.handL.x, from.handL.y, from.handL.z);
    f.head = vec3(from.head.x, from.head.y, from.head.z);
  }
  return finish(f);
}
