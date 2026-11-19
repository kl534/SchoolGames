/**
 * Mega course 2, Dino Lagoon's Raptor Rapids: slide over the bowed neck of a Brachiosaurus, hop
 * across the three plates of a Stegosaurus and double backflip over the open jaws of a T. rex.
 * Every wipeout ends in a splash. Pure animation data like `sweet-tooth-rush.ts`: element-local
 * coordinates, `d` = 0 at the element's entry line, `y` up from the water, `s` sideways (+ is the
 * rider's right).
 */
import {
  TAU,
  arc,
  lerp,
  prog,
  seatAtTime,
  setFree,
  smooth,
  track,
  trail,
  type Def,
  type Frame,
  type Pos,
} from '../anim';
import { ENTRY_SPEED } from '../rules';
import { flipEase, slopeAt } from './anim';
import type { MegaSpec } from './mega';

const SPEED = ENTRY_SPEED;
const FLOAT_Y = -0.3;
const FLAT_Y = -0.05;

/** A rider thrown clear: flies to (d, s) in `fly` seconds from `t0`, splashes, then floats up. */
interface Fling {
  t0: number;
  fly: number;
  from: Pos & { pitch: number };
  d: number;
  s: number;
  peak: number;
  turn: number;
}

/** When the thrown rider lands and when he is floating. */
const splatOf = (a: Fling) => a.t0 + a.fly;
const floatOf = (a: Fling) => splatOf(a) + 0.5;

function flung(f: Frame, t: number, a: Fling): void {
  if (t < a.t0) return;
  if (t < splatOf(a)) {
    const u = (t - a.t0) / a.fly;
    setFree(
      f,
      lerp(a.from.d, a.d, u),
      arc(a.from.y, FLAT_Y, a.peak, u),
      lerp(a.from.s, a.s, u),
      lerp(a.from.pitch, a.turn, flipEase(u)),
      0,
      0,
      u < 0.2 ? 'flail' : u < 0.85 ? 'tuck' : 'float',
      'scared',
    );
    return;
  }
  const up = prog(t, splatOf(a), floatOf(a), 'o');
  setFree(f, a.d, lerp(FLAT_Y, FLOAT_Y, up), a.s, a.turn, 0, 0, 'float', 'soaked');
}

// ---------- Element 1: the Brachiosaurus neck slide ----------

/**
 * A long neck bows across the course: the ski rides up its back from the water at `foot` to the
 * crest at `top`, slides down to the head at `head` and flies off its nose.
 */
export const NECK = {
  foot: 4.5,
  top: 13.5,
  topY: 4.5,
  head: 23,
  headY: 1.2,
  /** The clear lands here. */
  land: 30,
  halfWidth: 1.8,
  /** Where the slow ski stalls, and when the sneeze comes. */
  stall: 10.4,
};

/** Height of the neck's back on the middle line at `d`. */
export function neckY(d: number): number {
  const { foot, top, topY, head, headY } = NECK;
  if (d <= foot) return 0;
  if (d <= top) return topY * smooth((d - foot) / (top - foot));
  return d <= head ? lerp(topY, headY, smooth((d - top) / (head - top))) : headY;
}

export const T_CREST = NECK.top / SPEED;
export const T_HEAD = NECK.head / SPEED;
export const T_SNEEZE = 1.5;
const LENGTH1 = 42;
const SNEEZE = { flick: 1.0, skiD: 11.8, skiS: -6.5, riderD: 12.5, riderS: 4.5, flyT: 1.15 };
export { SNEEZE };

const neckRide = (d: number, f: Frame) => {
  const k = f.ski;
  k.d = d;
  k.y = neckY(d);
  k.pitch = Math.atan(slopeAt(neckY, Math.min(Math.max(d, 0.02), NECK.head - 0.02)));
  k.wet = d < NECK.foot;
};

