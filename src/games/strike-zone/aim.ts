/** The aim, the drift and the throw path. Pure: no three.js, no cannon-es and no DOM. */
import {
  AIM_LIMIT,
  ARROW_Z,
  BALL_SPEED,
  DECK_BACK_Z,
  HEAD_Z,
  RELEASE_Z,
  pinSpot,
  type PinId,
} from './geometry';

export interface Aim {
  /** The ball's x at release (the bowler stands so the ball is here). */
  startX: number;
  /** Where the ball's centre crosses z = HEAD_Z. */
  headX: number;
}

/** First ball of a game: 5 boards right of centre, into the 1-3 pocket. */
export const DEFAULT_AIM: Aim = { startX: 0.135, headX: 0.07 }; // (default)

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** x of the aimed line at depth z (it carries on straight past the head pin). */
export function lineX(aim: Aim, z: number): number {
  return aim.startX + ((aim.headX - aim.startX) * (z - RELEASE_Z)) / (HEAD_Z - RELEASE_Z);
}

/** How many head-pin distances from the release the back of the deck is (> 1). */
const BACK_RATIO = (DECK_BACK_Z - RELEASE_Z) / (HEAD_Z - RELEASE_Z);

/**
 * Keeps the whole line on the lane: clamps startX to ±AIM_LIMIT, then moves headX the least it
 * takes so that lineX at DECK_BACK_Z is also within ±AIM_LIMIT. (A straight line between two
 * points inside the limit stays inside it, so a right answer can never roll into the gutter.)
 */
export function clampAim(aim: Aim): Aim {
  const startX = clamp(aim.startX, -AIM_LIMIT, AIM_LIMIT);
  const backX = startX + (aim.headX - startX) * BACK_RATIO;
  if (Math.abs(backX) <= AIM_LIMIT) return { startX, headX: aim.headX };
  const limited = clamp(backX, -AIM_LIMIT, AIM_LIMIT);
  return { startX, headX: startX + (limited - startX) / BACK_RATIO };
}

/** Slides the bowler by dx, keeping the angle (both ends move by dx), then clampAim. */
export function moveBowler(aim: Aim, dx: number): Aim {
  return clampAim({ startX: aim.startX + dx, headX: aim.headX + dx });
}

/** Swings the arrow: headX moves by dx and startX stays, then clampAim. */
export function swingArrow(aim: Aim, dx: number): Aim {
  return clampAim({ startX: aim.startX, headX: aim.headX + dx });
}

/** Where the arrow's tip is: lineX(aim, ARROW_Z). */
export function arrowTipX(aim: Aim): number {
  return lineX(aim, ARROW_Z);
}

/** The aim whose line runs from `startX` through the centre of a pin's spot (then clamped). */
export function aimThrough(startX: number, pin: PinId): Aim {
  const spot = pinSpot(pin);
  const start = clamp(startX, -AIM_LIMIT, AIM_LIMIT);
  // Carry the line from (start, RELEASE_Z) through the spot back to z = HEAD_Z.
  const headX = start + ((spot.x - start) * (HEAD_Z - RELEASE_Z)) / (spot.z - RELEASE_Z);
  return clampAim({ startX: start, headX });
}

/**
 * Most a right answer can drift: the line's offset at the head-pin row. The design said 12 cm, but
 * a lone 7 or 10 pin, aimed at as far as the lane allows, was only grazed by a 12 cm drift
 * inwards (16.7 cm off its centre); 11 cm knocks every lone pin down (see the physics test).
 */
export const MAX_DRIFT = 0.11;
/** Answers faster than this go exactly where aimed. */
export const PERFECT_UNDER_SECONDS = 1;

/**
 * How far a right answer drifts at the head-pin row:
 *   seconds < 1          → 0
 *   otherwise            → MAX_DRIFT · clamp01((seconds − 1) / (clockSeconds − 1))
 * If clockSeconds ≤ 1, any answer of 1 s or more drifts MAX_DRIFT.
 */
export function driftFor(seconds: number, clockSeconds: number): number {
  if (seconds < PERFECT_UNDER_SECONDS) return 0;
  if (clockSeconds <= PERFECT_UNDER_SECONDS) return MAX_DRIFT;
  return (
    MAX_DRIFT *
    clamp((seconds - PERFECT_UNDER_SECONDS) / (clockSeconds - PERFECT_UNDER_SECONDS), 0, 1)
  );
}

/** Which way a drift goes: -1 (left) when random < 0.5, else +1. */
export function driftSide(random: number): -1 | 1 {
  return random < 0.5 ? -1 : 1;
}

/** The line actually thrown: headX moved by side · drift, then clampAim. */
export function thrownAim(aim: Aim, drift: number, side: -1 | 1): Aim {
  return clampAim({ startX: aim.startX, headX: aim.headX + side * drift });
}

export interface ThrowPath {
  startX: number;
  /** Unit direction on the lane (dirZ < 0) and speed. */
  dirX: number;
  dirZ: number;
  speed: number;
}

/** The ball's launch along the line, at BALL_SPEED. */
export function throwPath(aim: Aim): ThrowPath {
  const dx = aim.headX - aim.startX;
  const dz = HEAD_Z - RELEASE_Z;
  const length = Math.hypot(dx, dz);
  return { startX: aim.startX, dirX: dx / length, dirZ: dz / length, speed: BALL_SPEED };
}

/** The gutter a wrong answer goes into: the side of startX; random < 0.5 → left when |startX| < 0.01. */
export function gutterSide(aim: Aim, random: number): -1 | 1 {
  if (Math.abs(aim.startX) < 0.01) return random < 0.5 ? -1 : 1;
  return aim.startX < 0 ? -1 : 1;
}

/** Screen drag to lane distance (default): one board per this many CSS px. */
export const MOVE_PX_PER_BOARD = 8;
export const SWING_PX_PER_BOARD = 6;
