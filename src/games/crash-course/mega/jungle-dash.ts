/**
 * Mega course 6: Jungle Dash. A vine swing over a mud pit (a cheeky monkey steals the helmet), a
 * hop across three crocodile backs and a backflip over a roaring T. rex. Pure animation data like
 * stunts.ts: element-local coordinates (x = 0 at the element's entry line, the road at y = 0).
 *
 * Every element starts as the standard arrival pose and a cleared one ends riding on the road at
 * its `length`, so the three chain. A crash comes to rest (the rider is always fine). Slow motion
 * (`slow`) at the swing's bottom, the chomp, the T. rex peak and the crashes' worst moments.
 */
import {
  arc,
  BIKE_Y,
  createFrame,
  hipOf,
  prog,
  resetFrame,
  ride,
  rideW,
  SEAT,
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
import type { Outcome } from '../rules';
import type { MegaSpec } from './mega';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
const FLAT: Surface = () => 0;
const MUD = 0x6b4a2b;

// ---------- Element 1: Vine Swing ----------

/** Where the vine hangs from (the end of the branch), and how long it is. */
export const VINE_PIVOT = { x: 11.5, y: 6.2 };
export const VINE_LEN = 3.0;
/** The mud pit (a cut in the road, element-local) and the surface of the mud. */
export const MUD_FROM = 8;
export const MUD_TO = 16;
export const MUD_Y = -0.5;
/** The log kicker: from x 2 up to 1.2 at x 5. */
export const LOG_KICK = { from: 2, to: 5, h: 1.2 };

/** The kicker (its lip falls away over half a unit), then the flat road. */
export const logKickerSurface: Surface = (x) => {
  if (x <= LOG_KICK.from || x >= LOG_KICK.to + 0.5) return 0;
  if (x > LOG_KICK.to) return (LOG_KICK.h * (LOG_KICK.to + 0.5 - x)) / 0.5;
  const v = (x - LOG_KICK.from) / (LOG_KICK.to - LOG_KICK.from);
  return LOG_KICK.h * (0.5 * v + 0.5 * v * v);
};

const SWING = { grab: 1.15, half: 1.3, amp: 0.9, release: 0.75 };

/**
 * The vine's angle from straight down, positive forward (+x), at time t of the clear or the
 * crash. It swings back to meet the rider at `grab`, then swings forward like a pendulum (at full
 * strength to the top of the swing, then settling), and hangs still again at the end.
 */
export function vineAngle(outcome: Outcome, t: number): number {
  const { grab, half, amp } = SWING;
  if (t <= grab) return -amp * prog(t, 0.1, grab);
  const s = t - grab;
  const w = Math.PI / half;
  if (s <= half) return -amp * Math.cos(w * s);
  const k = outcome === 'crash' ? 1.1 : 0.8;
  return amp * Math.cos(w * (s - half)) * Math.exp(-k * (s - half));
}

/** When the clear's rider lets go: the swing is forward of `SWING.release`. */
const T_RELEASE = (() => {
  for (let t = SWING.grab; t < 4; t += 0.002) if (vineAngle('clear', t) >= SWING.release) return t;
  return SWING.grab + SWING.half;
})();

/** The end of the vine (where the hands are) at an angle. */
const vineEnd = (a: number, len = VINE_LEN) => ({
  x: VINE_PIVOT.x + len * Math.sin(a),
  y: VINE_PIVOT.y - len * Math.cos(a),
});

/** How far below the hands the rider's hips hang. */
const HANG = 1.15;

/** The bike when the rider hangs on the vine at angle `a`: gripped under them, pitch 0.6 a. */
function vineBike(a: number): { x: number; y: number; pitch: number; hipX: number; hipY: number } {
  const end = vineEnd(a);
  const pitch = 0.6 * a;
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const hipX = end.x;
  const hipY = end.y - HANG;
  return {
    x: hipX - (SEAT.x * c - SEAT.y * s),
    y: hipY - (SEAT.x * s + SEAT.y * c),
    pitch,
    hipX,
    hipY,
  };
}

const VINE_LIP_X = 4.5;
const VINE_LIP_T = 0.6;
const vineLip = (() => {
  const f = createFrame();
  ride(f, logKickerSurface, VINE_LIP_X);
  return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
})();
const vineLead = track([
  [0, 0, 'l'],
  [VINE_LIP_T, VINE_LIP_X, 'l'],
]);

/** The bike up the kicker and through the air to the vine (to `SWING.grab`). */
function toVine(t: number, f: Frame): void {
  if (t < VINE_LIP_T) {
    ride(f, logKickerSurface, vineLead(t), settleAt(t));
    return;
  }
  const to = vineBike(vineAngle('clear', SWING.grab));
  const u = (t - VINE_LIP_T) / (SWING.grab - VINE_LIP_T);
  f.bike.x = lerp(vineLip.x, to.x, u);
  f.bike.y = arc(vineLip.y, to.y, 3.5, u);
  f.bike.pitch = lerp(vineLip.pitch, to.pitch, prog(t, VINE_LIP_T, SWING.grab));
  f.bike.grounded = false;
  if (t > VINE_LIP_T + 0.1) f.rider.pose = 'armsUp';
}

/** The bike and rider holding the vine at time t (after the grab). */
function onVine(outcome: Outcome, t: number, f: Frame): void {
  const g = vineBike(vineAngle(outcome, t));
  f.bike.x = g.x;
  f.bike.y = g.y;
  f.bike.pitch = g.pitch;
  f.bike.grounded = false;
  f.rider.pose = 'armsUp';
}

const clear1: Def = (() => {
  const duration = 3.6;
  const tLand = 3.0;
  const xLand = 18.5;
  const hop = (() => {
    const g = vineBike(vineAngle('clear', T_RELEASE));
    return { x: g.x, y: g.y, pitch: g.pitch };
  })();
  const roll = track([
    [tLand, xLand],
    [duration, 24, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < SWING.grab) {
      toVine(t, f);
    } else if (t < T_RELEASE) {
      onVine('clear', t, f);
    } else if (t < tLand) {
      const u = (t - T_RELEASE) / (tLand - T_RELEASE);
      f.bike.x = lerp(hop.x, xLand, u);
      f.bike.y = arc(hop.y, BIKE_Y, 3.4, u);
      f.bike.pitch = lerp(hop.pitch, 0, prog(t, T_RELEASE, tLand));
      f.bike.grounded = false;
      f.rider.pose = 'armsUp';
    } else {
      ride(f, FLAT, roll(t));
      f.bike.squash = 1 - 0.15 * bump(t, tLand + 0.05, 0.1);
      if (t < duration - 0.2) f.rider.pose = 'thumbs';
    }
  };
  return {
    duration,
    word: 'TARZAN!',
    beats: {
      lip: VINE_LIP_T,
      grab: SWING.grab,
      bottom: SWING.grab + SWING.half / 2,
      off: T_RELEASE,
    },
    slow: [SWING.grab + SWING.half / 2],
    at,
    events: () => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [VINE_LIP_T, 'sfx:whoosh', VINE_LIP_X, 2],
      [SWING.grab, 'sfx:whoosh', 9.3, 3.4],
      [SWING.grab + SWING.half / 2, 'word', 11.5, 5.2],
      [tLand, 'dust', xLand, 0.1],
      [tLand, 'sfx:bump', xLand, 0.4],
      [duration * 0.95, 'cheer', 23, 2],
    ],
  };
})();

/** The monkey's moments in the crash. */
const MONKEY = { slide: 0.45, grab: 1.4, climb: 1.65, top: 2.45, toss: 3.7 };
/** Where the monkey hangs on the branch before it slides (its seat; the vine is beside it). */
export const MONKEY_REST = { x: VINE_PIVOT.x - 0.4, y: VINE_PIVOT.y - 1.15 };
/** How far along the vine the monkey's seat is at the top, and when it reaches the helmet. */
const SEAT_TOP = 0.9;
const SEAT_REACH = 2.45;

const crash1: Def = (() => {
  const duration = 4.4;
  const tLet = MONKEY.grab + 0.1;
  const tMud = 2.1;
  const mudBike = { x: 10.4, y: MUD_Y - 0.1 };
  const mudRider = { x: 11.7, y: MUD_Y - 0.15 };
  const letGo = vineBike(vineAngle('crash', tLet));
  const bike = route([
    [tLet, letGo.x, letGo.y],
    [tMud, mudBike.x, mudBike.y, letGo.y + 0.2],
  ]);
  const sink = track([
    [tMud, 0],
    [tMud + 0.5, 1, 'o'],
  ]);
  const rider = route([
    [tLet, letGo.hipX, letGo.hipY],
    [tMud, mudRider.x, mudRider.y, letGo.hipY + 0.3],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < SWING.grab) {
      toVine(t, f);
      return;
    }
    if (t < tLet) {
      onVine('crash', t, f);
      f.rider.face = t >= MONKEY.grab - 0.25 ? 'scared' : 'happy';
    } else {
      const sunk = sink(t);
      const q = bike(t);
      f.bike.x = q.x;
      f.bike.y = q.y - 0.25 * sunk;
      f.bike.pitch = lerp(letGo.pitch, -0.35, prog(t, tLet, tMud)) + 0.15 * sunk;
      f.bike.squash = 1 - 0.15 * bump(t, tMud + 0.05, 0.1);
      f.bike.grounded = false;
      const r = rider(t);
      const landed = t >= tMud;
      setFree(
        f,
        r.x,
        landed ? mudRider.y : r.y,
        landed ? 0 : -0.5 * Math.sin(Math.PI * prog(t, tLet, tMud, 'l')),
        landed ? 'sit' : 'flail',
        landed ? 'dizzy' : 'scared',
      );
      f.rider.coat = landed ? 'mud' : 'none';
    }
    f.rider.helmet = !(t >= MONKEY.grab && t < duration - 0.1);
  };
  return {
    duration,
    word: 'MONKEY BUSINESS!',
    beats: { lip: VINE_LIP_T, vine: SWING.grab, grab: MONKEY.grab, mud: tMud, toss: MONKEY.toss },
    slow: [MONKEY.grab],
    at,
    events: () => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [VINE_LIP_T, 'sfx:whoosh', VINE_LIP_X, 2],
      [MONKEY.grab, 'sfx:monkey', 10, 5],
      [MONKEY.grab, 'word', 16.5, 4.8],
      [tMud, 'splash', mudRider.x, MUD_Y, MUD],
      [tMud + 0.1, 'splash', mudBike.x, MUD_Y, MUD],
      [tMud, 'sfx:splat', mudRider.x, MUD_Y],
      [tMud, 'groan', mudRider.x, 1],
      [MONKEY.top + 0.1, 'sfx:monkey', VINE_PIVOT.x, VINE_PIVOT.y],
      [3.1, 'stars', mudRider.x, 1.0],
    ],
  };
})();