const neckClear: Def = (() => {
  const tLand = NECK.land / SPEED;
  const pitchHead = Math.atan(slopeAt(neckY, NECK.head - 0.02));
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_HEAD) {
      neckRide(SPEED * t, f);
      f.rider.pose = SPEED * t < NECK.foot ? 'ride' : 'fistPump';
    } else if (t < tLand) {
      // Off the nose of the head with a spray.
      const u = (t - T_HEAD) / (tLand - T_HEAD);
      k.d = lerp(NECK.head, NECK.land, u);
      k.y = arc(NECK.headY, 0, 2.8, u);
      k.pitch = pitchHead * (1 - prog(u, 0, 0.5));
      k.wet = false;
      f.rider.pose = 'fistPump';
    } else {
      k.d = Math.min(NECK.land + SPEED * (t - tLand), LENGTH1);
      k.y = 0;
      f.rider.pose = t < tLand + 0.5 ? 'fistPump' : 'ride';
    }
  };
  return {
    duration: tLand + (LENGTH1 - NECK.land) / SPEED,
    length: LENGTH1,
    word: 'NECK SLIDE!',
    at,
    events: () => [
      [NECK.foot / SPEED - 0.3, 'sfx:whoosh', NECK.foot - 2, 1],
      [T_CREST, 'word', NECK.top, NECK.topY + 1.8],
      [T_HEAD, 'sfx:whoosh', NECK.head, NECK.headY],
      [T_HEAD, 'spray', NECK.head, NECK.headY],
      [tLand, 'splash', NECK.land, 0],
      [tLand, 'sfx:splash', NECK.land, 0],
      [tLand + 0.2, 'cheer', NECK.land + 2, 1],
    ],
  };
})();

const neckFail: Def = (() => {
  const tA = 7 / SPEED;
  const slow = track([
    [tA, 7],
    [T_SNEEZE, NECK.stall, 'o'],
  ]);
  const y0 = neckY(NECK.stall);
  const pitch0 = Math.atan(slopeAt(neckY, NECK.stall));
  const tWater = T_SNEEZE + SNEEZE.flick;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_SNEEZE) {
      neckRide(t <= tA ? SPEED * t : slow(t), f);
    } else if (t < tWater) {
      // The sneeze flicks the ski off the side of the neck.
      const u = (t - T_SNEEZE) / SNEEZE.flick;
      k.d = lerp(NECK.stall, SNEEZE.skiD, u);
      k.s = SNEEZE.skiS * prog(u, 0, 1, 'o');
      k.y = arc(y0, 0, y0 + 2.8, u);
      k.pitch = pitch0 * (1 - prog(u, 0, 0.3));
      k.roll = TAU * prog(u, 0.1, 0.9);
      k.wet = false;
    } else {
      k.d = SNEEZE.skiD;
      k.s = SNEEZE.skiS;
      k.y = 0;
      k.roll = TAU;
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, T_SNEEZE);
  const fling: Fling = {
    t0: T_SNEEZE,
    fly: SNEEZE.flyT,
    from: s0,
    d: SNEEZE.riderD,
    s: SNEEZE.riderS,
    peak: 6.2,
    turn: 2 * TAU,
  };
  return {
    duration: floatOf(fling) + 1.0,
    word: 'SNEEZE!',
    at: (t, f) => {
      skiAt(t, f);
      if (t >= T_SNEEZE - 0.25 && t < T_SNEEZE) f.rider.face = 'scared';
      flung(f, t, fling);
    },
    events: (_ski, rider) => [
      [NECK.foot / SPEED - 0.3, 'sfx:whoosh', NECK.foot - 2, 1],
      [T_SNEEZE - 0.05, 'spray', NECK.head, NECK.headY + 1],
      [T_SNEEZE, 'spray', NECK.head - 1, NECK.headY + 1.4, 0.8],
      [T_SNEEZE, 'spray', NECK.head - 1, NECK.headY + 1.4, -0.8],
      [T_SNEEZE, 'sfx:slideWhistle', NECK.stall, y0 + 1],
      ...trail(T_SNEEZE + 0.3, splatOf(fling) - 0.2, 0.3, 'drips', rider),
      [tWater, 'splash', SNEEZE.skiD, 0.2, SNEEZE.skiS],
      [splatOf(fling), 'bigSplash', SNEEZE.riderD, 0.2, SNEEZE.riderS],
      [splatOf(fling), 'sfx:splat', SNEEZE.riderD, 0, SNEEZE.riderS],
      [splatOf(fling), 'sfx:splash', SNEEZE.riderD, 0, SNEEZE.riderS],
      [splatOf(fling), 'groan', SNEEZE.riderD, 1, SNEEZE.riderS],
      [splatOf(fling) + 0.1, 'word', SNEEZE.riderD, 3.4, SNEEZE.riderS],
      [floatOf(fling), 'drips', SNEEZE.riderD, 0.6, SNEEZE.riderS],
    ],
  };
})();

