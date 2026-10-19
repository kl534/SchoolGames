/**
 * Mega course 1: the Triple Loop. Three loop-the-loops that shrink (a GIANT, a middle and a little
 * one) standing right next to each other with only a hand's width of road between the hoops. Pure animation data like stunts.ts: obstacle-local
 * coordinates per element, x = 0 at the element's entry line, the road at y = 0.
 *
 * Every element starts as the standard arrival pose and a cleared one ends riding on the road at
 * its `length`, so the three chain. A crash comes to rest (the rider is always fine).
 */
import {
  arc,
  BIKE_Y,
  createFrame,
  hipOf,
  lerp,
  prog,
  REAR,
  setFree,
  smooth,
  TAU,
  track,
  trail,
  WHEEL_R,
  type Def,
  type Ev,
  type Frame,
} from '../stunts';
import type { MegaSpec } from './mega';

/** One loop-the-loop: its circle, where it sits in the element and the length of the element. */
export interface LoopShape {
  /** Radius of the circle track. */
  R: number;
  /** x of the circle's bottom (where the bike enters and leaves it). */
  cx: number;
  /** x of the end of the element. */
  length: number;
}

/** Half the thickness of a hoop's rim: the hoops stand R + RIM from their centre line. */
export const RIM = 0.4;
/** Clear space between the rims of two neighbouring hoops; the element boundary is in the middle. */
export const HOOP_GAP = 1.0;
/** The run-up before the first hoop and the road after the last one. */
const RUN_UP = 8;
const RUN_OUT = 11;

/** The three loops: radius 3.0 (the size of the regular loop), 2.4 and 1.8, tight together. */
export const LOOPS: readonly [LoopShape, LoopShape, LoopShape] = [
  { R: 3.0, cx: RUN_UP, length: RUN_UP + 3.0 + RIM + HOOP_GAP / 2 },
  {
    R: 2.4,
    cx: 2.4 + RIM + HOOP_GAP / 2,
    length: 2.4 + RIM + HOOP_GAP / 2 + 2.4 + RIM + HOOP_GAP / 2,
  },
  { R: 1.8, cx: 1.8 + RIM + HOOP_GAP / 2, length: 1.8 + RIM + HOOP_GAP / 2 + RUN_OUT },
];

/** Track distance of a loop: the circle's circumference, where it ends, where the element ends. */
const circ = (g: LoopShape) => TAU * g.R;
const sOut = (g: LoopShape) => g.cx + circ(g);
const sEnd = (g: LoopShape) => g.length + circ(g);

/** The loop track is drawn at z = -0.5; the bike eases onto it over the first 12% of the circle. */
const zAt = (phi: number) => -0.5 * smooth(Math.min(phi, TAU - phi) / (0.12 * TAU));

/** The bike on the inside of the circle at angle `phi` from the bottom, going anticlockwise. */
export function onLoop(f: Frame, g: LoopShape, phi: number): void {
  const rr = g.R - WHEEL_R;
  f.bike.x = g.cx + rr * Math.sin(phi);
  f.bike.y = g.R - rr * Math.cos(phi);
  f.bike.pitch = phi;
  f.bike.z = zAt(phi);
}

/** The bike at distance `s` along the track: flat lead-in, circle, then the flat exit road. */
function loopAt(f: Frame, g: LoopShape, s: number): void {
  if (s <= g.cx) {
    f.bike.x = s;
  } else if (s <= sOut(g)) {
    onLoop(f, g, (s - g.cx) / g.R);
  } else {
    f.bike.x = g.cx + (s - sOut(g));
    f.bike.pitch = TAU;
  }
}

/**
 * Track distance by time for a cleared loop: it rolls in a bit slower, speeds up through the
 * circle and rolls out a bit slower again (speed 1 + 0.5 sin(pi u) times the mean).
 */