/** The monkey at time t of the clear (it hangs on the branch and claps) or the crash. */
export function monkeyAt(
  outcome: Outcome,
  t: number,
  out: Piece = { x: 0, y: 0, rot: 0, scale: 1, visible: true },
): Piece {
  out.scale = 1;
  out.visible = true;
  out.x = MONKEY_REST.x;
  out.y = MONKEY_REST.y;
  out.rot = 0;
  if (outcome === 'clear') return out;
  const f =
    t < MONKEY.grab ? prog(t, MONKEY.slide, MONKEY.grab) : 1 - prog(t, MONKEY.climb, MONKEY.top);
  if (f > 0) {
    const a = vineAngle('crash', t);
    const p = vineEnd(a, lerp(SEAT_TOP, SEAT_REACH, f));
    // It hops from the branch onto the vine in the first moments of the slide.
    const on = prog(f, 0, 0.12);
    out.x = lerp(MONKEY_REST.x, p.x, on);
    out.y = lerp(MONKEY_REST.y, p.y, on);
    out.rot = a * on;
  }
  return out;
}

/** Where the rider's head ends up in the mud (the helmet is tossed onto it). */
export const HEAD_END = { x: 11.7, y: MUD_Y - 0.15 + 1.05 };

/** The monkey's copy of the helmet: hidden, in its hand, then tossed back onto the rider. */
export function stolenHelmetAt(
  outcome: Outcome,
  t: number,
  out: Piece = { x: 0, y: 0, rot: 0, scale: 1, visible: false },
): Piece {
  out.scale = 1;
  out.rot = 0;
  out.x = VINE_PIVOT.x;
  out.y = VINE_PIVOT.y;
  out.visible = false;
  if (outcome === 'clear') return out;
  const d = crash1.duration;
  if (t < MONKEY.grab || t >= d - 0.1) return out;
  out.visible = true;
  if (t < MONKEY.toss) {
    const m = monkeyAt('crash', t);
    // Held up in the monkey's hand, waving once it is back on the branch.
    const wave = t >= MONKEY.top ? 0.15 * Math.sin(14 * (t - MONKEY.top)) : 0;
    out.x = m.x + 0.5;
    out.y = m.y + 0.65 + wave;
    return out;
  }
  const home = monkeyAt('crash', MONKEY.toss);
  const u = (t - MONKEY.toss) / (d - 0.1 - MONKEY.toss);
  out.x = lerp(home.x + 0.5, HEAD_END.x, prog(t, MONKEY.toss, d - 0.1, 'l'));
  out.y = arc(home.y + 0.65, HEAD_END.y, 6.6, u);
  out.rot = -TAU * u;
  return out;
}