// ---------- Element 2: the Stegosaurus plate hop ----------

/**
 * The stegosaurus faces the ski: its head and neck are the ramp (to the back at `back`), three big
 * plates stand in a row on its back and the tail trails off at the far end.
 */
export const STEGO = {
  foot: 4,
  back: 9,
  backY: 1.8,
  /** d and the height of the top of each plate; the middle one is the biggest. */
  plates: [
    { d: 12, y: 3.0 },
    { d: 16.5, y: 3.8 },
    { d: 21, y: 3.0 },
  ],
  /** The clear flies off the tail and lands here. */
  land: 33,
  halfWidth: 2.0,
  /** The wipeout clips the second plate here, partway through the hop to it. */
  clipD: 15.3,
};

/** Height of the stegosaurus's neck ramp on the middle line at `d`. */
export function stegoRampY(d: number): number {
  const { foot, back, backY } = STEGO;
  if (d <= foot) return 0;
  return d <= back ? backY * smooth((d - foot) / (back - foot)) : backY;
}

/** The ski's touch-downs: off the back at (back, backY), on to each plate, then off the tail. */
const HOPS = [{ d: STEGO.back, y: STEGO.backY }, ...STEGO.plates, { d: STEGO.land, y: 0 }] as const;
const HOP_PEAKS = [4.4, 5.0, 5.0, 6.0] as const;
/** Times the ski touches each of the three plates (a hop from the back, then plate to plate). */
export const T_PLATE = STEGO.plates.map((p) => p.d / SPEED) as [number, number, number];
const LENGTH2 = 46;
const BONK = { skiD: 13.8, skiS: -3.4, riderD: 17.6, riderS: 3.4, bounce: 0.95, flyT: 1.15 };
export { BONK };
export const T_CLIP = STEGO.clipD / SPEED;

const stegoClear: Def = (() => {
  const tLand = STEGO.land / SPEED;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    const d = SPEED * t;
    if (d <= STEGO.back) {
      k.d = d;
      k.y = stegoRampY(d);
      k.pitch = Math.atan(slopeAt(stegoRampY, Math.min(Math.max(d, 0.02), STEGO.back - 0.02)));
      k.wet = d < STEGO.foot;
      f.rider.pose = 'ride';
      return;
    }
    k.wet = false;
    f.rider.pose = 'armsUp';
    if (t < tLand) {
      let i = 0;
      while (i < HOPS.length - 2 && d > HOPS[i + 1].d) i++;
      const from = HOPS[i];
      const to = HOPS[i + 1];
      const u = (d - from.d) / (to.d - from.d);
      k.d = d;
      k.y = arc(from.y, to.y, HOP_PEAKS[i], u);
      k.pitch = 0.12 * Math.sin(Math.PI * u);
      // The last hop, off the tail, spins.
      if (i === HOPS.length - 2) k.yaw = TAU * prog(u, 0.1, 0.9, 'io');
    } else {
      k.d = Math.min(STEGO.land + SPEED * (t - tLand), LENGTH2);
      k.y = 0;
      k.yaw = TAU;
      k.wet = true;
      f.rider.pose = t < tLand + 0.5 ? 'fistPump' : 'ride';
    }
  };
  const mid = (T_PLATE[1] + T_PLATE[2]) / 2;
  return {
    duration: tLand + (LENGTH2 - STEGO.land) / SPEED,
    length: LENGTH2,
    word: 'PLATE HOP!',
    at,
    events: () => [
      [STEGO.foot / SPEED - 0.3, 'sfx:whoosh', STEGO.foot - 2, 1],
      ...STEGO.plates.flatMap((p, i): [number, 'sfx:boing' | 'spray', number, number][] => [
        [T_PLATE[i], 'sfx:boing', p.d, p.y],
        [T_PLATE[i], 'spray', p.d, p.y],
      ]),
      [mid, 'word', (STEGO.plates[1].d + STEGO.plates[2].d) / 2, 6.6],
      [T_PLATE[2] + 0.15, 'sfx:whoosh', STEGO.plates[2].d + 2, 4],
      [tLand, 'splash', STEGO.land, 0],
      [tLand, 'sfx:splash', STEGO.land, 0],
      [tLand + 0.05, 'confetti', STEGO.land + 1, 1.5],
      [tLand + 0.2, 'cheer', STEGO.land + 2, 1],
    ],
  };
})();

