/** The rules of the game, free of three.js and the DOM. Every random choice takes its number. */

export const HALVES = 2;
/** Turns each side has in a half. An overtime period is one turn each. */
export const TURNS_PER_HALF = 5;
export const TURNS_PER_OVERTIME = 1;

/** Offense: answer times (seconds from the end of the spoken question). */
export const THREE_UNDER_SECONDS = 0.4; // a 3-pointer or a dunk
export const JUMPER_UNDER_SECONDS = 1; // a jump shot; slower is a layup
/** Of the fastest shots, the share that are dunks rather than 3-pointers. */
export const DUNK_SHARE = 0.5;
/** Of our dunks, the share that are and-ones (a bonus free throw). */
export const AND_ONE_CHANCE = 0.25;
/** Chance a missed shot of ours is an offensive rebound (at most once a turn). */
export const REBOUND_CHANCE = 1 / 3;

/** Defense: answer times. */
export const BLOCK_UNDER_SECONDS = 0.5;
export const STEAL_UNDER_SECONDS = 1;

/** Made shots in a row (ours) that set you on fire. */
export const ON_FIRE_AFTER = 3;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** Picks by weight; `random` from 0 up to (not including) 1. */
export function pickWeighted<T>(items: readonly { value: T; weight: number }[], random: number): T {
  const total = items.reduce((n, item) => n + item.weight, 0);
  const r = clamp01(random) * total;
  let upTo = 0;
  for (const item of items) {
    upTo += item.weight;
    // A hair of slack, so the sums of decimals land exactly on the boundaries.
    if (r < upTo - 1e-9) return item.value;
  }
  return items[items.length - 1].value;
}

// ---------- Shots and stops ----------

export type Shot = 'three' | 'dunk' | 'jumper' | 'layup';
export const SHOT_POINTS: Record<Shot, number> = { three: 3, dunk: 2, jumper: 2, layup: 2 };

/** Our shot on a right answer. `random` picks dunk (< DUNK_SHARE) or three in the fastest band. */
export function shotFor(seconds: number, random: number): Shot {
  if (seconds < THREE_UNDER_SECONDS) return random < DUNK_SHARE ? 'dunk' : 'three';
  if (seconds < JUMPER_UNDER_SECONDS) return 'jumper';
  return 'layup';
}

/** Whether a shot of ours is an and-one: only a dunk, when `random < AND_ONE_CHANCE`. */
export function isAndOne(shot: Shot, random: number): boolean {
  return shot === 'dunk' && random < AND_ONE_CHANCE;
}

export type Stop = 'block' | 'steal' | 'forced-miss';

/** Our stop on a right answer on defense: < 0.5 block, < 1 steal, else forced-miss. */
export function stopFor(seconds: number): Stop {
  if (seconds < BLOCK_UNDER_SECONDS) return 'block';
  if (seconds < STEAL_UNDER_SECONDS) return 'steal';
  return 'forced-miss';
}

/** How the rival scores on a wrong answer (or timeout) on defense. */
export interface RivalScore {
  shot: Shot;
  andOne: boolean;
  /** 2, 3, or 3 for an and-one (2 + the free throw). */
  points: number;
}

export const RIVAL_SCORES: readonly { value: 'two' | 'three' | 'and-one'; weight: number }[] = [
  { value: 'two', weight: 0.7 },
  { value: 'three', weight: 0.25 },
  { value: 'and-one', weight: 0.05 },
];

/**
 * `r1` picks two / three / and-one by the weights above. For a two, `r2` picks the shot:
 * [0, 1/3) layup, [1/3, 2/3) jumper, [2/3, 1) dunk. A three is `{ shot: 'three', points: 3 }`; an
 * and-one is `{ shot: 'layup', andOne: true, points: 3 }`.
 */
export function rivalScoreFor(r1: number, r2: number): RivalScore {
  const kind = pickWeighted(RIVAL_SCORES, r1);
  if (kind === 'three') return { shot: 'three', andOne: false, points: 3 };
  if (kind === 'and-one') return { shot: 'layup', andOne: true, points: 3 };
  const r = clamp01(r2);
  const shot: Shot = r < 1 / 3 ? 'layup' : r < 2 / 3 ? 'jumper' : 'dunk';
  return { shot, andOne: false, points: 2 };
}

// ---------- The game state ----------