// ---------- Element 2: Croc River ----------

/** Where the three crocodiles float (their middles), how long each is and how high their backs are. */
export const CROC_X: readonly [number, number, number] = [7, 11, 15];
export const CROC_LEN = 3.2;
export const CROC_TOP = 0.15;
/** The surface of the river. */
export const RIVER_Y = -0.35;
/** The river is a cut in the road from x 4 to x 18. */
export const RIVER_FROM = 4;
export const RIVER_TO = 18;

/** When the bike's front lands on each croc and on the far bank, and the time of each take-off. */
const HOP_FROM = [0.4, 0.9, 1.4, 1.9] as const;
const HOP_TO = [0.85, 1.35, 1.85, 2.35] as const;
/** The bike's x at each take-off and landing (the hops are 4 apart). */
const HOP_X0 = [3.2, 7.4, 11.4, 15.4] as const;
const HOP_X1 = [7.0, 11.0, 15.0, 18.9] as const;
const HOP_PEAK = CROC_TOP + BIKE_Y + 1.6;
/** The crash: the chomp (the jaw snaps shut on the front wheel) and the splash. */
const CHOMP = { t: 1.15, x: 8.85, y: 0.9, pitch: -0.5 };
const T_SPLASH = 1.9;
const SPLASH_AT = { x: 13, y: RIVER_Y + 0.15 };
const T_SURFACE = 2.4;
const SIT_AT = { x: 14.1, y: CROC_TOP + 0.3 };