const stegoFail: Def = (() => {
  const ramp = (d: number, f: Frame) => {
    const k = f.ski;
    k.d = d;
    k.y = stegoRampY(d);
    k.pitch = Math.atan(slopeAt(stegoRampY, Math.min(Math.max(d, 0.02), STEGO.back - 0.02)));
    k.wet = d < STEGO.foot;
  };
  const p1 = STEGO.plates[0];
  const hopU = (STEGO.clipD - p1.d) / (STEGO.plates[1].d - p1.d);
  const yClip = arc(p1.y, p1.y, 3.6, hopU);
  const tClip = T_CLIP;
  const tWater = tClip + BONK.bounce;
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    const d = SPEED * t;
    if (d <= STEGO.back) {
      ramp(d, f);
    } else if (t < T_PLATE[0]) {
      const u = (d - STEGO.back) / (p1.d - STEGO.back);
      k.d = d;
      k.y = arc(STEGO.backY, p1.y, HOP_PEAKS[0], u);
      k.pitch = 0.12 * Math.sin(Math.PI * u);
      k.wet = false;
    } else if (t < tClip) {
      // A low hop at the second plate.
      const u = (d - p1.d) / (STEGO.plates[1].d - p1.d);
      k.d = d;
      k.y = arc(p1.y, p1.y, 3.6, u);
      k.pitch = 0.12 * Math.sin(Math.PI * u);
      k.wet = false;
    } else if (t < tWater) {
      // Bonked: bounces back, spins and drops into the water beside the plates.
      const u = (t - tClip) / BONK.bounce;
      k.d = lerp(STEGO.clipD, BONK.skiD, prog(u, 0, 1, 'o'));
      k.s = BONK.skiS * prog(u, 0, 1, 'o');
      k.y = arc(yClip, 0, yClip + 1.2, u);
      k.yaw = TAU * prog(u, 0.1, 0.9);
      k.pitch = 0.3 * Math.sin(Math.PI * u);
      k.wet = false;
    } else {
      k.d = BONK.skiD;
      k.s = BONK.skiS;
      k.y = 0;
      k.yaw = TAU;
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, tClip);
  const fling: Fling = {
    t0: tClip,
    fly: BONK.flyT,
    from: s0,
    d: BONK.riderD,
    s: BONK.riderS,
    peak: 6.0,
    turn: TAU,
  };
  return {
    duration: floatOf(fling) + 1.0,
    word: 'BONK!',
    at: (t, f) => {
      skiAt(t, f);
      if (t >= tClip - 0.2 && t < tClip) f.rider.face = 'scared';
      flung(f, t, fling);
    },
    events: (_ski, rider) => [
      [STEGO.foot / SPEED - 0.3, 'sfx:whoosh', STEGO.foot - 2, 1],
      [T_PLATE[0], 'sfx:boing', p1.d, p1.y],
      [T_PLATE[0], 'spray', p1.d, p1.y],
      [tClip, 'sfx:bump', STEGO.clipD, yClip],
      [tClip, 'stars', STEGO.clipD, yClip + 1.6],
      [tClip + 0.1, 'sfx:slideWhistle', STEGO.clipD, yClip + 1],
      ...trail(tClip + 0.3, splatOf(fling) - 0.2, 0.3, 'drips', rider),
      [tWater, 'splash', BONK.skiD, 0.2, BONK.skiS],
      [tWater, 'drips', BONK.skiD, 0.6, BONK.skiS],
      [splatOf(fling), 'bigSplash', BONK.riderD, 0.2, BONK.riderS],
      [splatOf(fling), 'sfx:splat', BONK.riderD, 0, BONK.riderS],
      [splatOf(fling), 'sfx:splash', BONK.riderD, 0, BONK.riderS],
      [splatOf(fling), 'groan', BONK.riderD, 1, BONK.riderS],
      [splatOf(fling) + 0.1, 'word', BONK.riderD, 3.4, BONK.riderS],
      [floatOf(fling), 'drips', BONK.riderD, 0.6, BONK.riderS],
    ],
  };
})();

// ---------- Element 3: the T. rex jaw jump ----------

