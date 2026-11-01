/**
 * Every move of a duel as pure keyframes: one `FighterFrame` per fighter and moment. `fighters.ts`
 * puts a frame on a rig. Imports only types, so it runs in tests.
 */
import type { PokeKind } from './rules';

export interface FighterFrame {
  /** Metres toward the opponent (negative = back). */
  dx: number;
  /** Lift. */
  y: number;
  /** Roll in the screen plane, rad (flips). */
  spin: number;
  /** Yaw away from the opponent, rad (bottom dodge). */
  turn: number;
  /** 1 = normal. */
  squash: number;
  /** 0 stance, 1 sword arm fully out. */
  lunge: number;
  /** 0 to 1 doubled over; a little below 0 leans back (the nose boop). */
  fold: number;
  handsBehind: boolean;
  dizzy: boolean;
  crossEyes: boolean;
}

export interface MoveFrame {
  attacker: FighterFrame;
  victim: FighterFrame;
  contact: boolean;
}

/** Seconds from the start of a poke to the touch. */
export const CONTACT_T = 0.38;
/** Seconds a poke takes, until both fighters are at rest again. */
export const POKE_TOTAL = 1.7;
/** Seconds after a right tap until the next question. */
export const NEXT_GAP = 2.0;
/** Seconds from the start of the finisher until the loser lands in the cake. */
export const FINISH_SPLAT = 1.55;
/** Seconds after the contact of the finisher when the loser leaves the ground. */
export const FINISH_LAUNCH = 0.45;

/** Where the loser lands: the top of the cake. */
export const CAKE_TOP = { x: 0, y: 1.3, z: -1.9 } as const;
/** The x of a fighter's stance spot, as a distance from the middle. */
export const STANCE_X = 1.1;
/** The height of a standing fighter's hip (the pivot of a flip) before any scale. */
export const HIP_STAND = 0.68;
/** How high the loser's hip flies. */
const FLIGHT_PEAK = 2.6;
const FLIPS = 1.5;

/**
 * How far the sword arm is raised above straight ahead at the lunge, per kind of poke
 * (negative = low): the head bonk is an overhead swing, the nose boop a high jab.
 */
export const POKE_AIM: Record<PokeKind, number> = {
  belly: -0.1,
  head: 0.5,
  nose: 0.22,
  bottom: -0.4,
};
/** The finisher is a high, wide thrust. */
export const FINISH_AIM = 0.25;

export function restFrame(): FighterFrame {
  return {
    dx: 0,
    y: 0,
    spin: 0,
    turn: 0,
    squash: 1,
    lunge: 0,
    fold: 0,
    handsBehind: false,
    dizzy: false,
    crossEyes: false,
  };
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** 0 up to `a`, eases up to 1 at `b`, holds to `c`, eases down to exactly 0 at `d`. */
function env(t: number, a: number, b: number, c: number, d: number): number {
  if (t <= a || t >= d) return 0;
  if (t < b) return smooth((t - a) / (b - a));
  if (t <= c) return 1;
  return smooth((d - t) / (d - c));
}

/** One hop (a half sine) of height `h` between `a` and `b`. */
function hop(t: number, a: number, b: number, h: number): number {
  return t > a && t < b ? h * Math.sin((Math.PI * (t - a)) / (b - a)) : 0;
}

const within = (t: number, a: number, b: number) => t >= a && t <= b;

/** A frame from the changes to the rest frame, with no negative zeros (so rest compares equal). */
function frame(changes: Partial<FighterFrame>): FighterFrame {
  const f = { ...restFrame(), ...changes };
  f.dx += 0;
  f.y += 0;
  f.spin += 0;
  f.turn += 0;
  f.fold += 0;
  f.lunge += 0;
  return f;
}

/** The attacker's step in and lunge: 0-0.30 s in, held to the touch, 0.40-1.10 s back. */
function attack(t: number, reach: number): FighterFrame {
  const e = env(t, 0, 0.3, 0.4, 1.1);
  return frame({ dx: reach * e, lunge: e });
}

/** The victim is knocked back a step and comes back: the touch at 0.38 s, at rest by 1.70 s. */
const stagger = (t: number) => 0 - 0.2 * env(t, CONTACT_T, 0.55, 0.7, POKE_TOTAL);

function victimOf(kind: PokeKind, t: number): FighterFrame {
  const dx = stagger(t);
  switch (kind) {
    case 'belly':
      return frame({ dx, fold: env(t, CONTACT_T, 0.5, 0.8, 1.3), y: hop(t, 0.45, 0.95, 0.18) });
    case 'head': {
      // Squashed to 0.82, then it springs back with a wobble.
      const wobble =
        t > 0.85 && t < 1.3
          ? 0.06 * Math.sin(((t - 0.85) / 0.3) * 2 * Math.PI) * (1 - (t - 0.85) / 0.45)
          : 0;
      return frame({
        dx,
        squash: 1 - 0.18 * env(t, CONTACT_T, 0.45, 0.5, 0.85) + wobble,
        dizzy: within(t, 0.4, 1.4),
      });
    }
    case 'nose':
      // The head snaps back: leaning back, a little.
      return frame({
        dx,
        fold: 0 - 0.4 * env(t, CONTACT_T, 0.46, 0.7, 1.3),
        crossEyes: within(t, 0.4, 1.2),
      });
    case 'bottom':
      return frame({
        dx,
        // Turns away to dodge before the touch, jumps at it with hands behind, turns back.
        turn: Math.PI * 0.8 * env(t, 0.05, 0.3, 0.9, 1.3),
        y: hop(t, CONTACT_T, 0.85, 0.5),
        handsBehind: within(t, CONTACT_T, 1.2),
      });
  }
}

/** One poke at time `t` (s) from its start. `contact` is true within a frame of the touch. */
export function pokeFrame(kind: PokeKind, t: number): MoveFrame {
  return {
    attacker: attack(t, 0.45),
    victim: victimOf(kind, t),
    contact: Math.abs(t - CONTACT_T) <= 1 / 60,
  };
}

/** The arc's height constant, so the hip peaks at `FLIGHT_PEAK` and lands on the cake. */
function arcLift(): number {
  const h = CAKE_TOP.y - HIP_STAND;
  const p = FLIGHT_PEAK - HIP_STAND;
  const b = 4 * p - 2 * h;
  return (b + Math.sqrt(b * b - 4 * h * h)) / 2;
}
const ARC = arcLift();

/**
 * The finisher: a big lunge, and from `FINISH_LAUNCH` the loser flies in an arc to the cake top,
 * flipping 1.5 times to land head down at `FINISH_SPLAT`. `victimPos` is the world position of the
 * loser's hip (the pivot of the flip), from their stance spot `fromX` (default: the rival's side).
 */
export function finishFrame(
  t: number,
  fromX: number = STANCE_X,
): MoveFrame & { victimPos: { x: number; y: number; z: number } } {
  const u = clamp01((t - FINISH_LAUNCH) / (FINISH_SPLAT - FINISH_LAUNCH));
  const victimPos = {
    x: fromX + (CAKE_TOP.x - fromX) * u,
    y: HIP_STAND + (CAKE_TOP.y - HIP_STAND) * u + ARC * u * (1 - u),
    z: CAKE_TOP.z * u,
  };
  // The hit squashes them a little just before they go.
  const squash = 1 - 0.2 * env(t, 0.36, 0.42, 0.45, 0.52);
  return {
    attacker: attack(t, 0.6),
    victim: frame({ spin: FLIPS * 2 * Math.PI * u, squash }),
    contact: Math.abs(t - CONTACT_T) <= 1 / 60,
    victimPos,
  };
}