const crocRest = (i: 0 | 1 | 2) => CROC_X[i];

/** A dip of up to 0.3 as the bike lands at time `lands`: down fast, then back up. */
function dipAt(t: number, lands: number): number {
  const u = t - lands;
  if (u < 0) return 0;
  if (u < 0.08) return (0.3 * u) / 0.08;
  return 0.3 * Math.exp(-(u - 0.08) * 4);
}

/** When each croc is landed on, in the clear and the crash (the crash's second is the chomp). */
const LANDS: Record<Outcome, readonly [number, number, number]> = {
  clear: [HOP_TO[0], HOP_TO[1], HOP_TO[2]],
  crash: [HOP_TO[0], CHOMP.t, T_SURFACE + 0.25],
};

/** How far croc `i` has sunk (0 to 0.3) when the bike lands on it. */
export function crocDip(outcome: Outcome, i: number, t: number): number {
  const k = Math.min(Math.max(Math.round(i), 0), 2);
  const d = dipAt(t, LANDS[outcome][k]);
  return outcome === 'crash' && k === 1 ? d * 0.5 : d;
}

/** The opening of croc `i`'s jaw (0 shut to 0.9 wide): only the crash's croc 1 ever opens. */
export function crocJaw(outcome: Outcome, i: number, t: number): number {
  if (outcome !== 'crash' || Math.round(i) !== 1) return 0;
  // It opens as the bike hops towards it, snaps shut on the wheel and stays clamped.
  if (t < CHOMP.t) return 0.9 * prog(t, 0.5, CHOMP.t - 0.1);
  return lerp(0.9, 0.12, prog(t, CHOMP.t - 0.1, CHOMP.t, 'o'));
}

/** Where croc `i` floats: croc 2 slides back to meet the rider in the crash. */
export function crocX(outcome: Outcome, i: number, t: number): number {
  const k = Math.min(Math.max(Math.round(i), 0), 2) as 0 | 1 | 2;
  if (outcome === 'crash' && k === 2) return lerp(CROC_X[2], SIT_AT.x, prog(t, 1.5, T_SURFACE));
  return crocRest(k);
}

/** The top of croc `i`'s back where the bike rides it, in the clear or the crash. */
const backY = (outcome: Outcome, i: 0 | 1 | 2, t: number) =>
  CROC_TOP + BIKE_Y - crocDip(outcome, i, t);

const hopX = track([
  [0, 0, 'l'],
  ...HOP_FROM.flatMap((a, j): [number, number, 'l'][] => [
    [a, HOP_X0[j], 'l'],
    [HOP_TO[j], HOP_X1[j], 'l'],
  ]),
  [2.75, 22, 'l'],
]);
/** Nose up at each take-off, level at the top, nose down onto the next back. */
const hopPitch = track([
  [0, 0, 'l'],
  ...HOP_FROM.flatMap((a, j): [number, number, 'l'][] => [
    [a, 0.15, 'l'],
    [(a + HOP_TO[j]) / 2, 0, 'l'],
    [HOP_TO[j], -0.2, 'l'],
    [HOP_TO[j] + 0.05, 0, 'l'],
  ]),
]);