/**
 * A T. rex rears up roaring with its head thrown back and its jaws open towards the course: the
 * ski rides up the snout-ramp to the lip, flies over the open jaws and lands beyond. The jaws hinge
 * at `hinge`; open, the upper jaw tip is at (`tipD`, `tipY`).
 */
export const REX = {
  foot: 5,
  lip: 16,
  lipY: 5.5,
  rampHalfWidth: 2.2,
  hinge: { d: 26, y: 4.5 },
  /** Jaw length from the hinge, and how far each jaw is open (radians). */
  jawLength: 6.5,
  upperOpen: 0.43,
  lowerOpen: 0.35,
  /** The clear lands here. */
  land: 40,
  /** The wipeout lands in the jaws here, and is spat out to land here. */
  mouthD: 21,
  mouthY: 4.1,
  spitD: 34,
  spitS: 3.5,
  riderD: 36,
  riderS: 6,
};

/** Height of the snout ramp on the middle line at `d`. */
export function rexRampY(d: number): number {
  const { foot, lip, lipY } = REX;
  if (d <= foot) return 0;
  return d <= lip ? lipY * ((d - foot) / (lip - foot)) ** 1.5 : 0;
}

export const T_LIP3 = REX.lip / SPEED;
const LENGTH3 = 54;
const AIR3 = (REX.land - REX.lip) / SPEED;
const rexLipPitch = Math.atan(slopeAt(rexRampY, REX.lip - 0.02));
const rexRide = (d: number, f: Frame) => {
  const k = f.ski;
  k.d = d;
  k.y = rexRampY(d);
  k.pitch = Math.atan(slopeAt(rexRampY, Math.min(Math.max(d, 0.02), REX.lip - 0.02)));
  k.wet = d < REX.foot;
};

/** The jaws' opening over a stunt: 1 = wide open, 0 = shut. */
export const T_CHOMP = T_LIP3 + 0.45;
export const T_SPIT = T_CHOMP + 0.4;

const rexClear: Def = (() => {
  const tLand = T_LIP3 + AIR3;
  const peak = 12;
  const at = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP3) {
      rexRide(SPEED * t, f);
      f.rider.pose = SPEED * t < REX.foot ? 'ride' : 'fistPump';
    } else if (t < tLand) {
      const u = (t - T_LIP3) / AIR3;
      k.d = lerp(REX.lip, REX.land, u);
      k.y = arc(REX.lipY, 0, peak, u);
      k.pitch = rexLipPitch * (1 - prog(u, 0, 0.3)) + 2 * TAU * flipEase(prog(u, 0.1, 0.88, 'l'));
      k.wet = false;
      f.rider.pose = u < 0.1 ? 'fistPump' : u < 0.85 ? 'tuck' : 'armsUp';
    } else {
      k.d = Math.min(REX.land + SPEED * (t - tLand), LENGTH3);
      k.y = 0;
      k.pitch = 2 * TAU;
      f.rider.pose = t < tLand + 0.5 ? 'fistPump' : 'ride';
    }
  };
  const mid = T_LIP3 + AIR3 * 0.5;
  return {
    duration: tLand + (LENGTH3 - REX.land) / SPEED,
    length: LENGTH3,
    word: 'REX JUMP!',
    slow: [mid],
    at,
    events: (ski) => [
      [T_LIP3 - 0.3, 'sfx:whoosh', REX.lip - 3, REX.lipY - 1],
      [T_LIP3, 'spray', REX.lip, REX.lipY],
      [T_LIP3, 'sfx:boing', REX.lip, REX.lipY],
      [mid, 'word', ski(mid).d, ski(mid).y + 2.2],
      [tLand, 'splash', REX.land, 0],
      [tLand, 'bigSplash', REX.land, 0.2],
      [tLand, 'sfx:splash', REX.land, 0],
      [tLand + 0.1, 'fireworks', REX.land + 2, 5],
      [tLand + 0.2, 'cheer', REX.land + 2, 1],
      [tLand + 0.2, 'confetti', REX.land + 3, 1.5],
    ],
  };
})();