const PACE = 0.5;
function pace(g: LoopShape, duration: number): (t: number) => number {
  const total = sEnd(g);
  const norm = 1 + (2 * PACE) / Math.PI;
  return (t) => {
    const u = Math.min(Math.max(t / duration, 0), 1);
    return (total * (u + (PACE / Math.PI) * (1 - Math.cos(Math.PI * u)))) / norm;
  };
}

/** The time at which an increasing function of time reaches `target`. */
function timeAt(f: (t: number) => number, duration: number, target: number): number {
  let lo = 0;
  let hi = duration;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The hips of a rider seated on the bike as it is at `bike` (copied out of the shared scratch). */
function hipsOn(x: number, y: number, pitch: number): { x: number; y: number } {
  const h = hipOf(x, y, pitch);
  return { x: h.x, y: h.y };
}

/** Where the bike is on the circle at `phi`. */
function pointOn(g: LoopShape, phi: number): { x: number; y: number } {
  const f = createFrame();
  onLoop(f, g, phi);
  return { x: f.bike.x, y: f.bike.y };
}

// ---------- Element 1: GIANT Loop ----------

const clear1: Def = (() => {
  const g = LOOPS[0];
  const duration = 3.2;
  const s = pace(g, duration);
  const top = timeAt(s, duration, g.cx + circ(g) / 2);
  const waveA = g.cx + 0.75 * Math.PI * g.R;
  const waveB = g.cx + 1.3 * Math.PI * g.R;
  const exit = g.length - g.cx;
  const enter = timeAt(s, duration, g.cx);
  const out = timeAt(s, duration, sOut(g));
  const at = (t: number, f: Frame) => {
    const d = s(t);
    loopAt(f, g, d);
    if (d > waveA && d < waveB) f.rider.pose = 'wave';
    if (d > sOut(g)) {
      // A small hop on the way out.
      const hop = Math.sin(Math.PI * Math.min((d - sOut(g)) / exit, 1));
      f.bike.y = BIKE_Y + 0.28 * hop;
      f.bike.pitch = TAU + 0.25 * hop;
    }
  };
  return {
    duration,
    word: 'WHOOSH!',
    beats: { enter, top, out },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 3, 0.5],
      ...trail(enter + 0.1, out, 0.12, 'spark', bike),
      [top, 'word', g.cx, 2 * g.R + 0.6],
      [duration * 0.86, 'dust', g.length - 2, 0.1],
      [duration * 0.88, 'cheer', g.length - 3, 2],
    ],
  };
})();