const clear2: Def = (() => {
  const duration = 2.75;
  const at = (t: number, f: Frame) => {
    f.bike.x = hopX(t);
    f.bike.pitch = hopPitch(t);
    f.bike.grounded = false;
    f.rider.pose = t > 0.45 && t < duration - 0.3 ? 'armsUp' : 'ride';
    if (t < HOP_FROM[0]) {
      f.bike.y = BIKE_Y;
      f.bike.pitch = 0;
      f.bike.grounded = true;
      return;
    }
    for (let j = 0; j < 4; j++) {
      const a = HOP_FROM[j];
      const b = HOP_TO[j];
      const from = j === 0 ? BIKE_Y : backY('clear', (j - 1) as 0 | 1 | 2, a);
      const to = j === 3 ? BIKE_Y : backY('clear', j as 0 | 1 | 2, b);
      if (t >= a && t < b) {
        f.bike.y = arc(from, to, HOP_PEAK, (t - a) / (b - a));
        return;
      }
      if (j < 3 && t >= b && t < HOP_FROM[j + 1]) {
        f.bike.y = backY('clear', j as 0 | 1 | 2, t);
        f.bike.squash = 1 - 0.1 * bump(t, b + 0.02, 0.08);
        return;
      }
    }
    // The far bank: roll on.
    f.bike.y = BIKE_Y;
    f.bike.grounded = true;
    f.bike.squash = 1 - 0.15 * bump(t, HOP_TO[3] + 0.02, 0.1);
    f.bike.pitch = hopPitch(t) * 0;
    if (t < duration - 0.2) f.rider.pose = 'thumbs';
  };
  return {
    duration,
    word: 'SNAP HOP!',
    beats: { hop1: HOP_TO[0], hop2: HOP_TO[1], hop3: HOP_TO[2], bank: HOP_TO[3] },
    slow: [(HOP_FROM[1] + HOP_TO[1]) / 2],
    at,
    events: () => [
      [0.2, 'sfx:whoosh', 2, 0.5],
      ...([0, 1, 2] as const).flatMap((i): Ev[] => [
        [HOP_TO[i], 'sfx:boing', CROC_X[i], 0.6],
        [HOP_TO[i], 'splash', CROC_X[i] - 1.6, RIVER_Y],
      ]),
      [1.0, 'word', 11, 4.2],
      [HOP_TO[3], 'dust', HOP_X1[3], 0.1],
      [duration * 0.95, 'cheer', 21, 2],
    ],
  };
})();