const rexFail: Def = (() => {
  const spitFly = 1.2;
  const tWater = T_SPIT + spitFly;
  const hopFrom = { d: REX.lip, y: REX.lipY };
  const skiAt = (t: number, f: Frame) => {
    const k = f.ski;
    if (t <= T_LIP3) {
      rexRide(SPEED * t, f);
    } else if (t < T_CHOMP) {
      // A short hop off the lip right into the open mouth.
      const u = (t - T_LIP3) / (T_CHOMP - T_LIP3);
      k.d = lerp(hopFrom.d, REX.mouthD, u);
      k.y = arc(hopFrom.y, REX.mouthY, hopFrom.y + 0.6, u);
      k.pitch = rexLipPitch * (1 - prog(u, 0, 0.6));
      k.wet = false;
    } else if (t < T_SPIT) {
      // Caught between the jaws, shaken.
      const shake = Math.sin((t - T_CHOMP) * 50);
      k.d = REX.mouthD + 0.1 * shake;
      k.y = REX.mouthY + 0.1 * shake;
      k.pitch = 0.25 * shake;
      k.wet = false;
    } else if (t < tWater) {
      // Spat out in a big arc, tumbling.
      const u = (t - T_SPIT) / spitFly;
      k.d = lerp(REX.mouthD, REX.spitD, u);
      k.s = REX.spitS * prog(u, 0, 1, 'o');
      k.y = arc(REX.mouthY, 0, 9, u);
      k.pitch = TAU * prog(u, 0.05, 0.95);
      k.wet = false;
    } else {
      k.d = REX.spitD;
      k.s = REX.spitS;
      k.y = 0;
      k.pitch = TAU;
      k.wet = true;
    }
  };
  const s0 = seatAtTime(skiAt, T_SPIT);
  const fling: Fling = {
    t0: T_SPIT,
    fly: 1.35,
    from: s0,
    d: REX.riderD,
    s: REX.riderS,
    peak: 9.5,
    turn: 2 * TAU,
  };
  return {
    duration: floatOf(fling) + 1.0,
    word: 'CHOMP!',
    at: (t, f) => {
      skiAt(t, f);
      if (t >= T_LIP3 + 0.1 && t < T_SPIT) {
        f.rider.pose = 'flail';
        f.rider.face = 'scared';
      }
      flung(f, t, fling);
    },
    events: (_ski, rider) => [
      [T_LIP3 - 0.3, 'sfx:whoosh', REX.lip - 3, REX.lipY - 1],
      [T_LIP3, 'spray', REX.lip, REX.lipY],
      [T_LIP3, 'sfx:boing', REX.lip, REX.lipY],
      [T_CHOMP, 'sfx:bump', REX.mouthD, REX.mouthY],
      [T_CHOMP, 'stars', REX.mouthD, REX.mouthY + 1.8],
      [T_SPIT, 'sfx:slideWhistle', REX.mouthD, REX.mouthY],
      ...trail(T_SPIT + 0.2, splatOf(fling) - 0.2, 0.3, 'drips', rider),
      [tWater, 'bigSplash', REX.spitD, 0.2, REX.spitS],
      [tWater, 'sfx:splash', REX.spitD, 0, REX.spitS],
      [splatOf(fling), 'bigSplash', REX.riderD, 0.2, REX.riderS],
      [splatOf(fling), 'sfx:splat', REX.riderD, 0, REX.riderS],
      [splatOf(fling), 'groan', REX.riderD, 1, REX.riderS],
      [splatOf(fling) + 0.1, 'word', REX.riderD, 3.4, REX.riderS],
      [floatOf(fling), 'drips', REX.riderD, 0.6, REX.riderS],
    ],
  };
})();

export const RAPTOR_RAPIDS: MegaSpec = {
  id: 'raptor-rapids',
  title: 'Raptor Rapids',
  emoji: '🦖',
  elements: [
    {
      name: 'Brachiosaurus Neck Slide',
      length: LENGTH1,
      floorY: -1.2,
      cue: { d: 6, y: 1.0 },
      anchor: { d: 15, y: 3.5 },
      extent: [6, 24],
      clear: neckClear,
      fail: neckFail,
    },
    {
      name: 'Stegosaurus Plate Hop',
      length: LENGTH2,
      floorY: -1.2,
      cue: { d: 8, y: 1.0 },
      anchor: { d: 17, y: 3.2 },
      extent: [8, 26],
      clear: stegoClear,
      fail: stegoFail,
    },
    {
      name: 'T. Rex Jaw Jump',
      length: LENGTH3,
      floorY: -1.2,
      cue: { d: 8, y: 1.0 },
      anchor: { d: 21, y: 6 },
      extent: [12, 30],
      clear: rexClear,
      fail: rexFail,
    },
  ],
};