export type Side = 'us' | 'them';

export interface GameState {
  /** 1 and 2 are the halves; 3 is the first overtime, 4 the second, and so on. */
  period: number;
  /** Turns finished in this period by each side. */
  usTurns: number;
  themTurns: number;
  /** Who has the ball now. */
  ball: Side;
  /** Points. */
  us: number;
  them: number;
  /** Our made shots in a row (free throws neither count nor break it). */
  streak: number;
  /** This turn has already had its one offensive rebound. */
  reboundUsed: boolean;
  /** Our and-one free throw is waiting to be shot. */
  freeThrow: boolean;
  over: boolean;
  winner: Side | null;
}

export function newGame(): GameState {
  return {
    period: 1,
    usTurns: 0,
    themTurns: 0,
    ball: 'us',
    us: 0,
    them: 0,
    streak: 0,
    reboundUsed: false,
    freeThrow: false,
    over: false,
    winner: null,
  };
}

/** Turns each side has in a period: 5 in a half, 1 in overtime. */
export function turnsInPeriod(period: number): number {
  return period <= HALVES ? TURNS_PER_HALF : TURNS_PER_OVERTIME;
}

/** Who has the ball first in a period: the rival in the 2nd half, us otherwise. */
export function firstBall(period: number): Side {
  return period === 2 ? 'them' : 'us';
}

export function isOvertime(state: GameState): boolean {
  return state.period > HALVES;
}

export function onFire(state: GameState): boolean {
  return state.streak >= ON_FIRE_AFTER;
}