const crash2: Def = (() => {
  const duration = 3.8;
  const tOff = HOP_FROM[1];
  // The bike hops off croc 0 to the open jaw and stops dead.
  const toJaw = route([
    [tOff, HOP_X0[1], backY('crash', 0, tOff)],
    [CHOMP.t, CHOMP.x, CHOMP.y, 1.5],
  ]);
  const seat = hipOf(CHOMP.x, CHOMP.y, CHOMP.pitch);
  const flung = route([
    [CHOMP.t, seat.x, seat.y],
    [T_SPLASH, SPLASH_AT.x, SPLASH_AT.y, 3.6],
  ]);
  const flungRot = track([
    [CHOMP.t, 0],
    [T_SPLASH, -TAU, 'io'],
  ]);
  const sunkY = track([
    [T_SPLASH, SPLASH_AT.y],
    [T_SPLASH + 0.15, -1.0, 'o'],
    [T_SURFACE, -1.0, 'l'],
    [T_SURFACE + 0.45, SIT_AT.y, 'o'],
  ]);
  const sitX = track([
    [T_SPLASH, SPLASH_AT.x],
    [T_SURFACE, 13.5, 'l'],
    [T_SURFACE + 0.45, SIT_AT.x, 'o'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < HOP_FROM[0]) {
      f.bike.x = hopX(t);
      return;
    }
    if (t < tOff) {
      f.bike.x = hopX(t);
      f.bike.grounded = false;
      f.rider.pose = 'armsUp';
      const a = HOP_FROM[0];
      const b = HOP_TO[0];
      if (t < b) {
        f.bike.y = arc(BIKE_Y, backY('crash', 0, b), HOP_PEAK, (t - a) / (b - a));
        f.bike.pitch = hopPitch(t);
      } else {
        f.bike.y = backY('crash', 0, t);
        f.bike.pitch = hopPitch(t);
        f.bike.squash = 1 - 0.1 * bump(t, b + 0.02, 0.08);
      }
      return;
    }
    if (t < CHOMP.t) {
      const q = toJaw(t);
      f.bike.x = q.x;
      f.bike.y = q.y;
      f.bike.pitch = lerp(0.15, CHOMP.pitch, prog(t, tOff, CHOMP.t));
      f.bike.grounded = false;
      f.bike.z = 0.35 * prog(t, tOff, CHOMP.t);
      f.rider.pose = 'armsUp';
      f.rider.face = 'scared';
      return;
    }
    // Stopped dead in the jaws, with a shudder that dies away.
    f.bike.x = CHOMP.x - 0.05 * bump(t, CHOMP.t, 0.12);
    f.bike.y = CHOMP.y;
    f.bike.pitch = CHOMP.pitch;
    f.bike.z = 0.35;
    f.bike.squash = 1 - 0.2 * bump(t, CHOMP.t + 0.04, 0.1);
    f.bike.grounded = false;
    if (t < T_SPLASH) {
      const r = flung(t);
      setFree(f, r.x, r.y, flungRot(t), 'flail', 'scared');
    } else if (t < T_SURFACE) {
      setFree(f, sitX(t), sunkY(t), -TAU, 'flail', 'scared');
      f.rider.visible = t < T_SPLASH + 0.1;
    } else {
      setFree(f, sitX(t), sunkY(t), -TAU, t >= T_SURFACE + 0.45 ? 'sit' : 'flail', 'dizzy');
    }
  };
  return {
    duration,
    word: 'CHOMP!',
    beats: { jaw: 0.5, chomp: CHOMP.t, splash: T_SPLASH, surface: T_SURFACE },
    slow: [CHOMP.t],
    at,
    events: () => [
      [0.2, 'sfx:whoosh', 2, 0.5],
      [HOP_TO[0], 'sfx:boing', CROC_X[0], 0.6],
      [HOP_TO[0], 'splash', CROC_X[0] - 1.6, RIVER_Y],
      [CHOMP.t, 'sfx:bump', CHOMP.x + 0.7, 0.6],
      [CHOMP.t, 'sfx:crash', CHOMP.x + 0.7, 0.6],
      [CHOMP.t, 'spark', CHOMP.x + 0.7, 0.6],
      [CHOMP.t + 0.05, 'word', 10, 3.6],
      [T_SPLASH, 'splash', SPLASH_AT.x, RIVER_Y],
      [T_SPLASH + 0.1, 'splash', SPLASH_AT.x + 0.5, RIVER_Y],
      [T_SPLASH, 'sfx:splash', SPLASH_AT.x, RIVER_Y],
      [T_SPLASH, 'groan', SPLASH_AT.x, 1.2],
      [T_SURFACE + 0.45, 'poof', SIT_AT.x, SIT_AT.y],
      [3.0, 'stars', SIT_AT.x, 2.0],
    ],
  };
})();

// ---------- Element 3: T. rex Jump (the finale) ----------

/** The log ramp: flat to x 2, then stacked logs up to 2.4 at x 8 (a lip), then the road again. */
export const logRamp: Surface = (x) => {
  if (x <= 2) return 0;
  if (x <= 8) {
    const v = (x - 2) / 6;
    return 2.4 * (0.5 * v + 0.5 * v * v);
  }
  if (x < 8.4) return (2.4 * (8.4 - x)) / 0.4;
  return 0;
};
/** The T. rex stands in the lane's back row (the bike and rider pass in front of it). */
export const REX = { x: 14, z: -1.0 };
/** Where its tiny arms hold the dangling rider's hands. */
export const REX_ARMS = { x: 12.9, y: 2.0 };
/** Its head's pivot, for turning towards the bike. */
export const REX_HEAD = { x: 12.4, y: 2.4 };

/** The height of the T. rex at x: head 11 to 13.2 (top 3.0), back 13.2 to 16 at 2.4, tail to 20. */
export function rexTop(x: number): number {
  if (x < 11 || x > 20) return 0;
  if (x < 11.6) return lerp(1.4, 2.2, (x - 11) / 0.6);
  if (x < 12.2) return lerp(2.2, 3.0, (x - 11.6) / 0.6);
  if (x <= 12.9) return 3.0;
  if (x < 13.2) return lerp(3.0, 2.4, (x - 12.9) / 0.3);
  if (x <= 16) return 2.4;
  return lerp(2.0, 0.8, (x - 16) / 4);
}

const LIP_X = 7.2;
const rexLaunch = (() => {
  const f = createFrame();
  ride(f, logRamp, LIP_X);
  return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
})();

const clear3: Def = (() => {
  const duration = 3.7;
  const tLip = 0.9;
  const tLand = 2.8;
  const xLand = 21.5;
  const xPeak = 14.5;
  const land = (() => {
    const f = createFrame();
    rideW(f, FLAT, xLand, 0.35);
    return { x: f.bike.x, y: f.bike.y, pitch: f.bike.pitch };
  })();
  const flightY = pchip([rexLaunch.x, xPeak, land.x], [rexLaunch.y, 4.5, land.y]);
  const tPeak = tLip + ((xPeak - rexLaunch.x) / (land.x - rexLaunch.x)) * (tLand - tLip);
  const lead = track([
    [0, 0, 'l'],
    [tLip, LIP_X, 'l'],
  ]);
  const xm = track([
    [tLand, xLand],
    [duration, 28, 'l'],
  ]);
  const w = track([
    [tLand, 0.35],
    [3.2, 0.35, 'l'],
    [3.5, 0],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, logRamp, lead(t), settleAt(t));
    } else if (t < tLand) {
      const u = (t - tLip) / (tLand - tLip);
      f.bike.x = lerp(rexLaunch.x, land.x, u);
      f.bike.y = flightY(f.bike.x);
      // Nose up off the lip, then one whole backflip mostly over the back and tail (x 14 to 19).
      const flip = flipEase((f.bike.x - 14) / 5.2);
      f.bike.pitch = lerp(rexLaunch.pitch, land.pitch, prog(t, tLip, tLand)) + TAU * flip;
      f.bike.grounded = false;
      f.rider.pose = flip >= 0.98 ? 'armsUp' : 'duck';
    } else {
      rideW(f, FLAT, xm(t), w(t));
      f.bike.pitch += TAU;
      f.bike.squash = 1 - 0.15 * bump(t, tLand + 0.05, 0.1);
      f.bike.grounded = w(t) < 0.05;
      if (w(t) > 0.2) f.rider.pose = 'wheelie';
      else if (t < duration - 0.2) f.rider.pose = 'thumbs';
    }
  };
  return {
    duration,
    word: 'DINO-MITE!',
    beats: { launch: tLip, peak: tPeak, land: tLand },
    slow: [tPeak],
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [tLip, 'sfx:roar', REX_HEAD.x, REX_HEAD.y],
      [tLip, 'sfx:whoosh', LIP_X, 2.6],
      ...trail(tLip + 0.1, tLand - 0.1, 0.14, 'spark', bike),
      [tPeak, 'word', xPeak, 5.8],
      [tLand, 'dust', xLand, 0.1],
      [tLand, 'confetti', xLand, 2.0],
      [tLand + 0.1, 'confetti', xLand + 1, 2.4],
      [tLand, 'sfx:chime', xLand, 1],
      [duration * 0.96, 'cheer', 26, 2],
    ],
  };
})();