const crash1: Def = (() => {
  const g = LOOPS[0];
  // Rolls in at speed, climbs, loses it just past the 3 o'clock side and hangs there.
  const phiStall = 1.62;
  const speed = 10;
  const tEnter = g.cx / speed;
  const climb = (2 * g.R * phiStall) / speed;
  const tStall = tEnter + climb;
  const tSlide = tStall + 0.3;
  const slide = 0.75;
  const tBottom = tSlide + slide;
  // Then it slides backwards down the circle and rolls back along the road.
  const rollBack = 2.6;
  const back = (2 * rollBack) / ((2 * g.R * phiStall) / slide);
  const tRest = tBottom + back;
  const lead = track([
    [0, 0],
    [tEnter, g.cx, 'l'],
    [tStall, g.cx + g.R * phiStall, 'q'],
  ]);
  const phiBack = track([
    [tSlide, phiStall],
    [tBottom, 0, 'i'],
  ]);
  const xBack = track([
    [tBottom, g.cx],
    [tRest, g.cx - rollBack, 'q'],
  ]);
  const hips0 = hipsOn(g.cx, BIKE_Y, 0);
  // The rider drops off the back of the bike and plops on the road.
  const tLand = tBottom + 0.5;
  const landX = g.cx - 1.0;
  const riderX = track([
    [tBottom, hips0.x],
    [tLand, landX, 'q'],
  ]);
  const riderY = (t: number) =>
    arc(hips0.y, 0.25, 1.9, prog(t, tBottom, tLand, 'l')) +
    (t >= tLand ? 0.18 * Math.exp(-(((t - tLand - 0.08) / 0.1) ** 2)) : 0);
  const riderRot = track([
    [tBottom, 0],
    [tLand, -1.6, 'q'],
    [tLand + 0.25, 0, 'o'],
  ]);
  const duration = tLand + 1.4;
  const at = (t: number, f: Frame) => {
    if (t < tStall) {
      loopAt(f, g, lead(t));
    } else if (t < tSlide) {
      // Stuck: the wheels spin, the bike shivers.
      onLoop(f, g, phiStall);
      f.bike.grounded = false;
      f.bike.pitch += 0.04 * Math.sin((t - tStall) * 30);
      f.bike.y += 0.05 * Math.sin((t - tStall) * 37);
    } else if (t < tBottom) {
      onLoop(f, g, phiBack(t));
      f.bike.grounded = false;
    } else {
      f.bike.x = xBack(t);
      f.bike.grounded = t < tRest - 0.05;
    }
    if (t >= tStall && t < tBottom) {
      f.rider.pose = 'dangle';
      f.rider.face = 'scared';
    } else if (t >= tBottom) {
      const sitting = t >= tLand;
      setFree(f, riderX(t), riderY(t), riderRot(t), sitting ? 'sit' : 'flail', 'dizzy');
    }
  };
  return {
    duration,
    word: 'SLIDE!',
    beats: { stall: tStall, slide: tSlide, plop: tBottom, land: tLand },
    at,
    events: (bike) => [
      ...trail(tStall + 0.05, tSlide, 0.1, 'sweat', bike, 0.6),
      [tSlide, 'word', g.cx + g.R, g.R],
      [tSlide, 'sfx:slideWhistle', g.cx + g.R, g.R],
      [tBottom, 'groan', g.cx, 1],
      [tLand, 'sfx:splat', landX, 0.4],
      [tLand, 'dust', landX, 0.1],
      [tRest, 'dust', g.cx - rollBack, 0.1],
      [tLand + 0.3, 'stars', landX, 1.4],
    ],
  };
})();

// ---------- Element 2: Middle Loop ----------

const clear2: Def = (() => {
  const g = LOOPS[1];
  const duration = 2.4;
  const s = pace(g, duration);
  const enter = timeAt(s, duration, g.cx);
  const out = timeAt(s, duration, sOut(g));
  const top = timeAt(s, duration, g.cx + circ(g) / 2);
  const exit = g.length - g.cx;
  // The wheelie out of the loop: up over a unit, held, then down well before the next hoop.
  const wheelie = track([
    [0, 0],
    [0.8, 0.5],
    [exit - 1.3, 0.5, 'l'],
    [exit - 0.2, 0],
    [exit, 0],
  ]);
  const at = (t: number, f: Frame) => {
    const d = s(t);
    loopAt(f, g, d);
    if (d > g.cx + 0.2 && d < sOut(g)) f.rider.pose = 'armsUp';
    if (d > sOut(g)) {
      const e = d - sOut(g);
      const w = wheelie(e);
      f.bike.pitch = TAU + w;
      f.bike.y = BIKE_Y + REAR * Math.sin(w);
      f.rider.pose = w > 0.2 ? 'wheelie' : 'armsUp';
      if (e > exit - 1.2) f.rider.pose = 'ride';
    }
  };
  return {
    duration,
    word: 'WHEEE!',
    beats: { enter, top, out },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 3, 0.5],
      ...trail(enter + 0.1, out + 0.3, 0.1, 'spark', bike),
      [top, 'word', g.cx, 2 * g.R + 0.6],
      [top, 'confetti', g.cx, 2 * g.R],
      [out + 0.4, 'dust', g.cx + 1, 0.1],
      [duration * 0.88, 'cheer', g.length - 3, 2],
    ],
  };
})();