/** Dots on the scorebug: rounds (one turn each) left in this period. */
export function roundsLeft(state: GameState): number {
  return turnsInPeriod(state.period) - Math.min(state.usTurns, state.themTurns);
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`;
}

/** "1st half", "2nd half", "Overtime", "2nd overtime", "3rd overtime"... (on screen only). */
export function periodLabel(period: number): string {
  if (period <= HALVES) return `${ordinal(period)} half`;
  const n = period - HALVES;
  return n === 1 ? 'Overtime' : `${ordinal(n)} overtime`;
}

/** Short for the scorebug: "1st", "2nd", "OT", "2OT", "3OT"... */
export function periodShort(period: number): string {
  if (period <= HALVES) return ordinal(period);
  const n = period - HALVES;
  return n === 1 ? 'OT' : `${n}OT`;
}

// ---------- Transitions ----------

/**
 * Our right answer on offense. Adds the points and grows the streak. If `andOne`, sets
 * `freeThrow` (the turn waits for it); otherwise the turn is NOT ended here (call endTurn).
 */
export function ourBasket(
  state: GameState,
  shot: Shot,
  andOne: boolean,
): { state: GameState; points: number; fireStarted: boolean } {
  const points = SHOT_POINTS[shot];
  const streak = state.streak + 1;
  return {
    state: { ...state, us: state.us + points, streak, freeThrow: andOne },
    points,
    fireStarted: streak === ON_FIRE_AFTER,
  };
}

/** Our free throw: made adds 1. Clears `freeThrow`. Doesn't touch the streak. */
export function ourFreeThrow(state: GameState, made: boolean): GameState {
  return { ...state, us: state.us + (made ? 1 : 0), freeThrow: false };
}

/**
 * Our wrong answer on offense: the streak goes to 0. If the turn hasn't had its rebound and
 * `random < REBOUND_CHANCE`, we keep the ball (`rebound: true`, `reboundUsed` set).
 */
export function ourMiss(state: GameState, random: number): { state: GameState; rebound: boolean } {
  const rebound = !state.reboundUsed && random < REBOUND_CHANCE;
  return {
    state: { ...state, streak: 0, reboundUsed: state.reboundUsed || rebound },
    rebound,
  };
}

/** Shot clock violation: the streak goes to 0. The turn then ends (call endTurn). */
export function ourViolation(state: GameState): GameState {
  return { ...state, streak: 0 };
}

/** The rival scores. Their and-one free throw is part of `score.points`. */
export function theirBasket(state: GameState, score: RivalScore): GameState {
  return { ...state, them: state.them + score.points };
}

export type TurnEnd = 'turn' | 'halftime' | 'overtime' | 'final';

/**
 * Ends the turn of whoever has the ball. Counts it, clears `reboundUsed`, and:
 * - if the other side still has turns in this period, the ball goes to them ('turn');
 *   if only this side has turns left (cannot happen with alternating turns) it keeps it;
 * - period 1 done: period 2, turns 0, ball = firstBall(2) = 'them' ('halftime');
 * - period 2 or later done and us != them: over, winner ('final');
 * - period 2 or later done and tied: period + 1, turns 0, ball 'us' ('overtime').
 * The streak carries over between turns, periods and overtime.
 */
export function endTurn(state: GameState): { state: GameState; end: TurnEnd } {
  const total = turnsInPeriod(state.period);
  const next: GameState = {
    ...state,
    reboundUsed: false,
    freeThrow: false,
    usTurns: state.usTurns + (state.ball === 'us' ? 1 : 0),
    themTurns: state.themTurns + (state.ball === 'them' ? 1 : 0),
  };
  const other: Side = state.ball === 'us' ? 'them' : 'us';
  const turnsOf = (side: Side) => (side === 'us' ? next.usTurns : next.themTurns);
  if (turnsOf(other) < total) return { state: { ...next, ball: other }, end: 'turn' };
  if (turnsOf(state.ball) < total) return { state: next, end: 'turn' };

  if (state.period < HALVES) {
    const period = state.period + 1;
    return {
      state: { ...next, period, usTurns: 0, themTurns: 0, ball: firstBall(period) },
      end: 'halftime',
    };
  }
  if (next.us !== next.them) {
    return {
      state: { ...next, over: true, winner: next.us > next.them ? 'us' : 'them' },
      end: 'final',
    };
  }
  const period = state.period + 1;
  return {
    state: { ...next, period, usTurns: 0, themTurns: 0, ball: firstBall(period) },
    end: 'overtime',
  };
}

// ---------- Spoken lines (all fixed, all recorded) ----------

export const SHOT_SPEECH: Record<Shot, string> = {
  three: 'From downtown! Three pointer!',
  dunk: 'Slam dunk!',
  jumper: 'Jump shot! Nothing but net!',
  layup: 'Layup! Two points!',
};
export const AND_ONE_SPEECH = 'And one! Free throw coming up.';
export const FREE_THROW_MADE_SPEECH = 'Swish! The free throw is good!';
export const FREE_THROW_MISSED_SPEECH = 'Rims out! No free throw.';
export const MISS_SPEECH = 'Clank! No good.';
export const OFFENSIVE_REBOUND_SPEECH = 'Offensive rebound! Shoot again!';
export const THEIR_BALL_SPEECH = 'Their ball!';
export const VIOLATION_SPEECH = 'Shot clock violation!';
export const ON_FIRE_SPEECH = "You're on fire!";
export const STOP_SPEECH: Record<Stop, string> = {
  block: 'Blocked! Get that out of here!',
  steal: 'Steal! What a grab!',
  'forced-miss': 'No good! Your rebound.',
};

/** What the announcer says when the rival scores. */
export function theirScoreSpeech(score: RivalScore): string {
  if (score.andOne) return 'And one! They score three.';
  switch (score.shot) {
    case 'three':
      return 'They hit a three.';
    case 'dunk':
      return 'They dunk it.';
    case 'jumper':
      return 'They hit a jump shot.';
    case 'layup':
      return 'They score on a layup.';
  }
}

export const HALFTIME_SPEECH = 'Halftime!';
export const OVERTIME_SPEECH = 'Overtime!';
/** Already recorded for Batter Up; the clip is shared. */
export const YOU_WIN_SPEECH = 'You win!';

// ---------- On-screen words (free-form, not spoken) ----------

export const SHOT_LABEL: Record<Shot, string> = {
  three: '3-POINTER!',
  dunk: 'SLAM DUNK!',
  jumper: 'JUMP SHOT!',
  layup: 'LAYUP!',
};
export const STOP_LABEL: Record<Stop, string> = {
  block: 'BLOCKED!',
  steal: 'STEAL!',
  'forced-miss': 'NO GOOD!',
};

/** "+3", "+2", "+1". */
export function pointsText(points: number): string {
  return `+${points}`;
}

/** Eases a number towards a goal; `rate` per second. */
export function easeToward(current: number, goal: number, rate: number, delta: number): number {
  return current + (goal - current) * (1 - Math.exp(-rate * delta));
}