const crash3: Def = (() => {
  const duration = 4.4;
  const tLip = 0.8;
  const tLand = 1.5;
  const tArms = 2.0;
  const tDrop = 3.2;
  const tSit = 3.4;
  const hit = { x: 12.2, y: rexTop(12.2) + BIKE_Y };
  const lead = track([
    [0, 0, 'l'],
    [tLip, LIP_X, 'l'],
  ]);
  const slide = route([
    [tLand, hit.x, hit.y],
    [1.85, 11.5, rexTop(11.5) + BIKE_Y],
    [2.4, 10.0, BIKE_Y, 2.9],
  ]);
  const pitch = track([
    [tLip, rexLaunch.pitch],
    [tLand, 0.15],
    [1.85, -0.5],
    [2.4, -0.2],
    [2.6, 0],
  ]);
  const roll = track([
    [1.7, 0],
    [2.5, Math.PI / 2],
  ]);
  const seatAtHit = hipOf(hit.x, hit.y, 0.15);
  const fall = route([
    [tLand, seatAtHit.x, seatAtHit.y],
    [tArms, REX_ARMS.x, REX_ARMS.y - 1.1, seatAtHit.y + 0.3],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tLip) {
      ride(f, logRamp, lead(t), settleAt(t));
      return;
    }
    if (t < tLand) {
      const u = (t - tLip) / (tLand - tLip);
      f.bike.x = lerp(rexLaunch.x, hit.x, u);
      f.bike.y = arc(rexLaunch.y, hit.y, 3.9, u);
      f.bike.pitch = pitch(t);
      f.bike.grounded = false;
      f.rider.face = 'scared';
      return;
    }
    const q = slide(t);
    f.bike.x = q.x;
    f.bike.y = q.y;
    f.bike.pitch = pitch(t);
    f.bike.roll = roll(t);
    f.bike.grounded = false;
    f.bike.squash = 1 - 0.2 * bump(t, tLand + 0.05, 0.12);
    if (t < tArms) {
      const r = fall(t);
      setFree(
        f,
        r.x,
        r.y,
        -0.6 * Math.sin(Math.PI * prog(t, tLand, tArms, 'l')) + 0.0997 * prog(t, tLand, tArms, 'l'),
        'flail',
        'scared',
      );
    } else if (t < tDrop) {
      const s = t - tArms;
      setFree(
        f,
        REX_ARMS.x + 0.12 * Math.sin(s * 4) * Math.exp(-s * 0.4),
        REX_ARMS.y - 1.1,
        0.1 * Math.sin(s * 4 + 1.5) * Math.exp(-s * 0.4),
        'dangle',
        'scared',
      );
    } else {
      const u = prog(t, tDrop, tSit, 'q');
      setFree(
        f,
        REX_ARMS.x,
        lerp(REX_ARMS.y - 1.1, 0.25, u),
        0,
        t >= tSit ? 'sit' : 'dangle',
        t >= tSit ? 'dizzy' : 'scared',
      );
    }
  };
  return {
    duration,
    word: 'DINO DANGLE!',
    beats: { launch: tLip, land: tLand, arms: tArms, drop: tDrop, sit: tSit },
    slow: [tLand],
    at,
    events: () => [
      [0.3, 'sfx:whoosh', 2, 0.5],
      [tLip, 'sfx:whoosh', LIP_X, 2.6],
      [tLand, 'sfx:bump', hit.x, hit.y],
      [tLand, 'poof', hit.x, hit.y + 0.2],
      [tLand + 0.05, 'sfx:roar', REX_HEAD.x, REX_HEAD.y],
      [tLand + 0.05, 'groan', hit.x, 3.6],
      [tLand + 0.05, 'word', 10, 5.2],
      [2.45, 'dust', 10, 0.2],
      [2.6, 'sweat', REX_ARMS.x, REX_ARMS.y],
      [tSit, 'poof', REX_ARMS.x, 0.3],
      [tSit, 'sfx:boing', REX_ARMS.x, 0.3],
      [tSit + 0.1, 'stars', REX_ARMS.x, 1.6],
    ],
  };
})();

