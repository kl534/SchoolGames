/** Pure game rules, kept free of three.js and the DOM so they are easy to test. */

/** One half-inning: it ends at this many outs, or once this many batters have batted. */
export const MAX_OUTS = 3;
export const MAX_BATTERS = 9;
/** Strikes that put a batter out. */
export const STRIKES_OUT = 3;

export type Hit = 'single' | 'double' | 'triple' | 'homer';

/** Bases a hit is worth, and so how far everybody moves. */
export const BASES_FOR: Record<Hit, number> = { single: 1, double: 2, triple: 3, homer: 4 };

/** The fraction of the clock used below which each better hit is earned. */
export const HOMER_BELOW = 0.25;
export const TRIPLE_BELOW = 0.5;
export const DOUBLE_BELOW = 0.75;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** How much of the clock has run, 0 when the answer came at once and 1 at the buzzer. */
export function clockFraction(elapsed: number, total: number): number {
  return total > 0 ? clamp01(elapsed / total) : 1;
}

/** The hit a correct answer earns: the sooner the answer, the further the ball goes. */
export function hitFor(fraction: number): Hit {
  if (fraction < HOMER_BELOW) return 'homer';
  if (fraction < TRIPLE_BELOW) return 'triple';
  if (fraction < DOUBLE_BELOW) return 'double';
  return 'single';
}

/** The big word shown for a hit. */
export function hitLabel(hit: Hit): string {
  return {
    single: 'SINGLE!',
    double: 'DOUBLE IN THE GAP!',
    triple: 'TRIPLE!',
    homer: 'HOME RUN!',
  }[hit];
}

/** What the announcer says for a hit. */
export function hitSpeech(hit: Hit): string {
  return {
    single: 'Single!',
    double: 'Double in the gap!',
    triple: 'Triple!',
    homer: 'Home run!',
  }[hit];
}

/** "+2 runs!", or an empty string when nobody scored. */
export function runsText(runs: number): string {
  if (runs <= 0) return '';
  return `+${runs} ${runs === 1 ? 'run' : 'runs'}!`;
}

/** Who is on first, second and third. */
export type Bases = readonly [boolean, boolean, boolean];

export const EMPTY_BASES: Bases = [false, false, false];

/** One player moving: `from` 0 is the batter, 1 to 3 the bases; `to` 4 is home, a run. */
export interface Move {
  from: number;
  to: number;
}

export interface Advance {
  bases: Bases;
  runs: number;
  moves: Move[];
}

/**
 * Everybody on base, and the batter, move up `count` bases. Whoever goes past third scores,
 * and on a home run that includes the batter.
 */
export function advance(bases: Bases, count: number): Advance {
  const next: [boolean, boolean, boolean] = [false, false, false];
  const moves: Move[] = [];
  let runs = 0;
  // The lead runner first, so the moves read in the order the runners set off.
  for (const from of [3, 2, 1, 0]) {
    if (from > 0 && !bases[from - 1]) continue;
    const to = from + count;
    moves.push({ from, to: Math.min(to, 4) });
    if (to >= 4) runs++;
    else next[to - 1] = true;
  }
  return { bases: next, runs, moves };
}

export interface GameState {
  /** The batter at the plate, from 1. */
  batter: number;
  strikes: number;
  outs: number;
  runs: number;
  bases: Bases;
  over: boolean;
}

export function newGame(): GameState {
  return { batter: 1, strikes: 0, outs: 0, runs: 0, bases: EMPTY_BASES, over: false };
}

/** What happened when a plate appearance finished. */
export interface Outcome {
  state: GameState;
  /** The batter struck out. */
  out: boolean;
  /** Runs scored on this pitch. */
  runs: number;
  /** Who moved where, for a hit. */
  moves: Move[];
}

/** Ends the batter's turn: the next batter steps up, unless the half-inning is over. */
function nextBatter(state: GameState): GameState {
  const over = state.outs >= MAX_OUTS || state.batter >= MAX_BATTERS;
  return { ...state, strikes: 0, over, batter: over ? state.batter : state.batter + 1 };
}

/** A hit: everybody moves up, the strikes are forgotten and the next batter comes up. */
export function applyHit(state: GameState, hit: Hit): Outcome {
  const moved = advance(state.bases, BASES_FOR[hit]);
  const next = nextBatter({
    ...state,
    runs: state.runs + moved.runs,
    bases: moved.bases,
  });
  return { state: next, out: false, runs: moved.runs, moves: moved.moves };
}

/** A strike (a miss or a called strike). The third one is an out. */
export function applyStrike(state: GameState): Outcome {
  const strikes = state.strikes + 1;
  if (strikes < STRIKES_OUT) {
    return { state: { ...state, strikes }, out: false, runs: 0, moves: [] };
  }
  const next = nextBatter({ ...state, strikes, outs: state.outs + 1 });
  return { state: next, out: true, runs: 0, moves: [] };
}

/** The umpire's call, as shown and as said. */
export function strikeCall(
  strikes: number,
  called: boolean,
): { title: string; spoken: string; out: boolean } {
  const words = ['', 'one', 'two', 'three'];
  const n = Math.min(Math.max(strikes, 1), STRIKES_OUT);
  if (n >= STRIKES_OUT) {
    return called
      ? {
          title: 'Strike 3, looking! Out!',
          spoken: 'Strike three, looking! You are out!',
          out: true,
        }
      : { title: 'Strike 3! Out!', spoken: 'Strike three! You are out!', out: true };
  }
  return called
    ? { title: `Called strike ${n}!`, spoken: `Called strike ${words[n]}!`, out: false }
    : { title: `Strike ${n}!`, spoken: `Strike ${words[n]}!`, out: false };
}

/** Outs and strikes as filled and empty dots, like "●●○". */
export function dots(filled: number, total: number): string {
  const n = Math.min(Math.max(filled, 0), total);
  return '●'.repeat(n) + '○'.repeat(total - n);
}

/** Eases `current` towards `goal`; frame-rate independent for a given `rate` (1/seconds). */
export function easeToward(current: number, goal: number, rate: number, delta: number): number {
  return current + (goal - current) * (1 - Math.exp(-rate * delta));
}