const crash2: Def = (() => {
  const g = LOOPS[1];
  const phiHang = Math.PI + 0.1;
  const tEnter = g.cx / 9;
  const tTop = tEnter + 1.2;
  const tDrop = tTop + 0.3;
  const tLand = tDrop + 0.45;
  const hang = pointOn(g, phiHang);
  const landX = g.cx + 0.3;
  const lead = track([
    [0, 0],
    [tEnter, g.cx, 'l'],
    [tTop, g.cx + g.R * phiHang, 'q'],
  ]);
  const drop = (t: number) => prog(t, tDrop, tLand, 'i');
  // Two bounces, each with a squash on landing, then it rolls a little further.
  const b1 = 0.4;
  const b2 = 0.25;
  const tB1 = tLand + b1;
  const tB2 = tB1 + b2;
  const tRest = tB2 + 0.2;
  const bounceY = (t: number) => {
    if (t < tB1) return arc(BIKE_Y, BIKE_Y, BIKE_Y + 1.0, (t - tLand) / b1);
    if (t < tB2) return arc(BIKE_Y, BIKE_Y, BIKE_Y + 0.4, (t - tB1) / b2);
    return BIKE_Y;
  };
  const roll = track([
    [tLand, landX],
    [tB2, landX + 1.3, 'l'],
    [tRest, landX + 2.0, 'q'],
  ]);
  const squash = (t: number) =>
    1 -
    0.3 * Math.exp(-(((t - tLand - 0.04) / 0.08) ** 2)) -
    0.15 * Math.exp(-(((t - tB1 - 0.04) / 0.07) ** 2)) -
    0.08 * Math.exp(-(((t - tB2 - 0.04) / 0.06) ** 2));
  // The rider is thrown forward in a somersault and sits up dizzy.
  const tFlight = 0.55;
  const tSit = tLand + tFlight;
  const hips0 = hipsOn(landX, BIKE_Y, TAU);
  const riderX = track([
    [tLand, hips0.x],
    [tSit, landX + 2.6, 'l'],
    [tSit + 0.3, landX + 3.0, 'o'],
  ]);
  const duration = tSit + 1.3;
  const riderY = (t: number) =>
    t < tSit ? arc(hips0.y, 0.25, 2.6, prog(t, tLand, tSit, 'l')) : 0.25;
  const riderRot = track([
    [tLand, 0],
    [tSit, -TAU, 'l'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tDrop) {
      if (t < tEnter) {
        f.bike.x = lead(t);
      } else {
        onLoop(f, g, (lead(t) - g.cx) / g.R);
      }
      if (t > tTop) {
        // Hanging upside down: wheels turning, a little sway.
        f.bike.grounded = false;
        f.bike.pitch += 0.04 * Math.sin((t - tTop) * 14);
        f.bike.y += 0.05 * Math.sin((t - tTop) * 17);
      }
    } else if (t < tLand) {
      const u = drop(t);
      f.bike.x = lerp(hang.x, landX, u);
      f.bike.y = lerp(hang.y, BIKE_Y, u);
      f.bike.pitch = lerp(phiHang, TAU, smooth(u));
      f.bike.z = lerp(zAt(phiHang), 0, u);
      f.bike.grounded = false;
    } else {
      f.bike.x = roll(t);
      f.bike.y = bounceY(t);
      f.bike.pitch = TAU;
      f.bike.squash = squash(t);
      f.bike.grounded = f.bike.y <= BIKE_Y + 1e-6;
    }
    if (t >= tTop && t < tLand) {
      f.rider.pose = 'dangle';
      f.rider.face = 'scared';
    } else if (t >= tLand) {
      const sitting = t >= tSit;
      setFree(f, riderX(t), riderY(t), riderRot(t), sitting ? 'sit' : 'flail', 'dizzy');
    }
  };
  return {
    duration,
    word: 'DROP!',
    beats: { hang: tTop, drop: tDrop, land: tLand, bounce: tB1 },
    at,
    events: () => [
      ...[tTop + 0.1, tTop + 0.2].map((a): Ev => [a, 'sweat', hang.x, hang.y - 0.6]),
      [tDrop, 'word', hang.x, hang.y],
      [tDrop, 'sfx:slideWhistle', hang.x, hang.y],
      [tLand, 'groan', landX, 1],
      [tLand, 'dust', landX, 0.1],
      [tLand, 'sfx:boing', landX, 0.6],
      [tB1, 'sfx:boing', landX + 0.8, 0.6],
      [tB1, 'dust', landX + 0.8, 0.1],
      [tSit, 'sfx:splat', landX + 2.6, 0.4],
      [tSit, 'dust', landX + 2.6, 0.1],
      [tSit + 0.3, 'stars', landX + 2.9, 1.4],
    ],
  };
})();

// ---------- Element 3: the Little Loop (the finale) ----------

const clear3: Def = (() => {
  const g = LOOPS[2];
  const duration = 3.4;
  const s = pace(g, duration);
  const enter = timeAt(s, duration, g.cx);
  const out = timeAt(s, duration, sOut(g));
  const top = timeAt(s, duration, g.cx + circ(g) / 2);
  const exit = g.length - g.cx;
  // A long wheelie out of the loop, then the whole bike spins round over the last 5 units.
  const wheelie = track([
    [0, 0],
    [1.5, 0.5],
    [exit - 7, 0.5, 'l'],
    [exit - 5.5, 0],
    [exit, 0],
  ]);
  const at = (t: number, f: Frame) => {
    const d = s(t);
    loopAt(f, g, d);
    if (d > g.cx + circ(g) / 4) f.rider.pose = 'armsUp';
    if (d > sOut(g)) {
      const e = d - sOut(g);
      const w = wheelie(e);
      f.bike.pitch = TAU + w;
      f.bike.y = BIKE_Y + REAR * Math.sin(w);
      f.rider.pose = 'armsUp';
      const u = (e - (exit - 5)) / 5;
      if (u > 0) {
        f.bike.roll = TAU * smooth(u);
        f.bike.y = BIKE_Y + 1.1 * Math.sin(Math.PI * Math.min(u, 1));
        f.bike.grounded = false;
      }
    }
  };
  const spinA = timeAt(s, duration, sOut(g) + exit - 5);
  return {
    duration,
    word: 'LOOP-TASTIC!',
    beats: { enter, top, out, spin: spinA },
    at,
    events: (bike) => [
      [0.3, 'sfx:whoosh', 3, 0.5],
      ...trail(enter + 0.1, out + 0.4, 0.09, 'spark', bike),
      [top, 'word', g.cx, 2 * g.R + 0.6],
      [top, 'confetti', g.cx, 2 * g.R],
      [top + 0.15, 'confetti', g.cx - 1, 2 * g.R - 1],
      [top, 'sfx:chime', g.cx, 2 * g.R],
      [out + 0.5, 'dust', g.cx + 1.5, 0.1],
      [spinA, 'sfx:whoosh', g.length - 5, 1.5],
      [spinA + 0.4, 'confetti', g.length - 3, 2.5],
      [duration - 0.2, 'confetti', g.length - 1, 2],
      [duration - 0.15, 'cheer', g.length - 1, 2],
    ],
  };
})();

const crash3: Def = (() => {
  const g = LOOPS[2];
  const phiOff = 0.72 * Math.PI;
  const speed = 10;
  const tEnter = g.cx / speed;
  const climb = (2 * g.R * phiOff) / speed;
  const tOff = tEnter + climb;
  const flight = 0.8;
  const tLand = tOff + flight;
  const tRest = tLand + 0.7;
  const duration = tRest + 1.1;
  const lead = track([
    [0, 0],
    [tEnter, g.cx, 'l'],
    [tOff, g.cx + g.R * phiOff, 'q'],
  ]);
  const off = pointOn(g, phiOff);
  const bikeLandX = g.cx - 1.8;
  const bikeX = (t: number) =>
    t < tLand
      ? lerp(off.x, bikeLandX, prog(t, tOff, tLand, 'l'))
      : lerp(bikeLandX, g.cx - 0.3, prog(t, tLand, tRest, 'q'));
  const bikeY = (t: number) =>
    t < tLand ? arc(off.y, BIKE_Y, off.y + 0.5, prog(t, tOff, tLand, 'l')) : BIKE_Y;
  const bikePitch = (t: number) => lerp(phiOff, 2 * TAU, prog(t, tOff, tLand, 'io'));
  const squash = (t: number) => 1 - 0.3 * Math.exp(-(((t - tLand - 0.04) / 0.09) ** 2));
  // The rider flails out of the bike, lands in the middle of the hoop and tumbles out, sooty.
  const hips0 = hipsOn(off.x, off.y, phiOff);
  const tRider = tLand + 0.05;
  const tTumble = tRider + 0.5;
  const landX = g.cx - 0.6;
  const riderX = track([
    [tOff, hips0.x],
    [tRider, landX, 'l'],
    [tTumble, g.cx + 2.0, 'o'],
  ]);
  const riderY = (t: number) => {
    if (t < tRider) return arc(hips0.y, 0.25, hips0.y + 0.4, prog(t, tOff, tRider, 'l'));
    return 0.25 + 0.7 * Math.sin(Math.PI * prog(t, tRider, tTumble, 'l'));
  };
  const riderRot = track([
    [tOff, phiOff],
    [tRider, -TAU * 1.25, 'l'],
    [tTumble, -TAU * 2, 'io'],
  ]);
  const at = (t: number, f: Frame) => {
    if (t < tOff) {
      loopAt(f, g, lead(t));
      if (t > tOff - 0.3) f.bike.grounded = false;
    } else {
      f.bike.x = bikeX(t);
      f.bike.y = bikeY(t);
      f.bike.pitch = bikePitch(t);
      f.bike.z = lerp(zAt(phiOff), 0, prog(t, tOff, tLand, 'l'));
      f.bike.squash = squash(t);
      f.bike.grounded = t >= tLand && t < tRest - 0.05;
      const sitting = t >= tTumble;
      setFree(f, riderX(t), riderY(t), riderRot(t), sitting ? 'sit' : 'flail', 'sooty');
    }
    if (t >= tOff - 0.3 && t < tOff) f.rider.face = 'scared';
  };
  return {
    duration,
    word: 'LOOPY!',
    beats: { off: tOff, land: tLand, tumble: tTumble },
    at,
    events: (bike) => [
      ...trail(tOff - 0.3, tOff, 0.1, 'sweat', bike, 0.6),
      [tOff, 'word', off.x, off.y],
      [tOff, 'groan', off.x, off.y],
      [tOff, 'sfx:whoosh', off.x, off.y],
      [tLand, 'sfx:boing', bikeLandX, 0.6],
      [tLand, 'dust', bikeLandX, 0.1],
      [tRider, 'sfx:splat', landX, 0.4],
      [tRider, 'smoke', landX, 0.4],
      [tTumble, 'smoke', g.cx + 2, 0.5],
      [tTumble + 0.1, 'stars', g.cx + 2, 1.5],
    ],
  };
})();

// ---------- The course ----------

export const TRIPLE_LOOP: MegaSpec = {
  id: 'triple-loop',
  title: 'Triple Loop',
  emoji: '🌀',
  elements: [
    {
      name: 'GIANT LOOP',
      length: LOOPS[0].length,
      floorY: 0,
      height: 6.4,
      cuts: [],
      clear: clear1,
      crash: crash1,
    },
    {
      name: 'Middle Loop',
      length: LOOPS[1].length,
      floorY: 0,
      height: 5.3,
      cuts: [],
      clear: clear2,
      crash: crash2,
    },
    {
      name: 'Little Loop',
      length: LOOPS[2].length,
      floorY: 0,
      height: 4.2,
      cuts: [],
      clear: clear3,
      crash: crash3,
    },
  ],
};