const scratch = createFrame();

/**
 * The T. rex's head at time t of the clear or the crash: `turn` is how far it pitches towards the
 * bike (radians, positive looks up, within +-0.8), `jaw` how wide it is open (0 to 0.7, open while
 * it roars) and `shake` a side-to-side turn (the crash shakes its head).
 */
export function rexHead(outcome: Outcome, t: number): { turn: number; jaw: number; shake: number } {
  const def = outcome === 'clear' ? clear3 : crash3;
  const time = clamp(Number.isNaN(t) ? 0 : t, 0, def.duration);
  resetFrame(scratch);
  def.at(time, scratch);
  const target = scratch.rider.mode === 'free' ? scratch.rider : scratch.bike;
  const turn = clamp(
    Math.atan2(target.y - REX_HEAD.y, Math.max(REX_HEAD.x - target.x, 0.5)),
    -0.8,
    0.8,
  );
  if (outcome === 'clear') {
    const roar = def.beats.launch;
    const jaw = 0.7 * (prog(time, roar - 0.2, roar + 0.1) - prog(time, roar + 1.2, roar + 1.8));
    return { turn, jaw, shake: 0 };
  }
  const land = def.beats.land;
  const jaw = 0.7 * (prog(time, land, land + 0.15) - prog(time, land + 1.2, land + 1.6));
  const s = time - land;
  const shake = s > 0 && s < 1.6 ? 0.5 * Math.sin(14 * s) * (1 - prog(s, 0.8, 1.6, 'l')) : 0;
  return { turn, jaw, shake };
}

// ---------- The course ----------

export const JUNGLE_DASH: MegaSpec = {
  id: 'jungle-dash',
  title: 'Jungle Dash',
  emoji: '🦖',
  elements: [
    {
      name: 'Vine Swing',
      length: 24,
      floorY: -1.2,
      height: 6.4,
      cuts: [[MUD_FROM, MUD_TO]],
      clear: clear1,
      crash: crash1,
    },
    {
      name: 'Croc River',
      length: 22,
      floorY: -1.4,
      height: 5.0,
      cuts: [[RIVER_FROM, RIVER_TO]],
      clear: clear2,
      crash: crash2,
    },
    {
      name: 'T. rex Jump',
      length: 28,
      floorY: 0,
      height: 6.2,
      cuts: [],
      clear: clear3,
      crash: crash3,
    },
  ],
};
